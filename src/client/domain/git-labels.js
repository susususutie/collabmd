import { t } from '../i18n/index.js';

export function commitButtonLabel(count) {
  if (count > 0) {
    return t('git.commitFiles', {
      files: t('git.file', { count }),
    });
  }

  return t('git.commitIncludedFiles');
}

// shortcut: relative labels use a fixed unit ladder matching the server, upgrade if a precise date is needed
export function formatRelativeDateLabel(value) {
  const timestamp = Date.parse(String(value ?? ''));
  if (!Number.isFinite(timestamp)) {
    return '';
  }

  const diffMs = Date.now() - timestamp;
  const absDiffMs = Math.abs(diffMs);
  if (absDiffMs < 60_000) {
    return t('git.justNow');
  }

  const units = [
    { divisor: 365 * 24 * 60 * 60 * 1000, label: t('git.y') },
    { divisor: 30 * 24 * 60 * 60 * 1000, label: t('git.mo') },
    { divisor: 7 * 24 * 60 * 60 * 1000, label: t('git.w') },
    { divisor: 24 * 60 * 60 * 1000, label: t('git.d') },
    { divisor: 60 * 60 * 1000, label: t('git.h') },
    { divisor: 60 * 1000, label: t('git.m') },
  ];

  for (const unit of units) {
    if (absDiffMs >= unit.divisor) {
      const amount = Math.round(absDiffMs / unit.divisor);
      return diffMs >= 0 ? t('git.amountLabelAgo', { amount, label: unit.label }) : t('git.inAmountLabel', { amount, label: unit.label });
    }
  }

  return t('git.justNow');
}
