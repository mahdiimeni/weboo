/**
 * Runtime message validation (hardening phase — small, no framework).
 *
 * The compile-time contracts live in src/types/messaging.ts; types vanish at
 * runtime while messages cross the extension boundary, so every RECEIVING
 * boundary parses through this module before acting on a payload. Senders
 * construct messages internally and are not validated (no untrusted sender
 * exists: the manifest declares no externally_connectable).
 *
 * Validation rules: the discriminator must be a known HL.MSG value, payloads
 * must carry exactly the fields the contract promises with sane primitive
 * types/lengths, and everything else is rejected (null) — never guessed.
 * Returns null for any malformed value; callers decide the transport answer
 * (silently ignore, or respond without acting).
 *
 * Emitted by `bun run build:ext` into extension/shared/message-guard.js —
 * never edit the .js. Loaded by the content bundle (before content.js) and
 * imported by the service worker.
 */
import { MSG } from "./constants.js";
/** Highlight-record ids are engine-generated (host + base64url segment);
 *  a sane inbound id is short, non-empty and has no control characters. */
function isValidId(id) {
    return typeof id === "string" && id.length > 0 && id.length <= 200 && !/[\u0000-\u001f]/.test(id);
}
export function parseMessage(value) {
    if (!value || typeof value !== "object")
        return null;
    var v = value;
    switch (v.type) {
        case MSG.COUNT_REPORT: {
            var count = v.count;
            return typeof count === "number" && isFinite(count) && count >= 0 && count <= 1e9
                ? { type: MSG.COUNT_REPORT, count: count }
                : null;
        }
        case MSG.GET_COUNT:
            return { type: MSG.GET_COUNT };
        case MSG.GOTO:
            return isValidId(v.id) ? { type: MSG.GOTO, id: v.id } : null;
        case MSG.HIGHLIGHT_SELECTION:
            return { type: MSG.HIGHLIGHT_SELECTION };
        default:
            return null; /* unknown discriminator — never guess */
    }
}
