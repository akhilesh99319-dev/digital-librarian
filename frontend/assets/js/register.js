/**
 * Library Management System - Standalone Registration Controller with Email OTP
 * Digital Librarian System
 */

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const registerOtpSection = document.getElementById('registerOtpSection');
  const registerOtpForm = document.getElementById('registerOtpForm');

  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const termsCheckbox = document.getElementById('terms');
  const formMessage = document.getElementById('formMessage');

  const passwordToggle = document.getElementById('passwordToggle');
  const confirmPasswordToggle = document.getElementById('confirmPasswordToggle');

  const registerSubmitBtn = document.getElementById('registerSubmitBtn');
  const verifyRegOtpSubmitBtn = document.getElementById('verifyRegOtpSubmitBtn');
  const resendRegOtpBtn = document.getElementById('resendRegOtpBtn');
  const backToFormBtn = document.getElementById('backToFormBtn');
  const registerMaskedEmail = document.getElementById('registerMaskedEmail');
  const regOtpCodeInput = document.getElementById('regOtpCode');

  let regTempToken = null;
  let resendTimer = null;

  // Setup password toggles
  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
      const isPass = passwordInput.type === 'password';
      passwordInput.type = isPass ? 'text' : 'password';
      passwordToggle.textContent = isPass ? '🙈' : '👁️';
    });
  }

  if (confirmPasswordToggle && confirmPasswordInput) {
    confirmPasswordToggle.addEventListener('click', () => {
      const isPass = confirmPasswordInput.type === 'password';
      confirmPasswordInput.type = isPass ? 'text' : 'password';
      confirmPasswordToggle.textContent = isPass ? '🙈' : '👁️';
    });
  }

  if (backToFormBtn) {
    backToFormBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (registerForm) registerForm.style.display = 'block';
      if (registerOtpSection) registerOtpSection.style.display = 'none';
      clearMessage();
    });
  }

  if (regOtpCodeInput) {
    regOtpCodeInput.addEventListener('input', () => {
      regOtpCodeInput.value = regOtpCodeInput.value.replace(/\D/g, '').slice(0, 6);
    });
  }

  // --- STEP 1: SUBMIT REGISTRATION FORM ---
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = fullNameInput ? fullNameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';
      const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
      const terms = termsCheckbox ? termsCheckbox.checked : true;

      // Validation
      if (!name || name.length < 2) {
        showMessage('Please enter a valid full name (at least 2 characters).', 'error');
        if (fullNameInput) fullNameInput.focus();
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        showMessage('Please enter a valid email address.', 'error');
        if (emailInput) emailInput.focus();
        return;
      }

      if (!password || password.length < 6) {
        showMessage('Password must contain at least 6 characters.', 'error');
        if (passwordInput) passwordInput.focus();
        return;
      }

      if (password !== confirmPassword) {
        showMessage('Passwords do not match.', 'error');
        if (confirmPasswordInput) confirmPasswordInput.focus();
        return;
      }

      if (!terms) {
        showMessage('Please accept the Terms & Conditions.', 'error');
        return;
      }

      if (registerSubmitBtn) {
        registerSubmitBtn.disabled = true;
        registerSubmitBtn.innerHTML = '<span>Sending Verification Code...</span>';
      }

      clearMessage();

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
          if (registerMaskedEmail) registerMaskedEmail.textContent = res.email_masked || email;
          
          registerForm.style.display = 'none';
          if (registerOtpSection) registerOtpSection.style.display = 'block';

          showMessage(res.message || "We've sent a 6-digit verification code to your email.", 'success');
          if (regOtpCodeInput) {
            regOtpCodeInput.value = '';
            regOtpCodeInput.focus();
          }
          startResendCountdown(45);
        } else if (res.success) {
          showMessage(res.message || 'Account created successfully! Redirecting to login...', 'success');
          registerForm.reset();
          setTimeout(() => {
            window.location.href = './login.html';
          }, 1200);
        } else {
          showMessage(res.message || 'Registration failed.', 'error');
        }
      } catch (err) {
        showMessage(err.message || 'Registration failed. Please check your inputs.', 'error');
      } finally {
        if (registerSubmitBtn) {
          registerSubmitBtn.disabled = false;
          registerSubmitBtn.innerHTML = '<span>Create Account & Verify Email</span> <span>→</span>';
        }
      }
    });
  }

  // --- STEP 2: VERIFY REGISTRATION OTP ---
  if (registerOtpForm) {
    registerOtpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const otp = regOtpCodeInput ? regOtpCodeInput.value.trim() : '';
      if (!otp || otp.length !== 6) {
        showMessage('Please enter the 6-digit verification code.', 'error');
        if (regOtpCodeInput) regOtpCodeInput.focus();
        return;
      }

      if (verifyRegOtpSubmitBtn) {
        verifyRegOtpSubmitBtn.disabled = true;
        verifyRegOtpSubmitBtn.innerHTML = '<span>Verifying & Activating...</span>';
      }

      clearMessage();

      try {
        const res = await api.post('/auth/verify-register-otp', {
          temp_token: regTempToken,
          otp
        });

        if (res.success) {
          showMessage('Account verified and created successfully! Redirecting to login...', 'success');
          registerForm.reset();
          registerOtpForm.reset();
          setTimeout(() => {
            window.location.href = './login.html';
          }, 1200);
        } else {
          showMessage(res.message || 'The verification code is incorrect or expired.', 'error');
        }
      } catch (err) {
        showMessage(err.message || 'The verification code is incorrect or expired.', 'error');
      } finally {
        if (verifyRegOtpSubmitBtn) {
          verifyRegOtpSubmitBtn.disabled = false;
          verifyRegOtpSubmitBtn.innerHTML = '<span>Verify Email & Activate Account</span> <span>→</span>';
        }
      }
    });
  }

  // --- RESEND OTP ---
  if (resendRegOtpBtn) {
    resendRegOtpBtn.addEventListener('click', async () => {
      if (resendRegOtpBtn.disabled) return;

      clearMessage();
      resendRegOtpBtn.disabled = true;
      resendRegOtpBtn.textContent = 'Sending...';

      try {
        const res = await api.post('/auth/resend-otp', { temp_token: regTempToken });
        if (res.success) {
          showMessage(res.message || 'A new verification code has been sent to your email.', 'success');
          startResendCountdown(45);
        } else {
          showMessage(res.message || 'Failed to resend code.', 'error');
          resendRegOtpBtn.disabled = false;
          resendRegOtpBtn.textContent = 'Resend Code';
        }
      } catch (err) {
        showMessage(err.message || 'Failed to resend code. Please wait before retrying.', 'error');
        resendRegOtpBtn.disabled = false;
        resendRegOtpBtn.textContent = 'Resend Code';
      }
    });
  }

  function startResendCountdown(seconds = 45) {
    if (!resendRegOtpBtn) return;
    let remaining = seconds;
    resendRegOtpBtn.disabled = true;
    resendRegOtpBtn.textContent = `Resend OTP in ${remaining}s`;

    if (resendTimer) clearInterval(resendTimer);

    resendTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(resendTimer);
        resendRegOtpBtn.disabled = false;
        resendRegOtpBtn.textContent = 'Resend Code';
      } else {
        resendRegOtpBtn.textContent = `Resend OTP in ${remaining}s`;
      }
    }, 1000);
  }

  function showMessage(msg, type = 'error') {
    if (formMessage) {
      formMessage.textContent = msg;
      formMessage.className = `form-message ${type}`;
      formMessage.style.display = 'block';
    }
  }

  function clearMessage() {
    if (formMessage) {
      formMessage.textContent = '';
      formMessage.style.display = 'none';
    }
  }
});