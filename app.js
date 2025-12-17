// Variable para rastrear el historial de navegación
let navigationHistory = [];
let mesActualCal = new Date().getMonth();
let añoActualCal = new Date().getFullYear();
let turnoSeleccionadoCal = 'T2'; // Turno por defecto al abrir

const appContent = document.getElementById('app-content');
const backButton = document.getElementById('back-button');

// Inicializa Firebase y la Base de Datos
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Variables globales para almacenar los datos (se llenarán desde Firebase)
let FIREBASE_DATA = {
    VEHICLES: [],
    DETAILS: {},
    MATERIALS: {}
};
// ==========================================================


// Variable para rastrear el historial de navegación... (resto del código)
// ...

// ----------------------------------------------------
// Modificación crucial en el inicio de la aplicación
// ----------------------------------------------------

// Vamos a crear una función de inicialización que cargue los datos antes de renderizar.
document.addEventListener('DOMContentLoaded', () => {
    initializeApp(); 
});

async function initializeApp() {
    // 1. Mostrar un mensaje de carga
    render(`
        <div style="text-align:center; padding-top: 50px;">
            <p>Cargando datos del inventario desde la central...</p>
            <div class="loader"></div> 
        </div>`, 'Cargando...', { level: -1 }, false);
    
    await loadFirebaseData(); // <--- Llamada a la función de carga

    // 2. Renderizar el Dashboard una vez que los datos estén listos
    renderDashboard();
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
    if (id === 'mapa') renderMapaSection();       // ID de data.js
    if (id === 'calendario') renderCalendarioSection(); // ID de data.js
}

// --- FUNCIÓN RENDER del mapa ---
// --- NIVEL 1: SECCIÓN DE MAPA (ACTUALIZADA) ---
async function renderMapaSection() {
    render(`<div id="map"></div>`, 'Mapa de Elementos', { level: 1, section: 'mapa' });

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

    const actionIcon = document.getElementById('header-action-icon');
    const logoImg = document.getElementById('header-logo-img');

    // --- LÓGICA DE ICONOS (DERECHA) ---
    if (state.level === 0) {
        // En el Dashboard: Logo del parque y NO es clicable
        logoImg.src = "images/favicon.png"; 
        actionIcon.classList.remove('header-logo-active');
    } else {
        // En cualquier otro nivel: Icono Home y ES clicable
        logoImg.src = "images/home-icon.png"; 
        actionIcon.classList.add('header-logo-active');
    }

    // Guardamos en el historial si no estamos volviendo atrás
    if (!isBack) {
        navigationHistory.push(state);
    }

    // --- LÓGICA DEL BOTÓN VOLVER (IZQUIERDA) ---
    // Solo se muestra si NO estamos en el nivel 0
    if (state.level === 0) {
        backButton.style.display = 'none';
    } else {
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

    const viewsHTML = detail.views.map(view => `
        <div class="list-item vehicle-card" onclick="showViewHotspots('${vehicleId}', '${view.id}')">
            <img src="${view.image}" alt="${view.name}" class="vehicle-thumb">
            <div class="vehicle-info">
                <h2>${view.name}</h2>
                <p>Pulsa para ver armarios de esta zona</p>
            </div>
        </div>
    `).join('');
	
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
// Nivel 4: Lista de Material (Encabezado eliminado)
// ----------------------------------------------------
function showArmarioMaterial(vehicleId, viewId, hotspotIndex, isBack = false) {
    const detail = FIREBASE_DATA.DETAILS[vehicleId];
    const hotspot = detail.hotspots[viewId][hotspotIndex];

	// -----------------------------------------------------------------
    // PASO CLAVE: Verificación de la estructura
    // -----------------------------------------------------------------

	if (hotspot.sections && hotspot.sections.length > 0) {
		// ---------------------------------------------
        // A) MODO SECCIONES (NUEVO CÓDIGO)
        // La lógica que itera sobre hotspot.sections (Estantería Superior, Central, etc.)
        // ---------------------------------------------
		const tablesHTML = hotspot.sections.map(section => {
        
        	// Generar las filas de la tabla para CADA SECCIÓN
	        const rowsHTML = section.items.map(item => {
	            const material = FIREBASE_DATA.MATERIALS[item.id];
	            
	            if (!material) return `<div class="inventory-row" style="color:red; padding:10px;">ID ${item.id} no encontrado</div>`;
	            
	            const isKit = material.is_kit;
	            const clickAction = isKit 
	                ? `showKitInventory('${item.id}', '${hotspot.name}')`
	                : `showMaterialDetails('${item.id}')`;              
	            
	            const indicator = isKit ? '<span class="kit-indicator">(Ver contenido)</span>' : '';
	            
	            // 2. APLICAR ESTILO AL KIT (Fondo gris oscuro y negrita)
	            const rowClass = isKit ? 'inventory-row kit-row' : 'inventory-row';
	
	            return `
	                <div class="${rowClass}" onclick="${clickAction}">
	                    <div class="col-qty">${item.qty}</div>
	                    <div class="col-name">${material.name} ${indicator}</div>
	                </div>
	            `;
	        }).join('');
	        
	        // Devolvemos una tabla completa por cada sección
	        return `
	            <div class="inventory-table-container">
	                <h4 class="inventory-section-title">${section.name}</h4>
	                <div class="inventory-table">
	                    <div class="inventory-row inventory-header">
	                        <div class="col-qty">nº</div>
	                        <div class="col-name">Material</div>
	                    </div>
	                    ${rowsHTML}
	                </div>
	            </div>
	        `;
	    }).join('');
		render(`<div class="inventory-sections-wrapper">${tablesHTML}</div>`, hotspot.name, { level: 4, vehicleId, viewId, hotspotIndex }, isBack);
	
	} else if (hotspot.inventory && hotspot.inventory.length > 0) {
        // ---------------------------------------------
        // B) MODO SIMPLE
        // La lógica que itera sobre hotspot.inventory (lista única)
        // ---------------------------------------------
        
        // Simplemente mapeamos hotspot.inventory directamente:
        const rowsHTML = hotspot.inventory.map(item => {
	        const material = FIREBASE_DATA.MATERIALS[item.id];
	        
	        if (!material) return `<div class="inventory-row" style="color:red; padding:10px;">ID ${item.id} no encontrado</div>`;
	
	        const isKit = material.is_kit;
	        const clickAction = isKit 
	            ? `showKitInventory('${item.id}', '${hotspot.name}')` // Va al Nivel 5bis
	            : `showMaterialDetails('${item.id}')`;              // Va al Nivel 5
	        
	        const indicator = isKit 
	            ? '<span class="kit-indicator">(Ver contenido)</span>' 
	            : '';
	
	        const rowClass = isKit ? 'inventory-row kit-row' : 'inventory-row';
            
	        return `
	            <div class="${rowClass}" onclick="${clickAction}"> <--- AÑADIDA CLASE
	                <div class="col-qty">${item.qty}</div>
	                <div class="col-name">${material.name} ${indicator}</div>
	            </div>
	        `;
	    }).join('');
	
	    render(`
	        <div class="inventory-table">
	            <div class="inventory-row inventory-header">
	                <div class="col-qty">nº</div>
	                <div class="col-name">Material</div>
	            </div>
	            ${rowsHTML}
	        </div>
	    `, hotspot.name, { level: 4, vehicleId, viewId, hotspotIndex }, isBack);
	} else {
        // No tiene ni secciones ni inventario
        render(`<div style="text-align:center; padding:20px;"><p>Armario vacío. No hay material definido.</p></div>`, hotspot.name, { level: 4, vehicleId, viewId, hotspotIndex }, isBack);
    }
}

// --- NIVEL 4 bis: Muestra una lista de material dentro de una caja, saca u otro contenedor ---
function showKitInventory(kitId, parentName, isBack = false) {
    const kit = FIREBASE_DATA.MATERIALS[kitId];
    
    if (!kit || !kit.kit_contents) {
        alert('Contenedor de kit no encontrado o vacío.');
        return;
    }

    const rowsHTML = kit.kit_contents.map(item => {
        const material = FIREBASE_DATA.MATERIALS[item.id];
        
        // El contenido del kit SIEMPRE va al Nivel 5 (detalles del material)
        const clickAction = `showMaterialDetails('${item.id}')`;
        const indicator = '';

        return `
            <div class="inventory-row" onclick="${clickAction}">
                <div class="col-qty">${item.qty}</div>
                <div class="col-name">${material.name} ${indicator}</div>
            </div>
        `;
    }).join('');

    // Renderizamos la lista con un nivel de 4.5 para el historial
    render(`
        <div class="inventory-table">
            <div class="inventory-row kit-inventory-header">
                <div class="col-qty">Cant.</div>
                <div class="col-name">Contenido del Kit</div>
            </div>
            ${rowsHTML}
        </div>
    `, kit.name, { level: 4.5, kitId, parentName }, isBack);
}

// --- NIVEL 5: Detalles del Material (Navega al Nivel 6) ---
function showMaterialDetails(materialId, isBack = false) {
    const material = FIREBASE_DATA.MATERIALS[materialId];
    const mainPhoto = material.docs.find(doc => doc.type === 'photo');
    const filteredDocs = material.docs.filter(doc => doc !== mainPhoto);

    const docsHTML = filteredDocs.map(doc => {
        if (doc.type === 'video_mp4') {
            return `
                <div class="list-item" onclick="renderResource('${materialId}', '${doc.url}', '${doc.type}', '${doc.name}')">
                    <strong>🎬 Ver ${doc.name} (MP4)</strong>
                </div>`;
        }
        
        // Resto de lógica (YouTube, fotos)
        else {
             return `
                <div class="list-item" onclick="renderResource('${materialId}', '${doc.url}', '${doc.type}', '${doc.name}')">
                    <strong>${doc.type === 'video' ? '📹' : '🖼️'} Ver ${doc.name}</strong>
                </div>`;
        }
    }).join('');

    render(`
        <div class="material-detail-container">
            ${mainPhoto ? `<img src="${mainPhoto.url}" class="material-main-img">` : ''} 
            <div class="material-text">
                <p><strong>Descripción:</strong></p>
                <p>${material.description}</p>
            </div>
        </div>
        <hr>
        <h3>Documentación y Recursos</h3>
        ${docsHTML}
    `, material.name, { level: 5, materialId }, isBack);
}

// --- NIVEL 6: Renderizado de Recurso a Pantalla Completa ---
// --- NIVEL 6: Renderizado de Recurso a Pantalla Completa (Fotos y Vídeos) ---
function renderResource(materialId, url, type, resourceName, isBack = false) {
    let content = '';

    if (type === 'video') {
        // Lógica para VÍDEOS DE YOUTUBE (IFRAME)
        content = `
            <div class="video-container centered-resource">
                <iframe src="${url}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>`;
            
    } else if (type === 'video_mp4') {
        // Lógica para VÍDEOS MP4 LOCALES (HTML5 <video>)
        content = `
            <div class="video-container centered-resource">
                <video controls style="width: 100%; height: 100%; border-radius: 8px;" autoplay> 
                    <source src="${url}" type="video/mp4">
                    Tu navegador no soporta la etiqueta de video HTML5.
                </video>
            </div>`;

    } else if (type === 'photo') {
        content = `<img src="${url}" class="centered-resource" style="box-shadow: 0 4px 15px rgba(0,0,0,0.4);">`;
    } else {
        content = `<p class="centered-resource">Tipo de recurso no compatible para el visor interno.</p>`;
    }
    
    const finalContent = `<div class="resource-container-wrapper">${content}</div>`;
    render(finalContent, resourceName, { level: 6, materialId, url, type, resourceName }, isBack);
}

/// SIMULACIÓN DE NIVEL 6 PARA EL PDF VIEWER
function handleManualOpen(materialId, docName) {
    // 1. Abrimos el PDF en una pestaña externa (o visor nativo)
    // Ya no necesitamos manipular el historial en este punto.

    // 2. Si el usuario vuelve a la app y pulsa el botón "Atrás" (de la app):
    // La función backButton.addEventListener debe manejarlo.
}

// ----------------------------------------------------
// LÓGICA DEL CALENDARIO
// ----------------------------------------------------

/**
 * Lógica matemática de turnos de bomberos - Versión Sin Errores de Horario
 */
function calcularTurnoGuardia(fecha) {
    // 1. Puntos de referencia forzados en UTC para ignorar el Horario de Verano (DST)
    const inicioRef = Date.UTC(2024, 0, 1);
    const fechaUTC = Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    
    // 2. Diferencia de días pura (siempre múltiplo de 24h exactas)
    const diffMs = fechaUTC - inicioRef;
    const diasTotal = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // 3. Cálculo del desplazamiento (Salto de Marzo en años no bisiestos)
    let desplazamiento = 0;
    for (let a = 2024; a < fecha.getFullYear(); a++) {
        if (!esBisiesto(a)) desplazamiento++;
    }

    if (!esBisiesto(fecha.getFullYear()) && fecha.getMonth() >= 2) {
        desplazamiento++;
    }

    // 4. CÁLCULO FINAL
    // Sumamos el desplazamiento porque el salto de guardia adelanta la rotación
    let ciclo = (diasTotal + desplazamiento + 1) % 5;

    // Asegurar resultado positivo
    if (ciclo < 0) ciclo += 5;

    return ciclo + 1; // Devuelve 1, 2, 3, 4 o 5
}

function esBisiesto(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// --- Reemplaza tus funciones de Calendario en app.js por estas ---

function renderCalendarioSection() {
    const botonesHTML = TURNOS_CONFIG.map(t => `
        <button class="turno-btn-small" 
                style="background-color: ${t.color}" 
                onclick="cambiarTurnoCal('${t.id}')">
            ${t.id}
        </button>
    `).join('');

    render(`
        <div class="calendar-header-compact">
            <div class="turno-row">${botonesHTML}</div>
        </div>
        
        <div class="calendar-nav">
            <button onclick="navegarMes(-1)">&#10140;</button>
            
            <div id="mes-titulo-container" class="select-nav-container">
                </div>
            
            <button onclick="navegarMes(1)">&#10140;</button>
        </div>
        <div id="calendar-view-container" class="calendar-view"></div>
    `, 'Calendario de Turnos', { level: 1, section: 'calendario' });

    actualizarVistaCalendario();
}

function actualizarVistaCalendario() {
    const container = document.getElementById('calendar-view-container');
    const navContainer = document.getElementById('mes-titulo-container');
    
    if (!container || !navContainer) return;

    // 1. Buscamos la info del turno seleccionado para obtener su color
    const infoTurno = TURNOS_CONFIG.find(t => t.id === turnoSeleccionadoCal);
    const colorDinamico = infoTurno ? infoTurno.color : '#AA1915'; // Rojo por defecto si falla

    // 2. GENERAR OPCIONES DE MESES Y AÑOS (para los desplegables)
    let mesesOptions = '';
    for (let i = 0; i < 12; i++) {
        const nombreMes = obtenerNombreMes(i);
        const seleccionado = (i === mesActualCal) ? 'selected' : '';
        mesesOptions += `<option value="${i}" ${seleccionado}>${nombreMes}</option>`;
    }

    const añoMin = añoActualCal - 5;
    const añoMax = añoActualCal + 5;
    let añosOptions = '';
    for (let i = añoMin; i <= añoMax; i++) {
        const seleccionado = (i === añoActualCal) ? 'selected' : '';
        añosOptions += `<option value="${i}" ${seleccionado}>${i}</option>`;
    }

    // 3. INYECTAR EL HTML CON DESPLEGABLES
    navContainer.innerHTML = `
        <select id="mes-select" onchange="cambiarMesAño(this.value, 'mes')">
            ${mesesOptions}
        </select>
        <select id="año-select" onchange="cambiarMesAño(this.value, 'año')">
            ${añosOptions}
        </select>
    `;

    // 4. GENERAR LA TABLA DEL CALENDARIO
    let tablaHTML = `<table class="tabla-calendario">
        <thead><tr><th>Lu</th><th>Ma</th><th>Mi</th><th>Ju</th><th>Vi</th><th>Sá</th><th>Do</th></tr></thead>
        <tbody><tr>`;

    const diasMes = new Date(añoActualCal, mesActualCal + 1, 0).getDate();
    let primerDia = new Date(añoActualCal, mesActualCal, 1).getDay();
    if (primerDia === 0) primerDia = 7; // Ajuste para que Lu sea 1 y Do sea 7

    // Rellenar días vacíos al inicio
    for (let i = 1; i < primerDia; i++) tablaHTML += '<td></td>';

    for (let dia = 1; dia <= diasMes; dia++) {
        const fecha = new Date(añoActualCal, mesActualCal, dia);
        const turnoActivo = calcularTurnoGuardia(fecha);
        const idNumerico = parseInt(turnoSeleccionadoCal.replace('T', ''));
        
        const esMiGuardia = (turnoActivo === idNumerico);
        
        // Detectar si la celda es HOY para el borde rojo
        const hoy = new Date();
        const esHoy = (dia === hoy.getDate() && mesActualCal === hoy.getMonth() && añoActualCal === hoy.getFullYear());

        // Construir estilos dinámicos
        let estilosCelda = "";
        if (esMiGuardia) estilosCelda += `background-color:${colorDinamico}; color:white; font-weight:bold;`;
        if (esHoy) estilosCelda += `border: 3px solid #AA1915 !important; font-weight:900;`; // Resaltado del día actual

        const estiloAtributo = estilosCelda ? `style="${estilosCelda}"` : '';

        tablaHTML += `<td ${estiloAtributo}>${dia}</td>`;
        if (fecha.getDay() === 0 && dia !== diasMes) tablaHTML += '</tr><tr>';
    }

    tablaHTML += '</tr></tbody></table>';
    
    // 5. Generar el footer con la información de hoy y la leyenda
    const hoy = new Date();
    const turnoHoyId = calcularTurnoGuardia(hoy);
    const infoTurnoHoy = TURNOS_CONFIG.find(t => parseInt(t.id.replace('T','')) === turnoHoyId);
    
    const infoExtraHTML = `
        <div class="calendar-footer">
            <div class="hoy-badge" style="border-left: 5px solid ${infoTurnoHoy.color}">
                <strong>HOY:</strong> Guardia del <span>${infoTurnoHoy.name}</span>
            </div>
            <div class="leyenda-item">
                <span class="dot" style="background-color: ${colorDinamico}"></span>
                Mostrando guardias del <strong>${turnoSeleccionadoCal}</strong>
            </div>
        </div>
    `;

    // 6. Inyectar todo el contenido
    container.innerHTML = tablaHTML + infoExtraHTML;
}

function cambiarMesAño(valor, tipo) {
    if (tipo === 'mes') {
        mesActualCal = parseInt(valor);
    } else if (tipo === 'año') {
        añoActualCal = parseInt(valor);
    }
    actualizarVistaCalendario();
}

// Asegúrate de BORRAR cualquier otra copia de actualizarVistaCalendario que tengas abajo.

function mostrarTurnoEnCalendario(turnoId) {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = hoy.getMonth();
    const container = document.getElementById('calendar-view-container');
    
    let tablaHTML = `
        <h4 style="text-align:center;">Guardias ${turnoId} - ${obtenerNombreMes(mes)}</h4>
        <table class="tabla-calendario">
            <thead>
                <tr><th>Lu</th><th>Ma</th><th>Mi</th><th>Ju</th><th>Vi</th><th>Sá</th><th>Do</th></tr>
            </thead>
            <tbody><tr>`;

    const diasMes = new Date(año, mes + 1, 0).getDate();
    let primerDia = new Date(año, mes, 1).getDay();
    if (primerDia === 0) primerDia = 7; // Ajuste para que Lunes sea 1

    // Espacios iniciales
    for (let i = 1; i < primerDia; i++) tablaHTML += '<td></td>';

    for (let dia = 1; dia <= diasMes; dia++) {
        const fecha = new Date(añoActualCal, mesActualCal, dia);
        const turnoActivo = calcularTurnoGuardia(fecha);
        const idNumerico = parseInt(turnoSeleccionadoCal.replace('T', ''));
        
        const esMiGuardia = (turnoActivo === idNumerico);
        
        // Eliminamos border-radius:50% y ajustamos el estilo para llenar la celda
        const estilo = esMiGuardia ? `style="background-color:${colorDinamico}; color:white; font-weight:bold;"` : '';

        tablaHTML += `<td ${estilo}>${dia}</td>`;
        if (fecha.getDay() === 0 && dia !== diasMes) tablaHTML += '</tr><tr>';
    }

    tablaHTML += '</tr></tbody></table>';
    container.innerHTML = tablaHTML;
}

function obtenerNombreMes(n) {
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return meses[n];
}

function navegarMes(direccion) {
    mesActualCal += direccion;
    if (mesActualCal < 0) { mesActualCal = 11; añoActualCal--; }
    if (mesActualCal > 11) { mesActualCal = 0; añoActualCal++; }
    actualizarVistaCalendario();
}

function cambiarTurnoCal(turnoId) {
    turnoSeleccionadoCal = turnoId;
    actualizarVistaCalendario();
}

// ----------------------------------------------------
// LÓGICA DEL BOTÓN VOLVER
// ----------------------------------------------------
backButton.addEventListener('click', () => {
    if (navigationHistory.length > 1) {
        // Quitamos el nivel actual
        navigationHistory.pop(); 
        // Cogemos el estado anterior
        const target = navigationHistory[navigationHistory.length - 1]; 
        
		if (target.level === 0) renderDashboard(true); // Nuevo retroceso al 0
        if (target.level === 1) renderVehiclesList(true);
        if (target.level === 2) showVehicleViews(target.vehicleId, true);
        if (target.level === 3) showViewHotspots(target.vehicleId, target.viewId, true);
        if (target.level === 4) showArmarioMaterial(target.vehicleId, target.viewId, target.hotspotIndex, true);
        if (target.level === 4.5) showKitInventory(target.kitId, target.parentName, true);
        if (target.level === 5) showMaterialDetails(target.materialId, true);
        if (target.level === 6) renderResource(target.materialId, target.url, target.type, target.resourceName, true);
    }
});

// Al cargar la primera vez, vamos al Dashboard (Nivel 0)
document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
});

function goToHome() {
    // Si ya estamos en el dashboard, no hacemos nada
    if (navigationHistory.length > 0 && navigationHistory[navigationHistory.length - 1].level === 0) {
        return;
    }
    // Vaciamos el historial para que el botón de atrás desaparezca al renderizar el Dashboard
    navigationHistory = [];
    renderDashboard();
}

















