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
const ROUTE_PATH = path.join(ROOT, 'routes', 'wristband.routes.js');
const APP_PATH = path.join(ROOT, 'public', 'js', 'app.js');

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

test('template proportionally preserves the original dual-barcode horizontal label', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8').toLowerCase();
  const css = fs.readFileSync(CSS_PATH, 'utf8').toLowerCase();
  const js = fs.readFileSync(JS_PATH, 'utf8').toLowerCase();

  assert.match(html, /wristband label preview/);
  assert.match(html, /class="label-patient-ref"/);
  assert.match(html, />code 128</);
  assert.match(html, /class="code128-image"/);
  assert.match(html, /class="qr-image"/);
  assert.match(html, /class="label-qr"/);
  assert.match(html, />primary scan</);
  assert.match(html, /print 1 label/);
  assert.match(html, /print 4 labels/);
  assert.match(html, /print at 100% or actual size\. do not use fit to page\. turn off browser headers and footers\./);
  assert.match(css, /\.barcode-label\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) \.54in;[^}]*gap:\s*\.03in;[^}]*width:\s*3in;[^}]*height:\s*\.9in;[^}]*padding:\s*\.035in;/s);
  assert.doesNotMatch(css, /3\.75in|1\.15in/);
  assert.match(css, /size:\s*letter portrait/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, 3in\)/);
  assert.match(css, /border:\s*1\.25px dashed/);
  assert.match(css, /\*\s*\{\s*box-sizing:\s*border-box;/);
  assert.match(css, /page-break-inside:\s*avoid/);
  assert.match(css, /\.code128-image\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;[^}]*object-fit:\s*contain;/s);
  assert.doesNotMatch(css, /\.code128-image\s*\{[^}]*padding:/s);
  assert.match(css, /\.label-qr\s*\{[^}]*border-left:\s*1px solid/s);
  assert.match(css, /\.label-qr\s*\{[^}]*padding:\s*\.015in 0 \.015in \.04in;[^}]*background:\s*#fff;/s);
  assert.match(css, /\.qr-image\s*\{[^}]*width:\s*\.48in;[^}]*height:\s*\.48in;[^}]*aspect-ratio:\s*1 \/ 1;[^}]*object-fit:\s*contain;/s);
  assert.doesNotMatch(css, /transform:\s*scale|object-fit:\s*fill/);
  assert.doesNotMatch(css, /image-rendering:\s*(?:auto|smooth)/);
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

test('printed QR payload and retained backend/scanner formats use permanent Patient IDs', () => {
  const routeSource = fs.readFileSync(ROUTE_PATH, 'utf8');
  const scannerSource = fs.readFileSync(APP_PATH, 'utf8');

  assert.match(routeSource, /bcid:\s*'qrcode',\s*text:\s*patient\.patient_ref/);
  assert.match(routeSource, /bcid:\s*'code128',\s*text:\s*patient\.patient_ref/);
  assert.match(scannerSource, /BarcodeFormat\.QR_CODE/);
  assert.match(scannerSource, /BarcodeFormat\.CODE_128/);
});

test('registration and patient reprint actions share the complete label preview', () => {
  const source = fs.readFileSync(APP_PATH, 'utf8');
  const openerStart = source.indexOf('function openWristbandLabel(patientId)');
  const openerEnd = source.indexOf("$('modal-close').onclick", openerStart);
  const openerSource = source.slice(openerStart, openerEnd);

  assert.ok(openerStart > -1 && openerEnd > openerStart);
  assert.match(openerSource, /Number\.isSafeInteger\(id\)/);
  assert.match(openerSource, /window\.open\(`\/wristband\.html\?patient=\$\{encodeURIComponent\(String\(id\)\)\}`, '_blank'\)/);
  assert.doesNotMatch(openerSource, /barcode\/code128|barcode\/qr|\.svg/);
  assert.match(source, /\$\('pv-wristband'\)\.onclick = \(\) => openWristbandLabel\(id\)/);
  assert.match(source, /\$\('reg-print-wristband'\)\.onclick = \(\) => openWristbandLabel\(created\.id\)/);
  assert.equal((source.match(/openWristbandLabel\(/g) || []).length, 3,
    'only the shared function and its two approved callers should exist');
  assert.match(source, /count > 0 \? 'Reprint Wristband Label' : 'Print Wristband Label'/);
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
