import { escapeHtml } from '../domain/vault-utils.js';
import { t } from '../i18n/index.js';

function createAgentSetup({ authRequired, endpoint }) {
  return [
    `MCP endpoint: ${endpoint}`,
    'Transport: Streamable HTTP',
    `Authorization: ${authRequired ? 'Bearer $COLLABMD_ACCESS_TOKEN' : 'None'}`,
  ].join('\n');
}

function createAgentTokenExport(token) {
  return `export COLLABMD_ACCESS_TOKEN='${String(token).replaceAll("'", "'\\''")}'`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : t('agent.never');
}

export class AgentConnectionController {
  constructor({ apiClient, closeToolbarMenu, content, dialog, runtimeConfig, toastController, trigger }) {
    this.apiClient = apiClient;
    this.closeToolbarMenu = closeToolbarMenu;
    this.content = content;
    this.dialog = dialog;
    this.runtimeConfig = runtimeConfig;
    this.toastController = toastController;
    this.trigger = trigger;
    this.secretToken = '';
    this.config = {
      authRequired: runtimeConfig.auth?.strategy !== 'none',
      endpoint: runtimeConfig.agentAccess?.endpoint || '',
      managed: Boolean(runtimeConfig.agentAccess?.managed),
    };
    this.endpoint = new URL(this.config.endpoint, window.location.origin).toString();

    this.trigger?.classList.toggle('hidden', !runtimeConfig.agentAccess?.enabled);
    this.trigger?.addEventListener('click', () => void this.open());
    this.dialog?.addEventListener('close', () => {
      this.secretToken = '';
      this.content?.replaceChildren();
      this.trigger?.focus?.();
    });
    this.dialog?.addEventListener('click', (event) => void this.handleClick(event));
    this.dialog?.addEventListener('submit', (event) => void this.handleSubmit(event));
  }

  async open() {
    this.closeToolbarMenu?.();
    this.dialog?.showModal?.();
    this.renderStatus(t('agent.loadingAgentAccess'));
    try {
      const connections = this.config.managed
        ? (await this.apiClient.listConnections()).connections
        : [];
      this.renderOverview(connections);
    } catch (error) {
      this.renderStatus(error.message || t('agent.failedToLoadAgentAccess'), { error: true });
    }
  }

  renderStatus(message, { error = false } = {}) {
    if (!this.content) return;
    this.content.innerHTML = `<p class="agent-connection-status${error ? ' is-error' : ''}" role="status">${escapeHtml(message)}</p>`;
  }

  renderOverview(connections = []) {
    const connectionMarkup = connections.length > 0
      ? connections.map((connection) => `
        <article class="agent-connection-card">
          <div>
            <strong>${escapeHtml(connection.label)}</strong>
            <span>${escapeHtml(connection.scopes.join(', '))}</span>
            <small>${t('agent.expiresDate', { date: formatDate(connection.expiresAt) })}</small>
          </div>
          <button class="ui-button ui-button--secondary ui-button--compact" type="button" data-agent-revoke="${escapeHtml(connection.id)}">${t('agent.revoke')}</button>
        </article>
      `).join('')
      : `
        <div class="agent-connection-empty">
          <strong>${t('agent.connectYourFirstAgent')}</strong>
          <p>${t('agent.chooseItsAccessCreateASecureTokenThenCopyThe')}</p>
        </div>
      `;
    const management = this.config.managed
      ? `<button class="ui-button ui-button--primary" type="button" data-agent-create>${connections.length > 0 ? t('agent.newConnection') : t('agent.startSetup')}</button>`
      : `
        <section class="agent-connection-empty">
          <strong>${t('agent.noAuthenticationRequired')}</strong>
          <ol class="agent-connection-steps">
            <li>${t('agent.copyTheConnectionDetailsBelowIntoYourAgent')}</li>
            <li>${t('agent.addThisCollabmdMcpEndpointAndRestartTheAgent')}</li>
            <li>${t('agent.anyoneWhoCanReachThisNoAuthWorkspaceCanUseIts')}</li>
          </ol>
        </section>
      `;
    const connectionsSection = this.config.managed
      ? `
        <section class="agent-connection-section">
          <h3>${t('agent.connections')}</h3>
          <div class="agent-connection-list">${connectionMarkup}</div>
        </section>
      `
      : '';
    this.content.innerHTML = `
      ${connectionsSection}
      ${this.config.managed ? '' : management}
      <details class="agent-connection-details">
        <summary>${t('agent.connectionDetails')}</summary>
        <code>${escapeHtml(this.endpoint)}</code>
        <p>${t('agent.streamableHttpAuthReadAndEditTools', { auth: this.config.authRequired ? t('agent.bearerToken') : t('agent.noAuthentication') })}</p>
      </details>
      <div class="agent-connection-actions">
        ${this.config.managed ? management : `<button class="ui-button ui-button--primary" type="button" data-agent-copy-setup>${t('agent.copyConnectionDetails')}</button>`}
        <button class="ui-button ui-button--ghost" type="button" data-agent-close>${t('common.close')}</button>
      </div>
      <p class="agent-connection-live" role="status" aria-live="polite"></p>
    `;
  }

  renderCreate() {
    this.content.innerHTML = `
      <form class="agent-connection-form" data-agent-create-form>
        <header class="agent-connection-step-header">
          <span>${t('agent.step1Of2')}</span>
          <h3>${t('agent.chooseAccess')}</h3>
          <p>${t('agent.youCanRevokeThisConnectionAtAnyTime')}</p>
        </header>
        <label class="app-dialog-field">
          <span class="app-dialog-label">${t('agent.connectionName')}</span>
          <input class="ui-input" name="label" maxlength="80" value="My Agent" required>
        </label>
        <fieldset class="agent-connection-scopes">
          <legend>${t('agent.access')}</legend>
          <label><input type="checkbox" checked disabled> ${t('agent.readVaultContent')}</label>
          <label><input type="checkbox" name="edit" checked> ${t('agent.editAndCreateSupportedTextFiles')}</label>
        </fieldset>
        <p class="agent-connection-note">${t('agent.tokenExpiresAfter30DaysAndCanBeRevokedHereDelete')}</p>
        <div class="agent-connection-actions">
          <button class="ui-button ui-button--secondary" type="button" data-agent-back>${t('common.back')}</button>
          <button class="ui-button ui-button--primary" type="submit">${t('agent.createSecureToken')}</button>
        </div>
        <p class="agent-connection-live" role="status" aria-live="polite"></p>
      </form>
    `;
  }

  renderToken({ token }) {
    this.secretToken = token;
    const setup = createAgentSetup({
      authRequired: this.config.authRequired,
      endpoint: this.endpoint,
    });
    this.content.innerHTML = `
      <header class="agent-connection-step-header">
        <span>${t('agent.step2Of2')}</span>
        <h3>${t('agent.finishSetupInYourMcpClient')}</h3>
        <p class="agent-connection-warning">${t('agent.theTokenIsShownOnceFinishTheseStepsBeforeClosing')}</p>
      </header>
      <ol class="agent-connection-steps agent-connection-steps--setup">
        <li>
          <div><strong>${t('agent.saveTheAccessToken')}</strong><span>${t('agent.runTheCopiedCommandInTheTerminalThatStartsYour')}</span></div>
          <button class="ui-button ui-button--primary" type="button" data-agent-copy-token>${t('agent.copyTokenCommand')}</button>
        </li>
        <li>
          <div><strong>${t('agent.addThisWorkspace')}</strong><span>${t('agent.pasteTheSetupIntoYourMcpClient')}</span></div>
          <button class="ui-button ui-button--secondary" type="button" data-agent-copy-setup>${t('agent.copyMcpSetup')}</button>
        </li>
      </ol>
      <details class="agent-connection-details">
        <summary>${t('agent.viewManualSetup')}</summary>
        <input class="ui-input agent-connection-token" value="${escapeHtml(token)}" readonly aria-label="${t('agent.agentConnectionToken')}">
        <pre><code>${escapeHtml(setup)}</code></pre>
      </details>
      <div class="agent-connection-actions">
        <button class="ui-button ui-button--primary" type="button" data-agent-close>${t('agent.done')}</button>
      </div>
      <p class="agent-connection-live" role="status" aria-live="polite"></p>
    `;
  }

  async refresh() {
    const connections = this.config.managed
      ? (await this.apiClient.listConnections()).connections
      : [];
    this.renderOverview(connections);
  }

  setLiveMessage(message) {
    const live = this.content?.querySelector('.agent-connection-live');
    if (live) live.textContent = message;
  }

  async copy(text, message) {
    await navigator.clipboard.writeText(text);
    this.setLiveMessage(message);
  }

  async handleClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.agentClose != null) {
      this.dialog.close();
      return;
    }
    if (target.dataset.agentCreate != null) {
      this.renderCreate();
      return;
    }
    if (target.dataset.agentBack != null) {
      await this.refresh();
      return;
    }
    if (target.dataset.agentCopyToken != null) {
      await this.copy(createAgentTokenExport(this.secretToken), t('agent.tokenCommandCopiedRunItInTheAgentTerminal'));
      return;
    }
    if (target.dataset.agentCopySetup != null) {
      await this.copy(createAgentSetup({
        authRequired: this.config.authRequired,
        endpoint: this.endpoint,
      }), t('agent.setupCopiedAddItToYourMcpClient'));
      return;
    }
    if (target.dataset.agentRevoke) {
      if (!window.confirm(t('agent.revokeThisAgentConnection'))) return;
      try {
        await this.apiClient.revokeConnection(target.dataset.agentRevoke);
        await this.refresh();
        this.setLiveMessage(t('agent.agentConnectionRevoked'));
      } catch (error) {
        this.toastController?.show(error.message || t('agent.failedToRevokeAgentConnection'));
      }
    }
  }

  async handleSubmit(event) {
    const form = event.target.closest('[data-agent-create-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const result = await this.apiClient.createConnection({
        clientKind: 'generic',
        label: data.get('label'),
        scopes: data.get('edit') === 'on' ? ['vault:read', 'vault:edit'] : ['vault:read'],
      });
      this.renderToken(result);
    } catch (error) {
      this.setLiveMessage(error.message || t('agent.failedToCreateAgentConnection'));
      submit.disabled = false;
    }
  }
}
