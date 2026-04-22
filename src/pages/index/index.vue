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
            <view class="topbar-actions glass-card">
                <button class="topbar-icon-btn sidebar-btn" @click="toggleSidebar">
                    <text class="topbar-icon">☰</text>
                </button>
                <button class="topbar-icon-btn avatar-btn" @click="toggleLoginPanel">
                    <text class="topbar-icon">👤</text>
                </button>
            </view>
        </view>

        <view class="search-float">
            <view class="search-capsule glass-card">
                <input
                    v-model="searchKeyword"
                    class="search-input"
                    placeholder="搜索小组或节点名称"
                    confirm-type="search"
                />
                <text class="search-icon">🔍</text>
            </view>
        </view>

        <view v-if="showSidebar" class="sidebar-overlay" @click.self="showSidebar = false">
            <view class="sidebar-panel gem-side-panel">
                <view class="sidebar-head">
                    <text class="sidebar-title cream-title">小组切换</text>
                    <button class="sidebar-close" @click="showSidebar = false">✕</button>
                </view>
                <scroll-view scroll-y class="sidebar-list">
                    <view
                        v-for="group in joinedGroups"
                        :key="group.id"
                        class="sidebar-item"
                        :class="{ 'is-active': activeGroupId === group.id }"
                        @click="switchGroup(group.id)"
                    >
                        <text class="sidebar-item-name">{{ group.name }}</text>
                        <text class="sidebar-item-sub">{{ group.count }} 个节点</text>
                    </view>
                </scroll-view>
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
            showSidebar: false,
            activeGroupId: "all",
            searchKeyword: ""
        };
    },
    computed: {
        isLoggedIn() {
            return !!(this.session && this.session.access_token);
        },
        loginSubtitle() {
            return this.isLoggedIn
                ? "已登录 · 实时同步中"
                : "访客模式 · 点击右上角头像登录";
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
        },
        joinedGroups() {
            const counter = new Map();
            this.nodes.forEach((n) => {
                const key = (n.group || "默认小组").trim();
                counter.set(key, (counter.get(key) || 0) + 1);
            });
            return [
                { id: "all", name: "全部小组", count: this.nodes.length },
                ...Array.from(counter.entries()).map(([name, count]) => ({
                    id: name,
                    name,
                    count
                }))
            ];
        },
        filteredNodes() {
            const keyword = (this.searchKeyword || "").trim().toLowerCase();
            return this.nodes.filter((n) => {
                const inGroup = this.activeGroupId === "all" || n.group === this.activeGroupId;
                if (!inGroup) return false;
                if (!keyword) return true;
                return [n.name, n.address, n.group].some((v) => (v || "").toLowerCase().includes(keyword));
            });
        }
    },
    watch: {
        searchKeyword() {
            this.renderMpMarkers();
            // #ifdef H5
            this.renderH5Markers();
            // #endif
        }
    },
    onLoad() {
        this.applyTheme();
        this.tryRestoreSession();
        this.loadNodes();
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
        },
        toggleSidebar() {
            this.showSidebar = !this.showSidebar;
        },
        switchGroup(groupId) {
            this.activeGroupId = groupId || "all";
            this.showSidebar = false;
            this.renderMpMarkers();
            // #ifdef H5
            this.renderH5Markers();
            // #endif
            const first = this.filteredNodes.find((it) => Number.isFinite(it.lng) && Number.isFinite(it.lat));
            if (!first) return;
            // #ifdef H5
            if (this.h5Map) {
                this.h5Map.setCenter([first.lng, first.lat]);
            }
            // #endif
            // #ifdef MP-WEIXIN
            this.mpCenter = { latitude: first.lat, longitude: first.lng };
            // #endif
        },
        applyTheme() {
            const root = typeof document !== "undefined" && document.documentElement
                ? document.documentElement
                : null;
            if (root) {
                root.style.setProperty("--app-bg-color", "#FFF9F0");
                root.style.setProperty("--protocol-bg", "#FFF9F0");
                root.style.setProperty("--theme-primary", "#FF8D42");
                root.style.setProperty("--protocol-accent", "#FF8D42");
                root.style.setProperty("--theme-border", "#F5BC94");
            }
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
            this.activeGroupId = "all";
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
                address: it.address || "",
                group: it.category || "默认小组"
            }));
            this.renderMpMarkers();
            // #ifdef H5
            this.renderH5Markers();
            // #endif
        },
        async loadNodes() {
            try {
                const token = this.session && this.session.access_token ? this.session.access_token : "";
                const rows = await fetchFoodNodes(token);
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
            this.mpMarkers = this.filteredNodes
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

            this.filteredNodes
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
.page-root,
.topbar,
.login-card,
.sidebar-panel,
.topbar-icon-btn,
.login-btn {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.page-root {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    --bg-apricot: #FFF9F0;
    --accent-orange: #FF8D42;
    --node-green: #A8D5BA;
    --node-blue: #92A8D1;
    --text-deep: #3D3D3D;
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
    padding: 18rpx 20rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 249, 240, 0.8);
}

.topbar-meta {
    min-width: 0;
}

.topbar-actions {
    display: flex;
    align-items: center;
    gap: 4rpx;
    padding: 4rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.58);
}

.topbar-icon-btn {
    width: 64rpx;
    height: 64rpx;
    border-radius: 999rpx;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
}

.topbar-icon {
    font-size: 30rpx;
    line-height: 1;
    color: #FF8D42;
}

.search-float {
    position: fixed;
    top: 132rpx;
    left: 20rpx;
    right: 20rpx;
    z-index: 22;
}

.search-capsule {
    height: 84rpx;
    border-radius: 32px;
    background: rgba(255, 249, 240, 0.8);
    padding: 0 20rpx;
    display: flex;
    align-items: center;
    gap: 12rpx;
}

.search-input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--text-deep);
    font-size: 28rpx;
}

.search-icon {
    font-size: 30rpx;
    color: #FF8D42;
}

.title {
    display: block;
    font-size: 34rpx;
}

.subtitle {
    margin-top: 6rpx;
    display: block;
    font-size: 24rpx;
    color: var(--text-deep);
}

.sidebar-overlay {
    position: fixed;
    inset: 0;
    z-index: 250;
    top: 0;
    background: rgba(32, 33, 36, 0.12);
}

.sidebar-panel {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 70vw;
    padding: 0;
    background: rgba(255, 249, 240, 0.46);
    color: var(--text-deep);
    transform: translateX(-100%);
    box-shadow: 8rpx 0 36rpx rgba(80, 92, 110, 0.16);
    animation: sidebar-in 220ms ease-out forwards;
}

.gem-side-panel {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}

@keyframes sidebar-in {
    from {
        transform: translateX(-100%);
    }
    to {
        transform: translateX(0);
    }
}

.sidebar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22rpx 16rpx 22rpx 26rpx;
    background: rgba(255, 141, 66, 0.12);
}

.sidebar-close {
    width: 56rpx;
    height: 56rpx;
    border-radius: 999rpx;
    border: none;
    background: transparent;
    color: var(--text-deep);
    font-size: 28rpx;
    line-height: 56rpx;
    padding: 0;
}

.sidebar-title {
    display: block;
    font-size: 28rpx;
    letter-spacing: 0.1em;
}

.sidebar-list {
    height: calc(100% - 100rpx);
    padding: 10rpx 10rpx 24rpx;
}

.sidebar-item {
    padding: 18rpx 18rpx;
    border-radius: 22rpx;
    margin-bottom: 12rpx;
    background: rgba(255, 255, 255, 0.9);
    color: var(--text-deep);
    box-shadow: 0 2rpx 8rpx rgba(60, 64, 67, 0.08);
}

.sidebar-item.is-active {
    background: linear-gradient(180deg, rgba(255, 141, 66, 0.16), rgba(255, 141, 66, 0.28));
    color: var(--text-deep);
}

.sidebar-item-name {
    display: block;
    font-size: 26rpx;
}

.sidebar-item-sub {
    display: block;
    margin-top: 6rpx;
    font-size: 22rpx;
    color: rgba(61, 61, 61, 0.7);
}

.logout-btn {
    border: none;
    border-radius: 28rpx;
    height: 64rpx;
    line-height: 64rpx;
    font-size: 24rpx;
    padding: 0 24rpx;
    background: rgba(255, 255, 255, 0.8);
    color: var(--text-deep);
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
    background: rgba(255, 255, 255, 0.8);
    border: none;
}

.login-title {
    font-size: 32rpx;
    margin-bottom: 18rpx;
    display: block;
}

.login-desc {
    display: block;
    margin-bottom: 14rpx;
    color: var(--text-deep);
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
    background: rgba(255, 255, 255, 0.8);
}

.login-btn {
    margin-top: 16rpx;
    height: 80rpx;
    line-height: 80rpx;
    border-radius: 28rpx;
    border: none;
    font-size: 28rpx;
    background: linear-gradient(130deg, rgba(255, 141, 66, 0.28), rgba(255, 141, 66, 0.5));
    color: var(--text-deep);
}

.panel-logout-btn {
    margin-top: 10rpx;
}
</style>
