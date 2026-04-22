<template>
    <view class="page-root">
        <view class="ambient-blobs">
            <view class="ambient-blob blob-a"></view>
            <view class="ambient-blob blob-b"></view>
        </view>

        <view class="topbar glass-card">
            <view class="topbar-meta">
                <text class="title cream-title">吃货同步协议</text>
                <text class="subtitle">{{ loginSubtitle }}</text>
            </view>
            <view class="topbar-actions">
                <button class="topbar-icon-btn avatar-btn" @click="toggleLoginPanel">
                    <text class="topbar-icon">👤</text>
                </button>
                <button class="topbar-icon-btn palette-btn" @click="toggleThemePanel">
                    <text class="topbar-icon">🎨</text>
                </button>
            </view>
            <view v-if="showThemePanel" class="theme-panel glass-card">
                <view class="theme-row">
                    <button
                        v-for="theme in themePresets"
                        :key="theme.id"
                        class="theme-dot"
                        :style="{ background: theme.bg, borderColor: activeTheme === theme.id ? theme.primary : '#fff' }"
                        @click="applyTheme(theme)"
                    />
                </view>
            </view>
        </view>

        <!-- #ifdef H5 -->
        <view id="amap-container" class="map-layer"></view>
        <!-- #endif -->

        <!-- #ifdef MP-WEIXIN -->
        <map
            id="mp-map"
            class="map-layer"
            :latitude="mpCenter.latitude"
            :longitude="mpCenter.longitude"
            :scale="mpScale"
            :markers="mpMarkers"
            :show-location="false"
        />
        <!-- #endif -->

        <view v-if="showLoginPanel" class="login-overlay" @click.self="showLoginPanel = false">
            <view class="login-card glass-card">
                <text class="login-title cream-title">{{ isLoggedIn ? "账户管理" : "微信登录" }}</text>
                <text class="login-desc" v-if="isLoggedIn">已登录，可继续同步节点。</text>

                <template v-if="!isLoggedIn">
                    <!-- #ifdef H5 -->
                    <text class="login-desc">请使用微信扫码登录</text>
                    <image
                        v-if="wechatQrImage"
                        :src="wechatQrImage"
                        mode="aspectFit"
                        class="qr-image"
                    />
                    <text class="login-tip" v-if="!wechatBridgeReady">
                        请先在 lib/supabase.js 配置 wechatBridgeUrl
                    </text>
                    <button class="login-btn" @click="handleWechatLogin">打开扫码页</button>
                    <!-- #endif -->

                    <!-- #ifdef MP-WEIXIN -->
                    <text class="login-desc">授权后即可同步小组节点</text>
                    <button class="login-btn" @click="handleWechatLogin">微信一键登录</button>
                    <!-- #endif -->
                </template>

                <button v-if="isLoggedIn" class="logout-btn panel-logout-btn" @click="handleLogout">退出登录</button>
            </view>
        </view>

        <view class="bottom-card glass-card">
            <text class="nodes-text">当前节点数：{{ nodes.length }}</text>
            <button class="refresh-btn" @click="loadNodes">刷新节点</button>
            <button v-if="isLoggedIn" class="logout-btn" @click="handleLogout">退出</button>
        </view>
    </view>
</template>

<script>
import { MAP_CONFIG } from "@/config/map";
import { fetchFoodNodes } from "@/services/foodNodes.service";
import { SUPABASE_CONFIG } from "@/config/supabase";
import {
    getStoredSession,
    isSessionValid,
    signOut,
    signInWithWeChatCode
} from "@/services/auth.service";
import { startFoodNodesSync, stopFoodNodesSync } from "@/services/realtime.service";

export default {
    data() {
        return {
            nodes: [],
            mpCenter: {
                latitude: MAP_CONFIG.center[1],
                longitude: MAP_CONFIG.center[0]
            },
            mpScale: MAP_CONFIG.zoom,
            mpMarkers: [],
            h5Map: null,
            h5Markers: [],
            session: null,
            showLoginPanel: false,
            showThemePanel: false,
            activeTheme: "cream",
            themePresets: [
                { id: "cream", bg: "#FDF6EC", primary: "#1A73E8", border: "#9AB8E6" },
                { id: "mint", bg: "#F3F8EE", primary: "#2E7D32", border: "#8FCF8A" },
                { id: "lavender", bg: "#F4F1FB", primary: "#5E35B1", border: "#B59DE5" },
                { id: "sunset", bg: "#FFF2E8", primary: "#EF6C00", border: "#F1AA6B" }
            ]
        };
    },
    computed: {
        isLoggedIn() {
            return !!(this.session && this.session.access_token);
        },
        loginSubtitle() {
            return this.isLoggedIn
                ? "已登录 · 实时同步中"
                : "未登录 · 点击右上角头像";
        },
        wechatBridgeReady() {
            return !!SUPABASE_CONFIG.wechatBridgeUrl;
        },
        wechatQrImage() {
            if (!this.wechatBridgeReady) return "";
            // 使用在线二维码服务，仅 H5 展示扫码入口
            return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                SUPABASE_CONFIG.wechatBridgeUrl
            )}`;
        }
    },
    onLoad() {
        this.restoreTheme();
        this.tryRestoreSession();
    },
    async onReady() {
        // #ifdef H5
        await this.initAmapH5();
        this.renderH5Markers();
        // #endif
    },
    onUnload() {
        stopFoodNodesSync();
    },
    methods: {
        toggleLoginPanel() {
            this.showLoginPanel = !this.showLoginPanel;
            this.showThemePanel = false;
        },
        toggleThemePanel() {
            this.showThemePanel = !this.showThemePanel;
            if (this.showThemePanel) this.showLoginPanel = false;
        },
        applyTheme(theme) {
            if (!theme) return;
            const root = typeof document !== "undefined" && document.documentElement
                ? document.documentElement
                : null;
            if (root) {
                root.style.setProperty("--app-bg-color", theme.bg);
                root.style.setProperty("--protocol-bg", theme.bg);
                root.style.setProperty("--theme-primary", theme.primary);
                root.style.setProperty("--protocol-accent", theme.primary);
                root.style.setProperty("--theme-border", theme.border);
            }
            this.activeTheme = theme.id;
            uni.setStorageSync("food_theme_uni_v1", theme.id);
            this.showThemePanel = false;
        },
        restoreTheme() {
            const key = uni.getStorageSync("food_theme_uni_v1");
            const target = this.themePresets.find((it) => it.id === key) || this.themePresets[0];
            this.applyTheme(target);
        },
        tryRestoreSession() {
            const stored = getStoredSession();
            if (stored && isSessionValid(stored)) {
                this.session = stored;
                this.loadNodes();
                this.startSync();
            }
        },
        async handleWechatLogin() {
            try {
                // #ifdef H5
                if (!this.wechatBridgeReady) {
                    uni.showToast({
                        title: "未配置扫码登录地址",
                        icon: "none"
                    });
                    return;
                }
                window.open(SUPABASE_CONFIG.wechatBridgeUrl, "_blank", "noopener,noreferrer");
                return;
                // #endif

                // #ifdef MP-WEIXIN
                const wxLogin = await new Promise((resolve, reject) => {
                    uni.login({
                        provider: "weixin",
                        success: resolve,
                        fail: reject
                    });
                });
                if (!wxLogin || !wxLogin.code) throw new Error("未获取到微信 code");
                const session = await signInWithWeChatCode(wxLogin.code);
                this.session = session;
                uni.showToast({ title: "微信登录成功", icon: "none" });
                this.showLoginPanel = false;
                await this.loadNodes();
                this.startSync();
                // #endif
            } catch (err) {
                uni.showToast({ title: "微信登录失败", icon: "none" });
                console.error(err);
            }
        },
        handleLogout() {
            signOut();
            stopFoodNodesSync();
            this.session = null;
            this.nodes = [];
            this.mpMarkers = [];
            this.renderH5Markers();
            this.showLoginPanel = false;
        },
        startSync() {
            if (!this.session || !this.session.access_token) return;
            startFoodNodesSync({
                accessToken: this.session.access_token,
                onChange: (rows) => {
                    this.applyRows(rows);
                },
                onError: (err) => {
                    console.error("sync error", err);
                }
            });
        },
        applyRows(rows) {
            this.nodes = (rows || []).map((it) => ({
                id: it.id,
                name: it.name || "未命名",
                lng: Number(it.lng),
                lat: Number(it.lat),
                address: it.address || ""
            }));
            this.renderMpMarkers();
            // #ifdef H5
            this.renderH5Markers();
            // #endif
        },
        async loadNodes() {
            if (!this.session || !this.session.access_token) return;
            try {
                const rows = await fetchFoodNodes(this.session.access_token);
                this.applyRows(rows);
            } catch (err) {
                uni.showToast({
                    title: "节点读取失败",
                    icon: "none"
                });
                console.error(err);
            }
        },
        renderMpMarkers() {
            this.mpMarkers = this.nodes
                .filter((n) => Number.isFinite(n.lng) && Number.isFinite(n.lat))
                .map((n) => ({
                    id: Number(n.id) || Date.now(),
                    latitude: n.lat,
                    longitude: n.lng,
                    width: 24,
                    height: 24,
                    callout: {
                        content: n.name,
                        color: "#202124",
                        bgColor: "#ffffff",
                        borderRadius: 8,
                        padding: 6,
                        display: "BYCLICK"
                    }
                }));
        },
        async initAmapH5() {
            if (typeof window === "undefined" || this.h5Map) return;
            if (!window.AMap) {
                await new Promise((resolve, reject) => {
                    window._AMapSecurityConfig = {
                        securityJsCode: MAP_CONFIG.amapSecurityCode
                    };
                    const script = document.createElement("script");
                    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(
                        MAP_CONFIG.amapKey
                    )}`;
                    script.async = true;
                    script.onload = resolve;
                    script.onerror = () => reject(new Error("高德脚本加载失败"));
                    document.head.appendChild(script);
                });
            }
            this.h5Map = new window.AMap.Map("amap-container", {
                center: MAP_CONFIG.center,
                zoom: MAP_CONFIG.zoom,
                viewMode: "2D",
                mapStyle: "amap://styles/whitesmoke"
            });
        },
        renderH5Markers() {
            if (!this.h5Map || typeof window === "undefined" || !window.AMap) return;
            this.h5Markers.forEach((m) => m.setMap(null));
            this.h5Markers = [];

            this.nodes
                .filter((n) => Number.isFinite(n.lng) && Number.isFinite(n.lat))
                .forEach((n) => {
                    const marker = new window.AMap.Marker({
                        position: [n.lng, n.lat],
                        anchor: "bottom-center",
                        content: `<div style="width:36px;height:36px;border-radius:999px;background:#fff;border:2px solid rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(52,77,116,.22);font-size:19px;">🍽️</div>`
                    });
                    marker.setMap(this.h5Map);
                    this.h5Markers.push(marker);
                });
        }
    }
};
</script>

<style scoped>
.page-root {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
}

.map-layer {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
}

.ambient-blobs {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 2;
}

.ambient-blob {
    position: absolute;
    border-radius: 9999rpx;
    filter: blur(80rpx);
    opacity: 0.6;
}

.blob-a {
    width: 520rpx;
    height: 520rpx;
    left: -140rpx;
    top: -90rpx;
    background: radial-gradient(circle at 35% 35%, rgba(79, 141, 245, 0.35), rgba(79, 141, 245, 0));
}

.blob-b {
    width: 600rpx;
    height: 600rpx;
    right: -160rpx;
    bottom: -190rpx;
    background: radial-gradient(circle at 55% 40%, rgba(138, 180, 248, 0.35), rgba(138, 180, 248, 0));
}

.topbar {
    position: fixed;
    top: 24rpx;
    left: 20rpx;
    right: 20rpx;
    z-index: 20;
    padding: 20rpx 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.topbar-meta {
    min-width: 0;
}

.topbar-actions {
    display: flex;
    align-items: center;
    gap: 12rpx;
}

.topbar-icon-btn {
    width: 64rpx;
    height: 64rpx;
    border-radius: 999rpx;
    border: 1px solid rgba(154, 184, 230, 0.6);
    background: rgba(255, 255, 255, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
}

.topbar-icon {
    font-size: 30rpx;
    line-height: 1;
}

.theme-panel {
    position: absolute;
    right: 24rpx;
    top: calc(100% + 10rpx);
    padding: 14rpx;
    z-index: 35;
}

.theme-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
}

.theme-dot {
    width: 34rpx;
    height: 34rpx;
    border-radius: 999rpx;
    border: 3rpx solid #fff;
    padding: 0;
}

.title {
    display: block;
    font-size: 34rpx;
}

.subtitle {
    margin-top: 6rpx;
    display: block;
    font-size: 24rpx;
    color: var(--gem-text-secondary);
}

.bottom-card {
    position: fixed;
    left: 20rpx;
    right: 20rpx;
    bottom: calc(20rpx + env(safe-area-inset-bottom));
    z-index: 20;
    padding: 20rpx 24rpx;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 14rpx;
}

.nodes-text {
    font-size: 26rpx;
    color: var(--gem-text);
}

.refresh-btn {
    border: none;
    border-radius: 999rpx;
    padding: 0 28rpx;
    height: 64rpx;
    line-height: 64rpx;
    font-size: 24rpx;
    background: rgba(26, 115, 232, 0.14);
    color: var(--protocol-accent);
}

.logout-btn {
    border: none;
    border-radius: 999rpx;
    height: 64rpx;
    line-height: 64rpx;
    font-size: 24rpx;
    padding: 0 24rpx;
    background: rgba(95, 99, 104, 0.12);
    color: var(--gem-text-secondary);
}

.login-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24rpx;
    background: rgba(32, 33, 36, 0.2);
}

.login-card {
    width: 100%;
    max-width: 640rpx;
    padding: 28rpx;
}

.login-title {
    font-size: 32rpx;
    margin-bottom: 18rpx;
    display: block;
}

.login-desc {
    display: block;
    margin-bottom: 14rpx;
    color: var(--gem-text-secondary);
    font-size: 24rpx;
}

.login-tip {
    display: block;
    margin-bottom: 10rpx;
    color: #9c3f3f;
    font-size: 22rpx;
}

.qr-image {
    width: 320rpx;
    height: 320rpx;
    margin: 10rpx auto 16rpx;
    border-radius: 18rpx;
    background: #fff;
}

.login-btn {
    margin-top: 16rpx;
    height: 80rpx;
    line-height: 80rpx;
    border-radius: 20rpx;
    border: none;
    font-size: 28rpx;
    background: var(--protocol-accent);
    color: #fff;
}

.panel-logout-btn {
    margin-top: 10rpx;
}
</style>
