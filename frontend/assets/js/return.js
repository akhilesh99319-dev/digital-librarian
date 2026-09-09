/**
 * Return Book Workflow Controller
 */

let activeLoansList = [];
let selectedReturnLoan = null;

document.addEventListener('DOMContentLoaded', () => {
  loadActiveLoansForReturn();
  setupEventListeners();
});

function setupEventListeners() {
  const searchInput = document.getElementById('returnSearchInput');
  const returnForm = document.getElementById('processReturnForm');
  const returnDateInput = document.getElementById('modalReturnDate');

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadActiveLoansForReturn();
      }, 300);
    });
  }

  if (returnDateInput) {
    returnDateInput.addEventListener('change', updateModalFineCalculation);
  }

  if (returnForm) {
    returnForm.addEventListener('submit', handleReturnSubmit);
  }
}

async function loadActiveLoansForReturn() {
  const tbody = document.getElementById('returnLoansTableBody');
  const search = document.getElementById('returnSearchInput')?.value || '';

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="loading-state"><div class="spinner"></div><p>Searching active loans...</p></div></td></tr>`;
  }

  try {
    const res = await api.get('/loans/active', { search, limit: 100 });
    if (res.success && res.data) {
      activeLoansList = res.data;
      renderReturnLoansTable(res.data);
    } else {
      throw new Error(res.message || 'Failed to load loans');
    }
  } catch (err) {
    console.error('loadActiveLoansForReturn error:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="error-state"><p class="error-msg">${err.message}</p></div></td></tr>`;
    }
  }
}

function renderReturnLoansTable(loans) {
  const tbody = document.getElementById('returnLoansTableBody');
  if (!tbody) return;

  if (loans.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-icon">📖</div>
            <h4>No Active Loans Matching Query</h4>
            <p>All books are currently returned or try searching with a different keyword.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = loans.map(loan => {
    let statusBadge = `<span class="badge badge-info">Issued</span>`;
    let fineText = `<span style="color:#64748b;">₹0.00</span>`;

    if (loan.is_overdue) {
      statusBadge = `<span class="badge badge-danger">Overdue (${loan.days_overdue} days)</span>`;
      fineText = `<strong style="color:#fb7185;">₹${loan.calculated_fine.toFixed(2)}</strong>`;
    }

    return `
      <tr>
        <td><strong>${escapeHtml(loan.loan_code)}</strong></td>
        <td>
          <div style="font-weight:600;color:#fff;">${escapeHtml(loan.book_title)}</div>
          <small style="color:#94a3b8;">${escapeHtml(loan.book_code || '')} &bull; ${escapeHtml(loan.shelf_location || '')}</small>
        </td>
        <td>
          <div>${escapeHtml(loan.member_name)}</div>
          <small style="color:#94a3b8;">${escapeHtml(loan.member_code)} &bull; ${escapeHtml(loan.member_phone)}</small>
        </td>
        <td>${formatDate(loan.issue_date)}</td>
        <td><span style="color:${loan.is_overdue ? '#fb7185' : '#38bdf8'};font-weight:600;">${formatDate(loan.due_date)}</span></td>
        <td>${statusBadge} &bull; ${fineText}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="openReturnModal(${loan.id})">
            🔄 Return Book
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openReturnModal(loanId) {
  selectedReturnLoan = activeLoansList.find(l => l.id === loanId);
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
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:6px;"></div> Processing Return...';
  }

  try {
    const res = await api.post(`/loans/${selectedReturnLoan.id}/return`, {
      return_date: returnDate,
      fine_paid: finePaid,
      notes
    });

    if (res.success) {
      showToast(res.message || 'Book returned successfully!', 'success');
      closeModal('returnBookModal');
      loadActiveLoansForReturn();
    }
  } catch (err) {
    showToast(err.message || 'Failed to process return.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Confirm Book Return';
    }
  }
}
