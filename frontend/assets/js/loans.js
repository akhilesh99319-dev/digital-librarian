/**
 * Active Loans Controller
 */

let currentPage = 1;
const pageSize = 15;
let currentLoansList = [];
let selectedReturnLoan = null;

document.addEventListener('DOMContentLoaded', () => {
  loadActiveLoans();
  setupEventListeners();
});

function setupEventListeners() {
  const searchInput = document.getElementById('loansSearchInput');
  const overdueFilter = document.getElementById('loansOverdueFilter');
  const returnForm = document.getElementById('processReturnForm');
  const returnDateInput = document.getElementById('modalReturnDate');

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentPage = 1;
        loadActiveLoans();
      }, 300);
    });
  }

  if (overdueFilter) {
    overdueFilter.addEventListener('change', () => {
      currentPage = 1;
      loadActiveLoans();
    });
  }

  if (returnDateInput) {
    returnDateInput.addEventListener('change', updateModalFineCalculation);
  }

  if (returnForm) {
    returnForm.addEventListener('submit', handleReturnSubmit);
  }
}

async function loadActiveLoans() {
  const tbody = document.getElementById('activeLoansTableBody');
  const search = document.getElementById('loansSearchInput')?.value || '';
  const overdueOnly = document.getElementById('loansOverdueFilter')?.value || '';

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="loading-state"><div class="spinner"></div><p>Loading active loans...</p></div></td></tr>`;
  }

  try {
    const res = await api.get('/loans/active', {
      search,
      overdue_only: overdueOnly,
      page: currentPage,
      limit: pageSize
    });

    if (res.success && res.data) {
      currentLoansList = res.data;
      renderLoansTable(res.data);
      renderPagination(res.pagination);
    } else {
      throw new Error(res.message || 'Failed to fetch loans');
    }
  } catch (err) {
    console.error('loadActiveLoans error:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="error-state"><p class="error-msg">${err.message}</p><button class="btn btn-sm btn-secondary" onclick="loadActiveLoans()">Retry</button></div></td></tr>`;
    }
  }
}

function renderLoansTable(loans) {
  const tbody = document.getElementById('activeLoansTableBody');
  if (!tbody) return;

  if (loans.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-icon">📖</div>
            <h4>No Active Loans</h4>
            <p>No books are currently checked out matching the filter criteria.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = loans.map(l => {
    let statusBadge = `<span class="badge badge-info">Issued (On Time)</span>`;
    let fineInfo = `—`;

    if (l.is_overdue) {
      statusBadge = `<span class="badge badge-danger">Overdue (${l.days_overdue} days)</span>`;
      fineInfo = `<span style="color:#fb7185;font-weight:700;">₹${l.calculated_fine.toFixed(2)}</span>`;
    }

    return `
      <tr>
        <td><strong>${escapeHtml(l.loan_code)}</strong></td>
        <td>
          <div style="font-weight:600;color:#fff;">${escapeHtml(l.book_title)}</div>
          <small style="color:#94a3b8;">${escapeHtml(l.book_code || '')} &bull; ${escapeHtml(l.shelf_location || '')}</small>
        </td>
        <td>
          <div>${escapeHtml(l.member_name)}</div>
          <small style="color:#94a3b8;">${escapeHtml(l.member_code)} &bull; ${escapeHtml(l.member_phone)}</small>
        </td>
        <td>${formatDate(l.issue_date)}</td>
        <td><span style="color:${l.is_overdue ? '#fb7185' : '#38bdf8'};font-weight:600;">${formatDate(l.due_date)}</span></td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="openReturnModal(${l.id})">
            🔄 Return Book
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination(p) {
  const el = document.getElementById('loansPagination');
  if (!el || !p) return;

  if (p.totalPages <= 1) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'flex';
  const startItem = (p.page - 1) * p.limit + 1;
  const endItem = Math.min(p.page * p.limit, p.total);

  el.innerHTML = `
    <div class="pagination-info">
      Showing <strong>${startItem}</strong> to <strong>${endItem}</strong> of <strong>${p.total}</strong> active loans
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
  loadActiveLoans();
}

function openReturnModal(loanId) {
  selectedReturnLoan = currentLoansList.find(l => l.id === loanId);
  if (!selectedReturnLoan) return;

  const todayStr = new Date().toISOString().split('T')[0];

  document.getElementById('modalReturnLoanId').value = selectedReturnLoan.id;
  document.getElementById('modalReturnBookTitle').textContent = selectedReturnLoan.book_title;
  document.getElementById('modalReturnMemberName').textContent = `${selectedReturnLoan.member_name} (${selectedReturnLoan.member_code})`;
  document.getElementById('modalReturnIssueDate').textContent = formatDate(selectedReturnLoan.issue_date);
  document.getElementById('modalReturnDueDate').textContent = formatDate(selectedReturnLoan.due_date);
  
  const returnDateInput = document.getElementById('modalReturnDate');
  returnDateInput.value = todayStr;

  document.getElementById('modalReturnNotes').value = '';
  document.getElementById('modalFinePaidCheckbox').checked = false;

  updateModalFineCalculation();
  openModal('returnBookModal');
}

function updateModalFineCalculation() {
  if (!selectedReturnLoan) return;

  const returnDateVal = document.getElementById('modalReturnDate').value;
  const dueDateVal = selectedReturnLoan.due_date;

  const fineBox = document.getElementById('modalFineSummaryBox');
  const fineAmountEl = document.getElementById('modalFineAmount');
  const fineDaysEl = document.getElementById('modalFineDays');
  const finePaidContainer = document.getElementById('modalFinePaidContainer');

  if (!returnDateVal || !dueDateVal) return;

  const returnDate = new Date(returnDateVal);
  returnDate.setHours(0, 0, 0, 0);

  const dueDate = new Date(dueDateVal);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = returnDate.getTime() - dueDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const rate = selectedReturnLoan.fine_rate_per_day || 5;

  if (diffDays > 0) {
    const fineTotal = diffDays * rate;
    fineAmountEl.textContent = `₹${fineTotal.toFixed(2)}`;
    fineDaysEl.textContent = `${diffDays} days late (Rate: ₹${rate}/day)`;
    fineBox.style.display = 'block';
    finePaidContainer.style.display = 'flex';
  } else {
    fineBox.style.display = 'none';
    finePaidContainer.style.display = 'none';
  }
}

async function handleReturnSubmit(e) {
  e.preventDefault();

  if (!selectedReturnLoan) return;

  const returnDate = document.getElementById('modalReturnDate').value;
  const finePaid = document.getElementById('modalFinePaidCheckbox').checked ? 1 : 0;
  const notes = document.getElementById('modalReturnNotes').value.trim();

  const btn = document.getElementById('btnConfirmReturn');
  if (btn) btn.disabled = true;

  try {
    const res = await api.post(`/loans/${selectedReturnLoan.id}/return`, {
      return_date: returnDate,
      fine_paid: finePaid,
      notes
    });

    if (res.success) {
      showToast(res.message || 'Book returned successfully!', 'success');
      closeModal('returnBookModal');
      loadActiveLoans();
    }
  } catch (err) {
    showToast(err.message || 'Failed to process return.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
