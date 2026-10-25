use std::path::PathBuf;

const CONNECTOR_ENTRYPOINT: &str = "integrations/promptdirector/connector/mcp.mjs";

/// Environment override, for installs where the connector lives elsewhere.
pub const CONNECTOR_PATH_ENV: &str = "PROMPTDIRECTOR_CONNECTOR_PATH";

/// Find `mcp.mjs`: env override first, then the repo checkout above the working directory
/// or the executable (covers `tauri dev` and unpacked builds).
pub fn find_connector_entrypoint() -> Option<PathBuf> {
  if let Ok(path) = std::env::var(CONNECTOR_PATH_ENV) {
    let path = PathBuf::from(path);
    if path.is_file() {
      return Some(path);
    }
  }

  let starts = [
    std::env::current_dir().ok(),
    std::env::current_exe().ok().and_then(|exe| exe.parent().map(|p| p.to_path_buf())),
  ];

  starts
      .into_iter()
      .flatten()
      .flat_map(|start| start.ancestors().map(|p| p.to_path_buf()).collect::<Vec<_>>())
      .map(|dir| dir.join(CONNECTOR_ENTRYPOINT))
      .find(|candidate| candidate.is_file())
}
