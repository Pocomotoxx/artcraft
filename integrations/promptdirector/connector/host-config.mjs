import { readFile, writeFile, mkdir, rename, unlink, open, lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { parse, stringify } from 'smol-toml';
import { parse as parseJsonc, modify, applyEdits } from 'jsonc-parser';
import { dshConfiguration, editDshConfiguration } from './host-dsh.mjs';

export const HOSTS = ['codex', 'claude', 'workbuddy', 'opencode', 'zcode', 'qoder', 'dsh', 'qwenwork', 'doubao-work', 'generic'];

// Paths and formats follow the host documentation linked in INSTALL.md.
export function hostConfiguration(host, { home = homedir(), env = process.env, profile } = {}) {
  switch (host) {
    case 'codex': return { host, path: join(env.CODEX_HOME || join(home, '.codex'), 'config.toml'), format: 'toml', key: 'mcp_servers' };
    case 'claude': return { host, path: env.CLAUDE_CONFIG_DIR ? join(env.CLAUDE_CONFIG_DIR, '.claude.json') : join(home, '.claude.json'), format: 'json', key: 'mcpServers' };
    case 'workbuddy': return { host, path: join(home, '.workbuddy/mcp.json'), format: 'json', key: 'mcpServers' };
    case 'opencode': return { host, path: env.OPENCODE_CONFIG || join(env.OPENCODE_CONFIG_DIR || join(env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode'), 'opencode.json'), format: 'jsonc', key: 'mcp', alternate: !env.OPENCODE_CONFIG };
    case 'zcode': return { host, path: join(home, '.zcode/cli/config.json'), format: 'json', key: ['mcp', 'servers'], fallback: join(home, '.agents/mcp.json') };
    case 'qoder': return { host, path: join(home, '.qoder/settings.json'), format: 'json', key: 'mcpServers' };
    case 'dsh': return dshConfiguration({ home, env, profile });
    case 'qwenwork': return { host, next: 'In the Qwen office desktop app, go to Extensions, Connectors, Add, Paste JSON configuration, import importConfig, then start a new conversation to verify; if this version has no local STDIO entry, stop and check the version.' };
    case 'doubao-work': return { host, state: 'host_verification_required', next: 'The custom connector of Doubao Work is known to support network services, but its local STDIO entry has not been verified. First confirm the local command entry in the current desktop version, and use the generic import once it is confirmed; with only a URL entry the local connector cannot be connected directly.' };
    case 'generic': return { host };
    default: throw new Error(`The current Agent must specify one of ${HOSTS.join(', ')}; cloud sessions cannot install the local connector directly.`);
  }
}
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function decode(text, format) {
  const errors = [];
  const value = format === 'toml' ? parse(text, { integersAsBigInt: true }) : format === 'jsonc' ? parseJsonc(text, errors, { allowTrailingComma: true }) : JSON.parse(text);
  if (errors.length) throw new Error('Configuration cannot be parsed');
  if (!object(value)) throw new Error('Agent The configuration must be an object; the original file was not changed.');
  return value;
}
export async function configurationPlan(target, mcp) {
  if (!target.path) return { ...target, changed: false, state: target.state || 'manual_registration_required',
    ...(target.state ? {} : { mcp, ...(mcp.env.PROMPTDIRECTOR_INSTANCE ? { importConfig: { mcpServers: { promptdirector: { type: 'stdio', ...mcp } } } } : {}) }) };
  if (target.alternate) {
    const alternate = target.path.replace(/\.json$/, '.jsonc');
    const exists = async path => lstat(path).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
    if (await exists(alternate)) {
      if (await exists(target.path)) throw new Error('Both OpenCode JSON and JSONC configurations exist. Specify the effective file with OPENCODE_CONFIG; the original file was not changed.');
      target = { ...target, path: alternate };
    }
  }
  if (target.profileManifest) await lstat(target.profileManifest).catch(() => { throw new Error('The specified DSH profile was not found. Create it in DSH first or check the profile in use.'); });
  let original = null; let mode = 0o600;
  try {
    const info = await lstat(target.path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('The configuration path is not a regular file. Confirm the actual configuration location first.');
    mode = info.mode & 0o777;
    original = await readFile(target.path, 'utf8');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (target.format === 'yaml') return { ...target, original, mode, mcp, state: 'configured', ...await editDshConfiguration(original, mcp, target) };
  let config;
  try { config = original === null ? {} : decode(original, target.format); }
  catch { throw new Error('The existing Agent configuration cannot be parsed and the original file was kept. Fix the configuration first and then retry the connection.'); }
  const keys = Array.isArray(target.key) ? target.key : [target.key];
  let parent = config;
  for (const key of keys.slice(0, -1)) {
    if (parent[key] === undefined) parent[key] = {};
    if (!object(parent[key])) throw new Error('The structure of the existing MCP configuration is invalid; the original file was not changed.');
    parent = parent[key];
  }
  const key = keys.at(-1);
  const servers = parent[key] ?? {};
  if (!object(servers)) throw new Error('The structure of the existing MCP configuration is invalid; the original file was not changed.');
  if (target.fallback && !Object.keys(servers).length) {
    const fallback = await readFile(target.fallback, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (fallback !== null) {
      let entries;
      try { entries = decode(fallback, 'json').mcpServers; } catch { throw new Error('ZCode The shared configuration cannot be parsed; the original file was not changed.'); }
      if (entries && Object.keys(entries).length) throw new Error('ZCode The shared .agents configuration is in use. Import these services through ZCode first, so that adding a native configuration does not invalidate the existing services.');
    }
  }
  const prior = servers.promptdirector;
  const localArray = target.host === 'opencode';
  if (localArray && object(servers.servers) && !servers.servers.type) throw new Error('A different OpenCode configuration structure version was detected. Import the generic configuration through the official entry of that version; the original file was not changed.');
  const desired = localArray ? { type: 'local', command: [mcp.command, ...mcp.args], environment: mcp.env } : mcp;
  const envKey = localArray ? 'environment' : 'env';
  if (prior !== undefined) {
    if (!object(prior) || !isDeepStrictEqual(prior.command, desired.command) || (!localArray && !isDeepStrictEqual(prior.args, mcp.args)) || prior.url ||
      (prior.type && prior.type !== (localArray ? 'local' : 'stdio')) ||
      (prior[envKey]?.PROMPTDIRECTOR_INSTANCE && prior[envKey].PROMPTDIRECTOR_INSTANCE !== mcp.env.PROMPTDIRECTOR_INSTANCE)) {
      throw new Error('A different PromptDirector connection already exists and was not overwritten. Confirm which library or existing installation to use.');
    }
  }
  if (prior?.[envKey] !== undefined && !object(prior[envKey])) throw new Error('The existing MCP environment configuration is invalid; the original file was not changed.');
  const entry = { ...prior, ...desired, [envKey]: { ...prior?.[envKey], ...mcp.env } };
  if (target.format === 'json' && target.host !== 'zcode') entry.type = 'stdio';
  const changed = !isDeepStrictEqual(prior, entry);
  parent[key] = { ...servers, promptdirector: entry };
  const content = !changed ? original : target.format === 'toml' ? stringify(config, { numbersAsFloat: true }) :
    target.format === 'jsonc' ? applyEdits(original || '{}\n', modify(original || '{}\n', [...keys, 'promptdirector'], entry, { formattingOptions: { insertSpaces: true, tabSize: 2 } })) : JSON.stringify(config, null, 2) + '\n';
  // Parse the serialized document before writing; preserve all unrelated values.
  if (changed && !isDeepStrictEqual(decode(content, target.format), config)) throw new Error('Configuration serialization check failed; the original file was not changed.');
  return { ...target, original, content, changed, mode, mcp, state: 'configured', hostEnabled: entry.enabled !== false && entry.enable !== false && entry.disabled !== true };
}
export async function writeConfiguration(plan) {
  if (!plan.changed) return { path: plan.path, changed: false, state: plan.state, hostEnabled: plan.hostEnabled, ...(plan.next ? { next: plan.next } : {}), ...(plan.importConfig ? { importConfig: plan.importConfig } : {}) };
  await mkdir(dirname(plan.path), { recursive: true });
  const lockPath = `${plan.path}.promptdirector-lock`;
  const lock = await open(lockPath, 'wx', 0o600).catch(() => { throw new Error('The configuration is in use by another installation task; the original configuration was not changed. Retry later.'); });
  const temp = `${plan.path}.${randomUUID()}.tmp`;
  let backup;
  try {
    let current = null;
    try { current = await readFile(plan.path, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (current !== plan.original) throw new Error('The Agent configuration changed after the check, so writing was stopped. Run it again.');
    if (current !== null) {
      backup = `${plan.path}.promptdirector-backup-${randomUUID()}`;
      await writeFile(backup, current, { mode: 0o600, flag: 'wx' });
    }
    await writeFile(temp, plan.content, { mode: plan.mode, flag: 'wx' });
    await rename(temp, plan.path);
    return { path: resolve(plan.path), backup, changed: true, state: 'configured', hostEnabled: plan.hostEnabled };
  } finally {
    await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; });
    await lock.close(); await unlink(lockPath);
  }
}
