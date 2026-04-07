// js/config.js
window.AMAP_CONFIG = {
    KEY: "9e003dbbac324e4fbb9df5874b7d8e57",
    SECURITY_CODE: "050e227945533547df0a66b0fdc5928",
    CENTER: [104.195397, 35.86166], // 全国视图大致中心
    DEFAULT_ZOOM: 5,
    /** 打开页面时默认搜索城市（可改为你常去的城市） */
    DEFAULT_SEARCH_CITY: '武汉',
    /**
     * 是否一打开就用 IP 猜城市（getLocalCity）。出口 IP 常被判到兰州等错误城市，默认关闭；
     * 改为用 DEFAULT_SEARCH_CITY + 下方中心点；需要自动 IP 时再设为 true。
     */
    AUTO_IP_CITY: false,
    /** 与 DEFAULT_SEARCH_CITY 对应，关闭 IP 自动定位时用（武汉大致中心） */
    DEFAULT_MAP_CENTER: [114.3, 30.6]
};
/** @type {typeof window.AMAP_CONFIG} 供其它脚本用标识符访问 */
var AMAP_CONFIG = window.AMAP_CONFIG;

window.SUPABASE_CONFIG = {
    URL: 'https://yyjcwldberdlcrdwhyuo.supabase.co',
    ANON_KEY: 'sb_publishable_7uJIM9rpIhD9-31p58MM8A_uvqxHf45',
    TABLE: 'places'
};
/** @type {typeof window.SUPABASE_CONFIG} */
var SUPABASE_CONFIG = window.SUPABASE_CONFIG;
