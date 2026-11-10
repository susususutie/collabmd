import { resolveApiUrl } from '../domain/runtime-paths.js';
import { isPdfFilePath } from '../../domain/file-kind.js';
import { getVaultPathLeaf } from '../domain/vault-paths.js';
import { t, translateServerMessage } from '../i18n/index.js';
import { createRequestHeaders, parseApiResponse } from './api-client-utils.js';
import { downloadBlob, parseDownloadFileName } from '../browser-utils.js';

function encodeHeaderMetadata(value) {
  return encodeURIComponent(String(value ?? ''));
}

async function triggerDownload(url, {
  fallbackError,
  fallbackFileName,
} = {}) {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || fallbackError);
  }

  const blob = await response.blob();
  downloadBlob(
    blob,
    parseDownloadFileName(response.headers.get('content-disposition') || '', fallbackFileName),
    { removeDelayMs: 0, revokeDelayMs: 0 },
  );
  return response;
}

export const vaultApiClient = {
  async readTree(config) {
    const response = await fetch(resolveApiUrl('/files', config));
    return parseApiResponse(response, 'api.failedToLoadFileTree');
  },
  async callAgentTool(name, input, { signal } = {}) {
    const response = await fetch(resolveApiUrl(`/agent/tools/${encodeURIComponent(name)}`), {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal,
    });
    return parseApiResponse(response, 'api.failedToExecuteName', { name: name });
  },

  async readCommentOverview() {
    const response = await fetch(resolveApiUrl('/comments/overview'));
    return parseApiResponse(response, 'api.failedToLoadCommentOverview');
  },

  async readFile(path, config) {
    const response = await fetch(resolveApiUrl(`/file?path=${encodeURIComponent(path)}`, config));
    return parseApiResponse(response, 'api.failedToReadFile');
  },

  async readBacklinks(filePath, { signal } = {}) {
    const response = await fetch(
      resolveApiUrl(`/backlinks?file=${encodeURIComponent(filePath)}`),
      { signal },
    );
    const data = await parseApiResponse(response, 'api.failedToLoadBacklinks');
    return Array.isArray(data.backlinks) ? data.backlinks : [];
  },

  async syncStructurizrWorkspace({ path, source }) {
    const response = await fetch(resolveApiUrl('/structurizr/sync'), {
      body: JSON.stringify({
        path,
        source,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    return parseApiResponse(response, 'api.failedToSyncStructurizrWorkspace');
  },

  async renderSvg(source) {
    const response = await fetch(resolveApiUrl('/plantuml/render'), {
      body: JSON.stringify({ source }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const data = await parseApiResponse(response, 'api.failedToRenderPlantuml');
    if (!data.ok || typeof data.svg !== 'string') {
      throw new Error(data.error ? translateServerMessage(data.error) : t('api.failedToRenderPlantuml'));
    }

    return data.svg;
  },

  async searchText({ limit = 50, query = '', signal = null } = {}) {
    const searchParams = new URLSearchParams({
      limit: String(limit),
      q: String(query ?? ''),
    });
    const response = await fetch(resolveApiUrl(`/search?${searchParams.toString()}`), {
      signal,
    });
    return parseApiResponse(response, 'api.failedToSearchFiles');
  },

  async queryBase({
    activeFilePath = '',
    path = '',
    search = '',
    source = null,
    sourcePath = '',
    view = '',
  } = {}) {
    const response = await fetch(resolveApiUrl('/base/query'), {
      body: JSON.stringify({
        activeFilePath,
        path,
        search,
        source,
        sourcePath,
        view,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    return parseApiResponse(response, 'api.failedToQueryBase');
  },

  async exportBaseCsv({
    activeFilePath = '',
    path = '',
    search = '',
    source = null,
    sourcePath = '',
    view = '',
  } = {}) {
    const response = await fetch(resolveApiUrl('/base/export'), {
      body: JSON.stringify({
        activeFilePath,
        path,
        search,
        source,
        sourcePath,
        view,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Failed to export base CSV');
    }

    return {
      blob: await response.blob(),
      contentDisposition: response.headers.get('content-disposition') || '',
    };
  },

  async queryBasePropertyValues({
    activeFilePath = '',
    path = '',
    propertyId = '',
    query = '',
    source = null,
    sourcePath = '',
    view = '',
  } = {}) {
    const response = await fetch(resolveApiUrl('/base/property-values'), {
      body: JSON.stringify({
        activeFilePath,
        path,
        propertyId,
        query,
        source,
        sourcePath,
        view,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    return parseApiResponse(response, 'api.failedToLoadBasePropertyValues');
  },

  async transformBase({
    activeFilePath = '',
    mutation = null,
    path = '',
    source = null,
    sourcePath = '',
    view = '',
  } = {}) {
    const response = await fetch(resolveApiUrl('/base/transform'), {
      body: JSON.stringify({
        activeFilePath,
        mutation,
        path,
        source,
        sourcePath,
        view,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    return parseApiResponse(response, 'api.failedToTransformBase');
  },

  async createFile({ content, path, requestId = null }) {
    const response = await fetch(resolveApiUrl('/file'), {
      body: JSON.stringify({ content, path }),
      headers: createRequestHeaders(requestId, { 'Content-Type': 'application/json' }),
      method: 'POST',
    });
    return parseApiResponse(response, 'api.failedToCreateFile');
  },

  async writeFile({ content, path, requestId = null }) {
    const response = await fetch(resolveApiUrl('/file'), {
      body: JSON.stringify({ content, path }),
      headers: createRequestHeaders(requestId, { 'Content-Type': 'application/json' }),
      method: 'PUT',
    });
    return parseApiResponse(response, 'api.failedToWriteFile');
  },

  async renameFile({ oldPath, newPath, requestId = null }) {
    const response = await fetch(resolveApiUrl('/file'), {
      body: JSON.stringify({ newPath, oldPath }),
      headers: createRequestHeaders(requestId, { 'Content-Type': 'application/json' }),
      method: 'PATCH',
    });
    return parseApiResponse(response, 'api.failedToRenameFile');
  },

  async deleteFile(path, { requestId = null } = {}) {
    const response = await fetch(resolveApiUrl(`/file?path=${encodeURIComponent(path)}`), {
      headers: requestId ? createRequestHeaders(requestId) : undefined,
      method: 'DELETE',
    });
    return parseApiResponse(response, 'api.failedToDeleteFile');
  },

  async createDirectory(path, { requestId = null } = {}) {
    const response = await fetch(resolveApiUrl('/directory'), {
      body: JSON.stringify({ path }),
      headers: createRequestHeaders(requestId, { 'Content-Type': 'application/json' }),
      method: 'POST',
    });
    return parseApiResponse(response, 'api.failedToCreateFolder');
  },

  async renameDirectory({ oldPath, newPath, requestId = null }) {
    const response = await fetch(resolveApiUrl('/directory'), {
      body: JSON.stringify({ newPath, oldPath }),
      headers: createRequestHeaders(requestId, { 'Content-Type': 'application/json' }),
      method: 'PATCH',
    });
    return parseApiResponse(response, 'api.failedToRenameFolder');
  },

  async deleteDirectory(path, { recursive = false, requestId = null } = {}) {
    const searchParams = new URLSearchParams({
      path: String(path ?? ''),
    });
    if (recursive) {
      searchParams.set('recursive', '1');
    }

    const response = await fetch(resolveApiUrl(`/directory?${searchParams.toString()}`), {
      headers: requestId ? createRequestHeaders(requestId) : undefined,
      method: 'DELETE',
    });
    return parseApiResponse(response, 'api.failedToDeleteFolder');
  },

  async uploadImageAttachment({ file, fileName = '', sourcePath }) {
    const response = await fetch(resolveApiUrl('/attachments'), {
      body: file,
      headers: {
        'Content-Type': file?.type || 'application/octet-stream',
        'X-CollabMD-File-Name': encodeHeaderMetadata(fileName),
        'X-CollabMD-Source-Path': encodeHeaderMetadata(sourcePath),
      },
      method: 'POST',
    });
    return parseApiResponse(response, 'api.failedToUploadImage');
  },

  async uploadFile({ file, path, requestId = null }) {
    const response = await fetch(resolveApiUrl('/file/upload'), {
      body: file,
      headers: createRequestHeaders(requestId, {
        'Content-Type': isPdfFilePath(path) ? 'application/pdf' : (file?.type || 'application/octet-stream'),
        'X-CollabMD-File-Path': encodeHeaderMetadata(path),
      }),
      method: 'POST',
    });
    return parseApiResponse(response, 'api.failedToUploadFile');
  },

  async downloadFile(path) {
    const fallbackFileName = getVaultPathLeaf(path) || 'download';
    return triggerDownload(resolveApiUrl(`/download/file?path=${encodeURIComponent(path)}`), {
      fallbackError: 'api.failedToDownloadFile',
      fallbackFileName,
    });
  },

  async downloadDirectory(path) {
    const directoryName = getVaultPathLeaf(path) || 'vault';
    return triggerDownload(resolveApiUrl(`/download/directory?path=${encodeURIComponent(path)}`), {
      fallbackError: 'api.failedToDownloadFolder',
      fallbackFileName: `${directoryName}.zip`,
    });
  },
};
