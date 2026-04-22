!function(){const e=document.createElement("link").relList;if(!(e&&e.supports&&e.supports("modulepreload"))){for(const e of document.querySelectorAll('link[rel="modulepreload"]'))o(e);new MutationObserver(e=>{for(const t of e)if("childList"===t.type)for(const e of t.addedNodes)"LINK"===e.tagName&&"modulepreload"===e.rel&&o(e)}).observe(document,{childList:!0,subtree:!0})}function o(e){if(e.ep)return;e.ep=!0;const o=function(e){const o={};return e.integrity&&(o.integrity=e.integrity),e.referrerPolicy&&(o.referrerPolicy=e.referrerPolicy),"use-credentials"===e.crossOrigin?o.credentials="include":"anonymous"===e.crossOrigin?o.credentials="omit":o.credentials="same-origin",o}(e);fetch(e.href,o)}}();
/**
* @vue/shared v3.4.21
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
const e=e=>"symbol"==typeof e;let o;
/**
* @dcloudio/uni-h5-vue v3.4.21
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
new Set(Object.getOwnPropertyNames(Symbol).filter(e=>"arguments"!==e&&"caller"!==e).map(e=>Symbol[e]).filter(e));{const e=o||(o="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{}),t=(o,t)=>{let r;return(r=e[o])||(r=e[o]=[]),r.push(t),e=>{r.length>1?r.forEach(o=>o(e)):r[0](e)}};t("__VUE_INSTANCE_SETTERS__",e=>e),t("__VUE_SSR_SETTERS__",e=>e)}
