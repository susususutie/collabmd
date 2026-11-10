import { t } from '../i18n/index.js';

const ICONS = Object.freeze({
  bold: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M7 5h6a4 4 0 0 1 0 8H7z"/>
      <path d="M7 13h7a4 4 0 0 1 0 8H7z"/>
    </svg>
  `,
  italic: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M14 4h6"/>
      <path d="M4 20h6"/>
      <path d="M14 4 10 20"/>
    </svg>
  `,
  strikethrough: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M6 6.5c1.4-1.2 3.2-1.9 5.4-1.9 3.1 0 5.6 1.4 5.6 3.9 0 2.1-1.7 3-4.3 3.5l-2.4.5c-2.7.5-4.3 1.6-4.3 3.6 0 2.7 2.7 4.2 6 4.2 2.1 0 4.2-.6 5.7-1.8"/>
      <path d="M3 12h18"/>
    </svg>
  `,
  link: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l2.92-2.92a5 5 0 0 0-7.07-7.07L11.5 5.4"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54L3.54 13.38a5 5 0 1 0 7.07 7.07L12.5 18.6"/>
    </svg>
  `,
  image: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <circle cx="9" cy="10" r="1.5"/>
      <path d="m21 16-5.5-5.5L7 19"/>
    </svg>
  `,
  video: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none"/>
    </svg>
  `,
  table: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1"/>
      <path d="M3 10h18"/>
      <path d="M9 5v14"/>
      <path d="M15 5v14"/>
    </svg>
  `,
  code: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m8 9-4 3 4 3"/>
      <path d="m16 9 4 3-4 3"/>
      <path d="m13 6-2 12"/>
    </svg>
  `,
  horizontalRule: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 12h16"/>
      <path d="M9 8h6"/>
      <path d="M9 16h6"/>
    </svg>
  `,
  indent: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 6h16"/>
      <path d="M10 12h10"/>
      <path d="M10 18h10"/>
      <path d="m4 9 4 3-4 3"/>
    </svg>
  `,
  outdent: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 6h16"/>
      <path d="M10 12h10"/>
      <path d="M10 18h10"/>
      <path d="m8 9-4 3 4 3"/>
    </svg>
  `,
  redo: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 7v6h-6"/>
      <path d="M20 13a8 8 0 0 0-14-3"/>
    </svg>
  `,
  undo: `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 7v6h6"/>
      <path d="M4 13a8 8 0 0 1 14-3"/>
    </svg>
  `,
  chevronDown: `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  `,
});

const BLOCK_MENU_ACTIONS = Object.freeze([
  {
    action: 'paragraph',
    label: t('editor.paragraph'),
    shortLabel: 'P',
    title: t('editor.paragraph'),
  },
  {
    action: 'heading-1',
    label: t('editor.heading1'),
    shortLabel: 'H1',
    title: t('editor.heading1'),
  },
  {
    action: 'heading-2',
    label: t('editor.heading2'),
    shortLabel: 'H2',
    title: t('editor.heading2'),
  },
  {
    action: 'heading-3',
    label: t('editor.heading3'),
    shortLabel: 'H3',
    title: t('editor.heading3'),
  },
  {
    action: 'heading-4',
    label: t('editor.heading4'),
    shortLabel: 'H4',
    title: t('editor.heading4'),
  },
  {
    action: 'heading-5',
    label: t('editor.heading5'),
    shortLabel: 'H5',
    title: t('editor.heading5'),
  },
  {
    action: 'heading-6',
    label: t('editor.heading6'),
    shortLabel: 'H6',
    title: t('editor.heading6'),
  },
  {
    action: 'quote',
    label: t('editor.quote'),
    shortLabel: 'Quote',
    title: t('editor.blockQuote'),
  },
  {
    action: 'bullet-list',
    label: t('editor.bulletList'),
    shortLabel: 'List',
    title: t('editor.bulletList'),
  },
  {
    action: 'numbered-list',
    label: t('editor.numberedList'),
    shortLabel: '1.',
    title: t('editor.numberedList'),
  },
  {
    action: 'task-list',
    label: t('editor.taskList'),
    shortLabel: 'Task',
    title: t('editor.taskList'),
  },
  {
    action: 'code-block',
    label: t('editor.codeBlock'),
    shortLabel: 'Code',
    title: t('editor.codeBlock'),
  },
]);

const INLINE_ACTIONS = Object.freeze([
  { action: 'bold', label: t('editor.bold'), title: t('editor.bold'), icon: ICONS.bold },
  { action: 'italic', label: t('editor.italic'), title: t('editor.italic'), icon: ICONS.italic },
  { action: 'strikethrough', label: t('editor.strikethrough'), title: t('editor.strikethrough'), icon: ICONS.strikethrough },
  { action: 'code', label: t('editor.inlineCode'), title: t('editor.inlineCode'), icon: ICONS.code },
]);

const MOBILE_EDIT_COMMANDS = Object.freeze([
  { commandId: 'undo', label: t('common.undo'), title: t('common.undo'), icon: ICONS.undo },
  { commandId: 'redo', label: t('common.redo'), title: t('common.redo'), icon: ICONS.redo },
  { commandId: 'indentMore', label: t('editor.indent'), title: t('editor.indent'), icon: ICONS.indent },
  { commandId: 'indentLess', label: t('editor.outdent'), title: t('editor.outdent'), icon: ICONS.outdent },
]);

const MEDIA_ACTIONS = Object.freeze([
  { action: 'link', label: t('editor.insertLink'), title: t('editor.insertLink'), icon: ICONS.link },
  { action: 'image', label: t('editor.insertImage'), title: t('editor.insertImage'), icon: ICONS.image },
  { action: 'video', label: t('editor.insertVideo'), title: t('editor.insertVideo'), icon: ICONS.video },
]);

const INSERT_ACTIONS = Object.freeze([
  { action: 'table', label: t('editor.insertTable'), title: t('editor.insertTable'), icon: ICONS.table },
  { action: 'horizontal-rule', label: t('editor.insertHorizontalRule'), title: t('editor.insertHorizontalRule'), icon: ICONS.horizontalRule },
]);

export const markdownToolbarLayout = Object.freeze([
  { kind: 'buttons', groupLabel: t('common.edit'), actions: MOBILE_EDIT_COMMANDS, mobileOnly: true },
  { kind: 'block-menu', actions: BLOCK_MENU_ACTIONS },
  { kind: 'buttons', groupLabel: t('editor.inlineFormatting'), actions: INLINE_ACTIONS },
  { kind: 'buttons', groupLabel: t('editor.mediaAndLinks'), actions: MEDIA_ACTIONS },
  { kind: 'buttons', groupLabel: t('editor.insert'), actions: INSERT_ACTIONS },
]);

const ACTIONS = [...BLOCK_MENU_ACTIONS, ...INLINE_ACTIONS, ...MEDIA_ACTIONS, ...INSERT_ACTIONS];

const ACTIONS_BY_ID = new Map(ACTIONS.map((action) => [action.action, action]));

export function getMarkdownToolbarAction(action) {
  return ACTIONS_BY_ID.get(action) ?? null;
}

export function getMarkdownBlockMenuActions() {
  return BLOCK_MENU_ACTIONS;
}

export function isMarkdownBlockAction(action) {
  return BLOCK_MENU_ACTIONS.some((item) => item.action === action);
}

export function getMarkdownBlockActionLabel(action) {
  return getMarkdownToolbarAction(action)?.shortLabel ?? 'P';
}

export function getMarkdownToolbarIcons() {
  return ICONS;
}
