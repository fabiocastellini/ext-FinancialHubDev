import { SUPABASE_URL, SUPABASE_KEY, APP_SECRET } from './config.js';

export const api = async (path, opts = {}) => {
  const { headers: customHeaders, ...restOpts } = opts;

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    'X-App-Secret': APP_SECRET,
    ...customHeaders
  };

  const url = `${SUPABASE_URL}/rest/v1/${path}`;

  // Log headers and request URL for debugging
  // console.log('=== API REQUEST LOG ===');
  // console.log('URL:', url);
  // console.log('Headers:', headers);
  // console.log('SUPABASE_KEY value type:', typeof SUPABASE_KEY);

  const response = await fetch(url, {
    ...restOpts,
    headers
  });

  const data = response.status !== 204 ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const errorMsg = data?.message || data?.hint || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
};