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
                <button type="button" class="protocol-nav-card" data-provider="amap">
                    <span class="protocol-nav-card-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 9a2.5 2.5 0 0 1 0 5.5z"/></svg>
                    </span>
                    <span class="protocol-nav-card-label">高德地图</span>
                </button>
                <button type="button" class="protocol-nav-card" data-provider="baidu">
                    <span class="protocol-nav-card-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M12 18.5l6-3v-10l-6 3-6-3v10l6 3zm0 2l-8-4V5l8 4 8-4v11.5l-8 4z"/></svg>
                    </span>
                    <span class="protocol-nav-card-label">百度地图</span>
                </button>
                <button type="button" class="protocol-nav-card" data-provider="system">
                    <span class="protocol-nav-card-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                    </span>
                    <span class="protocol-nav-card-label">系统地图</span>
                </button>
            </div>
            <button type="button" class="protocol-nav-close" id="protocol-nav-close" aria-label="关闭">
                <span class="protocol-nav-close-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </span>
                关闭
            </button>
        `;
        document.body.appendChild(scrimEl);
        document.body.appendChild(sheetEl);

        sheetEl.querySelector('#protocol-nav-close').addEventListener('click', closeSheet);
        sheetEl.querySelectorAll('.protocol-nav-card').forEach((btn) => {
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
