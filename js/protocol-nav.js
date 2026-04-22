// js/protocol-nav.js — 吃货同步协议 · 动态主题导航矩阵（Bottom Sheet + 多平台跳转）

(function () {
    let sheetEl = null;
    let scrimEl = null;
    let statusTimer = null;

    function ensureDom() {
        if (sheetEl) return;
        scrimEl = document.createElement('div');
        scrimEl.id = 'protocol-nav-scrim';
        scrimEl.className = 'protocol-nav-scrim';
        scrimEl.setAttribute('aria-hidden', 'true');
        scrimEl.addEventListener('click', closeSheet);

        sheetEl = document.createElement('div');
        sheetEl.id = 'protocol-nav-sheet';
        sheetEl.className = 'protocol-nav-sheet';
        sheetEl.setAttribute('role', 'dialog');
        sheetEl.setAttribute('aria-modal', 'true');
        sheetEl.setAttribute('aria-hidden', 'true');
        sheetEl.innerHTML = `
            <div class="protocol-nav-handle" aria-hidden="true"></div>
            <p class="protocol-nav-title" id="protocol-nav-title">定向链路</p>
            <p class="protocol-nav-status" id="protocol-nav-status" role="status"></p>
            <div class="protocol-nav-matrix">
                <button type="button" class="protocol-nav-btn" data-provider="amap">高德地图</button>
                <button type="button" class="protocol-nav-btn" data-provider="baidu">百度地图</button>
                <button type="button" class="protocol-nav-btn" data-provider="system">系统地图</button>
            </div>
            <button type="button" class="protocol-nav-close" id="protocol-nav-close" aria-label="关闭">关闭</button>
        `;
        document.body.appendChild(scrimEl);
        document.body.appendChild(sheetEl);

        sheetEl.querySelector('#protocol-nav-close').addEventListener('click', closeSheet);
        sheetEl.querySelectorAll('.protocol-nav-btn').forEach((btn) => {
            btn.addEventListener('mousedown', () => btn.classList.add('is-pressed'));
            btn.addEventListener('mouseup', () => btn.classList.remove('is-pressed'));
            btn.addEventListener('mouseleave', () => btn.classList.remove('is-pressed'));
            btn.addEventListener('touchstart', () => btn.classList.add('is-pressed'), { passive: true });
            btn.addEventListener('touchend', () => btn.classList.remove('is-pressed'));
            btn.addEventListener('click', () => handleMatrixClick(btn.dataset.provider));
        });
    }

    function setStatus(text) {
        const el = document.getElementById('protocol-nav-status');
        if (!el) return;
        el.textContent = text || '';
        el.hidden = !text;
    }

    function flashLinking(name) {
        const safe = String(name || '店铺').slice(0, 40);
        setStatus(`正在建立与 ${safe} 的定向链路…`);
        if (statusTimer) clearTimeout(statusTimer);
        statusTimer = setTimeout(() => setStatus(''), 2600);
    }

    let pendingTarget = null;
    let pendingOrigin = null;

    function encodeQuery(o) {
        return Object.keys(o)
            .filter((k) => o[k] != null && o[k] !== '')
            .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(o[k])}`)
            .join('&');
    }

    function openGaode(origin, dest) {
        const { lng: olng, lat: olat } = origin;
        const { lng: dlng, lat: dlat, name } = dest;
        const dname = name || '目的地';

        const amapUri = `amapuri://route/plan/?sid=&slat=${olat}&slon=${olng}&sname=我的位置&dlat=${dlat}&dlon=${dlng}&dname=${encodeURIComponent(dname)}&dev=0&t=0`;
        const webUri = `https://uri.amap.com/navigation?from=${olng},${olat},我的位置&to=${dlng},${dlat},${encodeURIComponent(dname)}&mode=car&policy=1&src=chihuo-protocol&coordinate=gaode&callnative=1`;

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = amapUri;
        document.body.appendChild(iframe);
        setTimeout(() => {
            try {
                document.body.removeChild(iframe);
            } catch (e) {
                /* ignore */
            }
            window.open(webUri, '_blank', 'noopener,noreferrer');
        }, 420);
    }

    function openBaidu(origin, dest) {
        const { lng: olng, lat: olat } = origin;
        const { lng: dlng, lat: dlat, name } = dest;
        const dname = name || '目的地';

        const baiduUri = `baidumap://map/direction?origin=${olat},${olng}|name:我的位置&destination=name:${encodeURIComponent(dname)}|latlng:${dlat},${dlng}&mode=driving&src=chihuo-protocol`;
        const webUri = `https://api.map.baidu.com/direction?origin=latlng:${olat},${olng}|name:${encodeURIComponent('我的位置')}&destination=latlng:${dlat},${dlng}|name:${encodeURIComponent(dname)}&mode=driving&region=&output=html&src=chihuo-protocol`;

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = baiduUri;
        document.body.appendChild(iframe);
        setTimeout(() => {
            try {
                document.body.removeChild(iframe);
            } catch (e) {
                /* ignore */
            }
            window.open(webUri, '_blank', 'noopener,noreferrer');
        }, 420);
    }

    function openSystemMap(dest) {
        const { lng, lat, name } = dest;
        const label = encodeURIComponent(name || '目的地');
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIOS) {
            const apple = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d&q=${label}`;
            window.location.href = apple;
            return;
        }

        if (/Android/i.test(navigator.userAgent)) {
            const geo = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
            window.location.href = geo;
            return;
        }

        const g = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        window.open(g, '_blank', 'noopener,noreferrer');
    }

    function handleMatrixClick(provider) {
        if (!pendingTarget || !pendingOrigin) return;
        flashLinking(pendingTarget.name);
        const origin = pendingOrigin;
        const dest = {
            lng: pendingTarget.lng,
            lat: pendingTarget.lat,
            name: pendingTarget.name
        };

        setTimeout(() => {
            try {
                if (provider === 'amap') openGaode(origin, dest);
                else if (provider === 'baidu') openBaidu(origin, dest);
                else openSystemMap(dest);
            } catch (e) {
                console.warn(e);
            }
        }, 180);
    }

    function openSheet(item, originLngLat) {
        ensureDom();
        pendingTarget = item;
        pendingOrigin = { lng: originLngLat[0], lat: originLngLat[1] };

        const title = document.getElementById('protocol-nav-title');
        if (title) title.textContent = item.name || '定向链路';

        scrimEl.classList.add('visible');
        scrimEl.setAttribute('aria-hidden', 'false');
        sheetEl.classList.add('open');
        sheetEl.setAttribute('aria-hidden', 'false');
        setStatus('');
    }

    function closeSheet() {
        if (!sheetEl) return;
        sheetEl.classList.remove('open');
        sheetEl.setAttribute('aria-hidden', 'true');
        if (scrimEl) {
            scrimEl.classList.remove('visible');
            scrimEl.setAttribute('aria-hidden', 'true');
        }
        pendingTarget = null;
        pendingOrigin = null;
        setStatus('');
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sheetEl && sheetEl.classList.contains('open')) closeSheet();
    });

    window.ProtocolNav = {
        openSheet,
        closeSheet,
        flashLinking
    };
})();
