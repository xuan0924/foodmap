// js/supabase-sync.js — H5 版本的 Supabase 拉取同步
(function () {
    let timer = null;
    let lastDigest = "";

    function getConfig() {
        const cfg = window.SUPABASE_CONFIG || {};
        const url = String(cfg.url || "").replace(/\/+$/, "");
        const anonKey = String(cfg.anonKey || "");
        const pollMs = Math.max(3000, Number(cfg.pollMs) || 8000);
        return { url, anonKey, pollMs };
    }

    function rowToFoodItem(row) {
        return {
            id: row.id,
            name: row.name || "未命名",
            lng: Number(row.lng),
            lat: Number(row.lat),
            address: row.address || "",
            category: row.category || "我的私藏"
        };
    }

    function upsertIntoLocal(rows) {
        const activeGroupId =
            window.GroupManager && typeof window.GroupManager.getActiveGroupId === "function"
                ? window.GroupManager.getActiveGroupId() || "solo_local"
                : "solo_local";

        rows.forEach((row) => {
            const item = rowToFoodItem(row);
            if (!Number.isFinite(item.lng) || !Number.isFinite(item.lat)) return;
            const targetGroupId = String(row.group_id || activeGroupId).trim() || activeGroupId;
            if (typeof saveToCollectionByGroupId === "function") {
                saveToCollectionByGroupId(targetGroupId, item);
            } else if (typeof saveToCollection === "function") {
                saveToCollection(item);
            }
        });
    }

    async function pullOnce() {
        const { url, anonKey } = getConfig();
        if (!url || !anonKey) return;

        const endpoint = `${url}/rest/v1/food_nodes?select=id,name,lng,lat,address,category,group_id,updated_at&order=updated_at.desc.nullslast`;
        const res = await fetch(endpoint, {
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`
            }
        });
        if (!res.ok) throw new Error(`supabase status ${res.status}`);
        const rows = await res.json();
        const digest = JSON.stringify((rows || []).map((r) => [r.id, r.updated_at || ""]));
        if (digest === lastDigest) return;
        lastDigest = digest;

        upsertIntoLocal(Array.isArray(rows) ? rows : []);
        if (typeof refreshCollectionUI === "function") {
            refreshCollectionUI();
        }
    }

    function start() {
        const { url, anonKey, pollMs } = getConfig();
        if (!url || !anonKey) {
            console.warn("⚠️ 未配置 SUPABASE_CONFIG，跳过远程同步。");
            return;
        }
        stop();
        pullOnce().catch((err) => console.warn("supabase sync failed:", err));
        timer = setInterval(() => {
            pullOnce().catch((err) => console.warn("supabase sync failed:", err));
        }, pollMs);
    }

    function stop() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    window.SupabaseSync = {
        start,
        stop,
        pullOnce
    };
})();
