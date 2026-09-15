/**
 * Member Personal Loans & Circulation History Controller
 * Digital Librarian System
 */

let myLoansData = {
  active_loans: [],
  loan_history: [],
  fines: [],
  book_requests: [],
  metrics: {}
};

document.addEventListener('DOMContentLoaded', () => {
  initMyBooksPage();
});

async function initMyBooksPage() {
  setupTabs();
  await loadMyLoansData();
}

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'active';

  function activateTab(targetTab) {
    tabBtns.forEach(b => {
      if (b.getAttribute('data-tab') === targetTab) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });

    const activeContent = document.getElementById(`tabContent${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`);
    if (activeContent) {
      activeContent.style.display = 'block';
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      activateTab(targetTab);
    });
  });

  if (initialTab && initialTab !== 'active') {
    activateTab(initialTab);
  }
}

async function loadMyLoansData() {
  try {
    const res = await api.get('/loans/my-loans');
    if (res.success && res.data) {
      myLoansData = res.data;

      updateSummaryMetrics(myLoansData.metrics || {});
      renderActiveLoans(myLoansData.active_loans || []);
      renderRequests(myLoansData.book_requests || []);
      renderHistory(myLoansData.loan_history || []);
      renderFines(myLoansData.fines || []);
    } else {
      throw new Error(res.message || 'Failed to load borrowing records.');
    }
  } catch (err) {
    console.error('Failed to load my loans data:', err);
    showToast('Failed to retrieve personal circulation records.', 'error');
  }
}

function updateSummaryMetrics(m) {
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('statActiveLoans', m.active_loans_count || 0);
  setEl('statPendingRequests', m.pending_requests_count || 0);
  setEl('statTotalBorrowed', m.total_borrowed_count || 0);
  setEl('statOverdue', m.overdue_count || 0);

  setEl('badgeActiveCount', m.active_loans_count || 0);
  setEl('badgeRequestsCount', (myLoansData.book_requests || []).length);
  setEl('badgeHistoryCount', (myLoansData.loan_history || []).length);
  setEl('badgeFinesCount', (myLoansData.fines || []).length);

  const overdueSub = document.getElementById('statOverdueSub');
  if (overdueSub) {
    if ((m.overdue_count || 0) > 0) {
      overdueSub.textContent = `${m.overdue_count} book(s) overdue`;
      overdueSub.style.color = '#fb7185';
      overdueSub.style.fontWeight = '600';
    } else {
      overdueSub.textContent = 'All on schedule';
      overdueSub.style.color = '';
      overdueSub.style.fontWeight = '';
    }
  }
}

function getDueStatus(dueDateStr) {
  if (!dueDateStr) return { label: '—', badgeClass: 'due-badge ok', isOverdue: false };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      label: `Overdue (${overdueDays}d ago)`,
      badgeClass: 'due-badge overdue',
      isOverdue: true
    };
  } else if (diffDays === 0) {
    return {
      label: 'Due Today',
      badgeClass: 'due-badge soon',
      isOverdue: false
    };
  } else if (diffDays <= 3) {
    return {
      label: `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`,
      badgeClass: 'due-badge soon',
      isOverdue: false
    };
  } else {
    return {
      label: `Due in ${diffDays} days`,
      badgeClass: 'due-badge ok',
      isOverdue: false
    };
  }
}

function renderActiveLoans(loans) {
  const tbody = document.getElementById('myActiveLoansTbody');
  if (!tbody) return;

  if (loans.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding:0;">
          <div style="padding:48px 16px;text-align:center;">
            <div style="font-size:36px;margin-bottom:10px;">📚</div>
            <h4 style="color:var(--text-main);font-size:16px;font-weight:700;margin-bottom:6px;">No Active Borrowings</h4>
            <p style="color:var(--text-muted);font-size:13.5px;max-width:400px;margin:0 auto 16px auto;">
              You do not have any books currently checked out. Browse the available catalog to find books you would like to read.
            </p>
            <a href="/available-books.html" class="btn btn-sm btn-primary">
              <span>🔍</span> Browse Available Books
            </a>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = loans.map(l => {
    const dueInfo = getDueStatus(l.due_date);
    let badge = `<span class="badge badge-info">Issued</span>`;
    if (dueInfo.isOverdue || l.status === 'Overdue') {
      badge = `<span class="badge badge-danger">Overdue</span>`;
    }

    const fineAmount = parseFloat(l.fine_amount) || 0;

    return `
      <tr>
        <td><strong>${escapeHtml(l.loan_code || 'LN-***')}</strong></td>
        <td>
          <div style="font-weight:600;color:var(--text-main);">${escapeHtml(l.book_title || 'Untitled Book')}</div>
          <small style="color:var(--text-muted);">by ${escapeHtml(l.book_author || 'Unknown Author')} • ${escapeHtml(l.book_code || '')}</small>
        </td>
        <td>${formatDate(l.issue_date)}</td>
        <td><strong>${formatDate(l.due_date)}</strong></td>
        <td><span class="${dueInfo.badgeClass}">${dueInfo.label}</span></td>
        <td>${badge}</td>
        <td>
          <span style="color:${fineAmount > 0 ? '#fb7185' : 'var(--text-muted)'};font-weight:${fineAmount > 0 ? '700' : '500'};">
            ${fineAmount > 0 ? formatCurrency(fineAmount) : '₹0.00'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRequests(requests) {
  const tbody = document.getElementById('myRequestsTbody');
  if (!tbody) return;

  if (requests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:0;">
          <div style="padding:48px 16px;text-align:center;">
            <div style="font-size:36px;margin-bottom:10px;">📋</div>
            <h4 style="color:var(--text-main);font-size:16px;font-weight:700;margin-bottom:6px;">No Book Requests Placed</h4>
            <p style="color:var(--text-muted);font-size:13.5px;max-width:400px;margin:0 auto 16px auto;">
              When you request books from the available catalog, they will appear here along with their review and issue status.
            </p>
            <a href="/available-books.html" class="btn btn-sm btn-primary">
              <span>🔍</span> Explore Books Catalog
            </a>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = requests.map(r => {
    let statusBadge = '';
    if (r.status === 'Pending') {
      statusBadge = '<span class="badge badge-warning" style="background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);">⏳ Pending Review</span>';
    } else if (r.status === 'Approved') {
      statusBadge = '<span class="badge badge-success">✅ Approved for Collection</span>';
    } else if (r.status === 'Rejected') {
      statusBadge = '<span class="badge badge-danger">❌ Declined</span>';
    } else if (r.status === 'Issued') {
      statusBadge = '<span class="badge badge-info">📖 Issued to Account</span>';
    } else {
      statusBadge = `<span class="badge badge-secondary">${escapeHtml(r.status)}</span>`;
    }

    let noteText = r.notes ? escapeHtml(r.notes) : '—';
    if (r.rejection_reason) {
      noteText = `<span style="color:#fb7185;">Reason: ${escapeHtml(r.rejection_reason)}</span>`;
    }

    return `
      <tr>
        <td><strong>#REQ-${r.id}</strong></td>
        <td>
          <div style="font-weight:600;color:var(--text-main);">${escapeHtml(r.book_title || 'Untitled Book')}</div>
          <small style="color:var(--text-muted);">by ${escapeHtml(r.book_author || '—')}</small>
        </td>
        <td>${formatDate(r.request_date)}</td>
        <td>${statusBadge}</td>
        <td style="max-width:240px;font-size:12.5px;">${noteText}</td>
        <td>
          ${r.status === 'Approved' ? '<span style="color:#38bdf8;font-weight:600;font-size:12px;">Visit Desk to Collect</span>' : '<span style="color:var(--text-subtle);font-size:12px;">Queued</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function renderHistory(history) {
  const tbody = document.getElementById('myHistoryTbody');
  if (!tbody) return;

  if (history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding:0;">
          <div style="padding:48px 16px;text-align:center;">
            <div style="font-size:36px;margin-bottom:10px;">🕒</div>
            <h4 style="color:var(--text-main);font-size:16px;font-weight:700;margin-bottom:6px;">No Past Borrowing Records</h4>
            <p style="color:var(--text-muted);font-size:13.5px;max-width:400px;margin:0 auto;">
              Returned books will be saved in your personal reading history.
            </p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = history.map(h => {
    const finePaid = h.fine_amount > 0 ? (h.fine_paid ? '<span class="badge badge-success">Fine Paid</span>' : '<span class="badge badge-danger">Fine Unpaid</span>') : '<span style="color:var(--text-subtle);font-size:12px;">None</span>';

    return `
      <tr>
        <td><strong>${escapeHtml(h.loan_code || 'LN-***')}</strong></td>
        <td>
          <div style="font-weight:600;color:var(--text-main);">${escapeHtml(h.book_title || 'Untitled Book')}</div>
          <small style="color:var(--text-muted);">${escapeHtml(h.book_author || '')}</small>
        </td>
        <td>${formatDate(h.issue_date)}</td>
        <td>${formatDate(h.due_date)}</td>
        <td><strong>${formatDate(h.return_date)}</strong></td>
        <td><span class="badge badge-success">Returned</span></td>
        <td>${finePaid}</td>
      </tr>
    `;
  }).join('');
}

let currentPayingFine = null;

function renderFines(fines) {
  const tbody = document.getElementById('myFinesTbody');
  if (!tbody) return;

  if (fines.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding:0;">
          <div style="padding:48px 16px;text-align:center;">
            <div style="font-size:36px;margin-bottom:10px;color:#10b981;">✓</div>
            <h4 style="color:var(--text-main);font-size:16px;font-weight:700;margin-bottom:6px;">Zero Outstanding Fines</h4>
            <p style="color:var(--text-muted);font-size:13.5px;max-width:400px;margin:0 auto;">
              Your account has no pending late fees or penalty dues. Keep returning books on time!
            </p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = fines.map(f => {
    const isPaid = f.status === 'Paid';
    const actionHtml = isPaid
      ? `<span style="color:#10b981;font-size:12px;font-weight:600;">✓ Settled</span>`
      : `<button type="button" class="btn btn-sm btn-primary btn-pay-fine" data-fine-id="${f.id}" style="font-size:12px;padding:4px 10px;background:linear-gradient(135deg,#10b981,#059669);border-color:#10b981;">
          📱 Pay Fine
        </button>`;

    return `
      <tr>
        <td><strong>#FN-${f.id}</strong></td>
        <td>${escapeHtml(f.loan_code || '—')}</td>
        <td>${escapeHtml(f.book_title || 'Overdue Book')}</td>
        <td>${f.days_overdue} days</td>
        <td style="font-weight:700;color:${isPaid ? '#34d399' : '#fb7185'};">${formatCurrency(f.amount)}</td>
        <td>
          <span class="badge ${isPaid ? 'badge-success' : 'badge-danger'}">
            ${isPaid ? 'Paid' : 'Unpaid'}
          </span>
        </td>
        <td>${f.payment_date ? formatDate(f.payment_date) : '<span style="color:var(--text-subtle);">Pending Payment</span>'}</td>
        <td>${actionHtml}</td>
      </tr>
    `;
  }).join('');

  // Wire pay buttons
  tbody.querySelectorAll('.btn-pay-fine').forEach(btn => {
    btn.addEventListener('click', () => {
      const fineId = parseInt(btn.getAttribute('data-fine-id'));
      const fine = fines.find(item => item.id === fineId);
      if (fine) {
        openFinePaymentModal(fine);
      }
    });
  });
}

function openFinePaymentModal(fine) {
  currentPayingFine = fine;
  const modal = document.getElementById('finePaymentModal');
  if (!modal) return;

  const fineRef = document.getElementById('modalFineRef');
  const bookTitle = document.getElementById('modalBookTitle');
  const daysOverdue = document.getElementById('modalDaysOverdue');
  const payableAmount = document.getElementById('modalPayableAmount');
  const qrContainer = document.getElementById('paymentQRCodeContainer');

  if (fineRef) fineRef.textContent = `#FN-${fine.id}`;
  if (bookTitle) bookTitle.textContent = fine.book_title || 'Overdue Loan Book';
  if (daysOverdue) daysOverdue.textContent = `${fine.days_overdue} days`;
  if (payableAmount) payableAmount.textContent = formatCurrency(fine.amount);

  if (qrContainer) {
    if (typeof QRCore !== 'undefined') {
      const payload = QRCore.formatFinePaymentQR({
        fineId: fine.id,
        loanCode: fine.loan_code || `LN-${fine.loan_id}`,
        amount: fine.amount
      });
      QRCore.renderQRCode(qrContainer, payload, { size: 180 });
    } else {
      qrContainer.innerHTML = `<div style="padding:20px;color:#000;font-weight:bold;">₹${fine.amount}</div>`;
    }
  }

  modal.style.display = 'flex';
}

function closeFinePaymentModal() {
  const modal = document.getElementById('finePaymentModal');
  if (modal) modal.style.display = 'none';
  currentPayingFine = null;
}

async function processFinePayment() {
  if (!currentPayingFine) return;
  const confirmBtn = document.getElementById('confirmPayBtn');
  const originalText = confirmBtn ? confirmBtn.innerHTML : 'Confirm';
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span>⏳</span> Processing...';
  }

  try {
    const res = await api.post(`/loans/fines/${currentPayingFine.id}/member-pay`, {
      payment_method: 'UPI_QR'
    });

    if (res.success) {
      showToast(res.message || 'Fine successfully settled via UPI!', 'success');
      closeFinePaymentModal();
      await loadMyLoansData();
    } else {
      throw new Error(res.message || 'Payment processing failed.');
    }
  } catch (err) {
    console.error('Fine payment failed:', err);
    showToast(err.message || 'Failed to settle fine.', 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalText;
    }
  }
}

// Wire modal close and confirm buttons on page init
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('closePaymentModalBtn');
  const cancelBtn = document.getElementById('cancelPayBtn');
  const confirmBtn = document.getElementById('confirmPayBtn');

  if (closeBtn) closeBtn.addEventListener('click', closeFinePaymentModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeFinePaymentModal);
  if (confirmBtn) confirmBtn.addEventListener('click', processFinePayment);
});