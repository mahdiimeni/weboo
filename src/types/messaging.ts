/**
 * Typed runtime-message contracts (modernization Phase 1).
 *
 * Wire values come from HL.MSG (extension/shared/constants.js); payload and
 * response shapes are taken from the actual send/handle sites:
 *  - COUNT_REPORT         content.js:82   → { count }
 *  - GET_COUNT            service-worker  → response { count }   (content.js:200)
 *  - GOTO                 popup.js:191    → { id }, response { ok: true } (content.js:203)
 *  - HIGHLIGHT_SELECTION  service-worker  → response { ok: boolean } (content.js:198)
 *
 * The parity test (tests/unit/types-contract.test.ts) asserts the string
 * values here match runtime HL.MSG — never rename one side alone.
 */

/** Payload per message type; `null` = payload-free message. */
export interface MessagePayloads {
  'hlx:count-report': { count: number };
  'hlx:get-count': null;
  'hlx:goto': { id: string };
  'hlx:highlight-selection': null;
}

export type ExtensionMessageType = keyof MessagePayloads;

/** Discriminated union of every legal outbound message. */
export type ExtensionMessage = {
  [K in ExtensionMessageType]: { type: K } & (MessagePayloads[K] extends null ? Record<never, never> : MessagePayloads[K]);
}[ExtensionMessageType];

/** Response type per message type (sendResponse), `undefined` = no response used. */
export type MessageResponse<T extends ExtensionMessageType> =
  T extends 'hlx:get-count' ? { count: number } :
  T extends 'hlx:goto' ? { ok: true } :
  T extends 'hlx:highlight-selection' ? { ok: boolean } :
  T extends 'hlx:count-report' ? undefined :
  never;

/** Exhaustiveness helper: every message type must appear in MessagePayloads. */
export const EXTENSION_MESSAGE_TYPES = [
  'hlx:count-report',
  'hlx:get-count',
  'hlx:goto',
  'hlx:highlight-selection',
] as const satisfies readonly ExtensionMessageType[];
