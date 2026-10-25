use crate::services::promptdirector::client::connector_location::find_connector_entrypoint;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, ChildStdout, Command};

const MCP_PROTOCOL_VERSION: &str = "2025-06-18";
const CALL_TIMEOUT: Duration = Duration::from_secs(45);

/// Tool names are prefixed by the connector (`promptdirector_<name>`).
const TOOL_PREFIX: &str = "promptdirector_";

/// Read-only subset exposed to the ArtCraft UI. Writes into the user's library stay in PromptDirector.
pub const ALLOWED_TOOLS: &[&str] = &[
  "status",
  "describe_case_query",
  "search_cases",
  "read_case",
  "read_workspace_context",
  "read_workspace_content",
  "resolve_reference",
];

#[derive(Debug)]
pub enum PromptDirectorError {
  ToolNotAllowed(String),
  ConnectorNotFound,
  NodeUnavailable(String),
  Io(String),
  Timeout,
  Protocol(String),
}

impl std::fmt::Display for PromptDirectorError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      Self::ToolNotAllowed(tool) => write!(f, "PromptDirector tool not allowed: {tool}"),
      Self::ConnectorNotFound => write!(f, "PromptDirector connector not found (integrations/promptdirector/connector/mcp.mjs; run npm install there, or set PROMPTDIRECTOR_CONNECTOR_PATH)"),
      Self::NodeUnavailable(e) => write!(f, "Node.js is required for the PromptDirector connector: {e}"),
      Self::Io(e) => write!(f, "PromptDirector connector I/O error: {e}"),
      Self::Timeout => write!(f, "PromptDirector connector timed out (is Chrome with the PromptDirector extension running?)"),
      Self::Protocol(e) => write!(f, "PromptDirector connector protocol error: {e}"),
    }
  }
}

/// One-shot MCP call over stdio: spawn the connector, handshake, call the tool, shut down.
/// Spawning per call keeps this stateless; the connector itself is cheap to start.
pub async fn call_promptdirector_tool(tool: &str, arguments: Value) -> Result<Value, PromptDirectorError> {
  if !ALLOWED_TOOLS.contains(&tool) {
    return Err(PromptDirectorError::ToolNotAllowed(tool.to_string()));
  }
  let entrypoint = find_connector_entrypoint().ok_or(PromptDirectorError::ConnectorNotFound)?;
  let tool_name = format!("{TOOL_PREFIX}{tool}");

  tokio::time::timeout(CALL_TIMEOUT, run_session(entrypoint, tool_name, arguments))
      .await
      .map_err(|_| PromptDirectorError::Timeout)?
}

async fn run_session(
  entrypoint: PathBuf,
  tool_name: String,
  arguments: Value,
) -> Result<Value, PromptDirectorError> {
  let mut child = Command::new("node")
      .arg(&entrypoint)
      .current_dir(entrypoint.parent().unwrap_or(Path::new(".")))
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .stderr(Stdio::null())
      .kill_on_drop(true)
      .spawn()
      .map_err(|e| PromptDirectorError::NodeUnavailable(e.to_string()))?;

  let mut stdin = child.stdin.take().ok_or_else(|| PromptDirectorError::Io("no stdin".into()))?;
  let stdout = child.stdout.take().ok_or_else(|| PromptDirectorError::Io("no stdout".into()))?;
  let mut lines = BufReader::new(stdout).lines();

  send(&mut stdin, json!({
    "jsonrpc": "2.0", "id": 1, "method": "initialize",
    "params": {
      "protocolVersion": MCP_PROTOCOL_VERSION,
      "capabilities": {},
      "clientInfo": { "name": "artcraft", "version": env!("CARGO_PKG_VERSION") }
    }
  })).await?;
  read_response(&mut lines, 1).await?;

  send(&mut stdin, json!({ "jsonrpc": "2.0", "method": "notifications/initialized" })).await?;
  send(&mut stdin, json!({
    "jsonrpc": "2.0", "id": 2, "method": "tools/call",
    "params": { "name": tool_name, "arguments": arguments }
  })).await?;

  read_response(&mut lines, 2).await
}

async fn send(stdin: &mut ChildStdin, message: Value) -> Result<(), PromptDirectorError> {
  let mut line = message.to_string();
  line.push('\n');
  stdin.write_all(line.as_bytes()).await.map_err(|e| PromptDirectorError::Io(e.to_string()))?;
  stdin.flush().await.map_err(|e| PromptDirectorError::Io(e.to_string()))
}

async fn read_response(
  lines: &mut tokio::io::Lines<BufReader<ChildStdout>>,
  id: u64,
) -> Result<Value, PromptDirectorError> {
  loop {
    let line = lines.next_line().await
        .map_err(|e| PromptDirectorError::Io(e.to_string()))?
        .ok_or_else(|| PromptDirectorError::Protocol("connector exited before replying".into()))?;
    let Ok(message) = serde_json::from_str::<Value>(&line) else { continue };
    if message.get("id").and_then(Value::as_u64) != Some(id) {
      continue; // Notifications and unrelated traffic.
    }
    if let Some(error) = message.get("error") {
      return Err(PromptDirectorError::Protocol(error.to_string()));
    }
    return Ok(message.get("result").cloned().unwrap_or(Value::Null));
  }
}
