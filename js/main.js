// js/main.js — 极简稳健：无动态加载脚本、无 AMap.Geolocation；插件由 index.html URL 预载

let map;

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
    function ensurePluginsThen(run) {
        if (typeof AMap.PlaceSearch === 'function' && typeof AMap.CitySearch === 'function') {
            run();
            return;
        }
        if (typeof AMap !== 'undefined' && typeof AMap.plugin === 'function') {
            AMap.plugin(['AMap.PlaceSearch', 'AMap.CitySearch'], function () {
                run();
            });
            return;
        }
        console.error('❌ 高德插件不可用');
    }

    ensurePluginsThen(function () {
        if (typeof initSearchModule === 'function') {
            initSearchModule();
        }

        const citySearch = new AMap.CitySearch();
        citySearch.getLocalCity(function (status, result) {
            if (status === 'complete' && result && result.info === 'OK' && result.city) {
                console.log('📍 自动定位到：', result.city);
                map.setCity(result.city);
            } else {
                console.log('⚠️ 定位超时，停留在武汉');
                map.setCity('武汉');
                if (typeof map.setZoom === 'function') {
                    map.setZoom(11);
                }
            }

            if (typeof loadCloudData === 'function') {
                loadCloudData();
            }
        });
    });
}

function loadCloudData() {
    if (typeof initStorageModule === 'function') {
        Promise.resolve(initStorageModule()).catch(function (err) {
            console.error('❌ 收藏加载失败：', err);
        });
    }
}
