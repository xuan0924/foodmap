// js/storage.js — 暂时禁用 Supabase，仅使用 localStorage（便于排查地图是否与数据库冲突）

const CITY_FILTER_ALL = '__ALL__';
const COLLECTION_STORAGE_KEY = 'food_collection_v1';

let collectionCache = [];

function readPlacesFromLocalStorage() {
    const raw = localStorage.getItem(COLLECTION_STORAGE_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normalizePlaceRecord) : [];
    } catch (error) {
        console.warn('⚠️ 本地收藏数据损坏，已忽略。', error);
        return [];
    }
}

function writePlacesToLocalStorage(list) {
    try {
        localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
        console.error('❌ localStorage 写入失败：', error);
    }
}

/** 启动时从本地加载；不访问任何远程数据库 */
async function initStorageModule() {
    try {
        collectionCache = readPlacesFromLocalStorage();
        if (typeof refreshCollectionUI === 'function') {
            refreshCollectionUI();
        }
    } catch (error) {
        console.error('❌ 本地收藏初始化失败：', error);
        collectionCache = [];
    }
}

/** 等价于「读取全部地点」：来自内存缓存（与 localStorage 同步） */
function getStoredCollection() {
    return collectionCache.slice();
}

function getCityKeyForItem(item) {
    const c = (item.city || '').trim();
    return c || '未知城市';
}

function getUniqueCitiesFromCollection() {
    const list = getStoredCollection();
    const set = new Set();
    list.forEach((item) => set.add(getCityKeyForItem(item)));
    return Array.from(set).sort((a, b) => {
        if (a === '未知城市') return 1;
        if (b === '未知城市') return -1;
        return a.localeCompare(b, 'zh-CN');
    });
}

function filterCollectionByCity(list, filterKey) {
    if (!filterKey || filterKey === CITY_FILTER_ALL) return list.slice();
    return list.filter((item) => getCityKeyForItem(item) === filterKey);
}

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
                if (!city) city = province;
            }
            done({ province, city });
        });
    });
}

function normalizePlaceRecord(item) {
    if (!item || typeof item !== 'object') return {};
    return {
        id: item.id,
        name: item.name || '',
        lng: Number(item.lng),
        lat: Number(item.lat),
        category: item.category || '我的私藏',
        address: item.address || '',
        province: item.province || '',
        city: item.city || '',
        remark: item.remark || ''
    };
}

function buildUniqueKey(item) {
    return `geo:${item.name}-${item.lng}-${item.lat}`;
}

function findCollectionIndex(list, item) {
    const key = buildUniqueKey(item);
    return list.findIndex((record) => buildUniqueKey(record) === key);
}

/** 保存单条到本地（等价 savePlace） */
function saveToCollection(item) {
    const normalized = normalizePlaceRecord(item);
    const list = collectionCache.slice();
    const idx = findCollectionIndex(list, normalized);
    if (idx >= 0) {
        return { ok: false, reason: 'duplicate', item: list[idx] };
    }
    list.push(normalized);
    collectionCache = list;
    writePlacesToLocalStorage(collectionCache);
    return { ok: true, reason: 'created', item: normalized };
}

function removeFromCollection(item) {
    const list = collectionCache.slice();
    const idx = findCollectionIndex(list, item);
    if (idx < 0) return;
    list.splice(idx, 1);
    collectionCache = list;
    writePlacesToLocalStorage(collectionCache);
}

/* —— 以下为 Supabase 相关，已暂时停用 ——
function ensureSupabaseClient() { ... }
async function upsertPlaceToSupabase() { ... }
async function removePlaceFromSupabase() { ... }
*/
