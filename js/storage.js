// js/storage.js — 收藏数据：Supabase 共享同步（无登录）

const CITY_FILTER_ALL = '__ALL__';
let collectionCache = [];
let supabaseClient = null;

function ensureSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        console.error('❌ Supabase SDK 未加载。');
        return null;
    }
    if (!SUPABASE_CONFIG || !SUPABASE_CONFIG.URL || !SUPABASE_CONFIG.ANON_KEY) {
        console.error('❌ 缺少 SUPABASE_CONFIG 配置。');
        return null;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
    return supabaseClient;
}

function getPlacesTableName() {
    return (SUPABASE_CONFIG && SUPABASE_CONFIG.TABLE) || 'places';
}

async function initStorageModule() {
    const client = ensureSupabaseClient();
    if (!client) {
        collectionCache = [];
        return;
    }
    await reloadCollectionShared();
}

async function reloadCollectionShared() {
    const client = ensureSupabaseClient();
    if (!client) {
        collectionCache = [];
        if (typeof hideAllMarkers === 'function') hideAllMarkers();
        if (typeof refreshCollectionUI === 'function') refreshCollectionUI();
        return;
    }
    try {
        const { data, error } = await client
            .from(getPlacesTableName())
            .select('*');
        if (error) {
            console.error('❌ 拉取 Supabase 收藏失败：', error);
            handleStorageError(error);
            collectionCache = [];
            if (typeof refreshCollectionUI === 'function') refreshCollectionUI();
            return;
        }
        collectionCache = Array.isArray(data) ? data.map(normalizePlaceRecord) : [];
    } catch (error) {
        console.error('❌ 初始化收藏缓存失败：', error);
        handleStorageError(error);
        collectionCache = [];
    }
    if (typeof refreshCollectionUI === 'function') refreshCollectionUI();
}

function handleStorageError(error) {
    if (!error) return;
    const code = String(error.code || '');
    if (code === 'PGRST205') {
        const msg = '数据库表未创建';
        if (typeof showMapLoadError === 'function') {
            showMapLoadError(msg);
        }
        const tree = document.getElementById('collection-tree');
        if (tree) {
            tree.innerHTML = `<div class="collection-empty">${msg}</div>`;
        }
    }
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

function findCollectionIndex(list, item) {
    const key = buildUniqueKey(item);
    return list.findIndex((record) => buildUniqueKey(record) === key);
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
    upsertPlaceToSupabase(normalized).catch((error) => {
        console.error('❌ Supabase 保存失败：', error);
    });
    return { ok: true, reason: 'created', item: normalized };
}

function removeFromCollection(item) {
    const list = collectionCache.slice();
    const idx = findCollectionIndex(list, item);
    if (idx < 0) return;
    const removed = list[idx];
    list.splice(idx, 1);
    collectionCache = list;
    removePlaceFromSupabase(removed).catch((error) => {
        console.error('❌ Supabase 删除失败：', error);
    });
}

async function upsertPlaceToSupabase(item) {
    const client = ensureSupabaseClient();
    if (!client) return;
    try {
        const table = getPlacesTableName();
        const payload = {
            name: item.name,
            lng: Number(item.lng),
            lat: Number(item.lat),
            category: item.category || '我的私藏',
            address: item.address || '',
            province: item.province || '',
            city: item.city || '',
            remark: item.remark || ''
        };

        const { data: existed, error: queryErr } = await client
            .from(table)
            .select('id')
            .eq('name', item.name)
            .eq('lng', Number(item.lng))
            .eq('lat', Number(item.lat))
            .limit(1)
            .maybeSingle();
        if (queryErr) {
            console.error('❌ Supabase 查询失败：', queryErr);
            handleStorageError(queryErr);
            return;
        }

        if (existed && existed.id != null) {
            const { error: updateErr } = await client
                .from(table)
                .update(payload)
                .eq('id', existed.id);
            if (updateErr) {
                console.error('❌ Supabase 更新失败：', updateErr);
                handleStorageError(updateErr);
            }
            return;
        }

        const { error: insertErr } = await client
            .from(table)
            .insert(payload)
            .select('id')
            .maybeSingle();
        if (insertErr) {
            console.error('❌ Supabase 新增失败：', insertErr);
            handleStorageError(insertErr);
        }
    } catch (error) {
        console.error('❌ Supabase 保存异常：', error);
        handleStorageError(error);
    }
}

async function removePlaceFromSupabase(item) {
    const client = ensureSupabaseClient();
    if (!client) return;
    try {
        const table = getPlacesTableName();
        if (item.id != null && String(item.id).length > 0) {
            const { error } = await client
                .from(table)
                .delete()
                .eq('id', String(item.id));
            if (error) {
                console.error('❌ Supabase 删除失败：', error);
                handleStorageError(error);
            }
            return;
        }
        const { error } = await client
            .from(table)
            .delete()
            .eq('name', item.name)
            .eq('lng', Number(item.lng))
            .eq('lat', Number(item.lat));
        if (error) {
            console.error('❌ Supabase 删除失败：', error);
            handleStorageError(error);
        }
    } catch (error) {
        console.error('❌ Supabase 删除异常：', error);
        handleStorageError(error);
    }
}
