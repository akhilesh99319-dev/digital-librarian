/**
 * Reports Controller: Summary Analytics, Data Tables, and CSV Export
 */

let currentReportType = 'inventory';
let reportDataCache = [];

document.addEventListener('DOMContentLoaded', () => {
  loadReportSummary();
  loadReportData(currentReportType);
  setupEventListeners();
});

function setupEventListeners() {
  const tabs = document.querySelectorAll('.report-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentReportType = tab.dataset.type;
      loadReportData(currentReportType);
    });
  });

  const exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCurrentReportCsv);
  }
}

async function loadReportSummary() {
  try {
    const res = await api.get('/reports/summary');
    if (res.success && res.summary) {
      const s = res.summary;
      const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      setEl('repTotalCopies', s.totalCopies.toLocaleString());
      setEl('repTotalMembers', s.totalMembers.toLocaleString());
      setEl('repActiveLoans', s.activeLoansCount.toLocaleString());
      setEl('repOverdueLoans', s.overdueLoansCount.toLocaleString());
      setEl('repFinesCollected', formatCurrency(s.totalFinesPaid));
      setEl('repFinesPending', formatCurrency(s.totalFinesUnpaid));
    }
  } catch (err) {
    console.error('Failed to load report summary:', err);
  }
}

async function loadReportData(type) {
  const thead = document.getElementById('reportsTableHead');
  const tbody = document.getElementById('reportsTableBody');
  const countEl = document.getElementById('reportRecordCount');

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="loading-state"><div class="spinner"></div><p>Generating report from database...</p></div></td></tr>`;
  }

  try {
    const res = await api.get('/reports', { type });
    if (res.success && res.data) {
      reportDataCache = res.data;
      if (countEl) countEl.textContent = `${res.total_records} records found`;
      renderReportTable(res.data);
    } else {
      throw new Error(res.message || 'Failed to fetch report');
    }
  } catch (err) {
    console.error('loadReportData error:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="error-state"><p class="error-msg">${err.message}</p><button class="btn btn-sm btn-secondary" onclick="loadReportData('${type}')">Retry</button></div></td></tr>`;
    }
  }
}

function renderReportTable(data) {
  const thead = document.getElementById('reportsTableHead');
  const tbody = document.getElementById('reportsTableBody');
  if (!thead || !tbody) return;

  if (!data || data.length === 0) {
    thead.innerHTML = `<tr><th>Information</th></tr>`;
    tbody.innerHTML = `
      <tr>
        <td>
          <div class="empty-state">
            <div class="empty-icon">📊</div>
            <h4>No Records Found</h4>
            <p>There is currently no data to display for this report category.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Generate headers from object keys
  const headers = Object.keys(data[0]);
  thead.innerHTML = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;

  tbody.innerHTML = data.map(row => {
    const cells = headers.map(h => {
      let val = row[h];
      if (val === null || val === undefined) val = '—';
      
      // Highlight specific values
      if (h === 'Status') {
        if (val === 'Active' || val === 'Paid' || val === 'Returned') {
          return `<td><span class="badge badge-success">${escapeHtml(val)}</span></td>`;
        } else if (val === 'Overdue' || val === 'Unpaid' || val === 'Suspended') {
          return `<td><span class="badge badge-danger">${escapeHtml(val)}</span></td>`;
        } else {
          return `<td><span class="badge badge-info">${escapeHtml(val)}</span></td>`;
        }
      }

      return `<td>${escapeHtml(String(val))}</td>`;
    }).join('');

    return `<tr>${cells}</tr>`;
  }).join('');
}

async function exportCurrentReportCsv() {
  const btn = document.getElementById('exportCsvBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:6px;"></div> Exporting CSV...';
  }

  try {
    const filename = `library-${currentReportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
    await api.downloadCsv('/reports', { type: currentReportType }, filename);
    showToast(`Report downloaded: ${filename}`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to download CSV report.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '📥 Export to CSV';
    }
  }
}
