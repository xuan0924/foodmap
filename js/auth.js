// js/auth.js — Supabase Auth UI

function setAuthStatus(text, isError) {
    const el = document.getElementById('auth-status');
    if (!el) return;
    if (!text) {
        el.hidden = true;
        el.textContent = '';
        return;
    }
    el.hidden = false;
    el.textContent = text;
    el.style.color = isError ? '#c5221f' : '';
}

function updateAuthUI(user) {
    const chip = document.getElementById('auth-user-chip');
    const emailEl = document.getElementById('auth-user-email');
    const loginTip = document.getElementById('login-empty-tip');
    const collectionList = document.getElementById('collection-list');
    const ocrPanel = document.querySelector('.ocr-panel');
    const authPanel = document.getElementById('auth-panel');

    const isLogin = !!(user && user.email);
    if (chip) chip.hidden = !isLogin;
    if (emailEl) emailEl.textContent = isLogin ? user.email : '';
    if (loginTip) loginTip.hidden = isLogin;
    if (collectionList) collectionList.hidden = !isLogin;
    if (ocrPanel) ocrPanel.hidden = !isLogin;
    if (authPanel) authPanel.classList.toggle('auth-panel--compact', isLogin);

    if (!isLogin && typeof hideAllMarkers === 'function') {
        hideAllMarkers();
    }
}

function initAuthModule() {
    const emailInput = document.getElementById('auth-email');
    const pwdInput = document.getElementById('auth-password');
    const loginBtn = document.getElementById('auth-login-btn');
    const signupBtn = document.getElementById('auth-signup-btn');
    const magicBtn = document.getElementById('auth-magic-btn');
    const logoutBtn = document.getElementById('auth-logout-btn');

    function getCredentials() {
        const email = emailInput ? emailInput.value.trim() : '';
        const password = pwdInput ? pwdInput.value : '';
        return { email, password };
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', async function () {
            const { email, password } = getCredentials();
            if (!email || !password) {
                setAuthStatus('请输入邮箱和密码。', true);
                return;
            }
            try {
                await loginWithPassword(email, password);
                setAuthStatus('登录成功。');
            } catch (error) {
                setAuthStatus(`登录失败：${error.message || error}`, true);
            }
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', async function () {
            const { email, password } = getCredentials();
            if (!email || !password) {
                setAuthStatus('注册需要邮箱和密码。', true);
                return;
            }
            try {
                await signUpWithPassword(email, password);
                setAuthStatus('注册成功，请检查邮箱确认链接。');
            } catch (error) {
                setAuthStatus(`注册失败：${error.message || error}`, true);
            }
        });
    }

    if (magicBtn) {
        magicBtn.addEventListener('click', async function () {
            const { email } = getCredentials();
            if (!email) {
                setAuthStatus('请先输入邮箱。', true);
                return;
            }
            try {
                await loginWithMagicLink(email);
                setAuthStatus('魔术链接已发送，请前往邮箱点击登录。');
            } catch (error) {
                setAuthStatus(`发送失败：${error.message || error}`, true);
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {
            try {
                await logoutAuthUser();
                setAuthStatus('已退出登录。');
            } catch (error) {
                setAuthStatus(`退出失败：${error.message || error}`, true);
            }
        });
    }

    if (typeof registerAuthStateListener === 'function') {
        registerAuthStateListener(function (user) {
            updateAuthUI(user);
        });
    }
    if (typeof getCurrentAuthUser === 'function') {
        updateAuthUI(getCurrentAuthUser());
    }
}
