import { USER_NAME_MAX_LENGTH, normalizeUserName } from '../../domain/room.js';
import { t } from '../../i18n/index.js';

/**
 * @typedef {object} UiIdentityContext
 * @property {boolean} isTabActive
 * @property {boolean} _hasPromptedForDisplayName
 * @property {{ currentUserName?: HTMLElement | null, displayNameDialog?: HTMLDialogElement | HTMLElement | null, displayNameInput?: HTMLInputElement | null, displayNameTitle?: HTMLElement | null, displayNameCopy?: HTMLElement | null, displayNameCancel?: HTMLElement | null, displayNameSubmit?: HTMLElement | null, editNameButton?: HTMLElement | null }} elements
 * @property {{ getUserName(): string, setUserName(name: string): void }} preferences
 * @property {{ getLocalUser(): { name?: string } | null, setUserName(name: string): void }} lobby
 * @property {{ getLocalUser(): { name?: string } | null, setUserName(name: string): string } | null} session
 * @property {{ updateLocalUser(user: unknown): void } | null | undefined} drawioEmbed
 * @property {{ updateLocalUser(user: unknown): void } | null | undefined} excalidrawEmbed
 * @property {{ show(message: string): void }} toastController
 * @property {() => boolean} isIdentityManagedByAuth
 * @property {() => { name?: string } | null} getCurrentUser
 * @property {() => string} getCurrentUserName
 * @property {() => string} getStoredUserName
 * @property {() => void} renderChat
 * @property {() => void} syncCurrentUserName
 */

/** @this {UiIdentityContext} */
function isIdentityManagedByAuth() {
  return this.runtimeConfig?.auth?.strategy === 'oidc'
    && this.runtimeConfig?.auth?.provider === 'google';
}

/** @this {UiIdentityContext} */
function openDisplayNameDialog({ mode = 'edit' } = {}) {
  if (this.isIdentityManagedByAuth()) {
    return;
  }

  if (!this.isTabActive) {
    return;
  }

  const dialog = this.elements.displayNameDialog;
  const input = this.elements.displayNameInput;
  const title = this.elements.displayNameTitle;
  const copy = this.elements.displayNameCopy;
  const cancel = this.elements.displayNameCancel;
  const submit = this.elements.displayNameSubmit;
  if (!dialog || !input) return;

  const isOnboarding = mode === 'onboarding';
  this._displayNameDialogMode = mode;
  if (title) {
    title.textContent = isOnboarding ? t('app.chooseYourDisplayName') : t('app.updateDisplayName');
  }
  if (copy) {
    copy.textContent = isOnboarding
      ? t('app.pickANameCollaboratorsWillSeeYouCanSkipForNowAnd')
      : t('app.yourNameWillBeVisibleToEveryoneEditingThisVault');
  }
  if (cancel) {
    cancel.textContent = isOnboarding ? t('app.skipForNow') : t('common.cancel');
  }
  if (submit) {
    submit.textContent = isOnboarding ? t('common.continue') : t('app.saveName');
  }

  input.value = isOnboarding ? '' : this.getCurrentUserName();
  if (dialog.open) {
    return;
  }
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', 'true');
  }
  requestAnimationFrame(() => { input.focus(); input.select(); });
}

/** @this {UiIdentityContext} */
function promptForDisplayNameIfNeeded() {
  if (
    !this.isTabActive
    || this._hasPromptedForDisplayName
    || this.getStoredUserName()
    || this.isIdentityManagedByAuth()
  ) {
    return;
  }

  this._hasPromptedForDisplayName = true;
  requestAnimationFrame(() => {
    this.openDisplayNameDialog({ mode: 'onboarding' });
  });
}

/** @this {UiIdentityContext} */
function handleDisplayNameCancel() {
  if (this._displayNameDialogMode === 'onboarding' && !this.getStoredUserName()) {
    const guestName = this.getCurrentUserName();
    if (guestName) {
      this.preferences.setUserName(guestName);
    }
  }
  this.elements.displayNameDialog?.close();
}

/** @this {UiIdentityContext} */
function handleDisplayNameSubmit() {
  if (this.isIdentityManagedByAuth()) {
    return;
  }

  const input = this.elements.displayNameInput;
  const dialog = this.elements.displayNameDialog;
  if (!input || !dialog) return;

  const normalizedName = this.session
    ? this.session.setUserName(input.value)
    : normalizeUserName(input.value);
  if (!normalizedName) {
    input.focus();
    this.toastController.show(t('app.nameMustBe1MaxCharacters', { max: USER_NAME_MAX_LENGTH }));
    return;
  }

  this.preferences.setUserName(normalizedName);
  this.lobby.setUserName(normalizedName);
  const localUser = this.lobby.getLocalUser();
  this.drawioEmbed?.updateLocalUser(localUser);
  this.excalidrawEmbed?.updateLocalUser(localUser);
  this.canvasEmbed?.updateLocalUser(localUser);
  this.syncCurrentUserName();
  this.renderChat();
  dialog.close();
}

/** @this {UiIdentityContext} */
function getCurrentUser() {
  return this.globalUsers.find((u) => u.isLocal)
    ?? this.session?.getLocalUser()
    ?? this.lobby?.getLocalUser()
    ?? null;
}

/** @this {UiIdentityContext} */
function getCurrentUserName() {
  return this.getCurrentUser()?.name ?? this.getStoredUserName() ?? '';
}

/** @this {UiIdentityContext} */
function getStoredUserName() {
  return this.preferences.getUserName();
}

/** @this {UiIdentityContext} */
function syncCurrentUserName() {
  const el = this.elements.currentUserName;
  if (!el) return;
  const name = this.getCurrentUserName();
  el.textContent = name || t('app.setName');
  el.classList.toggle('has-name', Boolean(name));
  if (!this.isIdentityManagedByAuth()) {
    this.elements.editNameButton?.setAttribute(
      'aria-label',
      t('app.nameChangeDisplayName', { name: name || t('app.setName') }),
    );
  }
}

/** @this {UiIdentityContext} */
function syncIdentityManagementUi() {
  const isManaged = this.isIdentityManagedByAuth();
  this.elements.editNameButton?.classList.toggle('hidden', isManaged);
  this.elements.editNameButton?.toggleAttribute('disabled', isManaged);
  if (isManaged && this.elements.displayNameDialog?.open) {
    this.elements.displayNameDialog.close();
  }
}

export const uiFeatureIdentityMethods = {
  getCurrentUser,
  getCurrentUserName,
  getStoredUserName,
  handleDisplayNameCancel,
  handleDisplayNameSubmit,
  isIdentityManagedByAuth,
  openDisplayNameDialog,
  promptForDisplayNameIfNeeded,
  syncCurrentUserName,
  syncIdentityManagementUi,
};
