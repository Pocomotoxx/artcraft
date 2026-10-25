import { AGENT_INSTRUCTIONS, TOOL_TITLES } from './agent-guidance.mjs';
import { WORKSPACE_OPERATION_SPECS } from '../extension/workspace-operation-specs.js';
import { CAPTURE_OPERATION_SPECS } from '../extension/capture-operation-specs.js';
import {ANALYSIS_BATCH_SPECS} from '../extension/analysis-batch-specs.js';
import { AGENT_CASE_ACTION_SPECS } from '../extension/agent-case-action-specs.js';
import { WORKSPACE_SCREENSHOT_SPEC } from '../extension/workspace-screenshot-specs.js';
import { SKILL_OPERATION_SPECS, SKILL_FILE_PROPERTIES, SKILL_WRITE_SPECS, validateSkillWriteShape } from '../extension/skill-operation-specs.js';
import { PROJECT_OPERATION_SPECS, MATERIAL_PROPERTIES } from "../extension/project-operation-specs.js";
import packageInfo from './package.json' with { type: 'json' };
import { isMain } from "./is-main.mjs";
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { callExtension } from './bridge-client.mjs';
import { TASK_WAIT_MS } from './request-policy.mjs';
import { receiveMedia, receiveWorkspaceScreenshot, stageFiles } from './transfers.mjs';
import { CASE_OPERATION_SPECS, CASE_SEARCH_PROPERTIES } from '../extension/case-operation-specs.js';
import { CASE_QUERY_PROPERTIES, CASE_QUERY_DESCRIPTION } from '../extension/case-query-specs.js';

const requestId = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const project = z.string().optional();
const TIMING = process.env.PROMPTDIRECTOR_TIMING === '1';
const CONNECTION_ERROR_CODES = new Set(['connector_offline', 'connector_timeout', 'connector_access_denied']);

export function createServer(callBridge = callExtension) {
  // Status is reused only while the same native-host session answers: capability checks then cost no extra
  // round trip, and a reloaded extension is detected at the handshake before any request is sent.
  let cached = null;
  const call = async (operation, input) => {
    let hostSession;
    const started = TIMING ? performance.now() : 0;
    const result = await callBridge(operation, input, {
      ...(cached ? { expectedHostSession: cached.hostSession } : {}),
      onHostSession: value => { hostSession = value; }
    }).catch(error => {
      if (error?.code === 'connector_session_changed' || CONNECTION_ERROR_CODES.has(error?.code)) cached = null;
      throw error;
    }).finally(() => {
      // Developer timing goes to stderr so the MCP stdout protocol stays untouched; no arguments are logged.
      if (TIMING) process.stderr.write(`${JSON.stringify({ timing: 'bridge', operation, ms: Math.round(performance.now() - started) })}\n`);
    });
    if (operation === 'status') cached = hostSession ? { status: result, hostSession } : null;
    return result;
  };
  const requireStatus = async (satisfied) => cached && satisfied(cached.status) ? cached.status : call('status');
  const server = new McpServer({ name: 'promptdirector', version: packageInfo.version }, {
    instructions: AGENT_INSTRUCTIONS
  });
  function tool(name, description, inputSchema, readonly, handler, destructive = false) {
    server.registerTool(`promptdirector_${name}`, { title: TOOL_TITLES[name], description, inputSchema,
      annotations: { readOnlyHint: readonly, destructiveHint: destructive, idempotentHint: name !== 'show_case', openWorldHint: ['capture_url', 'prepare_capture', 'save_capture'].includes(name) } },
    async input => {
      try {
        const result = await handler(input).catch(error => {
          if (error?.code !== 'connector_session_changed') throw error;
          return handler(input);
        });
        if (name === 'capture_workspace' && result.image) {
          const { image, ...metadata } = result;
          return { content: [{ type: 'text', text: JSON.stringify(metadata), annotations: { audience: ['assistant'] } },
            { type: 'image', ...image }] };
        }
        if (name === 'read_capture' && ['screenshot', 'image'].includes(result.part) && /^data:image\/(?:png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/u.test(result.dataUrl || '')) {
          const { dataUrl, ...metadata } = result;
          return { content: [{ type: 'text', text: JSON.stringify(metadata), annotations: { audience: ['assistant'] } },
            { type: 'image', data: dataUrl.split(',')[1], mimeType: dataUrl.slice(5, dataUrl.indexOf(';')) }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result), annotations: { audience: ['assistant'] } }] }; }
      catch (error) { return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: error.code || 'operation_failed', message: error.message }) }] }; }
    });
  }
  for (const spec of CAPTURE_OPERATION_SPECS) {
    tool(spec.name, spec.description, z.fromJSONSchema(spec.parameters), spec.name === 'read_capture', async input => {
      const status = await requireStatus(current => current.capabilities?.includes(spec.name));
      if (!status.capabilities?.includes(spec.name)) throw Object.assign(new Error('The plugin has not loaded the resumable capture tools yet. Save any unfinished content and reload the extension.'), { code: 'unsupported_capture_operation' });
      const result = await call(spec.name, input);
      if (!['queued', 'running'].includes(result.state)) return result;
      try { return await call('get_task', { requestId: input.requestId, waitMs: TASK_WAIT_MS }); }
      catch (error) { return { ...result, waitError: { code: error.code || 'operation_failed', message: error.message },
        next: 'The completion state is not confirmed yet. Query get_task with the original request ID and do not create a duplicate request.' }; }
    });
  }
  for (const spec of WORKSPACE_OPERATION_SPECS) {
    const parameters = spec.name === 'control_workspace' ? { ...spec.parameters, properties: { ...spec.parameters.properties,
      file: { type: 'object', properties: { path: { type: 'string', minLength: 1 }, mimeType: { type: 'string' } }, required: ['path'], additionalProperties: false } } } : spec.name === 'read_review_media' ? { ...spec.parameters, properties: { tabId: spec.parameters.properties.tabId, temporaryId: spec.parameters.properties.temporaryId } } : spec.parameters;
    tool(spec.name, spec.description + (spec.name === 'control_workspace' ? ' open_temporaryUse file to pass an explicitly specified local image/video path without saving a case first; after upload the page version is still verified, and an expired one will not take back the live context. Temporary uploads are cleaned up along the existing temporary file lifecycle.' : spec.name === 'read_review_media' ? ' MCPThe connector reads the whole original automatically and returns a local file path the model can read.' : ''), z.fromJSONSchema(parameters), !['control_workspace', 'open_workspace'].includes(spec.name), async input => {
      if (spec.name === 'read_review_media') return receiveMedia({ ...input, caseId: `temporary:${input.tabId}`, assetId: input.temporaryId },
        (_operation, chunk) => call('read_review_media', { tabId: input.tabId, temporaryId: input.temporaryId, offset: chunk.offset || 0, ...(input.length ? { length: input.length } : {}) }));
      if (input.file) {
        if (input.action !== 'open_temporary' || input.transferId) throw new Error('file is only for open_temporary and cannot be combined with transferId');
        const current = await call('read_live_workspace', { tabId: input.tabId, requestId: input.requestId });
        if (current.controlRevision !== input.expectedRevision && !current.requestKnown) throw Object.assign(new Error('The page has changed; the clip was not uploaded'), { code: 'workspace_changed' });
        const { file, ...args } = input;
        const staged = await stageFiles([file], undefined, input.requestId, call);
        return call(spec.name, { ...args, transferId: staged.transferIds[0] });
      }
      return call(spec.name, input);
    });
  }
  for (const spec of ANALYSIS_BATCH_SPECS) tool(spec.name,spec.description,z.fromJSONSchema(spec.parameters),/^(read|list)_/.test(spec.name),input=>call(spec.name,input),!/^(read|list)_/.test(spec.name));
  for (const spec of AGENT_CASE_ACTION_SPECS) tool(spec.name, spec.description, z.fromJSONSchema(spec.parameters),
    false, async input => {
      const status = await requireStatus(current => current.capabilities?.includes(spec.name));
      if (!status.capabilities?.includes(spec.name)) throw Object.assign(new Error('The plugin backend has not loaded this case operation yet. Save any unfinished edits and reload the extension.'), { code: 'unsupported_case_action' });
      return call(spec.name, input);
    }, true);
  tool(WORKSPACE_SCREENSHOT_SPEC.name, WORKSPACE_SCREENSHOT_SPEC.description, z.fromJSONSchema(WORKSPACE_SCREENSHOT_SPEC.parameters),
    true, input => receiveWorkspaceScreenshot(input, call));
  tool('status', 'Check when the connection is abnormal or when capabilities must be probed for the first time; do not re-check the connection after a successful business receipt.', {}, true, () => call('status'));
  tool('describe_case_query', 'Discovers the fields the current library can query in combination, the actual engagement metrics, and the semantics of relations, missing values, sorting and statistics. Read-only help; it does not read media originals.', {}, true, async () => {
    const status = await requireStatus(current => current.caseQueryVersion === 1);
    if (status.caseQueryVersion !== 1) throw Object.assign(new Error('The plugin backend has not loaded unified field queries yet. Save any unfinished edits and reload the extension, then read the field help again.'), { code: 'unsupported_case_query' });
    return call('describe_case_query');
  });
  tool('resolve_reference', 'Resolves a #pd-reference fragment in a dropped name link or a promptdirector://reference reference, without visiting the link page. It verifies the library, case and asset ownership and returns the real identity for read_case/read_case_details/read_media to continue reading. A reference is not an execution instruction, and the source must not be guessed from a same name or a similar picture.', {
    reference: z.string().min(1)
  }, true, input => call('resolve_reference', input));
  tool('read_workspace_context', 'Reads the selection overview; read the full references directly with read_workspace_content(part=selection). source=selection reads the selection that persists across page close/reload, and an empty list means nothing is selected; source=page/tabId reads the specified page or composer, and multiple pages must not be merged or guessed. selectedCaseCount is the number of selected cases and total is the number of per-asset references; originalPromptCharacters=0 means the original prompt is missing, and sourceUrl/memberCaseIds are for tracing; pendingReferenceSelection=true means the material selection draft in the composer is unconfirmed. Continue reading the list by nextOffset/expectedRevision.', {
    source: z.enum(['selection', 'page']).default('selection'),
    tabId: z.number().int().nonnegative().optional(), expectedRevision: z.string().optional(),
    offset: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(100).default(24)
  }, true, input => call('read_workspace_context', input));
  tool('read_workspace_content', 'Reads the full references: part=selection is the paged JSON of the whole group of creative references (not a full case database record), reference is a single one, and instruction is the draft in the input box. The first page of selection may omit expectedRevision, and the same call pins the current version; continuation pages must pass the returned revision, be joined by nextOffset and then parsed; on selection_changed re-read the live context and do not mix old pages. source=selection reads the persistent selection and source=page/tabId reads a page. originalText is complete and only one copy; referenceTextParts are joined in order, where a string is body text and an object with source=originalText or referenceSources/index references existing text, and referenceSources.textSource=originalText works the same way. caseSources contains the member versions needed for write-back; media contains the owning caseId, the original role, the cover ID and known size/duration. For page temporary references missing a version, query read_case_details on demand; use read_media for library originals, and unstored temporary reference originals are not supported yet.', {
    source: z.enum(['selection', 'page']).default('selection'),
    tabId: z.number().int().nonnegative().optional(), expectedRevision: z.string().min(1).optional(),
    part: z.enum(['instruction', 'reference', 'selection']), referenceId: z.string().optional(),
    offset: z.number().int().nonnegative().default(0), length: z.number().int().min(1).max(49152).default(12000)
  }, true, async input => {
    if (!input.expectedRevision && (input.part !== 'selection' || input.offset !== 0)) {
      throw Object.assign(new Error('A continuation page or single read must carry the expectedRevision already obtained.'), { code: 'invalid_input' });
    }
    try { return await call('read_workspace_content', input); }
    catch (error) {
      // The installed older extension requires a context read before the first content page.
      // Keep that exact compatibility route; never reinterpret other invalid input or conflicts.
      if (input.expectedRevision || error?.code !== 'invalid_input' || error.message !== 'Reading references must carry the version of the current selection.') throw error;
      const context = await call('read_workspace_context', { source: input.source, ...(input.tabId !== undefined ? { tabId: input.tabId } : {}) });
      if (!context.revision) return context;
      return call('read_workspace_content', { ...input, expectedRevision: context.revision });
    }
  });
  tool('show_case', 'Opens the detail of the specified case in a new plugin page, keeping the selection and unsaved edits of the original page, and waits until the detail context is really readable. ready with a matching viewedCaseId means it is displayed; opening means loading has not finished, so keep reading by the returned tabId.', {
    caseId: z.string().min(1)
  }, false, input => call('show_case', input));
  for (const spec of [...CASE_OPERATION_SPECS, ...PROJECT_OPERATION_SPECS, ...SKILL_OPERATION_SPECS]) {
    const readonly = spec.name.startsWith('read_') || spec.name === 'list_skills';
    tool(spec.name, spec.description, z.fromJSONSchema(spec.parameters), readonly, async input => {
      if (spec.name === 'edit_case') {
        const status = await requireStatus(current => current.sourceProtectionVersion === 1);
        if (status.sourceProtectionVersion !== 1) throw Object.assign(new Error('The plugin backend has not loaded original data protection yet. Save any unfinished edits and reload the extension, then make the change.'), { code: 'unsupported_source_protection' });
      }
      return call(spec.name, input);
    }, ['edit_case', 'organize_case', 'update_project'].includes(spec.name));
  }
  const saveSkill = SKILL_WRITE_SPECS.find(spec => spec.name === 'save_skill');
  tool('save_skill', saveSkill.description + ' filesUse the explicitly specified local path and the packagePath inside the package, without scanning directories; there is no need to zip by hand. When the full body or references are already in files, prefer files, and do not copy them again into the parameters or compress them yourself; inline content is limited by the boundary of a single local message including the JSON envelope, and the maxTextBytes of a package is the parsing budget of this call; neither equals the capacity of the library.', z.fromJSONSchema({
    ...saveSkill.parameters, properties: { ...saveSkill.parameters.properties, files: { type: 'array', minItems: 1,
      items: { type: 'object', properties: { path: {type:'string',minLength:1}, packagePath: {type:'string',minLength:1}, mimeType: {type:'string'} }, required: ['path','packagePath'], additionalProperties:false } } }
  }), false, async input => {
    const { files, ...metadata } = input;
    validateSkillWriteShape({ ...metadata, ...(files ? { files: files.map(file => ({ path: file.packagePath })) } : {}) });
    const status = await requireStatus(current => current.capabilities?.includes('save_skill') && (!files || current.skillPackageLimits));
    if (!status.capabilities?.includes('save_skill')) throw new Error('The plugin backend does not support Skill writing yet. Update and reload the plugin and retry; no file was uploaded.');
    if (!files) return call('save_skill',metadata);
    if (!status.skillPackageLimits) throw new Error('The plugin did not declare Skill package limits, so upload was not started; check the versions of the plugin and the connector.');
    const staged = await stageFiles(files, undefined, input.requestId, call, {purpose:'skill-file',limits:status.skillPackageLimits});
    return call('save_skill',{...metadata, files:files.map((file,index)=>({path:file.packagePath,transferId:staged.transferIds[index]}))});
  }, true);
  const restoreSkill = SKILL_WRITE_SPECS.find(spec => spec.name === 'restore_skill');
  tool(restoreSkill.name, restoreSkill.description, z.fromJSONSchema(restoreSkill.parameters), false, input => call(restoreSkill.name,input), true);
  tool('search_cases', CASE_QUERY_DESCRIPTION + ' Searches the text and tags of the current library, combinable with project, mediaKind and hasOriginalPrompt; the media filter ignores covers, and the original-prompt filter does not treat AI reverse-engineered prompts as original prompts. query supports type/source/tag/color/date/note/has filters, the union of alternatives supports synonymous expressions; sort supports time ordering; sort=engagement needs provider and engagementMetric (such as likes), descending by the saved metric with unknown ones last; check the observation time of engagementCoverage and sources, and do not present it as real-time popularity. authorHandle matches the saved author exactly, and a mention in the body does not count. countOnly only counts, and the project tree is read on demand with read_projects. Projects include subprojects. minDurationMs/maxDurationMs filter videos or audio in milliseconds; a missing duration is not treated as 0, see durationCoverage. To page on, carry the revision of the first page as expectedRevision with the same filter; on search_changed re-read from the first page and never mix old and new pages. A summary cannot replace the original text or visual recognition; a title that does not match cannot be taken as proof that something is absent from the picture.', z.fromJSONSchema({
    type: 'object', properties: { ...CASE_SEARCH_PROPERTIES,
      offset: { type: 'integer', minimum: 0, default: 0 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 24 } },
    additionalProperties: false
  }), true, async input => {
    const requested = ['provider', 'authorHandle', 'engagementMetric', 'hasPrompt', ...Object.keys(CASE_QUERY_PROPERTIES)].filter(key => input[key] !== undefined);
    if (requested.length || input.sort === 'engagement') {
      const supports = current => (!Object.keys(CASE_QUERY_PROPERTIES).some(key => input[key] !== undefined) || current.caseQueryVersion === 1)
        && requested.every(key => current.searchFilters?.includes(key))
        && (input.sort !== 'engagement' || current.searchFilters?.includes('engagementMetric'));
      const status = await requireStatus(supports);
      if (Object.keys(CASE_QUERY_PROPERTIES).some(key => input[key] !== undefined) && status.caseQueryVersion !== 1) {
        throw Object.assign(new Error('The plugin backend has not loaded unified field queries yet. Save any unfinished edits and reload the extension. An old result that ignored the field conditions must not be treated as a successful query.'), { code: 'unsupported_case_query' });
      }
      if (requested.some(key => !status.searchFilters?.includes(key)) || input.sort === 'engagement' && !status.searchFilters?.includes('engagementMetric')) {
        throw Object.assign(new Error('The plugin backend has not loaded the required search filters. Save any unfinished edits and reload the extension; an old search result must not be treated as an exact filter.'), { code: 'unsupported_search_filters' });
      }
    }
    return call('search', input);
  });
  tool('read_case', 'Reads the full body or original prompt; the response contains only text, identity and continuation information; read the media/source structure on demand with read_case_details. Continuation pages carry revision as expectedRevision and keep part/assetId; on case_text_changed re-read from the first page and do not join old pages. This revision pins only the text; read the edit version separately with read_case_details. body is the body text and original_prompt organizes the original prompt by source evidence; the two may be the same or different; specifying assetId reads only the original prompt of that asset. media_prompts returns paged JSON. generation_info needs the assetId of the original image. Read media originals separately with read_media.', {
    caseId: z.string(), part: z.enum(['body', 'original_prompt', 'ai_prompt', 'time_notes', 'document', 'media_prompts', 'generation_info']).default('body'), assetId: z.string().optional(),
    expectedRevision: z.string().min(1).optional(), offset: z.number().int().nonnegative().default(0), length: z.number().int().min(1).max(49152).default(12000)
  }, true, async input => {
    if (input.offset > 0 && !input.expectedRevision) throw Object.assign(new Error('Continuing to read text needs the revision of the first page; re-read from the first page.'), { code: 'case_revision_required' });
    const page = await call('read_case', input);
    if (!page.revision) throw Object.assign(new Error('The plugin backend has not loaded text continuation protection yet. Save any unfinished edits and reload the extension.'), { code: 'unsupported_case_text_revision' });
    if (input.expectedRevision && input.expectedRevision !== page.revision) throw Object.assign(new Error('The case text has changed. Re-read from the first page; old pages must not be joined.'), { code: 'case_text_changed' });
    return page;
  });
  tool('read_media', 'Reads one media original of the selected case completely into a local file of the Agent and verifies its SHA-256. View it with the image, video or file tools of the host; a successful download does not mean it has been analyzed.', {
    caseId: z.string(), assetId: z.string()
  }, true, input => receiveMedia(input, call));
  tool('download_skill_file', 'Saves the files listed by read_skill(files) completely to the local machine of the Agent and verifies SHA-256, returning path and relativePath. Scripts, images and long references can be read with host tools; keep source to distinguish the current text from the original package. It does not run scripts or install dependencies.', z.fromJSONSchema({
    type: 'object', properties: SKILL_FILE_PROPERTIES, required: ['skillId', 'expectedRevision', 'source', 'path'], additionalProperties: false
  }), true, async input => {
    const file = await receiveMedia(input, (_operation, args) => call('read_skill_file', { ...args, encoding: 'binary' }));
    return { ...file, skillId: input.skillId, revision: input.expectedRevision, source: input.source, relativePath: input.path };
  });
  tool('capture_url', 'Lets PromptDirector capture a web page itself, opening a standalone tab in Chrome and reusing the generic and site-specific capture paths. mode=whole (default) captures the whole page and loaded captures the content currently loaded; maxCandidates is the candidate budget of this task, can be set according to the goal of the user, defaults to the capture budget of the plugin, and is not a capacity limit of the library. Capturing does not call a paid model. After a task ID is returned, get_task must be queried, and only the final receipt may report the storage result; partial lists unfinished content, and login/permission/rate-limit failures must not be treated as an empty page or a successful storage. Retries reuse the same requestId.', {
    requestId, url: z.url(), project, mode: z.enum(['whole', 'loaded']).optional(), maxCandidates: z.number().int().positive().optional(), generationPromptChoices: z.record(z.string(), z.enum(['overwrite', 'skip'])).optional()
  }, false, input => call('capture', input));
  tool('save_material', 'Saves body text, local attachments or creative results into the library. The source cases are kept. For project use the ID found with read_projects; for a new project first run create_project. projectRevision pins the requirements already read; sourceReferences records exactly the member case versions, assets and millisecond segments already read. previousCreation is specified only when the user asks to save another version, and the old result is kept. files must be explicitly selected absolute file paths; directories are not scanned. bodyFile can designate a body document and must also be listed in files. Images referenced in the body are not downloaded automatically. The connector waits for short tasks and returns the final state; only queued/running or waitError justifies continuing to query get_task with the original requestId. On completed, check the body summary, project, source and revision in results; replayed is a historical receipt and must be read back as needed to confirm that it still exists.', {
    ...Object.fromEntries(Object.entries(MATERIAL_PROPERTIES).map(([key, schema]) => [key, z.fromJSONSchema(schema).optional()])),
    requestId, title: z.string().min(1), text: z.string().max(196608, 'Pass long body text through bodyFile; the original text does not need to be shortened.').default(''), project,
    kind: z.enum(['collected', 'creation']).default('collected'), sourceUrl: z.url().optional(),
    sourceCaseIds: z.array(z.string()).default([]), note: z.string().default(''),
    files: z.array(z.object({ path: z.string(), mimeType: z.string(), originalPrompt: z.string().optional(), forceImport: z.boolean().default(false) })).default([]),
    bodyFile: z.string().optional(), generationPromptChoices: z.record(z.string(), z.enum(['overwrite', 'skip'])).optional()
  }, false, async input => {
    const authoredFields = ['creative', 'customLabels', 'classificationPathIds', 'sourceFacts', 'timeNotes'].filter(key => input[key] !== undefined);
    if (authoredFields.length) {
      const status = await requireStatus(current => authoredFields.every(key => current.materialFields?.includes(key)));
      if (authoredFields.some(key => !status.materialFields?.includes(key))) {
        throw Object.assign(new Error('The plugin backend does not support the write-back fields of this call yet. Save any unfinished edits and reload the extension. No material was uploaded or saved.'), { code: 'unsupported_material_fields' });
      }
    }
    const { files, bodyFile, ...material } = input;
    const staged = await stageFiles(files, bodyFile, input.requestId, call);
    const task = await call('save_material', { ...material, ...staged });
    if (!['queued', 'running'].includes(task.state)) return task;
    // Wait within the extension's declared long-poll budget plus transport time.
    // Wait on the original persisted task; never resubmit after a lost receipt.
    try { return await call('get_task', { requestId: input.requestId, waitMs: TASK_WAIT_MS }); }
    catch (error) { return { ...task, waitError: { code: error.code || 'operation_failed', message: error.message },
      next: 'The completion state is not confirmed; query get_task with the original requestId and do not create a new save request.' }; }
  });
  tool('get_task', 'Queries the final result of a capture or write-back. queued/running only means in progress; after completed, check saved/partial/duplicate and warnings for each item. On interrupted, check the library, and never report a false success. promptConflicts need both original prompts read page by page by token, ask the user whether to overwrite or skip, and then retry with a new request ID carrying generationPromptChoices; do not decide by yourself.', {
    requestId, conflictToken: z.string().optional(), conflictPart: z.enum(['originalText', 'embeddedText']).optional(),
    offset: z.number().int().nonnegative().optional(), length: z.number().int().positive().max(49152).optional()
  }, true, input => call('get_task', input));
  return server;
}
if (isMain(import.meta.url)) {
  await createServer().connect(new StdioServerTransport());
}
