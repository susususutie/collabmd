import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const repoRoot = process.cwd();
const clientRoot = resolve(repoRoot, 'src/client');
const localesRoot = resolve(clientRoot, 'i18n/locales');

const KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[A-Za-z0-9_]+)+$/u;

async function collectFiles(dirPath, pattern) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath, pattern));
      continue;
    }

    if (entry.isFile() && pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function toRepoPath(filePath) {
  return relative(repoRoot, filePath).replace(/\\/g, '/');
}

async function readCatalog(fileName) {
  return JSON.parse(await readFile(resolve(localesRoot, fileName), 'utf8'));
}

function flattenCatalog(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      flattenCatalog(value, fullKey, out);
    } else {
      out.set(fullKey, value);
    }
  }
  return out;
}

// English copy is never a key: only namespace.dot keys reach t() and data-i18n.
function collectUsedKeys(source) {
  const keys = [];
  for (const match of source.matchAll(/\bt\(\s*'([^']+)'/gu)) {
    keys.push(match[1]);
  }
  for (const match of source.matchAll(/\bt\(\s*`([^`]+)`/gu)) {
    keys.push(match[1]);
  }
  for (const match of source.matchAll(/data-i18n[a-z-]*="([^"]*)"/gu)) {
    keys.push(match[1]);
  }
  for (const match of source.matchAll(/\bparseApiResponse\([^,]+,\s*'([^']+)'/gu)) {
    keys.push(match[1]);
  }
  for (const match of source.matchAll(/\b(?:fallbackError|fallback)\s*[:=]\s*'([^']+)'/gu)) {
    keys.push(match[1]);
  }
  return keys;
}

test('client source only passes namespaced keys to the i18n runtime', async () => {
  const files = await collectFiles(clientRoot, /\.(?:js|html)$/u);
  const violations = [];

  for (const filePath of files) {
    if (filePath.endsWith('i18n/index.js')) {
      continue;
    }
    const source = await readFile(filePath, 'utf8');
    for (const key of collectUsedKeys(source)) {
      if (!KEY_PATTERN.test(key)) {
        violations.push(`${toRepoPath(filePath)}: ${key}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('every key used in the client exists in the English catalog', async () => {
  const catalog = flattenCatalog(await readCatalog('en.json'));
  const files = await collectFiles(clientRoot, /\.(?:js|html)$/u);
  const missing = new Set();

  for (const filePath of files) {
    if (filePath.endsWith('i18n/index.js')) {
      continue;
    }
    const source = await readFile(filePath, 'utf8');
    for (const key of collectUsedKeys(source)) {
      // Plural messages are stored as key_one / key_other and resolved from the base key.
      if (KEY_PATTERN.test(key) && !catalog.has(key) && !catalog.has(`${key}_other`)) {
        missing.add(`${toRepoPath(filePath)}: ${key}`);
      }
    }
  }

  assert.deepEqual([...missing], []);
});

test('locales cover the same keys and keep no prototype traps', async () => {
  const english = flattenCatalog(await readCatalog('en.json'));
  const chinese = flattenCatalog(await readCatalog('zh-CN.json'));

  assert.deepEqual([...english.keys()].filter((key) => !chinese.has(key)), []);
  assert.deepEqual([...chinese.keys()].filter((key) => !english.has(key)), []);
  assert.deepEqual(
    [...english].filter(([, value]) => typeof value !== 'string' || value === ''),
    [],
  );

  const reserved = new Set(['__proto__', 'constructor', 'prototype']);
  for (const fileName of ['en.json', 'zh-CN.json']) {
    const catalog = JSON.parse(await readFile(resolve(localesRoot, fileName), 'utf8'));
    const segments = [];
    const walk = (node, path) => {
      for (const [key, value] of Object.entries(node)) {
        segments.push(`${path}${key}`);
        if (value && typeof value === 'object') {
          walk(value, `${path}${key}.`);
        }
      }
    };
    walk(catalog, '');
    assert.deepEqual(segments.filter((segment) => reserved.has(segment.split('.').at(-1))), []);
  }
});
