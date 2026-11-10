import { resolveApiUrl } from '../domain/runtime-paths.js';
import { createRequestHeaders, parseApiResponse } from './api-client-utils.js';

function createSearchParams(values = {}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value == null || value === '') {
      return;
    }

    params.set(key, String(value));
  });
  return params;
}

async function postJson(path, payload, { fallbackError, requestId = null } = {}) {
  const response = await fetch(resolveApiUrl(path), {
    body: JSON.stringify(payload),
    headers: createRequestHeaders(requestId, { 'Content-Type': 'application/json' }),
    method: 'POST',
  });
  return parseApiResponse(response, fallbackError);
}

export const gitApiClient = {
  async readStatus({ force = false } = {}) {
    const response = await fetch(resolveApiUrl(`/git/status${force ? '?force=true' : ''}`));
    return parseApiResponse(response, 'git.failedToLoadGitStatus');
  },

  getPullBackupSummaryUrl(backupId) {
    const params = createSearchParams({ id: backupId });
    return resolveApiUrl(`/git/pull-backup-summary?${params.toString()}`);
  },

  async readPullBackups() {
    const response = await fetch(resolveApiUrl('/git/pull-backups'));
    return parseApiResponse(response, 'git.failedToLoadPullBackups');
  },

  async readHistory({ limit, offset } = {}) {
    const params = createSearchParams({ limit, offset });
    const response = await fetch(resolveApiUrl(`/git/history?${params.toString()}`));
    return parseApiResponse(response, 'git.failedToLoadGitHistory');
  },

  async readFileHistory({ path, limit, offset } = {}) {
    const params = createSearchParams({ limit, offset, path });
    const response = await fetch(resolveApiUrl(`/git/file-history?${params.toString()}`));
    return parseApiResponse(response, 'git.failedToLoadFileHistory');
  },

  async readDiff({
    allowLargePatch = false,
    metaOnly = false,
    path = null,
    scope = 'all',
  } = {}) {
    const params = createSearchParams({
      allowLargePatch: allowLargePatch ? 'true' : null,
      metaOnly: metaOnly ? 'true' : null,
      path,
      scope,
    });
    const response = await fetch(resolveApiUrl(`/git/diff?${params.toString()}`));
    return parseApiResponse(response, 'git.failedToLoadGitDiff');
  },

  async readCommit({
    allowLargePatch = false,
    hash,
    metaOnly = false,
    path = null,
  } = {}) {
    const params = createSearchParams({
      allowLargePatch: allowLargePatch ? 'true' : null,
      hash,
      metaOnly: metaOnly ? 'true' : null,
      path,
    });
    const response = await fetch(resolveApiUrl(`/git/commit?${params.toString()}`));
    return parseApiResponse(response, 'git.failedToLoadGitCommit');
  },

  async readFileSnapshot({ hash, path } = {}) {
    const params = createSearchParams({ hash, path });
    const response = await fetch(resolveApiUrl(`/git/file-snapshot?${params.toString()}`));
    return parseApiResponse(response, 'git.failedToLoadHistoricalFilePreview');
  },

  getFileAttachmentUrl({ hash, path } = {}) {
    const params = createSearchParams({ hash, path });
    return resolveApiUrl(`/git/file-attachment?${params.toString()}`);
  },

  async stageFile({ path, requestId = null } = {}) {
    return postJson('/git/stage', { path }, { requestId, fallbackError: 'git.failedToStageFile' });
  },

  async unstageFile({ path, requestId = null } = {}) {
    return postJson('/git/unstage', { path }, { requestId, fallbackError: 'git.failedToUnstageFile' });
  },

  async stageAll({ requestId = null } = {}) {
    return postJson('/git/stage-all', {}, { requestId, fallbackError: 'git.failedToStageAllChanges' });
  },

  async unstageAll({ requestId = null } = {}) {
    return postJson('/git/unstage-all', {}, { requestId, fallbackError: 'git.failedToUnstageAllChanges' });
  },

  async pushBranch({ requestId = null } = {}) {
    return postJson('/git/push', {}, { requestId, fallbackError: 'git.failedToPushBranch' });
  },

  async pullBranch({ requestId = null } = {}) {
    return postJson('/git/pull', {}, { requestId, fallbackError: 'git.failedToPullBranch' });
  },

  async resetFile({ path, requestId = null } = {}) {
    return postJson('/git/reset-file', { path }, { requestId, fallbackError: 'git.failedToResetFile' });
  },

  async commit({ message, requestId = null } = {}) {
    return postJson('/git/commit', { message }, { requestId, fallbackError: 'git.failedToCommitStagedChanges' });
  },
};
