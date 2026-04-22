<script>
export default {
    onLaunch() {
        console.log("吃货同步协议 Uni-app 启动");
    }
};
</script>

<style>
:root {
    --bg-apricot: #FFF9F0;
    --accent-orange: #FF8D42;
    --node-green: #A8D5BA;
    --node-blue: #92A8D1;
    --text-deep: #3D3D3D;
    --theme-primary: var(--accent-orange);
    --app-bg-color: var(--bg-apricot);
    --gem-text: var(--text-deep);
    --gem-text-secondary: rgba(61, 61, 61, 0.72);
    --theme-border: #F5BC94;
    --protocol-accent: var(--theme-primary);
    --protocol-bg: var(--app-bg-color);
    --protocol-text: var(--gem-text);
    --glass-bg: rgba(255, 255, 255, 0.8);
    --glass-border: transparent;
    --radius-xl: 28rpx;
    --radius-2xl: 28rpx;
}

page {
    background: var(--app-bg-color);
    color: var(--gem-text);
    font-family: "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.glass-card {
    background: var(--glass-bg);
    border: none;
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
