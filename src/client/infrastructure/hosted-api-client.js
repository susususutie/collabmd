import { resolveApiUrl } from '../domain/runtime-paths.js';
import { parseApiResponse } from './api-client-utils.js';

function request(path, { body = null, fallback = 'hosted.requestFailed', method = 'GET' } = {}) {
  return fetch(resolveApiUrl(path), {
    ...(body === null ? {} : { body: JSON.stringify(body) }),
    headers: { 'Content-Type': 'application/json' },
    method,
  }).then((response) => parseApiResponse(response, fallback));
}

export const hostedApiClient = {
  acceptInvitation() {
    return request('/hosted/invitations/accept', { fallback: 'hosted.failedToAcceptInvitation', method: 'POST' });
  },

  claimWorkspace({ teamName, token }) {
    return request('/hosted/claim', { body: { teamName, token }, fallback: 'hosted.failedToClaimWorkspace', method: 'POST' });
  },

  completeSetup() {
    return request('/hosted/setup/complete', { fallback: 'hosted.failedToCompleteSetup', method: 'POST' });
  },

  createInvitation({ email, role }) {
    return request('/hosted/invitations', { body: { email, role }, fallback: 'hosted.failedToCreateInvitation', method: 'POST' });
  },

  getStatus() {
    return request('/hosted/status', { fallback: 'hosted.failedToLoadWorkspaceStatus' });
  },

  listAuditEvents({ cursor = '', limit = 50 } = {}) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set('cursor', cursor);
    return request(`/hosted/audit?${query}`, { fallback: 'hosted.failedToLoadAccessHistory' });
  },

  listInvitations() {
    return request('/hosted/invitations', { fallback: 'hosted.failedToLoadInvitations' });
  },

  listMemberships() {
    return request('/hosted/memberships', { fallback: 'hosted.failedToLoadCollaborators' });
  },

  removeMembership(membershipId) {
    return request(`/hosted/memberships/${encodeURIComponent(membershipId)}`, { fallback: 'hosted.failedToRemoveCollaborator', method: 'DELETE' });
  },

  revokeInvitation(invitationId) {
    return request(`/hosted/invitations/${encodeURIComponent(invitationId)}`, { fallback: 'hosted.failedToRevokeInvitation', method: 'DELETE' });
  },

  updateInvitationRole(invitationId, role) {
    return request(`/hosted/invitations/${encodeURIComponent(invitationId)}`, { body: { role }, fallback: 'hosted.failedToUpdateInvitation', method: 'PATCH' });
  },

  updateMembershipRole(membershipId, role) {
    return request(`/hosted/memberships/${encodeURIComponent(membershipId)}`, { body: { role }, fallback: 'hosted.failedToUpdateRole', method: 'PATCH' });
  },
};
