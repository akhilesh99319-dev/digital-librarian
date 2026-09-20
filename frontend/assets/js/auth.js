/**
 * Secure Authentication Controller (Email OTP + Google Sign-In)
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
  const loginOtpSection = document.getElementById('loginOtpSection');
  const registerSection = document.getElementById('registerSection');
  const registerOtpSection = document.getElementById('registerOtpSection');

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

  // Login OTP Elements
  const loginOtpForm = document.getElementById('loginOtpForm');
  const loginOtpInput = document.getElementById('loginOtpInput');
  const verifyLoginOtpBtn = document.getElementById('verifyLoginOtpBtn');
  const resendLoginOtpBtn = document.getElementById('resendLoginOtpBtn');
  const loginMaskedEmail = document.getElementById('loginMaskedEmail');

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

  // Register OTP Elements
  const registerOtpForm = document.getElementById('registerOtpForm');
  const regOtpInput = document.getElementById('regOtpInput');
  const verifyRegOtpBtn = document.getElementById('verifyRegOtpBtn');
  const resendRegOtpBtn = document.getElementById('resendRegOtpBtn');
  const regMaskedEmail = document.getElementById('regMaskedEmail');

  // State
  let loginTempToken = null;
  let regTempToken = null;
  let loginTimerInterval = null;
  let regTimerInterval = null;

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
    if (loginOtpSection) loginOtpSection.style.display = sectionName === 'loginOtp' ? 'block' : 'none';
    if (registerSection) registerSection.style.display = sectionName === 'register' ? 'block' : 'none';
    if (registerOtpSection) registerOtpSection.style.display = sectionName === 'registerOtp' ? 'block' : 'none';

    // Show/hide tabs when in OTP step
    if (authTabs) {
      authTabs.style.display = (sectionName === 'loginOtp' || sectionName === 'registerOtp') ? 'none' : 'flex';
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

  // Format OTP inputs (digits only)
  [loginOtpInput, regOtpInput].forEach(input => {
    if (input) {
      input.addEventListener('input', (e) => {
        input.value = input.value.replace(/\D/g, '').slice(0, 6);
      });
    }
  });

  // --- STEP 1: LOGIN CREDENTIALS SUBMISSION ---
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!email || !password) {
        showError('Please enter both email/member code and password.');
        return;
      }

      setLoginLoading(true);
      clearAlerts();

      try {
        const res = await api.post('/auth/login', { email, password });

        if (res.success && res.otp_required && res.temp_token) {
          loginTempToken = res.token || res.temp_token;
          if (loginMaskedEmail) loginMaskedEmail.textContent = res.email_masked || email;
          
          showSection('loginOtp');
          showSuccess(res.message || "We've sent a 6-digit verification code to your registered email.");
          if (loginOtpInput) {
            loginOtpInput.value = '';
            loginOtpInput.focus();
          }
          startResendCountdown('login', resendLoginOtpBtn, 45);
        } else if (res.success && res.token) {
          // Direct authentication fallback
          api.setSession(res.token, res.user);
          showToast(`Welcome back, ${res.user.name || 'User'}!`, 'success');
          setTimeout(() => redirectByRole(res.user), 350);
        } else {
          showError(res.message || 'Invalid email/member code or password.');
        }
      } catch (err) {
        showError(err.message || 'Invalid email/member code or password.');
      } finally {
        setLoginLoading(false);
      }
    });
  }

  // --- STEP 2: LOGIN OTP VERIFICATION ---
  if (loginOtpForm) {
    loginOtpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const otp = loginOtpInput ? loginOtpInput.value.trim() : '';
      if (!otp || otp.length !== 6) {
        showError('Please enter the complete 6-digit verification code.');
        if (loginOtpInput) loginOtpInput.focus();
        return;
      }

      setVerifyOtpLoading(true, verifyLoginOtpBtn, 'Verifying OTP...');
      clearAlerts();

      try {
        const res = await api.post('/auth/verify-otp', {
          temp_token: loginTempToken,
          otp
        });

        if (res.success && res.token) {
          api.setSession(res.token, res.user);
          showSuccess(`Authentication successful. Redirecting to portal...`);
          showToast(`Welcome back, ${res.user.name || 'User'}!`, 'success');
          
          setTimeout(() => {
            redirectByRole(res.user);
          }, 400);
        } else {
          showError(res.message || 'The verification code is incorrect or expired.');
        }
      } catch (err) {
        showError(err.message || 'The verification code is incorrect or expired.');
      } finally {
        setVerifyOtpLoading(false, verifyLoginOtpBtn, 'Verify OTP & Sign In');
      }
    });
  }

  // --- RESEND LOGIN OTP ---
  if (resendLoginOtpBtn) {
    resendLoginOtpBtn.addEventListener('click', async () => {
      if (resendLoginOtpBtn.disabled) return;

      clearAlerts();
      resendLoginOtpBtn.disabled = true;
      resendLoginOtpBtn.textContent = 'Sending...';

      try {
        const res = await api.post('/auth/resend-otp', { temp_token: loginTempToken });
        if (res.success) {
          showSuccess(res.message || 'A new verification code has been sent to your email.');
          showToast('New verification code sent!', 'info');
          startResendCountdown('login', resendLoginOtpBtn, 45);
        } else {
          showError(res.message || 'Failed to resend verification code.');
          resendLoginOtpBtn.disabled = false;
          resendLoginOtpBtn.textContent = 'Resend Code';
        }
      } catch (err) {
        showError(err.message || 'Failed to resend code. Please wait before retrying.');
        resendLoginOtpBtn.disabled = false;
        resendLoginOtpBtn.textContent = 'Resend Code';
      }
    });
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

        if (res.success && res.otp_required && res.temp_token) {
          regTempToken = res.temp_token;
          if (regMaskedEmail) regMaskedEmail.textContent = res.email_masked || email;
          
          showSection('registerOtp');
          showSuccess(res.message || "We've sent a 6-digit verification code to your email.");
          if (regOtpInput) {
            regOtpInput.value = '';
            regOtpInput.focus();
          }
          startResendCountdown('register', resendRegOtpBtn, 45);
        } else if (res.success) {
          // Account created directly
          registerForm.reset();
          switchTab('login');
          showSuccess(res.message || 'Account created successfully! Please sign in.');
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

  // --- STEP 2: REGISTRATION OTP VERIFICATION ---
  if (registerOtpForm) {
    registerOtpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const otp = regOtpInput ? regOtpInput.value.trim() : '';
      if (!otp || otp.length !== 6) {
        showError('Please enter the 6-digit verification code.');
        if (regOtpInput) regOtpInput.focus();
        return;
      }

      setVerifyOtpLoading(true, verifyRegOtpBtn, 'Activating Account...');
      clearAlerts();

      try {
        const res = await api.post('/auth/verify-register-otp', {
          temp_token: regTempToken,
          otp
        });

        if (res.success) {
          if (registerForm) registerForm.reset();
          if (registerOtpForm) registerOtpForm.reset();

          showSection('login');
          switchTab('login');
          showSuccess('Account verified and created successfully! You can now sign in with your credentials.');
          showToast('Account activated! Please sign in.', 'success');

          if (emailInput && res.user && res.user.email) {
            emailInput.value = res.user.email;
          }
          if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
          }
        } else {
          showError(res.message || 'The verification code is incorrect or expired.');
        }
      } catch (err) {
        showError(err.message || 'The verification code is incorrect or expired.');
      } finally {
        setVerifyOtpLoading(false, verifyRegOtpBtn, 'Verify Email & Activate Account');
      }
    });
  }

  // --- RESEND REGISTRATION OTP ---
  if (resendRegOtpBtn) {
    resendRegOtpBtn.addEventListener('click', async () => {
      if (resendRegOtpBtn.disabled) return;

      clearAlerts();
      resendRegOtpBtn.disabled = true;
      resendRegOtpBtn.textContent = 'Sending...';

      try {
        const res = await api.post('/auth/resend-otp', { temp_token: regTempToken });
        if (res.success) {
          showSuccess(res.message || 'A new verification code has been sent to your email.');
          showToast('New verification code sent!', 'info');
          startResendCountdown('register', resendRegOtpBtn, 45);
        } else {
          showError(res.message || 'Failed to resend code.');
          resendRegOtpBtn.disabled = false;
          resendRegOtpBtn.textContent = 'Resend Code';
        }
      } catch (err) {
        showError(err.message || 'Failed to resend code. Please wait before retrying.');
        resendRegOtpBtn.disabled = false;
        resendRegOtpBtn.textContent = 'Resend Code';
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

  function startResendCountdown(type, btnEl, seconds = 45) {
    if (!btnEl) return;
    let remaining = seconds;
    btnEl.disabled = true;
    btnEl.textContent = `Resend OTP in ${remaining}s`;

    if (type === 'login' && loginTimerInterval) clearInterval(loginTimerInterval);
    if (type === 'register' && regTimerInterval) clearInterval(regTimerInterval);

    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        btnEl.disabled = false;
        btnEl.textContent = 'Resend Code';
      } else {
        btnEl.textContent = `Resend OTP in ${remaining}s`;
      }
    }, 1000);

    if (type === 'login') loginTimerInterval = interval;
    if (type === 'register') regTimerInterval = interval;
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
        ? `<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></div> Sending Verification Code...`
        : `Create Account & Verify Email &rarr;`;
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
