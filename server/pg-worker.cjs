const { Pool } = require('pg');
const { runAsWorker } = require('synckit');
const { toPositional, qMarksToPg, normalizeInsertOrIgnore } = require('./sql-utils');
const { PG_SCHEMA } = require('./pg-schema');

let pool = null;
let client = null; // transaction client

function prepareSql(sql, params) {
  const converted = toPositional(sql, params);
  let text = normalizeInsertOrIgnore(converted.sql);
  text = text.replace(/datetime\('now'\)/gi, 'NOW()');
  text = qMarksToPg(text);
  return { text, values: converted.values };
}

async function query(sql, params = []) {
  const { text, values } = prepareSql(sql, params);
  const runner = client || pool;
  return runner.query(text, values);
}

runAsWorker(async (msg) => {
  switch (msg.type) {
    case 'init': {
      if (pool) {
        try { await pool.end(); } catch (_) { /* ignore */ }
      }
      // NODE_TLS / pg: Supabase pooler usa cadeia que falha com verify-full
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';
      pool = new Pool({
        connectionString: msg.databaseUrl,
        ssl: /localhost|127\.0\.0\.1/.test(msg.databaseUrl)
          ? false
          : { rejectUnauthorized: false },
        max: 5,
        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
      });
      // warm connection
      const c = await pool.connect();
      await c.query('SELECT 1');
      c.release();
      return { ok: true };
    }
    case 'initSchema': {
      // Executa statement a statement para não derrubar o boot se um índice/coluna já existir
      const parts = String(PG_SCHEMA).split(';').map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        try {
          await pool.query(part);
        } catch (err) {
          console.warn('initSchema skip:', part.slice(0, 80), '→', err.message);
        }
      }
      return { ok: true };
    }
    case 'get': {
      const res = await query(msg.sql, msg.params || []);
      return res.rows[0];
    }
    case 'all': {
      const res = await query(msg.sql, msg.params || []);
      return res.rows;
    }
    case 'run': {
      let sql = msg.sql;
      // Tabelas sem coluna `id` (ex.: coordinator_municipalities) quebram com RETURNING id.
      // Preferimos RETURNING * e usamos id quando existir.
      if (/^\s*INSERT\s+/i.test(sql) && !/RETURNING/i.test(sql)) {
        sql = `${sql.replace(/;\s*$/, '')} RETURNING *`;
      }
      const res = await query(sql, msg.params || []);
      const row = res.rows[0] || {};
      return {
        lastInsertRowid: row.id ?? row.campaign_id ?? 0,
        changes: res.rowCount || 0,
      };
    }
    case 'exec': {
      const parts = String(msg.sql).split(';').map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        await query(part, []);
      }
      return { ok: true };
    }
    case 'begin': {
      if (client) throw new Error('Transação já aberta');
      client = await pool.connect();
      await client.query('BEGIN');
      return { ok: true };
    }
    case 'commit': {
      if (!client) throw new Error('Sem transação');
      await client.query('COMMIT');
      client.release();
      client = null;
      return { ok: true };
    }
    case 'rollback': {
      if (!client) return { ok: true };
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
      client.release();
      client = null;
      return { ok: true };
    }
    default:
      throw new Error(`Comando PG desconhecido: ${msg.type}`);
  }
});
