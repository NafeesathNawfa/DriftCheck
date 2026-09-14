import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const client = new pg.Client({
  host: env.SUPABASE_DB_HOST,
  port: Number(env.SUPABASE_DB_PORT || 5432),
  user: env.SUPABASE_DB_USER,
  password: env.SUPABASE_DB_PASSWORD,
  database: env.SUPABASE_DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const r = await client.query('select current_user, current_database(), version()');
  console.log('CONNECT OK');
  console.log('user : ' + r.rows[0].current_user);
  console.log('db   : ' + r.rows[0].current_database);
  console.log('pg   : ' + r.rows[0].version.split(' ')[0]);
  const tr = await client.query("select count(*) as n from pg_tables where schemaname = 'public'");
  console.log('public tables : ' + tr.rows[0].n);
} catch (e) {
  console.log('CONNECT FAIL: ' + e.message);
  process.exit(1);
} finally {
  await client.end();
}