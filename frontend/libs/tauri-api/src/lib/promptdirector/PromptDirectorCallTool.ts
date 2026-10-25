import { invoke } from "@tauri-apps/api/core";
import { CommandResult } from "../common/CommandStatus";

// Read-only PromptDirector connector tools reachable from ArtCraft.
export type PromptDirectorTool =
  | "status"
  | "describe_case_query"
  | "search_cases"
  | "read_case"
  | "read_workspace_context"
  | "read_workspace_content"
  | "resolve_reference";

export interface PromptDirectorCallToolSuccess extends CommandResult {
  payload: PromptDirectorCallToolPayload;
}

export interface PromptDirectorCallToolPayload {
  // Raw MCP tools/call result (content, isError, ...).
  result: unknown;
}

// Returns the Success and Error variants directly.
// Throws on Network/Tauri errors.
export const PromptDirectorCallTool = async (
  tool: PromptDirectorTool,
  args: Record<string, unknown> = {},
): Promise<PromptDirectorCallToolSuccess> => {
  return await invoke("promptdirector_call_tool_command", {
    request: { tool, arguments: args },
  }) as PromptDirectorCallToolSuccess;
};
