'use strict';

const Typesense = require('typesense');

const COLLECTION_FIELDS = [
  { name: 'patient_ref', type: 'string' },
  { name: 'full_name', type: 'string' },
];

function readConfiguration(env = process.env) {
  const names = [
    'TYPESENSE_HOST',
    'TYPESENSE_PORT',
    'TYPESENSE_PROTOCOL',
    'TYPESENSE_API_KEY',
    'TYPESENSE_COLLECTION',
  ];
  if (names.some(name => !String(env[name] || '').trim())) return null;

  const port = Number(env.TYPESENSE_PORT);
  const protocol = String(env.TYPESENSE_PROTOCOL).toLowerCase();
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (!['http', 'https'].includes(protocol)) return null;

  return {
    host: String(env.TYPESENSE_HOST).trim(),
    port,
    protocol,
    apiKey: String(env.TYPESENSE_API_KEY),
    collection: String(env.TYPESENSE_COLLECTION).trim(),
  };
}

function createPatientSearch(options = {}) {
  const config = readConfiguration(options.env);
  const logger = options.logger || console;
  const Client = options.Client || Typesense.Client;
  const client = config ? new Client({
    nodes: [{ host: config.host, port: config.port, protocol: config.protocol }],
    apiKey: config.apiKey,
    connectionTimeoutSeconds: 1,
    numRetries: 0,
    retryIntervalSeconds: 0.1,
    logLevel: 'silent',
  }) : null;
  let collectionUsable = Boolean(client);
  let readyForSearch = false;

  function collection() {
    return client.collections(config.collection);
  }

  async function initializeCollection() {
    if (!client) return { enabled: false, ready: false };
    readyForSearch = false;
    try {
      let existing;
      try {
        existing = await collection().retrieve();
      } catch (error) {
        if (error?.httpStatus !== 404) throw error;
        await client.collections().create({
          name: config.collection,
          fields: COLLECTION_FIELDS,
        });
        collectionUsable = true;
        return { enabled: true, ready: true, created: true };
      }

      const existingFields = new Map((existing.fields || []).map(field => [field.name, field.type]));
      const compatible = COLLECTION_FIELDS.every(field => existingFields.get(field.name) === field.type);
      if (!compatible) {
        collectionUsable = false;
        logger.warn('[Typesense] Patient collection schema is incompatible; SQLite search will be used');
        return { enabled: true, ready: false, incompatible: true };
      }
      collectionUsable = true;
      return { enabled: true, ready: true, created: false };
    } catch {
      collectionUsable = false;
      logger.warn('[Typesense] Patient collection initialization unavailable; SQLite search will be used');
      return { enabled: true, ready: false };
    }
  }

  function patientDocument(patient) {
    return {
      id: String(patient.patient_ref),
      patient_ref: String(patient.patient_ref),
      full_name: String(patient.full_name),
    };
  }

  async function indexPatient(patient) {
    if (!client) return { enabled: false, indexed: false };
    try {
      await collection().documents().upsert(patientDocument(patient));
      return { enabled: true, indexed: true };
    } catch (error) {
      readyForSearch = false;
      throw error;
    }
  }

  async function deletePatient(patientRef) {
    if (!client) return { enabled: false, deleted: false };
    try {
      await collection().document(String(patientRef)).delete();
      return { enabled: true, deleted: true };
    } catch (error) {
      readyForSearch = false;
      throw error;
    }
  }

  async function search(query, limit = 50, offset = 0) {
    if (!client || !readyForSearch || !String(query || '').trim()) return null;
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 250);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    const result = await collection().documents().search({
      q: String(query).trim(),
      query_by: 'patient_ref,full_name',
      limit: safeLimit,
      offset: safeOffset,
      typo_tokens_threshold: 1,
    });
    return (result.hits || []).map(hit => hit.document.patient_ref).filter(Boolean);
  }

  async function synchronize(patients) {
    readyForSearch = false;
    const summary = {
      enabled: Boolean(client), total: patients.length, indexed: 0, failed: 0,
      removed: 0, removeFailed: 0, ready: false,
    };
    if (!client || !collectionUsable) return summary;
    const currentReferences = new Set(patients.map(patient => String(patient.patient_ref)));
    for (let index = 0; index < patients.length; index += 1) {
      try {
        await indexPatient(patients[index]);
        summary.indexed += 1;
      } catch {
        summary.failed += patients.length - index;
        break;
      }
    }
    if (summary.failed > 0) return summary;
    try {
      const exported = await collection().documents().export({ include_fields: 'id' });
      const staleIds = String(exported || '').split('\n').filter(Boolean).map(line => {
        const document = JSON.parse(line);
        if (document.id == null) throw new Error('Exported document is missing an ID');
        return String(document.id);
      }).filter(id => !currentReferences.has(id));
      for (const staleId of staleIds) {
        try {
          await collection().document(staleId).delete();
          summary.removed += 1;
        } catch {
          summary.removeFailed += 1;
        }
      }
    } catch {
      summary.removeFailed += 1;
    }
    summary.ready = summary.failed === 0 && summary.removeFailed === 0;
    readyForSearch = summary.ready;
    return summary;
  }

  return {
    isEnabled: () => Boolean(client),
    isReadyForSearch: () => readyForSearch,
    initializeCollection,
    indexPatient,
    deletePatient,
    search,
    synchronize,
    client,
    config,
  };
}

const patientSearch = createPatientSearch();

module.exports = patientSearch;
module.exports.createPatientSearch = createPatientSearch;
module.exports.readConfiguration = readConfiguration;
module.exports.COLLECTION_FIELDS = COLLECTION_FIELDS;
