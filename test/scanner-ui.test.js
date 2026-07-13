'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  INSECURE_CAMERA_MESSAGE,
  normalizePatientId,
  createDuplicateGuard,
  cameraAvailability,
  cameraErrorMessage,
  lookupErrorMessage,
  stopMediaStream,
} = require('../public/js/scanner-utils');

const ROOT = path.join(__dirname, '..');

test('scanner accepts only normalized CLQ and legacy PAT Patient IDs', () => {
  assert.equal(normalizePatientId('  clq-2026-000154 '), 'CLQ-2026-000154');
  assert.equal(normalizePatientId('pat-2025-0042'), 'PAT-2025-0042');
  for (const invalid of [
    null, '', 'CLQ-2026-154', 'PAT---', 'https://cliniq.local/patient/1',
    '{"patient":"CLQ-2026-000154"}', 'Penicillin allergy', '123456',
  ]) {
    assert.equal(normalizePatientId(invalid), null);
  }
});

test('duplicate scans are suppressed during cooldown and reset deliberately', () => {
  let now = 1000;
  const guard = createDuplicateGuard(3500, () => now);
  assert.equal(guard.accept('CLQ-2026-000154'), true);
  now += 100;
  assert.equal(guard.accept('CLQ-2026-000154'), false);
  assert.equal(guard.accept('PAT-2025-0042'), true);
  now += 4000;
  assert.equal(guard.accept('CLQ-2026-000154'), true);
  guard.reset();
  assert.equal(guard.accept('CLQ-2026-000154'), true);
});

test('camera availability, errors and cleanup are explicit', () => {
  assert.deepEqual(cameraAvailability(false, { getUserMedia() {} }), {
    available: false, message: INSECURE_CAMERA_MESSAGE,
  });
  assert.deepEqual(cameraAvailability(true, null), {
    available: false, message: INSECURE_CAMERA_MESSAGE,
  });
  assert.deepEqual(cameraAvailability(true, { getUserMedia() {} }), {
    available: true, message: '',
  });
  assert.match(cameraErrorMessage({ name: 'NotAllowedError' }), /permission was denied/i);
  assert.match(cameraErrorMessage({ name: 'NotFoundError' }), /No camera/i);
  assert.match(cameraErrorMessage({ name: 'NotReadableError' }), /already in use/i);
  assert.equal(cameraErrorMessage({ name: 'SecurityError' }), INSECURE_CAMERA_MESSAGE);

  let stopped = 0;
  const count = stopMediaStream({ getTracks: () => [
    { stop() { stopped++; } }, { stop() { stopped++; } },
  ] });
  assert.equal(count, 2);
  assert.equal(stopped, 2);
});

test('lookup errors distinguish missing patients and expired sessions', () => {
  assert.equal(lookupErrorMessage(404), 'Patient not found.');
  assert.match(lookupErrorMessage(401), /session expired/i);
  assert.match(lookupErrorMessage(500), /Lookup request failed/i);
});

test('scanner page is offline, format-restricted and uses one backend trust path', () => {
  const appSource = fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const scannerStart = appSource.indexOf("PAGES['scan-wristband']");
  const scannerEnd = appSource.indexOf('// Re-run the active patient search', scannerStart);
  const scannerSource = appSource.slice(scannerStart, scannerEnd);

  assert.ok(scannerStart > -1 && scannerEnd > scannerStart);
  assert.match(scannerSource, /BarcodeFormat\.CODE_128/);
  assert.match(scannerSource, /BarcodeFormat\.QR_CODE/);
  assert.match(scannerSource, /reader\.possibleFormats/);
  assert.equal((scannerSource.match(/\/wristbands\/scan/g) || []).length, 1);
  assert.match(scannerSource, /processPatientId\(manualInput\.value, 'manual'\)/);
  assert.match(scannerSource, /currentPageCleanup/);
  assert.match(scannerSource, /cameraRequestVersion/);
  assert.match(scannerSource, /stopMediaStream/);
  assert.match(scannerSource, /URL\.createObjectURL/);
  assert.match(scannerSource, /URL\.revokeObjectURL/);
  assert.doesNotMatch(scannerSource, /FormData|\/upload|console\./);
  assert.doesNotMatch(scannerSource, /https?:\/\//);

  assert.match(indexHtml, /src="\/vendor\/zxing-browser\.min\.js\?v=0\.1\.5"/);
  assert.match(indexHtml, /src="\/js\/scanner-utils\.js\?v=1"/);
  assert.doesNotMatch(indexHtml, /unpkg|jsdelivr|cdnjs/);

  // Start Camera is invoked only by explicit controls, selection changes, or
  // the deliberate Scan Another action—not during initial page rendering.
  assert.equal((scannerSource.match(/startCamera\(/g) || []).length, 4);
});
