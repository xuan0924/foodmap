// js/search.js

let placeSearch = null;
const COLLECTION_STORAGE_KEY = 'food_collection_v1';

/**
 * 初始化搜索模块
 */
function initSearchModule() {
    // 实例化高德搜索插件
    placeSearch = new AMap.PlaceSearch({
        city: AMAP_CONFIG.CITY, // 限制在武汉
        type: '餐饮服务',        // 只检索餐饮相关结果
        pageSize: 10,           // 每次搜10条
        map: null,               // 重要：不让它自动在地图上打点
        panel: null              // 重要：不使用高德默认的列表面板
    });

    // 绑定搜索框的回车事件
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            executeSearch(e.target.value);
        }
    });

    bindDrawerToggle();

    // 首次进入页面时刷新收藏侧边栏
    refreshCollectionUI();
}

/**
 * 执行搜索逻辑
 */
function executeSearch(keyword) {
    if (!keyword) return;

    console.log(`🔍 正在搜索武汉的: ${keyword}...`);
    
    placeSearch.search(keyword, (status, result) => {
        if (status === 'complete' && result.info === 'OK') {
            renderResultList(result.poiList.pois);
        } else {
            renderResultList([]);
        }
    });
}

/**
 * 渲染左侧搜索结果列表
 */
function renderResultList(pois) {
    const listContainer = document.getElementById('result-list');
    listContainer.innerHTML = ''; // 清空旧结果
    listContainer.classList.add('visible');

    if (!pois.length) {
        listContainer.innerHTML = '<div class="poi-empty">没找到匹配结果，换个关键词试试。</div>';
        return;
    }

    pois.forEach(poi => {
        // 创建一个列表项
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

/**
 * 用户点击列表中的店，确认收纳
 */
function handleSelectPoi(poi, categorySelect, categoryNew) {
    const typedCategory = categoryNew ? categoryNew.value.trim() : '';
    const selectedCategory = categorySelect ? categorySelect.value.trim() : '';
    const category = typedCategory || selectedCategory || '我的私藏';

    const foodData = {
        id: poi.id,
        name: poi.name,
        lng: poi.location.lng,
        lat: poi.location.lat,
        category: category,
        address: poi.address
    };

    // 2. 调用地图引擎渲染图钉
    renderFoodMarker(foodData);

    // 3. 飞向该位置，给用户一个视觉反馈
    flyToPosition([foodData.lng, foodData.lat]);

    // 4. 存入 LocalStorage，并刷新收藏 UI
    saveToCollection(foodData);
    refreshCollectionUI();
    closeResultList();
    console.log("💾 已收纳到本地：", foodData);
}

function getCategoryOptions() {
    const categories = new Set(['我的私藏']);
    getStoredCollection().forEach((item) => {
        const category = (item.category || '').trim();
        if (category) categories.add(category);
    });
    return Array.from(categories);
}

function getStoredCollection() {
    const raw = localStorage.getItem(COLLECTION_STORAGE_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn("⚠️ 本地收藏数据损坏，已忽略。", error);
        return [];
    }
}

function saveToCollection(item) {
    const list = getStoredCollection();
    const itemKey = getCollectionKey(item);
    const idx = list.findIndex((record) => getCollectionKey(record) === itemKey);
    if (idx >= 0) {
        list[idx] = { ...list[idx], ...item };
    } else {
        list.push(item);
    }
    localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(list));
}

function removeFromCollection(item) {
    const list = getStoredCollection();
    const itemKey = getCollectionKey(item);
    const next = list.filter((record) => getCollectionKey(record) !== itemKey);
    localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(next));
}

function getCollectionKey(item) {
    return item.id || `${item.name}-${item.lng}-${item.lat}`;
}

/**
 * 读取 LocalStorage 并按分类刷新侧栏收藏视图
 */
function refreshCollectionUI() {
    const container = document.getElementById('collection-list');
    if (!container) return;

    const list = getStoredCollection();
    container.innerHTML = '<h4 class="collection-title">我的收纳夹</h4>';

    if (!list.length) {
        hideAllMarkers();
        container.innerHTML += '<div class="collection-empty">还没有收纳店铺，先去搜索并收纳一条吧。</div>';
        return;
    }

    // 页面刷新后预创建标记，但默认不在地图展示
    list.forEach((item) => renderFoodMarker(item));

    const grouped = list.reduce((acc, item) => {
        const key = (item.category || '未分类').trim() || '未分类';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    Object.entries(grouped).forEach(([category, items], index) => {
        const folder = document.createElement('div');
        folder.className = 'folder-group';

        const sectionId = `folder-items-${index}`;
        const toggle = document.createElement('button');
        toggle.className = 'folder-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', sectionId);
        toggle.innerHTML = `
            <span class="folder-left">
                <span class="folder-icon">📁</span>
                <span class="folder-name">${category}</span>
                <span class="folder-count">(${items.length})</span>
            </span>
            <span class="folder-arrow">▶</span>
        `;

        const listWrap = document.createElement('div');
        listWrap.className = 'folder-items';
        listWrap.id = sectionId;

        toggle.addEventListener('click', () => {
            const isOpen = toggle.getAttribute('aria-expanded') === 'true';
            const nextOpen = !isOpen;

            container.querySelectorAll('.folder-toggle').forEach((btn) => {
                btn.setAttribute('aria-expanded', 'false');
            });
            container.querySelectorAll('.folder-items').forEach((wrap) => {
                wrap.classList.remove('open');
            });

            if (nextOpen) {
                toggle.setAttribute('aria-expanded', 'true');
                listWrap.classList.add('open');
                showCategoryMarkers(items);
            } else {
                hideAllMarkers();
            }
        });

        items.forEach((item) => {
            const itemRow = document.createElement('div');
            itemRow.className = 'collection-item';

            const shopBtn = document.createElement('button');
            shopBtn.className = 'collection-item-main';
            shopBtn.type = 'button';
            shopBtn.innerHTML = `
                <span class="collection-item-name">${item.name}</span>
                <span class="collection-item-address">${item.address || '地址不详'}</span>
            `;
            shopBtn.addEventListener('click', () => {
                focusMarker(item);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'collection-delete';
            deleteBtn.type = 'button';
            deleteBtn.textContent = '🗑';
            deleteBtn.setAttribute('aria-label', `删除收藏 ${item.name}`);
            deleteBtn.addEventListener('click', () => {
                removeFromCollection(item);
                removeFoodMarker(item);
                refreshCollectionUI();
            });

            itemRow.appendChild(shopBtn);
            itemRow.appendChild(deleteBtn);
            listWrap.appendChild(itemRow);
        });

        folder.appendChild(toggle);
        folder.appendChild(listWrap);
        container.appendChild(folder);
    });
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
    if (!panel || !toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        const isOpen = panel.classList.toggle('open');
        panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        toggleBtn.textContent = isOpen ? '✕ 关闭收藏夹' : '☰ 收藏夹';
    });
}
