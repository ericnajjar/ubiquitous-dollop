// DataScope Auth Page — login / signup form handler
(function () {
  const ds = window.datascope || {};
  const sb = ds.sb;

  if (!sb) {
    document.getElementById('authForm').hidden = true;
    document.getElementById('authToggle').hidden = true;
    document.getElementById('noConfig').hidden = false;
    return;
  }

  let isSignUp = false;
  const form = document.getElementById('authForm');
  const titleEl = document.getElementById('authTitle');
  const submitBtn = document.getElementById('submitBtn');
  const toggleText = document.getElementById('toggleText');
  const toggleBtn = document.getElementById('toggleBtn');
  const errorEl = document.getElementById('authError');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');

  toggleBtn.addEventListener('click', () => {
    isSignUp = !isSignUp;
    titleEl.textContent = isSignUp ? 'Create account' : 'Sign in';
    submitBtn.textContent = isSignUp ? 'Create account' : 'Sign in';
    toggleText.textContent = isSignUp ? 'Already have an account?' : "Don't have an account?";
    toggleBtn.textContent = isSignUp ? 'Sign in' : 'Sign up';
    passwordInput.autocomplete = isSignUp ? 'new-password' : 'current-password';
    errorEl.hidden = true;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = isSignUp ? 'Creating account…' : 'Signing in…';

    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      const result = isSignUp
        ? await sb.auth.signUp({ email, password })
        : await sb.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;

      if (isSignUp && result.data?.user && !result.data.session) {
        showMsg('Check your email for a confirmation link, then sign in.', true);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create account';
        return;
      }

      if (ds.pullFromCloud) await ds.pullFromCloud();
      location.href = 'index.html';
    } catch (err) {
      showMsg(err.message || 'Something went wrong', false);
      submitBtn.disabled = false;
      submitBtn.textContent = isSignUp ? 'Create account' : 'Sign in';
    }
  });

  function showMsg(msg, isInfo) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    if (isInfo) {
      errorEl.style.color = '#4ade80';
      errorEl.style.background = 'rgba(74,222,128,.08)';
      errorEl.style.borderColor = 'rgba(74,222,128,.2)';
    } else {
      errorEl.style.color = '';
      errorEl.style.background = '';
      errorEl.style.borderColor = '';
    }
  }
})();
