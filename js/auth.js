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

function isEmailIdentifier(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function encodeUsernameToEmail(username) {
    const raw = String(username || '').trim();
    if (!raw) return '';
    const utf8 = encodeURIComponent(raw).replace(/%/g, '');
    return `u_${utf8.toLowerCase()}@users.food.local`;
}

function normalizeAuthIdentifier(inputValue) {
    const raw = String(inputValue || '').trim();
    if (!raw) return { email: '', username: '', isEmail: false };
    if (isEmailIdentifier(raw)) {
        return { email: raw.toLowerCase(), username: '', isEmail: true };
    }
    return { email: encodeUsernameToEmail(raw), username: raw, isEmail: false };
}

function updateAuthUI(user) {
    const chip = document.getElementById('auth-user-chip');
    const emailEl = document.getElementById('auth-user-email');
    const loginTip = document.getElementById('login-empty-tip');
    const collectionList = document.getElementById('collection-list');
    const ocrPanel = document.querySelector('.ocr-panel');
    const authPanel = document.getElementById('auth-panel');

    const isLogin = !!(user && user.email);
    const nickname =
        (user && user.user_metadata && user.user_metadata.username) ||
        (user && user.email) ||
        '';
    if (chip) chip.hidden = !isLogin;
    if (emailEl) emailEl.textContent = isLogin ? nickname : '';
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
    let signupFailCount = 0;
    let signupCooldownTimer = null;

    function clearSignupCooldownTimer() {
        if (signupCooldownTimer) {
            window.clearInterval(signupCooldownTimer);
            signupCooldownTimer = null;
        }
    }

    function setSignupButtonIdle() {
        if (!signupBtn) return;
        signupBtn.disabled = false;
        signupBtn.textContent = '注册';
    }

    function startSignupCooldown(seconds) {
        if (!signupBtn) return;
        clearSignupCooldownTimer();
        let left = Number(seconds) || 60;
        signupBtn.disabled = true;
        signupBtn.textContent = `注册(${left}s)`;
        signupCooldownTimer = window.setInterval(function () {
            left -= 1;
            if (left <= 0) {
                clearSignupCooldownTimer();
                setSignupButtonIdle();
                return;
            }
            signupBtn.textContent = `注册(${left}s)`;
        }, 1000);
    }

    function getCredentials() {
        const identifier = emailInput ? emailInput.value.trim() : '';
        const password = pwdInput ? pwdInput.value : '';
        return { identifier, password };
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', async function () {
            const { identifier, password } = getCredentials();
            if (!identifier || !password) {
                setAuthStatus('请输入账号（邮箱或用户名）和密码。', true);
                return;
            }
            try {
                const normalized = normalizeAuthIdentifier(identifier);
                await loginWithPassword(normalized.email, password);
                setAuthStatus('登录成功。');
            } catch (error) {
                setAuthStatus(`登录失败：${error.message || error}`, true);
            }
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', async function () {
            if (signupBtn.disabled) return;
            const { identifier, password } = getCredentials();
            if (!identifier || !password) {
                setAuthStatus('注册需要账号（邮箱或用户名）和密码。', true);
                return;
            }
            try {
                const normalized = normalizeAuthIdentifier(identifier);
                const options = normalized.username
                    ? { data: { username: normalized.username } }
                    : undefined;
                await signUpWithPassword(normalized.email, password, options);
                if (normalized.isEmail) {
                    setAuthStatus('注册成功，请检查邮箱确认链接。');
                } else {
                    setAuthStatus(`用户名注册成功：${normalized.username}，可直接用该用户名登录。`);
                }
                signupFailCount = 0;
                clearSignupCooldownTimer();
                setSignupButtonIdle();
            } catch (error) {
                signupFailCount += 1;
                setAuthStatus(`注册失败：${error.message || error}`, true);
                if (signupFailCount >= 3) {
                    signupFailCount = 0;
                    startSignupCooldown(60);
                }
            }
        });
    }

    if (magicBtn) {
        magicBtn.addEventListener('click', async function () {
            const { identifier } = getCredentials();
            if (!identifier) {
                setAuthStatus('请先输入邮箱。', true);
                return;
            }
            if (!isEmailIdentifier(identifier)) {
                setAuthStatus('魔术链接仅支持邮箱，不支持用户名。', true);
                return;
            }
            try {
                await loginWithMagicLink(identifier.trim().toLowerCase());
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
