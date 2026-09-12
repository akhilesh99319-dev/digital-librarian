/**
 * Library Management System - Standalone Registration Controller
 * Digital Librarian System
 */

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const termsCheckbox = document.getElementById('terms');
  const formMessage = document.getElementById('formMessage');

  const passwordToggle = document.getElementById('passwordToggle');
  const confirmPasswordToggle = document.getElementById('confirmPasswordToggle');

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

      const submitBtn = registerForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Creating Account...</span>';
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

        if (res.success) {
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
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Create Account</span> <span>→</span>';
        }
      }
    });
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