/**
 * User Profile Controller (Supports both Member Portal and Librarian roles)
 * Digital Librarian System
 */

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  setupEventListeners();
});

function setupEventListeners() {
  const profileForm = document.getElementById('profileForm');
  const passwordForm = document.getElementById('passwordForm');

  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }

  if (passwordForm) {
    passwordForm.addEventListener('submit', handlePasswordChange);
  }
}

async function loadProfile() {
  try {
    const res = await api.get('/auth/me');
    if (res.success && res.user) {
      const u = res.user;
      const isMember = u.role === 'Member';

      // Sidebar configuration
      const memberNav = document.getElementById('memberSidebarNav');
      const librarianNav = document.getElementById('librarianSidebarNav');
      const brandRole = document.getElementById('sidebarBrandRole');

      if (isMember) {
        if (memberNav) memberNav.style.display = 'block';
        if (librarianNav) librarianNav.style.display = 'none';
        if (brandRole) brandRole.textContent = 'Member Portal';
      } else {
        if (memberNav) memberNav.style.display = 'none';
        if (librarianNav) librarianNav.style.display = 'block';
        if (brandRole) brandRole.textContent = 'Management System';
      }

      // Page headings
      const heading = document.getElementById('profilePageHeading');
      const subheading = document.getElementById('profilePageSubheading');
      if (heading) heading.textContent = isMember ? 'Member Profile' : `${u.role} Profile`;
      if (subheading) subheading.textContent = isMember ? 'Your library patron membership details & credentials' : 'Administrator account details & configuration';

      // Form inputs
      const nameInput = document.getElementById('profileName');
      const emailInput = document.getElementById('profileEmail');
      const phoneInput = document.getElementById('profilePhone');
      const addressInput = document.getElementById('profileAddress');

      if (nameInput) nameInput.value = u.name || '';
      if (emailInput) emailInput.value = u.email || '';
      if (phoneInput) phoneInput.value = u.phone || '';
      if (addressInput) addressInput.value = u.address || '';

      // Card Badge Elements
      const cardName = document.getElementById('profileCardName');
      const cardEmail = document.getElementById('profileCardEmail');
      const roleBadge = document.getElementById('profileRoleBadge');
      const idDisplay = document.getElementById('profileIdDisplay');
      const statusDisplay = document.getElementById('profileStatusDisplay');
      const joinedDisplay = document.getElementById('profileJoinedDisplay');
      const joinedRow = document.getElementById('profileJoinedRow');
      const avatarBig = document.getElementById('profileAvatarBig');

      if (cardName) cardName.textContent = u.name || 'User';
      if (cardEmail) cardEmail.textContent = u.email || 'No email registered';
      if (roleBadge) {
        roleBadge.textContent = u.role || 'Member';
        roleBadge.className = isMember ? 'badge badge-info' : 'badge badge-primary';
      }
      if (idDisplay) {
        idDisplay.textContent = u.member_code || (isMember ? `MEM-${String(u.id).padStart(3, '0')}` : `USR-${String(u.id).padStart(3, '0')}`);
      }
      if (statusDisplay) statusDisplay.textContent = u.status || 'Active';
      if (joinedDisplay) joinedDisplay.textContent = u.membership_date ? formatDate(u.membership_date) : (u.created_at ? formatDate(u.created_at) : '—');

      if (avatarBig) {
        const initials = (u.name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatarBig.textContent = initials || '👤';
      }

      // Render My Member QR Code for authenticated Members
      const memberQRCard = document.getElementById('memberQRCard');
      const memberQRContainer = document.getElementById('memberQRCodeContainer');
      const qrMemberName = document.getElementById('qrMemberName');
      const qrMemberCode = document.getElementById('qrMemberCode');
      const btnPrintQR = document.getElementById('btnPrintMemberQR');
      const qrEngine = window.QRCore || (typeof QRCore !== 'undefined' ? QRCore : null);

      if (isMember && memberQRCard && memberQRContainer && qrEngine) {
        memberQRCard.style.display = 'block';
        const mCode = u.member_code || `MEM-${String(u.id).padStart(3, '0')}`;
        if (qrMemberName) qrMemberName.textContent = u.name || 'Member';
        if (qrMemberCode) qrMemberCode.textContent = mCode;

        const payload = qrEngine.formatMemberQR(u.id, mCode);
        qrEngine.renderQRCode(payload, memberQRContainer, { size: 160, colorDark: '#0f172a' });

        if (btnPrintQR) {
          btnPrintQR.onclick = () => {
            window.print();
          };
        }
      } else if (memberQRCard) {
        memberQRCard.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
    showToast('Failed to load profile details.', 'error');
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault();

  const name = document.getElementById('profileName').value.trim();
  const phone = document.getElementById('profilePhone').value.trim();
  const addressInput = document.getElementById('profileAddress');
  const address = addressInput ? addressInput.value.trim() : null;

  if (!name) {
    showToast('Name is required.', 'warning');
    return;
  }

  const btn = document.getElementById('btnSaveProfile');
  if (btn) btn.disabled = true;

  try {
    const res = await api.put('/auth/profile', { name, phone, address });
    if (res.success && res.user) {
      api.setSession(api.getToken(), res.user);
      showToast('Profile updated successfully!', 'success');
      loadProfile();

      // Update sidebar displays
      document.querySelectorAll('.librarian-display-name, .member-display-name').forEach(el => el.textContent = res.user.name);
    }
  } catch (err) {
    showToast(err.message || 'Failed to update profile.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handlePasswordChange(e) {
  e.preventDefault();

  const current_password = document.getElementById('currPassword').value;
  const new_password = document.getElementById('newPassword').value;
  const confirm_password = document.getElementById('confirmPassword').value;

  if (!current_password || !new_password) {
    showToast('Please enter your current and new password.', 'warning');
    return;
  }

  if (new_password.length < 6) {
    showToast('New password must be at least 6 characters.', 'warning');
    return;
  }

  if (new_password !== confirm_password) {
    showToast('New password confirmation does not match.', 'error');
    return;
  }

  const btn = document.getElementById('btnChangePassword');
  if (btn) btn.disabled = true;

  try {
    const res = await api.post('/auth/change-password', {
      current_password,
      new_password,
      confirm_password
    });

    if (res.success) {
      showToast('Password changed successfully!', 'success');
      document.getElementById('passwordForm').reset();
    }
  } catch (err) {
    showToast(err.message || 'Failed to change password.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
