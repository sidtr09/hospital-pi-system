'use strict';

function createPatientMutationLock() {
  let tail = Promise.resolve();

  async function runExclusive(operation) {
    const previous = tail;
    let release;
    const turn = new Promise(resolve => { release = resolve; });
    tail = previous.catch(() => {}).then(() => turn);

    await previous.catch(() => {});
    try {
      return await operation();
    } finally {
      release();
    }
  }

  return { runExclusive };
}

const patientMutationLock = createPatientMutationLock();

module.exports = patientMutationLock;
module.exports.createPatientMutationLock = createPatientMutationLock;
