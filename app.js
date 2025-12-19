// 1. DEFINICIÓN DE VARIABLES GLOBALES E INICIALIZACIÓN
const APP_VERSION = 'v32'; 
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let navigationHistory = [];
let mesActualCal = new Date().getMonth();
let añoActualCal = new Date().getFullYear();
let turnoSeleccionadoCal = 'T2';

const appContent = document.getElementById('app-content');
const backButton = document.getElementById('back-button');

let FIREBASE_DATA = { VEHICLES: [], DETAILS: {}, MATERIALS: {} };

// 2. PUNTO DE INICIO Y GESTIÓN DE PWA
document.addEventListener('DOMContentLoaded', () => {
    if (!appContent || !backButton) return;

    initializeApp(); 
    
    if ('serviceWorker' in navigator) {
        const savedVersion = localStorage.getItem('app_version');
        if (savedVersion && savedVersion !== APP_VERSION) {
            showUpdateNotice();
        }
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            localStorage.setItem('app_version', APP_VERSION);
        });
    }
});

// 3. CARGA DE DATOS Y ACTUALIZACIÓN
async function initializeApp() {
    render(`<div style="text-align:center; padding-top: 50px;"><p>Sincronizando Gijón...</p><div class="loader"></div></div>`, 'Cargando...', { level: -1 }, false);
    await loadFirebaseData();
    renderDashboard();
}

async function loadFirebaseData() {
    try {
        const vehiclesSnapshot = await db.collection("vehicles").get();
        FIREBASE_DATA.VEHICLES = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const materialsSnapshot = await db.collection("materials").get();
        materialsSnapshot.docs.forEach(doc => { FIREBASE_DATA.MATERIALS[doc.id] = doc.data(); });

        const detailsSnapshot = await db.collection("details").get();
        detailsSnapshot.docs.forEach(doc => { FIREBASE_DATA.DETAILS[doc.id] = doc.data(); });
    } catch (e) { console.error("Error Firebase:", e); }
}

function showUpdateNotice() {
    if (document.getElementById('update-banner')) return;
    const aviso = document.createElement('div');
    aviso.id = 'update-banner';
    aviso.style = "position:fixed; top:70px; left:10px; right:10px; background:#AA1915; color:white; padding:15px; border-radius:8px; z-index:10005; text-align:center; font-weight:bold; border:2px solid white; box-shadow: 0 5px 15px rgba(0,0,0,0.3);";
    aviso.innerHTML = `ACTUALIZACIÓN LISTA <button onclick="forzarActualizacion()" style="margin-left:10px; padding:5px 15px; border-radius:5px; border:none; background:white; color:#AA1915; font-weight:bold; cursor:pointer;">ACTUALIZAR</button>`;
    document.body.appendChild(aviso);
}

function forzarActualizacion() {
    localStorage.setItem('app_version', APP_VERSION);
    window.location.reload(true);
}

// 4. MOTOR DE RENDERIZADO
function render(contentHTML, title, state, isBack = false) {
    appContent.innerHTML = contentHTML;
    document.querySelector('header h1').textContent = title;

    if (!isBack) {
        navigationHistory.push(state);
        history.pushState({ stateIndex: navigationHistory.length - 1 }, title);
    }

    const logoImg = document.getElementById('header-logo-img');
    if (state.level === 0) {
        logoImg.src = "images/favicon.png";
        backButton.style.display = 'none';
    } else {
        logoImg.src = "images/home-icon.png";
        backButton.style.display = 'inline';
    }
}

// 5. VISOR DE RECURSOS (PDF/FOTOS/VÍDEOS)
function renderResource(materialId, url, type, resourceName, isBack = false) {
    if (type === 'pdf') {
        const material = FIREBASE_DATA.MATERIALS[materialId];
        const docEntry = material.docs.find(d => d.url === url);
        let downloadUrl = (docEntry && docEntry.url_download) ? docEntry.url_download : url;

        if (downloadUrl.includes('drive.google.com/file/d/')) {
            const fileId = downloadUrl.split('/d/')[1].split('/')[0];
            downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }

        const absolutePdfUrl = window.location.origin + window.location.pathname.replace('index.html', '') + url;

        const contentPdf = `
            <div class="resource-container-wrapper" style="height: calc(100vh - 65px); width: 100%; position: relative; background: #525659;">
                <embed src="${absolutePdfUrl}" type="application/pdf" width="100%" height="100%" style="border: none;">
                <a href="${downloadUrl}" target="_blank" rel="noopener noreferrer" 
                   style="position:fixed; bottom:25px; right:15px; background:#AA1915; color:white; padding:12px 20px; border-radius:50px; text-decoration:none; font-weight:bold; box-shadow: 0 4px 15px rgba(0,0,0,0.4); z-index:10002; display:flex; align-items:center; gap:8px; border:2px solid white;">
                   DESCARGAR PDF 🔍
                </a>
            </div>`;
        render(contentPdf, resourceName, { level: 6, materialId, url, type, resourceName }, isBack);
        return;
    }
    let media = (type === 'photo') ? `<img src="${url}" class="centered-resource">` : `<div class="video-container centered-resource"><iframe src="${url}" frameborder="0" allowfullscreen></iframe></div>`;
    render(`<div class="resource-container-wrapper">${media}</div>`, resourceName, { level: 6, materialId, url, type, resourceName }, isBack);
}

// 6. NAVEGACIÓN Y DASHBOARD
function navigateToSection(id) {
    if (id === 'inventario') renderVehiclesList();
    if (id === 'material_global') renderGlobalMaterialList();
    if (id === 'mapa') renderMapaSection();
    if (id === 'calendario') renderCalendarioSection();
}

function renderDashboard(isBack = false) {
    const html = SECCIONES_INICIO.map(s => `
        <div class="dashboard-item" onclick="navigateToSection('${s.id}')">
            <img src="${s.image_url}" class="dashboard-icon"><p>${s.name}</p>
        </div>`).join('');
    render(`<div class="dashboard-grid">${html}</div>`, 'Bomberos Gijón', { level: 0 }, isBack);
}

function renderVehiclesList(isBack = false) {
    const html = FIREBASE_DATA.VEHICLES.map(v => `
        <div class="list-item vehicle-card" onclick="showVehicleViews('${v.id}')">
            <img src="${v.image}" class="vehicle-thumb">
            <div class="vehicle-info"><h2>${v.name}</h2><p>${v.description}</p></div>
        </div>`).join('');
    render(`<div class="grid-container">${html}</div>`, 'VEHÍCULOS', { level: 1 }, isBack);
}

// 7. VISTAS, HOTSPOTS Y ARMARIOS
function showVehicleViews(vId, isBack = false) {
    const detail = FIREBASE_DATA.DETAILS[vId];
    const html = detail.views.map(view => `
        <div class="list-item vehicle-card" onclick="${view.direct_access ? `showArmarioMaterial('${vId}', '${view.id}', 0)` : `showViewHotspots('${vId}', '${view.id}')`}">
            <img src="${view.image}" class="vehicle-thumb"><div class="vehicle-info"><h2>${view.name}</h2></div>
        </div>`).join('');
    render(`<div class="grid-container">${html}</div>`, FIREBASE_DATA.VEHICLES.find(v => v.id === vId).name, { level: 2, vehicleId: vId }, isBack);
}

function showViewHotspots(vehicleId, viewId, isBack = false) {
    const detail = FIREBASE_DATA.DETAILS[vehicleId];
    const view = detail.views.find(v => v.id === viewId);
    const hotspots = detail.hotspots[viewId] || [];
    let hotspotsHTML = hotspots.map((h, index) => {
        const parts = h.name.trim().split(/\s+/);
        let shortName = (parts.length >= 2 && !isNaN(parseInt(parts[parts.length-1]))) ? parts[0].charAt(0).toUpperCase() + parts[parts.length-1] : h.name;
        return `<div class="hotspot" style="${h.style}" onclick="showArmarioMaterial('${vehicleId}', '${viewId}', ${index})"><span class="hotspot-label">${shortName}</span></div>`;
    }).join('');
    render(`<div style="position: relative;"><img src="${view.image}" style="width: 100%;">${hotspotsHTML}</div>`, view.name, { level: 3, vehicleId, viewId }, isBack);
}

function showArmarioMaterial(vId, viewId, hIndex, isBack = false) {
    const hotspot = FIREBASE_DATA.DETAILS[vId].hotspots[viewId][hIndex];
    let html = hotspot.armario_image ? `<div class="armario-image-container"><img src="${hotspot.armario_image}" class="armario-image"></div>` : '';
    const tableHeader = `<div class="inventory-row inventory-header"><div class="col-qty">nº</div><div class="col-name">Material</div></div>`;
    
    const renderItems = (items) => items.map(item => {
        const m = FIREBASE_DATA.MATERIALS[item.id];
        if (!m) return '';
        const extra = (m.description || (m.docs && m.docs.length > 0));
        return `<div class="inventory-row ${m.is_kit ? 'kit-row' : ''}" onclick="${m.is_kit ? `showKitInventory('${item.id}', '${hotspot.name}')` : extra ? `showMaterialDetails('${item.id}')` : ''}">
                    <div class="col-qty">${item.qty}</div><div class="col-name">${m.name}${extra && !m.is_kit ? ' 👁️' : ''}</div>
                </div>`;
    }).join('');

    if (hotspot.sections) {
        html += hotspot.sections.map(s => `<div class="inventory-table-container"><h4>${s.name}</h4><div class="inventory-table">${tableHeader}${renderItems(s.items)}</div></div>`).join('');
    } else {
        html += `<div class="inventory-table">${tableHeader}${renderItems(hotspot.inventory || [])}</div>`;
    }
    render(html, hotspot.name, { level: 4, vehicleId: vId, viewId, hotspotIndex: hIndex }, isBack);
}

function showKitInventory(kitId, parentName, isBack = false) {
    const kit = FIREBASE_DATA.MATERIALS[kitId];
    if (!kit || !kit.kit_contents) return;
    const html = `<div class="inventory-table">${kit.kit_contents.map(i => `<div class="inventory-row" onclick="showMaterialDetails('${i.id}')"><div class="col-qty">${i.qty}</div><div class="col-name">${FIREBASE_DATA.MATERIALS[i.id].name} 👁️</div></div>`).join('')}</div>`;
    render(html, kit.name, { level: 4.5, kitId, parentName }, isBack);
}

function showMaterialDetails(mId, isBack = false) {
    const m = FIREBASE_DATA.MATERIALS[mId];
    if (!m) return;
    const docs = (m.docs || []).filter(d => d.url && d.name);
    const mainPhoto = docs.find(d => d.type === 'photo');
    const resources = docs.filter(d => d !== mainPhoto).map(d => `<div class="list-item" onclick="renderResource('${mId}', '${d.url}', '${d.type}', '${d.name}')"><strong>📄 Ver ${d.name}</strong></div>`).join('');
    
    const html = `
        <div class="material-detail-container">
            ${mainPhoto ? `<img src="${mainPhoto.url}" class="material-main-img">` : ''}
            <div class="material-text"><p>${m.description || ''}</p></div>
        </div>
        ${resources ? `<hr><h3>Recursos</h3>${resources}` : ''}`;
    render(html, m.name, { level: 5, materialId: mId }, isBack);
}

// 8. BUSCADOR GLOBAL
function renderGlobalMaterialList(isBack = false) {
    const html = `
        <div class="search-container" style="padding:10px;"><input type="text" id="material-search" placeholder="🔍 Buscar material..." oninput="filterMaterials(this.value)" style="width:100%; padding:12px; border-radius:8px; border:1px solid #ccc;"></div>
        <div id="global-material-table" class="inventory-table">${generateGlobalTableHTML('')}</div>`;
    render(html, 'BUSCADOR', { level: 1, section: 'material_global' }, isBack);
}

function generateGlobalTableHTML(filter = '') {
    const searchTerm = filter.toLowerCase();
    const ids = Object.keys(FIREBASE_DATA.MATERIALS).filter(id => FIREBASE_DATA.MATERIALS[id].name.toLowerCase().includes(searchTerm)).sort((a,b) => FIREBASE_DATA.MATERIALS[a].name.localeCompare(FIREBASE_DATA.MATERIALS[b].name));
    return ids.map(id => `<div class="inventory-row" onclick="showGlobalMaterialDetail('${id}')"><div class="col-name" style="padding-left:20px;">${FIREBASE_DATA.MATERIALS[id].name}</div></div>`).join('');
}

function filterMaterials(text) { document.getElementById('global-material-table').innerHTML = generateGlobalTableHTML(text); }

function showGlobalMaterialDetail(mId, isBack = false) {
    let ubicaciones = [];
    Object.keys(FIREBASE_DATA.DETAILS).forEach(vId => {
        const hotspotsData = FIREBASE_DATA.DETAILS[vId].hotspots;
        Object.keys(hotspotsData).forEach(viewId => {
            hotspotsData[viewId].forEach((h, hIdx) => {
                if (h.inventory?.some(i => i.id === mId)) {
                    ubicaciones.push({ vId, vName: FIREBASE_DATA.VEHICLES.find(v => v.id === vId).name, viewId, hIdx, name: h.name });
                }
            });
        });
    });
    const ubicHTML = ubicaciones.map(u => `<div class="list-item" onclick="showArmarioMaterial('${u.vId}', '${u.viewId}', ${u.hIdx})"><strong>${u.vName}</strong>: ${u.name} ➔</div>`).join('');
    const m = FIREBASE_DATA.MATERIALS[mId];
    render(`<div class="material-text">${m.description || ''}</div><h3>📍 Ubicaciones</h3>${ubicHTML}`, m.name, { level: 5, materialId: mId, section: 'material_global' }, isBack);
}

// 9. CALENDARIO
function renderCalendarioSection(isBack = false) {
    const botones = TURNOS_CONFIG.map(t => `<button class="turno-btn-small" style="background-color: ${t.color}" onclick="cambiarTurnoCal('${t.id}')">${t.id}</button>`).join('');
    const html = `<div class="calendar-header-compact"><div class="turno-row">${botones}</div></div><div class="calendar-nav"><button onclick="navegarMes(-1)">&#10140;</button><div id="mes-titulo-container" class="select-nav-container"></div><button onclick="navegarMes(1)">&#10140;</button></div><div id="calendar-view-container" class="calendar-view"></div>`;
    render(html, 'Calendario', { level: 1, section: 'calendario' }, isBack);
    actualizarVistaCalendario();
}

function calcularTurnoGuardia(fecha) {
    const inicioRef = Date.UTC(2024, 0, 1);
    const fechaUTC = Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const diasTotal = Math.round((fechaUTC - inicioRef) / (1000 * 60 * 60 * 24));
    let ciclo = (diasTotal + 1) % 5;
    if (ciclo < 0) ciclo += 5;
    return ciclo === 0 ? 5 : ciclo;
}

function actualizarVistaCalendario() {
    const container = document.getElementById('calendar-view-container');
    const navContainer = document.getElementById('mes-titulo-container');
    if (!container || !navContainer) return;
    const infoTurno = TURNOS_CONFIG.find(t => t.id === turnoSeleccionadoCal);
    navContainer.innerHTML = `<span>${obtenerNombreMes(mesActualCal)} ${añoActualCal}</span>`;
    let tablaHTML = `<table class="tabla-calendario"><thead><tr><th>Lu</th><th>Ma</th><th>Mi</th><th>Ju</th><th>Vi</th><th>Sá</th><th>Do</th></tr></thead><tbody><tr>`;
    const diasMes = new Date(añoActualCal, mesActualCal + 1, 0).getDate();
    let primerDia = new Date(añoActualCal, mesActualCal, 1).getDay() || 7;
    for (let i = 1; i < primerDia; i++) tablaHTML += '<td></td>';
    for (let dia = 1; dia <= diasMes; dia++) {
        const fecha = new Date(añoActualCal, mesActualCal, dia);
        const esMiGuardia = (calcularTurnoGuardia(fecha) === parseInt(turnoSeleccionadoCal.replace('T', '')));
        let estilo = esMiGuardia ? `background-color:${infoTurno.color}; color:white;` : '';
        tablaHTML += `<td style="${estilo}">${dia}</td>`;
        if (fecha.getDay() === 0 && dia !== diasMes) tablaHTML += '</tr><tr>';
    }
    container.innerHTML = tablaHTML + `</tr></tbody></table>`;
}

function navegarMes(d) { mesActualCal+=d; if(mesActualCal<0){mesActualCal=11; añoActualCal--;} if(mesActualCal>11){mesActualCal=0; añoActualCal++;} actualizarVistaCalendario(); }
function cambiarTurnoCal(id) { turnoSeleccionadoCal=id; actualizarVistaCalendario(); }
function obtenerNombreMes(n) { return ["Enero", "Febrero", "Marzo", "Abril", "Mayo", " Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][n]; }

// 10. NAVEGACIÓN ATRÁS (PASO A PASO)
function handleBackNavigation() {
    if (navigationHistory.length > 1) {
        navigationHistory.pop(); 
        const target = navigationHistory[navigationHistory.length - 1];
        window.scrollTo(0, 0);

        if (target.level === 0) renderDashboard(true);
        else if (target.level === 1) {
            if (target.section === 'material_global') renderGlobalMaterialList(true);
            else if (target.section === 'calendario') renderCalendarioSection(true);
            else renderVehiclesList(true);
        }
        else if (target.level === 2) showVehicleViews(target.vehicleId, true);
        else if (target.level === 3) showViewHotspots(target.vehicleId, target.viewId, true);
        else if (target.level === 4) showArmarioMaterial(target.vehicleId, target.viewId, target.hotspotIndex, true);
        else if (target.level === 4.5) showKitInventory(target.kitId, target.parentName, true);
        else if (target.level === 5) showMaterialDetails(target.materialId, true);
    } else {
        renderDashboard(true);
    }
}

// ASIGNACIÓN DE EVENTOS
if (backButton) { backButton.addEventListener('click', (e) => { e.preventDefault(); history.back(); }); }
window.onpopstate = handleBackNavigation;
function goToHome() { navigationHistory = []; renderDashboard(); }








































































