'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPatientSearch,
  readConfiguration,
  COLLECTION_FIELDS,
} = require('../services/typesense-patient-search');
const {
  indexPatientBestEffort,
  executePatientSearch,
  reindexUpdatedPatient,
  deletePatientFromIndexBestEffort,
} = require('../routes/patient.routes');
const { normalizePublicId } = require('../routes/wristband.routes');

const CONFIGURED_ENV = {
  TYPESENSE_HOST: '127.0.0.1',
  TYPESENSE_PORT: '8108',
  TYPESENSE_PROTOCOL: 'http',
  TYPESENSE_API_KEY: 'test-admin-key',
  TYPESENSE_COLLECTION: 'test_patients',
};

function fakeClientFactory(behavior = {}) {
  const state = { options: null, createdSchemas: [], upserts: [], searches: [], deletes: [], exports: 0 };
  class FakeClient {
    constructor(options) { state.options = options; }
    collections(name) {
      if (name === undefined) {
        return { create: async schema => { state.createdSchemas.push(schema); return schema; } };
      }
      return {
        retrieve: async () => {
          if (behavior.retrieveError) throw behavior.retrieveError;
          return behavior.schema || { fields: COLLECTION_FIELDS };
        },
        documents: () => ({
          upsert: async document => {
            state.upserts.push(document);
            const upsertError = typeof behavior.upsertError === 'function'
              ? behavior.upsertError(document)
              : behavior.upsertError;
            if (upsertError) throw upsertError;
            return document;
          },
          search: async params => {
            state.searches.push(params);
            if (behavior.searchError) throw behavior.searchError;
            return typeof behavior.searchResult === 'function'
              ? behavior.searchResult(params)
              : behavior.searchResult || { hits: [] };
          },
          export: async params => {
            state.exports += 1;
            if (behavior.exportError) throw behavior.exportError;
            if (typeof behavior.exportResult === 'function') return behavior.exportResult(params);
            return behavior.exportResult || '';
          },
        }),
        document: id => ({
          delete: async () => {
            state.deletes.push(id);
            const deleteError = typeof behavior.deleteError === 'function'
              ? behavior.deleteError(id)
              : behavior.deleteError;
            if (deleteError) throw deleteError;
            return { id };
          },
        }),
      };
    }
  }
  return { FakeClient, state };
}

test('Typesense-disabled configuration requires every variable and stays inert', async () => {
  assert.equal(readConfiguration({}), null);
  assert.equal(readConfiguration({ ...CONFIGURED_ENV, TYPESENSE_API_KEY: '' }), null);
  const { FakeClient, state } = fakeClientFactory();
  const service = createPatientSearch({ env: {}, Client: FakeClient });
  assert.equal(service.isEnabled(), false);
  assert.deepEqual(await service.initializeCollection(), { enabled: false, ready: false });
  assert.deepEqual(await service.indexPatient({ patient_ref: 'CLQ-2026-000001', full_name: 'Test' }),
    { enabled: false, indexed: false });
  assert.equal(await service.search('Test'), null);
  assert.equal(state.options, null);
});

test('Typesense client uses the configured local node, short timeout and no retries', () => {
  const { FakeClient, state } = fakeClientFactory();
  createPatientSearch({ env: CONFIGURED_ENV, Client: FakeClient });
  assert.deepEqual(state.options.nodes, [{ host: '127.0.0.1', port: 8108, protocol: 'http' }]);
  assert.equal(state.options.apiKey, 'test-admin-key');
  assert.equal(state.options.connectionTimeoutSeconds, 1);
  assert.equal(state.options.numRetries, 0);
});

test('collection initialization validates existing schema and creates only when missing', async () => {
  const existing = fakeClientFactory();
  const service = createPatientSearch({ env: CONFIGURED_ENV, Client: existing.FakeClient });
  assert.deepEqual(await service.initializeCollection(), { enabled: true, ready: true, created: false });
  assert.equal(service.isReadyForSearch(), false);
  assert.equal(existing.state.createdSchemas.length, 0);

  const missing = fakeClientFactory({ retrieveError: { httpStatus: 404 } });
  const createService = createPatientSearch({ env: CONFIGURED_ENV, Client: missing.FakeClient });
  assert.deepEqual(await createService.initializeCollection(), { enabled: true, ready: true, created: true });
  assert.equal(createService.isReadyForSearch(), false);
  assert.deepEqual(missing.state.createdSchemas[0], { name: 'test_patients', fields: COLLECTION_FIELDS });
});

test('new and existing collections return the fallback signal before reconciliation', async () => {
  for (const behavior of [{}, { retrieveError: { httpStatus: 404 } }]) {
    const fake = fakeClientFactory(behavior);
    const service = createPatientSearch({ env: CONFIGURED_ENV, Client: fake.FakeClient });
    await service.initializeCollection();
    assert.equal(service.isReadyForSearch(), false);
    assert.equal(await service.search('patient', 10, 0), null);
    assert.equal(fake.state.searches.length, 0);
  }
});

test('successful indexing upserts only permanent Patient ID and name', async () => {
  const { FakeClient, state } = fakeClientFactory();
  const service = createPatientSearch({ env: CONFIGURED_ENV, Client: FakeClient });
  await service.indexPatient({
    patient_ref: 'CLQ-2026-000123', full_name: 'Example Patient',
    date_of_birth: '1990-01-01', allergy_notes: 'must not be indexed',
  });
  assert.deepEqual(state.upserts, [{
    id: 'CLQ-2026-000123', patient_ref: 'CLQ-2026-000123', full_name: 'Example Patient',
  }]);
});

test('indexing failure is contained after SQLite registration', async () => {
  const warnings = [];
  const result = await indexPatientBestEffort(
    { patient_ref: 'CLQ-2026-000124', full_name: 'Private Name' },
    { indexPatient: async () => { throw new Error('includes private upstream detail'); } },
    { warn: message => warnings.push(message) }
  );
  assert.deepEqual(result, { enabled: true, indexed: false });
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(warnings[0], /Private Name|upstream detail/);
});

test('patient name update re-reads SQLite and best-effort upserts the updated name', async () => {
  const updated = { patient_ref: 'CLQ-2026-000125', full_name: 'Updated Name' };
  const reads = [];
  const indexed = [];
  const success = await reindexUpdatedPatient(125, {
    database: { get: async (sql, params) => { reads.push({ sql, params }); return updated; } },
    searchService: { indexPatient: async patient => { indexed.push(patient); return { enabled: true, indexed: true }; } },
  });
  assert.deepEqual(success, { enabled: true, indexed: true });
  assert.deepEqual(reads[0].params, [125]);
  assert.deepEqual(indexed, [updated]);

  const warnings = [];
  const failure = await reindexUpdatedPatient(125, {
    database: { get: async () => updated },
    searchService: { indexPatient: async () => { throw new Error('Typesense offline'); } },
    logger: { warn: message => warnings.push(message) },
  });
  assert.deepEqual(failure, { enabled: true, indexed: false });
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(warnings[0], /Updated Name|Typesense offline/);
});

test('Typesense-backed search is typo tolerant and returns ordered patient references', async () => {
  const fake = fakeClientFactory({ searchResult: { hits: [
    { document: { patient_ref: 'CLQ-2026-000009', full_name: 'Katherine' } },
    { document: { patient_ref: 'CLQ-2026-000002', full_name: 'Catherine' } },
  ] } });
  const service = createPatientSearch({ env: CONFIGURED_ENV, Client: fake.FakeClient });
  await service.initializeCollection();
  await service.synchronize([]);
  assert.deepEqual(await service.search('Katherin', 20, 40), ['CLQ-2026-000009', 'CLQ-2026-000002']);
  assert.equal(fake.state.searches[0].query_by, 'patient_ref,full_name');
  assert.equal(fake.state.searches[0].typo_tokens_threshold, 1);
  assert.equal(fake.state.searches[0].limit, 20);
  assert.equal(fake.state.searches[0].offset, 40);
});

test('complete and zero-patient synchronization mark Typesense ready for search', async () => {
  const populated = fakeClientFactory();
  const service = createPatientSearch({ env: CONFIGURED_ENV, Client: populated.FakeClient });
  await service.initializeCollection();
  const summary = await service.synchronize([
    { patient_ref: 'CLQ-2026-000010', full_name: 'Current Patient' },
  ]);
  assert.deepEqual(summary, {
    enabled: true, total: 1, indexed: 1, failed: 0,
    removed: 0, removeFailed: 0, ready: true,
  });
  assert.equal(service.isReadyForSearch(), true);

  const empty = fakeClientFactory();
  const emptyService = createPatientSearch({ env: CONFIGURED_ENV, Client: empty.FakeClient });
  await emptyService.initializeCollection();
  assert.equal((await emptyService.synchronize([])).ready, true);
  assert.equal(emptyService.isReadyForSearch(), true);
});

test('partial upsert and stale-removal failures leave Typesense unready', async () => {
  const upsertFailure = fakeClientFactory({ upsertError: new Error('offline') });
  const upsertService = createPatientSearch({ env: CONFIGURED_ENV, Client: upsertFailure.FakeClient });
  await upsertService.initializeCollection();
  const upsertSummary = await upsertService.synchronize([
    { patient_ref: 'CLQ-2026-000011', full_name: 'Current Patient' },
  ]);
  assert.equal(upsertSummary.failed, 1);
  assert.equal(upsertSummary.ready, false);
  assert.equal(upsertService.isReadyForSearch(), false);

  const removeFailure = fakeClientFactory({
    exportResult: '{"id":"CLQ-2026-999999"}',
    deleteError: new Error('offline'),
  });
  const removeService = createPatientSearch({ env: CONFIGURED_ENV, Client: removeFailure.FakeClient });
  await removeService.initializeCollection();
  const removeSummary = await removeService.synchronize([]);
  assert.equal(removeSummary.removeFailed, 1);
  assert.equal(removeSummary.ready, false);
  assert.equal(removeService.isReadyForSearch(), false);
});

test('synchronization removes exported Typesense documents absent from SQLite', async () => {
  const fake = fakeClientFactory({
    exportResult: [
      '{"id":"CLQ-2026-000012"}',
      '{"id":"CLQ-2026-999999"}',
    ].join('\n'),
  });
  const service = createPatientSearch({ env: CONFIGURED_ENV, Client: fake.FakeClient });
  await service.initializeCollection();
  const summary = await service.synchronize([
    { patient_ref: 'CLQ-2026-000012', full_name: 'Current Patient' },
  ]);
  assert.equal(summary.removed, 1);
  assert.equal(summary.removeFailed, 0);
  assert.equal(summary.ready, true);
  assert.deepEqual(fake.state.deletes, ['CLQ-2026-999999']);
});

test('successful manual-style synchronization marks the service ready', async () => {
  const fake = fakeClientFactory();
  const service = createPatientSearch({ env: CONFIGURED_ENV, Client: fake.FakeClient });
  await service.initializeCollection();
  assert.equal(service.isReadyForSearch(), false);
  assert.equal((await service.synchronize([])).ready, true);
  assert.equal(service.isReadyForSearch(), true);
});

test('SQLite patient deletion triggers best-effort index deletion without exposing failures', async () => {
  const deleted = [];
  assert.deepEqual(await deletePatientFromIndexBestEffort('CLQ-2026-000013', {
    deletePatient: async ref => { deleted.push(ref); return { enabled: true, deleted: true }; },
  }), { enabled: true, deleted: true });
  assert.deepEqual(deleted, ['CLQ-2026-000013']);

  const warnings = [];
  const failure = await deletePatientFromIndexBestEffort(
    'CLQ-2026-000013',
    { deletePatient: async () => { throw new Error('private upstream detail'); } },
    { warn: message => warnings.push(message) }
  );
  assert.deepEqual(failure, { enabled: true, deleted: false });
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(warnings[0], /CLQ-2026-000013|private upstream detail/);
});

test('page one and page two both use Typesense with consistent offsets', async () => {
  const searchCalls = [];
  const database = {
    all: async (_sql, refs) => refs.map((patient_ref, index) => ({ id: index + 1, patient_ref })),
  };
  const searchService = {
    search: async (query, limit, offset) => {
      searchCalls.push({ query, limit, offset });
      return [`CLQ-2026-${String(offset + 1).padStart(6, '0')}`];
    },
  };
  const first = await executePatientSearch('Katherin', 20, 0, { searchService, database });
  const second = await executePatientSearch('Katherin', 20, 20, { searchService, database });
  assert.deepEqual(searchCalls, [
    { query: 'Katherin', limit: 20, offset: 0 },
    { query: 'Katherin', limit: 20, offset: 20 },
  ]);
  assert.equal(first[0].patient_ref, 'CLQ-2026-000001');
  assert.equal(second[0].patient_ref, 'CLQ-2026-000021');
});

test('unavailable Typesense search on a later page uses the matching SQLite fallback', async () => {
  const calls = [];
  const sqliteRows = [{ id: 7, patient_ref: 'CLQ-2026-000007', full_name: 'SQLite Patient' }];
  const rows = await executePatientSearch('patient', 50, 50, {
    searchService: { search: async () => { throw new Error('offline'); } },
    database: {
      all: async (sql, params) => {
        calls.push({ sql, params });
        return sqliteRows;
      },
    },
    logger: { warn() {} },
  });
  assert.equal(rows, sqliteRows);
  assert.match(calls[0].sql, /full_name LIKE \? OR patient_ref LIKE \?/);
  assert.deepEqual(calls[0].params, ['%patient%', '%patient%', 50, 50]);
});

test('exact Patient ID parsing remains strict and does not use fuzzy search', () => {
  assert.equal(normalizePublicId('clq-2026-000123'), 'CLQ-2026-000123');
  assert.equal(normalizePublicId('CLQ-2026-00012X'), null);
  assert.equal(normalizePublicId('CLQ-2026-000123 extra'), null);
});

test('synchronization is idempotent and reports partial failures without patient data', async () => {
  const fake = fakeClientFactory();
  const service = createPatientSearch({ env: CONFIGURED_ENV, Client: fake.FakeClient });
  await service.initializeCollection();
  const patients = [
    { patient_ref: 'CLQ-2026-000001', full_name: 'First Patient' },
    { patient_ref: 'CLQ-2026-000002', full_name: 'Second Patient' },
  ];
  const expected = {
    enabled: true, total: 2, indexed: 2, failed: 0,
    removed: 0, removeFailed: 0, ready: true,
  };
  assert.deepEqual(await service.synchronize(patients), expected);
  assert.deepEqual(await service.synchronize(patients), expected);
  assert.equal(fake.state.upserts.length, 4);
  assert.equal(new Set(fake.state.upserts.map(document => document.id)).size, 2);

  const partial = fakeClientFactory({
    upsertError: document => document.id.endsWith('2') ? new Error('unavailable') : null,
  });
  const partialService = createPatientSearch({ env: CONFIGURED_ENV, Client: partial.FakeClient });
  await partialService.initializeCollection();
  assert.deepEqual(await partialService.synchronize(patients), {
    enabled: true, total: 2, indexed: 1, failed: 1,
    removed: 0, removeFailed: 0, ready: false,
  });
});
