import { open, mkdir, rename, unlink, stat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { connectorRoot, ensurePrivateRoot } from './paths.mjs';
import { readablePath } from './sensitive-paths.mjs';
import { leaseCacheFile, maintainTransferCache, recordCacheFile, rememberVerifiedFile, verifyCachedFile } from './transfer-cache.mjs';

async function digest(handle) {
  const hash = createHash('sha256');
  for await (const data of handle.createReadStream({ autoClose: false, start: 0 })) hash.update(data);
  return hash.digest('hex');
}
export async function stageFiles(files, bodyFile, requestId, call, { purpose, limits } = {}) {
  if (bodyFile && !files.some(file => file.path === bodyFile)) throw new Error('The body file must also be listed among the attachments.');
  if (limits) {
    if (files.length > limits.maxFileCount) throw new Error('SkillThe number of package files exceeds the import limit of the plugin; upload was not started.');
    let totalBytes = 0;
    let textBytes = 0;
    const packagePaths = files.map(file => file.packagePath?.replace(/\\/g, '/') || '');
    const skillPath = purpose === 'skill-file' && packagePaths.find(path => path === 'SKILL.md' || path.endsWith('/SKILL.md'));
    const skillRoot = (skillPath || '').slice(0, -'SKILL.md'.length);
    for (const [index, file] of files.entries()) {
      if (!isAbsolute(file.path)) throw new Error('Attachments must use absolute paths.');
      const info = await stat(await readablePath(file.path));
      if (!info.isFile()) throw new Error('SkillAn attachment must be a regular file.');
      if (info.size > limits.maxFileBytes) throw new Error('SkillA single file exceeds the import limit of the plugin; upload was not started.');
      totalBytes += info.size;
      const relativePath = packagePaths[index].startsWith(skillRoot) ? packagePaths[index].slice(skillRoot.length) : '';
      if (purpose === 'skill-file' && (relativePath === 'SKILL.md' || /^references\/.+\.md$/iu.test(relativePath))) textBytes += info.size;
    }
    if (totalBytes > limits.maxArchiveBytes) throw new Error('SkillThe total package size exceeds the import limit of the plugin; upload was not started.');
    if (Number.isSafeInteger(limits.maxTextBytes) && textBytes > limits.maxTextBytes) throw Object.assign(new Error('SkillThe body and references exceed the parsing budget of this call of the plugin, so upload was not started; the complete files are kept. Organize them in batches and do not cut the original text.'), { code: 'RESOURCE_BUDGET_REACHED' });
  }
  const transferIds = []; const filePrompts = {}; let bodyTransferId;
  for (const [index, file] of files.entries()) {
    if (!isAbsolute(file.path)) throw new Error('Attachments must use absolute paths.');
    const path = await readablePath(file.path);
    const isCache = dirname(path) === await realpath(join(connectorRoot(), 'files')).catch(() => '');
    const release = isCache ? await leaseCacheFile(path) : null;
    if (isCache && !release) throw new Error('The temporary attachment is in use or being cleaned up. Retry.');
    let handle;
    try {
      handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      if (isCache) await recordCacheFile(path).catch(() => {});
      const stat = await handle.stat();
      if (!stat.isFile() || (!stat.size && purpose !== 'skill-file')) throw new Error('An attachment must be a regular file; a case attachment cannot be empty.');
      const sha256 = await digest(handle);
      const id = createHash('sha256').update(JSON.stringify([requestId, index, sha256, file.path, ...(purpose ? [purpose] : [])])).digest('hex');
      const receipt = await call('begin_transfer', { id, name: basename(file.path), mimeType: file.mimeType,
        byteSize: stat.size, sha256, forceImport: file.forceImport === true, ...(purpose ? { purpose } : {}) });
      if (receipt.state === 'uploading') {
        let offset = receipt.offset;
        const buffer = Buffer.alloc(receipt.chunkBytes);
        while (offset < stat.size) {
          const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, stat.size - offset), offset);
          if (!bytesRead) throw new Error('The attachment changed during reading. Retry.');
          const next = await call('append_transfer', { id, offset, data: buffer.subarray(0, bytesRead).toString('base64') });
          offset = next.offset;
        }
      }
      await call('finish_transfer', { id });
      transferIds.push(id); if (file.originalPrompt) filePrompts[id] = file.originalPrompt; if (bodyFile === file.path) bodyTransferId = id;
    } finally { await handle?.close(); await release?.(); }
  }
  return { transferIds, filePrompts, ...(bodyTransferId ? { bodyTransferId } : {}) };
}
export async function receiveMedia(input, call, root = connectorRoot()) {
  await ensurePrivateRoot(root);
  const directory = join(root, 'files'); await mkdir(directory, { recursive: true, mode: 0o700 });
  await maintainTransferCache(directory);
  // Always consult the current library before reusing a file: deletion, changed
  // membership or a new original must never be hidden by the local cache.
  const first = await call('read_media', { ...input, offset: 0 });
  if (first.offset !== 0 || !/^[a-f0-9]{64}$/u.test(first.sha256) || !Number.isSafeInteger(first.byteSize) || first.byteSize < 0) {
    throw new Error('Media chunks are inconsistent.');
  }
  const name = basename(String(first.name || input.assetId || 'media')).replace(/[^\p{L}\p{N}._-]/gu, '_').slice(-100) || 'media';
  let path = join(directory, `${first.sha256}-${name}`);
  let release = await leaseCacheFile(path);
  // A concurrent reader/cleaner owns the canonical copy. Deliver a separate
  // verified copy rather than wait on or replace that process's file.
  if (!release) {
    path = join(directory, `${first.sha256}-${randomUUID()}-${name}`);
    release = await leaseCacheFile(path);
  }
  try {
    const result = { path, mimeType: first.mimeType, byteSize: first.byteSize, sha256: first.sha256, caseId: input.caseId, assetId: input.assetId };
    let cached, occupied = false;
    try {
      cached = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      const stat = await cached.stat();
      if (stat.isFile() && stat.size === first.byteSize && await verifyCachedFile(path, cached, first.sha256, digest)) {
        await recordCacheFile(path).catch(() => {});
        return result;
      }
    } catch (error) {
      occupied = error.code === 'ELOOP';
      if (!['ENOENT', 'ELOOP'].includes(error.code)) throw error;
    } finally { await cached?.close(); }
    if (cached || occupied) {
      await release?.();
      path = join(directory, `${first.sha256}-${randomUUID()}-${name}`);
      release = await leaseCacheFile(path);
      result.path = path;
    }
    const temp = join(directory, `${randomUUID()}.partial`);
    const handle = await open(temp, 'wx', 0o600);
    let offset = 0;
    const hash = createHash('sha256');
    try {
      do {
        const part = offset === 0 ? first : await call('read_media', { ...input, offset, expectedHash: first.sha256 });
        const bytes = Buffer.from(part.data, 'base64');
        if (part.offset !== offset || part.sha256 !== first.sha256 || part.byteSize !== first.byteSize || (!bytes.length && offset < first.byteSize)) throw new Error('Media chunks are inconsistent.');
        await handle.writeFile(bytes); hash.update(bytes); offset += bytes.length;
        if (part.nextOffset === null) break;
        if (part.nextOffset !== offset) throw new Error('Media chunk position is wrong.');
      } while (offset < first.byteSize);
      if (offset !== first.byteSize || hash.digest('hex') !== first.sha256) throw new Error('Original integrity verification failed; no file was delivered.');
      await rename(temp, path);
      await rememberVerifiedFile(path, handle, first.sha256).catch(() => {});
      await handle.close();
      await recordCacheFile(path, { owned: true }).catch(() => {});
      return result;
    } catch (error) { await handle.close().catch(() => {}); await unlink(temp).catch(() => {}); throw error; }
  } finally { await release?.(); }
}

// A viewport capture is ephemeral, unlike a case original. Its opaque capture identity fixes
// all chunks to one browser frame; no original-media cache or repeated digest is involved.
export async function receiveWorkspaceScreenshot(input, call, root = connectorRoot()) {
  const first = await call('capture_workspace', input);
  if (first.state !== 'captured') return first;
  if (first.offset !== 0 || typeof first.screenshotId !== 'string' || !first.screenshotId
    || first.mimeType !== 'image/png' || !Number.isSafeInteger(first.byteSize) || first.byteSize <= 0) {
    throw new Error('The plugin screenshot reply is invalid.');
  }
  const parts = [];
  let offset = 0, part = first;
  while (true) {
    if (part.screenshotId !== first.screenshotId || part.offset !== offset || part.byteSize !== first.byteSize
      || part.tabId !== first.tabId || part.surface !== first.surface || part.capturedAt !== first.capturedAt
      || part.mimeType !== first.mimeType || typeof part.data !== 'string') throw new Error('The plugin screenshot chunks are inconsistent.');
    const bytes = Buffer.from(part.data, 'base64');
    if (!bytes.length || offset + bytes.length > first.byteSize) throw new Error('The plugin screenshot chunk length is invalid.');
    parts.push(bytes);
    offset += bytes.length;
    if (part.nextOffset === null) break;
    if (part.nextOffset !== offset) throw new Error('The plugin screenshot chunk position is invalid.');
    part = await call('capture_workspace', { screenshotId: first.screenshotId, offset });
  }
  if (offset !== first.byteSize) throw new Error('The plugin screenshot was not fully received.');
  const bytes = Buffer.concat(parts);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('The plugin screenshot is not a PNG image.');
  await ensurePrivateRoot(root);
  const directory = join(root, 'files');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await maintainTransferCache(directory);
  const path = join(directory, `workspace-${randomUUID()}.png`);
  const release = await leaseCacheFile(path);
  try {
    const handle = await open(path, 'wx', 0o600);
    try { await handle.writeFile(bytes); }
    catch (error) { await handle.close(); await unlink(path).catch(() => {}); throw error; }
    await handle.close();
    await recordCacheFile(path, { owned: true }).catch(() => {});
    const { data, nextOffset, offset: _offset, ...metadata } = first;
    return { ...metadata, path, image: { data: bytes.toString('base64'), mimeType: 'image/png' } };
  } finally { await release?.(); }
}
