import { SUPABASE_CONFIG } from "../../lib/supabase";

function buildHeaders(accessToken) {
    return {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: `Bearer ${accessToken || SUPABASE_CONFIG.anonKey}`
    };
}

export function fetchFoodNodes(accessToken) {
    return new Promise((resolve, reject) => {
        if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
            reject(new Error("缺少 Supabase 配置，请先填写 lib/supabase.js"));
            return;
        }
        uni.request({
            url: `${SUPABASE_CONFIG.url}/rest/v1/food_nodes?select=id,name,lng,lat,address,category,updated_at&order=updated_at.desc.nullslast`,
            method: "GET",
            header: buildHeaders(accessToken),
            success: (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(Array.isArray(res.data) ? res.data : []);
                } else {
                    reject(new Error(`food_nodes 请求失败: ${res.statusCode}`));
                }
            },
            fail: (err) => reject(err)
        });
    });
}
