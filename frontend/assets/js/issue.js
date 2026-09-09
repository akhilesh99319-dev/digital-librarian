/**
 * Issue Book Workflow Controller
 */

let allMembers = [];
let availableBooks = [];

document.addEventListener('DOMContentLoaded', () => {
  initIssueForm();
  loadMembersAndBooks();
  loadRecentIssued();
});

function initIssueForm() {
  const form = document.getElementById('issueBookForm');
  const today = new Date();
  const issueDateInput = document.getElementById('issueDate');
  const dueDateInput = document.getElementById('dueDate');

  const formatDateVal = (d) => d.toISOString().split('T')[0];

  if (issueDateInput) {
    issueDateInput.value = formatDateVal(today);
    issueDateInput.addEventListener('change', () => {
      // Auto adjust due date to +14 days from issue date
      const newIssue = new Date(issueDateInput.value);
      if (!isNaN(newIssue.getTime())) {
        const newDue = new Date(newIssue);
        newDue.setDate(newDue.getDate() + 14);
        dueDateInput.value = formatDateVal(newDue);
      }
    });
  }

  if (dueDateInput) {
    const dueDefault = new Date(today);
    dueDefault.setDate(dueDefault.getDate() + 14);
    dueDateInput.value = formatDateVal(dueDefault);
  }

  if (form) {
    form.addEventListener('submit', handleIssueSubmit);
  }
}

async function loadMembersAndBooks() {
  try {
    const [membersRes, booksRes] = await Promise.all([
      api.get('/members', { limit: 200, status: 'Active' }),
      api.get('/books', { limit: 200, available_only: 'true' })
    ]);

    if (membersRes.success && membersRes.data) {
      allMembers = membersRes.data;
      const memberSelect = document.getElementById('selectMember');
      if (memberSelect) {
        memberSelect.innerHTML = '<option value="">-- Select Registered Member --</option>' +
          allMembers.map(m => `
            <option value="${m.id}">${escapeHtml(m.full_name)} (${escapeHtml(m.member_code)}) &bull; ${escapeHtml(m.phone)}</option>
          `).join('');
      }
    }

    if (booksRes.success && booksRes.data) {
      availableBooks = booksRes.data;
      const bookSelect = document.getElementById('selectBook');
      if (bookSelect) {
        bookSelect.innerHTML = '<option value="">-- Select Available Book --</option>' +
          availableBooks.map(b => `
            <option value="${b.id}">${escapeHtml(b.title)} (${escapeHtml(b.book_code || '')}) - [${b.available_copies} available] (Shelf: ${escapeHtml(b.shelf_location || '—')})</option>
          `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load members/books for issue form:', err);
    showToast('Failed to load selection data.', 'error');
  }
}

async function handleIssueSubmit(e) {
  e.preventDefault();

  const memberId = document.getElementById('selectMember').value;
  const bookId = document.getElementById('selectBook').value;
  const issueDate = document.getElementById('issueDate').value;
  const dueDate = document.getElementById('dueDate').value;
  const notes = document.getElementById('issueNotes').value.trim();

  if (!memberId || !bookId || !issueDate || !dueDate) {
    showToast('Please select a member, a book, and confirm dates.', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btnSubmitIssue');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:6px;"></div> Processing Checkout...';
  }

  try {
    const res = await api.post('/loans/issue', {
      member_id: parseInt(memberId),
      book_id: parseInt(bookId),
      issue_date: issueDate,
      due_date: dueDate,
      notes
    });

    if (res.success && res.data) {
      showToast(res.message || 'Book issued successfully!', 'success');
      
      // Reset form
      document.getElementById('selectBook').value = '';
      document.getElementById('issueNotes').value = '';

      // Reload dropdowns and recent table
      loadMembersAndBooks();
      loadRecentIssued();

      // Show receipt modal or preview
      showIssueReceipt(res.data);
    }
  } catch (err) {
    showToast(err.message || 'Failed to issue book.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Issue Book to Member';
    }
  }
}

function showIssueReceipt(loan) {
  const body = document.getElementById('issueReceiptBody');
  if (!body) return;

  body.innerHTML = `
    <div style="text-align:center;margin-bottom:18px;">
      <div style="font-size:36px;margin-bottom:6px;">✅</div>
      <h3 style="color:#fff;font-size:18px;">Book Successfully Checked Out</h3>
      <p style="color:#94a3b8;font-size:13px;">Transaction Reference Code</p>
      <div style="display:inline-block;background:rgba(79,70,229,0.2);color:#818cf8;border:1px solid rgba(99,102,241,0.4);font-family:monospace;font-size:16px;font-weight:700;padding:6px 14px;border-radius:6px;margin-top:6px;">
        ${escapeHtml(loan.loan_code)}
      </div>
    </div>

    <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);padding:16px;border-radius:8px;display:flex;flex-direction:column;gap:10px;font-size:13.5px;">
      <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">Book Title:</span><strong>${escapeHtml(loan.book_title)}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">Borrower:</span><strong>${escapeHtml(loan.member_name)} (${escapeHtml(loan.member_code)})</strong></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">Issue Date:</span><span>${formatDate(loan.issue_date)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">Due Return Date:</span><span style="color:#38bdf8;font-weight:600;">${formatDate(loan.due_date)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">Remaining Copies:</span><span>${loan.available_copies} of ${loan.total_copies}</span></div>
    </div>
  `;

  openModal('issueReceiptModal');
}

async function loadRecentIssued() {
  const tbody = document.getElementById('recentIssuedTableBody');
  if (!tbody) return;

  try {
    const res = await api.get('/loans/active', { limit: 6 });
    if (res.success && res.data) {
      if (res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:18px;">No books currently issued.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.data.map(l => `
        <tr>
          <td><strong>${escapeHtml(l.loan_code)}</strong></td>
          <td>${escapeHtml(l.book_title)}</td>
          <td>${escapeHtml(l.member_name)}</td>
          <td>${formatDate(l.issue_date)}</td>
          <td><span style="color:${l.is_overdue ? '#fb7185' : '#38bdf8'};font-weight:600;">${formatDate(l.due_date)}</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load recent active loans:', err);
  }
}
