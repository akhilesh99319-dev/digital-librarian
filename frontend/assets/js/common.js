/**
 * Common Application Utilities, Theme Controller, & UI Handlers
 */

// Theme Management (Dark / Light mode)
function initTheme() {
  const savedTheme = localStorage.getItem('library_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Update theme toggle buttons if present
  updateThemeToggleUI(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('library_theme', newTheme);
  updateThemeToggleUI(newTheme);
}

function updateThemeToggleUI(theme) {
  const btns = document.querySelectorAll('.theme-toggle-btn');
  btns.forEach(btn => {
    btn.innerHTML = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  });
}

// Toast Notifications System
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    success: `<svg fill="none" stroke="currentColor" width="20" height="20" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
    error: `<svg fill="none" stroke="currentColor" width="20" height="20" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
    warning: `<svg fill="none" stroke="currentColor" width="20" height="20" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
    info: `<svg fill="none" stroke="currentColor" width="20" height="20" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
  };

  toast.innerHTML = `
    <span style="display:flex;align-items:center;">${iconMap[type] || iconMap.info}</span>
    <span style="flex:1;font-size:13.5px;font-weight:500;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideInToast 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Modal Dialog Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Global Initialization
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  const path = window.location.pathname;
  const isPublicPage = ['login.html', 'register.html', 'forgot-password.html', 'reset-password.html'].some(p => path.endsWith(p));
  const memberAllowedPages = ['dashboard.html', 'available-books.html', 'my-books.html', 'notifications.html', 'profile.html', 'book-details.html'];
  const isMemberPage = memberAllowedPages.some(page => path.endsWith(page));
  const user = api.getUser();

  // Authentication check
  if (!isPublicPage && !api.isAuthenticated()) {
    window.location.href = '/login.html';
    return;
  }

  // Strict Role based routing check
  if (user && user.role === 'Member') {
    if (!isPublicPage && !isMemberPage) {
      if (path.endsWith('books.html')) {
        window.location.href = '/available-books.html';
      } else {
        window.location.href = '/dashboard.html';
      }
      return;
    }
  } else if (user && (user.role === 'Librarian' || user.role === 'Admin')) {
    if (path.endsWith('dashboard.html') || path === '/') {
      window.location.href = '/index.html';
      return;
    }
  }

  // Role Adaptive Sidebar Navigation Switching
  const memberSidebarNav = document.getElementById('memberSidebarNav');
  const librarianSidebarNav = document.getElementById('librarianSidebarNav');
  const sidebarBrandRole = document.getElementById('sidebarBrandRole');

  if (user && user.role === 'Member') {
    if (memberSidebarNav) memberSidebarNav.style.display = 'block';
    if (librarianSidebarNav) librarianSidebarNav.style.display = 'none';
    if (sidebarBrandRole) sidebarBrandRole.textContent = 'Member Portal';
  } else if (user) {
    if (memberSidebarNav) memberSidebarNav.style.display = 'none';
    if (librarianSidebarNav) librarianSidebarNav.style.display = 'block';
    if (sidebarBrandRole) sidebarBrandRole.textContent = 'Management System';
  }

  // Active Navigation State Auto-Highlight
  document.querySelectorAll('.sidebar-nav a.nav-item').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (path.endsWith(href) || (href === '/dashboard.html' && path.endsWith('/dashboard.html')))) {
      link.classList.add('active');
    }
  });

  // Populate User info in sidebar & header
  if (user) {
    const isMember = user.role === 'Member';
    const initials = (user.name || (isMember ? 'M' : 'AK'))
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    document.querySelectorAll('.librarian-display-name').forEach(el => el.textContent = user.name || (user.role === 'Librarian' ? 'Akhilesh Kumar' : 'Member'));
    document.querySelectorAll('.librarian-display-role').forEach(el => el.textContent = user.role || 'Librarian');
    document.querySelectorAll('.member-display-name').forEach(el => el.textContent = user.name || 'Member');
    document.querySelectorAll('.member-display-role').forEach(el => el.textContent = user.role || 'Member');
    document.querySelectorAll('.member-display-code').forEach(el => el.textContent = user.member_code || `MEM-${String(user.id).padStart(3, '0')}`);
    document.querySelectorAll('.member-display-email').forEach(el => el.textContent = user.email || 'No email registered');
    document.querySelectorAll('.member-display-phone').forEach(el => el.textContent = user.phone || '—');
    document.querySelectorAll('.member-display-status').forEach(el => el.textContent = user.status || 'Active');
    document.querySelectorAll('.member-display-date').forEach(el => el.textContent = user.membership_date ? formatDate(user.membership_date) : (user.created_at ? formatDate(user.created_at) : '—'));

    document.querySelectorAll('#sidebarAvatar, .sidebar-avatar, .librarian-avatar').forEach(el => {
      if (initials && !el.textContent.includes('👤') && !el.textContent.includes('AK')) {
        el.textContent = initials;
      }
    });
  }

  // Mobile Sidebar Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const sidebar = document.getElementById('sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Theme Toggle Button Event
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  // Logout Handlers
  const logoutBtns = document.querySelectorAll('.btn-logout, .action-logout');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to log out of Digital Librarian?')) {
        api.clearSession();
        window.location.href = '/login.html';
      }
    });
  });

  // Close modals on overlay backdrop click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  // Close modal with Esc key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
    }
  });
});

// Formatters
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return `₹${num.toFixed(2)}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
