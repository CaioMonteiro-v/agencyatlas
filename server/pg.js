const { createSyncFn } = require('synckit');
const path = require('path');

const callWorker = createSyncFn(path.join(__dirname, 'pg-worker.cjs'), {
  timeout: 120000,
});

function createPgDb(databaseUrl) {
  let url = databaseUrl.trim();
  if (!/[?&]sslmode=/.test(url)) {
    url += (url.includes('?') ? '&' : '?') + 'sslmode=require';
  }

  callWorker({ type: 'init', databaseUrl: url });

  function prepare(sql) {
    return {
      get(...params) {
        return callWorker({ type: 'get', sql, params });
      },
      all(...params) {
        return callWorker({ type: 'all', sql, params });
      },
      run(...params) {
        return callWorker({ type: 'run', sql, params });
      },
    };
  }

  return {
    dialect: 'postgres',
    prepare,
    exec(sql) {
      callWorker({ type: 'exec', sql });
    },
    pragma() {},
    transaction(fn) {
      return (...args) => {
        callWorker({ type: 'begin' });
        try {
          const result = fn(...args);
          callWorker({ type: 'commit' });
          return result;
        } catch (err) {
          try { callWorker({ type: 'rollback' }); } catch (_) { /* ignore */ }
          throw err;
        }
      };
    },
    initSchema() {
      callWorker({ type: 'initSchema' });
    },
  };
}

module.exports = { createPgDb };
