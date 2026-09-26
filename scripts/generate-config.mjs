import { readFile, writeFile } from 'node:fs/promises';

const envText = await readFile(new URL('../.env', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).flatMap((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return [];
  const separator = trimmed.indexOf('=');
  if (separator < 1) return [];
  return [[trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim()]];
}));

const config = {
  APP_ENV: env.APP_ENV || 'dev',
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_KEY: env.SUPABASE_KEY,
  APP_SECRET: env.APP_SECRET,
};
const missing = ['SUPABASE_URL', 'SUPABASE_KEY', 'APP_SECRET'].filter((key) => !config[key]);
if (missing.length) throw new Error(`Missing required .env values: ${missing.join(', ')}`);

await writeFile(new URL('../app-config.local.js', import.meta.url),
  `window.FINANCIAL_HUB_CONFIG = Object.freeze(${JSON.stringify(config)});\n`,
  { mode: 0o600 });
console.log('Generated ignored app-config.local.js from .env');
