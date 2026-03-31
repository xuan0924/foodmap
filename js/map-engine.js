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
        zoom: 13,
        center: AMAP_CONFIG.CENTER,
        viewMode: '3D',
        mapStyle: 'amap://styles/whitesmoke' // 极简配色，突出美食
    });

    console.log("✅ 地图引擎初始化成功，中心点：", AMAP_CONFIG.CENTER);
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
