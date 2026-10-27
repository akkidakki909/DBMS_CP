import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/pool.js';

try {
  const migrationUrl = new URL('../migrations/003_future_scope.sql', import.meta.url);
  const sql = await readFile(fileURLToPath(migrationUrl), 'utf8');
  await pool.query(sql);
  console.log('Future-scope migration 003 applied successfully.');
} catch (error) {
  console.error('Could not apply migration 003:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
