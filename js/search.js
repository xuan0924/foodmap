// js/search.js — 先选城市定位，再在本城搜索餐饮

let placeSearch = null;
/** 已通过「定位」确认的高德 PlaceSearch 城市名（空则禁止搜索） */
let activeSearchCityName = '';
let isSearchCityLocked = false;
const SMART_FOOD_HINT_RE = /(店|馆|餐厅|酒楼|大排档|面馆|饭店|火锅|烧烤|烤肉|小吃|咖啡|茶餐厅|寿司|炸鸡|麻辣烫|米线|螺蛳粉|奶茶|甜品)/;

function setSearchCityHint(text, isError) {
    const el = document.getElementById('search-city-hint');
    if (!el) return;
    if (!text) {
        el.hidden = true;
        el.textContent = '';
        return;
    }
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle('search-city-hint--error', !!isError);
}

/**
 * 供高德 PlaceSearch 使用的城市字段（尽量简短市名）
 */
function normalizeCityForPlaceSearch(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    return s.replace(/(市|地区|自治州|盟|县)$/, '') || s;
}

function rebuildPlaceSearch() {
    const map = MapEngine.getMap();
    const city = normalizeCityForPlaceSearch(activeSearchCityName);
    const cityLocked = !!city && isSearchCityLocked;

    placeSearch = new AMap.PlaceSearch({
        city: cityLocked ? city : '',
        citylimit: cityLocked,
        type: '餐饮服务',
        pageSize: 10,
        map: map || null,
        panel: null,
        autoFitView: true
    });
}

/**
 * 读取输入 → 地图跳转 → 重建仅搜索本城的 PlaceSearch
 */
function applySearchCity() {
    const input = document.getElementById('searchCityInput');
    const raw = input ? input.value.trim() : '';
    setSearchCityHint('');

    if (!raw) {
        activeSearchCityName = '';
        isSearchCityLocked = false;
        rebuildPlaceSearch();
        setSearchCityHint('请先输入城市名，再点击「定位」。', true);
        return;
    }

    // 先立即按输入城市生效搜索，不等待地图定位回调
    activeSearchCityName = raw;
    isSearchCityLocked = true;
    rebuildPlaceSearch();
    setSearchCityHint(`已切换到「${raw}」，可直接搜索本城餐饮。`);

    const map = MapEngine.getMap();
    if (map && typeof map.setCity === 'function') {
        try {
            map.setCity(raw);
            if (typeof map.setZoom === 'function') {
                map.setZoom(11);
            }
        } catch (e) {
            // 忽略，继续走精确行政区定位
        }
    }

    const finish = function (ok) {
        if (!ok) {
            // 地图没跳转成功也不影响按城市搜索
            setSearchCityHint(`地图定位较慢/失败，但已按「${raw}」搜索。`, true);
            return;
        }
        setSearchCityHint(`已定位到「${raw}」，可搜索本城餐饮。`);
    };

    MapEngine.focusSearchCity(raw, function (ok) {
        finish(!!ok);
    });
}

/**
 * 初始化搜索模块（依赖地图实例以启用 autoFitView）
 */
function initSearchModule() {
    const cityInput = document.getElementById('searchCityInput');
    const applyBtn = document.getElementById('searchCityApply');
    const smartBtn = document.getElementById('smart-parse-btn');
    const ocrBtn = document.getElementById('ocr-parse-btn');

    if (cityInput && AMAP_CONFIG.DEFAULT_SEARCH_CITY) {
        cityInput.value = AMAP_CONFIG.DEFAULT_SEARCH_CITY;
    }

    rebuildPlaceSearch();

    if (applyBtn) {
        applyBtn.addEventListener('click', () => applySearchCity());
    }
    if (cityInput) {
        cityInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applySearchCity();
            }
        });
    }

    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            executeSearch(e.target.value);
        }
    });
    if (smartBtn) {
        smartBtn.addEventListener('click', handleSmartClipboardParse);
    }
    if (ocrBtn) {
        ocrBtn.addEventListener('click', handleOcrSearch);
    }

    bindDrawerToggle();
    refreshCollectionUI();

    if (cityInput && cityInput.value.trim()) {
        applySearchCity();
    }
}

function executeSearch(keyword, options) {
    const opts = options || {};
    if (!keyword) return;

    if (!activeSearchCityName) {
        const listContainer = document.getElementById('result-list');
        if (listContainer) {
            listContainer.innerHTML =
                '<div class="poi-empty">请先在左侧输入城市并点击「定位」，地图跳转到该城市后再搜索。</div>';
            listContainer.classList.add('visible');
        }
        setSearchCityHint('请先完成城市定位。', true);
        return;
    }

    setSearchCityHint('');

    const cityLabel = normalizeCityForPlaceSearch(activeSearchCityName);
    console.log(`🔍 正在【${cityLabel}】搜索餐饮: ${keyword}...`);

    placeSearch.search(keyword, (status, result) => {
        if (status === 'complete' && result.info === 'OK') {
            const pois = (result.poiList && result.poiList.pois) || [];
            if (opts.smartMode && pois.length === 1) {
                confirmAndCollectPoi(pois[0], opts.remark || '');
                return;
            }
            renderResultList(pois, opts.remark || '');
        } else {
            renderResultList([], opts.remark || '');
        }
    });
}

function renderResultList(pois, defaultRemark) {
    const listContainer = document.getElementById('result-list');
    listContainer.innerHTML = '';
    listContainer.classList.add('visible');

    if (!pois.length) {
        listContainer.innerHTML = '<div class="poi-empty">没找到匹配结果，换个关键词试试。</div>';
        return;
    }

    pois.forEach((poi) => {
        const div = document.createElement('div');
        div.className = 'poi-item';
        const categoryOptions = getCategoryOptions()
            .map((category) => `<option value="${category}">${category}</option>`)
            .join('');
        div.innerHTML = `
            <button type="button" class="poi-item-head" aria-label="在地图上查看 ${poi.name}">
                <h4>${poi.name}</h4>
                <p>${poi.address || '地址不详'}</p>
            </button>
            <div class="poi-actions">
                <select class="poi-category-select">${categoryOptions}</select>
                <button class="poi-new-toggle" type="button">+ 新建</button>
                <input class="poi-category-new" type="text" placeholder="输入新分类后收纳">
                <input class="poi-remark-input" type="text" placeholder="备注（可选）" value="${escapeHtml(defaultRemark || '')}">
                <button class="poi-save-btn" type="button">收纳</button>
            </div>
        `;

        const saveBtn = div.querySelector('.poi-save-btn');
        const categorySelect = div.querySelector('.poi-category-select');
        const categoryNew = div.querySelector('.poi-category-new');
        const remarkInput = div.querySelector('.poi-remark-input');
        const newToggle = div.querySelector('.poi-new-toggle');
        newToggle.addEventListener('click', () => {
            const isOpen = categoryNew.classList.toggle('visible');
            newToggle.textContent = isOpen ? '使用已有' : '+ 新建';
            if (isOpen) {
                categoryNew.focus();
            } else {
                categoryNew.value = '';
            }
        });
        saveBtn.addEventListener('click', () => handleSelectPoi(poi, categorySelect, categoryNew, remarkInput));

        const headBtn = div.querySelector('.poi-item-head');
        if (headBtn) {
            headBtn.addEventListener('click', () => {
                const lng = poi.location.lng;
                const lat = poi.location.lat;
                flyToPosition([lng, lat]);
                closeResultList();
            });
        }

        listContainer.appendChild(div);
    });
}

function handleSelectPoi(poi, categorySelect, categoryNew, remarkInput) {
    const typedCategory = categoryNew ? categoryNew.value.trim() : '';
    const selectedCategory = categorySelect ? categorySelect.value.trim() : '';
    const category = typedCategory || selectedCategory || '我的私藏';
    const remark = remarkInput ? remarkInput.value.trim() : '';

    const lng = poi.location.lng;
    const lat = poi.location.lat;

    reverseGeocodeRegion(lng, lat, function ({ province, city }) {
        const foodData = {
            id: poi.id,
            name: poi.name,
            lng,
            lat,
            category,
            address: poi.address,
            province: province || '',
            city: city || '',
            remark
        };

        const saveResult = saveToCollection(foodData);
        if (saveResult && saveResult.ok === false && saveResult.reason === 'duplicate') {
            alert(`「${poi.name}」已经收藏过了`);
            closeResultList();
            flyToPosition([lng, lat]);
            console.log('ℹ️ 已存在收藏，跳过重复写入：', foodData);
            return;
        }
        MapEngine.renderMarker(foodData);
        closeResultList();
        refreshCollectionUI();
        flyToPosition([lng, lat]);
        console.log('💾 已收纳到本地：', foodData);
    });
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeSmartLine(raw) {
    return String(raw || '')
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/[【】\[\]（）()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractSmartKeywordAndRemark(text) {
    const lines = String(text || '')
        .split(/\n+/)
        .map((line) => normalizeSmartLine(line))
        .filter(Boolean);
    if (!lines.length) return { keyword: '', remark: '' };

    const candidates = lines.filter((line) => line.length >= 2 && line.length <= 28);
    const keywordLine =
        candidates.find((line) => SMART_FOOD_HINT_RE.test(line)) ||
        candidates.find((line) => !/^\d+[\d\s-]*$/.test(line)) ||
        candidates[0] ||
        '';

    const remark = lines
        .filter((line) => line !== keywordLine && line.length >= 4)
        .slice(0, 2)
        .join('；')
        .slice(0, 120);

    return { keyword: keywordLine, remark };
}

async function handleSmartClipboardParse() {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
        alert('当前环境不支持读取剪贴板，请手动复制后粘贴到搜索框。');
        return;
    }
    try {
        const text = (await navigator.clipboard.readText()).trim();
        const parsed = extractSmartKeywordAndRemark(text);
        if (!parsed.keyword) {
            alert('剪贴板中未识别到有效店名，请复制更多文字再试。');
            return;
        }
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = parsed.keyword;
        executeSearch(parsed.keyword, { smartMode: true, remark: parsed.remark });
    } catch (error) {
        console.warn('读取剪贴板失败', error);
        alert('读取剪贴板失败，请检查浏览器权限。');
    }
}

function setOcrStatus(text, isError) {
    const el = document.getElementById('ocr-status');
    if (!el) return;
    if (!text) {
        el.hidden = true;
        el.textContent = '';
        return;
    }
    el.hidden = false;
    el.textContent = text;
    el.style.color = isError ? '#c5221f' : '';
}

async function handleOcrSearch() {
    const input = document.getElementById('ocr-image-input');
    const file = input && input.files && input.files[0];
    if (!file) {
        setOcrStatus('请先选择一张截图。', true);
        return;
    }
    if (!window.Tesseract || typeof window.Tesseract.recognize !== 'function') {
        setOcrStatus('OCR 组件未加载，请刷新页面后重试。', true);
        return;
    }

    try {
        setOcrStatus('正在识别图片文字，请稍候...');
        const result = await window.Tesseract.recognize(file, 'chi_sim+eng');
        const text = (result && result.data && result.data.text) || '';
        const parsed = extractSmartKeywordAndRemark(text);
        if (!parsed.keyword) {
            setOcrStatus('未识别到可搜索店名，建议换更清晰截图。', true);
            return;
        }
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = parsed.keyword;
        setOcrStatus(`识别成功：${parsed.keyword}`);
        executeSearch(parsed.keyword, { smartMode: true, remark: parsed.remark });
    } catch (error) {
        console.error('OCR 识别失败：', error);
        setOcrStatus('图片识别失败，请重试。', true);
    }
}

function confirmAndCollectPoi(poi, remark) {
    const ok = window.confirm(`仅匹配到 1 个结果：\n${poi.name}\n\n是否直接收纳？`);
    if (!ok) {
        renderResultList([poi], remark);
        return;
    }
    const mockCategorySelect = { value: '我的私藏' };
    const mockCategoryNew = { value: '' };
    const mockRemarkInput = { value: remark || '' };
    handleSelectPoi(poi, mockCategorySelect, mockCategoryNew, mockRemarkInput);
}

function getCategoryOptions() {
    const categories = new Set(['我的私藏']);
    getStoredCollection().forEach((item) => {
        const c = (item.category || '').trim();
        if (c) categories.add(c);
    });
    return Array.from(categories);
}

function closeResultList() {
    if (placeSearch && typeof placeSearch.clear === 'function') {
        placeSearch.clear();
    }
    const listContainer = document.getElementById('result-list');
    if (!listContainer) return;
    listContainer.classList.remove('visible');
    listContainer.innerHTML = '';
}

function bindDrawerToggle() {
    const panel = document.getElementById('side-panel');
    const toggleBtn = document.getElementById('drawer-toggle');
    const closeBtn = document.getElementById('drawer-close-btn');
    const scrim = document.getElementById('drawer-scrim');
    if (!panel || !toggleBtn) return;

    function setDrawerOpen(isOpen) {
        panel.classList.toggle('open', isOpen);
        panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        document.documentElement.classList.toggle('drawer-open', isOpen);
        toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        toggleBtn.setAttribute('aria-label', isOpen ? '关闭主菜单' : '打开主菜单');
        if (scrim) {
            scrim.classList.toggle('visible', isOpen);
            scrim.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        }
    }

    toggleBtn.addEventListener('click', () => {
        setDrawerOpen(!panel.classList.contains('open'));
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => setDrawerOpen(false));
    }

    if (scrim) {
        scrim.addEventListener('click', () => setDrawerOpen(false));
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('open')) {
            setDrawerOpen(false);
        }
    });
}
