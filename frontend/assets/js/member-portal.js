/**
 * Member Portal Controller: Personal Borrowing Dashboard, Books Catalog, & Profile
 */

document.addEventListener('DOMContentLoaded', () => {
  loadMemberDashboard();
  setupEventListeners();
});

function setupEventListeners() {
  const tabs = document.querySelectorAll('.portal-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetView = tab.dataset.view;
      document.querySelectorAll('.portal-view-section').forEach(sec => sec.style.display = 'none');
      const activeSec = document.getElementById(`view-${targetView}`);
      if (activeSec) activeSec.style.display = 'block';

      if (targetView === 'catalog') {
        loadCatalogForMember();
      }
    });
  });

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

  const passwordForm = document.getElementById('memberPasswordForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handleMemberPasswordChange);
  }
}

async function loadMemberDashboard() {
  const user = api.getUser();
  if (!user) return;

  try {
    const res = await api.get(`/members/${user.id}`);
    if (res.success && res.data) {
      const m = res.data;

      // Update Member info
      document.querySelectorAll('.member-display-name').forEach(el => el.textContent = m.full_name);
      document.querySelectorAll('.member-display-code').forEach(el => el.textContent = m.member_code);
      document.querySelectorAll('.member-display-email').forEach(el => el.textContent = m.email || 'Email not added');

      // Render Active Loans
      renderMemberActiveLoans(m.active_loans || []);

      // Render Loan History
      renderMemberLoanHistory(m.loan_history || []);

      // Calculate Metrics
      const activeCount = m.active_loans ? m.active_loans.length : 0;
      const overdueCount = m.active_loans ? m.active_loans.filter(l => l.status === 'Overdue').length : 0;
      const unpaidFines = m.fines 
        ? m.fines.filter(f => f.status === 'Unpaid').reduce((sum, f) => sum + f.amount, 0)
        : 0;

      const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      setEl('memMetricActiveLoans', activeCount);
      setEl('memMetricOverdue', overdueCount);
      setEl('memMetricFines', formatCurrency(unpaidFines));
    }
  } catch (err) {
    console.error('Failed to load member portal data:', err);
    showToast('Failed to retrieve account details.', 'error');
  }
}

function renderMemberActiveLoans(loans) {
  const tbody = document.getElementById('memberActiveLoansTbody');
  if (!tbody) return;

  if (loans.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state" style="padding:24px;">
            <div class="empty-icon" style="color:#10b981;">📖</div>
            <h4>No Books Currently Checked Out</h4>
            <p>You have no pending book returns. Browse the catalog to borrow new books!</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = loans.map(l => {
    let badge = `<span class="badge badge-info">Issued</span>`;
    if (l.status === 'Overdue') {
      badge = `<span class="badge badge-danger">Overdue</span>`;
    }

    return `
      <tr>
        <td><strong>${escapeHtml(l.loan_code)}</strong></td>
        <td>
          <div style="font-weight:600;color:#fff;">${escapeHtml(l.book_title)}</div>
          <small style="color:#94a3b8;">${escapeHtml(l.book_code || '')}</small>
        </td>
        <td>${formatDate(l.issue_date)}</td>
        <td><strong style="color:${l.status === 'Overdue' ? '#fb7185' : '#38bdf8'};">${formatDate(l.due_date)}</strong></td>
        <td>${badge}</td>
      </tr>
    `;
  }).join('');
}

function renderMemberLoanHistory(history) {
  const tbody = document.getElementById('memberHistoryTbody');
  if (!tbody) return;

  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">No past returns recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = history.map(h => `
    <tr>
      <td><strong>${escapeHtml(h.loan_code)}</strong></td>
      <td>${escapeHtml(h.book_title)}</td>
      <td>${formatDate(h.issue_date)}</td>
      <td>${formatDate(h.return_date)}</td>
      <td><span class="badge badge-success">Returned</span></td>
    </tr>
  `).join('');
}

async function loadCatalogForMember() {
  const tbody = document.getElementById('memberCatalogTbody');
  const search = document.getElementById('catalogSearchInput')?.value || '';

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="loading-state"><div class="spinner"></div><p>Searching library catalog...</p></div></td></tr>`;
  }

  try {
    const res = await api.get('/books', { search, limit: 50 });
    if (res.success && res.data) {
      if (res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8;">No books matching query found.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.data.map(b => {
        let availBadge = `<span class="badge badge-success">${b.available_copies} Available</span>`;
        if (b.available_copies === 0) {
          availBadge = `<span class="badge badge-danger">All Checked Out</span>`;
        }

        return `
          <tr>
            <td><strong>${escapeHtml(b.book_code || '')}</strong></td>
            <td>
              <div style="font-weight:600;color:#fff;">${escapeHtml(b.title)}</div>
              <small style="color:#94a3b8;">${escapeHtml(b.author)}</small>
            </td>
            <td><span class="badge badge-secondary">${escapeHtml(b.category_name || 'General')}</span></td>
            <td><code>${escapeHtml(b.isbn)}</code></td>
            <td>${availBadge}</td>
            <td><span style="color:#64748b;">${escapeHtml(b.shelf_location || '—')}</span></td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load catalog for member:', err);
  }
}

async function handleMemberPasswordChange(e) {
  e.preventDefault();

  const current_password = document.getElementById('memCurrPassword').value;
  const new_password = document.getElementById('memNewPassword').value;
  const confirm_password = document.getElementById('memConfirmPassword').value;

  if (!current_password || !new_password) {
    showToast('Please fill all password fields.', 'warning');
    return;
  }

  if (new_password !== confirm_password) {
    showToast('New password confirmation does not match.', 'error');
    return;
  }

  const btn = document.getElementById('btnMemChangePassword');
  if (btn) btn.disabled = true;

  try {
    const res = await api.post('/auth/change-password', {
      current_password,
      new_password,
      confirm_password
    });

    if (res.success) {
      showToast('Password updated successfully!', 'success');
      document.getElementById('memberPasswordForm').reset();
    }
  } catch (err) {
    showToast(err.message || 'Failed to update password.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
