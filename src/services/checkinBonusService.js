/**
 * Daily Check-in Bonus Service (player frontend)
 *
 * Public endpoints on admin-service:
 *   GET  /api/checkin-bonus?accountId=<id>   -> active campaign + this player's progress
 *   POST /api/checkin-bonus/claim            -> credit bonus_wallet for today's day_index
 *
 * 404 from /api/checkin-bonus means there's no active campaign — caller should
 * hide the stripe entirely. 409 from /claim means already-claimed-today or
 * campaign-complete; both surface in the response shape so the UI can re-render.
 */

const BASE_URL = 'https://api.team33.mx';

const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

/**
 * Returns { status, data } where:
 *  - status: 'ok' (200), 'none' (404 — no active campaign), 'error'
 *  - data: full response body when status === 'ok', else null
 */
export const getActiveCheckinBonus = async (accountId) => {
  try {
    const url = `${BASE_URL}/api/checkin-bonus${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`;
    const res = await fetchWithTimeout(url);
    if (res.status === 404) return { status: 'none', data: null };
    if (!res.ok) return { status: 'error', data: null, code: res.status };
    const data = await res.json();
    return { status: 'ok', data };
  } catch (err) {
    return { status: 'error', data: null, error: err?.message };
  }
};

/**
 * POST /api/checkin-bonus/claim
 *
 * Possible outcomes:
 *  - 200: { status: 'ok', data: claim row } — bonus_wallet credited
 *  - 404: { status: 'none' } — campaign no longer active (rare; backend turned it off mid-flow)
 *  - 409: { status: 'already' | 'complete', message } — caller refreshes campaign state
 *  - 5xx / network: { status: 'error', message }
 */
export const claimCheckinBonus = async (accountId) => {
  try {
    if (!accountId) return { status: 'error', message: 'Account ID is required' };
    const res = await fetchWithTimeout(`${BASE_URL}/api/checkin-bonus/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });
    const data = await res.json().catch(() => null);
    if (res.status === 200) return { status: 'ok', data };
    if (res.status === 404) return { status: 'none', message: 'Daily check-in is not currently available.' };
    if (res.status === 409) {
      const msg = (data?.message || '').toLowerCase();
      const completed = msg.includes('complete');
      return {
        status: completed ? 'complete' : 'already',
        message: completed
          ? "You've completed this check-in campaign."
          : "You've already claimed today's bonus. Come back tomorrow!",
        data,
      };
    }
    if (res.status === 400) {
      return { status: 'error', message: data?.message || 'Account ID is required' };
    }
    return { status: 'error', message: data?.message || `Claim failed (HTTP ${res.status})` };
  } catch (err) {
    return { status: 'error', message: err?.message || 'Network error' };
  }
};

export default { getActiveCheckinBonus, claimCheckinBonus };
