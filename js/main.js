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
                console.log('✅ 插件加载完毕，绕过精准定位');

                // 1) 初始化搜索（PlaceSearch 已就绪）
                if (typeof initSearchModule === 'function') {
                    initSearchModule();
                }

                // 2) 稳健 IP 城市定位（仅 CitySearch）
                const citySearch = new AMap.CitySearch();
                citySearch.getLocalCity(function (status, result) {
                    if (status === 'complete' && result && result.info === 'OK' && result.city) {
                        console.log('📍 城市定位成功:', result.city);
                        map.setCity(result.city);
                        if (typeof map.setZoom === 'function') map.setZoom(11);
                    } else {
                        console.warn('⚠️ 城市定位超时，显示默认城市');
                        map.setCity('武汉');
                        if (typeof map.setZoom === 'function') map.setZoom(11);
                    }
                });

                // 3) 后台拉取收藏，不阻塞地图显示
                if (typeof initStorageModule === 'function') {
                    initStorageModule().catch((err) => {
                        console.error('❌ Supabase 后台加载失败：', err);
                    });
                }
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
        const plugins = ['AMap.PlaceSearch', 'AMap.CitySearch'];
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
