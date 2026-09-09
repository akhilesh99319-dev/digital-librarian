/**
 * Librarian Profile Controller
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
      document.getElementById('profileName').value = u.name || 'Akhilesh Kumar';
      document.getElementById('profileEmail').value = u.email || 'akhilesh@library.com';
      document.getElementById('profilePhone').value = u.phone || '';
      
      const roleBadge = document.getElementById('profileRoleBadge');
      if (roleBadge) roleBadge.textContent = 'Librarian';

      const cardName = document.getElementById('profileCardName');
      if (cardName) cardName.textContent = u.name || 'Akhilesh Kumar';

      const cardEmail = document.getElementById('profileCardEmail');
      if (cardEmail) cardEmail.textContent = u.email || 'akhilesh@library.com';
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

  if (!name) {
    showToast('Name is required.', 'warning');
    return;
  }

  const btn = document.getElementById('btnSaveProfile');
  if (btn) btn.disabled = true;

  try {
    const res = await api.put('/auth/profile', { name, phone });
    if (res.success && res.user) {
      api.setSession(api.getToken(), res.user);
      showToast('Profile updated successfully!', 'success');
      loadProfile();

      // Update sidebar displays
      document.querySelectorAll('.librarian-display-name').forEach(el => el.textContent = res.user.name);
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
