// 1. DEFINICIÓN DE VARIABLES GLOBALES E INICIALIZACIÓN
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let navigationHistory = [];
let __prevViewportContent = null;
let mesActualCal = new Date().getMonth();
let añoActualCal = new Date().getFullYear();
let turnoSeleccionadoCal = 'T2';

const appContent = document.getElementById('app-content');
const backButton = document.getElementById('back-button');
const mainScroll = document.getElementById('main-scroll');
const zoomLayer = document.getElementById('zoom-layer');
const __appZoom = {
  scale: 1,
  x: 0,
  y: 0,
  min: 1,
  max: 3,

  pointers: new Map(),

  // pinch
  pinchStartDist: 1,
  pinchStartScale: 1,
  pinchRefPx: 0,
  pinchRefPy: 0,

  // pan
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  startX: 0,
  startY: 0
};


let FIREBASE_DATA = { VEHICLES: [], DETAILS: {}, MATERIALS: {} };

// 2. PUNTO DE INICIO Y GESTIÓN DE PWA
document.addEventListener('DOMContentLoaded', () => {
  if (!appContent || !backButton) return;

  initAppZoom();
  initializeApp();
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
	resetAppZoom();
  	if (mainScroll) { mainScroll.scrollTop = 0; mainScroll.scrollLeft = 0; }
	
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

// ---------------------------------------------------- //
// --- FUNCIONES PARA EL ZOOM ESPECIAL ---------------- //
function __clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function __dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
function __mid(a, b) { return { clientX: (a.clientX + b.clientX)/2, clientY: (a.clientY + b.clientY)/2 }; }

function __clampToBounds() {
  if (!mainScroll || !zoomLayer) return;

  // tamaño del viewport visible
  const vpW = mainScroll.clientWidth || 1;
  const vpH = mainScroll.clientHeight || 1;

  // tamaño del contenido (sin escala)
  const baseW = zoomLayer.scrollWidth || 1;
  const baseH = zoomLayer.scrollHeight || 1;

  const scaledW = baseW * __appZoom.scale;
  const scaledH = baseH * __appZoom.scale;

  // Si el contenido escalado es más grande que el viewport, permitimos moverse.
  // Si no, lo “pegamos” a 0 para que no haya huecos raros.
  const minX = Math.min(0, vpW - scaledW);
  const minY = Math.min(0, vpH - scaledH);

  __appZoom.x = __clamp(__appZoom.x, minX, 0);
  __appZoom.y = __clamp(__appZoom.y, minY, 0);
}

function applyAppZoom() {
  if (!zoomLayer || !mainScroll) return;

  __clampToBounds();
  zoomLayer.style.transform = `translate(${__appZoom.x}px, ${__appZoom.y}px) scale(${__appZoom.scale})`;

  // Cuando hay zoom, desactivamos el scroll nativo y activamos el pan propio
  if (__appZoom.scale > 1) {
    document.body.classList.add('zoom-active');
    mainScroll.style.overflow = 'hidden';
  } else {
    document.body.classList.remove('zoom-active');
    mainScroll.style.overflow = 'auto';
  }
}

function resetAppZoom() {
  __appZoom.scale = 1;
  __appZoom.x = 0;
  __appZoom.y = 0;
  __appZoom.pointers.clear();
  __appZoom.isPanning = false;
  applyAppZoom();
}

function initAppZoom() {
  if (!mainScroll || !zoomLayer) return;

  applyAppZoom();

  // IMPORTANTE: passive:false para poder usar preventDefault()
  mainScroll.addEventListener('pointerdown', (e) => {
    mainScroll.setPointerCapture?.(e.pointerId);
    __appZoom.pointers.set(e.pointerId, e);

    // Si ya estamos con zoom, evitamos que empiece scroll/gesto nativo
    if (__appZoom.scale > 1) e.preventDefault();

    if (__appZoom.pointers.size === 1 && __appZoom.scale > 1) {
      __appZoom.isPanning = true;
      __appZoom.panStartX = e.clientX;
      __appZoom.panStartY = e.clientY;
      __appZoom.startX = __appZoom.x;
      __appZoom.startY = __appZoom.y;
    }

    if (__appZoom.pointers.size === 2) {
      const [a, b] = Array.from(__appZoom.pointers.values());
      const mid = __mid(a, b);

      const rect = mainScroll.getBoundingClientRect();
      const mx = mid.clientX - rect.left;
      const my = mid.clientY - rect.top;

      __appZoom.pinchStartDist = __dist(a, b) || 1;
      __appZoom.pinchStartScale = __appZoom.scale;

      // Punto bajo los dedos en coords del contenido (sin escala)
      __appZoom.pinchRefPx = (mx - __appZoom.x) / __appZoom.scale;
      __appZoom.pinchRefPy = (my - __appZoom.y) / __appZoom.scale;

      __appZoom.isPanning = false;
    }
  }, { passive: false });

  mainScroll.addEventListener('pointermove', (e) => {
    if (!__appZoom.pointers.has(e.pointerId)) return;
    __appZoom.pointers.set(e.pointerId, e);

    // Si hay zoom o pinch activo, nosotros controlamos el gesto
    if (__appZoom.scale > 1 || __appZoom.pointers.size === 2) {
      e.preventDefault();
    }

    if (__appZoom.pointers.size === 2) {
      const [a, b] = Array.from(__appZoom.pointers.values());
      const mid = __mid(a, b);

      const rect = mainScroll.getBoundingClientRect();
      const mx = mid.clientX - rect.left;
      const my = mid.clientY - rect.top;

      const d = __dist(a, b) || 1;
      const nextScale = __appZoom.pinchStartScale * (d / __appZoom.pinchStartDist);
      __appZoom.scale = __clamp(nextScale, __appZoom.min, __appZoom.max);

      // Mantener el punto bajo los dedos estable
      __appZoom.x = mx - __appZoom.pinchRefPx * __appZoom.scale;
      __appZoom.y = my - __appZoom.pinchRefPy * __appZoom.scale;

      applyAppZoom();
      return;
    }

    if (__appZoom.pointers.size === 1 && __appZoom.isPanning && __appZoom.scale > 1) {
      const dx = e.clientX - __appZoom.panStartX;
      const dy = e.clientY - __appZoom.panStartY;
      __appZoom.x = __appZoom.startX + dx;
      __appZoom.y = __appZoom.startY + dy;
      applyAppZoom();
    }
  }, { passive: false });

  const end = (e) => {
    __appZoom.pointers.delete(e.pointerId);
    if (__appZoom.pointers.size < 2) __appZoom.isPanning = false;

    // Si vuelves a 1x, restauramos scroll normal
    if (__appZoom.scale <= 1) resetAppZoom();
  };

  mainScroll.addEventListener('pointerup', end, { passive: true });
  mainScroll.addEventListener('pointercancel', end, { passive: true });
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
// ---------------------------------------------------------- //
// Función "helper" //
function buildMaterialResourcesHTML(materialId, material) {
  const docs = (material.docs || []).filter(d => d.url && d.name);

  const mainPhoto = docs.find(d => d.type === 'photo');
  const pdfs = docs.filter(d => d.type === 'pdf');
  const photos = docs.filter(d => d.type === 'photo' && d !== mainPhoto);

  // (Opcional) si tienes vídeos, los dejo como sección aparte.
  // Si quieres que NO salga nunca, lo quitamos luego.
  const videos = docs.filter(d => d.type === 'video' || d.type === 'video_mp4');

  if (!pdfs.length && !photos.length && !videos.length) return '';

  const pdfRows = pdfs.length
    ? pdfs.map(d => {
        const downloadUrl = driveToDirectDownload(d.url_download || d.url);
        return `
          <div class="doc-row">
            <div class="doc-name">${d.name}</div>
            <a class="doc-download-btn"
               href="${downloadUrl}"
               target="_blank"
               rel="noopener noreferrer"
               download>Descargar</a>
          </div>
        `;
      }).join('')
    : `<p class="muted">No hay documentos PDF.</p>`;

  const imgRows = photos.length
    ? photos.map(d => `
        <img src="${d.url}"
             alt="${d.name}"
             class="material-extra-img"
             draggable="false">
      `).join('')
    : `<p class="muted">No hay imágenes.</p>`;

  const videoSection = videos.length
    ? `
      <div class="docs-subsection">
        <h4 class="docs-subsection-title">Vídeos</h4>
        ${videos.map(d => `
          <div class="list-item" onclick="renderResource('${materialId}','${d.url}','${d.type}','${d.name}')">
            <strong>🎬 Ver ${d.name}</strong>
          </div>
        `).join('')}
      </div>
    `
    : '';

  return `
    <hr>
    <h3>Documentación y Recursos</h3>

    <div class="docs-subsection">
      <h4 class="docs-subsection-title">Documentos PDF</h4>
      <div class="docs-table">
        ${pdfRows}
      </div>
    </div>

    <div class="docs-subsection">
      <h4 class="docs-subsection-title">Imágenes</h4>
      <div class="docs-images">
        ${imgRows}
      </div>
    </div>

    ${videoSection}
  `;
}

// ---------------------------
// VISOR DE IMÁGENES (overlay) con pinch-zoom + pan
// ---------------------------
let __imgViewer = null;
let __imgViewerCleanup = null;

const __imgZoom = {
  scale: 1,
  x: 0,
  y: 0,
  min: 1,
  max: 4,

  pointers: new Map(),

  pinchStartDist: 0,
  pinchStartScale: 1,
  pinchRefPx: 0,
  pinchRefPy: 0,

  panStartX: 0,
  panStartY: 0,
  startX: 0,
  startY: 0,
  isPanning: false
};

function __clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function __dist2(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function __mid2(a, b) {
  return { clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 };
}

function openImageViewer(src, alt = "") {
  // Bloquea scroll del fondo
  __prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const mainScroll = document.getElementById('main-scroll');
  if (mainScroll) {
    __prevMainOverflow = mainScroll.style.overflow;
    mainScroll.classList.add('no-scroll');
  }

  closeImageViewer();

  __imgZoom.scale = 1;
  __imgZoom.x = 0;
  __imgZoom.y = 0;
  __imgZoom.pointers.clear();
  __imgZoom.isPanning = false;

  const viewer = document.createElement("div");
  viewer.id = "img-viewer";
  viewer.innerHTML = `
    <button class="img-viewer-close" onclick="closeImageViewer()">✕</button>
    <div class="img-viewer-viewport">
      <div class="img-viewer-layer">
        <img src="${src}" alt="${alt}" draggable="false">
      </div>
    </div>
  `;

  document.body.appendChild(viewer);
  __imgViewer = viewer;

  const viewport = viewer.querySelector(".img-viewer-viewport");
  const layer = viewer.querySelector(".img-viewer-layer");
  const img = viewer.querySelector("img");

	// Cerrar si tocas fuera (en el fondo oscuro)
	viewer.addEventListener('click', (e) => {
		if (e.target === viewport) closeImageViewer();
	});

  function clampToBounds() {
    const vpRect = viewport.getBoundingClientRect();

    // Tamaño base de la imagen ya “encajada” por CSS (max-width/max-height)
    const baseW = img.clientWidth || 1;
    const baseH = img.clientHeight || 1;

    const scaledW = baseW * __imgZoom.scale;
    const scaledH = baseH * __imgZoom.scale;

    // Permitimos mover solo si la imagen escalada es más grande que el viewport
    const minX = Math.min(0, vpRect.width - scaledW);
    const minY = Math.min(0, vpRect.height - scaledH);

    __imgZoom.x = __clamp(__imgZoom.x, minX, 0);
    __imgZoom.y = __clamp(__imgZoom.y, minY, 0);
  }

  function apply() {
    clampToBounds();
    layer.style.transform = `translate(${__imgZoom.x}px, ${__imgZoom.y}px) scale(${__imgZoom.scale})`;
  }

  // Cuando la imagen carga, aplicamos por si cambia tamaños
  img.addEventListener("load", () => apply(), { once: true });
  apply();

  const onPointerDown = (e) => {
    viewport.setPointerCapture?.(e.pointerId);
    __imgZoom.pointers.set(e.pointerId, e);

    if (__imgZoom.pointers.size === 1 && __imgZoom.scale > 1) {
      __imgZoom.isPanning = true;
      __imgZoom.panStartX = e.clientX;
      __imgZoom.panStartY = e.clientY;
      __imgZoom.startX = __imgZoom.x;
      __imgZoom.startY = __imgZoom.y;
    }

    if (__imgZoom.pointers.size === 2) {
      const [a, b] = Array.from(__imgZoom.pointers.values());
      const mid = __mid2(a, b);

      const rect = viewport.getBoundingClientRect();
      const mx = mid.clientX - rect.left;
      const my = mid.clientY - rect.top;

      __imgZoom.pinchStartDist = __dist2(a, b) || 1;
      __imgZoom.pinchStartScale = __imgZoom.scale;

      // Punto de referencia (en coords del contenido sin escalar)
      __imgZoom.pinchRefPx = (mx - __imgZoom.x) / __imgZoom.scale;
      __imgZoom.pinchRefPy = (my - __imgZoom.y) / __imgZoom.scale;

      __imgZoom.isPanning = false;
    }
  };

  const onPointerMove = (e) => {
    if (!__imgZoom.pointers.has(e.pointerId)) return;
    __imgZoom.pointers.set(e.pointerId, e);

    // IMPORTANTE: al mover dedos, evitamos que el navegador intente gestos
    e.preventDefault();

    if (__imgZoom.pointers.size === 2) {
      const [a, b] = Array.from(__imgZoom.pointers.values());
      const mid = __mid2(a, b);

      const rect = viewport.getBoundingClientRect();
      const mx = mid.clientX - rect.left;
      const my = mid.clientY - rect.top;

      const d = __dist2(a, b) || 1;
      const nextScale = __imgZoom.pinchStartScale * (d / __imgZoom.pinchStartDist);
      __imgZoom.scale = __clamp(nextScale, __imgZoom.min, __imgZoom.max);

      // Mantener el punto bajo los dedos estable
      __imgZoom.x = mx - __imgZoom.pinchRefPx * __imgZoom.scale;
      __imgZoom.y = my - __imgZoom.pinchRefPy * __imgZoom.scale;

      apply();
      return;
    }

    if (__imgZoom.pointers.size === 1 && __imgZoom.isPanning && __imgZoom.scale > 1) {
      const dx = e.clientX - __imgZoom.panStartX;
      const dy = e.clientY - __imgZoom.panStartY;
      __imgZoom.x = __imgZoom.startX + dx;
      __imgZoom.y = __imgZoom.startY + dy;
      apply();
    }
  };

  const onPointerUp = (e) => {
    __imgZoom.pointers.delete(e.pointerId);
    if (__imgZoom.pointers.size < 2) __imgZoom.isPanning = false;

    // Si vuelves a escala 1, reseteamos desplazamiento para que quede centrado
    if (__imgZoom.scale <= 1) {
      __imgZoom.scale = 1;
      __imgZoom.x = 0;
      __imgZoom.y = 0;
      apply();
    }
  };

  viewport.addEventListener("pointerdown", onPointerDown, { passive: false });
  viewport.addEventListener("pointermove", onPointerMove, { passive: false });
  viewport.addEventListener("pointerup", onPointerUp, { passive: true });
  viewport.addEventListener("pointercancel", onPointerUp, { passive: true });

  // Guardamos cleanup
  __imgViewerCleanup = () => {
    viewport.removeEventListener("pointerdown", onPointerDown);
    viewport.removeEventListener("pointermove", onPointerMove);
    viewport.removeEventListener("pointerup", onPointerUp);
    viewport.removeEventListener("pointercancel", onPointerUp);
  };
}

function closeImageViewer() {
  if (__imgViewerCleanup) {
    __imgViewerCleanup();
    __imgViewerCleanup = null;
  }
  if (__imgViewer) {
    __imgViewer.remove();
    __imgViewer = null;
  }

  // Restaura scroll del fondo
  document.body.style.overflow = __prevBodyOverflow;

  const mainScroll = document.getElementById('main-scroll');
  if (mainScroll) {
    mainScroll.classList.remove('no-scroll');
    mainScroll.style.overflow = __prevMainOverflow;
  }
}

function showMaterialDetails(materialId, isBack = false) {
  const material = FIREBASE_DATA.MATERIALS[materialId];
  if (!material) return;

  const documentosValidos = (material.docs || []).filter(doc => doc.url && doc.name);
  const mainPhoto = documentosValidos.find(doc => doc.type === 'photo');

  const pdfs = documentosValidos.filter(doc => doc.type === 'pdf');
  const photos = documentosValidos.filter(doc => doc.type === 'photo' && doc !== mainPhoto);

  const seccionDescripcion = material.description && material.description.trim() !== ""
    ? `<div class="material-text">
         <p><strong>Descripción:</strong></p>
         <p>${material.description}</p>
       </div>`
    : '';

  // PDFs: lista + botón descargar a la derecha
  const pdfHTML = pdfs.length ? pdfs.map(doc => {
    const downloadUrl = doc.url_download ? driveToDirectDownload(doc.url_download) : doc.url;
    return `
      <div class="doc-row">
        <div class="doc-name">${doc.name}</div>
        <a class="doc-download-btn"
           href="${downloadUrl}"
           target="_blank"
           rel="noopener noreferrer"
           download>Descargar</a>
      </div>
    `;
  }).join('') : `<p class="muted">No hay documentos PDF.</p>`;

  // Imágenes: miniaturas a ancho completo, clic abre visor
  const photosHTML = photos.length ? photos.map(doc => `
    <button class="img-thumb-btn" onclick='openImageViewer(${JSON.stringify(doc.url)}, ${JSON.stringify(doc.name)})'>
      <img src="${doc.url}" alt="${doc.name}" class="material-thumb-img" draggable="false">
    </button>
  `).join('') : `<p class="muted">No hay imágenes.</p>`;

  const content = `
    <div class="material-detail-container">
      ${mainPhoto ? `
        <button class="img-thumb-btn" onclick='openImageViewer(${JSON.stringify(mainPhoto.url)}, ${JSON.stringify(material.name)})'>
          <img src="${mainPhoto.url}" class="material-main-img" alt="${material.name}" draggable="false">
        </button>
      ` : ''}
      ${seccionDescripcion}
    </div>

    <hr>
    <h3>Documentación y Recursos</h3>

    <div class="docs-subsection">
      <h4 class="docs-subsection-title">Documentos pdf</h4>
      <div class="docs-table">
        ${pdfHTML}
      </div>
    </div>

    <div class="docs-subsection">
      <h4 class="docs-subsection-title">Imágenes</h4>
      <div class="docs-images">
        ${photosHTML}
      </div>
    </div>
  `;

  render(content, material.name, { level: 5, materialId }, isBack);
}

/// --- NIVEL 6: Renderizado de Recurso a Pantalla Completa -- ///
/// ---------------------------------------------------------- ///
function driveToDirectDownload(url) {
  try {
    const u = new URL(url);

    // /file/d/<ID>/view
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (m && m[1]) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(m[1])}`;

    // ?id=<ID>
    const id = u.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;

    return url;
  } catch {
    return url;
  }
}

function renderResource(materialId, url, type, resourceName, isBack = false) {
  if (type === "pdf") {
    const material = FIREBASE_DATA.MATERIALS[materialId];
    const docEntry = (material?.docs || []).find(d => d.url === url);

    // Tu URL de descarga viene en doc.url_download
    let downloadUrl = docEntry?.url_download ? driveToDirectDownload(docEntry.url_download) : url;

    const contentPdf = `
      <div class="pdf-basic">
        <a class="pdf-download"
           href="${downloadUrl}"
           target="_blank"
           rel="noopener noreferrer"
           download>
          Descargar
        </a>

        <!-- visor básico dentro de la app -->
        <iframe class="pdf-frame"
                src="${url}"
                title="${resourceName}"
                loading="lazy"></iframe>
      </div>
    `;

    render(contentPdf, resourceName, { level: 6, materialId, url, type, resourceName }, isBack);
    return;
  }

  // resto igual (fotos/vídeos)
  let content = '';
  if (type === 'video' || type === 'video_mp4') {
    content = `<div class="video-container centered-resource"><iframe src="${url}" frameborder="0" allowfullscreen></iframe></div>`;
  } else if (type === 'photo') {
    content = `<img src="${url}" class="centered-resource">`;
  }

  render(`<div class="resource-container-wrapper">${content}</div>`, resourceName, { level: 6, materialId, url, type, resourceName }, isBack);
}

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

    
	// --- NUEVA LÓGICA PARA LA DESCRIPCIÓN ---
    const seccionDescripcion = material.description && material.description.trim() !== "" 
        ? `<div class="material-text">
                <p><strong>Descripción:</strong></p>
                <p>${material.description}</p>
           </div>` 
        : '';

	const seccionRecursos = buildMaterialResourcesHTML(materialId, material);
	
    const content = `
        <div class="material-detail-container" style="${!mainPhoto && !seccionDescripcion ? 'display:none;' : ''}">
            ${mainPhoto ? `<img src="${mainPhoto.url}" class="material-main-img">` : ''} 
            ${seccionDescripcion}
        </div>
        <div style="margin-top: 20px; background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <h3 style="color: #AA1915; margin-top: 0;">📍 Ubicación en Vehículos</h3>
            ${ubicacionesHTML}
        </div>
        ${seccionRecursos}
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
        if (mainScroll) { mainScroll.scrollTop = 0; mainScroll.scrollLeft = 0; }
        
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
let swRegistration = null;

async function initServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) return;

  swRegistration = await navigator.serviceWorker.ready;

  // Si ya hay uno esperando al arrancar
  if (swRegistration.waiting) showUpdateNotice();

  // Cuando se instale uno nuevo
  swRegistration.addEventListener('updatefound', () => {
    const newWorker = swRegistration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      // Cuando termina de instalar y hay un SW previo controlando, entonces es "update"
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        showUpdateNotice();
      }
    });
  });

  // Cuando el nuevo SW toma control, recargamos y quitamos banner
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const banner = document.getElementById('update-banner');
    if (banner) banner.remove();
    window.location.reload();
  });
}

// Llama a esto en DOMContentLoaded (una sola vez)
document.addEventListener('DOMContentLoaded', () => {
  initServiceWorkerUpdates().catch(console.error);
});

async function forzarActualizacion() {
  const banner = document.getElementById('update-banner');
  const btn = banner?.querySelector('button');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Actualizando…';
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const waiting = reg?.waiting || swRegistration?.waiting;

    if (waiting) {
      // Pedimos al SW nuevo que se active YA
      waiting.postMessage({ type: 'SKIP_WAITING' });

      // Importante: quitamos el banner ya para que no se quede “pegado”
      if (banner) banner.remove();

      // Fallback: aunque controllerchange no dispare, recargamos
      setTimeout(() => window.location.reload(), 800);
      return;
    }

    // Si por lo que sea no hay waiting, forzamos búsqueda y recargamos
    await (reg || swRegistration)?.update?.();
  } catch (e) {
    // da igual: recargamos abajo
  }

  if (banner) banner.remove();
  window.location.reload();
}
















































































