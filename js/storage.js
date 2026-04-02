// js/storage.js — Supabase 同步 + localStorage 备份；失败时仍以本地为准，不阻塞地图

const CITY_FILTER_ALL = '__ALL__';
const COLLECTION_STORAGE_KEY = 'food_collection_v1';

let collectionCache = [];
let supabaseClient = null;

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

function ensureSupabaseClient() {
    if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
        return null;
    }
    if (typeof SUPABASE_CONFIG === 'undefined' || !SUPABASE_CONFIG.URL || !SUPABASE_CONFIG.ANON_KEY) {
        return null;
    }
    if (!supabaseClient) {
        supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
    }
    return supabaseClient;
}

function mergePlacesByGeoKey(remoteList, localList) {
    const map = new Map();
    function add(item) {
        const n = normalizePlaceRecord(item);
        if (!Number.isFinite(n.lng) || !Number.isFinite(n.lat)) return;
        const k = buildUniqueKey(n);
        if (!map.has(k)) map.set(k, n);
    }
    (remoteList || []).forEach(add);
    (localList || []).forEach(add);
    return Array.from(map.values());
}

/** 启动：优先拉 Supabase，失败则用本地；不抛错 */
async function initStorageModule() {
    let remote = [];
    const client = ensureSupabaseClient();
    if (client) {
        try {
            const { data, error } = await client.from(SUPABASE_CONFIG.TABLE).select('*');
            if (error) {
                console.warn('⚠️ Supabase 拉取失败，使用本地缓存：', error.message || error);
            } else if (Array.isArray(data)) {
                remote = data.map(normalizePlaceRecord);
            }
        } catch (e) {
            console.warn('⚠️ Supabase 异常，使用本地缓存：', e);
        }
    }
    const local = readPlacesFromLocalStorage();
    collectionCache = remote.length ? mergePlacesByGeoKey(remote, local) : local;
    writePlacesToLocalStorage(collectionCache);
    if (typeof refreshCollectionUI === 'function') {
        refreshCollectionUI();
    }
}

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

function supabaseInsertRow(normalized) {
    const client = ensureSupabaseClient();
    if (!client) return;
    const row = { ...normalized };
    if (row.id === undefined || row.id === null || row.id === '') {
        delete row.id;
    }
    client
        .from(SUPABASE_CONFIG.TABLE)
        .insert(row)
        .then(function (res) {
            if (res.error) {
                console.warn('⚠️ Supabase 写入失败：', res.error.message || res.error);
            }
        })
        .catch(function (e) {
            console.warn('⚠️ Supabase 写入异常：', e);
        });
}

function supabaseDeleteRow(item) {
    const client = ensureSupabaseClient();
    if (!client) return;
    let q = client.from(SUPABASE_CONFIG.TABLE).delete();
    if (item.id != null && String(item.id).trim() !== '') {
        q = q.eq('id', item.id);
    } else {
        q = q.eq('name', item.name).eq('lng', item.lng).eq('lat', item.lat);
    }
    q.then(function (res) {
        if (res.error) {
            console.warn('⚠️ Supabase 删除失败：', res.error.message || res.error);
        }
    }).catch(function (e) {
        console.warn('⚠️ Supabase 删除异常：', e);
    });
}

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
    supabaseInsertRow(normalized);
    return { ok: true, reason: 'created', item: normalized };
}

function removeFromCollection(item) {
    const list = collectionCache.slice();
    const idx = findCollectionIndex(list, item);
    if (idx < 0) return;
    const removed = list[idx];
    list.splice(idx, 1);
    collectionCache = list;
    writePlacesToLocalStorage(collectionCache);
    supabaseDeleteRow(removed);
}
