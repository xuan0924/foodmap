// js/main.js
window.onload = function () {
    initApp();
};

async function initApp() {
    console.log('🚀 全国美食私藏地图 - 启动中...');
    try {
        await loadAMapScript();
        const map = initMapEngine('container');
        if (!map) {
            throw new Error('地图实例初始化失败');
        }

        await loadAMapPlugins();
        console.log('✅ 插件就绪（1.4.15，CitySearch + PlaceSearch）');

        if (typeof initSearchModule === 'function') {
            initSearchModule();
        }

        const citySearch = new AMap.CitySearch();
        citySearch.getLocalCity(function (status, result) {
            if (status === 'complete' && result && result.city) {
                console.log('📍 城市定位成功:', result.city);
                map.setCity(result.city);
                if (typeof map.setZoom === 'function') map.setZoom(11);
            } else {
                console.warn('⚠️ 城市定位未就绪，显示默认城市');
                map.setCity('武汉');
                if (typeof map.setZoom === 'function') map.setZoom(11);
            }
        });

        if (typeof initStorageModule === 'function') {
            Promise.resolve(initStorageModule()).catch(function (err) {
                console.error('❌ 收藏同步失败（不影响地图）：', err);
            });
        }
    } catch (error) {
        const code = error && error.code ? error.code : '';
        if (code === 'PLUGIN_LOAD_ERROR') {
            console.error('❌ 插件加载问题：', error);
            showMapLoadError('插件加载问题：高德插件未就绪，请刷新重试。');
            return;
        }
        if (code === 'PERMISSION_ERROR') {
            console.error('❌ 权限问题：', error);
            showMapLoadError('权限问题：请检查 Key / 安全密钥 / 域名白名单。');
            return;
        }
        console.error('❌ 地图加载失败：', error);
        showMapLoadError('地图加载失败，请检查网络与高德配置。');
    }
}

function loadAMapScript() {
    return new Promise(function (resolve, reject) {
        if (window.AMap) {
            resolve();
            return;
        }
        if (typeof AMAP_CONFIG === 'undefined' || !AMAP_CONFIG.KEY) {
            reject(new Error('缺少 AMAP_CONFIG.KEY'));
            return;
        }

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src =
            'https://webapi.amap.com/maps?v=1.4.15&key=' +
            encodeURIComponent(AMAP_CONFIG.KEY) +
            '&plugin=AMap.PlaceSearch,AMap.CitySearch';
        script.async = true;
        script.onload = function () {
            resolve();
        };
        script.onerror = function () {
            reject({ code: 'PERMISSION_ERROR', message: '高德地图脚本加载失败（可能是权限或白名单问题）' });
        };
        document.head.appendChild(script);
    });
}

function loadAMapPlugins() {
    return new Promise(function (resolve, reject) {
        if (!window.AMap || typeof window.AMap.plugin !== 'function') {
            reject({ code: 'PLUGIN_LOAD_ERROR', message: 'AMap 未加载完成' });
            return;
        }

        if (
            typeof AMap.PlaceSearch === 'function' &&
            typeof AMap.CitySearch === 'function'
        ) {
            resolve();
            return;
        }

        const plugins = ['AMap.PlaceSearch', 'AMap.CitySearch'];
        let timeoutId = window.setTimeout(function () {
            reject({ code: 'PLUGIN_LOAD_ERROR', message: '插件加载超时' });
        }, 8000);

        AMap.plugin(plugins, function () {
            window.clearTimeout(timeoutId);
            if (typeof AMap.PlaceSearch !== 'function' || typeof AMap.CitySearch !== 'function') {
                reject({ code: 'PLUGIN_LOAD_ERROR', message: '插件构造器不可用' });
                return;
            }
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
