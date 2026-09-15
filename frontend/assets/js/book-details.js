/**
 * Book Details Controller
 * Supports Member Request flow and Librarian Issue/Edit flows
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const bookId = urlParams.get('id');

  const loadingEl = document.getElementById('bookLoading');
  const errorEl = document.getElementById('bookError');
  const cardEl = document.getElementById('bookDetailsCard');

  if (!bookId) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'flex';
      const msg = errorEl.querySelector('.error-msg');
      if (msg) msg.textContent = 'Book ID is missing from the URL.';
    }
    return;
  }

  try {
    const res = await api.get(`/books/${encodeURIComponent(bookId)}`);
    const book = res.data || res;

    if (!book || !book.id) {
      throw new Error('Book not found');
    }

    if (loadingEl) loadingEl.style.display = 'none';
    if (cardEl) {
      cardEl.style.display = 'block';
      renderBookDetails(book, cardEl);
    }
    document.title = `${book.title} | Digital Librarian`;
  } catch (err) {
    console.error('Failed to load book:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'flex';
      const msg = errorEl.querySelector('.error-msg');
      if (msg) msg.textContent = err.message || 'Book not found in the catalog.';
    }
  }
});

function renderBookDetails(book, container) {
  const user = api.getUser() || {};
  const isMember = (user.role || '').toLowerCase() === 'member';

  const totalCopies = Number(book.total_copies ?? book.quantity ?? 1);
  const availableCopies = Number(book.available_copies ?? book.available ?? 0);
  const isAvailable = availableCopies > 0;

  let availabilityBadge = isAvailable
    ? `<span class="badge badge-success">✓ Available (${availableCopies} copies)</span>`
    : `<span class="badge badge-danger">✕ Checked Out (0 Available)</span>`;

  // Action buttons depending on role
  let actionButtonsHtml = '';
  if (isMember) {
    if (isAvailable) {
      actionButtonsHtml = `
        <button class="btn btn-primary btn-lg" id="btnRequestBookAction" style="display:inline-flex;align-items:center;gap:8px;">
          <span>📖</span> Request This Book
        </button>
        <a href="/available-books.html" class="btn btn-secondary btn-lg" style="display:inline-flex;align-items:center;gap:8px;">
          <span>🔍</span> Back to Catalog
        </a>
      `;
    } else {
      actionButtonsHtml = `
        <button class="btn btn-primary btn-lg" id="btnRequestBookAction" style="display:inline-flex;align-items:center;gap:8px;">
          <span>⏳</span> Request When Available
        </button>
        <a href="/available-books.html" class="btn btn-secondary btn-lg" style="display:inline-flex;align-items:center;gap:8px;">
          <span>🔍</span> Back to Catalog
        </a>
      `;
    }
  } else {
    actionButtonsHtml = `
      <a href="/issue.html?book_id=${encodeURIComponent(book.id)}" class="btn btn-primary ${isAvailable ? '' : 'disabled'}" style="display:inline-flex;align-items:center;gap:8px;">
        <span>📤</span> Issue Book
      </a>
      <a href="/edit-book.html?id=${encodeURIComponent(book.id)}" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:8px;">
        <span>✏️</span> Edit Record
      </a>
      <a href="/books.html" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:8px;">
        <span>←</span> Back to Books
      </a>
    `;
  }

  container.innerHTML = `
    <div class="card" style="padding:32px;margin-bottom:24px;">
      <div style="display:grid;grid-template-columns: 240px 1fr;gap:32px;align-items:start;">
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
          <div style="width:100%;height:320px;background:linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15));border-radius:12px;border:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:64px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);">
            <span>📖</span>
            <span style="font-size:12px;font-weight:600;margin-top:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">${escapeHtml(book.category_name || book.category || 'General')}</span>
          </div>
          <div style="width:100%;text-align:center;">
            ${availabilityBadge}
          </div>

          <!-- Book QR Code Widget -->
          <div style="margin-top:4px;padding:14px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;text-align:center;width:100%;">
            <div style="font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:6px;">
              <span>📱</span> Book QR Code
            </div>
            <div id="bookQRCodeContainer" style="display:flex;justify-content:center;margin:6px 0;"></div>
            <div style="font-size:11.5px;color:var(--text-subtle);font-family:monospace;margin-top:4px;">
              ${escapeHtml(book.book_code || `BK-${String(book.id).padStart(3, '0')}`)} &bull; ID: ${book.id}
            </div>
          </div>
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:12px;">
            <div>
              <span class="badge badge-primary" style="margin-bottom:8px;display:inline-block;">${escapeHtml(book.category_name || book.category || 'General')}</span>
              <h1 style="font-size:28px;font-weight:700;color:var(--text-main);margin-bottom:8px;line-height:1.2;">${escapeHtml(book.title)}</h1>
              <p style="font-size:16px;color:var(--text-muted);margin-bottom:16px;">By <strong style="color:var(--text-main);">${escapeHtml(book.author)}</strong></p>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:16px;margin:24px 0;padding:20px;background:rgba(255,255,255,0.02);border:1px solid var(--border-color);border-radius:10px;">
            <div>
              <div style="font-size:12px;color:var(--text-subtle);text-transform:uppercase;margin-bottom:4px;">ISBN</div>
              <div style="font-weight:600;color:var(--text-main);font-family:monospace;">${escapeHtml(book.isbn || 'N/A')}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-subtle);text-transform:uppercase;margin-bottom:4px;">Publisher</div>
              <div style="font-weight:600;color:var(--text-main);">${escapeHtml(book.publisher || 'N/A')}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-subtle);text-transform:uppercase;margin-bottom:4px;">Year</div>
              <div style="font-weight:600;color:var(--text-main);">${escapeHtml(book.year_published || book.year || 'N/A')}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-subtle);text-transform:uppercase;margin-bottom:4px;">Shelf Location</div>
              <div style="font-weight:600;color:var(--text-main);">${escapeHtml(book.shelf_location || book.location || 'Section A')}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-subtle);text-transform:uppercase;margin-bottom:4px;">Total Copies</div>
              <div style="font-weight:600;color:var(--text-main);">${totalCopies}</div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-subtle);text-transform:uppercase;margin-bottom:4px;">Available Copies</div>
              <div style="font-weight:600;color:${isAvailable ? '#10b981' : '#ef4444'};">${availableCopies}</div>
            </div>
          </div>

          <div style="margin-bottom:32px;">
            <h3 style="font-size:16px;font-weight:600;margin-bottom:8px;color:var(--text-main);">Description / Synopsis</h3>
            <p style="color:var(--text-muted);line-height:1.6;font-size:14px;">
              ${escapeHtml(book.description || 'No detailed synopsis is currently provided for this catalog record.')}
            </p>
          </div>

          <div style="display:flex;gap:12px;align-items:center;padding-top:20px;border-top:1px solid var(--border-color);">
            ${actionButtonsHtml}
          </div>
        </div>
      </div>
    </div>

    <!-- Request Modal for Member -->
    <div id="requestModal" class="modal-overlay">
      <div class="modal-card" style="max-width:500px;">
        <div class="modal-header">
          <h3>📖 Request Book for Borrowing</h3>
          <button type="button" class="modal-close" id="closeModalBtn">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display:flex;gap:14px;margin-bottom:18px;background:rgba(255,255,255,0.02);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-color);">
            <div style="font-size:32px;line-height:1;">📚</div>
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--text-main);line-height:1.3;">${escapeHtml(book.title)}</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">by ${escapeHtml(book.author)}</div>
              <div style="font-size:12px;color:var(--text-subtle);margin-top:4px;">ISBN: ${escapeHtml(book.isbn || '—')} • Shelf: ${escapeHtml(book.shelf_location || 'General')}</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="requestNotes">Optional Note for Librarian</label>
            <textarea id="requestNotes" class="form-control" rows="2" placeholder="e.g., Needed for research, will collect at circulation desk"></textarea>
          </div>

          <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.2);padding:12px;border-radius:var(--radius-md);font-size:12.5px;color:var(--text-muted);line-height:1.4;">
            ℹ️ Your request will be queued for the Librarian. Once approved, you can collect the physical copy at the circulation desk.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" id="cancelRequestBtn" class="btn btn-secondary">Cancel</button>
          <button type="button" id="submitRequestBtn" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;">
            <span>✓</span> Confirm Request
          </button>
        </div>
      </div>
    </div>
  `;

  // Render Book QR Code
  if (window.QRCore) {
    const qrContainer = container.querySelector('#bookQRCodeContainer');
    if (qrContainer) {
      const bookPayload = QRCore.formatBookQR(book.id, book.book_code || `BK-${String(book.id).padStart(3, '0')}`);
      QRCore.renderQRCode(bookPayload, qrContainer, { size: 140, colorDark: '#0f172a' });
    }
  }

  // Wire member request modal
  if (isMember) {
    const btnRequest = document.getElementById('btnRequestBookAction');
    const modal = document.getElementById('requestModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelRequestBtn');
    const submitBtn = document.getElementById('submitRequestBtn');
    const notesInput = document.getElementById('requestNotes');

    if (btnRequest && modal) {
      btnRequest.addEventListener('click', () => {
        openModal('requestModal');
      });
      if (closeBtn) closeBtn.addEventListener('click', () => { closeModal('requestModal'); });
      if (cancelBtn) cancelBtn.addEventListener('click', () => { closeModal('requestModal'); });

      if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:6px;"></div> Submitting...';
          try {
            const notes = notesInput ? notesInput.value.trim() : '';
            await api.post('/loans/request', {
              book_id: book.id,
              notes: notes
            });
            closeModal('requestModal');
            showToast('Book request submitted successfully.', 'success');
            setTimeout(() => {
              window.location.href = '/my-books.html?tab=requests';
            }, 800);
          } catch (err) {
            console.error('Request failed:', err);
            showToast(err.message || 'Failed to submit book request.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirm Request';
          }
        });
      }
    }
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}