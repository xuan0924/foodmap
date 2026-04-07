// js/map-engine.js
// 这是一个“单例”模式的思想，我们定义一个全局变量来持有地图实例
let mapInstance = null;

function parseAmapLngLat(loc) {
    if (!loc) return null;
    if (typeof loc.getLng === 'function') {
        return [loc.getLng(), loc.getLat()];
    }
    if (loc.lng != null && loc.lat != null) {
        return [Number(loc.lng), Number(loc.lat)];
    }
    if (Array.isArray(loc) && loc.length >= 2) {
        return [Number(loc[0]), Number(loc[1])];
    }
    return null;
}

/**
 * 按城市名移图：完全不用 Map#setCity（高德 2.0 在多种情况下仍会报 h is not a function）。
 * @param {(ok: boolean) => void} [done]
 */
function mapMoveToCityName(cityName, zoomLevel, done) {
    const zoom = zoomLevel != null ? zoomLevel : 11;
    const name = String(cityName || '').trim();
    const cb = typeof done === 'function' ? done : null;
    if (!mapInstance || !name) {
        if (cb) cb(false);
        return;
    }
    if (typeof AMap === 'undefined' || typeof AMap.plugin !== 'function') {
        if (cb) cb(false);
        return;
    }
    AMap.plugin('AMap.Geocoder', function () {
        try {
            const geo = new AMap.Geocoder();
            geo.getLocation(name, function (status, result) {
                let ok = false;
                try {
                    if (status === 'complete' && result && Array.isArray(result.geocodes) && result.geocodes.length) {
                        const ll = parseAmapLngLat(result.geocodes[0].location);
                        if (ll) {
                            mapInstance.setCenter(ll);
                            if (typeof mapInstance.setZoom === 'function') {
                                mapInstance.setZoom(zoom);
                            }
                            ok = true;
                        }
                    }
                    if (!ok && typeof AMAP_CONFIG !== 'undefined' && AMAP_CONFIG.DEFAULT_MAP_CENTER) {
                        mapInstance.setCenter(AMAP_CONFIG.DEFAULT_MAP_CENTER);
                        if (typeof mapInstance.setZoom === 'function') {
                            mapInstance.setZoom(zoom);
                        }
                        ok = true;
                    }
                } catch (e) {
                    console.warn('mapMoveToCityName:', e);
                }
                if (cb) cb(ok);
            });
        } catch (e) {
            console.warn('Geocoder:', e);
            if (cb) cb(false);
        }
    });
}

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

function initLocationModule() {
    if (!mapInstance || typeof AMap === 'undefined' || typeof AMap.plugin !== 'function') {
        return;
    }
    const isInsecureHttp =
        location.protocol === 'http:' &&
        location.hostname !== 'localhost' &&
        location.hostname !== '127.0.0.1';
    if (isInsecureHttp) {
        mapMoveToCityName('武汉', 11);
        console.warn('⚠️ 当前为 HTTP 访问，已降级到默认城市：武汉');
        return;
    }

    AMap.plugin(['AMap.CitySearch'], function () {
        const citysearch = new AMap.CitySearch();
        let settled = false;
        const fallbackToWuhan = function (reason) {
            if (settled) return;
            settled = true;
            mapMoveToCityName('武汉', 11);
            console.warn('❌ 城市定位失败，默认显示武汉：', reason || 'unknown');
        };
        const timer = window.setTimeout(function () {
            fallbackToWuhan('timeout');
        }, 3000);

        citysearch.getLocalCity(function (status, result) {
            if (settled) return;
            window.clearTimeout(timer);
            if (status === 'complete' && result && result.city) {
                settled = true;
                mapMoveToCityName(result.city, 11);
                console.log('✅ IP 定位成功：' + result.city);
                return;
            }
            fallbackToWuhan('citysearch-failed');
        });
    });
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
    const zoom = typeof zoomLevel === 'number' ? zoomLevel : 14;
    const callback = typeof cb === 'function' ? cb : function () {};

    if (!mapInstance || !cityLabel || !String(cityLabel).trim()) {
        callback({ ok: false });
        return;
    }

    const keyword = normalizeDistrictKeyword(String(cityLabel).trim());
    if (!keyword) {
        callback({ ok: false });
        return;
    }
    let settled = false;
    function finish(ok, payload) {
        if (settled) return;
        settled = true;
        window.clearTimeout(hardTimeout);
        if (ok) {
            callback({ ok: true, ...(payload || {}) });
        } else {
            callback({ ok: false });
        }
    }

    function jumpToLnglat(lnglat, meta) {
        if (!lnglat || !Array.isArray(lnglat) || lnglat.length < 2) {
            finish(false);
            return;
        }
        // 清理潜在动画/fit 过程，避免视角被拉回
        if (typeof mapInstance.stopMove === 'function') {
            try {
                mapInstance.stopMove();
            } catch (e) {
                // ignore
            }
        }
        if (typeof mapInstance.panTo === 'function') {
            mapInstance.panTo(lnglat);
        } else {
            mapInstance.setCenter(lnglat);
        }
        if (typeof mapInstance.setZoom === 'function') {
            mapInstance.setZoom(zoom);
        }
        console.log('📍 城市定位成功坐标:', {
            lng: lnglat[0],
            lat: lnglat[1],
            city: meta && meta.city ? meta.city : '',
            source: meta && meta.source ? meta.source : 'unknown'
        });
        finish(true, { lnglat, ...(meta || {}) });
    }

    const hardTimeout = window.setTimeout(function () {
        if (!mapInstance) {
            finish(false);
            return;
        }
        mapMoveToCityName(keyword, zoom, function (ok) {
            if (ok) {
                finish(true, { city: String(cityLabel || '').trim(), source: 'geocode-timeout' });
            } else {
                finish(false);
            }
        });
    }, 3500);

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

    AMap.plugin(['AMap.DistrictSearch', 'AMap.Geocoder', 'AMap.CitySearch'], function () {
        function fallbackByGeocoder() {
            const geo = new AMap.Geocoder({ city: keyword });
            geo.getLocation(keyword, function (status, result) {
                if (settled) return;
                if (
                    status !== 'complete' ||
                    !result ||
                    !Array.isArray(result.geocodes) ||
                    !result.geocodes.length
                ) {
                    finish(false);
                    return;
                }
                const loc = result.geocodes[0].location;
                const lnglat = applyCenterFromUnknown(loc);
                if (!lnglat) {
                    finish(false);
                    return;
                }
                const ac = result.geocodes[0] || {};
                const city = (ac.city || ac.district || ac.province || cityLabel || '').toString().trim();
                jumpToLnglat(lnglat, { city, source: 'geocoder' });
            });
        }

        if (settled) return;
        const ds = new AMap.DistrictSearch({
            subdistrict: 0,
            extensions: 'base'
        });
        ds.search(keyword, function (status, result) {
            if (settled) return;
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
            const city = (result.districtList[0].name || cityLabel || '').toString().trim();
            jumpToLnglat(lnglat, { city, source: 'district' });
        });
    });
}

/**
 * 自动定位当前城市：仅 IP 城市（AMap.CitySearch）
 * @param {(result: {ok:boolean, city?:string, source?:string, lnglat?:number[]}) => void} done
 */
function locateCurrentCityFast(done) {
    const callback = typeof done === 'function' ? done : function () {};
    if (!mapInstance || typeof AMap === 'undefined') {
        callback({ ok: false });
        return;
    }
    const isInsecureHttp =
        location.protocol === 'http:' &&
        location.hostname !== 'localhost' &&
        location.hostname !== '127.0.0.1';
    if (isInsecureHttp) {
        callback({ ok: true, city: '武汉', source: 'default-http' });
        return;
    }

    AMap.plugin(['AMap.CitySearch'], function () {
        const citysearch = new AMap.CitySearch();
        let settled = false;
        const finish = function (payload) {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            callback(payload);
        };
        const timer = window.setTimeout(function () {
            finish({ ok: true, city: '武汉', source: 'default-timeout' });
        }, 3000);

        citysearch.getLocalCity(function (status, result) {
            if (settled) return;
            if (status === 'complete' && result && result.city) {
                finish({
                    ok: true,
                    city: String(result.city || '').trim(),
                    source: 'ip'
                });
                return;
            }
            finish({ ok: true, city: '武汉', source: 'default-fallback' });
        });
    });
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
 * 城市筛选时切换地图视角：地理编码移图，失败再行政区 panTo
 */
function applyMapViewForCityKey(cityKey) {
    if (!mapInstance || !cityKey || cityKey === '未知城市') {
        return;
    }
    mapMoveToCityName(cityKey, 11, function (ok) {
        if (!ok) {
            panMapToCityCenter(cityKey);
        }
    });
}

/** 对外统一入口：注册并在地图上显示该点（小圆点，无名称标签；展开收藏夹分类时会再套标签） */
const MapEngine = {
    /** 由 main.js 直接 new AMap.Map 时注入，供搜索/收藏与引擎共用同一实例 */
    bindMapInstance(m) {
        mapInstance = m;
    },
    /** 按城市名移图（不用 setCity，避免 SDK h is not a function） */
    moveMapToCityName(cityName, zoom, done) {
        mapMoveToCityName(cityName, zoom, done);
    },
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
