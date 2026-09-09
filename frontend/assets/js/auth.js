/**
 * Authentication Management (Login, Validation, Session handling)
 */

document.addEventListener('DOMContentLoaded', () => {
  // If already authenticated on login page, redirect to dashboard
  if (api.isAuthenticated() && !window.location.search.includes('expired')) {
    window.location.href = '/index.html';
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const errorAlert = document.getElementById('errorAlert');
  const quickFillBtn = document.getElementById('quickFillBtn');

  if (quickFillBtn) {
    quickFillBtn.addEventListener('click', () => {
      emailInput.value = 'akhilesh@library.com';
      passwordInput.value = 'Password@123';
      showToast('Credentials filled. Click Sign In.', 'info');
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        showError('Please enter both email and password.');
        return;
      }

      setLoading(true);
      hideError();

      try {
        const res = await api.post('/auth/login', { email, password });

        if (res.success && res.token) {
          api.setSession(res.token, res.user);
          showToast(`Welcome, ${res.user.name}!`, 'success');
          
          setTimeout(() => {
            window.location.href = '/index.html';
          }, 400);
        } else {
          showError(res.message || 'Login failed.');
        }
      } catch (err) {
        showError(err.message || 'Invalid email or password. Please try again.');
      } finally {
        setLoading(false);
      }
    });
  }

  function setLoading(isLoading) {
    if (loginBtn) {
      loginBtn.disabled = isLoading;
      loginBtn.innerHTML = isLoading 
        ? `<div class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></div> Authenticating...`
        : `Sign In to Digital Librarian`;
    }
  }

  function showError(msg) {
    if (errorAlert) {
      errorAlert.textContent = msg;
      errorAlert.style.display = 'block';
    }
  }

  function hideError() {
    if (errorAlert) {
      errorAlert.textContent = '';
      errorAlert.style.display = 'none';
    }
  }
});
