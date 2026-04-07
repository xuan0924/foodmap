// js/config.js
window.AMAP_CONFIG = {
    KEY: "9e003dbbac324e4fbb9df5874b7d8e57",
    SECURITY_CODE: "050e227945533547df0a66b0fdc5928",
    CENTER: [104.195397, 35.86166], // 全国视图大致中心
    DEFAULT_ZOOM: 5,
    /** 打开页面时默认搜索城市（可改为你常去的城市） */
    DEFAULT_SEARCH_CITY: '武汉'
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
