/**
 * Member Available Books & Book Request Controller
 * Digital Librarian System
 */

let allBooks = [];
let allCategories = [];
let myActiveRequests = new Set();
let selectedBookForRequest = null;

document.addEventListener('DOMContentLoaded', () => {
  initAvailableBooksPage();
});

async function initAvailableBooksPage() {
  setupEventListeners();
  await loadCategories();
  await loadMyActiveRequests();
  await loadBooksCatalog();
}

function setupEventListeners() {
  const searchInput = document.getElementById('bookSearchInput');
  const catFilter = document.getElementById('categoryFilter');
  const availFilter = document.getElementById('availabilityFilter');
  const resetBtn = document.getElementById('btnResetFilters');
  const confirmReqBtn = document.getElementById('btnConfirmRequest');

  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        applyFilters();
      }, 250);
    });
  }

  if (catFilter) catFilter.addEventListener('change', applyFilters);
  if (availFilter) availFilter.addEventListener('change', applyFilters);
  if (resetBtn) resetBtn.addEventListener('click', resetFilters);

  if (confirmReqBtn) {
    confirmReqBtn.addEventListener('click', handleConfirmRequest);
  }
}

async function loadCategories() {
  try {
    const res = await api.get('/categories');
    if (res.success && Array.isArray(res.data)) {
      allCategories = res.data;
      const catSelect = document.getElementById('categoryFilter');
      if (catSelect) {
        catSelect.innerHTML = '<option value="all">All Categories</option>' +
          allCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      }
    }
  } catch (err) {
    console.warn('Failed to load categories:', err);
  }
}

async function loadMyActiveRequests() {
  try {
    const res = await api.get('/loans/my-requests');
    if (res.success && Array.isArray(res.data)) {
      myActiveRequests = new Set(
        res.data
          .filter(r => r.status === 'Pending' || r.status === 'Approved')
          .map(r => r.book_id)
      );
    }
  } catch (err) {
    console.warn('Failed to check active member requests:', err);
  }
}

async function loadBooksCatalog() {
  const loadingEl = document.getElementById('booksLoading');
  const errorEl = document.getElementById('booksError');
  const gridEl = document.getElementById('booksGrid');
  const emptyEl = document.getElementById('booksEmpty');

  if (loadingEl) loadingEl.style.display = 'flex';
  if (errorEl) errorEl.style.display = 'none';
  if (gridEl) gridEl.style.display = 'none';
  if (emptyEl) emptyEl.style.display = 'none';

  try {
    const res = await api.get('/books', { limit: 500 });
    if (res.success && Array.isArray(res.data)) {
      allBooks = res.data;
      applyFilters();
      if (loadingEl) loadingEl.style.display = 'none';
    } else {
      throw new Error(res.message || 'Failed to retrieve catalog data.');
    }
  } catch (err) {
    console.error('Failed to load books catalog:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'flex';
  }
}

function applyFilters() {
  const searchInput = document.getElementById('bookSearchInput');
  const catFilter = document.getElementById('categoryFilter');
  const availFilter = document.getElementById('availabilityFilter');

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const selectedCat = catFilter ? catFilter.value : 'all';
  const selectedAvail = availFilter ? availFilter.value : 'all';

  let filtered = allBooks.filter(b => {
    // Search query match
    if (query) {
      const matchTitle = (b.title || '').toLowerCase().includes(query);
      const matchAuthor = (b.author || '').toLowerCase().includes(query);
      const matchIsbn = (b.isbn || '').toLowerCase().includes(query);
      const matchCode = (b.book_code || '').toLowerCase().includes(query);
      if (!matchTitle && !matchAuthor && !matchIsbn && !matchCode) return false;
    }

    // Category match
    if (selectedCat !== 'all') {
      if (String(b.category_id) !== String(selectedCat)) return false;
    }

    // Availability match
    if (selectedAvail === 'available') {
      if (Number(b.available_copies || 0) <= 0) return false;
    } else if (selectedAvail === 'unavailable') {
      if (Number(b.available_copies || 0) > 0) return false;
    }

    return true;
  });

  renderBooks(filtered);
}

function renderBooks(books) {
  const gridEl = document.getElementById('booksGrid');
  const emptyEl = document.getElementById('booksEmpty');
  const countEl = document.getElementById('displayedCount');
  const totalCopiesEl = document.getElementById('totalAvailableCopies');

  if (countEl) countEl.textContent = books.length;

  const totalCopies = books.reduce((sum, b) => sum + Number(b.available_copies || 0), 0);
  if (totalCopiesEl) totalCopiesEl.textContent = totalCopies;

  if (!gridEl) return;

  if (books.length === 0) {
    gridEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  gridEl.style.display = 'grid';

  gridEl.innerHTML = books.map(book => {
    const avail = Number(book.available_copies || 0);
    const total = Number(book.total_copies || 1);
    const isRequested = myActiveRequests.has(book.id);

    let availClass = 'in-stock';
    let availLabel = `${avail} of ${total} Copies Available`;

    if (avail === 0) {
      availClass = 'out-of-stock';
      availLabel = 'Out of Stock (0 Copies)';
    } else if (avail <= 2) {
      availClass = 'low-stock';
      availLabel = `Low Stock (${avail} Left)`;
    }

    const catName = book.category_name || (allCategories.find(c => c.id === book.category_id)?.name) || 'General';

    let requestBtnHtml = '';
    if (isRequested) {
      requestBtnHtml = `
        <button type="button" class="btn btn-sm btn-secondary" style="background:rgba(245,158,11,0.15);color:#fbbf24;border-color:rgba(245,158,11,0.3);" disabled>
          ⏳ Request Pending
        </button>
      `;
    } else if (avail <= 0) {
      requestBtnHtml = `
        <button type="button" class="btn btn-sm btn-secondary" disabled style="opacity:0.6;">
          Unavailable
        </button>
      `;
    } else {
      requestBtnHtml = `
        <button type="button" class="btn btn-sm btn-primary" onclick="openRequestModal(${book.id})">
          <span>📖</span> Request Book
        </button>
      `;
    }

    return `
      <div class="book-card" data-book-id="${book.id}">
        <div class="book-card-header">
          <div class="book-card-icon">📘</div>
          <div style="flex:1;min-width:0;">
            <a href="/book-details.html?id=${book.id}" style="text-decoration:none;color:inherit;" title="View book details">
              <div class="book-card-title">${escapeHtml(book.title)}</div>
            </a>
            <div class="book-card-author">by ${escapeHtml(book.author || 'Unknown Author')}</div>
          </div>
        </div>

        <div class="book-meta-grid">
          <div class="book-meta-item">
            <span class="book-meta-label">Category</span>
            <span class="book-meta-value">${escapeHtml(catName)}</span>
          </div>
          <div class="book-meta-item">
            <span class="book-meta-label">Shelf Location</span>
            <span class="book-meta-value">${escapeHtml(book.shelf_location || '—')}</span>
          </div>
          <div class="book-meta-item">
            <span class="book-meta-label">ISBN</span>
            <span class="book-meta-value" style="font-family:monospace;font-size:11.5px;">${escapeHtml(book.isbn || '—')}</span>
          </div>
          <div class="book-meta-item">
            <span class="book-meta-label">Book Code</span>
            <span class="book-meta-value" style="color:#a78bfa;">${escapeHtml(book.book_code || '—')}</span>
          </div>
        </div>

        <div class="book-card-actions">
          <span class="availability-pill ${availClass}">
            ${availLabel}
          </span>
          <div style="display:flex;align-items:center;gap:6px;">
            <a href="/book-details.html?id=${book.id}" class="btn btn-sm btn-secondary" title="View details and synopsis">
              Details
            </a>
            ${requestBtnHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function resetFilters() {
  const searchInput = document.getElementById('bookSearchInput');
  const catFilter = document.getElementById('categoryFilter');
  const availFilter = document.getElementById('availabilityFilter');

  if (searchInput) searchInput.value = '';
  if (catFilter) catFilter.value = 'all';
  if (availFilter) availFilter.value = 'available';

  applyFilters();
}

function openRequestModal(bookId) {
  const book = allBooks.find(b => b.id === bookId);
  if (!book) return;

  selectedBookForRequest = book;

  document.getElementById('reqModalBookTitle').textContent = book.title;
  document.getElementById('reqModalBookAuthor').textContent = `by ${book.author || 'Unknown Author'}`;
  document.getElementById('reqModalBookMeta').textContent = `ISBN: ${book.isbn || '—'} • Shelf: ${book.shelf_location || 'General'} • Code: ${book.book_code || ''}`;
  
  const notesEl = document.getElementById('reqMemberNotes');
  if (notesEl) notesEl.value = '';

  const confirmBtn = document.getElementById('btnConfirmRequest');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm Request';
  }

  openModal('requestBookModal');
}

async function handleConfirmRequest() {
  if (!selectedBookForRequest) return;

  const confirmBtn = document.getElementById('btnConfirmRequest');
  const notesEl = document.getElementById('reqMemberNotes');
  const notes = notesEl ? notesEl.value.trim() : '';

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:6px;"></div> Submitting...';
  }

  try {
    const res = await api.post('/loans/request', {
      book_id: selectedBookForRequest.id,
      notes
    });

    if (res.success) {
      showToast(res.message || 'Book Request Submitted Successfully!', 'success');
      myActiveRequests.add(selectedBookForRequest.id);
      closeModal('requestBookModal');
      applyFilters();
    } else {
      showToast(res.message || 'Failed to submit request.', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Failed to submit book request.', 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm Request';
    }
  }
}