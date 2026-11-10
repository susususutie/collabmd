import {
  getVaultFileExtension,
  isVaultFilePath,
  VAULT_FILE_EXTENSIONS,
} from '../../domain/file-kind.js';
import { copyTextToClipboard, pickFiles } from '../browser-utils.js';
import {
  createBaseStarter,
  composeVaultChildPath,
  createDrawioStarter,
  createMarkdownStarter,
  createMermaidStarter,
  createPlantUmlStarter,
  createStructurizrStarter,
  ensureVaultExtension,
  getVaultPathLeaf,
  getVaultPathParent,
  normalizeVaultPathInput,
} from '../domain/vault-paths.js';
import { createFileRouteHash } from '../domain/hash-routes.js';
import { getActiveVaultId } from '../domain/runtime-paths.js';
import { t } from '../i18n/index.js';
import { buttonClassNames } from './components/ui/button.js';
import { CreateMenuPresenter } from './create-menu-presenter.js';

function replacePathPrefix(pathValue, oldPrefix, newPrefix) {
  if (pathValue === oldPrefix) {
    return newPrefix;
  }

  return `${newPrefix}${pathValue.slice(oldPrefix.length)}`;
}

function formatCount(value, singularLabel, pluralLabel) {
  return `${value} ${value === 1 ? singularLabel : pluralLabel}`;
}

const VAULT_FILE_PICKER_ACCEPT = VAULT_FILE_EXTENSIONS.join(',');

function createEmptyExcalidrawScene() {
  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'collabmd',
    elements: [],
    appState: { viewBackgroundColor: '#ffffff', gridSize: null },
    files: {},
  });
}

function withRequestId(payload, requestId) {
  if (!requestId) {
    return payload;
  }

  return {
    ...payload,
    requestId,
  };
}

export class FileActionController {
  constructor({
    mobileBreakpointQuery = (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
      ? window.matchMedia('(max-width: 768px)')
      : { matches: false },
    onDirectoryExport,
    onFileDelete,
    onFileSelect,
    onShowFileExtensionsChange,
    pendingWorkspaceRequestIds = null,
    showFileExtensions = false,
    state,
    toastController,
    vaultClient,
    view,
    refresh,
  }) {
    this.onDirectoryExport = onDirectoryExport;
    this.onFileDelete = onFileDelete;
    this.onFileSelect = onFileSelect;
    this.onShowFileExtensionsChange = onShowFileExtensionsChange;
    this.pendingWorkspaceRequestIds = pendingWorkspaceRequestIds;
    this.showFileExtensions = Boolean(showFileExtensions);
    this.state = state;
    this.toastController = toastController;
    this.vaultClient = vaultClient;
    this.view = view;
    this.refresh = refresh;
    this.createButton = document.getElementById('sidebarCreateBtn');
    this.fileExplorerOptionsButton = document.getElementById('fileExplorerOptionsBtn');
    this.actionDialog = document.getElementById('fileActionDialog');
    this.actionForm = document.getElementById('fileActionForm');
    this.actionTitle = document.getElementById('fileActionTitle');
    this.actionCopy = document.getElementById('fileActionCopy');
    this.actionField = document.getElementById('fileActionField');
    this.actionLabel = document.getElementById('fileActionLabel');
    this.actionInput = document.getElementById('fileActionInput');
    this.actionHint = document.getElementById('fileActionHint');
    this.actionNote = document.getElementById('fileActionNote');
    this.actionCancelButton = document.getElementById('fileActionCancel');
    this.actionSubmitButton = document.getElementById('fileActionSubmit');
    this.createMenu = new CreateMenuPresenter({
      mobileBreakpointQuery,
    });
    this.fileExplorerOptionsMenu = new CreateMenuPresenter({
      mobileBreakpointQuery,
    });
    this.pendingAction = null;
    this.actionBusy = false;
  }

  initialize() {
    this.createButton?.addEventListener('click', () => {
      this.openRootCreateMenu({ anchor: this.createButton });
    });
    this.fileExplorerOptionsButton?.addEventListener('click', () => {
      this.openFileExplorerOptionsMenu({ anchor: this.fileExplorerOptionsButton });
    });
    this.actionCancelButton?.addEventListener('click', () => this.closeActionDialog());
    this.actionForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.handleActionSubmit();
    });
    this.actionDialog?.addEventListener('close', () => this.resetActionDialog());
  }

  getCreateActions({ parentDir = '' } = {}) {
    return [
      {
        contextLabel: t('file.uploadFiles'),
        group: t('common.file'),
        hint: t('file.supportedVaultFiles'),
        icon: this.getCreateActionIcon('upload'),
        id: 'upload',
        label: t('file.uploadFiles'),
        meta: t('file.multiple'),
        onSelect: () => {
          void this.handleUploadFiles({ parentDir });
        },
      },
      {
        contextLabel: t('file.newMarkdownFile'),
        group: t('common.note'),
        hint: t('common.markdown'),
        icon: this.getCreateActionIcon('markdown'),
        id: 'markdown',
        label: t('file.markdownNote'),
        meta: '.md',
        onSelect: () => this.handleNewFile({ parentDir }),
      },
      {
        contextLabel: t('file.newBaseFile'),
        group: t('common.note'),
        hint: t('file.base'),
        icon: this.getCreateActionIcon('base'),
        id: 'base',
        label: t('file.baseFile'),
        meta: '.base',
        onSelect: () => this.handleNewBase({ parentDir }),
      },
      {
        contextLabel: t('file.newCanvas'),
        group: t('common.diagram'),
        hint: t('file.jsonCanvas'),
        icon: this.getCreateActionIcon('canvas'),
        id: 'canvas',
        label: t('common.canvas'),
        meta: '.canvas',
        onSelect: () => this.handleNewCanvas({ parentDir }),
      },
      {
        contextLabel: t('file.newExcalidrawDrawing'),
        group: t('common.diagram'),
        hint: t('file.excalidraw'),
        icon: this.getCreateActionIcon('excalidraw'),
        id: 'excalidraw',
        label: t('file.excalidrawDrawing'),
        meta: '.excalidraw',
        onSelect: () => this.handleNewDrawing({ parentDir }),
      },
      {
        contextLabel: t('file.newDrawIoDiagram'),
        group: t('common.diagram'),
        hint: t('file.drawIo'),
        icon: this.getCreateActionIcon('drawio'),
        id: 'drawio',
        label: t('file.drawIoDiagram'),
        meta: '.drawio',
        onSelect: () => this.handleNewDrawio({ parentDir }),
      },
      {
        contextLabel: t('file.newMermaidDiagram'),
        group: t('common.diagram'),
        hint: t('file.mermaid'),
        icon: this.getCreateActionIcon('mermaid'),
        id: 'mermaid',
        label: t('file.mermaidDiagram'),
        meta: '.mmd',
        onSelect: () => this.handleNewMermaid({ parentDir }),
      },
      {
        contextLabel: t('file.newPlantumlDiagram'),
        group: t('common.diagram'),
        hint: t('file.plantuml'),
        icon: this.getCreateActionIcon('plantuml'),
        id: 'plantuml',
        label: t('file.plantumlDiagram'),
        meta: '.puml',
        onSelect: () => this.handleNewPlantUml({ parentDir }),
      },
      {
        contextLabel: t('file.newStructurizrWorkspace'),
        group: t('common.diagram'),
        hint: t('file.structurizrDsl'),
        icon: this.getCreateActionIcon('structurizr'),
        id: 'structurizr',
        label: t('file.structurizrWorkspace'),
        meta: '.dsl',
        onSelect: () => this.handleNewStructurizr({ parentDir }),
      },
      {
        contextLabel: t('common.newFolder'),
        group: t('file.structure'),
        hint: t('common.folder'),
        icon: this.getCreateActionIcon('folder'),
        id: 'folder',
        label: t('common.folder'),
        meta: t('file.folderTypeHint'),
        onSelect: () => this.handleNewFolder({ parentDir }),
      },
    ];
  }

  createContextMenuItems(parentDir = '') {
    return this.getCreateActions({ parentDir }).map((item) => ({
      label: item.contextLabel,
      onSelect: item.onSelect,
    }));
  }

  getDirectoryContextMenuItems(directoryPath) {
    return [
      {
        label: t('file.new'),
        onSelect: ({ anchor } = {}) => this.openCreateMenu({ anchor, parentDir: directoryPath }),
      },
      {
        label: t('file.renameMove'),
        onSelect: () => this.handleRenameDirectory(directoryPath),
      },
      {
        label: t('file.downloadSourceZip'),
        onSelect: () => this.handleDownloadDirectory(directoryPath),
      },
      {
        label: t('file.exportHtml'),
        onSelect: () => this.onDirectoryExport?.(directoryPath, 'html'),
      },
      {
        label: t('file.printSavePdf'),
        onSelect: () => this.onDirectoryExport?.(directoryPath, 'pdf'),
      },
      {
        label: t('common.delete'),
        danger: true,
        onSelect: () => this.handleDeleteDirectory(directoryPath),
      },
    ];
  }

  getFileContextMenuItems(filePath) {
    return [
      {
        label: t('file.copyAsUrl'),
        onSelect: () => this.copyFileUrl(filePath),
      },
      {
        label: t('file.renameMove'),
        onSelect: () => this.handleRenameFile(filePath),
      },
      {
        label: t('common.download'),
        onSelect: () => this.handleDownloadFile(filePath),
      },
      {
        label: t('common.delete'),
        danger: true,
        onSelect: () => this.handleDelete(filePath),
      },
    ];
  }

  async copyFileUrl(filePath) {
    const url = new URL(window.location.href);
    url.search = '';
    const vaultId = getActiveVaultId();
    if (vaultId) url.searchParams.set('vault', vaultId);
    url.hash = createFileRouteHash(filePath);
    try {
      await copyTextToClipboard(url.toString());
      this.showToast(t('file.linkCopied'));
    } catch {
      this.showToast(t('file.failedToCopyLink'));
    }
  }

  showToast(message) {
    if (message) {
      this.toastController?.show(String(message));
    }
  }

  getCreateActionIcon(kind) {
    switch (kind) {
      case 'upload':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg>';
      case 'base':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M14 4v5h5"/><path d="M8 13h8"/><path d="M8 17h6"/><path d="M8 9h3"/></svg>';
      case 'canvas':
      case 'drawio':
      case 'plantuml':
      case 'structurizr':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="7" height="6" rx="1"/><rect x="14" y="4" width="7" height="6" rx="1"/><rect x="8.5" y="14" width="7" height="6" rx="1"/><path d="M10 7h4"/><path d="M17.5 10v2.5"/><path d="M6.5 10v2.5"/><path d="M6.5 12.5h11"/></svg>';
      case 'excalidraw':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>';
      case 'folder':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      case 'mermaid':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7.5c0-1.38 1.12-2.5 2.5-2.5 1.04 0 1.93.64 2.3 1.56A2.5 2.5 0 0 1 14 8.5v1"/><path d="M19 16.5c0 1.38-1.12 2.5-2.5 2.5-1.04 0-1.93-.64-2.3-1.56A2.5 2.5 0 0 1 10 15.5v-1"/><path d="M8 10.5h8"/><path d="M8 13.5h8"/><path d="M10 8.5v7"/><path d="M14 8.5v7"/></svg>';
      case 'markdown':
      default:
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }
  }

  showError(message, error) {
    this.showToast(error?.message ? `${message}: ${error.message}` : message);
  }

  createPendingWorkspaceRequestId() {
    if (!this.pendingWorkspaceRequestIds) {
      return null;
    }

    const requestId = crypto.randomUUID();
    this.pendingWorkspaceRequestIds.add(requestId);
    return requestId;
  }

  clearPendingWorkspaceRequestId(requestId) {
    if (!requestId) {
      return;
    }

    this.pendingWorkspaceRequestIds?.delete(requestId);
  }

  async runWorkspaceMutation(callback) {
    const requestId = this.createPendingWorkspaceRequestId();

    try {
      return await callback(requestId);
    } catch (error) {
      this.clearPendingWorkspaceRequestId(requestId);
      throw error;
    }
  }

  openActionDialog({
    title,
    copy,
    label = t('common.path'),
    hint = '',
    note = '',
    placeholder = '',
    value = '',
    submitLabel = t('common.save'),
    destructive = false,
    requiresInput = true,
    emptyMessage = t('file.aValueIsRequired'),
    onSubmit,
  }) {
    if (!this.actionDialog || !this.actionTitle || !this.actionCopy || !this.actionSubmitButton || !this.actionCancelButton) {
      return;
    }

    if (requiresInput && !this.actionInput) {
      return;
    }

    if (this.actionDialog.open) {
      if (typeof this.actionDialog.close === 'function') {
        this.actionDialog.close();
      } else {
        this.actionDialog.removeAttribute('open');
        this.resetActionDialog();
      }
    }

    this.pendingAction = { requiresInput, emptyMessage, onSubmit };
    this.createMenu.close({ restoreFocus: false });
    this.fileExplorerOptionsMenu.close({ restoreFocus: false });
    this.view?.removeContextMenu?.();

    this.actionTitle.textContent = title;
    this.actionCopy.textContent = copy;

    if (this.actionField) {
      this.actionField.hidden = !requiresInput;
    }
    if (this.actionLabel) {
      this.actionLabel.textContent = label;
    }
    if (this.actionInput) {
      this.actionInput.value = value;
      this.actionInput.placeholder = placeholder;
      this.actionInput.required = requiresInput;
      this.actionInput.disabled = false;
    }
    if (this.actionHint) {
      this.actionHint.textContent = hint;
      this.actionHint.hidden = !requiresInput || !hint;
    }
    if (this.actionNote) {
      this.actionNote.textContent = note;
      this.actionNote.hidden = !note;
      this.actionNote.classList.toggle('is-danger', destructive);
    }

    this.actionSubmitButton.textContent = submitLabel;
    this.actionSubmitButton.disabled = false;
    this.actionSubmitButton.classList.toggle('ui-button--primary', !destructive);
    this.actionSubmitButton.classList.toggle('ui-button--danger', destructive);
    this.actionCancelButton.disabled = false;

    if (typeof this.actionDialog.showModal === 'function') {
      this.actionDialog.showModal();
    } else {
      this.actionDialog.setAttribute('open', 'true');
    }

    requestAnimationFrame(() => {
      if (!requiresInput || !this.actionInput) {
        this.actionSubmitButton.focus();
        return;
      }

      this.actionInput.focus();
      if (value) {
        this.actionInput.select();
      }
    });
  }

  resetActionDialog() {
    this.pendingAction = null;
    this.actionBusy = false;

    if (this.actionField) {
      this.actionField.hidden = false;
    }
    if (this.actionLabel) {
      this.actionLabel.textContent = t('common.path');
    }
    if (this.actionInput) {
      this.actionInput.value = '';
      this.actionInput.placeholder = '';
      this.actionInput.required = true;
      this.actionInput.disabled = false;
    }
    if (this.actionHint) {
      this.actionHint.textContent = '';
      this.actionHint.hidden = true;
    }
    if (this.actionNote) {
      this.actionNote.textContent = '';
      this.actionNote.hidden = true;
      this.actionNote.classList.remove('is-danger');
    }
    if (this.actionSubmitButton) {
      this.actionSubmitButton.textContent = t('common.save');
      this.actionSubmitButton.disabled = false;
      this.actionSubmitButton.className = buttonClassNames({ variant: 'primary' });
    }
    if (this.actionCancelButton) {
      this.actionCancelButton.disabled = false;
    }
  }

  closeActionDialog() {
    if (!this.actionDialog) {
      return;
    }

    if (this.actionDialog.open && typeof this.actionDialog.close === 'function') {
      this.actionDialog.close();
      return;
    }

    this.actionDialog.removeAttribute('open');
    this.resetActionDialog();
  }

  setActionDialogBusy(isBusy) {
    this.actionBusy = isBusy;

    if (this.actionInput) {
      this.actionInput.disabled = isBusy || !(this.pendingAction?.requiresInput ?? true);
    }
    if (this.actionCancelButton) {
      this.actionCancelButton.disabled = isBusy;
    }
    if (this.actionSubmitButton) {
      this.actionSubmitButton.disabled = isBusy;
    }
  }

  async handleActionSubmit() {
    if (!this.pendingAction?.onSubmit || this.actionBusy) {
      return;
    }

    const requiresInput = this.pendingAction.requiresInput;
    const rawValue = requiresInput ? this.actionInput?.value.trim() ?? '' : undefined;

    if (requiresInput && !rawValue) {
      this.showToast(this.pendingAction.emptyMessage);
      this.actionInput?.focus();
      return;
    }

    this.setActionDialogBusy(true);

    let shouldClose;
    try {
      shouldClose = await this.pendingAction.onSubmit(rawValue);
    } catch (error) {
      this.showError(t('file.failedToCompleteAction'), error);
    }

    this.setActionDialogBusy(false);

    if (shouldClose !== false) {
      this.closeActionDialog();
      return;
    }

    if (requiresInput && this.actionInput) {
      this.actionInput.focus();
      this.actionInput.select();
    }
  }

  async uploadVaultFiles(files = [], { parentDir = '' } = {}) {
    const normalizedParentDir = normalizeVaultPathInput(parentDir);
    let uploaded = false;

    for (const file of Array.from(files ?? [])) {
      const fileName = getVaultPathLeaf(file?.name);
      const filePath = composeVaultChildPath(normalizedParentDir, fileName);
      if (!fileName || !isVaultFilePath(filePath)) {
        this.showToast(t('file.unsupportedFileTypeFilename', { fileName: fileName || t('file.unnamedFile') }));
        continue;
      }

      try {
        await this.runWorkspaceMutation((requestId) => this.vaultClient.uploadFile({
          file,
          path: filePath,
          requestId,
        }));
        uploaded = true;
        this.state.expandDirectoryPath(filePath, { includeLeaf: false });
      } catch (error) {
        this.showToast(`${fileName}: ${error?.message || t('file.failedToUploadFile')}`);
      }
    }

    if (uploaded) {
      await this.refresh();
    }

    return uploaded;
  }

  async handleUploadFiles({ parentDir = '' } = {}) {
    const files = await pickFiles({ accept: VAULT_FILE_PICKER_ACCEPT, multiple: true });
    if (files.length === 0) {
      return false;
    }

    return this.uploadVaultFiles(files, { parentDir });
  }

  async createVaultFile(filePath, content, { openAfterCreate = false, errorMessage = t('file.failedToCreateFile') } = {}) {
    try {
      await this.runWorkspaceMutation((requestId) => this.vaultClient.createFile(withRequestId({
        content,
        path: filePath,
      }, requestId)));
      this.state.expandDirectoryPath(filePath, { includeLeaf: false });
      await this.refresh();

      if (openAfterCreate) {
        this.onFileSelect?.(filePath);
      }

      return true;
    } catch (error) {
      this.showToast(error?.message || errorMessage);
      return false;
    }
  }

  async createDirectory(pathValue) {
    const directoryPath = normalizeVaultPathInput(pathValue);
    if (!directoryPath) {
      this.showToast(t('file.folderPathIsRequired'));
      return false;
    }

    try {
      await this.runWorkspaceMutation((requestId) => this.vaultClient.createDirectory(
        directoryPath,
        withRequestId({}, requestId),
      ));
      this.state.expandDirectoryPath(directoryPath);
      await this.refresh();
      return true;
    } catch (error) {
      this.showToast(error?.message || t('file.failedToCreateFolder'));
      return false;
    }
  }

  async renameVaultFile(filePath, nextName, extension) {
    const normalizedPath = normalizeVaultPathInput(nextName);
    if (!normalizedPath) {
      this.showToast(t('file.filePathIsRequired'));
      return false;
    }

    const requestedExtension = getVaultFileExtension(normalizedPath);
    if (requestedExtension && requestedExtension.toLowerCase() !== String(extension ?? '').toLowerCase()) {
      this.showToast(t('file.fileTypeChangesAreNotSupportedDuringRenameKeep', { extension }));
      return false;
    }

    const finalPath = requestedExtension
      ? normalizedPath
      : `${normalizedPath}${extension}`;
    if (!getVaultPathLeaf(finalPath)) {
      this.showToast(t('file.filePathIsRequired'));
      return false;
    }

    if (finalPath === filePath) {
      return true;
    }

    try {
      await this.runWorkspaceMutation((requestId) => this.vaultClient.renameFile(withRequestId({
        newPath: finalPath,
        oldPath: filePath,
      }, requestId)));
      this.state.expandDirectoryPath(finalPath, { includeLeaf: false });
      await this.refresh();

      if (this.state.activeFilePath === filePath) {
        this.state.activeFilePath = finalPath;
        this.onFileSelect?.(finalPath);
      }

      return true;
    } catch (error) {
      this.showToast(error?.message || t('file.failedToRename'));
      return false;
    }
  }

  async renameDirectory(oldPath, nextPath) {
    const normalizedPath = normalizeVaultPathInput(nextPath);
    if (!normalizedPath) {
      this.showToast(t('file.folderPathIsRequired'));
      return false;
    }

    if (normalizedPath === oldPath) {
      return true;
    }

    try {
      await this.runWorkspaceMutation((requestId) => this.vaultClient.renameDirectory(withRequestId({
        newPath: normalizedPath,
        oldPath,
      }, requestId)));
      this.state.replaceExpandedDirectoryPrefix(oldPath, normalizedPath);
      this.state.expandDirectoryPath(normalizedPath);
      await this.refresh();

      if (this.state.activeFilePath && this.state.activeFilePath.startsWith(`${oldPath}/`)) {
        const nextActivePath = replacePathPrefix(this.state.activeFilePath, oldPath, normalizedPath);
        this.state.activeFilePath = nextActivePath;
        this.onFileSelect?.(nextActivePath);
      }

      return true;
    } catch (error) {
      this.showToast(error?.message || t('file.failedToRenameFolder'));
      return false;
    }
  }

  async deleteVaultFile(filePath) {
    try {
      await this.runWorkspaceMutation((requestId) => this.vaultClient.deleteFile(filePath, withRequestId({}, requestId)));
      await this.refresh();

      if (this.state.activeFilePath === filePath) {
        this.state.activeFilePath = null;
        this.onFileDelete?.(filePath);
      }

      return true;
    } catch (error) {
      this.showToast(error?.message || t('file.failedToDelete'));
      return false;
    }
  }

  async deleteDirectory(pathValue, { recursive = false } = {}) {
    try {
      await this.runWorkspaceMutation((requestId) => this.vaultClient.deleteDirectory(
        pathValue,
        withRequestId({ recursive }, requestId),
      ));
      const activeFilePath = this.state.activeFilePath;
      await this.refresh();
      this.state.removeExpandedDirectoryPrefix(pathValue);

      if (activeFilePath && activeFilePath.startsWith(`${pathValue}/`)) {
        this.state.activeFilePath = null;
        this.onFileDelete?.(activeFilePath);
      }

      return true;
    } catch (error) {
      this.showToast(error?.message || t('file.failedToDeleteFolder'));
      return false;
    }
  }

  planMoveEntryByDrop({ destinationDirectory = '', sourcePath = '', sourceType = 'file' } = {}) {
    const normalizedSourcePath = normalizeVaultPathInput(sourcePath);
    const normalizedDestinationDirectory = normalizeVaultPathInput(destinationDirectory);
    const currentParentPath = getVaultPathParent(normalizedSourcePath);
    const entryName = getVaultPathLeaf(normalizedSourcePath);

    if (!normalizedSourcePath || !entryName) {
      return { ok: false, reason: t('file.invalidItemToMove') };
    }

    if (currentParentPath === normalizedDestinationDirectory) {
      return { ok: false, reason: t('file.itemIsAlreadyInThatFolder') };
    }

    if (sourceType === 'directory') {
      if (normalizedDestinationDirectory === normalizedSourcePath) {
        return { ok: false, reason: t('file.aFolderCannotBeMovedIntoItself') };
      }

      if (normalizedDestinationDirectory.startsWith(`${normalizedSourcePath}/`)) {
        return { ok: false, reason: t('file.aFolderCannotBeMovedIntoOneOfItsDescendants') };
      }

      return {
        nextPath: composeVaultChildPath(normalizedDestinationDirectory, entryName),
        ok: true,
      };
    }

    const extension = getVaultFileExtension(normalizedSourcePath) || '.md';
    return {
      extension,
      nextPath: composeVaultChildPath(normalizedDestinationDirectory, entryName),
      ok: true,
    };
  }

  canMoveEntryByDrop(payload = {}) {
    return this.planMoveEntryByDrop(payload).ok;
  }

  async moveEntryByDrop(payload = {}) {
    const plan = this.planMoveEntryByDrop(payload);
    if (!plan.ok) {
      this.showToast(plan.reason);
      return false;
    }

    if (payload.sourceType === 'directory') {
      return this.renameDirectory(payload.sourcePath, plan.nextPath);
    }

    return this.renameVaultFile(payload.sourcePath, plan.nextPath, plan.extension);
  }

  async downloadFileEntry(filePath) {
    try {
      await this.vaultClient.downloadFile(filePath);
      return true;
    } catch (error) {
      this.showToast(error?.message || t('file.failedToDownloadFile'));
      return false;
    }
  }

  async downloadDirectoryEntry(directoryPath) {
    try {
      await this.vaultClient.downloadDirectory(directoryPath);
      return true;
    } catch (error) {
      this.showToast(error?.message || t('file.failedToDownloadFolder'));
      return false;
    }
  }

  getCreateContext(parentDir = '') {
    const normalizedParentDir = normalizeVaultPathInput(parentDir);

    return {
      hintPrefix: normalizedParentDir
        ? t('file.useToCreateNestedItemsUnderThisFolder')
        : t('file.useToPlaceItInsideAFolder'),
      note: normalizedParentDir ? t('file.parentFolderPath', { path: normalizedParentDir }) : '',
      normalizedParentDir,
    };
  }

  openRootCreateMenu({ anchor = this.createButton } = {}) {
    this.openCreateMenu({ anchor, parentDir: '' });
  }

  openCreateMenu({ anchor = this.createButton, parentDir = '' } = {}) {
    this.view?.removeContextMenu?.();
    this.fileExplorerOptionsMenu.close({ restoreFocus: false });
    this.createMenu.toggle({
      anchor,
      items: this.getCreateActions({ parentDir }),
      title: t('common.create'),
    });
  }

  openFileExplorerOptionsMenu({ anchor = this.fileExplorerOptionsButton } = {}) {
    this.view?.removeContextMenu?.();
    this.createMenu.close({ restoreFocus: false });
    this.fileExplorerOptionsMenu.toggle({
      anchor,
      items: [{
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>',
        id: 'show-file-extensions',
        label: t('file.showFileExtensions'),
        meta: this.showFileExtensions ? t('common.on') : t('common.off'),
        onSelect: () => {
          this.showFileExtensions = !this.showFileExtensions;
          this.onShowFileExtensionsChange?.(this.showFileExtensions);
        },
      }],
      title: t('file.fileExplorerOptions'),
    });
  }

  handleNewFile({ parentDir = '' } = {}) {
    const context = this.getCreateContext(parentDir);

    this.openActionDialog({
      title: t('file.createMarkdownFile'),
      copy: context.normalizedParentDir
        ? t('file.addANewNoteInsideTheSelectedFolderItOpens')
        : t('file.addANewNoteToTheVaultItOpensImmediatelyAfter'),
      label: context.normalizedParentDir ? t('file.fileNameOrPath') : t('file.filePath'),
      hint: t('file.prefixMdIsAddedAutomatically', { prefix: context.hintPrefix }),
      note: context.note,
      placeholder: context.normalizedParentDir ? 'my-note' : 'notes/my-note',
      submitLabel: t('file.createFile'),
      emptyMessage: t('file.filePathIsRequired'),
      onSubmit: (value) => {
        const normalizedPath = normalizeVaultPathInput(value);
        if (!normalizedPath) {
          this.showToast(t('file.filePathIsRequired'));
          return false;
        }

        const filePath = ensureVaultExtension(composeVaultChildPath(context.normalizedParentDir, normalizedPath), '.md');
        return this.createVaultFile(filePath, createMarkdownStarter(filePath), {
          errorMessage: t('file.failedToCreateFile'),
          openAfterCreate: true,
        });
      },
    });
  }

  handleNewBase({ parentDir = '' } = {}) {
    const context = this.getCreateContext(parentDir);

    this.openActionDialog({
      title: t('file.createBaseFile'),
      copy: context.normalizedParentDir
        ? t('file.addANewBaseFileInsideTheSelectedFolderItOpens')
        : t('file.addANewBaseFileToTheVaultItOpensImmediatelyAfter'),
      label: context.normalizedParentDir ? t('file.baseNameOrPath') : t('file.basePath'),
      hint: t('file.prefixBaseIsAddedAutomatically', { prefix: context.hintPrefix }),
      note: context.note,
      placeholder: context.normalizedParentDir ? 'table-view' : 'views/table-view',
      submitLabel: t('file.createBase'),
      emptyMessage: t('file.basePathIsRequired'),
      onSubmit: (value) => {
        const normalizedPath = normalizeVaultPathInput(value);
        if (!normalizedPath) {
          this.showToast(t('file.basePathIsRequired'));
          return false;
        }

        const starter = createBaseStarter(composeVaultChildPath(context.normalizedParentDir, normalizedPath));
        return this.createVaultFile(starter.path, starter.content, {
          errorMessage: t('file.failedToCreateBaseFile'),
          openAfterCreate: true,
        });
      },
    });
  }

  handleNewFolder({ parentDir = '' } = {}) {
    const context = this.getCreateContext(parentDir);

    this.openActionDialog({
      title: t('file.createFolder'),
      copy: context.normalizedParentDir
        ? t('file.addANewFolderInsideTheSelectedFolder')
        : t('file.addANewFolderToOrganizeNotesAndDiagrams'),
      label: context.normalizedParentDir ? t('file.folderNameOrPath') : t('file.folderPath'),
      hint: context.hintPrefix,
      note: context.note,
      placeholder: context.normalizedParentDir ? 'archive' : 'notes/archive',
      submitLabel: t('file.createFolder'),
      emptyMessage: t('file.folderPathIsRequired'),
      onSubmit: (value) => this.createDirectory(composeVaultChildPath(context.normalizedParentDir, value)),
    });
  }

  handleNewCanvas({ parentDir = '' } = {}) {
    const context = this.getCreateContext(parentDir);
    this.openActionDialog({
      title: t('file.createCanvas'),
      copy: t('file.createACanvasForConnectedNotesFilesLinksAnd'),
      label: context.normalizedParentDir ? t('file.canvasNameOrPath') : t('file.canvasPath'),
      hint: t('file.prefixCanvasIsAddedAutomatically', { prefix: context.hintPrefix }),
      note: context.note,
      placeholder: context.normalizedParentDir ? 'ideas' : 'diagrams/ideas',
      submitLabel: t('file.createCanvas'),
      emptyMessage: t('file.canvasPathIsRequired'),
      onSubmit: (value) => {
        const normalizedPath = normalizeVaultPathInput(value);
        if (!normalizedPath) {
          this.showToast(t('file.canvasPathIsRequired'));
          return false;
        }
        const filePath = ensureVaultExtension(composeVaultChildPath(context.normalizedParentDir, normalizedPath), '.canvas');
        return this.createVaultFile(filePath, '{"nodes":[],"edges":[]}\n', {
          errorMessage: t('file.failedToCreateCanvas'),
          openAfterCreate: true,
        });
      },
    });
  }

  handleNewDrawing({ parentDir = '' } = {}) {
    const context = this.getCreateContext(parentDir);

    this.openActionDialog({
      title: t('file.createExcalidrawDrawing'),
      copy: context.normalizedParentDir
        ? t('file.startANewDrawingInsideTheSelectedFolder')
        : t('file.startANewDrawingFileInTheVault'),
      label: context.normalizedParentDir ? t('file.drawingNameOrPath') : t('file.drawingPath'),
      hint: t('file.prefixExcalidrawIsAddedAutomatically', { prefix: context.hintPrefix }),
      note: context.note,
      placeholder: context.normalizedParentDir ? 'architecture' : 'diagrams/architecture',
      submitLabel: t('file.createDrawing'),
      emptyMessage: t('file.drawingPathIsRequired'),
      onSubmit: (value) => {
        const normalizedPath = normalizeVaultPathInput(value);
        if (!normalizedPath) {
          this.showToast(t('file.drawingPathIsRequired'));
          return false;
        }

        const filePath = ensureVaultExtension(composeVaultChildPath(context.normalizedParentDir, normalizedPath), '.excalidraw');
        return this.createVaultFile(filePath, createEmptyExcalidrawScene(), {
          errorMessage: t('file.failedToCreateDrawing'),
          openAfterCreate: true,
        });
      },
    });
  }

  handleNewMermaid({ parentDir = '' } = {}) {
    const context = this.getCreateContext(parentDir);

    this.openActionDialog({
      title: t('file.createMermaidDiagram'),
      copy: context.normalizedParentDir
        ? t('file.createANewMmdOrMermaidFileInsideTheSelected')
        : t('file.createANewMmdOrMermaidFileWithStarterDiagram'),
      label: context.normalizedParentDir ? t('file.diagramNameOrPath') : t('file.diagramPath'),
      hint: t('file.prefixMmdIsAddedAutomaticallyUnlessYouEnter', { prefix: context.hintPrefix }),
      note: context.note,
      placeholder: context.normalizedParentDir ? 'flow' : 'diagrams/flow',
      submitLabel: t('file.createDiagram'),
      emptyMessage: t('file.diagramPathIsRequired'),
      onSubmit: (value) => {
        const normalizedPath = normalizeVaultPathInput(value);
        if (!normalizedPath) {
          this.showToast(t('file.diagramPathIsRequired'));
          return false;
        }

        const starter = createMermaidStarter(composeVaultChildPath(context.normalizedParentDir, normalizedPath));
        return this.createVaultFile(starter.path, starter.content, {
          errorMessage: t('file.failedToCreateMermaidDiagram'),
          openAfterCreate: true,
        });
      },
    });
  }

  handleNewDrawio({ parentDir = '' } = {}) {
    const context = this.getCreateContext(parentDir);

    this.openActionDialog({
      title: t('file.createDrawIoDiagram'),
      copy: context.normalizedParentDir
        ? t('file.createANewDrawioDiagramInsideTheSelectedFolder')
        : t('file.createANewDrawioDiagramWithANativeStarter'),
      label: context.normalizedParentDir ? t('file.diagramNameOrPath') : t('file.diagramPath'),
      hint: t('file.prefixDrawioIsAddedAutomatically', { prefix: context.hintPrefix }),
      note: context.note,
      placeholder: context.normalizedParentDir ? 'architecture' : 'diagrams/architecture',
      submitLabel: t('file.createDiagram'),
      emptyMessage: t('file.diagramPathIsRequired'),
      onSubmit: (value) => {
        const normalizedPath = normalizeVaultPathInput(value);
        if (!normalizedPath) {
          this.showToast(t('file.diagramPathIsRequired'));
          return false;
        }

        const starter = createDrawioStarter(composeVaultChildPath(context.normalizedParentDir, normalizedPath));
        return this.createVaultFile(starter.path, starter.content, {
          errorMessage: t('file.failedToCreateDrawIoDiagram'),
          openAfterCreate: true,
        });
      },
    });
  }

  handleNewPlantUml({ parentDir = '' } = {}) {
    const context = this.getCreateContext(parentDir);

    this.openActionDialog({
      title: t('file.createPlantumlDiagram'),
      copy: context.normalizedParentDir
        ? t('file.createANewPumlOrPlantumlFileInsideTheSelected')
        : t('file.createANewPumlOrPlantumlFileWithStarterDiagram'),
      label: context.normalizedParentDir ? t('file.diagramNameOrPath') : t('file.diagramPath'),
      hint: t('file.prefixPumlIsAddedAutomaticallyUnlessYouEnter', { prefix: context.hintPrefix }),
      note: context.note,
      placeholder: context.normalizedParentDir ? 'sequence-flow' : 'diagrams/sequence-flow',
      submitLabel: t('file.createDiagram'),
      emptyMessage: t('file.diagramPathIsRequired'),
      onSubmit: (value) => {
        const normalizedPath = normalizeVaultPathInput(value);
        if (!normalizedPath) {
          this.showToast(t('file.diagramPathIsRequired'));
          return false;
        }

        const starter = createPlantUmlStarter(composeVaultChildPath(context.normalizedParentDir, normalizedPath));
        return this.createVaultFile(starter.path, starter.content, {
          errorMessage: t('file.failedToCreatePlantumlDiagram'),
          openAfterCreate: true,
        });
      },
    });
  }

  handleNewStructurizr({ parentDir = '' } = {}) {
    const context = this.getCreateContext(parentDir);

    this.openActionDialog({
      title: t('file.createStructurizrWorkspace'),
      copy: context.normalizedParentDir
        ? t('file.createACollaborativeC4WorkspaceInsideTheSelected')
        : t('file.createACollaborativeC4WorkspaceInTheVault'),
      label: context.normalizedParentDir ? t('file.workspaceNameOrPath') : t('file.workspacePath'),
      hint: t('file.prefixDslIsAddedAutomaticallyWorkspaceDslIs', { prefix: context.hintPrefix }),
      note: context.note,
      placeholder: 'workspace',
      submitLabel: t('file.createWorkspace'),
      emptyMessage: t('file.workspacePathIsRequired'),
      onSubmit: (value) => {
        const normalizedPath = normalizeVaultPathInput(value);
        if (!normalizedPath) {
          this.showToast(t('file.workspacePathIsRequired'));
          return false;
        }

        const starter = createStructurizrStarter(composeVaultChildPath(context.normalizedParentDir, normalizedPath));
        return this.createVaultFile(starter.path, starter.content, {
          errorMessage: t('file.failedToCreateStructurizrWorkspace'),
          openAfterCreate: true,
        });
      },
    });
  }

  handleRenameFile(filePath) {
    const extension = getVaultFileExtension(filePath) || '.md';

    this.openActionDialog({
      title: t('file.renameOrMoveFile'),
      copy: t('file.updateTheRelativePathWithoutChangingTheFileType'),
      label: t('common.path'),
      hint: t('file.useToMoveTheFileIntoAnotherFolderExtensionIsKept', { extension }),
      value: filePath,
      submitLabel: t('file.saveFilePath'),
      emptyMessage: t('file.filePathIsRequired'),
      onSubmit: (value) => this.renameVaultFile(filePath, value, extension),
    });
  }

  handleRenameDirectory(directoryPath) {
    this.openActionDialog({
      title: t('file.renameOrMoveFolder'),
      copy: t('file.updateTheRelativePathForThisFolderAndEverything'),
      label: t('common.path'),
      hint: t('file.useToMoveTheFolderIntoAnotherLocationInTheVault'),
      value: directoryPath,
      submitLabel: t('file.saveFolderPath'),
      emptyMessage: t('file.folderPathIsRequired'),
      onSubmit: (value) => this.renameDirectory(directoryPath, value),
    });
  }

  handleDelete(filePath) {
    this.openActionDialog({
      title: t('file.deleteFile'),
      copy: t('file.thisPermanentlyRemovesTheFileFromTheVault'),
      note: filePath,
      submitLabel: t('file.deleteFile'),
      destructive: true,
      requiresInput: false,
      onSubmit: () => this.deleteVaultFile(filePath),
    });
  }

  handleDeleteDirectory(directoryPath) {
    const { directoryCount, fileCount } = this.state.getDirectoryDescendantSummary(directoryPath);
    const hasDescendants = directoryCount > 0 || fileCount > 0;
    const summary = hasDescendants
      ? t('file.thisWillPermanentlyRemoveFilesAndFoldersInside', {
        files: formatCount(fileCount, t('file.file'), t('file.files')),
        folders: formatCount(directoryCount, t('file.nestedFolder'), t('file.nestedFolders')),
      })
      : t('file.thisPermanentlyRemovesTheEmptyFolderFromTheVault');

    this.openActionDialog({
      title: hasDescendants ? t('file.deleteFolderAndContents') : t('file.deleteFolder'),
      copy: summary,
      note: directoryPath,
      submitLabel: hasDescendants ? t('file.deleteFolderAndContents') : t('file.deleteFolder'),
      destructive: true,
      requiresInput: false,
      onSubmit: () => this.deleteDirectory(directoryPath, { recursive: hasDescendants }),
    });
  }

  handleDownloadFile(filePath) {
    void this.downloadFileEntry(filePath);
  }

  handleDownloadDirectory(directoryPath) {
    void this.downloadDirectoryEntry(directoryPath);
  }
}
