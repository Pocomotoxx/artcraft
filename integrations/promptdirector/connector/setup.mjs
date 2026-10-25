import { homedir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { installationPlan, install } from './install.mjs';
import { HOSTS, hostConfiguration, configurationPlan, writeConfiguration } from './host-config.mjs';
import { discoverLibraries } from './discovery.mjs';
import { connectorRoot, instancePaths } from './paths.mjs';
import { isMain } from './is-main.mjs';
import { nodeCommand } from './node-command.mjs';
import { lstat } from 'node:fs/promises';

export function mcpConfiguration(root, instanceId) {
  if (instanceId) instancePaths(root, instanceId);
  return { command: nodeCommand(), args: [join(root, 'runtime/mcp.mjs')],
    env: { PROMPTDIRECTOR_CONNECTOR_HOME: root, ...(instanceId ? { PROMPTDIRECTOR_INSTANCE: instanceId } : {}) } };
}
export async function setupPlan({ host, root = connectorRoot(), instanceId, home = homedir(), env = process.env, profile, nativeDirectory, extensionId } = {}) {
  const installation = await installationPlan({ root, nativeDirectory, extensionId });
  const mcp = mcpConfiguration(installation.root, instanceId);
  const configuration = await configurationPlan(hostConfiguration(host, { home, env, profile }), mcp);
  return { installation, configuration, instanceId, mcp };
}
function value(result) {
  const text = result.content?.filter(item => item.type === 'text').map(item => item.text).join('');
  if (result.isError) throw new Error(text || 'MCP call failed');
  return JSON.parse(text);
}
export async function verifyConnection({ root = connectorRoot(), instanceId, probe = discoverLibraries, onProgress = stage => { if (process.env.PROMPTDIRECTOR_DEBUG) console.error(`[PromptDirector verify] ${stage}`); } } = {}) {
  onProgress('library-discovery');
  const libraries = await probe({ root, instanceId });
  if (!libraries.length) return { state: 'awaiting_browser', connected: false,
    diagnostics: await offlineDiagnostics(root, instanceId),
    next: 'Open Settings, Agent connection, Enable in the Chrome where PromptDirector is installed. If it is already enabled, disconnect and enable it again; when the browser asks for a reload, save unfinished edits first and then retry verify.' };
  if (libraries.length > 1) return { state: 'library_selection_required', connected: false, libraries,
    next: 'Copy the connection instruction from the target case library and use its instance parameter; do not guess which library the user wants to connect.' };
  const selected = libraries[0].instanceId;
  const mcp = mcpConfiguration(root, selected);
  const client = new Client({ name: 'promptdirector-setup-check', version: '1' });
  try {
    onProgress('mcp-start');
    await client.connect(new StdioClientTransport({ ...mcp, env: { ...mcp.env, ...(process.env.PROMPTDIRECTOR_DEBUG ? { PROMPTDIRECTOR_DEBUG: process.env.PROMPTDIRECTOR_DEBUG } : {}) } }));
    onProgress('mcp-tools');
    const listed = await client.listTools();
    const names = listed.tools.map(tool => tool.name);
    for (const required of ['promptdirector_status', 'promptdirector_search_cases', 'promptdirector_read_case', 'promptdirector_read_media']) {
      if (!names.includes(required)) throw new Error(`MCP missing required capability: ${required}`);
    }
    onProgress('library-status');
    const status = value(await client.callTool({ name: 'promptdirector_status', arguments: {} }));
    if (status.instanceId !== selected || !status.enabled || status.status !== 'connected') throw new Error('MCP The returned library does not match the target or is not connected yet.');
    onProgress('library-search');
    const result = value(await client.callTool({ name: 'promptdirector_search_cases', arguments: { query: '', limit: 3 } }));
    if (!Array.isArray(result.cases) || !Number.isInteger(result.total)) throw new Error('The case search returned no valid result.');
    return { state: 'connector_verified', connected: true, instanceId: selected, mcp,
      extensionVersion: status.extensionVersion, caseCount: result.total, sampleCases: result.cases,
      hostSessionVerified: false,
      next: 'The connector actually queried the case library. The current Agent session still has to discover the promptdirector tools and call status/search_cases; if a reload is needed use the normal entry of the host. Report a connection only after a call in the current session has actually succeeded; when cases need to be shown, read the originals by the returned media IDs.' };
  } finally { onProgress('mcp-close'); await client.close(); onProgress('mcp-closed'); }
}
async function offlineDiagnostics(root, instanceId) {
  const present = async path => {
    try { await lstat(path); return 'present'; }
    catch (error) { return error.code === 'ENOENT' ? 'missing' : 'unreadable'; }
  };
  const paths = instanceId ? instancePaths(root, instanceId) : null;
  return { runtime: await present(join(root, 'runtime/mcp.mjs')), launcher: await present(join(root, process.platform === 'win32' ? 'native-host.cmd' : 'native-host')),
    pairing: paths ? await present(paths.record) : 'unknown',
    endpoint: paths && process.platform !== 'win32' ? await present(paths.socket) : 'unknown',
    browserRunning: 'unknown', extensionInstalled: 'unknown', agentSwitchEnabled: 'unknown',
    note: 'Only the own files of the connector are checked; the existence of a file does not mean the handshake succeeded, and a missing endpoint cannot distinguish the browser, the extension or the switch state.' };
}
export async function connect(options, { installRuntime = install, verify = verifyConnection } = {}) {
  const plan = await setupPlan(options);
  if (plan.configuration.state === 'host_verification_required') return { state: plan.configuration.state, connected: false, configuration: await writeConfiguration(plan.configuration) };
  await installRuntime(plan.installation);
  const configured = plan.instanceId ? await writeConfiguration(plan.configuration)
    : { changed: false, state: 'awaiting_pairing' };
  const checked = await verify({ root: plan.installation.root, instanceId: plan.instanceId });
  // Bind a discovered single library explicitly so another Chrome profile cannot
  // later redirect this host through the global selected.json preference.
  let finalConfiguration = configured;
  if (!plan.instanceId && checked.connected) {
    finalConfiguration = await writeConfiguration(await configurationPlan(
      hostConfiguration(options.host, { home: options.home, env: options.env, profile: options.profile }), checked.mcp));
  }
  return { ...checked, configuration: finalConfiguration, mcp: checked.mcp || (plan.instanceId ? plan.mcp : undefined),
    skill: join(plan.installation.runtime, 'SKILL.md') };
}
function optionsFrom(args) {
  const options = {};
  const keys = { '--host': 'host', '--instance': 'instanceId', '--root': 'root', '--profile': 'profile' };
  for (let index = 0; index < args.length; index += 2) {
    const key = keys[args[index]];
    if (!key || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Usage: node connector/setup.mjs plan|connect|verify --host ${HOSTS.join('|')} [--instance number] [--root private-directory] [--profile DSH-profile-name]`);
    options[key] = args[index + 1];
  }
  return options;
}
if (isMain(import.meta.url)) {
  try {
    const [command = 'plan', ...args] = process.argv.slice(2);
    const options = optionsFrom(args);
    let result;
    if (command === 'plan') {
      const plan = await setupPlan(options);
      result = { installation: plan.installation, configuration: { path: plan.configuration.path, changed: plan.configuration.changed, host: plan.configuration.host, state: plan.configuration.state, hostEnabled: plan.configuration.hostEnabled, next: plan.configuration.next, importConfig: plan.configuration.importConfig }, mcp: plan.instanceId && plan.configuration.state !== 'host_verification_required' ? plan.mcp : undefined };
    } else if (command === 'connect') result = await connect(options);
    else if (command === 'verify') result = await verifyConnection(options);
    else throw new Error('Unknown command. Use plan, connect or verify.');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    // Configuration files can contain credentials. Never echo their contents.
    console.error(JSON.stringify({ state: 'failed', connected: false, message: error.message })); process.exitCode = 1;
  }
}
