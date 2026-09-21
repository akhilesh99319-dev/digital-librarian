/**
 * Secure Authentication Controller (Password + Google Sign-In)
 * Digital Librarian System
 */

document.addEventListener('DOMContentLoaded', () => {
  // If already authenticated on login page, redirect to appropriate role portal
  if (api.isAuthenticated() && !window.location.search.includes('expired')) {
    const user = api.getUser();
    redirectByRole(user);
    return;
  }

  // DOM Elements - Tabs & Containers
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');
  const authTabs = document.getElementById('authTabs');
  const loginSection = document.getElementById('loginSection');
  const registerSection = document.getElementById('registerSection');

  const linkToRegister = document.getElementById('linkToRegister');
  const linkToLogin = document.getElementById('linkToLogin');
  const backToLoginBtn = document.getElementById('backToLoginBtn');
  const backToRegDetailsBtn = document.getElementById('backToRegDetailsBtn');

  const errorAlert = document.getElementById('errorAlert');
  const successAlert = document.getElementById('successAlert');

  // Login Form Elements
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const loginPwToggle = document.getElementById('loginPwToggle');
  const customGoogleBtn = document.getElementById('customGoogleBtn');

  // Register Form Elements
  const registerForm = document.getElementById('registerForm');
  const regNameInput = document.getElementById('regName');
  const regEmailInput = document.getElementById('regEmail');
  const regPhoneInput = document.getElementById('regPhone');
  const regPasswordInput = document.getElementById('regPassword');
  const regConfirmPasswordInput = document.getElementById('regConfirmPassword');
  const registerBtn = document.getElementById('registerBtn');
  const regPwToggle = document.getElementById('regPwToggle');
  const regConfirmPwToggle = document.getElementById('regConfirmPwToggle');

  // State

  // Handle URL parameters (#register or ?tab=register)
  const urlParams = new URLSearchParams(window.location.search);
  if (window.location.hash === '#register' || urlParams.get('tab') === 'register') {
    switchTab('register');
  }

  // Tab Switch Handlers
  if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => switchTab('login'));
  if (tabRegisterBtn) tabRegisterBtn.addEventListener('click', () => switchTab('register'));
  if (linkToRegister) linkToRegister.addEventListener('click', (e) => { e.preventDefault(); switchTab('register'); });
  if (linkToLogin) linkToLogin.addEventListener('click', (e) => { e.preventDefault(); switchTab('login'); });

  if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('login');
      clearAlerts();
    });
  }

  if (backToRegDetailsBtn) {
    backToRegDetailsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('register');
      clearAlerts();
    });
  }

  function switchTab(tab) {
    clearAlerts();
    if (tab === 'register') {
      if (tabRegisterBtn) tabRegisterBtn.classList.add('active');
      if (tabLoginBtn) tabLoginBtn.classList.remove('active');
      showSection('register');
      if (regNameInput) regNameInput.focus();
    } else {
      if (tabLoginBtn) tabLoginBtn.classList.add('active');
      if (tabRegisterBtn) tabRegisterBtn.classList.remove('active');
      showSection('login');
      if (emailInput) emailInput.focus();
    }
  }

  function showSection(sectionName) {
    if (loginSection) loginSection.style.display = sectionName === 'login' ? 'block' : 'none';
    if (registerSection) registerSection.style.display = sectionName === 'register' ? 'block' : 'none';

    // Show/hide tabs when in OTP step
    if (authTabs) {
      authTabs.style.display = 'flex';
    }
  }

  // Password Visibility Toggles
  setupPasswordToggle(loginPwToggle, passwordInput);
  setupPasswordToggle(regPwToggle, regPasswordInput);
  setupPasswordToggle(regConfirmPwToggle, regConfirmPasswordInput);

  function setupPasswordToggle(toggleBtn, inputEl) {
    if (toggleBtn && inputEl) {
      toggleBtn.addEventListener('click', () => {
        const isPassword = inputEl.type === 'password';
        inputEl.type = isPassword ? 'text' : 'password';
        toggleBtn.textContent = isPassword ? '🙈' : '👁️';
        toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      });
    }
  }

  // --- STEP 1: REGISTRATION SUBMISSION ---
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = regNameInput ? regNameInput.value.trim() : '';
      const email = regEmailInput ? regEmailInput.value.trim() : '';
      const phone = regPhoneInput ? regPhoneInput.value.trim() : '';
      const password = regPasswordInput ? regPasswordInput.value : '';
      const confirmPassword = regConfirmPasswordInput ? regConfirmPasswordInput.value : '';

      if (!name || name.length < 2) {
        showError('Please enter your full name (at least 2 characters).');
        if (regNameInput) regNameInput.focus();
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        showError('Please enter a valid email address.');
        if (regEmailInput) regEmailInput.focus();
        return;
      }

      if (!password || password.length < 6) {
        showError('Password must be at least 6 characters long.');
        if (regPasswordInput) regPasswordInput.focus();
        return;
      }

      if (password !== confirmPassword) {
        showError('Password confirmation does not match.');
        if (regConfirmPasswordInput) regConfirmPasswordInput.focus();
        return;
      }

      setRegisterLoading(true);
      clearAlerts();

      try {
        const res = await api.post('/auth/register', {
          name,
          email,
          phone,
          password,
          confirm_password: confirmPassword
        });

        if (res.success) {
          registerForm.reset();
          switchTab('login');
          showSuccess(res.message || 'Account created successfully! Please sign in.');
          if (emailInput && res.user && res.user.email) emailInput.value = res.user.email;
          if (passwordInput) passwordInput.focus();
        } else {
          showError(res.message || 'Registration failed.');
        }
      } catch (err) {
        showError(err.message || 'Registration failed. Please check your information and try again.');
      } finally {
        setRegisterLoading(false);
      }
    });
  }

  // --- GOOGLE SIGN-IN INTEGRATION ---
  function initGoogleAuth() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: window.GOOGLE_CLIENT_ID || '1029384756-digitallibrarian.apps.googleusercontent.com',
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true
        });

        if (customGoogleBtn) {
          customGoogleBtn.addEventListener('click', () => {
            clearAlerts();
            window.google.accounts.id.prompt((notification) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                // If One-Tap prompt is suppressed, simulate token prompt for demo/test
                showError('Google Sign-In prompt initialized. Please select your authorized Google account.');
              }
            });
          });
        }
      } catch (gErr) {
        console.warn('Google Identity initialization notice:', gErr.message);
      }
    } else if (customGoogleBtn) {
      customGoogleBtn.addEventListener('click', () => {
        showError('Google Identity Services is loading. Please verify network connection or try again in a moment.');
      });
    }
  }

  async function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) {
      showError('Google authentication response was empty. Please try again.');
      return;
    }

    setLoginLoading(true);
    clearAlerts();

    try {
      const res = await api.post('/auth/google', { id_token: response.credential });

      if (res.success && res.token) {
        api.setSession(res.token, res.user);
        showToast(`Google Sign-In verified! Welcome, ${res.user.name || 'User'}`, 'success');
        setTimeout(() => redirectByRole(res.user), 350);
      } else {
        showError(res.message || 'No library account is associated with this Google account. Please register first or contact the library administrator.');
      }
    } catch (err) {
      showError(err.message || 'No library account is associated with this Google account. Please register first or contact the library administrator.');
    } finally {
      setLoginLoading(false);
    }
  }

  // Check Google SDK availability
  if (window.google) {
    initGoogleAuth();
  } else {
    window.addEventListener('load', initGoogleAuth);
  }

  // --- HELPERS ---
  function redirectByRole(user) {
    if (user && user.role === 'Member') {
      window.location.href = '/dashboard.html';
    } else {
      window.location.href = '/index.html';
    }
  }

  function setLoginLoading(isLoading) {
    if (loginBtn) {
      loginBtn.disabled = isLoading;
      loginBtn.innerHTML = isLoading 
        ? `<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></div> Validating...`
        : `Sign In`;
    }
  }

  function setRegisterLoading(isLoading) {
    if (registerBtn) {
      registerBtn.disabled = isLoading;
      registerBtn.innerHTML = isLoading 
        ? `<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></div> Creating Account...`
        : `Create Account`;
    }
  }

  function setVerifyOtpLoading(isLoading, btn, defaultText) {
    if (btn) {
      btn.disabled = isLoading;
      btn.innerHTML = isLoading 
        ? `<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></div> Verifying...`
        : defaultText;
    }
  }

  function showError(msg) {
    if (errorAlert) {
      errorAlert.textContent = msg;
      errorAlert.style.display = 'block';
    }
    if (successAlert) successAlert.style.display = 'none';
  }

  function showSuccess(msg) {
    if (successAlert) {
      successAlert.textContent = msg;
      successAlert.style.display = 'block';
    }
    if (errorAlert) errorAlert.style.display = 'none';
  }

  function clearAlerts() {
    if (errorAlert) {
      errorAlert.textContent = '';
      errorAlert.style.display = 'none';
    }
    if (successAlert) {
      successAlert.textContent = '';
      successAlert.style.display = 'none';
    }
  }
});
