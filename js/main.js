// js/main.js
window.onload = async function() {
    console.log("🚀 全国美食私藏地图 - 启动中...");
    try {
        initThemePicker();
        await loadAMapScript();
        initMapEngine('container');
        if (window.GroupManager && typeof window.GroupManager.init === 'function') {
            window.GroupManager.init();
        }
        initSearchModule();
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
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(AMAP_CONFIG.KEY)}&plugin=AMap.PlaceSearch,AMap.Geocoder,AMap.DistrictSearch`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("高德地图脚本加载失败"));
        document.head.appendChild(script);
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
    const root = document.documentElement;
    const toggleBtn = document.getElementById('theme-picker-toggle');
    const panel = document.getElementById('theme-picker-panel');
    if (!toggleBtn || !panel) return;

    const swatches = Array.from(panel.querySelectorAll('.theme-swatch'));

    function applyTheme(bg, primary) {
        if (bg) root.style.setProperty('--app-bg-color', bg);
        if (primary) {
            root.style.setProperty('--theme-primary', primary);
            root.style.setProperty('--primary-color', primary);
        }
    }

    function markActive(bg) {
        swatches.forEach((btn) => {
            btn.classList.toggle('active', String(btn.dataset.themeBg || '').toUpperCase() === String(bg || '').toUpperCase());
        });
    }

    const savedBg = localStorage.getItem(THEME_BG_KEY);
    const savedPrimary = localStorage.getItem(THEME_PRIMARY_KEY);
    if (savedBg) {
        applyTheme(savedBg, savedPrimary || '#1A73E8');
        markActive(savedBg);
    } else {
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
            applyTheme(bg, primary);
            markActive(bg);
            localStorage.setItem(THEME_BG_KEY, bg);
            localStorage.setItem(THEME_PRIMARY_KEY, primary);
            setPanelOpen(false);
        });
    });

    document.addEventListener('click', (e) => {
        if (!panel.hidden && !panel.contains(e.target) && e.target !== toggleBtn) {
            setPanelOpen(false);
        }
    });
}
