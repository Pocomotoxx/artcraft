import { CASE_OPERATION_SPECS, CASE_SEARCH_PROPERTIES } from './case-operation-specs.js';
import { CASE_QUERY_DESCRIPTION } from './case-query-specs.js';
import { PROJECT_OPERATION_SPECS, SAVE_TEXT_MATERIAL_SPEC } from './project-operation-specs.js';
import { WORKSPACE_OPERATION_SPECS } from './workspace-operation-specs.js';
import { WORKSPACE_SCREENSHOT_SPEC } from './workspace-screenshot-specs.js';
import { SKILL_OPERATION_SPECS, SKILL_WRITE_SPECS } from './skill-operation-specs.js';
import { ANALYSIS_BATCH_SPECS } from './analysis-batch-specs.js';

const id = { type: 'string', minLength: 1 }, offset = { type: 'integer', minimum: 0 };
const spec = (name, description, properties = {}, required = []) => ({ name, description,
  parameters: { type: 'object', properties, required, additionalProperties: false } });
// Browser and external Agents execute the same library operations. Host file
// transfers and destructive operations are not conversational library tools.
export const ASSISTANT_LIBRARY_SPECS = [
  ...CASE_OPERATION_SPECS, ...PROJECT_OPERATION_SPECS, SAVE_TEXT_MATERIAL_SPEC,
  ...WORKSPACE_OPERATION_SPECS, WORKSPACE_SCREENSHOT_SPEC,
  ...SKILL_OPERATION_SPECS, ...SKILL_WRITE_SPECS.filter(item => item.name === 'save_skill'),
  ...ANALYSIS_BATCH_SPECS,
  spec('describe_case_query', 'Reads the fields and condition descriptions the case library actually supports for queries.'),
  spec('search_cases', CASE_QUERY_DESCRIPTION, { ...CASE_SEARCH_PROPERTIES, offset,
    limit: { type: 'integer', minimum: 1, maximum: 100 } }),
  spec('read_case', 'Reads the actual case body/original prompt, continuing by nextOffset and the returned revision. Get the edit version separately with read_case_details.',
    { caseId: id, assetId: id, part: { enum: ['body', 'original_prompt', 'ai_prompt', 'time_notes', 'document', 'media_prompts', 'generation_info'] },
      expectedRevision: id, offset, length: { type: 'integer', minimum: 1, maximum: 49152 } }, ['caseId']),
  spec('read_media', 'Reads the actual image original of a case for the current model to observe; a model without vision cannot see images. For video/audio it returns the real media information and does not claim to have watched the video.', { caseId: id, assetId: id }, ['caseId', 'assetId']),
  spec('show_case', 'Opens the actual case detail, keeps manual drafts and waits until the live context is ready.', { caseId: id }, ['caseId']),
  spec('resolve_reference', 'Resolves exact plugin reference citations without guessing case identity.', { reference: id }, ['reference']),
  spec('read_workspace_context', 'Reads the overview of the references selected in the plugin. For multiple pages specify tabId; a selection is not treated as authorization.',
    { source: { enum: ['selection', 'page'] }, tabId: offset, expectedRevision: id, offset, limit: { type: 'integer', minimum: 1, maximum: 100 } }),
  spec('read_workspace_content', 'Reads the full content of the selected references or page draft by version and nextOffset, without reading settings credentials.',
    { source: { enum: ['selection', 'page'] }, tabId: offset, expectedRevision: id,
      part: { enum: ['instruction', 'reference', 'selection'] }, referenceId: id, offset, length: { type: 'integer', minimum: 1, maximum: 49152 } }, ['part'])
];
export const assistantOperationName = name => name === 'search_cases' ? 'search' : name;
