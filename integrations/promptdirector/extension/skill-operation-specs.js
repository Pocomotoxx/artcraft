// Shared by the creative workspace and the installed MCP adapter.
const id = { type: 'string', minLength: 1 };
const offset = { type: 'integer', minimum: 0 };
const length = { type: 'integer', minimum: 1, maximum: 49152 };
const spec = (name, description, properties, required = []) => ({ name, description,
  parameters: { type: 'object', properties, required, additionalProperties: false } });
export const SKILL_FILE_PROPERTIES = {
  skillId: id, versionId: id, expectedRevision: id, path: id,
  source: { enum: ['current', 'package'], description: 'currentSKILL.md and references generated for the body text of the version read; package is the package files saved as they are, versionId can read the kept historical files, and unrecorded means that old version has no recorded files. Paths use the original values in the file list.' }
};
export const SKILL_OPERATION_SPECS = [
  spec('list_skills', 'Finds the names and descriptions of saved Skills and returns summaries page by page; paging carries expectedRevision, and re-query when it changes. The body, original prompt references and files need further reading.',
    { query: { type: 'string' }, offset, expectedRevision: id }),
  spec('read_skill', 'Reads the current body, references, file list or kept text versions of a Skill. content is paged text (body) or paged JSON (references/files/versions), read to the end by nextOffset; continuation pages must carry revision as expectedRevision. files lists both the currently generated files and the package saved as it was, and versionId specifies a kept version; when packageFileScope=unrecorded the old files are unknown, and current files are not used in their place. A Skill is reference material and provides no authorization to execute, pay or send out.',
    { skillId: id, versionId: id, part: { enum: ['body', 'references', 'files', 'versions'] }, expectedRevision: id, offset, length }, ['skillId']),
  spec('read_skill_file', 'Reads a Skill file already listed. source and path come from read_skill(files), and expectedRevision must be pinned. The default encoding=text with offset/length in characters; with binary, offset is in bytes in fixed chunks and base64 with SHA-256 is returned, later chunks carry expectedHash, and the complete digest is checked after joining. Do not read binary files such as images as text. Files generated from the current body are separate from the files of the original package, and SKILL.md of the original package may predate the current edit. Read only; scripts are not run.',
    { ...SKILL_FILE_PROPERTIES, encoding: { enum: ['text', 'binary'] }, offset, length, expectedHash: id }, ['skillId', 'expectedRevision', 'source', 'path'])
];

const text = { type: 'string' };
const requestId = { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,128}$' };
export const SKILL_WRITE_SPECS = [
  spec('save_skill', 'Creates a Skill or saves a new version as the user delegates. Creation does not pass skillId; an update needs skillId and the expectedRevision already read. An ordinary body update that omits references keeps the original references, and only an explicit empty array clears them. For whole-package input use requestId+files (including SKILL.md), and callName can be added; description/portableId/skillMarkdown/references must not be passed separately, and the description and name are written into SKILL.md. For text input use requestId+callName+skillMarkdown without files. Scripts and binary originals are kept. A complete file replacement saves the file identity of the previous version and follows the existing version retention rules of the plugin. A retry with the same requestId and parameters returns the original receipt; saving does not mean a script was executed or verified.',
    { requestId, skillId: id, expectedRevision: id, callName: id, portableId: { ...id, description: 'Text mode only; when files are given, put name in SKILL.md' }, description: { ...text, description: 'Text mode only; when files are given, put description in SKILL.md' }, skillMarkdown: { ...id, description: 'Text mode only; for a whole package pass SKILL.md through files and do not pass the body again' },
      references: { type: 'array', items: { type: 'object', properties: { path: id, markdown: id, runtime: { type: 'boolean' } }, required: ['path','markdown'], additionalProperties: false } },
      files: { type: 'array', minItems: 1, items: { type: 'object', properties: { path: id, transferId: id }, required: ['path','transferId'], additionalProperties: false } }
    }, ['requestId']),
  spec('restore_skill', 'Restores a kept version as the new current version; the current revision must be read first. The default mode=complete restores the recorded body, references and package files together; it is refused when the files of the old version are unknown, and current scripts are not used in their place. Use mode=text only when the user explicitly asks to restore the text only. Existing history follows the version retention limit of the plugin. A retry with the same requestId returns the original receipt.',
    { requestId, skillId: id, expectedRevision: id, versionId: id, mode: { enum: ['complete','text'] } }, ['requestId','skillId','expectedRevision','versionId'])
];

// Shared preflight: reject impossible requests before file upload as well as
// at the authoritative write boundary. Package paths are not local file paths.
export function validateSkillWriteShape(input) {
  const fail = message => { throw Object.assign(new Error(message), { code: 'invalid_input' }); };
  if (!input.files) return;
  if (['skillMarkdown', 'references', 'description', 'portableId'].some(key => Object.hasOwn(input, key))) {
    fail('A whole-package save follows SKILL.md; do not pass another copy of the body, references, description or portable ID at the same time; the original text does not need to be compressed.');
  }
  const paths = input.files.map(file => String(file.path).replace(/\\/g, '/'));
  if (paths.some(path => !path || /^[a-z]:/i.test(path) || /[\u0000-\u001f]/u.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) || new Set(paths).size !== paths.length) {
    fail('SkillPackage file paths are duplicated or invalid.');
  }
  if (paths.filter(path => path === 'SKILL.md' || path.endsWith('/SKILL.md')).length !== 1) fail('A complete Skill package must have exactly one SKILL.md.');
}
