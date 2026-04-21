// js/search.js — 精简版：固定武汉搜索
let placeSearch = null;
const LOCKED_CITY_NAME = '武汉';

function setSearchCityHint(text, isError) {
    const el = document.getElementById('search-city-hint');
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || '';
    el.classList.toggle('search-city-hint--error', !!isError);
}

function rebuildPlaceSearch() {
    const map = MapEngine.getMap();
    placeSearch = new AMap.PlaceSearch({
        city: LOCKED_CITY_NAME,
        citylimit: true,
        type: '餐饮服务',
        pageSize: 10,
        map: map || null,
        panel: null,
        autoFitView: true
    });
}

function initSearchModule() {
    const cityInput = document.getElementById('searchCityInput');
    const applyBtn = document.getElementById('searchCityApply');
    const searchInput = document.getElementById('searchInput');

    if (cityInput) cityInput.value = LOCKED_CITY_NAME;
    if (applyBtn) applyBtn.disabled = true;

    MapEngine.focusSearchCity(LOCKED_CITY_NAME, function () {
        rebuildPlaceSearch();
        setSearchCityHint('当前仅支持武汉搜索。');
    });

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                executeSearch(e.target.value);
            }
        });
    }

    bindDrawerToggle();
}

function executeSearch(keyword) {
    const q = String(keyword || '').trim();
    if (!q) return;
    if (!placeSearch) rebuildPlaceSearch();

    placeSearch.search(q, (status, result) => {
        if (status === 'complete' && result.info === 'OK') {
            renderResultList((result.poiList && result.poiList.pois) || []);
        } else {
            renderResultList([]);
        }
    });
}

function renderResultList(pois) {
    const listContainer = document.getElementById('result-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    listContainer.classList.add('visible');

    if (!pois.length) {
        listContainer.innerHTML = '<div class="poi-empty">武汉暂无匹配结果，换个关键词试试。</div>';
        return;
    }

    pois.forEach((poi) => {
        const div = document.createElement('div');
        div.className = 'poi-item';
        div.innerHTML = `
            <h4>${poi.name || '未命名店铺'}</h4>
            <p>${poi.address || '地址不详'}</p>
        `;
        div.addEventListener('click', () => {
            if (!poi.location) return;
            const lng = poi.location.lng;
            const lat = poi.location.lat;
            if (lng == null || lat == null) return;
            flyToPosition([lng, lat]);
        });
        listContainer.appendChild(div);
    });
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
