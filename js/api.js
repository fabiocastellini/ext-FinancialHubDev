import { SUPABASE_URL, SUPABASE_KEY, APP_SECRET } from './config.js';

export const api = async (path, opts = {}) => {
  const { headers: customHeaders, ...restOpts } = opts;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...restOpts,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      'X-App-Secret': APP_SECRET,
      ...customHeaders
    }
  });

  const data = response.status !== 204 ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const errorMsg = data?.message || data?.hint || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
};