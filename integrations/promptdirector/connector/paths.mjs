import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { mkdir, lstat, readFile } from "node:fs/promises";

import { privateWindowsDirectory } from "./windows.mjs";

export function connectorRoot() {
  return process.env.PROMPTDIRECTOR_CONNECTOR_HOME || join(homedir(), ".promptdirector");
}
export function instancePaths(root, instance, platform = process.platform) {
  if (!/^[a-f0-9-]{36}$/u.test(instance || "")) throw new Error("Pair the instance ID shown by the plugin in the connector.");
  const name = createHash("sha256").update(instance).digest("hex").slice(0, 24);
  const socket = platform === "win32"
    ? `\\\\.\\pipe\\promptdirector-${createHash("sha256").update(resolve(root).toLowerCase()).digest("hex").slice(0, 24)}-${name}`
    : join(root, `${name}.sock`);
  // macOS sockaddr_un.sun_path capacity, including terminating NUL.
  if (platform !== "win32" && Buffer.byteLength(socket) > 103) throw new Error("The connection directory path is too long. Choose a shorter private directory of the user.");
  return { socket, record: join(root, `${instance}.json`) };
}
// ACL hardening spawns PowerShell; once verified for a root it holds for the process.
const protectedWindowsRoots = new Map();
export async function ensurePrivateRoot(root) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const info = await lstat(root);
  if (process.platform === "win32") {
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("The connection directory must be a private directory of the current user.");
    const key = resolve(root).toLowerCase();
    if (!protectedWindowsRoots.has(key)) protectedWindowsRoots.set(key, privateWindowsDirectory(root).catch(error => { protectedWindowsRoots.delete(key); throw error; }));
    await protectedWindowsRoots.get(key);
    return;
  }
  if (!info.isDirectory() || info.uid !== process.getuid() || (info.mode & 0o077)) {
    throw new Error("The connection directory must be owned by the current user and accessible only to the current user.");
  }
}
export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
