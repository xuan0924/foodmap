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
        const collectionGroup = document.getElementById('collection-group-identity');
        if (!label) return;
        const active = getActiveCode();
        const groups = getGroups();
        const group = active ? groups[active] : null;
        const text = group ? `${group.name || '未命名小组'}（${active}）` : '未加入';
        label.textContent = text;
        if (collectionGroup) {
            collectionGroup.textContent = group ? `当前小组：${text}` : '未加入小组';
        }
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
        const createResult = document.getElementById('group-create-result');
        const joinBox = document.getElementById('group-join-box');
        const codeDisplay = document.getElementById('group-code-display');
        const nameInput = document.getElementById('group-name-input');
        const createConfirm = document.getElementById('group-create-confirm');
        const joinInput = document.getElementById('group-join-input');
        const joinConfirm = document.getElementById('group-join-confirm');
        if (
            !createBtn ||
            !joinBtn ||
            !createBox ||
            !createResult ||
            !joinBox ||
            !codeDisplay ||
            !nameInput ||
            !createConfirm ||
            !joinInput ||
            !joinConfirm
        ) return;

        refreshGroupLabel();

        createBtn.addEventListener('click', () => {
            createBox.hidden = false;
            createResult.hidden = true;
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
            const groups = getGroups();
            const code = createUniqueCode(groups);
            groups[code] = { code, name, createdAt: Date.now() };
            setGroups(groups);
            setActiveCode(code);

            codeDisplay.textContent = code;
            createResult.hidden = false;
            setStatus(`已创建小组「${name}」并切换。`);
            refreshGroupLabel();
            afterGroupChanged();
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
            const groupName = groups[code].name || '未命名小组';
            setStatus(`已加入小组「${groupName}」（${code}）。`);
            refreshGroupLabel();
            afterGroupChanged();
        });
    }

    window.GroupManager = {
        init: initGroupUI,
        getActiveGroupCode: getActiveCode
    };
})();
