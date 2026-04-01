// js/storage.js — 收藏数据：Supabase + 多用户鉴权（按 user_id 隔离）

const CITY_FILTER_ALL = '__ALL__';
let collectionCache = [];
let supabaseClient = null;
let currentAuthUser = null;
const authStateListeners = [];

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

function isAuthenticated() {
    return !!(currentAuthUser && currentAuthUser.id);
}

function getCurrentAuthUser() {
    return currentAuthUser;
}

function registerAuthStateListener(listener) {
    if (typeof listener === 'function') {
        authStateListeners.push(listener);
    }
}

function notifyAuthStateChanged() {
    authStateListeners.forEach((fn) => {
        try {
            fn(currentAuthUser);
        } catch (error) {
            console.error('auth listener error', error);
        }
    });
}

async function initStorageModule() {
    const client = ensureSupabaseClient();
    if (!client) {
        collectionCache = [];
        return;
    }
    await syncAuthUserFromSession();
    bindSupabaseAuthEvents();
    await reloadCollectionForCurrentUser();
    notifyAuthStateChanged();
}

function bindSupabaseAuthEvents() {
    const client = ensureSupabaseClient();
    if (!client || bindSupabaseAuthEvents._bound) return;
    bindSupabaseAuthEvents._bound = true;
    client.auth.onAuthStateChange(async function (_event, session) {
        currentAuthUser = session && session.user ? session.user : null;
        await reloadCollectionForCurrentUser();
        notifyAuthStateChanged();
    });
}

async function syncAuthUserFromSession() {
    const client = ensureSupabaseClient();
    if (!client) {
        currentAuthUser = null;
        return;
    }
    try {
        const { data, error } = await client.auth.getUser();
        if (error) {
            console.warn('⚠️ 获取当前登录用户失败：', error);
            currentAuthUser = null;
            return;
        }
        currentAuthUser = data && data.user ? data.user : null;
    } catch (error) {
        console.error('❌ 初始化登录状态失败：', error);
        currentAuthUser = null;
    }
}

async function reloadCollectionForCurrentUser() {
    const client = ensureSupabaseClient();
    if (!client || !isAuthenticated()) {
        collectionCache = [];
        if (typeof hideAllMarkers === 'function') hideAllMarkers();
        if (typeof refreshCollectionUI === 'function') refreshCollectionUI();
        return;
    }
    try {
        const { data, error } = await client
            .from(getPlacesTableName())
            .select('*')
            .eq('user_id', currentAuthUser.id);
        if (error) {
            console.error('❌ 拉取 Supabase 收藏失败：', error);
            collectionCache = [];
            return;
        }
        collectionCache = Array.isArray(data) ? data.map(normalizePlaceRecord) : [];
    } catch (error) {
        console.error('❌ 初始化收藏缓存失败：', error);
        collectionCache = [];
    }
    if (typeof refreshCollectionUI === 'function') refreshCollectionUI();
}

async function loginWithPassword(email, password) {
    const client = ensureSupabaseClient();
    if (!client) throw new Error('Supabase client 不可用');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
}

async function signUpWithPassword(email, password, options) {
    const client = ensureSupabaseClient();
    if (!client) throw new Error('Supabase client 不可用');
    const payload = { email, password };
    if (options && typeof options === 'object') {
        payload.options = options;
    }
    const { error } = await client.auth.signUp(payload);
    if (error) throw error;
}

async function loginWithMagicLink(email) {
    const client = ensureSupabaseClient();
    if (!client) throw new Error('Supabase client 不可用');
    const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href }
    });
    if (error) throw error;
}

async function logoutAuthUser() {
    const client = ensureSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
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
    if (!isAuthenticated()) {
        console.warn('⚠️ 未登录，已阻止收纳。');
        return;
    }
    const normalized = normalizePlaceRecord(item);
    const list = collectionCache.slice();
    const idx = findCollectionIndex(list, normalized);
    if (idx >= 0) {
        list[idx] = { ...list[idx], ...normalized };
    } else {
        list.push(normalized);
    }
    collectionCache = list;
    upsertPlaceToSupabase(normalized).catch((error) => {
        console.error('❌ Supabase 保存失败：', error);
    });
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
    if (!client || !isAuthenticated()) return;

    const table = getPlacesTableName();
    const payload = {
        user_id: currentAuthUser.id,
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
        .eq('user_id', currentAuthUser.id)
        .eq('name', item.name)
        .eq('lng', Number(item.lng))
        .eq('lat', Number(item.lat))
        .limit(1)
        .maybeSingle();
    if (queryErr) throw queryErr;

    if (existed && existed.id != null) {
        const { error: updateErr } = await client
            .from(table)
            .update(payload)
            .eq('id', existed.id)
            .eq('user_id', currentAuthUser.id);
        if (updateErr) throw updateErr;
        return;
    }

    const { error: insertErr } = await client
        .from(table)
        .insert(payload)
        .select('id')
        .maybeSingle();
    if (insertErr) throw insertErr;
}

async function removePlaceFromSupabase(item) {
    const client = ensureSupabaseClient();
    if (!client || !isAuthenticated()) return;
    const table = getPlacesTableName();
    if (item.id != null && String(item.id).length > 0) {
        const { error } = await client
            .from(table)
            .delete()
            .eq('id', String(item.id))
            .eq('user_id', currentAuthUser.id);
        if (error) throw error;
        return;
    }
    const { error } = await client
        .from(table)
        .delete()
        .eq('user_id', currentAuthUser.id)
        .eq('name', item.name)
        .eq('lng', Number(item.lng))
        .eq('lat', Number(item.lat));
    if (error) throw error;
}
