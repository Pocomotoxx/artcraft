import net from "node:net";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { connectorRoot, instancePaths, readJson, ensurePrivateRoot } from "./paths.mjs";
import { encodeFrame, frameDecoder } from "./framing.mjs";
import { CONNECTOR_TIMEOUT_MS, requestTimeoutMs, timeoutMessage } from './request-policy.mjs';

export { CONNECTOR_TIMEOUT_MS } from './request-policy.mjs';

export async function callExtension(operation, input = {}, { root = connectorRoot(), timeoutMs, instanceId, expectedHostSession, onHostSession } = {}) {
  const id = randomUUID();
  const request = encodeFrame({ type: 'request', id, operation, input });
  await ensurePrivateRoot(root);
  let instance;
  try { instance = instanceId || process.env.PROMPTDIRECTOR_INSTANCE || (await readJson(join(root, "selected.json"))).instanceId; }
  catch { throw new Error("The library is not paired yet. Enable the Agent connection in the plugin and then run connector pairing."); }
  const paths = instancePaths(root, instance);
  let record;
  try { record = await readJson(paths.record); }
  catch (error) {
    if (error.code === 'ENOENT') throw Object.assign(new Error('No pairing record was found for this library. Enable the Agent connection in the plugin and run connector pairing again.'), { code: 'ENOENT' });
    throw Object.assign(new Error('The library pairing record cannot be read. Check the local connector record.'), { code: 'invalid_pairing_record' });
  }
  return new Promise((resolve, reject) => {
    const socket = net.connect(paths.socket);
    let settled = false;
    const finish = (error, value) => {
      if (settled) return; settled = true; clearTimeout(timer); socket.destroy();
      if (error) reject(error); else resolve(value);
    };
    const timedOut = () => finish(Object.assign(new Error(timeoutMessage(operation, input)), { code: 'connector_timeout' }));
    let timer = setTimeout(timedOut, timeoutMs ?? CONNECTOR_TIMEOUT_MS);
    const decode = frameDecoder(message => {
      if (message.type === "ready") {
        if (message.instanceId !== instance || message.protocolVersion !== 1) return finish(new Error("The connected library or protocol does not match."));
        // The request is not sent, so the caller can re-check capabilities against the reloaded extension.
        if (expectedHostSession && message.hostSessionId !== expectedHostSession) {
          return finish(Object.assign(new Error("The plugin was reloaded and its capabilities must be checked again."), { code: "connector_session_changed" }));
        }
        onHostSession?.(message.hostSessionId);
        clearTimeout(timer);
        timer = setTimeout(timedOut, timeoutMs ?? requestTimeoutMs(operation, input));
        socket.write(request);
      } else if (message.id === id) {
        finish(message.error ? Object.assign(new Error(message.error.message), { code: message.error.code }) : null, message.result);
      }
    });
    socket.once("connect", () => socket.write(encodeFrame({ type: "authenticate", secret: record.secret })));
    socket.on("data", data => { try { decode(data); } catch (error) { finish(error); } });
    socket.on("error", error => {
      const denied = ["EPERM", "EACCES"].includes(error.code);
      finish(Object.assign(new Error(denied
        ? "The current runtime has no permission to access the local connection. Check the local access permission of the Agent; this does not mean the plugin is offline."
        : "Not connected to the specified library. Confirm that Chrome is running and the Agent connection of the plugin is enabled."),
      { code: denied ? "connector_access_denied" : "connector_offline" }));
    });
    socket.on("close", () => finish(Object.assign(new Error("The plugin connection was dropped; after reconnecting, query the write result with the original request ID."), { code: "connector_offline" })));
  });
}
