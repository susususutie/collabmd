import {
  postExportPageMessage,
  prepareDirectoryExportSnapshot,
  prepareExportSnapshot,
  runExportAdapter,
  waitForBootstrapPayload,
  waitForRenderedExportContent,
} from './export-pipeline.js';
import { t, initializeI18n, applyDocumentLocale, localizeDocument } from '../i18n/index.js';
import { groupHeadingWithFollowingBlock } from './export-print-layout.js';

initializeI18n();
applyDocumentLocale();
localizeDocument();

function getExportJobId() {
  return new URLSearchParams(window.location.search).get('job') || window.name || '';
}

function setStatus(message) {
  const status = document.getElementById('exportStatus');
  if (status) {
    status.textContent = message;
  }
}

function renderWarnings(snapshot) {
  const warningsList = document.getElementById('exportWarnings');
  const warningsSection = document.getElementById('exportWarningsSection');
  if (!warningsList || !warningsSection) {
    return;
  }

  warningsList.replaceChildren();
  const warnings = snapshot.warnings ?? [];
  warningsSection.hidden = warnings.length === 0;
  warnings.forEach((warning) => {
    const item = document.createElement('li');
    item.textContent = warning;
    warningsList.appendChild(item);
  });
}

function renderSnapshot(snapshot) {
  const mount = document.getElementById('exportContent');
  if (!mount) {
    return null;
  }

  document.title = t('export.titleExport', { title: snapshot.title });
  const parsed = new DOMParser().parseFromString(`<body>${snapshot.html}</body>`, 'text/html');
  mount.replaceChildren(...parsed.body.childNodes);
  groupHeadingWithFollowingBlock(mount);
  renderWarnings(snapshot);
  return mount;
}

async function bootstrap() {
  try {
    setStatus(t('export.loadingExportContent'));
    const payload = await waitForBootstrapPayload();
    document.documentElement.dataset.theme = payload.theme;
    document.body.dataset.theme = payload.theme;
    const snapshot = payload.directoryPath
      ? await prepareDirectoryExportSnapshot(payload)
      : await prepareExportSnapshot(payload);
    const mount = renderSnapshot(snapshot);
    snapshot.html = await waitForRenderedExportContent(mount);
    setStatus(payload.action === 'pdf'
      ? t('export.openingPrintDialog')
      : t('export.preparingFormatDownload', { format: payload.action.toUpperCase() }));
    await runExportAdapter(snapshot, payload.action);
    setStatus(payload.action === 'pdf'
      ? t('export.printDialogOpened')
      : t('export.formatDownloadStarted', { format: payload.action.toUpperCase() }));
    postExportPageMessage('complete', { jobId: getExportJobId() });
  } catch (error) {
    const message = error instanceof Error ? error.message : t('export.exportFailed');
    setStatus(message);
    postExportPageMessage('error', {
      jobId: getExportJobId(),
      message,
    });
  }
}

void bootstrap();
