import { stripVaultFileExtension } from '../../domain/file-kind.js';
import { getLocale, t } from '../i18n/index.js';
import { getVaultPathLeaf, getVaultPathParent } from '../domain/vault-paths.js';
import {
  createCommentOverviewThread,
  formatAnchorLabel,
} from './comment-ui/comment-ui-shared.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function createOverviewState({ copy, title, tone = '' }) {
  const state = document.createElement('div');
  state.className = 'comment-overview-empty ui-empty-state ui-empty-state--compact';
  if (tone) {
    state.dataset.tone = tone;
  }

  const heading = document.createElement('p');
  heading.className = 'ui-empty-state-title';
  heading.textContent = title;

  const description = document.createElement('p');
  description.className = 'ui-empty-state-copy';
  description.textContent = copy;

  state.append(heading, description);
  return state;
}

export class CommentOverviewController {
  constructor({
    panelElement,
    toastController = null,
    vaultApiClient,
    onOverviewChange = null,
    onThreadSelect = null,
  }) {
    this.panel = panelElement;
    this.toastController = toastController;
    this.vaultApiClient = vaultApiClient;
    this.onOverviewChange = onOverviewChange;
    this.onThreadSelect = onThreadSelect;
    this.overview = { files: [], generatedAt: 0, totalThreadCount: 0 };
    this.loading = false;
    this.errorMessage = '';
    this.refreshPromise = null;
    this.timeFormatter = new Intl.DateTimeFormat(getLocale(), {
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
    });
  }

  initialize() {
    this.render();
  }

  getThreadCounts() {
    return new Map(
      asArray(this.overview.files).map((file) => [file.filePath, Number(file.threadCount || 0)]),
    );
  }

  async refresh() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.loading = true;
    this.render();
    this.refreshPromise = (async () => {
      try {
        const payload = await this.vaultApiClient.readCommentOverview();
        this.errorMessage = '';
        this.setOverview(payload?.overview ?? payload ?? {}, { render: false });
      } catch (error) {
        console.error('[comments] Failed to load comment overview:', error.message);
        this.errorMessage = t('comment.unableToLoadOpenComments');
        this.toastController?.show?.(t('comment.failedToLoadComments'));
      } finally {
        this.loading = false;
        this.refreshPromise = null;
        this.render();
      }
    })();

    return this.refreshPromise;
  }

  setOverview(overview = {}, { render = true } = {}) {
    this.errorMessage = '';
    this.overview = {
      files: asArray(overview.files),
      generatedAt: Number(overview.generatedAt || 0),
      totalThreadCount: Number(overview.totalThreadCount || 0),
    };
    this.onOverviewChange?.(this.overview, {
      threadCounts: this.getThreadCounts(),
    });
    if (render) {
      this.render();
    }
  }

  render() {
    if (!this.panel || this.panel.classList.contains('hidden')) {
      return;
    }

    this.panel.replaceChildren();
    if (this.errorMessage) {
      const error = createOverviewState({
        copy: this.errorMessage,
        title: t('comment.commentsUnavailable'),
        tone: 'error',
      });
      error.setAttribute('role', 'alert');
      this.panel.appendChild(error);
      return;
    }

    if (this.loading && asArray(this.overview.files).length === 0) {
      const loading = createOverviewState({
        copy: t('comment.checkingTheVaultForActiveThreads'),
        title: t('comment.loadingComments'),
      });
      loading.setAttribute('role', 'status');
      this.panel.appendChild(loading);
      return;
    }

    const files = asArray(this.overview.files);
    if (files.length === 0) {
      const empty = createOverviewState({
        copy: t('comment.openCommentsFromAnyDocumentWillAppearHere'),
        title: t('comment.youReAllCaughtUp'),
      });
      this.panel.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    files.forEach((file) => {
      fragment.appendChild(this.createFileGroup(file));
    });
    this.panel.appendChild(fragment);
  }

  createFileGroup(file) {
    const section = document.createElement('section');
    section.className = 'comment-overview-file';

    const header = document.createElement('div');
    header.className = 'comment-overview-file-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'comment-overview-file-title-wrap';

    const title = document.createElement('h3');
    title.className = 'comment-overview-file-title';
    title.textContent = stripVaultFileExtension(getVaultPathLeaf(file.filePath));

    const parent = document.createElement('span');
    parent.className = 'comment-overview-file-path';
    parent.textContent = getVaultPathParent(file.filePath) || file.filePath;

    const count = document.createElement('span');
    count.className = 'comment-overview-file-count';
    count.textContent = String(file.threadCount || asArray(file.threads).length);

    titleWrap.append(title, parent);
    header.append(titleWrap, count);
    section.appendChild(header);

    asArray(file.threads).forEach((thread) => {
      section.appendChild(this.createThreadButton(file.filePath, thread));
    });

    return section;
  }

  createThreadButton(filePath, thread) {
    const messageCount = Number(thread.messageCount || 0);
    const button = createCommentOverviewThread({
      authorName: thread.latestMessage?.userName || thread.createdByName || t('comment.anonymous'),
      lineLabel: formatAnchorLabel(thread.anchor),
      messageCount,
      previewBody: thread.latestMessage?.bodyPreview || '',
      quote: thread.anchor?.quote || t('comment.sourceAnchoredComment'),
      timestamp: this.formatTimestamp(thread.latestActivityAt),
    });
    button.addEventListener('click', () => {
      this.onThreadSelect?.({
        anchor: thread.anchor,
        filePath,
        threadId: thread.id,
      });
    });
    return button;
  }

  formatTimestamp(value) {
    if (!Number.isFinite(value)) {
      return '';
    }

    try {
      return this.timeFormatter.format(new Date(value));
    } catch {
      return '';
    }
  }
}
