import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyLocaleOverrides,
  getLocale,
  getLocaleDisplayName,
  initializeI18n,
  normalizeLocale,
  setLocalePreference,
  t,
  translateServerMessage,
} from '../../src/client/i18n/index.js';

test('normalizeLocale maps supported tags and rejects unknown ones', () => {
  assert.equal(normalizeLocale('zh'), 'zh-CN');
  assert.equal(normalizeLocale('zh-Hans-CN'), 'zh-CN');
  assert.equal(normalizeLocale('en-GB'), 'en');
  assert.equal(normalizeLocale(' fr '), null);
  assert.equal(normalizeLocale(''), null);
  assert.equal(normalizeLocale(undefined), null);
});

test('t resolves namespaced keys in English and interpolates placeholders', () => {
  initializeI18n({ locale: 'en' });

  assert.equal(t('common.save'), 'Save');
  assert.equal(t('missing.key'), 'missing.key');
  assert.equal(
    t('search.showingTheFirstLimitOfTotalFiles', { limit: 30, total: 120 }),
    'Showing the first 30 of 120 files.',
  );
});

test('t resolves the same keys in the active locale', () => {
  initializeI18n({ locale: 'zh-CN' });
  assert.equal(getLocale(), 'zh-CN');
  assert.equal(t('common.save'), '保存');
  assert.equal(t('file.filePathIsRequired'), '文件路径不能为空');
  assert.equal(
    t('search.showingTheFirstLimitOfTotalFiles', { limit: 30, total: 120 }),
    '显示 120 个文件中的前 30 个。',
  );
  assert.equal(getLocaleDisplayName(), '中文');
});

test('t selects plural forms from the count', () => {
  initializeI18n({ locale: 'en' });
  assert.equal(t('git.file', { count: 1 }), '1 file');
  assert.equal(t('git.file', { count: 5 }), '5 files');

  initializeI18n({ locale: 'zh-CN' });
  assert.equal(t('git.file', { count: 1 }), '1 个文件');
  assert.equal(t('git.file', { count: 5 }), '5 个文件');
});

test('t falls back to English copy when the active locale has no entry', () => {
  initializeI18n({ locale: 'zh-CN' });
  applyLocaleOverrides('en', { test: { onlyEnglish: 'English only' } });
  try {
    assert.equal(t('test.onlyEnglish'), 'English only');
  } finally {
    applyLocaleOverrides('en', null);
  }
  assert.equal(t('test.onlyEnglish'), 'test.onlyEnglish');
});

test('translateServerMessage translates known copy and keeps raw details', () => {
  initializeI18n({ locale: 'zh-CN' });
  assert.equal(translateServerMessage('Host password'), '主机密码');
  assert.equal(translateServerMessage('Changes'), '更改');

  const raw = 'fatal: not a git repository (or any of the parent directories)';
  assert.equal(translateServerMessage(raw), raw);
  assert.equal(translateServerMessage(undefined), '');
});

test('applyLocaleOverrides replaces namespaces and can be cleared', () => {
  initializeI18n({ locale: 'zh-CN' });
  assert.equal(t('git.changes'), '更改');

  assert.equal(
    applyLocaleOverrides('zh-CN', { git: { changes: '工作区变更' }, common: { save: '保存更改' } }),
    2,
  );
  assert.equal(t('git.changes'), '工作区变更');
  assert.equal(t('common.save'), '保存更改');
  // The reverse index keeps mapping "Changes" to the same key, so overrides apply there too.
  assert.equal(translateServerMessage('Changes'), '工作区变更');

  assert.equal(applyLocaleOverrides('zh-CN', null), 0);
  assert.equal(t('git.changes'), '更改');
  assert.equal(t('common.save'), '保存');
});

test('applyLocaleOverrides rejects unsupported locales and malformed input', () => {
  initializeI18n({ locale: 'en' });
  assert.equal(applyLocaleOverrides('klingon', { git: { changes: 'x' } }), 0);
  assert.throws(() => applyLocaleOverrides('en', { 'bad-ns': { a: 'b' } }), /namespace/u);
  assert.throws(() => applyLocaleOverrides('en', { git: { 'a.__proto__': 'x' } }), /key/u);
  assert.throws(() => applyLocaleOverrides('en', { git: { changes: '' } }), /message/u);
  assert.throws(() => applyLocaleOverrides('en', { git: 'not an object' }), /payload/u);
});

test('setLocalePreference only accepts supported locales', () => {
  initializeI18n({ locale: 'en' });
  assert.equal(setLocalePreference('zh-CN'), true);
  assert.equal(getLocale(), 'zh-CN');
  assert.equal(setLocalePreference('klingon'), false);
  assert.equal(getLocale(), 'zh-CN');
  setLocalePreference('en');
});
