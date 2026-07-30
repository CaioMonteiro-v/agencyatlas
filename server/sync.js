const deasync = require('deasync');

function sync(promise) {
  let done = false;
  let result;
  let error;
  Promise.resolve(promise).then(
    (value) => { result = value; done = true; },
    (err) => { error = err; done = true; },
  );
  deasync.loopWhile(() => !done);
  if (error) throw error;
  return result;
}

module.exports = { sync };
