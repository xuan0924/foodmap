// js/main.js
window.onload = async function() {
    console.log("🚀 吃货同步协议 - 启动中...");
    try {
        initThemePicker();
        await loadAMapScript();
        initMapEngine('container');
        if (window.GroupManager && typeof window.GroupManager.init === 'function') {
            window.GroupManager.init();
        }
        initSearchModule();
        initTeleportFab();
        initFixedUIInteractionGuard();
        console.log("💡 准备就绪，全国搜索餐饮 POI，收纳你的私藏。");
    } catch (error) {
        console.error("❌ 地图加载失败：", error);
        showMapLoadError("地图加载失败，请检查 Key / 安全密钥 / 域名白名单配置。");
    }
};

function loadAMapScript() {
    return new Promise((resolve, reject) => {
        if (window.AMap) {
            resolve();
            return;
        }
        // 注意：顶层 const AMAP_CONFIG 不会出现在 window 上，勿用 window.AMAP_CONFIG 判断
        if (typeof AMAP_CONFIG === 'undefined' || !AMAP_CONFIG.KEY) {
            reject(new Error("缺少 AMAP_CONFIG.KEY"));
            return;
        }

        const script = document.createElement('script');
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(AMAP_CONFIG.KEY)}&plugin=AMap.PlaceSearch,AMap.Geocoder,AMap.DistrictSearch,AMap.Geolocation`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("高德地图脚本加载失败"));
        document.head.appendChild(script);
    });
}

function initTeleportFab() {
    const fab = document.getElementById('protocol-teleport-trigger');
    const hint = document.getElementById('protocol-teleport-hint');
    if (!fab) return;

    const setPressed = (on) => fab.classList.toggle('is-pressed', on);
    fab.addEventListener('mousedown', () => setPressed(true));
    fab.addEventListener('mouseup', () => setPressed(false));
    fab.addEventListener('mouseleave', () => setPressed(false));
    fab.addEventListener('touchstart', () => setPressed(true), { passive: true });
    fab.addEventListener('touchend', () => setPressed(false));

    fab.addEventListener('click', () => {
        const item =
            window.MapEngine && typeof MapEngine.getLastFocusedNavItem === 'function'
                ? MapEngine.getLastFocusedNavItem()
                : null;
        if (!item) {
            if (hint) {
                hint.textContent = '请先在地图或收藏中点选一家餐厅';
                hint.hidden = false;
                clearTimeout(fab._hintTimer);
                fab._hintTimer = setTimeout(() => {
                    hint.hidden = true;
                }, 2600);
            }
            return;
        }
        if (MapEngine.beginTeleport) {
            MapEngine.beginTeleport(item);
        }
    });
}

function initFixedUIInteractionGuard() {
    const uiSelectors = [
        '.gem-topbar',
        '#side-panel',
        '#drawer-scrim',
        '#search-float',
        '#protocol-teleport-trigger',
        '#protocol-teleport-hint',
        '#protocol-nav-sheet',
        '#protocol-nav-scrim'
    ];
    const isInFixedUI = (target) => {
        if (!target || !target.closest) return false;
        return uiSelectors.some((sel) => target.closest(sel));
    };
    ['touchstart', 'pointerdown', 'mousedown', 'click'].forEach((eventName) => {
        document.addEventListener(
            eventName,
            (e) => {
                if (isInFixedUI(e.target)) {
                    e.stopPropagation();
                }
            },
            true
        );
    });
}

function showMapLoadError(message) {
    const banner = document.createElement('div');
    banner.className = 'map-load-error';
    banner.textContent = message;
    document.body.appendChild(banner);
}

function initThemePicker() {
    const THEME_BG_KEY = 'food_theme_bg_v1';
    const THEME_PRIMARY_KEY = 'food_theme_primary_v1';
    const THEME_BORDER_KEY = 'food_theme_border_v1';
    const root = document.documentElement;
    const toggleBtn = document.getElementById('theme-picker-toggle');
    const panel = document.getElementById('theme-picker-panel');
    if (!toggleBtn || !panel) return;

    const swatches = Array.from(panel.querySelectorAll('.theme-swatch'));
    const borderByBg = {
        '#FDF6EC': '#9AB8E6',
        '#F3F8EE': '#8FCF8A',
        '#F4F1FB': '#B59DE5',
        '#FFF2E8': '#F1AA6B',
        '#ECF7F7': '#7FCBD3'
    };

    function hexToRgb(hex) {
        const h = String(hex || '').trim().replace('#', '');
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16)
        };
    }

    function toRgba(hex, alpha) {
        const rgb = hexToRgb(hex);
        if (!rgb) return '';
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }

    function applyTheme(bg, primary, border) {
        if (bg) {
            root.style.setProperty('--app-bg-color', bg);
            root.style.setProperty('--protocol-bg', bg);
        }
        if (primary) {
            root.style.setProperty('--theme-primary', primary);
            root.style.setProperty('--protocol-accent', primary);
            root.style.setProperty('--primary-color', primary);
            root.style.setProperty('--theme-strong', toRgba(primary, 1) || primary);
            root.style.setProperty('--gem-hover-primary', toRgba(primary, 0.14));
            root.style.setProperty('--theme-soft-bg', toRgba(primary, 0.12));
            root.style.setProperty('--theme-soft-bg-strong', toRgba(primary, 0.2));
            root.style.setProperty('--theme-on-soft', toRgba(primary, 0.88));
            root.style.setProperty('--gem-surface', toRgba(primary, 0.05));
            root.style.setProperty('--gem-hover', toRgba(primary, 0.1));
            root.style.setProperty('--gem-surface-dim', toRgba(primary, 0.09));
        }
        root.style.setProperty('--protocol-text', '#202124');
        if (border) {
            root.style.setProperty('--theme-border', border);
            root.style.setProperty('--gem-border', border);
        }
    }

    function markActive(bg) {
        swatches.forEach((btn) => {
            btn.classList.toggle('active', String(btn.dataset.themeBg || '').toUpperCase() === String(bg || '').toUpperCase());
        });
    }

    const savedBg = localStorage.getItem(THEME_BG_KEY);
    const savedPrimary = localStorage.getItem(THEME_PRIMARY_KEY);
    const savedBorder = localStorage.getItem(THEME_BORDER_KEY);
    if (savedBg) {
        const fallbackBorder = borderByBg[String(savedBg || '').toUpperCase()] || '#9AB8E6';
        applyTheme(savedBg, savedPrimary || '#1A73E8', savedBorder || fallbackBorder);
        markActive(savedBg);
    } else {
        applyTheme('#FDF6EC', '#1A73E8', '#9AB8E6');
        markActive('#FDF6EC');
    }

    function setPanelOpen(open) {
        panel.hidden = !open;
        toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setPanelOpen(panel.hidden);
    });

    swatches.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bg = btn.dataset.themeBg || '#FDF6EC';
            const primary = btn.dataset.themePrimary || '#1A73E8';
            const border = btn.dataset.themeBorder || '#9AB8E6';
            applyTheme(bg, primary, border);
            markActive(bg);
            localStorage.setItem(THEME_BG_KEY, bg);
            localStorage.setItem(THEME_PRIMARY_KEY, primary);
            localStorage.setItem(THEME_BORDER_KEY, border);
            setPanelOpen(false);
        });
    });

    document.addEventListener('click', (e) => {
        if (!panel.hidden && !panel.contains(e.target) && e.target !== toggleBtn) {
            setPanelOpen(false);
        }
    });
}
