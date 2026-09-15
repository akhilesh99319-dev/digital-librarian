/**
 * Notifications Management Controller
 * Digital Librarian System
 */

let allNotifications = [];
let currentFilter = 'all';
let readNotificationIds = new Set(JSON.parse(localStorage.getItem('read_notifications') || '[]'));

document.addEventListener('DOMContentLoaded', () => {
  initNotificationsPage();
});

async function initNotificationsPage() {
  setupFilterHandlers();
  await loadNotifications();
}

function setupFilterHandlers() {
  const filterPills = document.querySelectorAll('.filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.getAttribute('data-filter');
      renderNotifications();
    });
  });

  const markAllBtn = document.getElementById('btnMarkAllRead');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', () => {
      allNotifications.forEach(n => readNotificationIds.add(n.id));
      localStorage.setItem('read_notifications', JSON.stringify(Array.from(readNotificationIds)));
      showToast('All notifications marked as read.', 'success');
      renderNotifications();
    });
  }

  const refreshBtn = document.getElementById('btnRefreshNotifs');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadNotifications();
      showToast('Notifications refreshed.', 'info');
    });
  }
}

async function loadNotifications() {
  const loadingEl = document.getElementById('notifLoading');
  const emptyEl = document.getElementById('notifEmpty');
  const listEl = document.getElementById('notificationsList');

  if (loadingEl) loadingEl.style.display = 'flex';
  if (emptyEl) emptyEl.style.display = 'none';
  if (listEl) listEl.innerHTML = '';

  try {
    const res = await api.get('/loans/notifications');
    if (res.success && Array.isArray(res.data)) {
      allNotifications = res.data;
      if (loadingEl) loadingEl.style.display = 'none';
      renderNotifications();
    } else {
      throw new Error(res.message || 'Failed to retrieve notifications');
    }
  } catch (err) {
    console.error('Failed to load notifications:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
  }
}

function renderNotifications() {
  const listEl = document.getElementById('notificationsList');
  const emptyEl = document.getElementById('notifEmpty');
  const badgeEl = document.getElementById('notifCountBadge');

  if (!listEl) return;

  let filtered = allNotifications.filter(n => {
    if (currentFilter === 'requests') {
      return n.type.startsWith('request_') || n.type === 'book_issued';
    } else if (currentFilter === 'due') {
      return n.type === 'book_due_soon' || n.type === 'book_overdue' || n.type === 'overdue_summary';
    } else if (currentFilter === 'fines') {
      return n.type === 'fine_unpaid';
    }
    return true;
  });

  if (badgeEl) badgeEl.textContent = `${filtered.length} Total`;

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = filtered.map(n => {
    const isRead = readNotificationIds.has(n.id);
    const unreadIndicator = !isRead 
      ? '<span style="width:8px;height:8px;border-radius:50%;background:#38bdf8;display:inline-block;margin-left:6px;" title="Unread"></span>' 
      : '';

    let formattedDate = 'Recent';
    if (n.date) {
      try {
        formattedDate = new Date(n.date).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        formattedDate = n.date;
      }
    }

    return `
      <div class="notif-item" style="opacity:${isRead ? '0.75' : '1'};">
        <div class="notif-icon">${n.icon || '🔔'}</div>
        <div class="notif-content">
          <div class="notif-title">
            ${escapeHtml(n.title || 'Notification')}
            ${unreadIndicator}
          </div>
          <div class="notif-desc">${escapeHtml(n.message || '')}</div>
          <div class="notif-time">${escapeHtml(formattedDate)}</div>
        </div>
      </div>
    `;
  }).join('');
}