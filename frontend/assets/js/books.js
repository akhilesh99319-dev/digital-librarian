/**
 * Books Management: List, Search, Filter, Add, Edit, Delete, View Details
 */

let currentPage = 1;
const pageSize = 15;
let currentCategories = [];
let deleteCandidateBookId = null;

document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadBooks();
  setupEventListeners();
});

function setupEventListeners() {
  const searchInput = document.getElementById('bookSearchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const availabilityFilter = document.getElementById('availabilityFilter');
  const addBookBtn = document.getElementById('addBookBtn');
  const bookForm = document.getElementById('bookForm');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBookBtn');

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentPage = 1;
        loadBooks();
      }, 300);
    });
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      currentPage = 1;
      loadBooks();
    });
  }

  if (availabilityFilter) {
    availabilityFilter.addEventListener('change', () => {
      currentPage = 1;
      loadBooks();
    });
  }

  if (addBookBtn) {
    addBookBtn.addEventListener('click', () => {
      openAddBookModal();
    });
  }

  if (bookForm) {
    bookForm.addEventListener('submit', handleBookFormSubmit);
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', executeDeleteBook);
  }
}

async function loadCategories() {
  try {
    const res = await api.get('/categories');
    if (res.success && res.data) {
      currentCategories = res.data;
      
      const filterSelect = document.getElementById('categoryFilter');
      const formSelect = document.getElementById('bookCategoryId');

      if (filterSelect) {
        filterSelect.innerHTML = '<option value="">All Categories</option>' + 
          currentCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      }

      if (formSelect) {
        formSelect.innerHTML = '<option value="">Select Category...</option>' + 
          currentCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load categories for dropdown:', err);
  }
}

async function loadBooks() {
  const tbody = document.getElementById('booksTableBody');
  const search = document.getElementById('bookSearchInput')?.value || '';
  const categoryId = document.getElementById('categoryFilter')?.value || '';
  const availableOnly = document.getElementById('availabilityFilter')?.value || '';

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="loading-state"><div class="spinner"></div><p>Loading books catalog...</p></div></td></tr>`;
  }

  try {
    const params = {
      search,
      category_id: categoryId,
      available_only: availableOnly,
      page: currentPage,
      limit: pageSize
    };

    const res = await api.get('/books', params);
    if (res.success && res.data) {
      renderBooksTable(res.data);
      renderPagination(res.pagination);
    } else {
      throw new Error(res.message || 'Failed to fetch books');
    }
  } catch (err) {
    console.error('loadBooks error:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="error-state"><p class="error-msg">${err.message}</p><button class="btn btn-sm btn-secondary" onclick="loadBooks()">Retry</button></div></td></tr>`;
    }
  }
}

function renderBooksTable(books) {
  const tbody = document.getElementById('booksTableBody');
  if (!tbody) return;

  if (books.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <div class="empty-icon">📚</div>
            <h4>No Books Found</h4>
            <p>Try adjusting your search query or filter, or add a new book to the library.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = books.map(book => {
    let availBadge = `<span class="badge badge-success">${book.available_copies} / ${book.total_copies} Available</span>`;
    if (book.available_copies === 0) {
      availBadge = `<span class="badge badge-danger">0 / ${book.total_copies} (All on loan)</span>`;
    } else if (book.available_copies < book.total_copies) {
      availBadge = `<span class="badge badge-warning">${book.available_copies} / ${book.total_copies} Available</span>`;
    }

    return `
      <tr>
        <td><strong>${escapeHtml(book.book_code || '')}</strong></td>
        <td>
          <div style="font-weight:600;color:#fff;">${escapeHtml(book.title)}</div>
          <small style="color:#94a3b8;">${escapeHtml(book.author)}</small>
        </td>
        <td><span class="badge badge-secondary">${escapeHtml(book.category_name || 'General')}</span></td>
        <td><code style="color:#a78bfa;">${escapeHtml(book.isbn)}</code></td>
        <td>${availBadge}</td>
        <td><span style="color:#64748b;">${escapeHtml(book.shelf_location || '—')}</span></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-secondary" title="View Details" onclick="viewBookDetails(${book.id})">
              👁️
            </button>
            <button class="btn btn-sm btn-secondary" title="Edit Book" onclick="openEditBookModal(${book.id})">
              ✏️
            </button>
            <button class="btn btn-sm btn-danger" title="Delete Book" onclick="promptDeleteBook(${book.id}, '${escapeHtml(book.title)}')">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination(p) {
  const paginationEl = document.getElementById('booksPagination');
  if (!paginationEl || !p) return;

  if (p.totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }

  paginationEl.style.display = 'flex';
  const startItem = (p.page - 1) * p.limit + 1;
  const endItem = Math.min(p.page * p.limit, p.total);

  paginationEl.innerHTML = `
    <div class="pagination-info">
      Showing <strong>${startItem}</strong> to <strong>${endItem}</strong> of <strong>${p.total}</strong> books
    </div>
    <div class="pagination-btns">
      <button class="btn btn-sm btn-secondary" ${p.page <= 1 ? 'disabled' : ''} onclick="goToPage(${p.page - 1})">
        ← Previous
      </button>
      <button class="btn btn-sm btn-secondary" ${p.page >= p.totalPages ? 'disabled' : ''} onclick="goToPage(${p.page + 1})">
        Next →
      </button>
    </div>
  `;
}

function goToPage(page) {
  currentPage = page;
  loadBooks();
}

function openAddBookModal() {
  const form = document.getElementById('bookForm');
  if (form) form.reset();
  document.getElementById('bookModalId').value = '';
  document.getElementById('bookModalTitle').textContent = 'Add New Book to Library';
  document.getElementById('bookSubmitBtnText').textContent = 'Add Book';
  openModal('bookModal');
}

async function openEditBookModal(bookId) {
  try {
    const res = await api.get(`/books/${bookId}`);
    if (res.success && res.data) {
      const book = res.data;
      document.getElementById('bookModalId').value = book.id;
      document.getElementById('bookTitle').value = book.title;
      document.getElementById('bookAuthor').value = book.author;
      document.getElementById('bookCategoryId').value = book.category_id;
      document.getElementById('bookIsbn').value = book.isbn;
      document.getElementById('bookPublisher').value = book.publisher || '';
      document.getElementById('bookPubYear').value = book.publication_year || '';
      document.getElementById('bookTotalCopies').value = book.total_copies;
      document.getElementById('bookShelf').value = book.shelf_location || '';
      
      document.getElementById('bookModalTitle').textContent = `Edit Book: ${book.title}`;
      document.getElementById('bookSubmitBtnText').textContent = 'Save Changes';
      openModal('bookModal');
    }
  } catch (err) {
    showToast(err.message || 'Failed to load book details for editing', 'error');
  }
}

async function handleBookFormSubmit(e) {
  e.preventDefault();
  const bookId = document.getElementById('bookModalId').value;
  const isEditing = !!bookId;

  const payload = {
    title: document.getElementById('bookTitle').value.trim(),
    author: document.getElementById('bookAuthor').value.trim(),
    category_id: document.getElementById('bookCategoryId').value,
    isbn: document.getElementById('bookIsbn').value.trim(),
    publisher: document.getElementById('bookPublisher').value.trim(),
    publication_year: document.getElementById('bookPubYear').value,
    total_copies: parseInt(document.getElementById('bookTotalCopies').value) || 1,
    shelf_location: document.getElementById('bookShelf').value.trim()
  };

  if (!payload.title || !payload.author || !payload.category_id || !payload.isbn) {
    showToast('Please fill all required fields.', 'warning');
    return;
  }

  const submitBtn = document.getElementById('bookSubmitBtn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (isEditing) {
      const res = await api.put(`/books/${bookId}`, payload);
      showToast(res.message || 'Book updated successfully!', 'success');
    } else {
      const res = await api.post('/books', payload);
      showToast(res.message || 'Book added successfully!', 'success');
    }

    closeModal('bookModal');
    loadBooks();
  } catch (err) {
    showToast(err.message || 'Failed to save book', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function promptDeleteBook(bookId, bookTitle) {
  deleteCandidateBookId = bookId;
  const nameEl = document.getElementById('deleteBookName');
  if (nameEl) nameEl.textContent = bookTitle;
  openModal('deleteBookModal');
}

async function executeDeleteBook() {
  if (!deleteCandidateBookId) return;

  const btn = document.getElementById('confirmDeleteBookBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await api.delete(`/books/${deleteCandidateBookId}`);
    showToast(res.message || 'Book deleted.', 'success');
    closeModal('deleteBookModal');
    loadBooks();
  } catch (err) {
    showToast(err.message || 'Failed to delete book.', 'error');
  } finally {
    if (btn) btn.disabled = false;
    deleteCandidateBookId = null;
  }
}

async function viewBookDetails(bookId) {
  try {
    const res = await api.get(`/books/${bookId}`);
    if (res.success && res.data) {
      const b = res.data;
      const body = document.getElementById('viewBookDetailsBody');
      if (!body) return;

      const activeLoansList = b.active_loans && b.active_loans.length > 0 
        ? b.active_loans.map(l => `
            <li style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;">
              <span><strong>${escapeHtml(l.member_name)}</strong> (${escapeHtml(l.member_code)})</span>
              <span style="color:#94a3b8;">Due: ${formatDate(l.due_date)}</span>
            </li>
          `).join('')
        : `<li style="padding:8px 0;color:#94a3b8;">No copies currently on loan.</li>`;

      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div>
            <h3 style="font-size:18px;color:#fff;margin-bottom:4px;">${escapeHtml(b.title)}</h3>
            <p style="color:#94a3b8;">By ${escapeHtml(b.author)} &bull; ${escapeHtml(b.category_name || 'General')}</p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:rgba(0,0,0,0.2);padding:14px;border-radius:8px;">
            <div><small style="color:#64748b;">Book Code</small><div style="font-weight:600;">${escapeHtml(b.book_code || '—')}</div></div>
            <div><small style="color:#64748b;">ISBN</small><div style="font-weight:600;color:#a78bfa;">${escapeHtml(b.isbn)}</div></div>
            <div><small style="color:#64748b;">Publisher</small><div>${escapeHtml(b.publisher || '—')} (${b.publication_year || '—'})</div></div>
            <div><small style="color:#64748b;">Shelf Location</small><div>${escapeHtml(b.shelf_location || '—')}</div></div>
            <div><small style="color:#64748b;">Total Copies</small><div style="font-weight:700;">${b.total_copies}</div></div>
            <div><small style="color:#64748b;">Available Copies</small><div style="font-weight:700;color:#34d399;">${b.available_copies}</div></div>
          </div>
          <div>
            <h4 style="font-size:14px;color:#fff;margin-bottom:8px;">Currently Issued Copies (${b.active_loans ? b.active_loans.length : 0})</h4>
            <ul style="list-style:none;">${activeLoansList}</ul>
          </div>
        </div>
      `;

      openModal('viewBookModal');
    }
  } catch (err) {
    showToast(err.message || 'Failed to load book details.', 'error');
  }
}
