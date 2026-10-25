//! Bridge to the embedded PromptDirector prompt library (`integrations/promptdirector`).
//! ArtCraft talks to PromptDirector's local MCP connector over stdio; the library itself
//! lives in the user's Chrome profile, so Chrome and the PromptDirector extension must be running.

pub mod client;
pub mod commands;
