// Supabase 凭证配置（双端共用）
const rawUrl = "https://yyjcwldberdlcrdwhyuo.supabase.co/rest/v1/";

function normalizeProjectUrl(url) {
    const clean = String(url || "").trim().replace(/\/+$/, "");
    return clean.endsWith("/rest/v1") ? clean.slice(0, -8) : clean;
}

export const SUPABASE_CONFIG = {
    // 统一保存项目根 URL，服务层再拼接 /rest/v1
    url: normalizeProjectUrl(rawUrl),
    anonKey: "sb_publishable_7uJIM9rpIhD9-31p58MM8A_uvqxHf45",
    authStorageKey: "food_supabase_session_v1",
    realtimePollMs: 3000,
    // 小程序微信登录桥接服务（code -> custom token / session），后续部署后填写
    wechatBridgeUrl: ""
};
