// Shared contract for recoverable case removal.
const id = { type: 'string', minLength: 1 };
const requestId = { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,128}$' };
const object = (properties, required) => ({ type: 'object', properties, required, additionalProperties: false });
const identity = { caseId: id, expectedRevision: id };
export const AGENT_CASE_ACTION_SPECS = [
  { name: 'trash_case', description: 'Moves cases to the trash of the plugin within the range explicitly specified by the user, keeping originals, complete data and restore relations, and never deleting permanently. First get expectedRevision with read_case_details; a compound ID moves all members, and a member ID moves only that member. On success it returns movedItemIds, which can be restored in the plugin trash. A retry with the same requestId and parameters returns the original receipt and will not delete again a case restored afterwards; a version conflict must be re-read.',
    parameters: object({ requestId, ...identity }, ['requestId', 'caseId', 'expectedRevision']) }
];
