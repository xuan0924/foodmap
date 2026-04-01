// js/collection-ui.js — 收藏夹 UI：城市 Pill 筛选 + 列表树 + 与地图联动

const CollectionUI = {
    /** @type {string|null} null / CITY_FILTER_ALL 表示「全部」 */
    selectedCityKey: CITY_FILTER_ALL,

    formatCityDisplay(cityKey) {
        if (!cityKey || cityKey === '未知城市') return cityKey || '未知城市';
        const s = cityKey.trim();
        if (/[省市州县区旗]$/.test(s)) return s;
        return `${s}市`;
    },

    updateCityFilter() {
        const bar = document.getElementById('city-pill-bar');
        if (!bar) return;

        const cities = getUniqueCitiesFromCollection();
        const validKeys = new Set(cities);
        if (this.selectedCityKey !== CITY_FILTER_ALL && !validKeys.has(this.selectedCityKey)) {
            this.selectedCityKey = CITY_FILTER_ALL;
        }

        bar.innerHTML = '';

        const mkPill = (label, cityData, isAll) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'city-pill';
            if (isAll) {
                btn.dataset.cityAll = '1';
            } else {
                btn.dataset.city = cityData;
            }
            btn.textContent = label;
            const active =
                isAll
                    ? this.selectedCityKey === CITY_FILTER_ALL
                    : this.selectedCityKey === cityData;
            if (active) btn.classList.add('active');

            btn.addEventListener('click', () => {
                this.selectedCityKey = isAll ? CITY_FILTER_ALL : cityData;
                this.updateCityFilter();
                this.renderCollectionTree();
                this.syncMapWithFilter();
            });
            return btn;
        };

        bar.appendChild(mkPill('全部', null, true));
        cities.forEach((cityKey) => {
            bar.appendChild(mkPill(this.formatCityDisplay(cityKey), cityKey, false));
        });
    },

    syncMapWithFilter() {
        const full = getStoredCollection();
        const filtered = filterCollectionByCity(full, this.selectedCityKey);

        hideAllMarkers();
        filtered.forEach((item) => MapEngine.renderMarker(item));

        if (!filtered.length) {
            return;
        }

        if (this.selectedCityKey === CITY_FILTER_ALL) {
            MapEngine.fitMapToCollectionItems(full);
        } else {
            MapEngine.setMapViewForCity(this.selectedCityKey);
        }
    },

    redrawMarkersOnly() {
        const full = getStoredCollection();
        const filtered = filterCollectionByCity(full, this.selectedCityKey);
        hideAllMarkers();
        filtered.forEach((item) => MapEngine.renderMarker(item));
    },

    /**
     * 在 scope 内绑定分类文件夹（展开时显示该分类图钉）
     */
    appendCategoryFolders(scopeRoot, parentEl, items) {
        const byCategory = items.reduce((acc, item) => {
            const cat = (item.category || '未分类').trim() || '未分类';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {});

        const uid = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        Object.entries(byCategory).forEach(([category, catItems], folderIndex) => {
            const folder = document.createElement('div');
            folder.className = 'folder-group folder-group-nested';

            const sectionId = `folder-${uid}-${folderIndex}`;
            const toggle = document.createElement('button');
            toggle.className = 'folder-toggle';
            toggle.type = 'button';
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-controls', sectionId);
            toggle.innerHTML = `
                <span class="folder-left">
                    <span class="folder-icon">📁</span>
                    <span class="folder-name">${category}</span>
                    <span class="folder-count">(${catItems.length})</span>
                </span>
                <span class="folder-arrow">▶</span>
            `;

            const listWrap = document.createElement('div');
            listWrap.className = 'folder-items';
            listWrap.id = sectionId;

            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = toggle.getAttribute('aria-expanded') === 'true';
                const nextOpen = !isOpen;

                scopeRoot.querySelectorAll('.folder-toggle').forEach((btn) => {
                    btn.setAttribute('aria-expanded', 'false');
                });
                scopeRoot.querySelectorAll('.folder-items').forEach((wrap) => {
                    wrap.classList.remove('open');
                });

                if (nextOpen) {
                    toggle.setAttribute('aria-expanded', 'true');
                    listWrap.classList.add('open');
                    showCategoryMarkers(catItems);
                } else {
                    hideAllMarkers();
                    this.redrawMarkersOnly();
                }
            });

            catItems.forEach((item) => {
                const itemRow = document.createElement('div');
                itemRow.className = 'collection-item';

                const shopBtn = document.createElement('button');
                shopBtn.className = 'collection-item-main';
                shopBtn.type = 'button';
                const sub = [item.province, item.city].filter(Boolean).join(' · ');
                shopBtn.innerHTML = `
                    <span class="collection-item-name">${item.name}</span>
                    <span class="collection-item-address">${item.address || '地址不详'}${sub ? ` · ${sub}` : ''}</span>
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
                    CollectionUI.refresh();
                });

                itemRow.appendChild(shopBtn);
                itemRow.appendChild(deleteBtn);
                listWrap.appendChild(itemRow);
            });

            folder.appendChild(toggle);
            folder.appendChild(listWrap);
            parentEl.appendChild(folder);
        });
    },

    renderCollectionTree() {
        const tree = document.getElementById('collection-tree');
        if (!tree) return;

        const full = getStoredCollection();
        tree.innerHTML = '';

        if (!full.length) {
            tree.innerHTML = '<div class="collection-empty">还没有收纳店铺，先去搜索并收纳一条吧。</div>';
            return;
        }

        const filtered = filterCollectionByCity(full, this.selectedCityKey);

        if (!filtered.length) {
            tree.innerHTML = '<div class="collection-empty">该城市下暂无店铺。</div>';
            return;
        }

        if (this.selectedCityKey === CITY_FILTER_ALL) {
            const byCity = filtered.reduce((acc, item) => {
                const ck = getCityKeyForItem(item);
                if (!acc[ck]) acc[ck] = [];
                acc[ck].push(item);
                return acc;
            }, {});

            const cityOrder = Object.keys(byCity).sort((a, b) => {
                if (a === '未知城市') return 1;
                if (b === '未知城市') return -1;
                return a.localeCompare(b, 'zh-CN');
            });
            cityOrder.forEach((cityKey) => {
                const cityItems = byCity[cityKey];
                const block = document.createElement('div');
                block.className = 'collection-city-block';
                const heading = document.createElement('div');
                heading.className = 'collection-city-heading';
                heading.textContent = this.formatCityDisplay(cityKey);
                block.appendChild(heading);
                this.appendCategoryFolders(tree, block, cityItems);
                tree.appendChild(block);
            });
        } else {
            this.appendCategoryFolders(tree, tree, filtered);
        }
    },

    refresh() {
        const full = getStoredCollection();
        const title = document.querySelector('#collection-list .collection-title');
        if (title) {
            title.textContent = '我的收藏';
        }

        if (!full.length) {
            hideAllMarkers();
            this.selectedCityKey = CITY_FILTER_ALL;
        }

        this.updateCityFilter();
        this.renderCollectionTree();
        this.syncMapWithFilter();
    }
};

function refreshCollectionUI() {
    CollectionUI.refresh();
}
