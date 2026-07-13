'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');
const SCHEMA = path.join(ROOT, 'database', 'schema.sql');

function openDatabase(file) {
  return new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(file, err => err ? reject(err) : resolve(connection));
  });
}

function execSql(connection, sql) {
  return new Promise((resolve, reject) => {
    connection.exec(sql, err => err ? reject(err) : resolve());
  });
}

function runSql(connection, sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.run(sql, params, err => err ? reject(err) : resolve());
  });
}

function closeDatabase(connection) {
  return new Promise((resolve, reject) => {
    connection.close(err => err ? reject(err) : resolve());
  });
}

async function seedLegacyPatient(dbPath) {
  const connection = await openDatabase(dbPath);
  try {
    await execSql(connection, fs.readFileSync(SCHEMA, 'utf8'));
    await runSql(connection,
      `INSERT INTO patients (patient_ref, full_name, date_of_birth, sex)
       VALUES (?, ?, ?, ?)`,
      ['PAT-2025-0042', 'Legacy Demo Patient', '1988-04-12', 'F']);
  } finally {
    await closeDatabase(connection);
  }
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(err => err ? reject(err) : resolve(port));
    });
  });
}

async function startServer(dbPath) {
  const port = await availablePort();
  const child = spawn(process.execPath, [SERVER], {
    cwd: os.tmpdir(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: String(port),
      DB_PATH: dbPath,
      SESSION_SECRET: 'stage-one-test-secret-not-for-production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out:\n${output}`)), 10000);
    const inspect = () => {
      if (output.includes('Cliniq running on')) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on('data', inspect);
    child.stderr.on('data', inspect);
    child.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`Server exited during startup (${code}):\n${output}`));
    });
  });

  return {
    child,
    baseUrl: `http://127.0.0.1:${port}`,
    output: () => output,
  };
}

async function stopServer(instance) {
  if (!instance || instance.child.exitCode != null) return;
  const exited = new Promise(resolve => instance.child.once('exit', resolve));
  instance.child.kill('SIGTERM');
  let timerHandle;
  const timer = new Promise(resolve => {
    timerHandle = setTimeout(() => resolve('timeout'), 8000);
  });
  const result = await Promise.race([exited, timer]);
  clearTimeout(timerHandle);
  if (result === 'timeout') {
    instance.child.kill('SIGKILL');
    await exited;
    throw new Error(`Server did not shut down cleanly:\n${instance.output()}`);
  }
}

async function request(instance, method, route, body, cookie) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const response = await fetch(instance.baseUrl + route, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function login(instance) {
  const { response, data } = await request(instance, 'POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123',
  });
  assert.equal(response.status, 200, JSON.stringify(data));
  return response.headers.get('set-cookie').split(';', 1)[0];
}

test('server-generated Patient IDs are unique and persist across restart', { timeout: 30000 }, async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cliniq-stage1-'));
  const dbPath = path.join(tempDir, 'hospital.db');
  let server;

  try {
    await seedLegacyPatient(dbPath);
    server = await startServer(dbPath);
    assert.match(server.output(), /\[DB\] Patient count: 1/);
    let cookie = await login(server);

    const registrations = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      request(server, 'POST', '/api/patients', {
        patient_ref: `CLIENT-SUPPLIED-${index}`,
        full_name: `Persistence Patient ${index}`,
        date_of_birth: `199${index}-01-02`,
        sex: index % 2 ? 'F' : 'M',
      }, cookie)
    ));

    for (const { response, data } of registrations) {
      assert.equal(response.status, 201, JSON.stringify(data));
      assert.match(data.patient_ref, /^CLQ-\d{4}-\d{6,}$/);
      assert.doesNotMatch(data.patient_ref, /^CLIENT-SUPPLIED-/);
    }

    const refs = registrations.map(result => result.data.patient_ref);
    assert.equal(new Set(refs).size, refs.length, 'every generated Patient ID must be unique');
    const first = registrations[0].data;

    await stopServer(server);
    server = await startServer(dbPath);
    assert.match(server.output(), /\[DB\] Patient count: 9/);
    cookie = await login(server);

    const persisted = await request(server, 'GET', `/api/patients/${first.id}`, undefined, cookie);
    assert.equal(persisted.response.status, 200, JSON.stringify(persisted.data));
    assert.equal(persisted.data.patient_ref, first.patient_ref);
    assert.equal(persisted.data.full_name, 'Persistence Patient 0');

    const legacy = await request(server, 'GET', '/api/patients?q=PAT-2025-0042&limit=5', undefined, cookie);
    assert.equal(legacy.response.status, 200, JSON.stringify(legacy.data));
    assert.equal(legacy.data.data[0].patient_ref, 'PAT-2025-0042');

    const next = await request(server, 'POST', '/api/patients', {
      full_name: 'Post Restart Patient',
      date_of_birth: '2001-03-04',
      sex: 'O',
    }, cookie);
    assert.equal(next.response.status, 201, JSON.stringify(next.data));
    assert.match(next.data.patient_ref, /^CLQ-\d{4}-\d{6,}$/);
    assert.ok(!refs.includes(next.data.patient_ref));

    const originalAgain = await request(server, 'GET', `/api/patients/${first.id}`, undefined, cookie);
    assert.equal(originalAgain.data.patient_ref, first.patient_ref);
  } finally {
    if (server?.child.exitCode == null) await stopServer(server);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
