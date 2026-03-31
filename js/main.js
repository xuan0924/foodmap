// js/main.js
window.onload = function() {
    console.log("🚀 武汉美食地图一人公司 - 启动中...");

    // 1. 初始化地图底盘
    initMapEngine('container');

    // 2. 初始化业务搜索模块
    initSearchModule();

    console.log("💡 准备就绪，请输入关键词开始寻找烟火气。");
};
