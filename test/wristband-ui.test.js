'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  printButtonLabel,
  parsePatientId,
  barcodePaths,
  normalizeCopyCount,
  labelCopyModel,
} = require('../public/js/wristband');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'wristband.html');
const CSS_PATH = path.join(ROOT, 'public', 'css', 'wristband.css');
const JS_PATH = path.join(ROOT, 'public', 'js', 'wristband.js');

test('wristband label helpers handle print state and strict record IDs', () => {
  assert.equal(printButtonLabel(0), 'Print Wristband Label');
  assert.equal(printButtonLabel(1), 'Reprint Wristband Label');
  assert.equal(parsePatientId('154'), 154);
  for (const invalid of [null, '', '0', '-1', '1.5', '1e2', 'CLQ-2026-000154']) {
    assert.equal(parsePatientId(invalid), null);
  }
  assert.deepEqual(barcodePaths(154), {
    code128: '/api/wristbands/patients/154/barcode/code128',
    qr: '/api/wristbands/patients/154/barcode/qr',
  });
});

test('one- and four-copy sheets encode the same visible permanent Patient ID', () => {
  assert.equal(normalizeCopyCount(1), 1);
  assert.equal(normalizeCopyCount(4), 4);
  assert.equal(normalizeCopyCount(99), 4);

  const copies = labelCopyModel(154, 'CLQ-2026-000154', 4);
  assert.equal(copies.length, 4);
  assert.deepEqual(new Set(copies.map(copy => copy.patient_ref)), new Set(['CLQ-2026-000154']));
  assert.deepEqual(new Set(copies.map(copy => copy.code128)),
    new Set(['/api/wristbands/patients/154/barcode/code128']));
  assert.deepEqual(new Set(copies.map(copy => copy.qr)),
    new Set(['/api/wristbands/patients/154/barcode/qr']));
});

test('template is a small Patient-ID-only label with Code 128 as primary', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8').toLowerCase();
  const css = fs.readFileSync(CSS_PATH, 'utf8').toLowerCase();
  const js = fs.readFileSync(JS_PATH, 'utf8').toLowerCase();

  assert.match(html, /wristband label preview/);
  assert.match(html, /class="label-patient-ref"/);
  assert.match(html, /primary · code 128/);
  assert.match(html, /print 1 label/);
  assert.match(html, /print 4 labels/);
  assert.match(css, /width:\s*3\.75in/);
  assert.match(css, /height:\s*1\.15in/);
  assert.match(css, /size:\s*letter portrait/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, 3\.75in\)/);
  assert.match(css, /border:\s*1\.5px dashed/);
  assert.doesNotMatch(css, /10in/);

  for (const forbidden of [
    'full name', 'date of birth', 'patient-name', 'patient-dob', 'patient-age',
    'patient-sex', 'address', 'phone number', 'emergency contact',
    'clinical notes', 'medical history', 'medications', 'diagnosis',
    'allergy details', 'allergy_notes', 'staff information',
  ]) {
    assert.equal(html.includes(forbidden), false, `${forbidden} must not appear in label HTML`);
    assert.equal(js.includes(forbidden), false, `${forbidden} must not be rendered by label JavaScript`);
  }

  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:/);
});

test('preview opening is passive and one deliberate click records one request', () => {
  const source = fs.readFileSync(JS_PATH, 'utf8');
  const clickHandler = source.indexOf('printButton.onclick = async () =>');
  const printRequest = source.indexOf('/print-requests');
  const browserPrint = source.indexOf('window.print()');
  assert.ok(clickHandler > -1);
  assert.ok(printRequest > clickHandler, 'preview initialization must not record a request');
  assert.ok(browserPrint > printRequest, 'tracking must succeed before the print dialog opens');
  assert.equal(source.indexOf('/print-requests', printRequest + 1), -1,
    'one click must issue only one tracking request even when printing four copies');
  assert.equal(source.indexOf('window.print()', browserPrint + 1), -1);
});
