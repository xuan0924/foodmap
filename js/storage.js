// js/storage.js — 收藏数据：localStorage、去重、城市列表、逆地理（省份/城市）

const COLLECTION_STORAGE_KEY = 'food_collection_v1';
const CITY_FILTER_ALL = '__ALL__';

function getCollectionStorageKey() {
    const fallback = 'solo_local';
    const groupId =
        window.GroupManager && typeof window.GroupManager.getActiveGroupId === 'function'
            ? window.GroupManager.getActiveGroupId() || fallback
            : fallback;
    return `${COLLECTION_STORAGE_KEY}:${groupId}`;
}

function getCollectionStorageKeyByGroupId(groupId) {
    const gid = String(groupId || 'solo_local').trim() || 'solo_local';
    return `${COLLECTION_STORAGE_KEY}:${gid}`;
}

function getStoredCollectionByGroupId(groupId) {
    const raw = localStorage.getItem(getCollectionStorageKeyByGroupId(groupId));
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('⚠️ 本地收藏数据损坏，已忽略。', error);
        return [];
    }
}

function getAllGroupCollections() {
    if (!window.GroupManager || typeof window.GroupManager.getJoinedGroups !== 'function') {
        return getStoredCollection().map((item) => ({ ...item, __groupId: 'solo_local', __groupName: '本地' }));
    }
    const groups = window.GroupManager.getJoinedGroups();
    const merged = [];
    groups.forEach((group) => {
        const list = getStoredCollectionByGroupId(group.id);
        list.forEach((item) => {
            merged.push({
                ...item,
                __groupId: group.id,
                __groupName: group.name || '未命名小组'
            });
        });
    });
    return merged;
}

function getStoredCollection() {
    const raw = localStorage.getItem(getCollectionStorageKey());
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('⚠️ 本地收藏数据损坏，已忽略。', error);
        return [];
    }
}

function getCityKeyForItem(item) {
    const c = (item.city || '').trim();
    return c || '未知城市';
}

/**
 * 从当前收藏中提取不重复城市键（仅已有店铺的城市），排序后返回
 */
function getUniqueCitiesFromCollection() {
    const list = getStoredCollection();
    const set = new Set();
    list.forEach((item) => {
        set.add(getCityKeyForItem(item));
    });
    return Array.from(set).sort((a, b) => {
        if (a === '未知城市') return 1;
        if (b === '未知城市') return -1;
        return a.localeCompare(b, 'zh-CN');
    });
}

function getUniqueCitiesFromList(list) {
    const set = new Set();
    list.forEach((item) => {
        set.add(getCityKeyForItem(item));
    });
    return Array.from(set).sort((a, b) => {
        if (a === '未知城市') return 1;
        if (b === '未知城市') return -1;
        return a.localeCompare(b, 'zh-CN');
    });
}

/**
 * 按城市筛选；filterKey 为 CITY_FILTER_ALL 或 null/undefined 表示全部
 */
function filterCollectionByCity(list, filterKey) {
    if (!filterKey || filterKey === CITY_FILTER_ALL) return list.slice();
    return list.filter((item) => getCityKeyForItem(item) === filterKey);
}

/**
 * 必须使用逆地理解析 province / city；直辖市 city 为空时用 province
 */
function reverseGeocodeRegion(lng, lat, done) {
    if (typeof AMap === 'undefined') {
        done({ province: '', city: '' });
        return;
    }
    AMap.plugin('AMap.Geocoder', function () {
        const geo = new AMap.Geocoder();
        geo.getAddress([lng, lat], function (status, result) {
            let province = '';
            let city = '';
            if (status === 'complete' && result && result.regeocode) {
                const ac = result.regeocode.addressComponent || {};
                province = (ac.province || '').toString().trim();
                const c = ac.city;
                if (typeof c === 'string' && c.trim()) {
                    city = c.trim();
                } else if (Array.isArray(c) && c.length) {
                    city = String(c[0]).trim();
                }
                if (!city) {
                    city = province;
                }
            }
            done({ province, city });
        });
    });
}

function findCollectionIndex(list, item) {
    if (item.id != null && String(item.id).length > 0) {
        const idStr = String(item.id);
        return list.findIndex((record) => record.id != null && String(record.id) === idStr);
    }
    const key = `${item.name}-${item.lng}-${item.lat}`;
    return list.findIndex((record) => {
        if (record.id != null && String(record.id).length > 0) return false;
        return `${record.name}-${record.lng}-${record.lat}` === key;
    });
}

function saveToCollection(item) {
    const list = getStoredCollection();
    const idx = findCollectionIndex(list, item);
    if (idx >= 0) {
        list[idx] = { ...list[idx], ...item };
    } else {
        list.push(item);
    }
    localStorage.setItem(getCollectionStorageKey(), JSON.stringify(list));
}

function removeFromCollection(item) {
    const list = getStoredCollection();
    const idx = findCollectionIndex(list, item);
    if (idx < 0) return;
    list.splice(idx, 1);
    localStorage.setItem(getCollectionStorageKey(), JSON.stringify(list));
}

function removeFromCollectionByGroupId(groupId, item) {
    const key = getCollectionStorageKeyByGroupId(groupId);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    let list = [];
    try {
        const parsed = JSON.parse(raw);
        list = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return;
    }
    const idx = findCollectionIndex(list, item);
    if (idx < 0) return;
    list.splice(idx, 1);
    localStorage.setItem(key, JSON.stringify(list));
}
