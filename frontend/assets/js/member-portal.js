/**
 * Member Portal & Dashboard Controller
 * Digital Librarian System - Member Interface
 */

let memberChartInstance = null;
let lastBorrowingMetrics = { activeCount: 0, historyCount: 0, overdueCount: 0 };

document.addEventListener('DOMContentLoaded', () => {
  loadMemberDashboard();
  setupEventListeners();
});

function setupEventListeners() {
  // Password Form Handler (if present in profile/settings modals)
  const passwordForm = document.getElementById('memberPasswordForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handleMemberPasswordChange);
  }

  // Catalog search input (if embedded)
  const searchInput = document.getElementById('catalogSearchInput');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadCatalogForMember();
      }, 300);
    });
  }

  // Listen to theme toggle buttons to re-render Chart with appropriate theme colors
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        renderMemberBorrowingChart(lastBorrowingMetrics);
      }, 50);
    });
  });
}

async function loadMemberDashboard() {
  if (!api.isAuthenticated()) {
    window.location.href = '/login.html';
    return;
  }

  const user = api.getUser();
  if (!user || !user.id) {
    window.location.href = '/login.html';
    return;
  }

  if (user.role && user.role !== 'Member') {
    window.location.href = '/index.html';
    return;
  }

  const loadingEl = document.getElementById('memberDashboardLoading');
  const contentEl = document.getElementById('memberDashboardContent');
  const errorEl = document.getElementById('memberDashboardError');

  if (loadingEl) loadingEl.style.display = 'flex';
  if (contentEl) contentEl.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';

  try {
    // Fetch profile and my-books in parallel
    const [memberRes, booksRes] = await Promise.all([
      api.get(`/members/${user.id}`),
      api.get('/loans/my-books')
    ]);

    if (!memberRes.success || !memberRes.data) {
      throw new Error(memberRes.message || 'Failed to load member profile');
    }

    const m = memberRes.data;
    const loansData = booksRes.success && booksRes.data ? booksRes.data : {
      active_loans: m.active_loans || [],
      loan_history: m.loan_history || [],
      fines: m.fines || [],
      book_requests: []
    };

    // Update Member info everywhere on the page
    const patronName = m.full_name || user.name || 'Member';
    const patronCode = m.member_code || 'MEM-***';
    const patronEmail = m.email || 'No email registered';
    const patronPhone = m.phone || '—';
    const patronDate = formatDate(m.membership_date);
    const patronStatus = m.status || 'Active';

    document.querySelectorAll('.member-display-name').forEach(el => el.textContent = patronName);
    document.querySelectorAll('.member-display-code').forEach(el => el.textContent = patronCode);
    document.querySelectorAll('.member-display-email').forEach(el => el.textContent = patronEmail);
    document.querySelectorAll('.member-display-phone').forEach(el => el.textContent = patronPhone);
    document.querySelectorAll('.member-display-date').forEach(el => el.textContent = patronDate);
    document.querySelectorAll('.member-display-status').forEach(el => el.textContent = patronStatus);

    // Calculate Real Member Metrics
    const activeLoans = Array.isArray(loansData.active_loans) ? loansData.active_loans : [];
    const loanHistory = Array.isArray(loansData.loan_history) ? loansData.loan_history : [];
    const fines = Array.isArray(loansData.fines) ? loansData.fines : [];
    const bookRequests = Array.isArray(loansData.book_requests) ? loansData.book_requests : [];

    const today = new Date().toISOString().split('T')[0];
    const activeCount = activeLoans.length;
    const historyCount = loanHistory.length;
    const totalBorrowed = activeCount + historyCount;
    const overdueCount = activeLoans.filter(l => l.status === 'Overdue' || (l.due_date && l.due_date < today)).length;
    const pendingRequests = bookRequests.filter(r => r.status === 'Pending').length;
    const unpaidFines = fines
      .filter(f => f.status === 'Unpaid')
      .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('memMetricActiveLoans', activeCount);
    setVal('memMetricTotalBorrowed', totalBorrowed);
    setVal('memMetricOverdue', overdueCount);
    setVal('memMetricFines', formatCurrency(unpaidFines));
    setVal('activeLoansCountBadge', `${activeCount} ${activeCount === 1 ? 'Book' : 'Books'}`);

    const pendingBadge = document.getElementById('pendingRequestsCountBadge');
    if (pendingBadge) {
      if (pendingRequests > 0) {
        pendingBadge.style.display = 'inline-block';
        pendingBadge.textContent = `${pendingRequests} Pending`;
      } else {
        pendingBadge.style.display = 'none';
      }
    }

    // Dynamic subtext for overdue and fines
    const overdueSubEl = document.getElementById('memMetricOverdueSub');
    if (overdueSubEl) {
      if (overdueCount > 0) {
        overdueSubEl.textContent = `${overdueCount} book${overdueCount > 1 ? 's' : ''} overdue`;
        overdueSubEl.style.color = '#fb7185';
        overdueSubEl.style.fontWeight = '600';
      } else {
        overdueSubEl.textContent = 'All on schedule';
        overdueSubEl.style.color = '';
        overdueSubEl.style.fontWeight = '';
      }
    }

    const finesSubEl = document.getElementById('memMetricFinesSub');
    if (finesSubEl) {
      if (unpaidFines > 0) {
        finesSubEl.textContent = 'Payment required';
        finesSubEl.style.color = '#fbbf24';
        finesSubEl.style.fontWeight = '600';
      } else {
        finesSubEl.textContent = 'Zero balance';
        finesSubEl.style.color = '';
        finesSubEl.style.fontWeight = '';
      }
    }

    // Render Dynamic Attention Banner
    renderMemberAttentionBanner(overdueCount);

    // Render Active Loans
    renderMemberActiveLoans(activeLoans);

    // Render Member Requests
    renderMemberRequests(bookRequests);

    // Render Loan History
    renderMemberLoanHistory(loanHistory);

    // Render Personal Chart
    lastBorrowingMetrics = { activeCount, historyCount, overdueCount };
    renderMemberBorrowingChart(lastBorrowingMetrics);

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
  } catch (err) {
    console.error('Failed to load member dashboard:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'flex';
      const msgEl = errorEl.querySelector('.error-msg');
      if (msgEl) msgEl.textContent = err.message || 'Unable to connect to member account service.';
    }
    showToast('Failed to retrieve account details.', 'error');
  }
}

function renderMemberAttentionBanner(overdueCount) {
  const container = document.getElementById('memberAttentionBanner');
  if (!container) return;

  if (overdueCount > 0) {
    container.innerHTML = `
      <div class="attention-banner warning">
        <div class="attention-banner-left">
          <div class="attention-banner-icon">⚠️</div>
          <div>
            <div class="attention-banner-title">Attention Required: Overdue Borrowing</div>
            <div class="attention-banner-text">
              You have <strong>${overdueCount} overdue book${overdueCount > 1 ? 's' : ''}</strong>. 
              Please return them to the library desk to prevent additional late fees (₹5/day).
            </div>
          </div>
        </div>
        <a href="/my-books.html" class="btn btn-sm btn-primary" style="background:#ef4444;border:none;">
          View My Books →
        </a>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="attention-banner success">
        <div class="attention-banner-left">
          <div class="attention-banner-icon">✓</div>
          <div>
            <div class="attention-banner-title">You're all caught up!</div>
            <div class="attention-banner-text">
              No overdue books or pending return alerts at the moment. Explore our catalog to find your next read.
            </div>
          </div>
        </div>
        <a href="/available-books.html" class="btn btn-sm btn-secondary">
          Explore Catalog →
        </a>
      </div>
    `;
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

function renderMemberActiveLoans(loans) {
  const tbody = document.getElementById('memberActiveLoansTbody');
  if (!tbody) return;

  if (loans.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding:0;">
          <div class="empty-state" style="padding:32px 16px;text-align:center;">
            <div class="empty-icon" style="color:#10b981;font-size:32px;margin-bottom:8px;">📚</div>
            <h4 style="color:var(--text-main);font-size:15px;font-weight:700;margin-bottom:4px;">No Books Currently Borrowed</h4>
            <p style="color:var(--text-muted);font-size:13px;max-width:400px;margin:0 auto 14px auto;">
              Explore the library catalog to request or borrow books.
            </p>
            <a href="/available-books.html" class="btn btn-sm btn-primary" style="display:inline-flex;align-items:center;gap:6px;">
              <span>🔍</span> Browse Available Books
            </a>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = loans.map((l, index) => {
    const dueInfo = getDueStatus(l.due_date);
    let badge = `<span class="badge badge-info">Issued</span>`;
    if (dueInfo.isOverdue || l.status === 'Overdue') {
      badge = `<span class="badge badge-danger">Overdue</span>`;
    }

    const fineAmount = parseFloat(l.fine_amount) || 0;

    return `
      <tr>
        <td><strong>${escapeHtml(l.loan_code || `LN-${index + 1}`)}</strong></td>
        <td>
          <div style="font-weight:600;color:var(--text-main);">${escapeHtml(l.book_title || 'Untitled Book')}</div>
          <small style="color:var(--text-muted);">${escapeHtml(l.book_code || '')}</small>
        </td>
        <td><span class="badge badge-secondary">${escapeHtml(l.category_name || 'General')}</span></td>
        <td>${formatDate(l.issue_date)}</td>
        <td>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <span style="font-weight:600;color:${dueInfo.isOverdue ? '#fb7185' : 'var(--text-main)'};">
              ${formatDate(l.due_date)}
            </span>
            <span class="${dueInfo.badgeClass}">
              ${dueInfo.label}
            </span>
          </div>
        </td>
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

function renderMemberRequests(requests) {
  const tbody = document.getElementById('memberRequestsTbody');
  if (!tbody) return;

  if (requests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding:0;">
          <div class="empty-state" style="padding:24px 16px;text-align:center;">
            <p style="color:var(--text-muted);font-size:13px;margin-bottom:10px;">You have not made any book requests yet.</p>
            <a href="/available-books.html" class="btn btn-sm btn-secondary">Request a Book →</a>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = requests.slice(0, 5).map(r => {
    let statusBadge = '<span class="badge badge-warning">Pending Review</span>';
    if (r.status === 'Approved') {
      statusBadge = '<span class="badge badge-success">✓ Approved for Pickup</span>';
    } else if (r.status === 'Rejected') {
      statusBadge = '<span class="badge badge-danger">✕ Declined</span>';
    } else if (r.status === 'Issued') {
      statusBadge = '<span class="badge badge-info">📖 Issued</span>';
    }

    return `
      <tr>
        <td><small style="color:var(--text-muted);">${formatDate(r.request_date)}</small></td>
        <td>
          <div style="font-weight:600;color:var(--text-main);">${escapeHtml(r.book_title)}</div>
          <small style="color:var(--text-muted);">${escapeHtml(r.book_author || '')}</small>
        </td>
        <td><span style="font-size:13px;color:var(--text-secondary);">${escapeHtml(r.notes || '—')}</span></td>
        <td>${statusBadge}</td>
        <td>
          <span style="font-size:12px;color:var(--text-muted);">${r.rejection_reason ? escapeHtml(r.rejection_reason) : (r.status === 'Approved' ? 'Ready at Circulation Desk' : '—')}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderMemberLoanHistory(history) {
  const tbody = document.getElementById('memberHistoryTbody');
  if (!tbody) return;

  if (history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:0;">
          <div class="empty-state" style="padding:32px 16px;text-align:center;">
            <p style="color:var(--text-muted);font-size:13.5px;">No past borrowing history recorded yet.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = history.slice(0, 6).map((h, index) => `
    <tr>
      <td><strong>${escapeHtml(h.loan_code || `LN-${index + 1}`)}</strong></td>
      <td>
        <div style="font-weight:600;color:var(--text-main);">${escapeHtml(h.book_title || 'Untitled Book')}</div>
        <small style="color:var(--text-muted);">${escapeHtml(h.book_code || '')}</small>
      </td>
      <td>${formatDate(h.issue_date)}</td>
      <td>${formatDate(h.return_date || h.due_date)}</td>
      <td><span class="badge badge-success">Returned</span></td>
      <td><span style="color:var(--text-muted);">${h.fine_paid ? 'Paid' : '—'}</span></td>
    </tr>
  `).join('');
}

function renderMemberBorrowingChart({ activeCount, historyCount, overdueCount }) {
  const canvas = document.getElementById('memberBorrowingChart');
  if (!canvas || !window.Chart) return;

  if (memberChartInstance) {
    memberChartInstance.destroy();
  }

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const isLight = currentTheme === 'light';

  const total = activeCount + historyCount;
  let labels = ['Active Loans', 'Returned Books', 'Overdue'];
  const regularActive = activeCount - overdueCount > 0 ? activeCount - overdueCount : 0;
  let data = [regularActive, historyCount, overdueCount];
  let bgColors = ['#0ea5e9', '#10b981', '#ef4444'];

  if (total === 0) {
    labels = ['No Borrowing Activity'];
    data = [1];
    bgColors = [isLight ? 'rgba(148, 163, 184, 0.2)' : 'rgba(255, 255, 255, 0.08)'];
  }

  const chartBorderColor = isLight ? '#ffffff' : '#111827';
  const legendTextColor = isLight ? '#475569' : '#94a3b8';

  memberChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: chartBorderColor,
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: legendTextColor,
            font: { size: 12, weight: '500' },
            padding: 14,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: isLight ? '#ffffff' : '#1e293b',
          titleColor: isLight ? '#0f172a' : '#fff',
          bodyColor: isLight ? '#475569' : '#cbd5e1',
          borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (context) => total === 0 ? ' No library activity recorded' : ` ${context.label}: ${context.raw}`
          }
        }
      },
      cutout: '68%'
    }
  });
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
