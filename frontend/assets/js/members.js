/**
 * Members Management: Search, Filter, Add, Edit, Delete, View Member Loans, Update Email
 */

let currentPage = 1;
const pageSize = 15;
let deleteCandidateMemberId = null;
let currentMembersList = [];

document.addEventListener('DOMContentLoaded', () => {
  loadMembers();
  setupEventListeners();
});

function setupEventListeners() {
  const searchInput = document.getElementById('memberSearchInput');
  const statusFilter = document.getElementById('memberStatusFilter');
  const addBtn = document.getElementById('addMemberBtn');
  const form = document.getElementById('memberForm');
  const emailForm = document.getElementById('editMemberEmailForm');
  const confirmDeleteBtn = document.getElementById('confirmDeleteMemberBtn');

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentPage = 1;
        loadMembers();
      }, 300);
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      currentPage = 1;
      loadMembers();
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', openAddMemberModal);
  }

  if (form) {
    form.addEventListener('submit', handleMemberFormSubmit);
  }

  if (emailForm) {
    emailForm.addEventListener('submit', handleMemberEmailSubmit);
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', executeDeleteMember);
  }
}

async function loadMembers() {
  const tbody = document.getElementById('membersTableBody');
  const search = document.getElementById('memberSearchInput')?.value || '';
  const status = document.getElementById('memberStatusFilter')?.value || '';

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="loading-state"><div class="spinner"></div><p>Loading members...</p></div></td></tr>`;
  }

  try {
    const res = await api.get('/members', { search, status, page: currentPage, limit: pageSize });
    if (res.success && res.data) {
      currentMembersList = res.data;
      renderMembersTable(res.data);
      renderPagination(res.pagination);
    } else {
      throw new Error(res.message || 'Failed to fetch members');
    }
  } catch (err) {
    console.error('loadMembers error:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="error-state"><p class="error-msg">${err.message}</p><button class="btn btn-sm btn-secondary" onclick="loadMembers()">Retry</button></div></td></tr>`;
    }
  }
}

function renderMembersTable(members) {
  const tbody = document.getElementById('membersTableBody');
  if (!tbody) return;

  if (members.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <div class="empty-icon">👥</div>
            <h4>No Members Found</h4>
            <p>Try refining your search or add a new library member.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = members.map(m => {
    let statusBadge = `<span class="badge badge-success">Active</span>`;
    if (m.status === 'Suspended') {
      statusBadge = `<span class="badge badge-danger">Suspended</span>`;
    } else if (m.status === 'Inactive') {
      statusBadge = `<span class="badge badge-secondary">Inactive</span>`;
    }

    let loanInfo = `<span class="badge badge-secondary">0 Checked Out</span>`;
    if (m.active_loans_count > 0) {
      loanInfo = `<span class="badge badge-info">${m.active_loans_count} Checked Out</span>`;
    }
    if (m.overdue_loans_count > 0) {
      loanInfo += ` <span class="badge badge-danger">${m.overdue_loans_count} Overdue</span>`;
    }

    const emailDisplay = m.email && m.email.trim()
      ? `<span style="color:#38bdf8;font-size:13px;">${escapeHtml(m.email)}</span>`
      : `<span class="badge badge-secondary" style="font-size:11px;padding:3px 7px;">Email not added</span>`;

    const emailBtnTitle = m.email && m.email.trim() ? 'Update Email Address' : 'Add Email Address';

    return `
      <tr>
        <td><strong>${escapeHtml(m.member_code)}</strong></td>
        <td>
          <div style="font-weight:600;color:#fff;">${escapeHtml(m.full_name)}</div>
        </td>
        <td>${emailDisplay}</td>
        <td><span style="color:#cbd5e1;">${escapeHtml(m.phone || '—')}</span></td>
        <td>${statusBadge}</td>
        <td>${loanInfo}</td>
        <td><span style="color:#64748b;">${formatDate(m.membership_date)}</span></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-secondary" title="View Member Profile & Loans" onclick="viewMemberDetails(${m.id})">
              👁️
            </button>
            <button class="btn btn-sm btn-secondary" title="${emailBtnTitle}" onclick="openEditEmailModal(${m.id})" style="border-color:rgba(56,189,248,0.3);color:#38bdf8;">
              ✉️
            </button>
            <button class="btn btn-sm btn-secondary" title="Edit Member Information" onclick="openEditMemberModal(${m.id})">
              ✏️
            </button>
            <button class="btn btn-sm btn-danger" title="Delete Member" onclick="promptDeleteMember(${m.id}, '${escapeHtml(m.full_name)}')">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination(p) {
  const paginationEl = document.getElementById('membersPagination');
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
      Showing <strong>${startItem}</strong> to <strong>${endItem}</strong> of <strong>${p.total}</strong> members
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
  loadMembers();
}

function openAddMemberModal() {
  const form = document.getElementById('memberForm');
  if (form) form.reset();
  document.getElementById('memberModalId').value = '';
  document.getElementById('memberModalTitle').textContent = 'Register New Member';
  document.getElementById('memberSubmitBtnText').textContent = 'Register Member';
  document.getElementById('memberDate').value = new Date().toISOString().split('T')[0];
  openModal('memberModal');
}

async function openEditMemberModal(id) {
  try {
    const res = await api.get(`/members/${id}`);
    if (res.success && res.data) {
      const m = res.data;
      document.getElementById('memberModalId').value = m.id;
      document.getElementById('memberName').value = m.full_name;
      document.getElementById('memberEmail').value = m.email || '';
      document.getElementById('memberPhone').value = m.phone;
      document.getElementById('memberAddress').value = m.address || '';
      document.getElementById('memberDate').value = m.membership_date;
      document.getElementById('memberStatus').value = m.status;

      document.getElementById('memberModalTitle').textContent = `Edit Member: ${m.full_name}`;
      document.getElementById('memberSubmitBtnText').textContent = 'Save Changes';
      openModal('memberModal');
    }
  } catch (err) {
    showToast(err.message || 'Failed to load member for editing', 'error');
  }
}

async function openEditEmailModal(id) {
  try {
    const res = await api.get(`/members/${id}`);
    if (res.success && res.data) {
      const m = res.data;
      document.getElementById('emailModalMemberId').value = m.id;
      document.getElementById('emailModalMemberName').value = m.full_name;
      document.getElementById('emailModalMemberCode').value = m.member_code;
      document.getElementById('emailModalMemberEmail').value = m.email || '';

      const titleEl = document.getElementById('editMemberEmailModalTitle');
      if (titleEl) {
        titleEl.textContent = m.email ? `Edit Member Email: ${m.full_name}` : `Add Member Email: ${m.full_name}`;
      }

      openModal('editMemberEmailModal');
      setTimeout(() => {
        const input = document.getElementById('emailModalMemberEmail');
        if (input) input.focus();
      }, 100);
    }
  } catch (err) {
    showToast(err.message || 'Failed to load member data', 'error');
  }
}

async function handleMemberEmailSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('emailModalMemberId').value;
  const emailInput = document.getElementById('emailModalMemberEmail').value.trim();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailInput && !emailRegex.test(emailInput)) {
    showToast('Please enter a valid email address (e.g. name@example.com).', 'error');
    return;
  }

  const btn = document.getElementById('emailModalSaveBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await api.put(`/members/${id}/email`, { email: emailInput });
    showToast(res.message || 'Member email updated successfully.', 'success');
    closeModal('editMemberEmailModal');
    loadMembers();
  } catch (err) {
    showToast(err.message || 'Failed to update member email.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleMemberFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('memberModalId').value;
  const isEditing = !!id;

  const emailVal = document.getElementById('memberEmail').value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailVal && !emailRegex.test(emailVal)) {
    showToast('Please enter a valid email address (e.g. name@example.com).', 'error');
    return;
  }

  const payload = {
    full_name: document.getElementById('memberName').value.trim(),
    email: emailVal || null,
    phone: document.getElementById('memberPhone').value.trim(),
    address: document.getElementById('memberAddress').value.trim(),
    membership_date: document.getElementById('memberDate').value,
    status: document.getElementById('memberStatus').value
  };

  if (!payload.full_name || !payload.phone) {
    showToast('Full name and phone number are required.', 'warning');
    return;
  }

  const btn = document.getElementById('memberSubmitBtn');
  if (btn) btn.disabled = true;

  try {
    if (isEditing) {
      const res = await api.put(`/members/${id}`, payload);
      showToast(res.message || 'Member information updated successfully.', 'success');
    } else {
      const res = await api.post('/members', payload);
      showToast(res.message || 'Member registered successfully!', 'success');
    }

    closeModal('memberModal');
    loadMembers();
  } catch (err) {
    showToast(err.message || 'Failed to save member', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function promptDeleteMember(id, name) {
  deleteCandidateMemberId = id;
  const nameEl = document.getElementById('deleteMemberName');
  if (nameEl) nameEl.textContent = name;
  openModal('deleteMemberModal');
}

async function executeDeleteMember() {
  if (!deleteCandidateMemberId) return;

  const btn = document.getElementById('confirmDeleteMemberBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await api.delete(`/members/${deleteCandidateMemberId}`);
    showToast(res.message || 'Member deleted.', 'success');
    closeModal('deleteMemberModal');
    loadMembers();
  } catch (err) {
    showToast(err.message || 'Failed to delete member.', 'error');
  } finally {
    if (btn) btn.disabled = false;
    deleteCandidateMemberId = null;
  }
}

async function viewMemberDetails(memberId) {
  try {
    const res = await api.get(`/members/${memberId}`);
    if (res.success && res.data) {
      const m = res.data;
      const body = document.getElementById('viewMemberDetailsBody');
      if (!body) return;

      const activeLoansHtml = m.active_loans && m.active_loans.length > 0
        ? m.active_loans.map(l => `
            <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>${escapeHtml(l.book_title)}</strong>
                <span class="badge ${l.status === 'Overdue' ? 'badge-danger' : 'badge-info'}">${l.status}</span>
              </div>
              <div style="font-size:12px;color:#94a3b8;margin-top:4px;">
                Loan Code: <code>${escapeHtml(l.loan_code)}</code> &bull; Due: ${formatDate(l.due_date)}
              </div>
            </div>
          `).join('')
        : `<p style="color:#94a3b8;font-size:13px;">No active loans at this time.</p>`;

      const emailBadge = m.email && m.email.trim()
        ? escapeHtml(m.email)
        : `<span class="badge badge-secondary" style="font-size:11px;">Email not added</span>`;

      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:18px;">
          <div>
            <h3 style="font-size:18px;color:#fff;margin-bottom:4px;">${escapeHtml(m.full_name)}</h3>
            <p style="color:#94a3b8;font-size:13px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span>${escapeHtml(m.member_code)}</span> &bull; 
              <span>${emailBadge}</span> &bull; 
              <span>${escapeHtml(m.phone || 'No phone')}</span>
            </p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:rgba(0,0,0,0.2);padding:14px;border-radius:8px;">
            <div><small style="color:#64748b;">Address</small><div>${escapeHtml(m.address || '—')}</div></div>
            <div><small style="color:#64748b;">Member Since</small><div>${formatDate(m.membership_date)}</div></div>
            <div><small style="color:#64748b;">Account Status</small><div><span class="badge badge-success">${m.status}</span></div></div>
            <div><small style="color:#64748b;">Active Loans</small><div style="font-weight:700;color:#38bdf8;">${m.active_loans ? m.active_loans.length : 0} books</div></div>
          </div>
          <div>
            <h4 style="font-size:14px;color:#fff;margin-bottom:10px;">Currently Checked Out Books</h4>
            <div>${activeLoansHtml}</div>
          </div>
        </div>
      `;

      openModal('viewMemberModal');
    }
  } catch (err) {
    showToast(err.message || 'Failed to load member details.', 'error');
  }
}
