// js/main.js
window.onload = async function() {
    console.log("🚀 全国美食私藏地图 - 启动中...");
    try {
        await loadAMapScript();
        initMapEngine('container');
        if (typeof initStorageModule === 'function') {
            await initStorageModule();
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
        // 不在 URL 中预加载 plugin，统一改为 AMap.plugin(...) 动态加载，避免 2.0 插件冲突
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(AMAP_CONFIG.KEY)}`;
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
