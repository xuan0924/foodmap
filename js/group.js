// js/group.js — 本地小组创建/加入（6位数字字母代号）
(function () {
    const GROUPS_KEY = 'food_groups_v1';
    const ACTIVE_KEY = 'food_active_group_v1';
    const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    function getGroups() {
        const raw = localStorage.getItem(GROUPS_KEY);
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function setGroups(groups) {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    }

    function getActiveCode() {
        return localStorage.getItem(ACTIVE_KEY) || '';
    }

    function setActiveCode(code) {
        localStorage.setItem(ACTIVE_KEY, code);
    }

    function randomCode() {
        let out = '';
        for (let i = 0; i < 6; i += 1) {
            out += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
        }
        return out;
    }

    function createUniqueCode(groups) {
        for (let i = 0; i < 20; i += 1) {
            const code = randomCode();
            if (!groups[code]) return code;
        }
        return randomCode();
    }

    function normalizeCode(raw) {
        return String(raw || '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 6);
    }

    function refreshGroupLabel() {
        const label = document.getElementById('group-current-label');
        if (!label) return;
        const active = getActiveCode();
        label.textContent = active || '未加入';
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

    function afterGroupChanged() {
        if (typeof refreshCollectionUI === 'function') {
            refreshCollectionUI();
        }
    }

    function initGroupUI() {
        const createBtn = document.getElementById('group-create-btn');
        const joinBtn = document.getElementById('group-join-btn');
        const createBox = document.getElementById('group-create-box');
        const joinBox = document.getElementById('group-join-box');
        const codeDisplay = document.getElementById('group-code-display');
        const joinInput = document.getElementById('group-join-input');
        const joinConfirm = document.getElementById('group-join-confirm');
        if (!createBtn || !joinBtn || !createBox || !joinBox || !codeDisplay || !joinInput || !joinConfirm) return;

        refreshGroupLabel();

        createBtn.addEventListener('click', () => {
            const groups = getGroups();
            const code = createUniqueCode(groups);
            groups[code] = { code, createdAt: Date.now() };
            setGroups(groups);
            setActiveCode(code);

            codeDisplay.textContent = code;
            createBox.hidden = false;
            joinBox.hidden = true;
            setStatus('已创建并切换到新小组。');
            refreshGroupLabel();
            afterGroupChanged();
        });

        joinBtn.addEventListener('click', () => {
            createBox.hidden = true;
            joinBox.hidden = false;
            setStatus('');
            joinInput.focus();
        });

        joinInput.addEventListener('input', () => {
            joinInput.value = normalizeCode(joinInput.value);
        });

        joinConfirm.addEventListener('click', () => {
            const code = normalizeCode(joinInput.value);
            if (code.length !== 6) {
                setStatus('请输入 6 位数字字母代号。', true);
                return;
            }
            const groups = getGroups();
            if (!groups[code]) {
                setStatus('未找到该小组，请检查代号是否正确。', true);
                return;
            }
            setActiveCode(code);
            setStatus(`已加入小组 ${code}。`);
            refreshGroupLabel();
            afterGroupChanged();
        });
    }

    window.GroupManager = {
        init: initGroupUI,
        getActiveGroupCode: getActiveCode
    };
})();
