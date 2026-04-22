import { SUPABASE_CONFIG } from "../../lib/supabase";

function authHeaders(token) {
    const headers = {
        apikey: SUPABASE_CONFIG.anonKey
    };
    headers.Authorization = `Bearer ${token || SUPABASE_CONFIG.anonKey}`;
    return headers;
}

function saveSession(session) {
    uni.setStorageSync(SUPABASE_CONFIG.authStorageKey, session || null);
}

export function getStoredSession() {
    const session = uni.getStorageSync(SUPABASE_CONFIG.authStorageKey);
    if (!session || !session.access_token) return null;
    return session;
}

export function clearSession() {
    uni.removeStorageSync(SUPABASE_CONFIG.authStorageKey);
}

export function isSessionValid(session) {
    if (!session || !session.access_token) return false;
    if (!session.expires_at) return true;
    return Date.now() < Number(session.expires_at) * 1000;
}

export function sendPhoneOtp(phone) {
    return new Promise((resolve, reject) => {
        uni.request({
            url: `${SUPABASE_CONFIG.url}/auth/v1/otp`,
            method: "POST",
            header: authHeaders(),
            data: {
                phone,
                create_user: true
            },
            success: (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data || {});
                else reject(new Error(`OTP 发送失败: ${res.statusCode}`));
            },
            fail: reject
        });
    });
}

export function verifyPhoneOtp(phone, code) {
    return new Promise((resolve, reject) => {
        uni.request({
            url: `${SUPABASE_CONFIG.url}/auth/v1/verify`,
            method: "POST",
            header: authHeaders(),
            data: {
                phone,
                token: code,
                type: "sms"
            },
            success: (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.access_token) {
                    saveSession(res.data);
                    resolve(res.data);
                } else {
                    reject(new Error(`验证码校验失败: ${res.statusCode}`));
                }
            },
            fail: reject
        });
    });
}

export function fetchCurrentUser(session) {
    return new Promise((resolve, reject) => {
        if (!session || !session.access_token) {
            reject(new Error("无有效会话"));
            return;
        }
        uni.request({
            url: `${SUPABASE_CONFIG.url}/auth/v1/user`,
            method: "GET",
            header: authHeaders(session.access_token),
            success: (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data || null);
                else reject(new Error(`用户信息读取失败: ${res.statusCode}`));
            },
            fail: reject
        });
    });
}

export function signOut() {
    clearSession();
}

export function signInWithWeChatCode(wxCode) {
    return new Promise((resolve, reject) => {
        if (!SUPABASE_CONFIG.wechatBridgeUrl) {
            reject(new Error("未配置 wechatBridgeUrl，无法进行小程序微信登录"));
            return;
        }
        uni.request({
            url: SUPABASE_CONFIG.wechatBridgeUrl,
            method: "POST",
            data: {
                code: wxCode
            },
            success: (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.access_token) {
                    saveSession(res.data);
                    resolve(res.data);
                } else {
                    reject(new Error(`微信登录桥接失败: ${res.statusCode}`));
                }
            },
            fail: reject
        });
    });
}
