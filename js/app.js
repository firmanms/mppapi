/**
 * MPP Bandung Virtual Tour API Explorer - Application Logic
 * Interactive Data Fetcher, State Management & JSON Viewer
 */

const API_CONFIG = {
    MAIN_VT: 'https://mpp.bandungkab.com/api/vt',
    INSTANSI: 'https://mpp.bandungkab.com/api/vt/instansi',
    LAYANAN: 'https://mpp.bandungkab.com/api/vt/layanan'
};

// Global App State
const state = {
    rawVtData: null,
    instansiList: [],
    floors: [],
    meta: {},
    activeFloor: 'Semua Lantai',
    searchQuery: '',
    selectedInstansi: null,
    selectedLayanan: null,
    currentConsoleUrl: API_CONFIG.MAIN_VT,
    lastConsoleResponse: null,
    activeCodeSnippet: 'js'
};

// DOM Elements Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initConsole();
    initEvents();
    
    // Fetch initial dataset on launch
    fetchMainVTData();
});

/**
 * Universal Fetch Helper with Proxy Fallback for CORS
 */
async function fetchApiData(targetUrl) {
    const startTime = performance.now();
    try {
        // First try direct fetch
        const response = await fetch(targetUrl, {
            headers: { 'Accept': 'application/json' }
        });
        const duration = Math.round(performance.now() - startTime);
        
        if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
        const json = await response.json();
        
        return {
            ok: true,
            status: response.status,
            latency: duration,
            data: json
        };
    } catch (directError) {
        console.warn('Direct API fetch failed/CORS, attempting server proxy fallback...', directError);
        // Fallback to local Express proxy if running via server.js
        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
            const response = await fetch(proxyUrl);
            const duration = Math.round(performance.now() - startTime);
            const json = await response.json();
            
            if (json.status === 'success') {
                return {
                    ok: true,
                    status: json.statusCode || 200,
                    latency: json.latencyMs || duration,
                    data: json.data
                };
            } else {
                throw new Error(json.message || 'Proxy request failed');
            }
        } catch (proxyError) {
            return {
                ok: false,
                status: 500,
                latency: Math.round(performance.now() - startTime),
                error: proxyError.message || 'Gagal terhubung ke API'
            };
        }
    }
}

/**
 * Fetch Main Virtual Tour Data
 */
async function fetchMainVTData() {
    showGlobalLoading(true);
    const result = await fetchApiData(API_CONFIG.MAIN_VT);
    showGlobalLoading(false);

    if (result.ok && result.data && result.data.data) {
        state.rawVtData = result.data;
        state.instansiList = result.data.data.instansi || [];
        state.floors = result.data.data.floors || ['Semua Lantai'];
        state.meta = result.data.data.meta || {};

        // Render UI Components
        renderMetrics();
        renderFloorFilters();
        renderInstansiGrid();
        populateInstansiDropdown();
        
        // Console auto update
        updateConsoleOutput(result);
    } else {
        alert('Gagal mengambil data dari API Virtual Tour: ' + (result.error || 'Unknown error'));
    }
}

/**
 * Tab Navigation Setup
 */
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

/**
 * Render Upper Metrics Counters
 */
function renderMetrics() {
    document.getElementById('metric-instansi').textContent = state.meta.totalInstansi || state.instansiList.length;
    document.getElementById('metric-layanan').textContent = state.meta.totalLayanan || 0;
    document.getElementById('metric-floors').textContent = state.floors.length > 1 ? (state.floors.length - 1) : state.floors.length;
}

/**
 * Render Floor Filter Pills
 */
function renderFloorFilters() {
    const container = document.getElementById('floor-filters');
    container.innerHTML = '';

    state.floors.forEach(floor => {
        const pill = document.createElement('button');
        pill.className = `filter-pill ${floor === state.activeFloor ? 'active' : ''}`;
        pill.textContent = floor;
        pill.addEventListener('click', () => {
            state.activeFloor = floor;
            renderFloorFilters();
            renderInstansiGrid();
        });
        container.appendChild(pill);
    });
}

/**
 * Render Cards Grid of Instansi
 */
function renderInstansiGrid() {
    const grid = document.getElementById('instansi-grid');
    grid.innerHTML = '';

    const filtered = state.instansiList.filter(item => {
        const matchFloor = state.activeFloor === 'Semua Lantai' || (item.lantai && item.lantai.includes(state.activeFloor)) || (item.lokasiLoket && item.lokasiLoket.includes(state.activeFloor));
        const matchSearch = item.nama.toLowerCase().includes(state.searchQuery.toLowerCase()) || (item.slug && item.slug.toLowerCase().includes(state.searchQuery.toLowerCase()));
        return matchFloor && matchSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p>Tidak ada instansi yang cocok dengan kriteria pencarian.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'instansi-card';
        
        const categoryBadgeClass = item.kategori?.slug === 'pemerintah' ? 'badge-pemerintah' : (item.kategori?.slug === 'bumd' ? 'badge-bumd' : 'badge-bumn');
        const logoElement = item.logo 
            ? `<img src="${fixImageUrl(item.logo)}" class="instansi-logo" alt="${item.nama}" onerror="this.outerHTML='<div class=\\'instansi-logo-fallback\\'><i class=\\'fa-solid fa-building\\'></i></div>'">`
            : `<div class="instansi-logo-fallback"><i class="fa-solid fa-building"></i></div>`;

        card.innerHTML = `
            <div>
                <div class="instansi-header">
                    ${logoElement}
                    <div class="instansi-title">
                        <h3>${escapeHtml(item.nama)}</h3>
                        <span class="badge ${categoryBadgeClass}">${escapeHtml(item.kategori?.nama || 'Lainnya')}</span>
                    </div>
                </div>
                <div class="instansi-details">
                    <div class="item"><i class="fa-solid fa-location-dot"></i> <span>${escapeHtml(item.lokasiLoket || 'Loket MPP')}</span></div>
                    <div class="item"><i class="fa-solid fa-clock"></i> <span>${escapeHtml(item.jamPelayanan || 'Senin - Jumat')}</span></div>
                    ${item.kontak ? `<div class="item"><i class="fa-solid fa-phone"></i> <span>${escapeHtml(item.kontak)}</span></div>` : ''}
                </div>
            </div>
            <div class="instansi-footer">
                <span class="layanan-count"><i class="fa-solid fa-briefcase"></i> ${item._count?.layanan || 0} Layanan</span>
                <button class="btn-action" onclick="viewInstansiDetail('${item.slug}')">
                    Detail <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

/**
 * Populate Instansi Dropdown Selector in Detail Tab
 */
function populateInstansiDropdown() {
    const select = document.getElementById('select-instansi');
    select.innerHTML = '<option value="">-- Pilih Instansi --</option>';

    state.instansiList.forEach(item => {
        const option = document.createElement('option');
        option.value = item.slug;
        option.textContent = item.nama;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        if (e.target.value) {
            fetchInstansiDetail(e.target.value);
        }
    });
}

/**
 * View Instansi Detail Programmatically
 */

window.viewInstansiDetail = function(slug) {
    // Switch tab to Instansi Detail
    document.querySelector('[data-tab="tab-instansi"]').click();
    document.getElementById('select-instansi').value = slug;
    fetchInstansiDetail(slug);
};

/**
 * Fetch and Render Instansi Detail View
 */
async function fetchInstansiDetail(slug) {
    const container = document.getElementById('instansi-detail-content');
    container.innerHTML = `<div style="text-align: center; padding: 3rem;"><div class="spinner"></div><p style="margin-top: 1rem; color: var(--text-muted);">Mengambil data instansi (${slug})...</p></div>`;

    const url = `${API_CONFIG.INSTANSI}/${slug}`;
    const result = await fetchApiData(url);

    if (result.ok && result.data && result.data.data) {
        const detail = result.data.data;
        state.selectedInstansi = detail;
        
        // Auto update console output
        state.currentConsoleUrl = url;
        document.getElementById('console-url').value = url;
        updateConsoleOutput(result);

        const logoHtml = detail.logo 
            ? `<img src="${fixImageUrl(detail.logo)}" class="detail-hero-logo" alt="${detail.nama}">`
            : `<div class="instansi-logo-fallback" style="width: 80px; height: 80px; font-size: 2.2rem;"><i class="fa-solid fa-building"></i></div>`;

        let layananCardsHtml = '';
        if (detail.layanan && detail.layanan.length > 0) {
            layananCardsHtml = detail.layanan.map(lay => `
                <div class="layanan-item-card">
                    <div class="layanan-item-header">
                        <h4>${escapeHtml(lay.nama)}</h4>
                        <span class="badge ${lay.status === 'gratis' ? 'badge-gratis' : 'badge-berbayar'}">
                            ${lay.status === 'gratis' ? '<i class="fa-solid fa-check"></i> Gratis' : '<i class="fa-solid fa-coins"></i> Berbayar'}
                        </span>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.8rem;">
                        ${lay.deskripsi ? stripHtml(lay.deskripsi).substring(0, 180) + '...' : 'Tidak ada deskripsi singkat.'}
                    </div>
                    <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-muted); align-items: center; justify-content: space-between;">
                        <span><i class="fa-solid fa-hourglass-half"></i> ${escapeHtml(lay.waktuPenyelesaian || '-')}</span>
                        <button class="btn-action" onclick="viewLayananDetail('${lay.slug}')">
                            Detail Layanan <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            layananCardsHtml = `<p style="color: var(--text-muted);">Belum ada layanan yang terdaftar untuk instansi ini.</p>`;
        }

        container.innerHTML = `
            <div class="detail-hero">
                ${logoHtml}
                <div class="detail-hero-info">
                    <h2>${escapeHtml(detail.nama)}</h2>
                    <span class="badge badge-pemerintah">${escapeHtml(detail.kategori?.nama || 'Instansi')}</span>
                    <div style="margin-top: 0.8rem; font-size: 0.9rem; color: var(--text-secondary);">
                        ${detail.deskripsi || ''}
                    </div>
                </div>
            </div>

            <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <div class="metric-card">
                    <div class="metric-icon"><i class="fa-solid fa-location-dot"></i></div>
                    <div class="metric-info">
                        <h4>Lokasi Loket</h4>
                        <div style="font-size: 0.95rem; font-weight: 600;">${escapeHtml(detail.lokasiLoket || '-')}</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i class="fa-solid fa-clock"></i></div>
                    <div class="metric-info">
                        <h4>Jam Pelayanan</h4>
                        <div style="font-size: 0.95rem; font-weight: 600;">${escapeHtml(detail.jamPelayanan || '-')}</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i class="fa-solid fa-phone"></i></div>
                    <div class="metric-info">
                        <h4>Kontak</h4>
                        <div style="font-size: 0.95rem; font-weight: 600;">${escapeHtml(detail.kontak || '-')}</div>
                    </div>
                </div>
            </div>

            <h3 style="font-family: var(--font-heading); margin-top: 2rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.6rem;">
                <i class="fa-solid fa-layer-group" style="color: var(--accent-emerald);"></i> Daftar Layanan (${detail.layanan ? detail.layanan.length : 0})
            </h3>
            <div class="layanan-list">
                ${layananCardsHtml}
            </div>
        `;

        // Also populate Layanan dropdown options
        populateLayananDropdown(detail.layanan || []);
    } else {
        container.innerHTML = `<p style="color: var(--status-error);">Gagal memuat detail instansi. Silakan coba lagi.</p>`;
    }
}

/**
 * Populate Layanan Dropdown Selector
 */
function populateLayananDropdown(layananList) {
    const select = document.getElementById('select-layanan');
    select.innerHTML = '<option value="">-- Pilih Layanan --</option>';

    layananList.forEach(item => {
        const option = document.createElement('option');
        option.value = item.slug;
        option.textContent = item.nama;
        select.appendChild(option);
    });
}

/**
 * View Layanan Detail Programmatically
 */
window.viewLayananDetail = function(slug) {
    document.querySelector('[data-tab="tab-layanan"]').click();
    fetchLayananDetail(slug);
};

/**
 * Fetch and Render Service Detail
 */
async function fetchLayananDetail(slug) {
    const container = document.getElementById('layanan-detail-content');
    container.innerHTML = `<div style="text-align: center; padding: 3rem;"><div class="spinner"></div><p style="margin-top: 1rem; color: var(--text-muted);">Mengambil detail layanan (${slug})...</p></div>`;

    const url = `${API_CONFIG.LAYANAN}/${slug}`;
    const result = await fetchApiData(url);

    if (result.ok && result.data && result.data.data) {
        const detail = result.data.data;
        state.selectedLayanan = detail;

        // Auto update console output
        state.currentConsoleUrl = url;
        document.getElementById('console-url').value = url;
        updateConsoleOutput(result);

        container.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                    <div>
                        <h2 style="font-family: var(--font-heading); font-size: 1.6rem; color: var(--text-primary); margin-bottom: 0.3rem;">
                            ${escapeHtml(detail.nama)}
                        </h2>
                        <span class="badge ${detail.status === 'gratis' ? 'badge-gratis' : 'badge-berbayar'}">
                            ${detail.status === 'gratis' ? '<i class="fa-solid fa-check"></i> Gratis' : '<i class="fa-solid fa-coins"></i> ' + escapeHtml(detail.biaya)}
                        </span>
                    </div>
                    ${detail.instansi ? `
                        <div style="text-align: right;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">Instansi Penyedia:</span>
                            <div style="font-weight: 700; color: var(--accent-emerald);">${escapeHtml(detail.instansi.nama)}</div>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="info-section">
                <h4><i class="fa-solid fa-align-left"></i> Deskripsi Layanan</h4>
                <div class="info-box-text">${detail.deskripsi ? stripHtml(detail.deskripsi) : 'Tidak ada deskripsi.'}</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="info-section">
                    <h4><i class="fa-solid fa-list-check"></i> Persyaratan Berkas</h4>
                    <div class="info-box-text">${detail.persyaratan ? stripHtml(detail.persyaratan) : 'Tidak ada syarat khusus.'}</div>
                </div>
                <div class="info-section">
                    <h4><i class="fa-solid fa-diagram-project"></i> Prosedur & Alur</h4>
                    <div class="info-box-text">${detail.prosedur ? stripHtml(detail.prosedur) : 'Sesuai petunjuk petugas loket.'}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="metric-card">
                    <div class="metric-icon"><i class="fa-solid fa-stopwatch"></i></div>
                    <div class="metric-info">
                        <h4>Waktu Penyelesaian</h4>
                        <div style="font-size: 1rem; font-weight: 700;">${escapeHtml(detail.waktuPenyelesaian || '-')}</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i class="fa-solid fa-wallet"></i></div>
                    <div class="metric-info">
                        <h4>Biaya Layanan</h4>
                        <div style="font-size: 1rem; font-weight: 700;">${escapeHtml(detail.biaya || 'Gratis')}</div>
                    </div>
                </div>
            </div>

            ${detail.dasarHukum ? `
                <div class="info-section">
                    <h4><i class="fa-solid fa-scale-balanced"></i> Dasar Hukum</h4>
                    <div class="info-box-text">${stripHtml(detail.dasarHukum)}</div>
                </div>
            ` : ''}

            ${detail.pengaduan ? `
                <div class="info-section">
                    <h4><i class="fa-solid fa-headset"></i> Layanan Pengaduan</h4>
                    <div class="info-box-text">${stripHtml(detail.pengaduan)}</div>
                </div>
            ` : ''}
        `;
    } else {
        container.innerHTML = `<p style="color: var(--status-error);">Gagal memuat detail layanan (${slug}).</p>`;
    }
}

/**
 * Initialize API Console & JSON Inspector
 */
function initConsole() {
    const inputUrl = document.getElementById('console-url');
    const btnSend = document.getElementById('btn-send-console');
    const selectLayanan = document.getElementById('select-layanan');

    selectLayanan.addEventListener('change', (e) => {
        if (e.target.value) {
            fetchLayananDetail(e.target.value);
        }
    });

    btnSend.addEventListener('click', async () => {
        const url = inputUrl.value.trim();
        if (!url) return;
        
        btnSend.innerHTML = '<div class="spinner"></div> Sending...';
        btnSend.disabled = true;

        const result = await fetchApiData(url);
        updateConsoleOutput(result);

        btnSend.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Request';
        btnSend.disabled = false;
    });

    // Copy JSON Button
    document.getElementById('btn-copy-json').addEventListener('click', () => {
        if (state.lastConsoleResponse) {
            navigator.clipboard.writeText(JSON.stringify(state.lastConsoleResponse.data || state.lastConsoleResponse, null, 2));
            alert('JSON berhasil disalin ke clipboard!');
        }
    });

    // Export JSON File Button
    document.getElementById('btn-export-json').addEventListener('click', () => {
        if (state.lastConsoleResponse) {
            const blob = new Blob([JSON.stringify(state.lastConsoleResponse.data || state.lastConsoleResponse, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mpp-vt-data-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    });

    // Code Snippet Tabs
    const codeBtns = document.querySelectorAll('.code-tab-btn');
    codeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            codeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeCodeSnippet = btn.getAttribute('data-lang');
            renderCodeSnippet();
        });
    });
}

/**
 * Update Console Output & Syntax Highlighting
 */
function updateConsoleOutput(result) {
    state.lastConsoleResponse = result;
    
    document.getElementById('console-status').textContent = `${result.status} ${result.ok ? 'OK' : 'Error'}`;
    document.getElementById('console-status').style.color = result.ok ? 'var(--status-success)' : 'var(--status-error)';
    document.getElementById('console-latency').textContent = `${result.latency} ms`;

    const viewer = document.getElementById('json-output');
    if (result.data) {
        viewer.innerHTML = syntaxHighlightJson(result.data);
    } else {
        viewer.textContent = JSON.stringify(result, null, 2);
    }

    renderCodeSnippet();
}

/**
 * Syntax Highlighter for JSON Code Block
 */
function syntaxHighlightJson(jsonObj) {
    let jsonStr = JSON.stringify(jsonObj, null, 2);
    jsonStr = jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return jsonStr.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            } else {
                cls = 'json-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
    });
}

/**
 * Render Code Snippet Generator
 */
function renderCodeSnippet() {
    const url = document.getElementById('console-url').value;
    const box = document.getElementById('code-snippet-box');
    let code = '';

    switch(state.activeCodeSnippet) {
        case 'js':
            code = `fetch("${url}")\n  .then(res => res.json())\n  .then(data => console.log(data));`;
            break;
        case 'curl':
            code = `curl -X GET "${url}" -H "Accept: application/json"`;
            break;
        case 'python':
            code = `import requests\n\nresponse = requests.get("${url}")\ndata = response.json()\nprint(data)`;
            break;
        case 'php':
            code = `<?php\n$json = file_get_contents("${url}");\n$data = json_decode($json, true);\nprint_r($data);`;
            break;
    }

    box.textContent = code;
}

/**
 * Event Listeners for Search
 */
function initEvents() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        renderInstansiGrid();
    });
}

// Helper Utilities
function fixImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `https://mpp.bandungkab.com${url}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

function showGlobalLoading(show) {
    const el = document.getElementById('global-loading');
    if (el) el.style.display = show ? 'block' : 'none';
}
