import { createFragment, escapeHtml } from '../domain/vault-utils.js';
import { t } from '../i18n/index.js';

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function roleOptions(currentRole) {
  return ['collaborator', 'admin'].map((role) => (
    `<option value="${role}"${role === currentRole ? ' selected' : ''}>${role === 'admin' ? t('common.admin') : t('team.collaborator')}</option>`
  )).join('');
}

function auditEventsMarkup(events) {
  return events.map((event) => `
    <li class="team-settings-row team-settings-row--audit">
      <div class="team-settings-row-main">
        <strong>${escapeHtml(event.type)}</strong>
        <span>${escapeHtml(event.targetEmail || '')}${event.targetRole ? ` · ${escapeHtml(event.targetRole)}` : ''}</span>
        <small>${t('team.byActorDate', { actor: escapeHtml(event.actorName || event.actorEmail), date: formatDate(event.createdAt) })}</small>
      </div>
    </li>`).join('');
}

export class TeamSettingsController {
  constructor({ apiClient, closeToolbarMenu, content, dialog, toastController, trigger }) {
    this.apiClient = apiClient;
    this.closeToolbarMenu = closeToolbarMenu;
    this.content = content;
    this.dialog = dialog;
    this.toastController = toastController;
    this.trigger = trigger;
    this.trigger?.classList.add('hidden');
    this.trigger?.addEventListener('click', () => void this.open());
    this.dialog?.addEventListener('close', () => {
      this.content?.replaceChildren();
      this.trigger?.focus?.();
    });
    this.dialog?.addEventListener('click', (event) => void this.handleClick(event));
    this.dialog?.addEventListener('submit', (event) => void this.handleSubmit(event));
    this.dialog?.addEventListener('change', (event) => void this.handleChange(event));
  }

  setTriggerVisible(visible) {
    this.trigger?.classList.toggle('hidden', !visible);
  }

  async open() {
    this.closeToolbarMenu?.();
    this.dialog?.showModal?.();
    this.renderStatus(t('team.loadingTeamSettings'));
    await this.refresh();
  }

  async loadOverview() {
    const [membershipsResult, invitationsResult, auditResult] = await Promise.all([
      this.apiClient.listMemberships(),
      this.apiClient.listInvitations(),
      this.apiClient.listAuditEvents(),
    ]);
    this.renderOverview({
      auditEvents: auditResult.events ?? [],
      invitations: invitationsResult.invitations ?? [],
      memberships: membershipsResult.memberships ?? [],
      nextAuditCursor: auditResult.nextCursor ?? null,
    });
  }

  renderStatus(message, { error = false } = {}) {
    if (!this.content) return;
    this.content.replaceChildren(createFragment(`<p class="team-settings-status${error ? ' is-error' : ''}" role="status">${escapeHtml(message)}</p>`));
  }

  renderOverview({ auditEvents = [], invitations = [], memberships = [], nextAuditCursor = null }) {
    if (!this.content) return;
    const memberMarkup = memberships.length > 0
      ? memberships.map((membership) => `
        <li class="team-settings-row">
          <div class="team-settings-row-main">
            <strong>${escapeHtml(membership.name || membership.email)}</strong>
            <span>${escapeHtml(membership.email)}</span>
            <small>${t('team.joinedDate', { date: formatDate(membership.joinedAt) })}</small>
          </div>
          <label class="team-settings-row-role">${t('team.role')}
            <select class="ui-input ui-input--compact" data-membership-role="${escapeHtml(membership.id)}">
              ${roleOptions(membership.role)}
            </select>
          </label>
          <button class="ui-button ui-button--secondary ui-button--compact" type="button" data-membership-remove="${escapeHtml(membership.id)}" data-membership-email="${escapeHtml(membership.email)}">${t('common.remove')}</button>
        </li>`).join('')
      : `<p class="team-settings-empty">${t('team.noCollaboratorsYet')}</p>`;
    const invitationMarkup = invitations.length > 0
      ? invitations.map((invitation) => `
        <li class="team-settings-row">
          <div class="team-settings-row-main">
            <strong>${escapeHtml(invitation.email)}</strong>
            <span>${t('team.invitedByName', { name: escapeHtml(invitation.invitedByName || invitation.invitedByEmail) })}</span>
            <small>${t('team.expiresDate', { date: formatDate(invitation.expiresAt) })}</small>
          </div>
          <label class="team-settings-row-role">${t('team.role')}
            <select class="ui-input ui-input--compact" data-invitation-role="${escapeHtml(invitation.id)}">
              ${roleOptions(invitation.role)}
            </select>
          </label>
          <button class="ui-button ui-button--secondary ui-button--compact" type="button" data-invitation-revoke="${escapeHtml(invitation.id)}" data-invitation-email="${escapeHtml(invitation.email)}">${t('team.revoke')}</button>
        </li>`).join('')
      : `<p class="team-settings-empty">${t('team.noPendingInvitations')}</p>`;
    const auditMarkup = auditEvents.length > 0
      ? auditEventsMarkup(auditEvents)
      : `<p class="team-settings-empty">${t('team.noAccessHistoryYet')}</p>`;
    this.content.replaceChildren(createFragment(`
      <section class="team-settings-section">
        <h3>${t('team.collaborators')}</h3>
        <ul class="team-settings-list">${memberMarkup}</ul>
      </section>
      <section class="team-settings-section">
        <h3>${t('team.pendingInvitations')}</h3>
        <ul class="team-settings-list">${invitationMarkup}</ul>
        <form class="team-settings-invite-form" data-invite-form>
          <label class="app-dialog-field">
            <span class="app-dialog-label">${t('common.email')}</span>
            <input class="ui-input" name="email" type="email" maxlength="254" autocomplete="off" spellcheck="false" required placeholder="teammate@example.com">
          </label>
          <label class="app-dialog-field">
            <span class="app-dialog-label">${t('team.role')}</span>
            <select class="ui-input" name="role">
              <option value="collaborator">${t('team.collaborator')}</option>
              <option value="admin">${t('common.admin')}</option>
            </select>
          </label>
          <button class="ui-button ui-button--primary" type="submit">${t('team.invite')}</button>
        </form>
        <p class="team-settings-note">${t('team.shareThisWorkspaceUrlWithTheInvitedPersonThey')}</p>
      </section>
      <section class="team-settings-section">
        <h3>${t('team.accessHistory')}</h3>
        <ul class="team-settings-list team-settings-list--audit" tabindex="-1" aria-label="${t('team.accessHistory')}">${auditMarkup}</ul>
        ${nextAuditCursor ? `<button class="ui-button ui-button--secondary ui-button--compact" type="button" data-audit-more="${escapeHtml(nextAuditCursor)}">${t('team.loadMoreHistory')}</button>` : ''}
      </section>
      <div class="team-settings-actions">
        <button class="ui-button ui-button--ghost" type="button" data-team-close>${t('common.close')}</button>
      </div>
      <p class="team-settings-live" role="status" aria-live="polite"></p>
    `));
  }

  setLiveMessage(message) {
    const live = this.content?.querySelector('.team-settings-live');
    if (live) live.textContent = message;
  }

  async refresh() {
    try {
      await this.loadOverview();
    } catch (error) {
      this.renderStatus(error.message || t('team.failedToLoadTeamSettings'), { error: true });
    }
  }

  async loadMoreAuditEvents(button) {
    if (button.disabled) return;
    button.disabled = true;
    try {
      const page = await this.apiClient.listAuditEvents({ cursor: button.dataset.auditMore });
      if (!this.content?.contains(button)) return;
      const list = this.content.querySelector('.team-settings-list--audit');
      list.append(createFragment(auditEventsMarkup(page.events ?? [])));
      if (page.nextCursor) {
        button.dataset.auditMore = page.nextCursor;
      } else {
        if (document.activeElement === button) list.focus();
        button.remove();
      }
      this.setLiveMessage(t('team.moreAccessHistoryLoaded'));
    } catch (error) {
      if (this.content?.contains(button)) {
        this.setLiveMessage(error.message || t('team.failedToLoadAccessHistory'));
      }
    } finally {
      button.disabled = false;
    }
  }

  async handleClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.teamClose != null) {
      this.dialog.close();
      return;
    }
    if (target.dataset.auditMore != null) {
      await this.loadMoreAuditEvents(target);
      return;
    }
    if (target.dataset.membershipRemove) {
      if (!window.confirm(t('team.removeEmailFromTheTeamTheyLoseWorkspaceAccess', { email: target.dataset.membershipEmail }))) return;
      try {
        await this.apiClient.removeMembership(target.dataset.membershipRemove);
        await this.refresh();
        this.setLiveMessage(t('team.collaboratorRemoved'));
      } catch (error) {
        this.toastController?.show(error.message || t('team.failedToRemoveCollaborator'));
      }
      return;
    }
    if (target.dataset.invitationRevoke) {
      if (!window.confirm(t('team.revokeTheInvitationForEmail', { email: target.dataset.invitationEmail }))) return;
      try {
        await this.apiClient.revokeInvitation(target.dataset.invitationRevoke);
        await this.refresh();
        this.setLiveMessage(t('team.invitationRevoked'));
      } catch (error) {
        this.toastController?.show(error.message || t('team.failedToRevokeInvitation'));
      }
    }
  }

  async handleChange(event) {
    const membershipSelect = event.target.closest('[data-membership-role]');
    if (membershipSelect) {
      try {
        await this.apiClient.updateMembershipRole(membershipSelect.dataset.membershipRole, membershipSelect.value);
        await this.refresh();
        this.setLiveMessage(t('team.roleUpdated'));
      } catch (error) {
        this.toastController?.show(error.message || t('team.failedToUpdateRole'));
        await this.refresh();
      }
      return;
    }
    const invitationSelect = event.target.closest('[data-invitation-role]');
    if (invitationSelect) {
      try {
        await this.apiClient.updateInvitationRole(invitationSelect.dataset.invitationRole, invitationSelect.value);
        await this.refresh();
        this.setLiveMessage(t('team.invitationRoleUpdated'));
      } catch (error) {
        this.toastController?.show(error.message || t('team.failedToUpdateInvitation'));
        await this.refresh();
      }
    }
  }

  async handleSubmit(event) {
    const form = event.target.closest('[data-invite-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await this.apiClient.createInvitation({
        email: String(data.get('email') ?? '').trim(),
        role: data.get('role'),
      });
      await this.refresh();
      this.setLiveMessage(t('team.invitationCreatedShareTheWorkspaceUrlWithThe'));
    } catch (error) {
      this.setLiveMessage(error.message || t('team.failedToCreateInvitation'));
      submit.disabled = false;
    }
  }
}
