// js/main.js — 插件一律经 AMap.plugin 异步就绪后再用；与 map-engine 共用 map 实例

let map;

/** 与 map-engine.mapSetCitySafe 同理：setCity 必须带第二参数完成回调，否则 2.0 内部可能报 h is not a function */
function mapSetCityWithDone(m, cityName) {
    if (!m || typeof m.setCity !== 'function') return;
    if (cityName == null || cityName === '') return;
    try {
        m.setCity(cityName, function () {});
    } catch (e) {
        console.warn('setCity 失败:', e);
    }
}

function fallbackCityWuhan() {
    try {
        mapSetCityWithDone(map, '武汉');
        if (map && typeof map.setZoom === 'function') {
            map.setZoom(11);
        }
    } catch (e) {
        /* 静默 */
    }
}

window.onload = function () {
    map = new AMap.Map('container', {
        zoom: 11,
        center: [114.3, 30.6],
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
                        if (status === 'complete' && result && result.info === 'OK' && result.city) {
                            console.log('📍 自动定位到：', result.city);
                            mapSetCityWithDone(map, result.city);
                        } else {
                            fallbackCityWuhan();
                        }
                    } catch (e) {
                        console.warn('CitySearch 回调异常：', e);
                        fallbackCityWuhan();
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
