// js/main.js
window.onload = function () {
    initApp();
};

async function initApp() {
    console.log("🚀 全国美食私藏地图 - 启动中...");
    try {
        await loadAMapScript();
        const map = initMapEngine('container');
        if (!map || typeof map.on !== 'function') {
            throw new Error('地图实例初始化失败');
        }

        map.on('complete', async function () {
            try {
                await loadAMapPlugins();
                if (typeof initLocationModule === 'function') {
                    initLocationModule();
                }
                if (typeof initStorageModule === 'function') {
                    await initStorageModule();
                }
                if (typeof initSearchModule === 'function') {
                    initSearchModule();
                }
                console.log('✅ 高德插件全量安全加载完毕');
                console.log("💡 准备就绪，全国搜索餐饮 POI，收纳你的私藏。");
            } catch (e) {
                console.error('❌ 插件初始化致命错误:', e);
                showMapLoadError("插件加载问题：高德插件未就绪，请刷新重试。");
            }
        });
    } catch (error) {
        const code = error && error.code ? error.code : '';
        if (code === 'PLUGIN_LOAD_ERROR') {
            console.error("❌ 插件加载问题：", error);
            showMapLoadError("插件加载问题：高德插件未就绪，请刷新重试。");
            return;
        }
        if (code === 'PERMISSION_ERROR') {
            console.error("❌ 权限问题：", error);
            showMapLoadError("权限问题：请检查 Key / 安全密钥 / 域名白名单。");
            return;
        }
        console.error("❌ 地图加载失败：", error);
        showMapLoadError("地图加载失败，请检查网络与高德配置。");
    }
}

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
        script.onerror = () => reject({ code: 'PERMISSION_ERROR', message: "高德地图脚本加载失败（可能是权限或白名单问题）" });
        document.head.appendChild(script);
    });
}

function loadAMapPlugins() {
    return new Promise((resolve, reject) => {
        if (!window.AMap || typeof window.AMap.plugin !== 'function') {
            reject({ code: 'PLUGIN_LOAD_ERROR', message: 'AMap 未加载完成' });
            return;
        }
        const plugins = [
            'AMap.PlaceSearch',
            'AMap.CitySearch',
            'AMap.Geocoder',
            'AMap.DistrictSearch'
        ];
        let timeoutId = window.setTimeout(() => {
            reject({ code: 'PLUGIN_LOAD_ERROR', message: '插件加载超时' });
        }, 8000);

        AMap.plugin(plugins, function () {
            window.clearTimeout(timeoutId);
            if (
                typeof AMap.PlaceSearch !== 'function' ||
                typeof AMap.CitySearch !== 'function'
            ) {
                reject({ code: 'PLUGIN_LOAD_ERROR', message: '插件构造器不可用' });
                return;
            }
            console.log('✅ 所有插件加载完毕，开始初始化模块...');
            resolve();
        });
    });
}

function showMapLoadError(message) {
    const banner = document.createElement('div');
    banner.className = 'map-load-error';
    banner.textContent = message;
    document.body.appendChild(banner);
}
