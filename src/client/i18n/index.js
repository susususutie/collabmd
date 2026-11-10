import en from './locales/en.json' with { type: 'json' };
import zhCN from './locales/zh-CN.json' with { type: 'json' };

const DEFAULT_LOCALE = 'en';
const LOCALE_STORAGE_KEY = 'collabmd-locale';
const ATTRIBUTE_KEYS = [
  ['alt', 'i18nAlt'],
  ['aria-label', 'i18nAriaLabel'],
  ['content', 'i18nContent'],
  ['placeholder', 'i18nPlaceholder'],
  ['title', 'i18nTitle'],
];
const NAMESPACE_PATTERN = /^[a-z][a-z0-9]*$/;
const KEY_SEGMENT_PATTERN = /^[A-Za-z0-9_]+$/;
const RESERVED_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

const BASE_CATALOGS = Object.freeze({
  en: flattenCatalog(en),
  'zh-CN': flattenCatalog(zhCN),
});
// Server copy reaches the client as English text, so it is matched back to a key by exact text.
const SERVER_MESSAGE_KEYS = buildServerMessageKeys(BASE_CATALOGS.en);
const localeOverrides = new Map();
const catalogCache = new Map();

let activeLocale = null;

function flattenCatalog(node, prefix = '', target = new Map()) {
  for (const [segment, value] of Object.entries(node)) {
    if (RESERVED_SEGMENTS.has(segment)) {
      continue;
    }
    const key = prefix ? `${prefix}.${segment}` : segment;
    if (value && typeof value === 'object') {
      flattenCatalog(value, key, target);
    } else {
      target.set(key, value);
    }
  }
  return target;
}

function buildServerMessageKeys(catalog) {
  const keys = new Map();
  for (const [key, message] of catalog) {
    if (typeof message === 'string' && message !== '' && !keys.has(message)) {
      keys.set(message, key);
    }
  }
  return keys;
}

function getCatalog(locale) {
  const cached = catalogCache.get(locale);
  if (cached) {
    return cached;
  }

  const merged = new Map(BASE_CATALOGS[locale] ?? BASE_CATALOGS[DEFAULT_LOCALE]);
  for (const [key, message] of localeOverrides.get(locale) ?? []) {
    merged.set(key, message);
  }
  catalogCache.set(locale, merged);
  return merged;
}

function getNavigatorLanguages() {
  const navigatorRef = globalThis.navigator;
  // Detect the browser locale only in a real browser window; tests and tooling stub globals.
  if (!navigatorRef || globalThis.window !== globalThis) {
    return [];
  }

  if (Array.isArray(navigatorRef.languages) && navigatorRef.languages.length > 0) {
    return navigatorRef.languages;
  }

  return navigatorRef.language ? [navigatorRef.language] : [];
}

function readStoredLocale() {
  try {
    return globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function persistLocale(locale) {
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

function readUrlLocale() {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('lang');
  } catch {
    return null;
  }
}

export function normalizeLocale(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'zh' || normalized.startsWith('zh-')) {
    return 'zh-CN';
  }

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }

  return null;
}

export function resolveLocale() {
  const candidates = [readUrlLocale(), readStoredLocale(), ...getNavigatorLanguages()];
  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return DEFAULT_LOCALE;
}

export function applyDocumentLocale(documentRef = globalThis.document) {
  if (!documentRef?.documentElement) {
    return;
  }

  documentRef.documentElement.lang = getLocale();
  documentRef.documentElement.dir = 'ltr';
  // CSS pseudo-elements cannot read the catalog directly.
  documentRef.documentElement.style.setProperty('--diagram-loading-label', `'${t('diagram.loadingExcalidraw')}'`);
}

export function initializeI18n({ locale = null } = {}) {
  const requestedLocale = normalizeLocale(locale);
  if (requestedLocale) {
    activeLocale = requestedLocale;
    persistLocale(requestedLocale);
  } else {
    const urlLocale = normalizeLocale(readUrlLocale());
    if (urlLocale) {
      activeLocale = urlLocale;
      persistLocale(urlLocale);
    } else {
      activeLocale = normalizeLocale(readStoredLocale()) ?? resolveLocale();
    }
  }

  applyDocumentLocale();
  return activeLocale;
}

export function getLocale() {
  if (!activeLocale) {
    initializeI18n();
  }

  return activeLocale;
}

export function setLocalePreference(locale) {
  const normalized = normalizeLocale(locale);
  if (!normalized) {
    return false;
  }

  persistLocale(normalized);
  activeLocale = normalized;
  applyDocumentLocale();
  return true;
}

/**
 * Replaces whole namespaces of copy for one locale, e.g. white-label text.
 * Pass null to drop every override for that locale.
 */
export function applyLocaleOverrides(locale, namespaces) {
  const target = normalizeLocale(locale);
  if (!target) {
    return 0;
  }

  if (namespaces == null) {
    localeOverrides.delete(target);
    catalogCache.delete(target);
    return 0;
  }

  if (typeof namespaces !== 'object' || Array.isArray(namespaces)) {
    throw new TypeError('applyLocaleOverrides expects an object keyed by namespace');
  }

  const entries = new Map();
  for (const [namespace, messages] of Object.entries(namespaces)) {
    if (!NAMESPACE_PATTERN.test(namespace)) {
      throw new Error(`Invalid i18n namespace: ${namespace}`);
    }
    if (messages == null) {
      continue;
    }
    if (typeof messages !== 'object' || Array.isArray(messages)) {
      throw new Error(`Invalid i18n namespace payload: ${namespace}`);
    }

    for (const [key, message] of Object.entries(messages)) {
      const fullKey = `${namespace}.${key}`;
      if (!fullKey.split('.').every((segment) => KEY_SEGMENT_PATTERN.test(segment) && !RESERVED_SEGMENTS.has(segment))) {
        throw new Error(`Invalid i18n key: ${fullKey}`);
      }
      if (typeof message !== 'string' || message === '') {
        throw new Error(`Invalid i18n message for ${fullKey}`);
      }
      entries.set(fullKey, message);
    }
  }

  localeOverrides.set(target, entries);
  catalogCache.delete(target);
  return entries.size;
}

function interpolate(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (match, name) => (
    params && Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match
  ));
}

function lookup(catalog, key) {
  return catalog.has(key) ? catalog.get(key) : undefined;
}

function resolveMessage(key, params, locale) {
  const count = Number(params?.count);
  if (Number.isFinite(count)) {
    const category = new Intl.PluralRules(locale).select(count);
    const plural = lookup(getCatalog(locale), `${key}_${category}`)
      ?? lookup(getCatalog(DEFAULT_LOCALE), `${key}_${category}`)
      ?? lookup(getCatalog(locale), `${key}_other`)
      ?? lookup(getCatalog(DEFAULT_LOCALE), `${key}_other`);
    if (plural !== undefined) {
      return plural;
    }
  }

  return lookup(getCatalog(locale), key)
    ?? lookup(getCatalog(DEFAULT_LOCALE), key)
    ?? key;
}

export function t(key, params) {
  if (typeof key !== 'string' || key === '') {
    return '';
  }

  return interpolate(resolveMessage(key, params, getLocale()), params);
}

/**
 * Translates copy the server sent as English text; unknown text stays as it is,
 * so raw error details and Git output are never rewritten.
 */
export function translateServerMessage(message) {
  if (typeof message !== 'string' || message === '') {
    return '';
  }

  const key = SERVER_MESSAGE_KEYS.get(message);
  return key ? t(key) : message;
}

function localizeElement(element) {
  const textKey = element.getAttribute('data-i18n');
  if (textKey) {
    element.textContent = t(textKey);
  }

  for (const [attribute, datasetKey] of ATTRIBUTE_KEYS) {
    const key = element.dataset[datasetKey];
    if (key) {
      element.setAttribute(attribute, t(key));
    }
  }
}

export function localizeDocument(root = globalThis.document) {
  if (!root?.querySelectorAll) {
    return;
  }

  if (root.matches?.('[data-i18n], [data-i18n-alt], [data-i18n-aria-label], [data-i18n-content], [data-i18n-placeholder], [data-i18n-title]')) {
    localizeElement(root);
  }

  root.querySelectorAll(
    '[data-i18n], [data-i18n-alt], [data-i18n-aria-label], [data-i18n-content], [data-i18n-placeholder], [data-i18n-title]',
  ).forEach(localizeElement);
}

export function getLocaleDisplayName(locale = getLocale()) {
  return locale === 'zh-CN' ? '中文' : 'English';
}
