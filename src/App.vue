<script>
export default {
    onLaunch() {
        console.log("吃货同步协议 Uni-app 启动");
    }
};
</script>

<style>
:root {
    --theme-primary: #1a73e8;
    --app-bg-color: #fdf6ec;
    --gem-text: #202124;
    --gem-text-secondary: #5f6368;
    --theme-border: #9ab8e6;
    --protocol-accent: var(--theme-primary);
    --protocol-bg: var(--app-bg-color);
    --protocol-text: var(--gem-text);
    --glass-bg: rgba(255, 255, 255, 0.72);
    --glass-border: rgba(154, 184, 230, 0.58);
    --radius-xl: 28rpx;
    --radius-2xl: 36rpx;
}

page {
    background: var(--app-bg-color);
    color: var(--gem-text);
    font-family: "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.glass-card {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-2xl);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.cream-title {
    color: var(--gem-text);
    letter-spacing: 0.08em;
    font-weight: 600;
}
</style>
