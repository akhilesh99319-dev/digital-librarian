/**
 * Dashboard Controller: Real-time Database Metrics, Charts, and Recent Activities
 */

let categoryChartInstance = null;
let activityChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  loadDashboardData();
});

async function loadDashboardData() {
  const loadingContainer = document.getElementById('dashboardLoading');
  const contentContainer = document.getElementById('dashboardContent');
  const errorContainer = document.getElementById('dashboardError');

  if (loadingContainer) loadingContainer.style.display = 'flex';
  if (contentContainer) contentContainer.style.display = 'none';
  if (errorContainer) errorContainer.style.display = 'none';

  try {
    const res = await api.get('/dashboard/stats');
    if (res.success && res.data) {
      renderMetrics(res.data.metrics);
      renderCharts(res.data.charts);
      renderRecentLoans(res.data.recentLoans);

      if (loadingContainer) loadingContainer.style.display = 'none';
      if (contentContainer) contentContainer.style.display = 'block';
    } else {
      throw new Error(res.message || 'Failed to load dashboard data');
    }
  } catch (err) {
    console.error('Dashboard loading error:', err);
    if (loadingContainer) loadingContainer.style.display = 'none';
    if (errorContainer) {
      errorContainer.style.display = 'flex';
      const msgEl = errorContainer.querySelector('.error-msg');
      if (msgEl) msgEl.textContent = err.message || 'Unable to connect to library database.';
    }
  }
}

function renderMetrics(m) {
  if (!m) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal('metricTotalBooks', (m.totalBooks || 0).toLocaleString());
  setVal('metricUniqueTitles', `${m.uniqueBookTitles || 0} unique titles`);
  setVal('metricAvailableCopies', (m.totalAvailableCopies || 0).toLocaleString());
  setVal('metricTotalMembers', (m.totalMembers || 0).toLocaleString());
  setVal('metricActiveLoans', (m.activeLoans || 0).toLocaleString());
  setVal('metricOverdueBooks', (m.overdueBooks || 0).toLocaleString());
  setVal('metricPendingFines', formatCurrency(m.pendingFines || 0));
}

function renderCharts(charts) {
  if (!window.Chart || !charts) return;

  // 1. Books by Category Chart (Doughnut)
  const catCanvas = document.getElementById('categoryChart');
  if (catCanvas && charts.categories) {
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
    }

    const labels = charts.categories.map(c => c.category_name);
    const dataCounts = charts.categories.map(c => c.total_copies);
    const colors = [
      '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', 
      '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'
    ];

    categoryChartInstance = new Chart(catCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: dataCounts,
          backgroundColor: colors,
          borderColor: '#111827',
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
              color: '#94a3b8',
              font: { size: 12 },
              padding: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            padding: 12,
            callbacks: {
              label: (context) => ` ${context.label}: ${context.raw} total copies`
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  // 2. Monthly Issue/Return Activity Chart (Bar)
  const actCanvas = document.getElementById('activityChart');
  if (actCanvas && charts.monthlyActivity) {
    if (activityChartInstance) {
      activityChartInstance.destroy();
    }

    const months = charts.monthlyActivity.map(a => a.monthLabel);
    const issues = charts.monthlyActivity.map(a => a.issues);
    const returns = charts.monthlyActivity.map(a => a.returns);

    activityChartInstance = new Chart(actCanvas, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Books Issued',
            data: issues,
            backgroundColor: 'rgba(79, 70, 229, 0.85)',
            borderRadius: 6
          },
          {
            label: 'Books Returned',
            data: returns,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#94a3b8',
              stepSize: 1,
              precision: 0
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            padding: 12
          }
        }
      }
    });
  }
}

function renderRecentLoans(loans) {
  const tbody = document.getElementById('recentLoansTableBody');
  if (!tbody) return;

  if (!loans || loans.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8;">No loan activity recorded yet.</td></tr>`;
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  tbody.innerHTML = loans.map(loan => {
    let badge = `<span class="badge badge-info">Issued</span>`;
    if (loan.status === 'Returned' || loan.return_date) {
      badge = `<span class="badge badge-success">Returned</span>`;
    } else if (loan.status === 'Overdue' || loan.due_date < today) {
      badge = `<span class="badge badge-danger">Overdue</span>`;
    }

    return `
      <tr>
        <td><strong>${escapeHtml(loan.loan_code)}</strong></td>
        <td>
          <div style="font-weight:600;color:#fff;">${escapeHtml(loan.book_title)}</div>
          <small style="color:#64748b;">${escapeHtml(loan.book_code || '')}</small>
        </td>
        <td>
          <div>${escapeHtml(loan.member_name)}</div>
          <small style="color:#64748b;">${escapeHtml(loan.member_code || '')}</small>
        </td>
        <td>${formatDate(loan.issue_date)}</td>
        <td>${formatDate(loan.due_date)}</td>
        <td>${badge}</td>
      </tr>
    `;
  }).join('');
}
