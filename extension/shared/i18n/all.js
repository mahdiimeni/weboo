/**
 * Weboo — the full dictionary registration (pages + service worker).
 *
 * Audit R1 — payload diet: the content bundle ships ONLY the canonical
 * dictionary (i18n/en, imported by i18n.js itself); every other language
 * registers here at module-eval. The pages and the SW import this right
 * after shared/i18n.js — their bundles are not injected into web pages, so
 * carrying all twelve costs nothing at runtime and keeps them on the
 * zero-async path (the lower-risk option). The content script instead wires
 * setDictionaryLoader (content.js) and fetches dictionaries from the SW
 * through the hlx:i18n-dict message.
 */
import { registerDictionary } from "../i18n.js";
import { fa } from "./fa.js";
import { de } from "./de.js";
import { es } from "./es.js";
import { ru } from "./ru.js";
import { it } from "./it.js";
import { fr } from "./fr.js";
import { tr } from "./tr.js";
import { zh } from "./zh.js";
import { ja } from "./ja.js";
import { ko } from "./ko.js";
import { ar } from "./ar.js";
registerDictionary('fa', fa);
registerDictionary('de', de);
registerDictionary('es', es);
registerDictionary('ru', ru);
registerDictionary('it', it);
registerDictionary('fr', fr);
registerDictionary('tr', tr);
registerDictionary('zh', zh);
registerDictionary('ja', ja);
registerDictionary('ko', ko);
registerDictionary('ar', ar);
