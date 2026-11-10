import { t } from '../../i18n/index.js';
import { isMarkdownFilePath } from '../../../domain/file-kind.js';
import { exportDirectory, exportDocument, initializeExportBridge } from '../../export/export-host.js';

export const exportFeature = {
  initializeExportBridge() {
    if (this._exportBridgeInitialized) {
      return;
    }

    initializeExportBridge({
      onError: (message) => {
        this.toastController?.show(message);
      },
    });
    this._exportBridgeInitialized = true;
  },

  async handleDirectoryExportRequest(directoryPath, format) {
    try {
      await exportDirectory({
        currentFilePath: this.currentFilePath,
        currentMarkdownText: this.session?.getText?.() ?? '',
        directoryPath,
        fileList: this.fileExplorer?.flatDocumentFiles ?? [],
        format,
      });
      return true;
    } catch (error) {
      this.toastController?.show(error instanceof Error ? error.message : t('export.failedToStartFolderExport'));
      return false;
    }
  },

  async handleExportRequest(format) {
    const filePath = String(this.currentFilePath ?? '').trim();
    if (!isMarkdownFilePath(filePath)) {
      this.toastController?.show(t('export.exportIsAvailableForMarkdownNotesOnly'));
      return false;
    }

    try {
      await exportDocument({
        fileList: this.fileExplorer?.flatDocumentFiles ?? [],
        filePath,
        format,
        markdownText: this.session?.getText?.() ?? '',
        title: this.getDisplayName(filePath),
      });
      return true;
    } catch (error) {
      this.toastController?.show(error instanceof Error ? error.message : t('export.failedToStartExport'));
      return false;
    }
  },
};
