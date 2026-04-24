// js/group.js — 小组创建/加入（邀请码 9 小时轮换）
(function () {
    const GROUPS_KEY = 'food_groups_v1';
    const ACTIVE_KEY = 'food_active_group_v1';
    const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const CODE_REFRESH_MS = 9 * 60 * 60 * 1000;
    let uiInitialized = false;

    function randomCode() {
        let out = '';
        for (let i = 0; i < 6; i += 1) out += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
        return out;
    }

    function normalizeCode(raw) {
        return String(raw || '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 6);
    }

    function loadState() {
        const raw = localStorage.getItem(GROUPS_KEY);
        let parsed = [];
        if (raw) {
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                parsed = [];
            }
        }

        // 兼容旧结构：{ CODE: { name... } }
        if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
            const converted = Object.entries(parsed).map(([code, val]) => ({
                id: `g_${code}`,
                name: (val && val.name) || '未命名小组',
                inviteCode: code,
                inviteUpdatedAt: (val && val.createdAt) || Date.now(),
                createdAt: (val && val.createdAt) || Date.now()
            }));
            parsed = converted;
            localStorage.setItem(GROUPS_KEY, JSON.stringify(parsed));
        }

        if (!Array.isArray(parsed)) parsed = [];
        return parsed;
    }

    function saveState(groups) {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    }

    function getActiveGroupId() {
        return localStorage.getItem(ACTIVE_KEY) || '';
    }

    function setActiveGroupId(id) {
        localStorage.setItem(ACTIVE_KEY, id);
    }

    function switchActiveGroup(id) {
        const targetId = String(id || '').trim();
        if (!targetId) return false;
        const groups = loadState();
        const exists = groups.some((g) => g.id === targetId);
        if (!exists) return false;
        setActiveGroupId(targetId);
        return true;
    }

    function createUniqueInviteCode(groups) {
        const exists = new Set(groups.map((g) => g.inviteCode));
        for (let i = 0; i < 30; i += 1) {
            const candidate = randomCode();
            if (!exists.has(candidate)) return candidate;
        }
        return randomCode();
    }

    function refreshInviteCodeIfExpired(group, groups) {
        const now = Date.now();
        const updatedAt = Number(group.inviteUpdatedAt || 0);
        if (!group.inviteCode || now - updatedAt >= CODE_REFRESH_MS) {
            group.inviteCode = createUniqueInviteCode(groups.filter((g) => g.id !== group.id));
            group.inviteUpdatedAt = now;
            return true;
        }
        return false;
    }

    function getActiveGroup(groups) {
        const activeId = getActiveGroupId();
        if (!activeId) return null;
        return groups.find((g) => g.id === activeId) || null;
    }

    function setStatus(msg, isError) {
        const el = document.getElementById('group-status');
        if (!el) return;
        if (!msg) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.hidden = false;
        el.textContent = msg;
        el.style.color = isError ? '#c5221f' : '#5f6368';
    }

    function refreshGroupLabel() {
        // 预留：当前版本不显示侧栏小组状态行
    }

    function afterGroupChanged() {
        if (typeof refreshCollectionUI === 'function') refreshCollectionUI();
    }

    function initGroupUI() {
        if (uiInitialized) return;
        const settingsPanel = document.getElementById('group-settings-panel');
        const createBtn = document.getElementById('group-create-btn');
        const joinBtn = document.getElementById('group-join-btn');
        const createBox = document.getElementById('group-create-box');
        const joinBox = document.getElementById('group-join-box');
        const nameInput = document.getElementById('group-name-input');
        const createConfirm = document.getElementById('group-create-confirm');
        const joinInput = document.getElementById('group-join-input');
        const joinConfirm = document.getElementById('group-join-confirm');
        if (!createBtn || !joinBtn || !createBox || !joinBox || !nameInput || !createConfirm || !joinInput || !joinConfirm) return;
        uiInitialized = true;

        function setSettingsOpen(open) {
            if (!settingsPanel) return;
            settingsPanel.hidden = !open;
            const btn = document.getElementById('group-settings-toggle');
            if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        document.addEventListener('click', (e) => {
            const targetEl =
                e && e.target && e.target.nodeType === 3
                    ? e.target.parentElement
                    : e && e.target
                        ? e.target
                        : null;
            const btn = targetEl && typeof targetEl.closest === 'function'
                ? targetEl.closest('#group-settings-toggle')
                : null;
            if (btn) {
                const nextOpen = settingsPanel ? settingsPanel.hidden : true;
                setSettingsOpen(nextOpen);
                return;
            }
            if (settingsPanel && !settingsPanel.hidden) {
                const insidePanel = settingsPanel.contains(e.target);
                if (!insidePanel) setSettingsOpen(false);
            }
        });

        refreshGroupLabel();

        createBtn.addEventListener('click', () => {
            createBox.hidden = false;
            joinBox.hidden = true;
            nameInput.value = '';
            setStatus('');
            nameInput.focus();
        });

        joinBtn.addEventListener('click', () => {
            createBox.hidden = true;
            joinBox.hidden = false;
            setStatus('');
            joinInput.focus();
        });

        createConfirm.addEventListener('click', () => {
            const name = String(nameInput.value || '').trim();
            if (!name) {
                setStatus('请先输入小组名称。', true);
                return;
            }
            const groups = loadState();
            const group = {
                id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name,
                inviteCode: createUniqueInviteCode(groups),
                inviteUpdatedAt: Date.now(),
                createdAt: Date.now()
            };
            groups.push(group);
            saveState(groups);
            setActiveGroupId(group.id);

            createBox.hidden = true; // 创建后立即消失
            setStatus(`已创建小组「${name}」。`);
            refreshGroupLabel();
            afterGroupChanged();
        });

        joinInput.addEventListener('input', () => {
            joinInput.value = normalizeCode(joinInput.value);
        });

        joinConfirm.addEventListener('click', () => {
            const code = normalizeCode(joinInput.value);
            if (code.length !== 6) {
                setStatus('请输入 6 位数字字母密钥。', true);
                return;
            }
            const groups = loadState();
            groups.forEach((g) => refreshInviteCodeIfExpired(g, groups));
            const target = groups.find((g) => g.inviteCode === code);
            if (!target) {
                saveState(groups);
                setStatus('未找到该小组，请检查密钥是否正确或已过期。', true);
                return;
            }
            saveState(groups);
            setActiveGroupId(target.id);
            joinBox.hidden = true;
            setStatus(`已加入小组「${target.name}」。`);
            refreshGroupLabel();
            afterGroupChanged();
        });
    }

    window.GroupManager = {
        init: initGroupUI,
        getActiveGroupId,
        setActiveGroupId: switchActiveGroup,
        getJoinedGroups: function () {
            const groups = loadState();
            groups.forEach((g) => refreshInviteCodeIfExpired(g, groups));
            saveState(groups);
            return groups.slice().sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
        },
        getActiveGroupCode: function () {
            const groups = loadState();
            const active = getActiveGroup(groups);
            if (!active) return '';
            if (refreshInviteCodeIfExpired(active, groups)) saveState(groups);
            return active.inviteCode;
        }
    };
})();
