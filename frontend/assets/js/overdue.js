/**
 * Overdue Books Controller: Track overdue loans, calculate accumulated fines, and process returns
 */

let overdueLoansList = [];
let selectedReturnLoan = null;

document.addEventListener('DOMContentLoaded', () => {
  loadOverdueLoans();
  setupEventListeners();
});

function setupEventListeners() {
  const searchInput = document.getElementById('overdueSearchInput');
  const returnForm = document.getElementById('processReturnForm');
  const returnDateInput = document.getElementById('modalReturnDate');

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadOverdueLoans();
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

async function loadOverdueLoans() {
  const tbody = document.getElementById('overdueTableBody');
  const search = document.getElementById('overdueSearchInput')?.value || '';

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="loading-state"><div class="spinner"></div><p>Checking overdue records...</p></div></td></tr>`;
  }

  try {
    const res = await api.get('/loans/overdue', { search, limit: 100 });
    if (res.success && res.data) {
      overdueLoansList = res.data;
      renderOverdueTable(res.data);

      const fineRateBanner = document.getElementById('currentFineRateText');
      if (fineRateBanner) {
        fineRateBanner.textContent = `Fine calculation standard: ₹${res.fine_rate_per_day || 5} per overdue day`;
      }
    } else {
      throw new Error(res.message || 'Failed to load overdue books');
    }
  } catch (err) {
    console.error('loadOverdueLoans error:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="error-state"><p class="error-msg">${err.message}</p><button class="btn btn-sm btn-secondary" onclick="loadOverdueLoans()">Retry</button></div></td></tr>`;
    }
  }
}

function renderOverdueTable(loans) {
  const tbody = document.getElementById('overdueTableBody');
  if (!tbody) return;

  if (loans.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-icon" style="color:#10b981;">🎉</div>
            <h4>No Overdue Books</h4>
            <p>Great! All borrowed library books are currently within their due dates.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = loans.map(l => `
    <tr>
      <td><strong>${escapeHtml(l.loan_code)}</strong></td>
      <td>
        <div style="font-weight:600;color:#fff;">${escapeHtml(l.book_title)}</div>
        <small style="color:#94a3b8;">${escapeHtml(l.book_code || '')} &bull; Shelf: ${escapeHtml(l.shelf_location || '—')}</small>
      </td>
      <td>
        <div>${escapeHtml(l.member_name)}</div>
        <small style="color:#94a3b8;">${escapeHtml(l.member_code)} &bull; ${escapeHtml(l.member_phone)}</small>
      </td>
      <td><span style="color:#fb7185;font-weight:600;">${formatDate(l.due_date)}</span></td>
      <td><span class="badge badge-danger">${l.days_overdue} Days Overdue</span></td>
      <td><strong style="color:#fb7185;font-size:15px;">₹${l.fine_amount.toFixed(2)}</strong></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openReturnModal(${l.id})">
          🔄 Return & Collect Fine
        </button>
      </td>
    </tr>
  `).join('');
}

function openReturnModal(loanId) {
  selectedReturnLoan = overdueLoansList.find(l => l.id === loanId);
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
  document.getElementById('modalFinePaidCheckbox').checked = true; // default checked on overdue collect

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
  const rate = selectedReturnLoan.fine_rate || 5;

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
      showToast(res.message || 'Book returned and fine updated!', 'success');
      closeModal('returnBookModal');
      loadOverdueLoans();
    }
  } catch (err) {
    showToast(err.message || 'Failed to process return.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
