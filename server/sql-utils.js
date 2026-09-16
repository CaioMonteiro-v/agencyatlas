/**
 * Conversão de SQL estilo SQLite (?) para Postgres ($1..) e ajustes leves de dialeto.
 */
function toPositional(sql, params) {
  if (
    params.length === 1 &&
    params[0] &&
    typeof params[0] === 'object' &&
    !Array.isArray(params[0])
  ) {
    const obj = params[0];
    const values = [];
    const positionalSql = sql.replace(/[@:$]([a-zA-Z_][\w]*)/g, (_, name) => {
      values.push(obj[name]);
      return '?';
    });
    return { sql: positionalSql, values };
  }
  return { sql, values: params };
}

function qMarksToPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function normalizeInsertOrIgnore(sql) {
  if (!/INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql)) return sql;
  const without = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  if (/ON CONFLICT/i.test(without)) return without;
  return `${without.replace(/;\s*$/, '')} ON CONFLICT DO NOTHING`;
}

module.exports = {
  toPositional,
  qMarksToPg,
  normalizeInsertOrIgnore,
};
