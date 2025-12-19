// 1. Configuración e Inicialización
const APP_VERSION = 'bomberos-v30'; // <--- DEBE COINCIDIR CON EL SERVICE-WORKER
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let navigationHistory = [];
let FIREBASE_DATA = { VEHICLES: [], DETAILS: {}, MATERIALS: {} };

document.addEventListener('DOMContentLoaded', () => {
    initializeApp(); 
    
    if ('serviceWorker' in navigator) {
        // Solo mostramos el aviso si la versión guardada es distinta a la actual
        const savedVersion = localStorage.getItem('app_version');
        if (savedVersion && savedVersion !== APP_VERSION) {
            showUpdateNotice();
        }

        // Si el Service Worker cambia, preparamos la marca de actualización
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            localStorage.setItem('app_version', APP_VERSION);
        });
    }
});

function showUpdateNotice() {
    if (document.getElementById('update-banner')) return;
    const aviso = document.createElement('div');
    aviso.id = 'update-banner';
    // Estilo superior para que no estorbe abajo
    aviso.style = "position:fixed; top:70px; left:10px; right:10px; background:#AA1915; color:white; padding:15px; border-radius:8px; z-index:10005; text-align:center; font-weight:bold; border:2px solid white; box-shadow: 0 5px 15px rgba(0,0,0,0.3);";
    aviso.innerHTML = `NUEVA VERSIÓN LISTA <button onclick="forzarActualizacion()" style="margin-left:10px; padding:5px 15px; border-radius:5px; border:none; background:white; color:#AA1915; font-weight:bold; cursor:pointer;">ACTUALIZAR</button>`;
    document.body.appendChild(aviso);
}

function forzarActualizacion() {
    localStorage.setItem('app_version', APP_VERSION); // Guardamos que ya actualizamos
    window.location.reload(true); // Forzamos recarga del servidor
}

async function initializeApp() {
    render(`<div style="text-align:center; padding-top: 50px;"><p>Cargando inventario de Gijón...</p><div class="loader"></div></div>`, 'Cargando...', { level: -1 }, false);
    await loadFirebaseData();
    renderDashboard();
}

// 3. Función renderResource (Visor GitHub + Descarga Drive)
function renderResource(materialId, url, type, resourceName, isBack = false) {
    if (type === 'pdf') {
        const material = FIREBASE_DATA.MATERIALS[materialId];
        const docEntry = material.docs.find(d => d.url === url);
        let downloadUrl = (docEntry && docEntry.url_download) ? docEntry.url_download : url;

        if (downloadUrl.includes('drive.google.com/file/d/')) {
            const fileId = downloadUrl.split('/d/')[1].split('/')[0];
            downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }

        const contentPdf = `
            <div class="resource-container-wrapper" style="position:relative; height: calc(100vh - 60px); background:#f0f0f0; overflow:hidden;">
                <iframe src="${window.location.origin + window.location.pathname.replace('index.html', '') + url}" 
                        type="application/pdf"
                        style="width:100%; height:100%; border:none; display:block;">
                </iframe>
                
                <a href="${downloadUrl}" 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   style="position:fixed; bottom:30px; right:20px; background:#AA1915; color:white; 
                          padding:15px 25px; border-radius:50px; text-decoration:none; font-weight:bold; 
                          box-shadow: 0 4px 15px rgba(0,0,0,0.4); z-index:10002; display:flex; align-items:center; gap:10px; border:2px solid white;">
                   <span>DESCARGAR / LUPA</span> 🔍
                </a>
            </div>
        `;
        render(contentPdf, resourceName, { level: 6, materialId, url, type, resourceName }, isBack);
        return;
    }
    // (Resto de la lógica de fotos/videos igual)
    let content = '';
    if (type === 'video' || type === 'video_mp4') {
        content = `<div class="video-container centered-resource"><iframe src="${url}" frameborder="0" allowfullscreen></iframe></div>`;
    } else if (type === 'photo') {
        content = `<img src="${url}" class="centered-resource">`;
    }
    render(`<div class="resource-container-wrapper">${content}</div>`, resourceName, { level: 6, materialId, url, type, resourceName }, isBack);
}

async function loadFirebaseData() {
    try {
        // 1. Cargar VEHICLES
        const vehiclesSnapshot = await db.collection("vehicles").get();
        FIREBASE_DATA.VEHICLES = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Cargar TURNOS_CONFIG (Asumiendo que tienes una colección 'config')
        // *Este paso es opcional, si mantienes TURNOS_CONFIG en data.js, sáltalo.*
        
        // 3. Cargar MATERIALES (simplificado, asume que DETAILS está en materiales)
        const materialsSnapshot = await db.collection("materials").get();
        materialsSnapshot.docs.forEach(doc => {
            FIREBASE_DATA.MATERIALS[doc.id] = doc.data();
        });

		// 4. Cargar DETAILS (Hotspots/Armarios. Es más complejo, lo cargamos como una colección)
        // Por la estructura compleja (B12 -> B12-dcha -> Armarios), usaremos una aproximación simple
        // Si tienes una colección 'details', la cargarías así:
        const detailsSnapshot = await db.collection("details").get();
        detailsSnapshot.docs.forEach(doc => {
            FIREBASE_DATA.DETAILS[doc.id] = doc.data();
        });

        console.log("Datos de Firebase cargados con éxito.");

    } catch (e) {
        console.error("Fallo al cargar datos de Firebase:", e);
        // Si falla, mostramos un error y usamos los datos vacíos.
        render(`
            <div style="text-align:center; padding-top: 50px; color: red;">
                <h4>ERROR DE CONEXIÓN</h4>
                <p>No se pudieron cargar los datos de inventario. Verifica tu conexión o la configuración de Firebase.</p>
            </div>`, 'ERROR', { level: -1 }, false);
    }
}

function navigateToSection(id) {
    if (id === 'inventario') renderVehiclesList(); // ID de data.js
	if (id === 'material_global') renderGlobalMaterialList();       // ID de data.js
    if (id === 'mapa') renderMapaSection();       // ID de data.js
    if (id === 'calendario') renderCalendarioSection(); // ID de data.js
}

// --- FUNCIÓN RENDER del mapa ---
// --- NIVEL 1: SECCIÓN DE MAPA (ACTUALIZADA) ---
async function renderMapaSection(isBack = false) { // <--- Añadir isBack
    // Pasamos isBack al render
    render(`<div id="map"></div>`, 'Mapa de Elementos', { level: 1, section: 'mapa' }, isBack); 

    setTimeout(() => {
        const map = L.map('map').setView([43.5322, -5.6611], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        const iconoHidrante = L.icon({
            iconUrl: 'images/icono-hidrante.png',
            iconSize: [16, 24],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        const iconoBocaRiego = L.icon({
            iconUrl: 'images/icono-boca-riego.png',
            iconSize: [20, 16],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        const capasConfig = [
            { url: 'mapa/limites.geojson', color: 'red', label: 'Límites concejo' },
            { url: 'mapa/hidrantes.geojson', color: 'red', label: 'Hidrantes', isPoint: true, tipoIcono: 'hidrante' },
            { url: 'mapa/br-c.geojson', color: 'green', label: 'Bocas riego centro', isPoint: true, tipoIcono: 'boca' },
            { url: 'mapa/br-e.geojson', color: 'green', label: 'Bocas riego este', isPoint: true, tipoIcono: 'boca' },
            { url: 'mapa/br-o.geojson', color: 'green', label: 'Bocas riego oeste', isPoint: true, tipoIcono: 'boca' },
            { url: 'mapa/br-s.geojson', color: 'green', label: 'Bocas riego sur', isPoint: true, tipoIcono: 'boca' }
        ];

        // --- INICIALIZAR EL CONTROL DE CAPAS ---
        const selectorCapas = L.control.layers(null, {}, { collapsed: false }).addTo(map);

        capasConfig.forEach(capa => {
            fetch(capa.url)
                .then(response => response.json())
                .then(data => {
                    const geojsonLayer = L.geoJSON(data, {
                        style: { color: capa.color, weight: 3, opacity: 0.8 },
                        pointToLayer: (feature, latlng) => {
                            if (capa.tipoIcono === 'hidrante') {
                                return L.marker(latlng, { icon: iconoHidrante });
                            } else if (capa.tipoIcono === 'boca') {
                                return L.marker(latlng, { icon: iconoBocaRiego });
                            }
                            return L.circleMarker(latlng, { radius: 5 });
                        },
                        onEachFeature: (feature, layer) => {
                            const popup = feature.properties.name || capa.label;
                            layer.bindPopup(`<b>${popup}</b>`);
                        }
                    });

                    // --- LÓGICA DE VISIBILIDAD INICIAL ---
                    // Solo añadimos al mapa directamente si es Límite o Hidrante
                    if (capa.label === 'Límites concejo' || capa.label === 'Hidrantes') {
                        geojsonLayer.addTo(map);
                    }

                    // Añadimos siempre al selector de capas para que el usuario pueda encenderlas
                    selectorCapas.addOverlay(geojsonLayer, capa.label);
                });
        });
    }, 200);
}

// --- FUNCIÓN RENDER ---
function render(contentHTML, title, state, isBack = false) {
    appContent.innerHTML = contentHTML;
    document.querySelector('header h1').textContent = title;

    // Solo añadimos al historial si vamos HACIA ADELANTE
    if (!isBack) {
        navigationHistory.push(state);
        // Sincronizamos con el navegador
        history.pushState({ stateIndex: navigationHistory.length - 1 }, title);
    }

    const actionIcon = document.getElementById('header-action-icon');
    const logoImg = document.getElementById('header-logo-img');
    const backButton = document.getElementById('back-button');

    // Control visual del botón
    if (state.level === 0) {
        logoImg.src = "images/favicon.png";
        actionIcon.classList.remove('header-logo-active');
        backButton.style.display = 'none';
    } else {
        logoImg.src = "images/home-icon.png";
        actionIcon.classList.add('header-logo-active');
        backButton.style.display = 'inline';
    }
}


// ----------------------------------------------------
// Nivel 0: DASHBOARD (Pantall de inicio)
// ----------------------------------------------------
function renderDashboard(isBack = false) {
    const dashboardHTML = SECCIONES_INICIO.map(seccion => `
        <div class="dashboard-item" onclick="navigateToSection('${seccion.id}')">
            
            ${seccion.image_url ? `<img src="${seccion.image_url}" alt="${seccion.name}" class="dashboard-icon">` : '❓'}
            
            <p>${seccion.name}</p>
        </div>
    `).join('');

    // El título en el header será "Bomberos Gijón"
    render(`
        <div class="dashboard-grid">
            ${dashboardHTML}
        </div>
    `, 'Bomberos Gijón', { level: 0 }, isBack);
}


// ----------------------------------------------------
// Nivel 1: Lista de Vehículos (Título Actualizado)
// ----------------------------------------------------
function renderVehiclesList(isBack = false) {
    const vehiclesHTML = FIREBASE_DATA.VEHICLES.map(v => `
        <div class="list-item vehicle-card" onclick="showVehicleViews('${v.id}')">
            <img src="${v.image}" alt="${v.name}" class="vehicle-thumb">
            <div class="vehicle-info">
                <h2>${v.name}</h2>
                <p>${v.description}</p>
            </div>
        </div>
    `).join('');

    // Cambiamos 'Inventario del Parque' por 'Vehículos y material'
    render(`<div class="grid-container">${vehiclesHTML}</div>`, 'VEHÍCULOS', { level: 1 }, isBack);
}

// ----------------------------------------------------
// Nivel 2: Vistas del Vehículo (Encabezado eliminado)
// ----------------------------------------------------
function showVehicleViews(vehicleId, isBack = false) {
    const vehicle = FIREBASE_DATA.VEHICLES.find(v => v.id === vehicleId);
    const detail = FIREBASE_DATA.DETAILS[vehicleId];
    
    if (!detail) {
        alert('Detalles del vehículo no encontrados.');
        return;
    }

    const viewsHTML = detail.views.map(view => {
        
        // 1. Determinar la acción al hacer clic
        let clickAction;
        
        if (view.direct_access) {
            // Si es acceso directo, necesitamos saber qué hotspot abrir.
            // ASUNCIÓN: Si tiene 'direct_access: true', solo tiene UN hotspot definido en su ID.
            
            // Acceso directo a la tabla de contenidos (Nivel 4)
            clickAction = `showArmarioMaterial('${vehicleId}', '${view.id}', 0)`; 
        } else {
            // Navegación normal al visor de hotspots (Nivel 3)
            clickAction = `showViewHotspots('${vehicleId}', '${view.id}')`;
        }
        
        // 2. Generar el HTML con la acción correcta
        return `
            <div class="list-item vehicle-card" onclick="${clickAction}">
                <img src="${view.image}" alt="${view.name}" class="vehicle-thumb">
                <div class="vehicle-info">
                    <h2>${view.name}</h2>
                    <p>Pulsa para ver armarios de esta zona</p>
                </div>
            </div>
        `;
    }).join('');
	
    // Hemos quitado el <h2> de dentro del primer argumento
    render(`
        <div class="grid-container">${viewsHTML}</div>
    `, vehicle.name, { level: 2, vehicleId }, isBack);
}

// ----------------------------------------------------
// Nivel 3: Vista Ampliada y Hotspots (Encabezado eliminado)
// ----------------------------------------------------
function showViewHotspots(vehicleId, viewId, isBack = false) {
    const detail = FIREBASE_DATA.DETAILS[vehicleId];
    const view = detail.views.find(v => v.id === viewId);
    const hotspots = detail.hotspots[viewId] || [];

    let hotspotsHTML = hotspots.map((h, index) => {
        
        // 1. LÓGICA CORREGIDA PARA OBTENER EL NOMBRE CORTO ("A1", "C2")
        const name = h.name.trim(); 
        let shortName = name; 
        
        // Buscamos si hay al menos dos palabras separadas por espacio
        const parts = name.split(/\s+/); // Divide por uno o más espacios
        
        if (parts.length >= 2) {
             const firstChar = parts[0].charAt(0).toUpperCase(); // 'A' de Armario
             const lastPart = parts[parts.length - 1]; // '1' de Armario 1
             
             // Si la última parte es corta (número o letra simple), la usamos
             if (lastPart.length <= 3 && !isNaN(parseInt(lastPart))) {
                 // Si es un número (ej. "1", "2") lo concatenamos
                 shortName = firstChar + lastPart; // Resultado: "A1"
             } else if (lastPart.length <= 3 && lastPart.length > 0) {
                 // Si es una letra o abreviatura corta (ej. "Izq")
                 shortName = firstChar + lastPart.charAt(0).toUpperCase(); 
             }
        }

        // 2. DEFINIR LA POSICIÓN Y RENDERIZAR (Mantenemos el estilo sin callout)
        const hotspotArea = h.style;

        return `
            <div class="hotspot" 
                 style="${hotspotArea}" 
                 data-index="${index}"
                 onclick="showArmarioMaterial('${vehicleId}', '${viewId}', ${index})">
                <span class="hotspot-label">${shortName}</span>
            </div>
        `;
    }).join('');

    // Eliminamos el <h2>${view.name}</h2> del inicio
    render(`
        <div id="vehicle-view-container" style="position: relative; display: inline-block;">
            <img id="vehicle-view-image" src="${view.image}" style="width: 100%; display: block;">
            ${hotspotsHTML}
        </div>
    `, view.name, { level: 3, vehicleId, viewId }, isBack);
}

// ----------------------------------------------------
// Nivel 4: Lista de Material (Soporta Secciones y Modo Simple)
// ----------------------------------------------------

// Función para saber si un material tiene información extra (foto, descripción o docs)
function tieneInformacionExtra(materialId) {
    const material = FIREBASE_DATA.MATERIALS[materialId];
    if (!material) return false;

    // Comprobar descripción
    const tieneDesc = material.description && material.description.trim() !== "";
    
    // Comprobar documentos válidos (incluye fotos)
    const docsValidos = (material.docs || []).filter(doc => doc.url && doc.name);
    const tieneDocs = docsValidos.length > 0;

    return tieneDesc || tieneDocs;
}

function showArmarioMaterial(vehicleId, viewId, hotspotIndex, isBack = false) {
    const detail = FIREBASE_DATA.DETAILS[vehicleId];
    const hotspot = detail.hotspots[viewId][hotspotIndex];
    
    let contentHTML = ''; 

    // 1. Mostrar Imagen del Armario
    if (hotspot.armario_image) {
        contentHTML += `
            <div class="armario-image-container">
                <img src="${hotspot.armario_image}" alt="Imagen del armario ${hotspot.name}" class="armario-image">
            </div>
        `;
    }
    
    const headerHTML = `
        <div class="inventory-row inventory-header"> 
            <div class="col-qty">nº</div>
            <div class="col-name">Material</div>
        </div>
    `;

    // 2. Lógica para renderizar tablas
    if (hotspot.sections && hotspot.sections.length > 0) {
        // --- A) MODO SECCIONES ---
        const tablesHTML = hotspot.sections.map(section => {
            const rowsHTML = section.items.map(item => {
                const material = FIREBASE_DATA.MATERIALS[item.id];
                if (!material) return `<div class="inventory-row" style="color:red; padding:10px;">ID ${item.id} no encontrado</div>`;
                
                const isKit = material.is_kit;
                const tieneInfo = tieneInformacionExtra(item.id);
                
                let clickAction = '';
                let iconEye = '';
                let rowClass = 'inventory-row';
                
                if (isKit) {
                    clickAction = `onclick="showKitInventory('${item.id}', '${hotspot.name}')"`;
                    rowClass += ' kit-row';
                } else if (tieneInfo) {
                    clickAction = `onclick="showMaterialDetails('${item.id}')"`;
                    iconEye = '<span style="margin-left:8px; opacity:0.7;">👁️</span>';
                } else {
                    clickAction = 'style="cursor: default;"'; 
                }
                
                const indicator = isKit ? '<span class="kit-indicator">(Ver contenido)</span>' : '';
                
                return `
                    <div class="${rowClass}" ${clickAction}>
                        <div class="col-qty">${item.qty}</div>
                        <div class="col-name">
                            ${material.name}${iconEye} ${indicator}
                        </div>
                    </div>`;
            }).join(''); // Cierre de section.items.map
            
            return `
                <div class="inventory-table-container">
                    <h4 class="inventory-section-title">${section.name}</h4>
                    <div class="inventory-table">
                        ${headerHTML}${rowsHTML}
                    </div>
                </div>`;
        }).join(''); // Cierre de hotspot.sections.map
        contentHTML += `<div class="inventory-sections-wrapper">${tablesHTML}</div>`;
	
    } else if (hotspot.inventory && hotspot.inventory.length > 0) {
        // --- B) MODO SIMPLE ---
        const rowsHTML = hotspot.inventory.map(item => {
            const material = FIREBASE_DATA.MATERIALS[item.id];
            if (!material) return `<div class="inventory-row" style="color:red; padding:10px;">ID ${item.id} no encontrado</div>`;
            
            const isKit = material.is_kit;
            const tieneInfo = tieneInformacionExtra(item.id);
            
            let clickAction = '';
            let iconEye = '';
            let rowClass = 'inventory-row';
            
            if (isKit) {
                clickAction = `onclick="showKitInventory('${item.id}', '${hotspot.name}')"`;
                rowClass += ' kit-row';
            } else if (tieneInfo) {
                clickAction = `onclick="showMaterialDetails('${item.id}')"`;
                iconEye = '<span style="margin-left:8px; opacity:0.7;">👁️</span>';
            } else {
                clickAction = 'style="cursor: default;"'; 
            }
            
            const indicator = isKit ? '<span class="kit-indicator">(Ver contenido)</span>' : '';
            
            return `
                <div class="${rowClass}" ${clickAction}>
                    <div class="col-qty">${item.qty}</div>
                    <div class="col-name">
                        ${material.name}${iconEye} ${indicator}
                    </div>
                </div>`;
        }).join('');
	
        contentHTML += `
            <div class="inventory-table">
                ${headerHTML}${rowsHTML}
            </div>`;
    } else {
        contentHTML += `<div style="text-align:center; padding:20px;"><p>Armario vacío.</p></div>`;
    }
    
    render(contentHTML, hotspot.name, { level: 4, vehicleId, viewId, hotspotIndex }, isBack);
}

// --- NIVEL 4 bis: Muestra una lista de material dentro de una caja, saca u otro contenedor ---
function showKitInventory(kitId, parentName, isBack = false) {
    const kit = FIREBASE_DATA.MATERIALS[kitId];
    
    if (!kit || !kit.kit_contents) {
        alert('Contenedor de kit no encontrado o vacío.');
        return;
    }

    const headerHTML = `
        <div class="inventory-row inventory-header"> 
            <div class="col-qty">nº</div>
            <div class="col-name">Material</div>
        </div>
    `;

    const rowsHTML = kit.kit_contents.map(item => {
	    const material = FIREBASE_DATA.MATERIALS[item.id];
	    if (!material) return '';
	
	    const tieneInfo = tieneInformacionExtra(item.id);
	    const clickAction = tieneInfo ? `onclick="showMaterialDetails('${item.id}')"` : 'style="cursor: default;"';
	    const iconEye = tieneInfo ? '<span style="margin-left:8px; opacity:0.7;">👁️</span>' : '';
	
	    return `
	        <div class="inventory-row" ${clickAction}>
	            <div class="col-qty">${item.qty}</div>
	            <div class="col-name">${material.name}${iconEye}</div>
	        </div>
	    `;
	}).join('');

    const contentHTML = `
        <div class="inventory-table">
            ${headerHTML}
            ${rowsHTML}
        </div>
    `;

    // Renderizamos la lista con un nivel de 4.5 para el historial
    render(contentHTML, kit.name, { level: 4.5, kitId, parentName }, isBack);
}

// --- NIVEL 5: Detalles del Material (Navega al Nivel 6) ---
function showMaterialDetails(materialId, isBack = false) {
    const material = FIREBASE_DATA.MATERIALS[materialId];
    if (!material) return;

    const documentosValidos = (material.docs || []).filter(doc => doc.url && doc.name);
    const mainPhoto = documentosValidos.find(doc => doc.type === 'photo');
    const filteredDocs = documentosValidos.filter(doc => doc !== mainPhoto);

    const docsHTML = filteredDocs.length > 0 
        ? filteredDocs.map(doc => `
            <div class="list-item" onclick="renderResource('${materialId}', '${doc.url}', '${doc.type}', '${doc.name}')">
                <strong>${doc.type === 'video' || doc.type === 'video_mp4' ? '🎬' : '🖼️'} Ver ${doc.name}</strong>
            </div>
        `).join('')
        : '';

    const seccionDocumentacion = docsHTML !== '' ? `<hr><h3>Documentación y Recursos</h3>${docsHTML}` : '';

    // --- NUEVA LÓGICA PARA LA DESCRIPCIÓN ---
    const seccionDescripcion = material.description && material.description.trim() !== "" 
        ? `<div class="material-text">
                <p><strong>Descripción:</strong></p>
                <p>${material.description}</p>
           </div>` 
        : '';

    const content = `
        <div class="material-detail-container" style="${!mainPhoto && !seccionDescripcion ? 'display:none;' : ''}">
            ${mainPhoto ? `<img src="${mainPhoto.url}" class="material-main-img">` : ''} 
            ${seccionDescripcion}
        </div>
        ${seccionDocumentacion}
    `;

    render(content, material.name, { level: 5, materialId: materialId }, isBack);
}

/// --- NIVEL 6: Renderizado de Recurso a Pantalla Completa -- ///
/// SIMULACIÓN DE NIVEL 6 PARA EL PDF VIEWER
function handleManualOpen(materialId, docName) {
    // 1. Abrimos el PDF en una pestaña externa (o visor nativo)
    // Ya no necesitamos manipular el historial en este punto.

    // 2. Si el usuario vuelve a la app y pulsa el botón "Atrás" (de la app):
    // La función backButton.addEventListener debe manejarlo.
}

// --- SECCIÓN 2: BUSCADOR GLOBAL DE MATERIAL --- ///
/// --------------------------------------------- ///

function renderGlobalMaterialList(isBack = false) {
    // Al eliminar 'lastMaterialSearch', el buscador siempre arrancará limpio
    const html = `
        <div class="search-container" style="padding: 0 5px; margin-bottom: 20px;">
            <input type="text" id="material-search" 
                   placeholder="🔍 Buscar material o contenido de kits..." 
                   oninput="filterMaterials(this.value)"
                   value=""
                   style="width: 100%; 
                          padding: 12px; 
                          border-radius: 8px; 
                          border: 1px solid #ccc; 
                          font-size: 1.1em; 
                          box-sizing: border-box; 
                          display: block;">
        </div>
        <div id="global-material-table" class="inventory-table">
            ${generateGlobalTableHTML('')}
        </div>
    `;

    render(html, 'BUSCADOR MATERIAL', { level: 1, section: 'material_global' }, isBack);
}

function generateGlobalTableHTML(filter = '') {
    const header = `
        <div class="inventory-row inventory-header">
            <div class="col-name" style="padding-left: 20px;">Nombre del Material</div>
        </div>
    `;
    const searchTerm = filter.toLowerCase();

    // 1. Obtenemos todos los IDs y filtramos según el buscador
    const filteredIds = Object.keys(FIREBASE_DATA.MATERIALS).filter(id => {
        const m = FIREBASE_DATA.MATERIALS[id];
        const matchNombre = m.name.toLowerCase().includes(searchTerm);
        
        // Búsqueda dentro de kits
        let matchContenidoKit = false;
        if (m.is_kit && m.kit_contents) {
            matchContenidoKit = m.kit_contents.some(item => {
                const subMaterial = FIREBASE_DATA.MATERIALS[item.id];
                return subMaterial && subMaterial.name.toLowerCase().includes(searchTerm);
            });
        }
        return matchNombre || matchContenidoKit;
    });

    // 2. ORDENAR ALFABÉTICAMENTE por el campo "name"
    filteredIds.sort((a, b) => {
        const nameA = FIREBASE_DATA.MATERIALS[a].name.toLowerCase();
        const nameB = FIREBASE_DATA.MATERIALS[b].name.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // 3. Renderizar las filas ya ordenadas
    return header + filteredIds.map(id => {
        const m = FIREBASE_DATA.MATERIALS[id];
        const kitIcon = m.is_kit ? '💼 ' : '';
        return `
            <div class="inventory-row" onclick="showGlobalMaterialDetail('${id}')">
                <div class="col-name" style="padding-left: 20px;">${kitIcon}${m.name}</div>
            </div>`;
    }).join('');
}

function filterMaterials(text) {
    const table = document.getElementById('global-material-table');
    table.innerHTML = generateGlobalTableHTML(text);
}

function showGlobalMaterialDetail(materialId, isBack = false) {
    const material = FIREBASE_DATA.MATERIALS[materialId];
    if (!material) return;

    // 1. Lógica de búsqueda de ubicaciones (tu código actual)
    let ubicacionesHTML = '';
    const ubicaciones = [];
    
    Object.keys(FIREBASE_DATA.DETAILS).forEach(vId => {
        const vehiculo = FIREBASE_DATA.VEHICLES.find(v => v.id === vId);
        const hotspotsData = FIREBASE_DATA.DETAILS[vId].hotspots;
        
        Object.keys(hotspotsData).forEach(viewId => {
            hotspotsData[viewId].forEach((hotspot, hIndex) => {
                
                const revisarLista = (items, nombreLugar) => {
                    items.forEach(item => {
                        // 1. Material directo
                        if (item.id === materialId) {
                            ubicaciones.push({ 
                                vName: vehiculo.name, vId: vId, viewId: viewId, hIndex: hIndex, armario: nombreLugar 
                            });
                        }
                        // 2. Dentro de un kit
                        const mEnLista = FIREBASE_DATA.MATERIALS[item.id];
                        if (mEnLista?.is_kit && mEnLista.kit_contents?.some(sub => sub.id === materialId)) {
                            ubicaciones.push({ 
                                vName: vehiculo.name, vId: vId, viewId: viewId, hIndex: hIndex, 
                                armario: `${nombreLugar} (En ${mEnLista.name})` 
                            });
                        }
                    });
                };

                if (hotspot.inventory) revisarLista(hotspot.inventory, hotspot.name);
                if (hotspot.sections) {
                    hotspot.sections.forEach(sec => revisarLista(sec.items, `${hotspot.name} (${sec.name})`));
                }
            });
        });
    });

    // GENERACIÓN DEL HTML CLICABLE //
    ubicacionesHTML = ubicaciones.length > 0 
        ? ubicaciones.map(u => `
            <div class="list-item" 
                 style="border-left: 5px solid #AA1915; margin-bottom: 8px; padding: 12px; cursor: pointer; background: white; display: flex; align-items: center; gap: 10px;"
                 onclick="showArmarioMaterial('${u.vId}', '${u.viewId}', ${u.hIndex})">
                
                <div style="flex-grow: 1; min-width: 0; word-wrap: break-word;">
                    <strong>${u.vName}</strong>: ${u.armario}
                </div>

                <div style="flex-shrink: 0; color: #AA1915; font-weight: bold; white-space: nowrap; font-size: 0.9em; border: 1px solid #AA1915; padding: 4px 8px; border-radius: 4px;">
                    VER ➔
                </div>
            </div>`).join('')
        : '<p>No se han encontrado ubicaciones registradas.</p>';
	
    // 2. Lógica de Documentos (Recuperada de tu showMaterialDetails original)
    const documentosValidos = (material.docs || []).filter(doc => doc.url && doc.name);
    const mainPhoto = documentosValidos.find(doc => doc.type === 'photo');
    const filteredDocs = documentosValidos.filter(doc => doc !== mainPhoto);

    const docsHTML = filteredDocs.length > 0 
        ? filteredDocs.map(doc => `
            <div class="list-item" onclick="renderResource('${materialId}', '${doc.url}', '${doc.type}', '${doc.name}')">
                <strong>${doc.type === 'video' || doc.type === 'video_mp4' ? '🎬' : '🖼️'} Ver ${doc.name}</strong>
            </div>`).join('')
        : ''; // Si no hay nada, queda totalmente vacío

	// 5. En el bloque de 'content', mostramos el título solo si hay documentos
	const seccionDocumentacion = docsHTML !== '' ? `<hr><h3>Documentación y Recursos</h3>${docsHTML}` : '';

	// --- NUEVA LÓGICA PARA LA DESCRIPCIÓN ---
    const seccionDescripcion = material.description && material.description.trim() !== "" 
        ? `<div class="material-text">
                <p><strong>Descripción:</strong></p>
                <p>${material.description}</p>
           </div>` 
        : '';
	
    const content = `
        <div class="material-detail-container" style="${!mainPhoto && !seccionDescripcion ? 'display:none;' : ''}">
            ${mainPhoto ? `<img src="${mainPhoto.url}" class="material-main-img">` : ''} 
            ${seccionDescripcion}
        </div>
        <div style="margin-top: 20px; background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <h3 style="color: #AA1915; margin-top: 0;">📍 Ubicación en Vehículos</h3>
            ${ubicacionesHTML}
        </div>
        ${seccionDocumentacion}
    `;

    render(content, material.name, { level: 5, materialId: materialId, section: 'material_global' }, isBack);
}

// ----------------------------------------------------
// LÓGICA DEL CALENDARIO (ÚNICA VERSIÓN)
// ----------------------------------------------------
function calcularTurnoGuardia(fecha) {
    const inicioRef = Date.UTC(2024, 0, 1);
    const fechaUTC = Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const diasTotal = Math.round((fechaUTC - inicioRef) / (1000 * 60 * 60 * 24));
    let desplazamiento = 0;
    for (let a = 2024; a < fecha.getFullYear(); a++) { if (!esBisiesto(a)) desplazamiento++; }
    if (!esBisiesto(fecha.getFullYear()) && fecha.getMonth() >= 2) desplazamiento++;
    let ciclo = (diasTotal + desplazamiento + 1) % 5;
    if (ciclo < 0) ciclo += 5;
    return ciclo + 1;
}

function esBisiesto(year) { return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0); }

function renderCalendarioSection(isBack = false) {
    const botonesHTML = TURNOS_CONFIG.map(t => `
        <button class="turno-btn-small" style="background-color: ${t.color}" onclick="cambiarTurnoCal('${t.id}')">${t.id}</button>
    `).join('');

    const html = `
        <div class="calendar-header-compact"><div class="turno-row">${botonesHTML}</div></div>
        <div class="calendar-nav">
            <button onclick="navegarMes(-1)">&#10140;</button>
            <div id="mes-titulo-container" class="select-nav-container"></div>
            <button onclick="navegarMes(1)">&#10140;</button>
        </div>
        <div id="calendar-view-container" class="calendar-view"></div>
    `;
    render(html, 'Calendario de Turnos', { level: 1, section: 'calendario' }, isBack);
    actualizarVistaCalendario();
}

function actualizarVistaCalendario() {
    const container = document.getElementById('calendar-view-container');
    const navContainer = document.getElementById('mes-titulo-container');
    if (!container || !navContainer) return;

    const infoTurno = TURNOS_CONFIG.find(t => t.id === turnoSeleccionadoCal);
    const colorDinamico = infoTurno ? infoTurno.color : '#AA1915';

    navContainer.innerHTML = `
        <select onchange="cambiarMesAño(this.value, 'mes')">${Array.from({length:12}, (_,i)=>`<option value="${i}" ${i===mesActualCal?'selected':''}>${obtenerNombreMes(i)}</option>`).join('')}</select>
        <select onchange="cambiarMesAño(this.value, 'año')">${Array.from({length:11}, (_,i)=>(añoActualCal-5)+i).map(a=>`<option value="${a}" ${a===añoActualCal?'selected':''}>${a}</option>`).join('')}</select>
    `;

    let tablaHTML = `<table class="tabla-calendario"><thead><tr><th>Lu</th><th>Ma</th><th>Mi</th><th>Ju</th><th>Vi</th><th>Sá</th><th>Do</th></tr></thead><tbody><tr>`;
    const diasMes = new Date(añoActualCal, mesActualCal + 1, 0).getDate();
    let primerDia = new Date(añoActualCal, mesActualCal, 1).getDay() || 7;

    for (let i = 1; i < primerDia; i++) tablaHTML += '<td></td>';
    for (let dia = 1; dia <= diasMes; dia++) {
        const fecha = new Date(añoActualCal, mesActualCal, dia);
        const esMiGuardia = (calcularTurnoGuardia(fecha) === parseInt(turnoSeleccionadoCal.replace('T', '')));
        const hoy = new Date();
        const esHoy = (dia === hoy.getDate() && mesActualCal === hoy.getMonth() && añoActualCal === hoy.getFullYear());
        let estilo = esMiGuardia ? `background-color:${colorDinamico}; color:white; font-weight:bold;` : '';
        if (esHoy) estilo += `border: 3px solid #AA1915 !important;`;
        tablaHTML += `<td style="${estilo}">${dia}</td>`;
        if (fecha.getDay() === 0 && dia !== diasMes) tablaHTML += '</tr><tr>';
    }
    
    const hoy = new Date();
    const turnoHoyId = calcularTurnoGuardia(hoy);
    const infoTurnoHoy = TURNOS_CONFIG.find(t => parseInt(t.id.replace('T','')) === turnoHoyId);
    
    const footerHTML = `</tr></tbody></table><div class="calendar-footer">
        <div class="hoy-badge" style="border-left: 5px solid ${infoTurnoHoy.color}"><strong>HOY:</strong> Guardia del <span>${infoTurnoHoy.name}</span></div>
        <div class="leyenda-item"><span class="dot" style="background-color: ${colorDinamico}"></span> Guardias del <strong>${turnoSeleccionadoCal}</strong></div>
    </div>`;
    container.innerHTML = tablaHTML + footerHTML;
}

function cambiarMesAño(v, t) { if(t==='mes') mesActualCal=parseInt(v); else añoActualCal=parseInt(v); actualizarVistaCalendario(); }
function navegarMes(d) { mesActualCal+=d; if(mesActualCal<0){mesActualCal=11; añoActualCal--;} if(mesActualCal>11){mesActualCal=0; añoActualCal++;} actualizarVistaCalendario(); }
function cambiarTurnoCal(id) { turnoSeleccionadoCal=id; actualizarVistaCalendario(); }
function obtenerNombreMes(n) { return ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][n]; }

// ----------------------------------------------------
// SISTEMA DE NAVEGACIÓN (ÚNICO)
// ----------------------------------------------------
function handleBackNavigation() {
    if (navigationHistory.length > 1) {
        navigationHistory.pop(); 
        const target = navigationHistory[navigationHistory.length - 1];
        window.scrollTo(0, 0);
        
        if (target.level === 0) renderDashboard(true);
        else if (target.level === 1) {
            if (target.section === 'material_global') renderGlobalMaterialList(true);
            else if (target.section === 'mapa') renderMapaSection(true);
            else if (target.section === 'calendario') renderCalendarioSection(true);
            else renderVehiclesList(true);
        }
        else if (target.level === 2) showVehicleViews(target.vehicleId, true);
        else if (target.level === 3) showViewHotspots(target.vehicleId, target.viewId, true);
        else if (target.level === 4) showArmarioMaterial(target.vehicleId, target.viewId, target.hotspotIndex, true);
        else if (target.level === 4.5) showKitInventory(target.kitId, target.parentName, true);
        else if (target.level === 5) {
            if (target.section === 'material_global') showGlobalMaterialDetail(target.materialId, true);
            else showMaterialDetails(target.materialId, true);
        }
        else if (target.level === 6) renderResource(target.materialId, target.url, target.type, target.resourceName, true);
    }
}

// Eventos
backButton.addEventListener('click', (e) => { e.preventDefault(); history.back(); });
window.onpopstate = handleBackNavigation;

function goToHome() {
    if (navigationHistory.length > 0 && navigationHistory[navigationHistory.length - 1].level === 0) return;
    navigationHistory = [];
    renderDashboard();
}

// --- LÓGICA DE AYUDA PARA INSTALACIÓN (PWA) ---
function mostrarGuiaInstalacion() {
    // Si ya está instalada (modo standalone), no mostramos nada
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let mensaje = "";
    if (isIOS) {
        mensaje = "Para instalar: pulsa el icono 'Compartir' ⎋ y luego 'Añadir a pantalla de inicio' ⊕";
    } else if (isAndroid) {
        mensaje = "Para instalar: pulsa los tres puntos ⋮ y luego 'Instalar aplicación' o 'Añadir a pantalla de inicio'";
    }

    if (mensaje) {
        const promo = document.createElement('div');
        promo.style = `
            position: fixed; bottom: 20px; left: 20px; right: 20px; 
            background: #333; color: white; padding: 15px; 
            border-radius: 10px; z-index: 10000; font-size: 0.9em;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: flex; 
            justify-content: space-between; align-items: center;
            border-left: 5px solid #AA1915;
        `;
        promo.innerHTML = `
            <span>${mensaje}</span>
            <button onclick="this.parentElement.remove()" style="background:none; border:none; color:white; font-weight:bold; padding-left:10px;">X</button>
        `;
        document.body.appendChild(promo);
        
        // Se quita solo a los 10 segundos para no molestar mucho
        setTimeout(() => promo.remove(), 10000);
    }
}

// Ejecutar la guía después de cargar la app
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(mostrarGuiaInstalacion, 2000); // Esperamos 3 segundos tras el inicio
});

// --- SISTEMA DE ACTUALIZACIÓN DEFINITIVO ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Solo mostramos el aviso si ya hay un controlador (evita el aviso al instalar por primera vez)
        if (navigator.serviceWorker.controller) {
            showUpdateNotice();
        }
    });
}

function showUpdateNotice() {
    // Si ya existe el banner, no lo duplicamos
    if (document.getElementById('update-banner')) return;

    const aviso = document.createElement('div');
    aviso.id = 'update-banner';
    aviso.style = `
        position: fixed; bottom: 20px; left: 20px; right: 20px; 
        background: #AA1915; color: white; padding: 20px; 
        border-radius: 12px; z-index: 99999; text-align: center; 
        font-weight: bold; border: 2px solid white; 
        box-shadow: 0 5px 20px rgba(0,0,0,0.5);
    `;
    
    // Al pulsar, forzamos la recarga limpiando la caché de la ventana
    aviso.innerHTML = `
        NUEVA VERSIÓN DISPONIBLE <br>
        <button onclick="forzarActualizacion()" style="margin-top:10px; padding:10px 20px; border-radius:8px; border:none; background:white; color:#AA1915; font-weight:bold; cursor:pointer;">
            ACTUALIZAR AHORA
        </button>
    `;
    document.body.appendChild(aviso);
}

// Función global para el botón
function forzarActualizacion() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.update(); // Fuerza a buscar la nueva versión
            }
            window.location.reload(true); // Recarga forzosa
        });
    } else {
        window.location.reload(true);
    }
}






































































