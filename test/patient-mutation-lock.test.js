'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createPatientMutationLock } = require('../services/patient-mutation-lock');
const {
  synchronizationHttpStatus,
  sendSynchronizationSummary,
} = require('../routes/patient.routes');

function deferred() {
  let resolve;
  const promise = new Promise(res => { resolve = res; });
  return { promise, resolve };
}

test('registration waits when synchronization already holds the patient mutation lock', async () => {
  const lock = createPatientMutationLock();
  const syncEntered = deferred();
  const releaseSync = deferred();
  const events = [];
  const synchronization = lock.runExclusive(async () => {
    events.push('sync:start');
    syncEntered.resolve();
    await releaseSync.promise;
    events.push('sync:end');
  });
  await syncEntered.promise;
  const registration = lock.runExclusive(async () => { events.push('registration'); });
  await Promise.resolve();
  assert.deepEqual(events, ['sync:start']);
  releaseSync.resolve();
  await Promise.all([synchronization, registration]);
  assert.deepEqual(events, ['sync:start', 'sync:end', 'registration']);
});

test('synchronization waits when registration already holds the patient mutation lock', async () => {
  const lock = createPatientMutationLock();
  const registrationEntered = deferred();
  const releaseRegistration = deferred();
  const events = [];
  const registration = lock.runExclusive(async () => {
    events.push('registration:start');
    registrationEntered.resolve();
    await releaseRegistration.promise;
    events.push('registration:end');
  });
  await registrationEntered.promise;
  const synchronization = lock.runExclusive(async () => { events.push('sync'); });
  await Promise.resolve();
  assert.deepEqual(events, ['registration:start']);
  releaseRegistration.resolve();
  await Promise.all([registration, synchronization]);
  assert.deepEqual(events, ['registration:start', 'registration:end', 'sync']);
});

test('serialized reconciliation cannot remove a concurrently registered patient as stale', async () => {
  const lock = createPatientMutationLock();
  const sqlite = new Map([['CLQ-2026-000001', 'Existing']]);
  const index = new Map(sqlite);
  const syncSnapshotTaken = deferred();
  const releaseSync = deferred();

  const synchronization = lock.runExclusive(async () => {
    const snapshot = new Map(sqlite);
    syncSnapshotTaken.resolve();
    await releaseSync.promise;
    for (const [ref, name] of snapshot) index.set(ref, name);
    for (const ref of [...index.keys()]) if (!snapshot.has(ref)) index.delete(ref);
  });
  await syncSnapshotTaken.promise;
  const registration = lock.runExclusive(async () => {
    sqlite.set('CLQ-2026-000002', 'New');
    index.set('CLQ-2026-000002', 'New');
  });
  releaseSync.resolve();
  await Promise.all([synchronization, registration]);
  assert.equal(index.get('CLQ-2026-000002'), 'New');
});

test('serialized update cannot be overwritten by an older reconciliation snapshot', async () => {
  const lock = createPatientMutationLock();
  const ref = 'CLQ-2026-000003';
  const sqlite = new Map([[ref, 'Old Name']]);
  const index = new Map(sqlite);
  const syncSnapshotTaken = deferred();
  const releaseSync = deferred();

  const synchronization = lock.runExclusive(async () => {
    const snapshot = new Map(sqlite);
    syncSnapshotTaken.resolve();
    await releaseSync.promise;
    for (const [patientRef, name] of snapshot) index.set(patientRef, name);
  });
  await syncSnapshotTaken.promise;
  const update = lock.runExclusive(async () => {
    sqlite.set(ref, 'Updated Name');
    index.set(ref, 'Updated Name');
  });
  releaseSync.resolve();
  await Promise.all([synchronization, update]);
  assert.equal(index.get(ref), 'Updated Name');
});

test('serialized deletion cannot be recreated by reconciliation', async () => {
  const lock = createPatientMutationLock();
  const ref = 'CLQ-2026-000004';
  const sqlite = new Map([[ref, 'Patient']]);
  const index = new Map(sqlite);
  const deletionEntered = deferred();
  const releaseDeletion = deferred();

  const deletion = lock.runExclusive(async () => {
    sqlite.delete(ref);
    deletionEntered.resolve();
    await releaseDeletion.promise;
    index.delete(ref);
  });
  await deletionEntered.promise;
  const synchronization = lock.runExclusive(async () => {
    const snapshot = new Map(sqlite);
    for (const [patientRef, name] of snapshot) index.set(patientRef, name);
    for (const patientRef of [...index.keys()]) if (!snapshot.has(patientRef)) index.delete(patientRef);
  });
  releaseDeletion.resolve();
  await Promise.all([deletion, synchronization]);
  assert.equal(sqlite.has(ref), false);
  assert.equal(index.has(ref), false);
});

test('patient mutation lock releases after successful and rejected operations', async () => {
  const lock = createPatientMutationLock();
  assert.equal(await lock.runExclusive(async () => 'first'), 'first');
  assert.equal(await lock.runExclusive(async () => 'second'), 'second');

  await assert.rejects(lock.runExclusive(async () => { throw new Error('expected'); }), /expected/);
  assert.equal(await lock.runExclusive(async () => 'after rejection'), 'after rejection');
});

test('synchronization response is 200 only when ready and preserves every summary body', () => {
  const cases = [
    [{ enabled: true, ready: true, total: 2, indexed: 2, failed: 0, removed: 1, removeFailed: 0 }, 200],
    [{ enabled: false, ready: false, total: 0, indexed: 0, failed: 0, removed: 0, removeFailed: 0 }, 503],
    [{ enabled: true, ready: false, total: 2, indexed: 0, failed: 2, removed: 0, removeFailed: 0 }, 503],
    [{ enabled: true, ready: false, total: 2, indexed: 1, failed: 1, removed: 0, removeFailed: 0 }, 503],
    [{ enabled: true, ready: false, total: 2, indexed: 2, failed: 0, removed: 0, removeFailed: 1 }, 503],
    [{ enabled: true, ready: false, total: 2, indexed: 0, failed: 0, removed: 0, removeFailed: 0 }, 503],
  ];

  for (const [summary, expectedStatus] of cases) {
    let actualStatus;
    let actualBody;
    const response = {
      status(status) { actualStatus = status; return this; },
      json(body) { actualBody = body; return this; },
    };
    assert.equal(synchronizationHttpStatus(summary), expectedStatus);
    sendSynchronizationSummary(response, summary);
    assert.equal(actualStatus, expectedStatus);
    assert.equal(actualBody, summary);
  }
});
