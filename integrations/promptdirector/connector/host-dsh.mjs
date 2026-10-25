import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { parseDocument, isSeq, isMap } from 'yaml';

const plugin = '@deepseek-ai/dsh-mcp-client';
const entryId = 'promptdirector-mcp';

export function dshConfiguration({ home, env, profile }) {
  if (!profile || profile === '.' || profile === '..' || /[\\/\0]/.test(profile)) throw new Error('The current Agent must read the DSH profile in use and specify it with --profile; no configuration is chosen or created automatically.');
  const root = env.DSH_HOME || join(home, '.dsh');
  return { host: 'dsh', path: join(root, 'profiles', profile, 'cordis.patch.yml'), format: 'yaml',
    profileManifest: join(root, 'profiles', profile, 'package.json'), overlay: join(root, 'cordis.patch.yml') };
}

function document(text) {
  const doc = parseDocument(text || '[]\n', { strict: true });
  if (doc.contents === null) doc.contents = doc.createNode([]);
  if (doc.errors.length || !isSeq(doc.contents)) throw new Error('DSH patch The configuration cannot be parsed; the original file was not changed.');
  return doc;
}

// Only edit the user-owned insert row. Keep unrelated patches, tags and comments.
export async function editDshConfiguration(original, mcp, target) {
  const doc = document(original);
  const matches = [];
  function scan(node, path = [], found = matches) {
    if (isSeq(node)) node.items.forEach((item, index) => scan(item, [...path, index], found));
    else if (isMap(node)) {
      if (node.get('id') === entryId || node.getIn(['config', 'serverName']) === 'promptdirector') found.push({ node, path });
      for (const pair of node.items) scan(pair.value, [...path, pair.key.value], found);
    }
  }
  scan(doc.contents);
  const overlay = await readFile(target.overlay, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (overlay !== null) {
    const overrides = [];
    scan(document(overlay).contents, [], overrides);
    if (overrides.length) throw new Error('DSH The global overlay also contains PromptDirector. Check the effective configuration through DSH before connecting, to avoid duplicate connections.');
  }
  if (matches.length > 1) throw new Error('DSH contains several PromptDirector configurations. Check the effective connection first; the original file was not changed.');
  const match = matches[0];
  if (match && (match.path.length !== 3 || match.path[1] !== 'insert' || match.node.get('name') !== plugin || match.node.get('id') !== entryId)) {
    throw new Error('DSH A custom PromptDirector override configuration already exists. Check it through the host; the original file was not changed.');
  }
  const prior = match?.node.get('config')?.toJSON();
  if (match && (!prior || prior.serverName !== 'promptdirector' || prior.transport !== 'stdio' || prior.command !== mcp.command ||
    !isDeepStrictEqual(prior.args, mcp.args) || (prior.env?.PROMPTDIRECTOR_INSTANCE && prior.env.PROMPTDIRECTOR_INSTANCE !== mcp.env.PROMPTDIRECTOR_INSTANCE))) {
    throw new Error('A different PromptDirector connection already exists and was not overwritten. Confirm which library or existing installation to use.');
  }
  if (prior?.env !== undefined && (!prior.env || typeof prior.env !== 'object' || Array.isArray(prior.env))) throw new Error('DSH MCP The environment configuration is invalid; the original file was not changed.');
  const config = { ...prior, serverName: 'promptdirector', transport: 'stdio', ...mcp, env: { ...prior?.env, ...mcp.env } };
  const changed = !isDeepStrictEqual(prior, config);
  if (changed) {
    if (match) {
      for (const [key, value] of Object.entries(mcp.env)) doc.setIn([...match.path, 'config', 'env', key], value);
    } else doc.add({ insert: [{ id: entryId, name: plugin, config }] });
  }
  const content = changed ? doc.toString() : original;
  if (changed && !isDeepStrictEqual(document(content).toJS(), doc.toJS())) throw new Error('DSH Configuration serialization check failed; the original file was not changed.');
  return { content, changed, hostEnabled: match?.node.get('disabled') !== true };
}
