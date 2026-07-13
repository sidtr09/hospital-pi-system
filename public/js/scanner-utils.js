'use strict';

(function exposeScannerUtils(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CliniqScannerUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function scannerUtilsFactory() {
  const PUBLIC_ID_PATTERN = /^(?:CLQ-\d{4}-\d{6,}|PAT-[A-Z0-9](?:[A-Z0-9-]{1,38}[A-Z0-9])?)$/;
  const INSECURE_CAMERA_MESSAGE = 'Live camera scanning requires a secure HTTPS connection on this device. You can still enter the Patient ID manually.';

  function normalizePatientId(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase();
    return PUBLIC_ID_PATTERN.test(normalized) ? normalized : null;
  }

  function createDuplicateGuard(cooldownMs = 3500, now = () => Date.now()) {
    let lastValue = null;
    let lastAcceptedAt = 0;
    return {
      accept(value) {
        const timestamp = now();
        if (value === lastValue && timestamp - lastAcceptedAt < cooldownMs) return false;
        lastValue = value;
        lastAcceptedAt = timestamp;
        return true;
      },
      reset() {
        lastValue = null;
        lastAcceptedAt = 0;
      },
    };
  }

  function cameraAvailability(isSecureContext, mediaDevices) {
    if (!isSecureContext || !mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
      return { available: false, message: INSECURE_CAMERA_MESSAGE };
    }
    return { available: true, message: '' };
  }

  function cameraErrorMessage(error) {
    const name = error?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Camera permission was denied. Allow camera access in the browser, or enter the Patient ID manually.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No camera was found on this device. Enter the Patient ID manually.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'The camera is already in use or unavailable. Close other camera apps and try again.';
    }
    if (name === 'OverconstrainedError') {
      return 'The selected camera is no longer available. Choose another camera and try again.';
    }
    if (name === 'SecurityError') return INSECURE_CAMERA_MESSAGE;
    if (name === 'AbortError') {
      return 'The camera disconnected before scanning completed. Reconnect it or enter the Patient ID manually.';
    }
    return 'Camera unavailable. Check browser permissions or enter the Patient ID manually.';
  }

  function lookupErrorMessage(status) {
    if (status === 404) return 'Patient not found.';
    if (status === 401) return 'Your Cliniq session expired. Sign in and try again.';
    return 'Lookup request failed. Check the Patient ID and try again.';
  }

  function stopMediaStream(stream) {
    if (!stream || typeof stream.getTracks !== 'function') return 0;
    const tracks = stream.getTracks();
    for (const track of tracks) {
      try { track.stop(); } catch {}
    }
    return tracks.length;
  }

  return {
    PUBLIC_ID_PATTERN,
    INSECURE_CAMERA_MESSAGE,
    normalizePatientId,
    createDuplicateGuard,
    cameraAvailability,
    cameraErrorMessage,
    lookupErrorMessage,
    stopMediaStream,
  };
});
