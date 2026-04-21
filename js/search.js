// js/search.js — 先选城市定位，再在本城搜索餐饮

let placeSearch = null;
/** 已通过「定位」确认的高德 PlaceSearch 城市名（空则禁止搜索） */
let activeSearchCityName = '';

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

    placeSearch = new AMap.PlaceSearch({
        city: city || '',
        citylimit: !!city,
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
        rebuildPlaceSearch();
        setSearchCityHint('请先输入城市名，再点击「定位」。', true);
        return;
    }

    MapEngine.focusSearchCity(raw, function (ok) {
        if (!ok) {
            activeSearchCityName = '';
            rebuildPlaceSearch();
            setSearchCityHint('未识别该城市，请尝试「武汉」「北京市」等形式。', true);
            return;
        }
        activeSearchCityName = raw;
        rebuildPlaceSearch();
        setSearchCityHint(`已定位到「${raw}」，可搜索本城餐饮。`);
    });
}

/**
 * 初始化搜索模块（依赖地图实例以启用 autoFitView）
 */
function initSearchModule() {
    const cityInput = document.getElementById('searchCityInput');
    const applyBtn = document.getElementById('searchCityApply');

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
    const searchSubmitBtn = document.getElementById('searchSubmitBtn');
    const triggerSearch = () => {
        if (!searchInput) return;
        executeSearch(searchInput.value.trim());
    };

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            triggerSearch();
        }
    });
    if (searchSubmitBtn) {
        searchSubmitBtn.addEventListener('click', () => triggerSearch());
    }

    bindDrawerToggle();
    refreshCollectionUI();

    if (cityInput && cityInput.value.trim()) {
        applySearchCity();
    }
}

function executeSearch(keyword) {
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
            renderResultList(result.poiList.pois);
        } else {
            renderResultList([]);
        }
    });
}

function renderResultList(pois) {
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
            <h4>${poi.name}</h4>
            <p>${poi.address || '地址不详'}</p>
            <div class="poi-actions">
                <select class="poi-category-select">${categoryOptions}</select>
                <button class="poi-new-toggle" type="button">+ 新建</button>
                <input class="poi-category-new" type="text" placeholder="输入新分类后收纳">
                <button class="poi-save-btn" type="button">收纳</button>
            </div>
        `;

        const saveBtn = div.querySelector('.poi-save-btn');
        const categorySelect = div.querySelector('.poi-category-select');
        const categoryNew = div.querySelector('.poi-category-new');
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
        saveBtn.addEventListener('click', () => handleSelectPoi(poi, categorySelect, categoryNew));

        listContainer.appendChild(div);
    });
}

function handleSelectPoi(poi, categorySelect, categoryNew) {
    const typedCategory = categoryNew ? categoryNew.value.trim() : '';
    const selectedCategory = categorySelect ? categorySelect.value.trim() : '';
    const category = typedCategory || selectedCategory || '我的私藏';

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
            city: city || ''
        };

        saveToCollection(foodData);
        MapEngine.renderMarker(foodData);
        flyToPosition([lng, lat]);
        refreshCollectionUI();
        closeResultList();
        console.log('💾 已收纳到本地：', foodData);
    });
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
