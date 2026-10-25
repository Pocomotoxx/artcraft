use crate::core::commands::response::failure_response_wrapper::{CommandErrorResponseWrapper, CommandErrorStatus};
use crate::core::commands::response::shorthand::ResponseOrErrorMessage;
use crate::core::commands::response::success_response_wrapper::{CommandSuccessResponseWrapper, CommandSuccessStatus, SerializeMarker};
use crate::services::promptdirector::client::promptdirector_mcp_client::{call_promptdirector_tool, PromptDirectorError};
use log::warn;
use serde_derive::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct PromptDirectorCallToolRequest {
  /// Unprefixed connector tool name, e.g. `search_cases`.
  pub tool: String,
  /// Tool arguments exactly as PromptDirector documents them.
  #[serde(default)]
  pub arguments: Value,
}

#[derive(Debug, Serialize)]
pub struct PromptDirectorCallToolResponse {
  /// Raw MCP `tools/call` result (`content`, `isError`, ...).
  pub result: Value,
}

impl SerializeMarker for PromptDirectorCallToolResponse {}

#[tauri::command]
pub async fn promptdirector_call_tool_command(
  request: PromptDirectorCallToolRequest,
) -> ResponseOrErrorMessage<PromptDirectorCallToolResponse> {
  let arguments = if request.arguments.is_null() { Value::Object(Default::default()) } else { request.arguments };

  match call_promptdirector_tool(&request.tool, arguments).await {
    Ok(result) => Ok(CommandSuccessResponseWrapper {
      status: CommandSuccessStatus::Success,
      success_message: None,
      payload: Some(PromptDirectorCallToolResponse { result }),
    }),
    Err(err) => {
      warn!("promptdirector_call_tool_command failed: {err}");
      let status = match err {
        PromptDirectorError::ToolNotAllowed(_) => CommandErrorStatus::BadRequest,
        _ => CommandErrorStatus::ServerError,
      };
      Err(CommandErrorResponseWrapper {
        status,
        error_message: Some(err.to_string()),
        error_type: None,
        error_details: None,
      })
    }
  }
}
