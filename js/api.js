import { SUPABASE_URL, SUPABASE_KEY, APP_SECRET } from './config.js';

export const api = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  headers: {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    'X-App-Secret': APP_SECRET,
    ...opts.headers
  },
  ...opts
}).then(r => r.json());