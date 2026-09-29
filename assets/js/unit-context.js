import {apiRequest} from './api.js';

// A short, account-scoped memory cache prevents the header, home and workspace
// from requesting the same context at once. Membership is never read from storage.
const contexts = new Map();
export function clearPortalContext() { contexts.clear(); }
export async function getPortalContext(user, {force = false} = {}) {
  if (!user || user.isAnonymous) return {membership: null, profile: {}, capabilities: {}};
  const cached = contexts.get(user.uid);
  if (!force && cached && Date.now() - cached.createdAt < 30000) return cached.promise;
  const promise = apiRequest(user, 'getPortalContext');
  contexts.set(user.uid, {promise, createdAt: Date.now()});
  try { return await promise; }
  catch (error) { if (contexts.get(user.uid)?.promise === promise) contexts.delete(user.uid); throw error; }
}
