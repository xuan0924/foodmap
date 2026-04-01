// js/map-engine.js
// 这是一个“单例”模式的思想，我们定义一个全局变量来持有地图实例
let mapInstance = null;
const markerRegistry = new Map();
const markerDataRegistry = new Map();
const visibleMarkerIds = new Set();
let activeMarkerId = null;

/**
 * 初始化地图引擎
 * @param {string} containerId - HTML 中容器的 ID
 */
function initMapEngine(containerId) {
    if (!AMAP_CONFIG) {
        console.error("❌ 错误：未找到 AMAP_CONFIG 配置！请检查 config.js 是否正确加载。");
        return;
    }

    // 初始化地图实例
    mapInstance = new AMap.Map(containerId, {
        zoom: AMAP_CONFIG.DEFAULT_ZOOM != null ? AMAP_CONFIG.DEFAULT_ZOOM : 13,
        center: AMAP_CONFIG.CENTER,
        viewMode: '2D',
        pitchEnable: false,
        rotationEnable: false,
        mapStyle: 'amap://styles/whitesmoke' // 极简配色，突出美食
    });

    console.log("✅ 地图引擎初始化成功，中心点：", AMAP_CONFIG.CENTER);
    return mapInstance;
}

function getMapInstance() {
    return mapInstance;
}

/**
 * 在地图上渲染一个美食标记
 * @param {Object} item - 包含 name, lng, lat 的对象
 */
function renderFoodMarker(item) {
    if (!mapInstance) return;

    const markerId = getMarkerId(item);
    const existingMarker = markerRegistry.get(markerId);
    if (existingMarker) {
        markerDataRegistry.set(markerId, item);
        return existingMarker;
    }

    const marker = new AMap.Marker({
        position: [item.lng, item.lat],
        content: '<div class="map-dot"></div>',
        anchor: 'bottom-center',
        offset: new AMap.Pixel(0, 0)
    });

    markerRegistry.set(markerId, marker);
    markerDataRegistry.set(markerId, item);
    return marker;
}

/**
 * 飞向某个特定的位置
 * @param {Array} lnglat - [经度, 纬度]
 */
function flyToPosition(lnglat) {
    if (mapInstance) {
        mapInstance.setZoomAndCenter(16, lnglat); // 缩放到 16 级并移到中心
    }
}

/**
 * 飞向并高亮某个店铺标记
 * @param {Object} item - 包含 id,name,lng,lat 的对象
 */
function focusMarker(item) {
    if (!mapInstance || !item) return;

    const markerId = getMarkerId(item);
    const marker = markerRegistry.get(markerId) || renderFoodMarker(item);
    if (!marker) return;

    marker.setMap(mapInstance);
    visibleMarkerIds.add(markerId);

    if (activeMarkerId && markerRegistry.has(activeMarkerId) && visibleMarkerIds.has(activeMarkerId)) {
        const prev = markerRegistry.get(activeMarkerId);
        const prevData = markerDataRegistry.get(activeMarkerId);
        if (prevData) {
            prev.setLabel({
                direction: 'top',
                offset: new AMap.Pixel(0, -6),
                content: `<div class="map-name-badge">🍜 ${prevData.name}</div>`
            });
        }
    }

    marker.setLabel({
        direction: 'top',
        offset: new AMap.Pixel(0, -6),
        content: `<div class="map-name-badge active">⭐ ${item.name}</div>`
    });
    activeMarkerId = markerId;

    flyToPosition([item.lng, item.lat]);
}

function showCategoryMarkers(items) {
    if (!mapInstance) return;

    hideAllMarkers();
    items.forEach((item) => {
        const markerId = getMarkerId(item);
        const marker = markerRegistry.get(markerId) || renderFoodMarker(item);
        if (!marker) return;
        marker.setLabel({
            direction: 'top',
            offset: new AMap.Pixel(0, -6),
            content: `<div class="map-name-badge">🍜 ${item.name}</div>`
        });
        marker.setMap(mapInstance);
        visibleMarkerIds.add(markerId);
    });
}

/**
 * 从地图中移除某个店铺标记
 * @param {Object} item - 包含 id,name,lng,lat 的对象
 */
function removeFoodMarker(item) {
    if (!mapInstance || !item) return;

    const markerId = getMarkerId(item);
    const marker = markerRegistry.get(markerId);
    if (!marker) return;

    marker.setMap(null);
    markerRegistry.delete(markerId);
    markerDataRegistry.delete(markerId);
    visibleMarkerIds.delete(markerId);

    if (activeMarkerId === markerId) {
        activeMarkerId = null;
    }
}

function hideAllMarkers() {
    markerRegistry.forEach((marker, markerId) => {
        marker.setLabel(null);
        marker.setMap(null);
        visibleMarkerIds.delete(markerId);
    });
    activeMarkerId = null;
}

function getMarkerId(item) {
    return item.id || `${item.name}-${item.lng}-${item.lat}`;
}

function normalizeDistrictKeyword(cityLabel) {
    if (!cityLabel || cityLabel === '未知城市') return '';
    const s = cityLabel.trim();
    if (/[省市州县区旗]$/.test(s)) return s;
    return `${s}市`;
}

/**
 * 侧边栏点击城市：地图平滑平移到该城市行政中心附近
 */
function panMapToCityCenter(cityLabel) {
    if (!mapInstance || !cityLabel || cityLabel === '未知城市') return;

    const keyword = normalizeDistrictKeyword(cityLabel);
    if (!keyword) return;

    AMap.plugin('AMap.DistrictSearch', function () {
        const ds = new AMap.DistrictSearch({
            subdistrict: 0,
            extensions: 'base'
        });
        ds.search(keyword, function (status, result) {
            if (status !== 'complete' || !result.districtList || !result.districtList.length) return;
            const c = result.districtList[0].center;
            if (!c) return;
            let lnglat;
            if (typeof c.getLng === 'function') {
                lnglat = [c.getLng(), c.getLat()];
            } else if (c.lng != null && c.lat != null) {
                lnglat = [c.lng, c.lat];
            } else if (Array.isArray(c)) {
                lnglat = c;
            } else {
                return;
            }
            if (typeof mapInstance.panTo === 'function') {
                mapInstance.panTo(lnglat);
            } else {
                mapInstance.setCenter(lnglat);
            }
        });
    });
}

/**
 * 搜索前选择城市：行政区定位并缩放到城市级视野
 * @param {string} cityLabel - 用户输入，如「武汉」「北京市」
 * @param {number} [zoomLevel=11]
 * @param {(ok: boolean) => void} [done]
 */
function focusMapOnCityForSearch(cityLabel, zoomLevel, done) {
    const cb = typeof zoomLevel === 'function' ? zoomLevel : done;
    const zoom = typeof zoomLevel === 'number' ? zoomLevel : 11;
    const callback = typeof cb === 'function' ? cb : function () {};

    if (!mapInstance || !cityLabel || !String(cityLabel).trim()) {
        callback(false);
        return;
    }

    const keyword = normalizeDistrictKeyword(String(cityLabel).trim());
    if (!keyword) {
        callback(false);
        return;
    }

    function applyCenterFromUnknown(c) {
        if (!c) return null;
        if (typeof c.getLng === 'function') {
            return [c.getLng(), c.getLat()];
        }
        if (c.lng != null && c.lat != null) {
            return [c.lng, c.lat];
        }
        if (Array.isArray(c) && c.length >= 2) {
            return c;
        }
        return null;
    }

    function fallbackByGeocoder() {
        AMap.plugin('AMap.Geocoder', function () {
            const geo = new AMap.Geocoder({ city: keyword });
            geo.getLocation(keyword, function (status, result) {
                if (
                    status !== 'complete' ||
                    !result ||
                    !Array.isArray(result.geocodes) ||
                    !result.geocodes.length
                ) {
                    fallbackBySetCity();
                    return;
                }
                const loc = result.geocodes[0].location;
                const lnglat = applyCenterFromUnknown(loc);
                if (!lnglat) {
                    fallbackBySetCity();
                    return;
                }
                mapInstance.setZoomAndCenter(zoom, lnglat);
                callback(true);
            });
        });
    }

    function fallbackBySetCity() {
        if (!mapInstance || typeof mapInstance.setCity !== 'function') {
            callback(false);
            return;
        }
        try {
            mapInstance.setCity(keyword);
            if (typeof mapInstance.setZoom === 'function') {
                mapInstance.setZoom(zoom);
            }
            callback(true);
        } catch (error) {
            callback(false);
        }
    }

    AMap.plugin('AMap.DistrictSearch', function () {
        const ds = new AMap.DistrictSearch({
            subdistrict: 0,
            extensions: 'base'
        });
        ds.search(keyword, function (status, result) {
            if (status !== 'complete' || !result.districtList || !result.districtList.length) {
                fallbackByGeocoder();
                return;
            }
            const c = result.districtList[0].center;
            const lnglat = applyCenterFromUnknown(c);
            if (!lnglat) {
                fallbackByGeocoder();
                return;
            }
            mapInstance.setZoomAndCenter(zoom, lnglat);
            callback(true);
        });
    });
}

/**
 * 自动定位当前城市：优先浏览器精准定位，5 秒无响应则回退 IP 城市定位
 * @param {(result: {ok:boolean, city?:string, source?:'geolocation'|'ip', lnglat?:number[]}) => void} done
 */
function locateCurrentCityFast(done) {
    const callback = typeof done === 'function' ? done : function () {};
    if (!mapInstance) {
        callback({ ok: false });
        return;
    }

    let resolved = false;
    const resolveOnce = function (payload) {
        if (resolved) return;
        resolved = true;
        callback(payload);
    };

    const fallbackByCitySearch = function () {
        AMap.plugin('AMap.CitySearch', function () {
            const cs = new AMap.CitySearch();
            cs.getLocalCity(function (status, result) {
                if (status !== 'complete' || !result || !result.city) {
                    resolveOnce({ ok: false });
                    return;
                }
                const city = String(result.city || '').trim();
                if (city && typeof mapInstance.setCity === 'function') {
                    try {
                        mapInstance.setCity(city);
                    } catch (e) {
                        // ignore
                    }
                }
                if (typeof mapInstance.setZoom === 'function') {
                    mapInstance.setZoom(11);
                }
                resolveOnce({
                    ok: true,
                    city,
                    source: 'ip'
                });
            });
        });
    };

    if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== 'function') {
        fallbackByCitySearch();
        return;
    }

    const timer = window.setTimeout(function () {
        fallbackByCitySearch();
    }, 5000);

    navigator.geolocation.getCurrentPosition(
        function (pos) {
            if (resolved) return;
            window.clearTimeout(timer);
            const lnglat = [pos.coords.longitude, pos.coords.latitude];
            mapInstance.setZoomAndCenter(12, lnglat);

            AMap.plugin('AMap.Geocoder', function () {
                const geo = new AMap.Geocoder();
                geo.getAddress(lnglat, function (status, result) {
                    if (resolved) return;
                    if (status !== 'complete' || !result || !result.regeocode) {
                        fallbackByCitySearch();
                        return;
                    }
                    const ac = result.regeocode.addressComponent || {};
                    const city = (Array.isArray(ac.city) ? ac.city[0] : ac.city) || ac.province || '';
                    resolveOnce({
                        ok: true,
                        city: String(city || '').trim(),
                        source: 'geolocation',
                        lnglat
                    });
                });
            });
        },
        function () {
            if (resolved) return;
            window.clearTimeout(timer);
            fallbackByCitySearch();
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

/**
 * 根据收藏点范围调整视野（全国「全部」时使用）
 */
function applyFitViewToCollectionItems(items) {
    if (!mapInstance || !items || !items.length) return;
    if (items.length === 1) {
        mapInstance.setZoomAndCenter(14, [items[0].lng, items[0].lat]);
        return;
    }
    let minLng = items[0].lng;
    let maxLng = items[0].lng;
    let minLat = items[0].lat;
    let maxLat = items[0].lat;
    items.forEach((it) => {
        minLng = Math.min(minLng, it.lng);
        maxLng = Math.max(maxLng, it.lng);
        minLat = Math.min(minLat, it.lat);
        maxLat = Math.max(maxLat, it.lat);
    });
    try {
        const bounds = new AMap.Bounds([minLng, minLat], [maxLng, maxLat]);
        mapInstance.setBounds(bounds, false, [48, 48, 48, 48]);
    } catch (e) {
        mapInstance.setCenter([(minLng + maxLng) / 2, (minLat + maxLat) / 2]);
    }
}

/**
 * 城市筛选时切换地图视角：优先 setCity，否则行政区检索 + panTo
 */
function applyMapViewForCityKey(cityKey) {
    if (!mapInstance || !cityKey || cityKey === '未知城市') {
        return;
    }
    if (typeof mapInstance.setCity === 'function') {
        try {
            mapInstance.setCity(cityKey);
            return;
        } catch (e) {
            /* fall through */
        }
    }
    panMapToCityCenter(cityKey);
}

/** 对外统一入口：注册并在地图上显示该点（小圆点，无名称标签；展开收藏夹分类时会再套标签） */
const MapEngine = {
    getMap() {
        return getMapInstance();
    },
    renderMarker(item) {
        const marker = renderFoodMarker(item);
        if (!mapInstance || !marker) return marker;
        marker.setLabel(null);
        marker.setMap(mapInstance);
        visibleMarkerIds.add(getMarkerId(item));
        return marker;
    },
    panToCityCenter(cityLabel) {
        panMapToCityCenter(cityLabel);
    },
    fitMapToCollectionItems(items) {
        applyFitViewToCollectionItems(items);
    },
    setMapViewForCity(cityKey) {
        applyMapViewForCityKey(cityKey);
    },
    /**
     * @param {string} cityLabel
     * @param {number | ((ok: boolean) => void)} [zoomOrDone]
     * @param {(ok: boolean) => void} [done]
     */
    focusSearchCity(cityLabel, zoomOrDone, done) {
        if (typeof zoomOrDone === 'function') {
            focusMapOnCityForSearch(cityLabel, 11, zoomOrDone);
        } else {
            focusMapOnCityForSearch(cityLabel, zoomOrDone, done);
        }
    },
    locateCurrentCity(done) {
        locateCurrentCityFast(done);
    }
};
