import { WORKSPACE_OPERATION_SPECS } from '../extension/workspace-operation-specs.js';

// Keep the established local transport allowance. Writes and media reads can
// perform both storage and verification; give those two phases an allowance each.
export const CONNECTOR_TIMEOUT_MS = 30_000;
export const TASK_WAIT_MS = WORKSPACE_OPERATION_SPECS.find(spec => spec.name === 'wait_workspace_changes').parameters.properties.waitMs.maximum;
const WRITES = new Set(['edit_case', 'organize_case', 'create_project', 'update_project', 'save_skill', 'restore_skill',
  'trash_case', 'save_material', 'capture', 'prepare_capture', 'update_capture', 'save_capture', 'control_workspace', 'manage_analysis_batch',
  'submit_analysis_result', 'submit_analysis_results', 'begin_transfer', 'append_transfer', 'finish_transfer']);
const MEDIA_READS = new Set(['read_media', 'read_skill_file', 'read_review_media', 'capture_workspace']);

export function requestTimeoutMs(operation, input = {}) {
  if (operation === 'get_task' || operation === 'wait_workspace_changes') {
    const wait = Number.isFinite(input.waitMs) ? Math.max(0, Math.min(TASK_WAIT_MS, input.waitMs)) : 0;
    return CONNECTOR_TIMEOUT_MS + wait;
  }
  return CONNECTOR_TIMEOUT_MS * (WRITES.has(operation) || MEDIA_READS.has(operation) ? 2 : 1);
}

export function timeoutMessage(operation, input = {}) {
  if (WRITES.has(operation)) return input.requestId
    ? 'The plugin response timed out and the completion state is not confirmed; check the result with the original request ID and do not submit a duplicate task with a different ID.'
    : 'The plugin response timed out and the completion state is not confirmed; read the current state again and then decide whether to retry.';
  return 'The plugin response timed out; check the connection and retry the read.';
}
