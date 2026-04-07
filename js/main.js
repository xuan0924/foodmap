// js/main.js — 插件经 AMap.plugin 加载；移图不用 setCity，统一走 MapEngine.moveMapToCityName（Geocoder）

let map;

function fallbackCityWuhan() {
    applyDefaultCityFromConfig();
}

/** 不用 IP、不用 setCity，按 config 默认城市做地理编码移图 */
function applyDefaultCityFromConfig() {
    try {
        var name =
            typeof AMAP_CONFIG !== 'undefined' && AMAP_CONFIG.DEFAULT_SEARCH_CITY
                ? String(AMAP_CONFIG.DEFAULT_SEARCH_CITY).trim()
                : '武汉';
        if (typeof MapEngine !== 'undefined' && typeof MapEngine.moveMapToCityName === 'function') {
            MapEngine.moveMapToCityName(name || '武汉', 11);
        }
    } catch (e) {
        /* 静默 */
    }
}

window.onload = function () {
    var center =
        typeof AMAP_CONFIG !== 'undefined' && AMAP_CONFIG.DEFAULT_MAP_CENTER
            ? AMAP_CONFIG.DEFAULT_MAP_CENTER
            : [114.3, 30.6];
    map = new AMap.Map('container', {
        zoom: 11,
        center: center,
        viewMode: '2D'
    });

    if (typeof MapEngine !== 'undefined' && typeof MapEngine.bindMapInstance === 'function') {
        MapEngine.bindMapInstance(map);
    }

    map.on('complete', function () {
        console.log('✅ 地图底盘已就绪');
        startServices();
    });
};

function startServices() {
    if (!window.AMap || typeof AMap.plugin !== 'function') {
        fallbackCityWuhan();
        loadCloudData();
        return;
    }

    AMap.plugin(['AMap.PlaceSearch', 'AMap.CitySearch'], function () {
        try {
            if (typeof AMap.PlaceSearch !== 'function' || typeof AMap.CitySearch !== 'function') {
                fallbackCityWuhan();
                loadCloudData();
                return;
            }

            if (typeof initSearchModule === 'function') {
                try {
                    initSearchModule();
                } catch (e) {
                    console.warn('initSearchModule 异常：', e);
                }
            }

            var useIpCity = typeof AMAP_CONFIG !== 'undefined' && AMAP_CONFIG.AUTO_IP_CITY === true;
            if (!useIpCity) {
                console.log('ℹ️ 已关闭自动 IP 城市（AUTO_IP_CITY=false），使用默认城市：', AMAP_CONFIG && AMAP_CONFIG.DEFAULT_SEARCH_CITY);
                applyDefaultCityFromConfig();
                loadCloudData();
                return;
            }

            var citySearch;
            try {
                citySearch = new AMap.CitySearch();
            } catch (e) {
                console.warn('CitySearch 构造失败：', e);
                fallbackCityWuhan();
                loadCloudData();
                return;
            }

            try {
                citySearch.getLocalCity(function (status, result) {
                    try {
                        var cityName = '';
                        if (status === 'complete' && result && result.city != null) {
                            var c = result.city;
                            if (typeof c === 'string') {
                                cityName = c.trim();
                            } else if (Array.isArray(c) && c.length) {
                                cityName = String(c[0]).trim();
                            } else if (typeof c === 'object' && (c.name || c.city)) {
                                cityName = String(c.name || c.city).trim();
                            }
                        }
                        if (cityName) {
                            console.log('📍 IP 城市定位：', cityName, result && result.info ? '(' + result.info + ')' : '');
                            if (typeof MapEngine !== 'undefined' && typeof MapEngine.moveMapToCityName === 'function') {
                                MapEngine.moveMapToCityName(cityName, 11);
                            }
                        } else {
                            console.warn('⚠️ getLocalCity 无有效城市，使用配置默认城市。status=', status, 'result=', result);
                            applyDefaultCityFromConfig();
                        }
                    } catch (e) {
                        console.warn('CitySearch 回调异常：', e);
                        applyDefaultCityFromConfig();
                    }
                    loadCloudData();
                });
            } catch (e) {
                console.warn('getLocalCity 调用异常：', e);
                fallbackCityWuhan();
                loadCloudData();
            }
        } catch (e) {
            console.warn('startServices 异常：', e);
            fallbackCityWuhan();
            loadCloudData();
        }
    });
}

function loadCloudData() {
    if (typeof initStorageModule === 'function') {
        Promise.resolve(initStorageModule()).catch(function (err) {
            console.error('❌ 收藏加载失败：', err);
        });
    }
}
