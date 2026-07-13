'use strict';

const byId = id => document.getElementById(id);

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value == null ? '—' : String(value);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

function showFatal(title, message, unauthorized = false) {
  byId('label-page').classList.add('hidden');
  byId('page-state').classList.remove('hidden');
  setText('state-title', title);
  setText('state-message', message);
  byId('state-login').classList.toggle('hidden', !unauthorized);
}

function showMessage(message, tone = 'error') {
  const element = byId('page-message');
  element.textContent = message;
  element.className = `message no-print ${tone === 'warning' ? 'warning' : ''}`.trim();
}

function clearMessage() {
  byId('page-message').className = 'message hidden no-print';
  byId('page-message').textContent = '';
}

function loadBarcode(image, path) {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Barcode image failed to load'));
    image.src = path;
  });
}

function printButtonLabel(count) {
  return Number(count) > 0 ? 'Reprint Wristband Label' : 'Print Wristband Label';
}

function parsePatientId(value) {
  if (!/^[1-9]\d*$/.test(String(value || ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function barcodePaths(patientId) {
  return {
    code128: `/api/wristbands/patients/${patientId}/barcode/code128`,
    qr: `/api/wristbands/patients/${patientId}/barcode/qr`,
  };
}

function normalizeCopyCount(value) {
  return Number(value) === 1 ? 1 : 4;
}

function labelCopyModel(patientId, patientRef, count) {
  const paths = barcodePaths(patientId);
  return Array.from({ length: normalizeCopyCount(count) }, () => ({
    patient_ref: patientRef,
    code128: paths.code128,
    qr: paths.qr,
  }));
}

let renderVersion = 0;

async function renderLabels(patientId, patientRef, count) {
  const version = ++renderVersion;
  const grid = byId('labels-grid');
  grid.replaceChildren();
  const copies = labelCopyModel(patientId, patientRef, count);
  grid.classList.toggle('single-copy', copies.length === 1);

  const primaryLoads = [];
  const backupLoads = [];
  for (const copy of copies) {
    const fragment = byId('label-template').content.cloneNode(true);
    fragment.querySelector('.label-patient-ref').textContent = copy.patient_ref;
    const code128 = fragment.querySelector('.code128-image');
    const qr = fragment.querySelector('.qr-image');
    primaryLoads.push(loadBarcode(code128, copy.code128).catch(error => {
      code128.classList.add('hidden');
      code128.parentElement.querySelector('.code128-error').classList.remove('hidden');
      throw error;
    }));
    backupLoads.push(loadBarcode(qr, copy.qr).catch(error => {
      qr.classList.add('hidden');
      qr.parentElement.querySelector('.qr-error').classList.remove('hidden');
      throw error;
    }));
    grid.appendChild(fragment);
  }

  const [primary, backup] = await Promise.all([
    Promise.allSettled(primaryLoads),
    Promise.allSettled(backupLoads),
  ]);
  if (version !== renderVersion) return null;
  return {
    primaryReady: primary.every(result => result.status === 'fulfilled'),
    backupReady: backup.every(result => result.status === 'fulfilled'),
  };
}

async function initialize() {
  const rawId = new URLSearchParams(window.location.search).get('patient');
  const patientId = parsePatientId(rawId);
  if (!patientId) {
    showFatal('Invalid wristband label link', 'The URL does not contain a valid patient record ID.');
    return;
  }

  let patient;
  try {
    patient = await api(`/api/wristbands/patients/${patientId}`);
  } catch (error) {
    if (error.status === 401) {
      showFatal('Sign in required', 'Your Cliniq session has expired. Sign in before viewing a wristband label.', true);
    } else if (error.status === 404) {
      showFatal('Patient not found', 'No patient exists for this wristband label link.');
    } else {
      showFatal('Unable to load wristband label', error.message);
    }
    return;
  }

  const printCount = Number(patient.wristband?.print_count || 0);
  setText('print-count', printCount);
  setText('print-button', printButtonLabel(printCount));
  byId('page-state').classList.add('hidden');
  byId('label-page').classList.remove('hidden');

  const printButton = byId('print-button');
  const copySelect = byId('copy-count');

  const refreshLabels = async () => {
    printButton.disabled = true;
    clearMessage();
    setText('print-button', 'Preparing barcode…');
    const readiness = await renderLabels(patientId, patient.patient_ref, copySelect.value);
    if (!readiness) return;
    if (!readiness.primaryReady) {
      showMessage('Code 128 could not be generated for every label. Printing is disabled.');
      setText('print-button', 'Barcode unavailable');
      return;
    }
    if (!readiness.backupReady) {
      showMessage('A backup QR code is unavailable. The primary Code 128 labels are ready to print.', 'warning');
    }
    setText('print-button', printButtonLabel(byId('print-count').textContent));
    printButton.disabled = false;
  };

  copySelect.onchange = refreshLabels;
  await refreshLabels();

  printButton.onclick = async () => {
    printButton.disabled = true;
    const previousLabel = printButton.textContent;
    setText('print-button', 'Recording print request…');
    clearMessage();
    let result;
    try {
      // One deliberate click creates one request, regardless of copy count.
      result = await api(`/api/wristbands/patients/${patientId}/print-requests`, {
        method: 'POST',
        body: '{}',
      });
    } catch (error) {
      if (error.status === 401) {
        showFatal('Sign in required', 'Your session expired before the print request was recorded. Sign in and try again.', true);
        printButton.disabled = false;
        return;
      }
      showMessage(`Print request was not recorded: ${error.message}. Please try again.`);
      setText('print-button', previousLabel);
      printButton.disabled = false;
      return;
    }

    setText('print-count', result.print_count);
    setText('print-button', printButtonLabel(result.print_count));
    try {
      window.print();
    } catch {
      showMessage('The print request was recorded, but the browser could not open its print dialog. Try printing from the browser menu.');
    }
    printButton.disabled = false;
  };
}

if (typeof document !== 'undefined') {
  byId('back-button').onclick = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign('/');
  };
  initialize();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    printButtonLabel,
    parsePatientId,
    barcodePaths,
    normalizeCopyCount,
    labelCopyModel,
  };
}
