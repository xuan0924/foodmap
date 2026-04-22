// js/map-engine.js
// 这是一个“单例”模式的思想，我们定义一个全局变量来持有地图实例
let mapInstance = null;
const markerRegistry = new Map();
const markerDataRegistry = new Map();
const visibleMarkerIds = new Set();
let activeMarkerId = null;
/** @type {object | null} 最近一次从收藏/列表聚焦的店铺（用于「发起传送」） */
let lastFocusedNavItem = null;
/** @type {AMap.InfoWindow | null} */
let foodInfoWindowInstance = null;
/** @type {AMap.Polyline[]} */
let routePreviewLines = [];
/** @type {AMap.Marker | null} 路径起点流光圆点（非高德默认图钉） */
let routeOriginDotMarker = null;

function clearRoutePreview() {
    routePreviewLines.forEach((line) => {
        try {
            line.setMap(null);
        } catch (e) {
            /* ignore */
        }
    });
    routePreviewLines = [];
    if (routeOriginDotMarker) {
        try {
            routeOriginDotMarker.setMap(null);
        } catch (e) {
            /* ignore */
        }
        routeOriginDotMarker = null;
    }
}

function segmentLen2D(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
}

/** 按路径累计长度截取前 fraction（0~1）一段，用于生长动画 */
function slicePathByFraction(fullPath, fraction) {
    if (!fullPath || fullPath.length < 2) {
        const p = fullPath && fullPath[0] ? fullPath[0] : [0, 0];
        return [p, p];
    }
    if (fraction >= 1) return fullPath.slice();

    let total = 0;
    const segLens = [];
    for (let i = 1; i < fullPath.length; i++) {
        const len = segmentLen2D(fullPath[i - 1], fullPath[i]);
        segLens.push(len);
        total += len;
    }
    if (total <= 1e-12) return [fullPath[0], fullPath[fullPath.length - 1]];

    const target = total * Math.max(0, fraction);
    let acc = 0;
    const out = [fullPath[0]];
    for (let i = 1; i < fullPath.length; i++) {
        const sl = segLens[i - 1];
        if (acc + sl <= target + 1e-9) {
            out.push(fullPath[i]);
            acc += sl;
        } else {
            const remain = target - acc;
            const t = sl > 0 ? remain / sl : 1;
            const p0 = fullPath[i - 1];
            const p1 = fullPath[i];
            out.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]);
            break;
        }
    }
    return out.length >= 2 ? out : [fullPath[0], fullPath[0]];
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function animatePolylineGrowth(polyline, fullPath, durationMs, onComplete) {
    if (!polyline || !fullPath || fullPath.length < 2) {
        if (typeof onComplete === 'function') onComplete();
        return;
    }
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    function frame(now) {
        const elapsed = now - start;
        const linear = Math.min(1, elapsed / durationMs);
        const t = easeOutCubic(linear);
        polyline.setPath(slicePathByFraction(fullPath, t));
        if (linear < 1) {
            requestAnimationFrame(frame);
        } else {
            polyline.setPath(fullPath);
            if (typeof onComplete === 'function') onComplete();
        }
    }
    polyline.setPath(slicePathByFraction(fullPath, 0));
    requestAnimationFrame(frame);
}

function normalizePathFromOrigin(path, originLngLat) {
    const p = path && path.length ? path.slice() : [originLngLat, originLngLat];
    const first = p[0];
    const d = segmentLen2D(first, originLngLat);
    if (d > 1e-6) {
        return [originLngLat].concat(p);
    }
    return p;
}

function getProtocolAccentColor() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--protocol-accent').trim();
    if (raw) return raw;
    const fallback = getComputedStyle(document.documentElement).getPropertyValue('--theme-primary').trim();
    return fallback || '#1a73e8';
}

/**
 * 使用 Driving 规划路径并绘制预览线（颜色绑定 --protocol-accent）
 */
function previewDrivingRouteFromTo(originLngLat, destLngLat, done) {
    if (!mapInstance) {
        if (typeof done === 'function') done(false);
        return;
    }
    clearRoutePreview();

    const accent = getProtocolAccentColor();

    function pushPathPoint(path, p) {
        if (!p) return;
        if (Array.isArray(p) && p.length >= 2) {
            path.push([p[0], p[1]]);
        } else if (typeof p.getLng === 'function') {
            path.push([p.getLng(), p.getLat()]);
        } else if (p.lng != null && p.lat != null) {
            path.push([p.lng, p.lat]);
        }
    }

    function buildPathFromRoute(route) {
        const path = [];
        if (route && Array.isArray(route.path) && route.path.length) {
            route.path.forEach((p) => pushPathPoint(path, p));
        }
        if (path.length) return path;
        if (route && Array.isArray(route.steps)) {
            route.steps.forEach((step) => {
                if (step && step.path && step.path.length) {
                    step.path.forEach((p) => pushPathPoint(path, p));
                }
            });
        }
        return path;
    }

    function applyRoutePathToMap(path, originLngLat, destLngLat, onDone) {
        const fullPath = normalizePathFromOrigin(path, originLngLat);

        const dotEl = document.createElement('div');
        dotEl.className = 'route-origin-dot';
        dotEl.style.cssText = [
            'width:11px',
            'height:11px',
            'border-radius:50%',
            `background:${accent}`,
            'border:2px solid #ffffff',
            `box-shadow:0 0 12px ${accent}59,0 0 4px rgba(255,255,255,0.95)`,
            'pointer-events:none'
        ].join(';');

        routeOriginDotMarker = new AMap.Marker({
            position: originLngLat,
            content: dotEl,
            anchor: 'center',
            offset: new AMap.Pixel(0, 0),
            zIndex: 96,
            bubble: false
        });
        routeOriginDotMarker.setMap(mapInstance);

        const routeLine = new AMap.Polyline({
            path: slicePathByFraction(fullPath, 0),
            strokeColor: accent,
            strokeOpacity: 0.8,
            strokeWeight: 5,
            lineJoin: 'round',
            lineCap: 'round',
            isOutline: true,
            outlineColor: '#ffffff',
            borderWeight: 1,
            zIndex: 93,
            bubble: true
        });

        routeLine.setMap(mapInstance);
        routePreviewLines.push(routeLine);

        animatePolylineGrowth(routeLine, fullPath, 1000, () => {
            try {
                mapInstance.setFitView([routeLine, routeOriginDotMarker], false, [56, 56, 56, 56]);
            } catch (e) {
                mapInstance.setZoomAndCenter(14, destLngLat);
            }
            if (typeof onDone === 'function') onDone();
        });
    }

    AMap.plugin('AMap.Driving', function () {
        const drivingPolicy =
            typeof AMap.DrivingPolicy !== 'undefined' ? AMap.DrivingPolicy.LEAST_TIME : 0;
        const driving = new AMap.Driving({
            map: null,
            policy: drivingPolicy,
            ferry: 1,
            hideMarkers: true,
            autoFit: false
        });

        driving.search(
            new AMap.LngLat(originLngLat[0], originLngLat[1]),
            new AMap.LngLat(destLngLat[0], destLngLat[1]),
            function (status, result) {
                let path = [];
                if (status === 'complete' && result && result.routes && result.routes.length) {
                    path = buildPathFromRoute(result.routes[0]);
                }
                if (!path.length) {
                    path = [originLngLat, destLngLat];
                }
                const routeOk = status === 'complete' && result && result.routes && result.routes.length;
                applyRoutePathToMap(path, originLngLat, destLngLat, () => {
                    if (typeof done === 'function') done(routeOk);
                });
            }
        );
    });
}

function getCurrentLngLatForRouting(cb) {
    if (!mapInstance) {
        cb(null);
        return;
    }
    AMap.plugin('AMap.Geolocation', function () {
        const geo = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 12000,
            convert: true,
            showButton: false,
            showMarker: false,
            showCircle: false
        });
        geo.getCurrentPosition(function (status, result) {
            if (status === 'complete' && result && result.position) {
                const p = result.position;
                cb([p.getLng(), p.getLat()]);
                return;
            }
            const c = mapInstance.getCenter();
            if (c && typeof c.getLng === 'function') {
                cb([c.getLng(), c.getLat()]);
            } else if (c && c.lng != null) {
                cb([c.lng, c.lat]);
            } else {
                cb(null);
            }
        });
    });
}

function previewDrivingRouteToRestaurant(item, callback) {
    const dest = [item.lng, item.lat];
    getCurrentLngLatForRouting(function (origin) {
        if (!origin) {
            const c = mapInstance && mapInstance.getCenter();
            if (c && typeof c.getLng === 'function') origin = [c.getLng(), c.getLat()];
            else if (c && c.lng != null) origin = [c.lng, c.lat];
        }
        if (!origin) {
            if (typeof callback === 'function') callback(false, null);
            return;
        }
        previewDrivingRouteFromTo(origin, dest, function (ok) {
            if (typeof callback === 'function') callback(ok, origin);
        });
    });
}

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function closeFoodInfoWindowImpl() {
    if (!foodInfoWindowInstance) return;
    try {
        foodInfoWindowInstance.close();
    } catch (e) {
        /* ignore */
    }
    foodInfoWindowInstance = null;
}

/**
 * 预览路径并打开底部导航矩阵（仅应由「发起传送」二次触发）
 */
function runTeleportFlow(item) {
    if (!item || !mapInstance) return;
    if (window.ProtocolNav && typeof ProtocolNav.flashLinking === 'function') {
        ProtocolNav.flashLinking(item.name);
    }
    function openSheetFromOrigin(originLngLat) {
        if (!window.ProtocolNav || typeof ProtocolNav.openSheet !== 'function') return;
        let o = originLngLat;
        if (!o && mapInstance.getCenter) {
            const c = mapInstance.getCenter();
            if (c && typeof c.getLng === 'function') o = [c.getLng(), c.getLat()];
            else if (c && c.lng != null) o = [c.lng, c.lat];
        }
        ProtocolNav.openSheet(item, o || [item.lng, item.lat]);
    }
    previewDrivingRouteToRestaurant(item, function (_ok, originLngLat) {
        openSheetFromOrigin(originLngLat);
    });
}

function attachMarkerClickIfNeeded(marker, markerId) {
    if (!marker || marker.__foodMarkerClickBound) return;
    marker.__foodMarkerClickBound = true;
    marker.on('click', function (ev) {
        if (ev && typeof ev.stopPropagation === 'function') {
            ev.stopPropagation();
        }
        const data = markerDataRegistry.get(markerId);
        if (data) {
            openFoodInfoWindowUI(data);
        }
    });
}

/**
 * 打开定制信息窗（点击 Marker / 列表时调用，不自动进入导航）
 */
function openFoodInfoWindowUI(item) {
    if (!mapInstance || !item || typeof AMap === 'undefined') return;

    closeFoodInfoWindowImpl();
    focusMarker(item);

    const root = document.createElement('div');
    root.className = 'food-info-window-root';

    const name = escapeHtml(item.name || '未命名');
    const addr = escapeHtml(item.address || '地址不详');

    root.innerHTML = `
        <div class="food-info-window-card">
            <div class="food-info-window-main">
                <h3 class="food-info-window-name">${name}</h3>
                <p class="food-info-window-addr">${addr}</p>
            </div>
            <div class="food-info-window-footer">
                <button type="button" class="food-info-window-nav-btn">
                    <span class="food-info-window-nav-line1">发起传送</span>
                    <span class="food-info-window-nav-line2">Start Navigation</span>
                </button>
            </div>
        </div>`;

    const btn = root.querySelector('.food-info-window-nav-btn');
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFoodInfoWindowImpl();
            runTeleportFlow(item);
        });
    }

    foodInfoWindowInstance = new AMap.InfoWindow({
        isCustom: true,
        anchor: 'bottom-center',
        offset: new AMap.Pixel(0, -36),
        content: root,
        closeWhenClickMap: true
    });
    foodInfoWindowInstance.open(mapInstance, [item.lng, item.lat]);
}

function getMarkerEmoji(item) {
    const text = `${item && item.category ? item.category : ''}${item && item.name ? item.name : ''}`;
    if (/咖啡|coffee|拿铁|美式/i.test(text)) return '☕';
    if (/甜|蛋糕|面包|dessert|烘焙/i.test(text)) return '🍰';
    if (/火锅|麻辣烫|串串/i.test(text)) return '🍲';
    if (/烧烤|烤肉|bbq/i.test(text)) return '🍢';
    if (/奶茶|饮品|果汁|茶饮/i.test(text)) return '🧋';
    if (/日料|寿司|刺身/i.test(text)) return '🍣';
    if (/面|粉|米线|拉面/i.test(text)) return '🍜';
    return '🍽️';
}

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
        attachMarkerClickIfNeeded(existingMarker, markerId);
        return existingMarker;
    }

    const marker = new AMap.Marker({
        position: [item.lng, item.lat],
        content: `<div class="map-marker-card" title="${item.name || ''}"><span class="map-marker-emoji">${getMarkerEmoji(item)}</span></div>`,
        anchor: 'bottom-center',
        offset: new AMap.Pixel(0, 0)
    });

    markerRegistry.set(markerId, marker);
    markerDataRegistry.set(markerId, item);
    attachMarkerClickIfNeeded(marker, markerId);
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

    lastFocusedNavItem = item;
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

    closeFoodInfoWindowImpl();

    marker.setMap(null);
    markerRegistry.delete(markerId);
    markerDataRegistry.delete(markerId);
    visibleMarkerIds.delete(markerId);

    if (activeMarkerId === markerId) {
        activeMarkerId = null;
    }
}

function hideAllMarkers() {
    closeFoodInfoWindowImpl();
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

    AMap.plugin('AMap.DistrictSearch', function () {
        const ds = new AMap.DistrictSearch({
            subdistrict: 0,
            extensions: 'base'
        });
        ds.search(keyword, function (status, result) {
            if (status !== 'complete' || !result.districtList || !result.districtList.length) {
                callback(false);
                return;
            }
            const c = result.districtList[0].center;
            if (!c) {
                callback(false);
                return;
            }
            let lnglat;
            if (typeof c.getLng === 'function') {
                lnglat = [c.getLng(), c.getLat()];
            } else if (c.lng != null && c.lat != null) {
                lnglat = [c.lng, c.lat];
            } else if (Array.isArray(c)) {
                lnglat = c;
            } else {
                callback(false);
                return;
            }
            mapInstance.setZoomAndCenter(zoom, lnglat);
            callback(true);
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
    previewDrivingRouteToRestaurant(item, callback) {
        previewDrivingRouteToRestaurant(item, callback);
    },
    clearRoutePreview() {
        clearRoutePreview();
    },
    getLastFocusedNavItem() {
        return lastFocusedNavItem;
    },
    showFoodInfoWindow: openFoodInfoWindowUI,
    closeFoodInfoWindow: closeFoodInfoWindowImpl,
    beginTeleport: runTeleportFlow
};
