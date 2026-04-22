<template>
    <view class="page-root">
        <view class="ambient-blobs">
            <view class="ambient-blob blob-a"></view>
            <view class="ambient-blob blob-b"></view>
        </view>

        <view class="topbar glass-card">
            <text class="title cream-title">吃货同步协议</text>
            <text class="subtitle">{{ loginSubtitle }}</text>
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

        <view v-if="!isLoggedIn" class="login-overlay">
            <view class="login-card glass-card">
                <text class="login-title cream-title">登录后开启同步链路</text>
                <!-- #ifdef H5 -->
                <input
                    v-model="phone"
                    class="login-input"
                    type="number"
                    maxlength="11"
                    placeholder="输入手机号"
                />
                <view class="otp-row">
                    <input
                        v-model="otpCode"
                        class="login-input otp-input"
                        type="number"
                        maxlength="6"
                        placeholder="验证码"
                    />
                    <button class="otp-btn" @click="handleSendOtp">发送验证码</button>
                </view>
                <button class="login-btn" @click="handleVerifyOtp">手机号登录</button>
                <!-- #endif -->

                <!-- #ifdef MP-WEIXIN -->
                <button class="login-btn" @click="handleWechatLogin">微信一键登录</button>
                <!-- #endif -->
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
import { MAP_CONFIG } from "@/src/config/map";
import { fetchFoodNodes } from "@/src/services/foodNodes.service";
import {
    sendPhoneOtp,
    verifyPhoneOtp,
    getStoredSession,
    isSessionValid,
    signOut,
    signInWithWeChatCode
} from "@/src/services/auth.service";
import { startFoodNodesSync, stopFoodNodesSync } from "@/src/services/realtime.service";

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
            phone: "",
            otpCode: "",
            session: null
        };
    },
    computed: {
        isLoggedIn() {
            return !!(this.session && this.session.access_token);
        },
        loginSubtitle() {
            return this.isLoggedIn
                ? "已登录 · 实时同步中"
                : "Web OTP / 微信登录后开启实时同步";
        }
    },
    onLoad() {
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
        tryRestoreSession() {
            const stored = getStoredSession();
            if (stored && isSessionValid(stored)) {
                this.session = stored;
                this.loadNodes();
                this.startSync();
            }
        },
        async handleSendOtp() {
            if (!/^1\d{10}$/.test(this.phone)) {
                uni.showToast({ title: "请输入正确手机号", icon: "none" });
                return;
            }
            try {
                await sendPhoneOtp(this.phone);
                uni.showToast({ title: "验证码已发送", icon: "none" });
            } catch (err) {
                uni.showToast({ title: "发送失败", icon: "none" });
                console.error(err);
            }
        },
        async handleVerifyOtp() {
            if (!this.phone || !this.otpCode) {
                uni.showToast({ title: "请先填写手机号和验证码", icon: "none" });
                return;
            }
            try {
                const session = await verifyPhoneOtp(this.phone, this.otpCode);
                this.session = session;
                uni.showToast({ title: "登录成功", icon: "none" });
                await this.loadNodes();
                this.startSync();
            } catch (err) {
                uni.showToast({ title: "验证码错误或已失效", icon: "none" });
                console.error(err);
            }
        },
        // #ifdef MP-WEIXIN
        async handleWechatLogin() {
            try {
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
                await this.loadNodes();
                this.startSync();
            } catch (err) {
                uni.showToast({ title: "微信登录失败", icon: "none" });
                console.error(err);
            }
        },
        // #endif
        handleLogout() {
            signOut();
            stopFoodNodesSync();
            this.session = null;
            this.nodes = [];
            this.mpMarkers = [];
            this.renderH5Markers();
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

.login-input {
    width: 100%;
    box-sizing: border-box;
    height: 78rpx;
    border-radius: 18rpx;
    border: 1px solid rgba(154, 184, 230, 0.65);
    background: rgba(255, 255, 255, 0.86);
    padding: 0 20rpx;
    margin-bottom: 14rpx;
    font-size: 28rpx;
}

.otp-row {
    display: flex;
    gap: 12rpx;
}

.otp-input {
    margin-bottom: 0;
    flex: 1;
}

.otp-btn {
    height: 78rpx;
    line-height: 78rpx;
    padding: 0 18rpx;
    border-radius: 18rpx;
    border: none;
    font-size: 24rpx;
    background: rgba(26, 115, 232, 0.14);
    color: var(--protocol-accent);
    flex-shrink: 0;
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
</style>
