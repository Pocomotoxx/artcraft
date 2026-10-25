import { readdir } from 'node:fs/promises';
import { callExtension } from './bridge-client.mjs';
import { connectorRoot } from './paths.mjs';

export async function discoverLibraries({ root = connectorRoot(), instanceId, call = callExtension } = {}) {
  const names = instanceId ? [`${instanceId}.json`] : await readdir(root).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
  const ids = names.filter(name => /^[a-f0-9-]{36}\.json$/u.test(name)).map(name => name.slice(0, -5));
  if (instanceId && ids.length !== 1) throw new Error('Invalid library ID.');
  const candidates = await Promise.all(ids.map(async id => {
    try {
      const status = await call('status', {}, { root, instanceId: id });
      if (status.instanceId !== id || status.protocolVersion !== 1) throw new Error('The identity or protocol of the connected library does not match. Check the versions of the plugin and the connector.');
      if (!status.enabled) return null;
      return { instanceId: id, extensionVersion: status.extensionVersion, status: status.status };
    } catch (error) {
      if (['ENOENT', 'connector_offline'].includes(error.code)) return null;
      throw error;
    }
  }));
  return candidates.filter(Boolean);
}
