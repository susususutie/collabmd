import { escapeHtml } from '../domain/vault-utils.js';
import { formatRelativeDateLabel } from '../domain/git-labels.js';
import { getVaultPathLeaf, getVaultPathParent } from '../domain/vault-paths.js';
import { t } from '../i18n/index.js';
import { buttonClassNames } from './components/ui/button.js';

const HISTORY_PAGE_SIZE = 30;

function renderHistoryTitle(filePath = '') {
  const fileName = getVaultPathLeaf(filePath);
  const dirPath = getVaultPathParent(filePath);
  if (!dirPath) {
    return `<span class="file-history-path">${escapeHtml(fileName)}</span>`;
  }

  return `
    <span class="file-history-path">${escapeHtml(fileName)}</span>
    <span class="file-history-dir">${escapeHtml(dirPath)}</span>
  `;
}

function renderCommitSubtitle(commit = {}) {
  const parts = [
    String(commit.authorName || t('common.unknown')),
    String(formatRelativeDateLabel(commit.authoredAt) || commit.relativeDateLabel || ''),
  ];

  if (commit.status === 'renamed' && commit.oldPath) {
    parts.push(t('file.renamedFromPath', { path: commit.oldPath }));
  }

  return parts.filter(Boolean).map((part) => escapeHtml(part)).join(' · ');
}

function entryKey(entry = {}) {
  if (entry.type === 'local') {
    return 'local';
  }
  return `commit:${String(entry.hash || '').trim()}:${String(entry.pathAtCommit || '').trim()}`;
}

function createEmptyHistoryState() {
  return {
    commits: [],
    error: '',
    hasMore: false,
    loaded: false,
    loading: false,
    loadingMore: false,
    offset: 0,
  };
}

export class FileHistoryViewController {
  constructor({
    diffRenderer = null,
    gitApiClient = null,
    onOpenCommitDiff = () => {},
    onOpenFile = () => {},
    onOpenPreview = () => {},
    onOpenWorkspaceDiff = () => {},
    toastController = null,
  } = {}) {
    this.diffRenderer = diffRenderer;
    this.gitApiClient = gitApiClient;
    this.onOpenCommitDiff = onOpenCommitDiff;
    this.onOpenFile = onOpenFile;
    this.onOpenPreview = onOpenPreview;
    this.onOpenWorkspaceDiff = onOpenWorkspaceDiff;
    this.toastController = toastController;
    this.page = document.getElementById('diff-page');
    this.content = document.getElementById('diffContent');
    this.fileIndicator = document.getElementById('diffFileIndicator');
    this.openEditorButton = document.getElementById('diffOpenEditorBtn');
    this.primaryActionButton = document.getElementById('diffPrimaryActionBtn');
    this.commitButton = document.getElementById('diffCommitBtn');
    this.backToHistoryButton = document.getElementById('diffBackToHistoryBtn');
    this.gitActionsGroup = document.getElementById('diffGitActionsGroup');
    this.editorActionsGroup = document.getElementById('diffEditorActionsGroup');
    this.actionsDivider = document.getElementById('diffToolbarDivider');
    this.stats = document.getElementById('diffStats');
    this.prevButton = document.getElementById('diffPrevBtn');
    this.nextButton = document.getElementById('diffNextBtn');
    this.layoutToggle = document.getElementById('diffLayoutToggle');
    this.modeButtons = Array.from(document.querySelectorAll('[data-diff-mode]'));
    this.isActive = false;
    this.currentFilePath = null;
    this.localChanges = null;
    this.history = createEmptyHistoryState();
    this.diffMode = 'unified';
    this.selectedEntryKey = null;
    this.detailCache = new Map();
    this.detailErrors = new Map();
    this.historyListElement = null;
    this.historyListScrollTop = 0;
    this.loadingEntryKey = null;
    this.selectionRequestToken = 0;
  }

  initialize() {
    this.openEditorButton?.addEventListener('click', () => {
      if (!this.isActive) {
        return;
      }
      if (!this.currentFilePath) {
        return;
      }

      this.onOpenFile?.(this.currentFilePath);
    });

    this.modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (!this.isActive) {
          return;
        }
        const nextMode = button.getAttribute('data-diff-mode');
        if (!nextMode || nextMode === this.diffMode) {
          return;
        }
        this.diffMode = nextMode;
        this.render();
      });
    });

    this.content?.addEventListener('click', (event) => {
      if (!this.isActive) {
        return;
      }
      const selectionButton = event.target instanceof Element
        ? event.target.closest('[data-file-history-select]')
        : null;
      if (selectionButton) {
        const nextEntry = this.findEntryByKey(selectionButton.getAttribute('data-file-history-select'));
        if (nextEntry) {
          void this.selectEntry(nextEntry);
        }
        return;
      }

      const openDiffButton = event.target instanceof Element
        ? event.target.closest('[data-file-history-open-selected-diff]')
        : null;
      if (openDiffButton) {
        this.openSelectedDiff();
        return;
      }

      const previewButton = event.target instanceof Element
        ? event.target.closest('[data-file-history-open-selected-preview]')
        : null;
      if (previewButton) {
        this.openSelectedPreview();
        return;
      }

      const loadMoreButton = event.target instanceof Element
        ? event.target.closest('[data-file-history-load-more]')
        : null;
      if (loadMoreButton) {
        void this.loadMore();
      }
    });
  }

  hide() {
    this.isActive = false;
    this.page?.classList.add('hidden');
    this.content?.classList.remove('diff-content--history');
    if (this.content) {
      this.content.innerHTML = '';
    }
    this.currentFilePath = null;
    this.localChanges = null;
    this.history = createEmptyHistoryState();
    this.selectedEntryKey = null;
    this.loadingEntryKey = null;
    this.detailCache.clear();
    this.detailErrors.clear();
    this.historyListElement = null;
    this.historyListScrollTop = 0;
    this.selectionRequestToken = 0;
  }

  getEntries() {
    const entries = [];
    if (this.localChanges) {
      entries.push({
        ...this.localChanges,
        key: 'local',
        label: t('file.localChanges'),
        pathAtCommit: this.currentFilePath,
        type: 'local',
      });
    }

    for (const commit of this.history.commits ?? []) {
      entries.push({
        ...commit,
        key: entryKey({ ...commit, type: 'commit' }),
        type: 'commit',
      });
    }

    return entries;
  }

  findEntryByKey(key) {
    return this.getEntries().find((entry) => entry.key === key) ?? null;
  }

  getSelectedEntry() {
    return this.findEntryByKey(this.selectedEntryKey);
  }

  getDefaultEntry() {
    const entries = this.getEntries();
    return entries[0] ?? null;
  }

  getSelectedDetailState() {
    const entry = this.getSelectedEntry();
    if (!entry) {
      return null;
    }

    return {
      detail: this.detailCache.get(entry.key) ?? null,
      entry,
      error: this.detailErrors.get(entry.key) ?? '',
      loading: this.loadingEntryKey === entry.key,
    };
  }

  ensureDeferredGitStyles() {
    this._deferredGitStylesPromise ??= import('../styles/deferred-git.css').catch(() => {});
    return this._deferredGitStylesPromise;
  }

  async openFileHistory({ filePath }) {
    void this.ensureDeferredGitStyles();
    this.isActive = true;
    this.currentFilePath = String(filePath ?? '').trim() || null;
    this.localChanges = null;
    this.history = {
      ...createEmptyHistoryState(),
      loading: true,
    };
    this.selectedEntryKey = null;
    this.loadingEntryKey = null;
    this.detailCache.clear();
    this.detailErrors.clear();
    this.historyListElement = null;
    this.historyListScrollTop = 0;
    this.selectionRequestToken = 0;
    this.renderLoading();

    try {
      const [localChanges, history] = await Promise.all([
        this.loadLocalChanges().catch(() => null),
        this.fetchHistoryPage({ offset: 0 }),
      ]);

      this.localChanges = localChanges;
      this.history = history;

      const initialEntry = this.getDefaultEntry();
      if (!initialEntry) {
        this.render();
        return {
          history,
          localChanges,
        };
      }

      await this.selectEntry(initialEntry);
      return {
        history,
        localChanges,
      };
    } catch (error) {
      console.error('[file-history] Failed to load file history:', error);
      this.toastController?.show(t('file.failedToLoadFileHistory'));
      this.localChanges = null;
      this.history = {
        ...createEmptyHistoryState(),
        error: t('file.failedToLoadFileHistory'),
        loaded: true,
      };
      this.render();
      return {
        history: this.history,
        localChanges: null,
      };
    }
  }

  async loadLocalChanges() {
    if (!this.currentFilePath) {
      return null;
    }

    const data = await this.gitApiClient.readDiff({
      metaOnly: true,
      path: this.currentFilePath,
      scope: 'all',
    });
    const file = data.files?.[0];
    if (!file) {
      return null;
    }

    return {
      ...file,
      summary: data.summary ?? {
        additions: Number(file.stats?.additions || 0),
        deletions: Number(file.stats?.deletions || 0),
        filesChanged: 1,
      },
    };
  }

  async fetchHistoryPage({ offset = 0 } = {}) {
    if (!this.currentFilePath) {
      return {
        ...createEmptyHistoryState(),
        loaded: true,
      };
    }

    const data = await this.gitApiClient.readFileHistory({
      limit: HISTORY_PAGE_SIZE,
      offset,
      path: this.currentFilePath,
    });
    const commits = Array.isArray(data.commits) ? data.commits : [];
    return {
      commits,
      error: '',
      hasMore: Boolean(data.hasMore),
      loaded: true,
      loading: false,
      loadingMore: false,
      offset: offset + commits.length,
    };
  }

  async loadSelectedDetail(entry) {
    if (!entry) {
      return null;
    }

    if (entry.type === 'local') {
      const data = await this.gitApiClient.readDiff({
        path: this.currentFilePath || '',
        scope: 'all',
      });
      return {
        detail: data.files?.[0] ?? null,
        summary: data.summary ?? entry.summary ?? null,
      };
    }

    const data = await this.gitApiClient.readCommit({
      hash: entry.hash || '',
      path: entry.pathAtCommit || '',
    });
    return {
      commit: data.commit ?? null,
      detail: data.files?.[0] ?? null,
      summary: data.summary ?? null,
    };
  }

  async selectEntry(entry) {
    if (!entry) {
      return null;
    }

    const key = entry.key || entryKey(entry);
    this.selectedEntryKey = key;
    this.detailErrors.delete(key);

    const cached = this.detailCache.get(key);
    if (cached) {
      this.loadingEntryKey = null;
      this.render();
      return cached;
    }

    this.loadingEntryKey = key;
    this.render();

    const requestToken = ++this.selectionRequestToken;
    try {
      const detail = await this.loadSelectedDetail(entry);
      this.detailCache.set(key, detail);
      this.detailErrors.delete(key);
      if (requestToken === this.selectionRequestToken && this.selectedEntryKey === key) {
        this.loadingEntryKey = null;
        this.render();
      }
      return detail;
    } catch (error) {
      console.error('[file-history] Failed to load selected diff:', error);
      this.toastController?.show(entry.type === 'local' ? t('file.failedToLoadLocalDiff') : t('file.failedToLoadCommitDiff'));
      this.detailErrors.set(key, entry.type === 'local' ? 'Failed to load local diff' : 'Failed to load commit diff');
      if (requestToken === this.selectionRequestToken && this.selectedEntryKey === key) {
        this.loadingEntryKey = null;
        this.render();
      }
      return null;
    }
  }

  async loadMore() {
    if (!this.currentFilePath || this.history.loading || this.history.loadingMore || !this.history.hasMore) {
      return;
    }

    this.history = {
      ...this.history,
      error: '',
      loadingMore: true,
    };
    this.render();

    try {
      const nextPage = await this.fetchHistoryPage({ offset: this.history.offset });
      this.history = {
        commits: [...this.history.commits, ...nextPage.commits],
        error: '',
        hasMore: nextPage.hasMore,
        loaded: true,
        loading: false,
        loadingMore: false,
        offset: nextPage.offset,
      };
      this.render();
    } catch (error) {
      console.error('[file-history] Failed to load more history:', error);
      this.toastController?.show(t('file.failedToLoadFileHistory'));
      this.history = {
        ...this.history,
        error: t('file.failedToLoadFileHistory'),
        loadingMore: false,
      };
      this.render();
    }
  }

  openSelectedDiff() {
    const entry = this.getSelectedEntry();
    if (!entry) {
      return;
    }

    if (entry.type === 'local') {
      this.onOpenWorkspaceDiff?.(this.currentFilePath);
      return;
    }

    this.onOpenCommitDiff?.(entry.hash, {
      historyFilePath: this.currentFilePath,
      path: entry.pathAtCommit,
    });
  }

  openSelectedPreview() {
    const entry = this.getSelectedEntry();
    if (!entry || entry.type !== 'commit') {
      return;
    }

    this.onOpenPreview?.({
      currentFilePath: this.currentFilePath,
      hash: entry.hash,
      path: entry.pathAtCommit,
    });
  }

  renderDiffFileHeader(file = {}) {
    if (typeof this.diffRenderer?.renderFileHeader === 'function') {
      return this.diffRenderer.renderFileHeader(file);
    }

    return `
      <div class="diff-file-header">
        <span class="diff-file-path">${escapeHtml(file.path || this.currentFilePath || '')}</span>
      </div>
    `;
  }

  renderDiffMarkup(file = {}) {
    if (typeof this.diffRenderer?.renderDiffDetail === 'function') {
      const previousMode = this.diffRenderer.mode;
      this.diffRenderer.mode = this.diffMode;
      const markup = this.diffRenderer.renderDiffDetail(file, 0, { includeHeader: true });
      this.diffRenderer.mode = previousMode;
      return markup;
    }

    return `
      ${this.renderDiffFileHeader(file)}
      <div class="diff-empty-state">${t('file.diffRendererUnavailable')}</div>
    `;
  }

  syncToolbar() {
    const selection = this.getSelectedDetailState();
    const selectedEntry = selection?.entry ?? null;
    const selectedSummary = selection?.detail?.summary
      ?? selectedEntry?.summary
      ?? (selectedEntry ? {
        additions: Number(selectedEntry.additions || 0),
        deletions: Number(selectedEntry.deletions || 0),
      } : null);
    const hasSelection = Boolean(selectedEntry);

    this.syncToolbarIndicators(selectedEntry, selectedSummary, hasSelection);
    this.syncToolbarButtonStates(hasSelection);
  }

  syncToolbarIndicators(selectedEntry, selectedSummary, hasSelection) {
    const additions = Number(selectedSummary?.additions || 0);
    const deletions = Number(selectedSummary?.deletions || 0);

    if (this.fileIndicator) {
      this.fileIndicator.textContent = selectedEntry?.type === 'commit'
        ? (selectedEntry.shortHash || t('file.commit'))
        : selectedEntry?.type === 'local'
          ? t('file.localChanges')
          : t('common.history');
    }

    if (this.stats) {
      // pi-lens-ignore: no-inner-html-js
      this.stats.innerHTML = `
        <span class="ui-stat-token ui-stat-token--add diff-stats-add">+${additions}</span>
        <span class="ui-stat-token ui-stat-token--del diff-stats-del">-${deletions}</span>
      `;
      this.stats.classList.toggle('hidden', !hasSelection);
    }
  }

  syncToolbarButtonStates(hasSelection) {
    this.backToHistoryButton?.classList.add('hidden');
    this.gitActionsGroup?.classList.add('hidden');
    this.layoutToggle?.classList.add('hidden');
    this.prevButton?.classList.add('hidden');
    this.nextButton?.classList.add('hidden');
    this.actionsDivider?.classList.add('hidden');
    this.editorActionsGroup?.classList.remove('hidden');
    this.modeButtons.forEach((button) => {
      const active = button.getAttribute('data-diff-mode') === this.diffMode;
      button.classList.toggle('hidden', !hasSelection);
      button.classList.toggle('active', active);
      button.setAttribute?.('aria-pressed', String(active));
    });
    this.openEditorButton?.toggleAttribute('disabled', !this.currentFilePath);
    if (this.openEditorButton) {
      this.openEditorButton.textContent = t('file.openFile');
    }
    this.primaryActionButton?.toggleAttribute('disabled', true);
    this.commitButton?.toggleAttribute('disabled', true);
  }

  renderLoading() {
    if (!this.isActive) {
      return;
    }
    this.page?.classList.remove('hidden');
    if (this.content) {
      this.content.classList.add('diff-content--history');
      this.content.innerHTML = '<div class="git-panel-empty" role="status" aria-live="polite">' + t('file.loadingFileHistory') + '</div>';
    }
    this.historyListElement = null;
    this.syncToolbar();
  }

  renderEmpty(message, { alert = false } = {}) {
    if (!this.isActive) {
      return;
    }
    this.page?.classList.remove('hidden');
    if (this.content) {
      this.content.classList.add('diff-content--history');
      // pi-lens-ignore: no-inner-html-js
      this.content.innerHTML = `<div class="git-panel-empty"${alert ? ' role="alert"' : ''}>${escapeHtml(message)}</div>`;
    }
    this.historyListElement = null;
    this.syncToolbar();
  }

  captureListScroll() {
    if (this.historyListElement) {
      this.historyListScrollTop = Number(this.historyListElement.scrollTop || 0);
    }
  }

  restoreListScroll() {
    if (!this.content?.querySelector) {
      this.historyListElement = null;
      return;
    }

    const listElement = this.content.querySelector('[data-file-history-list]');
    this.historyListElement = listElement ?? null;
    if (!listElement) {
      return;
    }

    listElement.scrollTop = this.historyListScrollTop;
    listElement.addEventListener('scroll', () => {
      this.historyListScrollTop = Number(listElement.scrollTop || 0);
    }, { passive: true });
  }

  renderScopeLabels(entry = {}) {
    const labels = [];
    if (entry.hasStagedChanges) {
      labels.push(t('file.staged'));
    }
    if (entry.hasWorkingTreeChanges) {
      labels.push(t('file.workingTree'));
    }
    if (entry.hasUntrackedChanges) {
      labels.push(t('file.untracked'));
    }
    return labels.length > 0 ? labels.join(' · ') : t('file.workingTree');
  }

  renderHistoryItem(entry = {}) {
    const isActive = entry.key === this.selectedEntryKey;
    const additions = Number(entry.additions ?? entry.summary?.additions ?? 0);
    const deletions = Number(entry.deletions ?? entry.summary?.deletions ?? 0);
    const kicker = entry.type === 'local' ? t('file.liveWorkspace') : renderCommitSubtitle(entry);
    const title = entry.type === 'local'
      ? t('file.localChanges')
      : (entry.subject || entry.shortHash || t('file.commit'));
    const badge = entry.type === 'local'
      ? `<span class="ui-pill-badge ui-pill-badge--accent file-history-item-badge">${t('file.live')}</span>`
      : `<span class="ui-pill-badge ui-pill-badge--code file-history-item-badge">${escapeHtml(entry.shortHash || '')}</span>`;

    return `
      <button
        class="ui-record-surface file-history-item${isActive ? ' active' : ''}${entry.type === 'local' ? ' file-history-item-local' : ''}"
        type="button"
        data-file-history-select="${escapeHtml(entry.key)}"
        aria-current="${isActive ? 'true' : 'false'}"
      >
        <span class="file-history-item-top">
          <span class="file-history-item-copy">
            <span class="file-history-item-title">${escapeHtml(title)}</span>
            <span class="file-history-item-meta">${entry.type === 'local' ? escapeHtml(this.renderScopeLabels(entry)) : kicker}</span>
          </span>
          ${badge}
        </span>
        <span class="file-history-item-stats">
          <span class="git-change-add">+${additions}</span>
          <span class="git-change-del">-${deletions}</span>
        </span>
      </button>
    `;
  }

  renderSelectedHeader(selection) {
    const entry = selection?.entry;
    if (!entry) {
      return `
        <div class="file-history-detail-header">
          <div class="file-history-detail-copy">
            <span class="file-history-detail-kicker">${t('common.history')}</span>
            <h2 class="file-history-detail-title">${t('file.noSelection')}</h2>
            <p class="file-history-detail-meta">${t('file.chooseAHistoryItemToInspectTheFileDiff')}</p>
          </div>
        </div>
      `;
    }

    const kicker = entry.type === 'local'
      ? t('file.liveWorkspace')
      : t('file.commitHash', { hash: escapeHtml(entry.shortHash || '') });
    const title = entry.type === 'local'
      ? t('file.localChanges')
      : escapeHtml(entry.subject || entry.shortHash || t('file.commit'));
    const meta = entry.type === 'local'
      ? escapeHtml(this.renderScopeLabels(entry))
      : renderCommitSubtitle(entry);

    return `
      <div class="file-history-detail-header">
        <div class="file-history-detail-copy">
          <span class="file-history-detail-kicker">${kicker}</span>
          <h2 class="file-history-detail-title">${title}</h2>
          <p class="file-history-detail-meta">${meta}</p>
        </div>
        <div class="file-history-detail-actions">
          <button
            class="${buttonClassNames({ variant: 'secondary', action: true, surface: true })}"
            type="button"
            data-file-history-open-selected-diff
          >
            ${t('file.openStandaloneDiff')}
          </button>
          ${entry.type === 'commit' ? `
            <button
              class="${buttonClassNames({ variant: 'primary', action: true })}"
              type="button"
              data-file-history-open-selected-preview
            >
              ${t('file.previewFile')}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderSelectedBody(selection) {
    const entry = selection?.entry;
    if (!entry) {
      return `<div class="diff-empty-state">${t('file.selectAHistoryEntryToInspectThisFile')}</div>`;
    }

    if (selection.loading) {
      return `
        <section class="diff-file-block file-history-diff-block">
          <div class="diff-file-header">
            <span class="diff-file-path">${escapeHtml(entry.pathAtCommit || this.currentFilePath || '')}</span>
          </div>
          <div class="diff-empty-state" role="status" aria-live="polite">${t('file.loadingDiff')}</div>
        </section>
      `;
    }

    if (selection.error) {
      return `
        <section class="diff-file-block file-history-diff-block">
          ${this.renderDiffFileHeader({ path: entry.pathAtCommit || this.currentFilePath || '' })}
          <div class="diff-empty-state" role="alert">${escapeHtml(selection.error)}</div>
        </section>
      `;
    }

    if (!selection.detail?.detail) {
      return `<div class="diff-empty-state">${t('file.noDiffAvailableForThisHistoryItem')}</div>`;
    }

    return `
      <section class="diff-file-block file-history-diff-block">
        ${this.renderDiffMarkup(selection.detail.detail)}
      </section>
    `;
  }

  render() {
    if (!this.isActive) {
      return;
    }
    this.page?.classList.remove('hidden');
    this.captureListScroll();
    this.syncToolbar();

    if (!this.currentFilePath) {
      this.renderEmpty(t('file.noFileSelected'));
      return;
    }

    if (this.history.loading && !this.history.loaded) {
      this.renderLoading();
      return;
    }

    const hasRows = Boolean(this.localChanges) || (this.history.commits?.length ?? 0) > 0;
    if (!hasRows) {
      this.renderEmpty(this.history.error || t('file.noHistoryFoundForThisFile'), { alert: Boolean(this.history.error) });
      return;
    }

    if (!this.content) {
      return;
    }

    this.content.classList.add('diff-content--history');
    const selection = this.getSelectedDetailState();
    // pi-lens-ignore: no-inner-html-js
    this.content.innerHTML = `
      <section class="file-history-shell">
        <aside class="file-history-sidebar" aria-label="${t('file.fileHistoryEntries')}">
          <header class="file-history-sidebar-header">
            <span class="file-history-kicker">${t('file.fileHistory')}</span>
            <div class="file-history-title">${renderHistoryTitle(this.currentFilePath)}</div>
            <p class="file-history-sidebar-copy">${t('file.selectAnEntryToInspectTheExactChangesForThisFile')}</p>
          </header>
          <div class="file-history-list" data-file-history-list>
            ${this.getEntries().map((entry) => this.renderHistoryItem(entry)).join('')}
          </div>
          ${this.history.hasMore ? `
            <div class="git-history-footer file-history-footer">
              <button
                class="${buttonClassNames({ variant: 'secondary', size: 'compact', action: true, surface: true, extra: 'git-history-load-more' })}"
                type="button"
                data-file-history-load-more
                ${this.history.loadingMore ? 'disabled' : ''}
              >
                ${this.history.loadingMore ? t('file.loading') : t('file.loadMore')}
              </button>
            </div>
          ` : ''}
        </aside>
        <section class="file-history-detail">
          ${this.renderSelectedHeader(selection)}
          <div class="file-history-detail-body">
            ${this.renderSelectedBody(selection)}
          </div>
        </section>
      </section>
    `;
    this.restoreListScroll();
  }
}
