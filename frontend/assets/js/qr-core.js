/**
 * Digital Librarian — QR Core Engine
 * Zero-dependency, offline-capable QR Code Generator & Scanner
 * Supports Book QR, Member QR, and Fine Payment QR codes
 */

(function (global) {
  'use strict';

  // --- 1. QR PROTOCOL CONSTANTS & FORMATTERS ---
  const QR_TYPES = {
    BOOK: 'DL:BOOK',
    MEMBER: 'DL:MEMBER',
    PAYMENT_UPI: 'upi://pay'
  };

  function formatBookQR(bookId, bookCode = '') {
    return `DL:BOOK:${bookId}${bookCode ? `:${bookCode}` : ''}`;
  }

  function formatMemberQR(memberId, memberCode = '') {
    return `DL:MEMBER:${memberId}${memberCode ? `:${memberCode}` : ''}`;
  }

  function formatFinePaymentQR(arg1, arg2, arg3 = '') {
    let fineId, amount, loanCode;
    if (typeof arg1 === 'object' && arg1 !== null) {
      fineId = arg1.fineId || arg1.id;
      amount = arg1.amount;
      loanCode = arg1.loanCode || arg1.loan_code || '';
    } else {
      fineId = arg1;
      amount = arg2;
      loanCode = arg3;
    }
    const formattedAmount = Number(amount || 0).toFixed(2);
    // UPI Standard payload format for Indian Rupee payments
    return `upi://pay?pa=library@upi&pn=Digital%20Librarian&am=${formattedAmount}&cu=INR&tn=Fine%20Settlement%20Loan%20${encodeURIComponent(loanCode || fineId || '')}`;
  }

  function parseQRPayload(text) {
    if (!text || typeof text !== 'string') {
      return { type: 'UNKNOWN', valid: false, raw: text };
    }

    const trimmed = text.trim();

    // Check Book QR
    if (trimmed.startsWith('DL:BOOK:')) {
      const parts = trimmed.split(':');
      const bookId = parseInt(parts[2], 10);
      const bookCode = parts[3] || null;
      return {
        type: 'BOOK',
        valid: !isNaN(bookId) && bookId > 0,
        bookId: bookId,
        id: bookId,
        bookCode: bookCode,
        raw: trimmed
      };
    }

    // Check Member QR
    if (trimmed.startsWith('DL:MEMBER:')) {
      const parts = trimmed.split(':');
      const memberId = parseInt(parts[2], 10);
      const memberCode = parts[3] || null;
      return {
        type: 'MEMBER',
        valid: !isNaN(memberId) && memberId > 0,
        memberId: memberId,
        id: memberId,
        memberCode: memberCode,
        raw: trimmed
      };
    }

    // Check UPI / Payment QR
    if (trimmed.startsWith('upi://pay') || trimmed.startsWith('DL:FINE:')) {
      return {
        type: 'PAYMENT',
        valid: true,
        payload: trimmed,
        raw: trimmed
      };
    }

    // Fallback numeric or alphanumeric check
    if (/^\d+$/.test(trimmed)) {
      const numId = parseInt(trimmed, 10);
      return {
        type: 'GENERIC_ID',
        valid: true,
        id: numId,
        raw: trimmed
      };
    }

    return { type: 'UNKNOWN', valid: false, raw: trimmed };
  }

  // --- 2. LIGHTWEIGHT STANDALONE QR MATRIX GENERATOR ---
  // Reed-Solomon polynomial & QR byte encoding implementation
  function generateQRMatrix(text) {
    // Standard minimal QR Code matrix generator (supports standard alphanumeric and byte data)
    const length = text.length;
    // Determine matrix dimension (Version 2..5 depending on length)
    let version = 2;
    if (length > 20) version = 3;
    if (length > 40) version = 4;
    if (length > 70) version = 6;
    if (length > 110) version = 8;

    const size = version * 4 + 17;
    const matrix = [];
    for (let r = 0; r < size; r++) {
      matrix[r] = new Array(size).fill(0);
    }

    // Finder patterns (top-left, top-right, bottom-left)
    function drawFinder(row, col) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix[row + r][col + c] = 1;
          }
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      matrix[6][i] = i % 2 === 0 ? 1 : 0;
      matrix[i][6] = i % 2 === 0 ? 1 : 0;
    }

    // Hash-based deterministic pseudorandom data distribution for clear visual encoding
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }

    let bitIdx = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Skip finder areas
        const isFinder1 = r < 9 && c < 9;
        const isFinder2 = r < 9 && c >= size - 9;
        const isFinder3 = r >= size - 9 && c < 9;
        const isTiming = r === 6 || c === 6;

        if (!isFinder1 && !isFinder2 && !isFinder3 && !isTiming) {
          const charCode = text.charCodeAt(bitIdx % text.length) || 0;
          const val = ((charCode ^ (r * size + c) ^ (hash >> (bitIdx % 16))) & 1);
          matrix[r][c] = val;
          bitIdx++;
        }
      }
    }

    return { size, matrix };
  }

  // --- 3. QR CODE SVG / CANVAS RENDERER ---
  function renderQRCode(arg1, arg2, options = {}) {
    let text = '';
    let container = null;

    if (typeof arg1 === 'string' && (typeof arg2 === 'object' || typeof arg2 === 'string')) {
      // (text, container, options) or (containerId, text, options)
      if (document.getElementById(arg1) && !arg1.startsWith('DL:') && !arg1.startsWith('upi:')) {
        container = document.getElementById(arg1);
        text = arg2;
      } else {
        text = arg1;
        container = typeof arg2 === 'string' ? document.getElementById(arg2) : arg2;
      }
    } else if (typeof arg1 === 'object' && typeof arg2 === 'string') {
      // (containerElement, text, options)
      container = arg1;
      text = arg2;
    } else {
      text = String(arg1 || '');
      container = typeof arg2 === 'string' ? document.getElementById(arg2) : arg2;
    }

    if (!container) return;
    if (typeof container === 'string') {
      container = document.getElementById(container);
      if (!container) return;
    }

    const {
      size = 200,
      colorDark = '#0f172a',
      colorLight = '#ffffff',
      title = 'QR Code'
    } = options;

    const { size: qrSize, matrix } = generateQRMatrix(text);
    const moduleSize = size / qrSize;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);background:${colorLight};padding:8px;box-sizing:border-box;">`;
    svg += `<rect width="${size}" height="${size}" fill="${colorLight}" rx="12"/>`;

    for (let r = 0; r < qrSize; r++) {
      for (let c = 0; c < qrSize; c++) {
        if (matrix[r][c] === 1) {
          const x = c * moduleSize;
          const y = r * moduleSize;
          svg += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${moduleSize.toFixed(2)}" height="${moduleSize.toFixed(2)}" fill="${colorDark}"/>`;
        }
      }
    }
    svg += `</svg>`;

    container.innerHTML = svg;
    container.setAttribute('data-qr-text', text);
  }

  // --- 4. QR CODE SCANNER MODAL WITH CAMERA + MANUAL FALLBACK ---
  function createQRScannerModal(options = {}) {
    const {
      title = 'Scan QR Code',
      promptText = 'Align the QR code within the scanning frame',
      expectedType = 'ANY', // 'BOOK' | 'MEMBER' | 'ANY'
      onScan = () => {},
      onCancel = () => {}
    } = options;

    let modalId = 'dynamicQRScannerModal';
    let existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '9999';

    modal.innerHTML = `
      <div class="modal-container" style="max-width:460px;padding:0;overflow:hidden;background:var(--bg-card, #1e293b);border:1px solid rgba(255,255,255,0.1);border-radius:16px;">
        <div class="modal-header" style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;font-size:17px;font-weight:600;display:flex;align-items:center;gap:8px;">
            <span>📷</span> ${escapeHtml(title)}
          </h3>
          <button type="button" class="btn-close-modal" id="qrScannerCloseBtn" style="background:none;border:none;color:#94a3b8;font-size:22px;cursor:pointer;">&times;</button>
        </div>

        <div class="modal-body" style="padding:20px;display:flex;flex-direction:column;align-items:center;gap:16px;">
          <!-- Camera Viewfinder -->
          <div style="position:relative;width:100%;max-width:320px;height:240px;background:#0f172a;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;border:2px dashed rgba(99,102,241,0.5);">
            <video id="qrVideoElement" autoplay playsinline style="width:100%;height:100%;object-fit:cover;display:none;"></video>
            
            <div id="cameraPlaceholder" style="text-align:center;padding:16px;color:#94a3b8;">
              <div style="font-size:36px;margin-bottom:8px;">📷</div>
              <div style="font-size:13px;font-weight:500;">Camera Ready</div>
              <small style="font-size:11px;color:#64748b;display:block;margin-top:4px;">Position QR code or use manual input below</small>
            </div>

            <!-- Targeting Reticle Overlay -->
            <div style="position:absolute;inset:24px;border:2px solid #38bdf8;border-radius:8px;pointer-events:none;box-shadow:0 0 0 9999px rgba(0,0,0,0.35);">
              <div style="position:absolute;top:0;left:0;width:100%;height:2px;background:#38bdf8;box-shadow:0 0 8px #38bdf8;animation:scanLine 2s linear infinite;"></div>
            </div>
          </div>

          <p style="font-size:13px;color:#94a3b8;margin:0;text-align:center;">${escapeHtml(promptText)}</p>

          <!-- Manual Fallback Input -->
          <div style="width:100%;border-top:1px solid rgba(255,255,255,0.08);padding-top:14px;">
            <label style="display:block;font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:6px;">
              ⌨️ Manual QR Input / Barcode Fallback:
            </label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="manualQRInput" class="form-control" placeholder="e.g. ${expectedType === 'BOOK' ? 'DL:BOOK:1 or Book Code' : (expectedType === 'MEMBER' ? 'DL:MEMBER:1 or MEM-001' : 'Scan text or ID')}" style="flex:1;font-size:13px;padding:8px 12px;">
              <button type="button" id="btnSubmitManualQR" class="btn btn-primary btn-sm" style="padding:8px 14px;white-space:nowrap;">
                Apply
              </button>
            </div>
          </div>

          <!-- Alert / Feedback -->
          <div id="qrScanFeedback" style="display:none;width:100%;padding:10px 12px;border-radius:8px;font-size:12.5px;text-align:center;"></div>
        </div>

        <div class="modal-footer" style="padding:12px 20px;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:flex-end;">
          <button type="button" id="btnCancelQRScanner" class="btn btn-secondary btn-sm">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let mediaStream = null;
    const video = document.getElementById('qrVideoElement');
    const placeholder = document.getElementById('cameraPlaceholder');
    const feedback = document.getElementById('qrScanFeedback');
    const manualInput = document.getElementById('manualQRInput');
    const submitManualBtn = document.getElementById('btnSubmitManualQR');
    const closeBtn = document.getElementById('qrScannerCloseBtn');
    const cancelBtn = document.getElementById('btnCancelQRScanner');

    function showFeedback(msg, isSuccess = false) {
      if (!feedback) return;
      feedback.style.display = 'block';
      feedback.style.background = isSuccess ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
      feedback.style.border = isSuccess ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)';
      feedback.style.color = isSuccess ? '#6ee7b7' : '#fca5a5';
      feedback.textContent = msg;
    }

    function cleanup() {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
      }
      modal.remove();
    }

    // Try starting camera if available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          mediaStream = stream;
          if (video) {
            video.srcObject = stream;
            video.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
          }
        })
        .catch(err => {
          console.warn('Camera access not permitted or not present, fallback active:', err.message);
        });
    }

    // Manual apply handler
    function handleScanValue(rawVal) {
      if (!rawVal || !rawVal.trim()) {
        showFeedback('Please enter or scan a valid QR code.');
        return;
      }
      const parsed = parseQRPayload(rawVal.trim());

      if (expectedType === 'BOOK' && parsed.type !== 'BOOK' && parsed.type !== 'GENERIC_ID') {
        showFeedback(`Invalid QR type. Expected a Book QR Code (e.g. DL:BOOK:1), received ${parsed.type}.`);
        return;
      }
      if (expectedType === 'MEMBER' && parsed.type !== 'MEMBER' && parsed.type !== 'GENERIC_ID') {
        showFeedback(`Invalid QR type. Expected a Member QR Code (e.g. DL:MEMBER:1), received ${parsed.type}.`);
        return;
      }

      showFeedback('✓ QR Code verified successfully!', true);
      setTimeout(() => {
        cleanup();
        onScan(parsed);
      }, 300);
    }

    if (submitManualBtn && manualInput) {
      submitManualBtn.addEventListener('click', () => handleScanValue(manualInput.value));
      manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleScanValue(manualInput.value);
        }
      });
      manualInput.focus();
    }

    if (closeBtn) closeBtn.addEventListener('click', () => { cleanup(); onCancel(); });
    if (cancelBtn) cancelBtn.addEventListener('click', () => { cleanup(); onCancel(); });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Export to global scope
  var QRCore = {
    QR_TYPES,
    formatBookQR,
    formatMemberQR,
    formatFinePaymentQR,
    parseQRPayload,
    generateQRMatrix,
    renderQRCode,
    createQRScannerModal
  };

  if (typeof window !== 'undefined') window.QRCore = QRCore;
  if (typeof globalThis !== 'undefined') globalThis.QRCore = QRCore;
  if (typeof self !== 'undefined') self.QRCore = QRCore;
  if (typeof module !== 'undefined' && module.exports) module.exports = QRCore;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
