// 1. DEFINICIÓN DE VARIABLES GLOBALES E INICIALIZACIÓN
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const rtdb = firebase.database(); // Inicializamos Realtime Database
const auth = firebase.auth(); // Inicializamos Auth
let currentUser = null; // Variable global para el usuario
let __pendingSection = null; // Sección pendiente de cargar tras login

let navigationHistory = [];
let __prevViewportContent = null;
let mesActualCal = new Date().getMonth();
let añoActualCal = new Date().getFullYear();
let turnoSeleccionadoCal = 'T2';
let __updateBannerShown = false;
let __updatesInitDone = false;
let __prevBodyOverflow = '';
let __leafletMap = null; // Instancia global del mapa Leaflet para poder destruirla al reinicializar
let __prevMainOverflow = '';

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

  pinchStartDist: 1,
  pinchStartScale: 1,
  pinchRefPx: 0,
  pinchRefPy: 0,

  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  startX: 0,
  startY: 0,

  // corrección del zoom con scroll
  normalizedScroll: false,
  lastScrollLeft: 0,
  lastScrollTop: 0,
  baseScrollLeft: 0,
  baseScrollTop: 0
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
  // 1. Cargar datos de Firebase (no requieren autenticación)
  await loadFirebaseData();

  // 2. Escuchar cambios de sesión en segundo plano (sin bloquear el arranque)
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      // Cargar perfil extendido (Turno, Rango, Stats)
      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        currentUser.profile = userDoc.exists ? userDoc.data() : { turno: 'T1' };
      } catch (e) { console.error("Error cargando perfil:", e); }

      // Aplicar turno del usuario al calendario
      if (currentUser.profile?.turno) {
        turnoSeleccionadoCal = currentUser.profile.turno;
      }

      // Si había una sección pendiente (ej. Calendario), navegar ahora
      if (__pendingSection === 'calendario') {
        __pendingSection = null;
        renderCalendarioSection();
      }
    } else {
      currentUser = null;
    }
  });

  // 3. Mostrar el Dashboard inmediatamente (sin esperar a la autenticación)
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
  if (__updateBannerShown) return;
  if (document.getElementById('update-banner')) {
    __updateBannerShown = true;
    return;
  }

  __updateBannerShown = true;

  const aviso = document.createElement('div');
  aviso.id = 'update-banner';
  aviso.innerHTML = `
    <div style="position:fixed; bottom:15px; left:15px; right:15px; z-index:99999; background:#222; color:#fff; padding:12px 14px; border-radius:10px; display:flex; align-items:center; gap:12px;">
      <span style="flex:1;">Nueva versión disponible</span>
      <button onclick="forzarActualizacion()" style="background:#AA1915; color:#fff; border:0; padding:10px 14px; border-radius:8px; font-weight:bold; cursor:pointer;">
        ACTUALIZAR
      </button>
    </div>
  `;
  document.body.appendChild(aviso);
}

function navigateToSection(id) {
  if (id === 'inventario') renderVehiclesList(); // ID de data.js
  if (id === 'material_global') renderGlobalMaterialList();       // ID de data.js
  if (id === 'mapa') renderMapaSection();       // ID de data.js
  if (id === 'calendario') {
    // El Calendario requiere autenticación
    if (currentUser) {
      renderCalendarioSection();
    } else {
      __pendingSection = 'calendario';
      renderLogin('Para acceder a tu Calendario, identifícate primero.');
    }
  }
  if (id === 'ranking') renderRankingSection(); // NUEVO (ranking.js)
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalonePWA() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}


// ---------------------------------------------------------
// RENDER DASHBOARD (Pantalla Principal)
// ---------------------------------------------------------
function renderDashboard() {
  console.log("Render Dashboard called. esAdmin() =", esAdmin());
  // Limpiamos historia al volver al inicio
  navigationHistory = [];

  const html = `
    <div style="text-align: center; margin-bottom: 20px;">
        <img src="images/favicon.png" alt="Logo" style="width: 80px; height: 80px;">
        <h2 style="color: #AA1915; margin: 10px 0;">BOMBEROS GIJÓN</h2>
    </div>

    <div class="dashboard-grid">
        ${SECCIONES_INICIO.map(sec => `
            <div class="card" onclick="navigateTo('${sec.id}')">
                <img src="${sec.image_url}" alt="${sec.name}">
                <h3>${sec.name}</h3>
            </div>
        `).join('')}

        ${esAdmin() ? `
            <div class="card" onclick="renderAdminPanel()" style="border: 2px dashed #AA1915; background-color: #fff0f0;">
                <div style="font-size: 40px;">⚙️</div>
                <h3 style="color:#AA1915;">Panel Admin</h3>
            </div>
        ` : ''}
    </div>

    <div style="padding: 20px; text-align: center;">
        <button onclick="handleLogout()" style="background:none; border: 1px solid #ccc; padding: 10px 20px; border-radius: 20px; color: #666;">
            Cerrar Sesión (${currentUser.email})
        </button>
    </div>
  `;

  render(html, 'Dashboard', { level: 0 }, true); // True para limpiar historia visual si se requiere
  // Aseguramos que el botón atrás no se vea
  if (backButton) backButton.style.display = 'none';
}

function getPdfDownloadHrefAndAttrs(doc) {
  const isIOSPWA = isIOSDevice() && isStandalonePWA();

  // Igual que en showMaterialDetails():
  // iOS PWA -> abrir enlace "view/preview" (url_download) sin descarga directa
  // resto -> descarga directa si hay url_download
  const href = doc.url_download
    ? (isIOSPWA ? doc.url_download : driveToDirectDownload(doc.url_download))
    : doc.url;

  // Igual que en showMaterialDetails():
  const attrs = isIOSPWA
    ? `rel="noopener noreferrer"`
    : `target="_blank" rel="noopener noreferrer" download`;

  return { href, attrs };
}

// --- FUNCIÓN RENDER del mapa ---
// --- NIVEL 1: SECCIÓN DE MAPA (ACTUALIZADA) ---
async function renderMapaSection(isBack = false) { // <--- Añadir isBack
  // 1. Preparamos el contenedor.
  // Lo ponemos en el main-scroll pero FUERA del zoom-layer
  let mapDiv = document.getElementById('map');
  if (!mapDiv) {
    mapDiv = document.createElement('div');
    mapDiv.id = 'map';
  }

  // Destruir instancia previa de Leaflet para evitar "Map container is already initialized"
  if (__leafletMap) {
    try { __leafletMap.remove(); } catch(e) { console.warn('Error al destruir mapa previo:', e); }
    __leafletMap = null;
  }

  // Movemos el div fuera de la capa de zoom para que no herede escalas
  mainScroll.appendChild(mapDiv);

  // Ocultamos el zoom-layer para que no moleste visualmente
  zoomLayer.style.display = 'none';
  mapDiv.style.display = 'block';

  // Actualizamos el header y el historial de navegación manualmente
  // (renderMapaSection no llama a render() porque el mapa vive fuera del zoom-layer)
  document.querySelector('header h1').textContent = 'Mapa de Elementos';
  const actionIcon = document.getElementById('header-action-icon');
  const logoImg = document.getElementById('header-logo-img');
  if (actionIcon) { actionIcon.style.display = 'block'; actionIcon.classList.add('header-logo-active'); }
  if (logoImg) logoImg.src = 'images/home-icon.png';
  if (backButton) backButton.style.display = 'inline';
  mainScroll.style.touchAction = 'auto'; // Deja que Leaflet gestione los toques
  if (!isBack) {
    navigationHistory.push({ level: 1, section: 'mapa' });
    const idx = navigationHistory.length - 1;
    if (idx === 0) history.replaceState({ stateIndex: 0 }, 'Mapa de Elementos');
    else history.pushState({ stateIndex: idx }, 'Mapa de Elementos');
  }

  setTimeout(() => {
    // Inicializar Leaflet con soporte táctil total
    __leafletMap = L.map('map', {
      touchZoom: true,
      tap: false,
      zoomControl: true
    }).setView([43.5322, -5.6611], 14);
    const map = __leafletMap;

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

          if (capa.label === 'Límites concejo' || capa.label === 'Hidrantes') {
            geojsonLayer.addTo(map);
          }

          selectorCapas.addOverlay(geojsonLayer, capa.label);
        });
    });

    // --- 2. FUNCIONALIDAD NUEVA: UBICACIÓN DOTACIONES (MANTENIDA) ---
    const ubicacionLayer = L.layerGroup();
    selectorCapas.addOverlay(ubicacionLayer, "Ubicación dotaciones <span style='font-size:0.8em'>🔴 EN VIVO</span>");

    const iconoDefault = L.divIcon({
      html: '<div style="background-color: white; border-radius: 50%; box-shadow: 0 0 5px rgba(0,0,0,0.5); width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; font-size: 20px;">🚒</div>',
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });

    const getIconForUser = (userId) => {
      const id = userId.toLowerCase().trim();
      let iconUrl = null;

      if (id === "primera salida") iconUrl = 'images/icon-primera-salida.png';
      else if (id === "segunda salida") iconUrl = 'images/icon-segunda-salida.png';
      else if (id === "autoescalera") iconUrl = 'images/icon-autoescalera.png';

      if (iconUrl) {
        return L.icon({
          iconUrl: iconUrl,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -20]
        });
      }
      return iconoDefault;
    };

    let usuariosRef = null;
    const onLocationUpdate = (snapshot) => {
      ubicacionLayer.clearLayers();
      const usuarios = snapshot.val();
      if (!usuarios) return;

      Object.keys(usuarios).forEach(userId => {
        const data = usuarios[userId];
        if (data.lat && data.lng) {
          const marker = L.marker([data.lat, data.lng], {
            icon: getIconForUser(userId),
            zIndexOffset: 10000
          });

          let timeStr = "";
          if (data.timestamp) {
            const date = new Date(data.timestamp);
            timeStr = `<br><span style="color:gray; font-size:0.8em">Act: ${date.toLocaleTimeString()}</span>`;
          }

          marker.bindPopup(`<b>${userId}</b>${timeStr}`);
          ubicacionLayer.addLayer(marker);
        }
      });
    };

    map.on('overlayadd', (e) => {
      if (e.name.includes("Ubicación dotaciones")) {
        console.log("Activando escucha de ubicaciones...");
        if (!usuariosRef) {
          usuariosRef = rtdb.ref('usuarios');
          usuariosRef.on('value', onLocationUpdate);
        }
      }
    });

    map.on('overlayremove', (e) => {
      if (e.name.includes("Ubicación dotaciones")) {
        console.log("Desactivando escucha de ubicaciones...");
        if (usuariosRef) {
          usuariosRef.off('value', onLocationUpdate);
          usuariosRef = null;
        }
        ubicacionLayer.clearLayers();
      }
    });

    // ── MI UBICACIÓN (estilo Google Maps) ──────────────────────────────
    let __geoWatchId = null;
    let __myMarker = null;
    let __myAccCircle = null;
    let __firstFix = true;

    // Icono personalizado: punto azul con pulso
    const myLocIcon = L.divIcon({
      className: '',
      html: '<div class="my-location-dot"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -12]
    });

    function actualizarMiUbicacion(pos) {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const latlng = [lat, lng];

      // Crear o mover el marcador
      if (!__myMarker) {
        __myMarker = L.marker(latlng, { icon: myLocIcon, zIndexOffset: 20000 })
          .bindPopup('<b>Mi ubicación</b>')
          .addTo(map);
      } else {
        __myMarker.setLatLng(latlng);
      }

      // Crear o actualizar el círculo de precisión
      if (!__myAccCircle) {
        __myAccCircle = L.circle(latlng, {
          radius: accuracy,
          color: '#4285F4',
          fillColor: '#4285F4',
          fillOpacity: 0.10,
          weight: 1.5,
          opacity: 0.4
        }).addTo(map);
      } else {
        __myAccCircle.setLatLng(latlng).setRadius(accuracy);
      }

      // La primera vez centramos el mapa en nuestra posición
      if (__firstFix) {
        __firstFix = false;
        map.setView(latlng, Math.max(map.getZoom(), 16));
      }
    }

    function errorUbicacion(err) {
      console.warn('Error de geolocalización:', err.message);
    }

    function iniciarLocalizacion(btn) {
      if (!('geolocation' in navigator)) {
        alert('Tu dispositivo no tiene soporte de geolocalización.');
        return;
      }
      if (__geoWatchId !== null) {
        // Ya está activo → parar
        navigator.geolocation.clearWatch(__geoWatchId);
        __geoWatchId = null;
        if (__myMarker) { __myMarker.remove(); __myMarker = null; }
        if (__myAccCircle) { __myAccCircle.remove(); __myAccCircle = null; }
        __firstFix = true;
        btn.classList.remove('active');
        return;
      }
      // Iniciar seguimiento
      btn.classList.add('active');
      __geoWatchId = navigator.geolocation.watchPosition(
        actualizarMiUbicacion,
        errorUbicacion,
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
      // Primera lectura rápida para centrar el mapa de inmediato
      navigator.geolocation.getCurrentPosition(actualizarMiUbicacion, errorUbicacion, { enableHighAccuracy: true });
    }

    // Control de Leaflet personalizado con el botón de localización
    const LocateControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd() {
        const btn = L.DomUtil.create('button', 'locate-me-btn');
        btn.title = 'Mi ubicación';
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
          </svg>`;
        L.DomEvent.on(btn, 'click', L.DomEvent.stopPropagation);
        L.DomEvent.on(btn, 'click', () => iniciarLocalizacion(btn));
        return btn;
      }
    });
    new LocateControl().addTo(map);

    // Limpiar geolocalización cuando el mapa se destruya
    map.on('unload', () => {
      if (__geoWatchId !== null) {
        navigator.geolocation.clearWatch(__geoWatchId);
        __geoWatchId = null;
      }
    });
    // ──────────────────────────────────────────────────────────────────

  }, 100);
}

// --- FUNCIÓN RENDER LOGIN ---
// mensaje: texto contextual opcional (ej. "Para acceder al Calendario...")
function renderLogin(mensaje = '') {
  // Si el login es por sección pendiente, podemos volver atrás al dashboard
  const haySeccionPendiente = !!__pendingSection;

  const mensajeHTML = mensaje
    ? `<p style="color: #666; font-size: 0.9em; margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 6px;">${mensaje}</p>`
    : '';

  const cancelarHTML = haySeccionPendiente
    ? `<div style="margin-top: 10px;">
          <button onclick="__pendingSection = null; renderDashboard();" style="background:none; border:none; color:#999; text-decoration:underline; cursor:pointer; font-size:0.9em;">
              Cancelar
          </button>
       </div>`
    : '';

  const loginHTML = `
        <div style="padding: 40px 20px; text-align: center; max-width: 400px; margin: 0 auto;">
            <img src="images/favicon.png" style="width: 80px; margin-bottom: 20px;">
            <h2 style="color: #AA1915; margin-bottom: 20px;">Bomberos Gijón</h2>

            ${mensajeHTML}
            
            <div style="margin-bottom: 15px;">
                <input type="email" id="login-email" placeholder="Correo electrónico" 
                       style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 16px;">
            </div>
            
            <div style="margin-bottom: 24px;">
                <input type="password" id="login-pass" placeholder="Contraseña" 
                       style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 16px;">
            </div>

            <button onclick="handleLogin()" 
                    style="width: 100%; padding: 14px; background: #AA1915; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">
                ENTRAR
            </button>
            
            <div style="margin-top: 20px;">
                <button onclick="renderRegister()" style="background:none; border:none; color:#AA1915; text-decoration:underline; cursor:pointer;">
                    ¿No tienes cuenta? Crear una
                </button>
            </div>

            ${cancelarHTML}

            <p id="login-error" style="color: red; margin-top: 15px; display: none;"></p>
        </div>
    `;

  // Renderizamos sin historial (-1) y sin botón atrás
  render(loginHTML, 'Acceso', { level: -1 }, true);
  backButton.style.display = 'none';
}

// --- FUNCIÓN RENDER REGISTRO ---
function renderRegister() {
  navigationHistory = []; // Reset historia
  const html = `
        <div style="padding: 30px 20px; text-align: center; max-width: 400px; margin: 0 auto;">
            <h2 style="color: #AA1915; margin-bottom: 20px;">Crear Cuenta de Personal</h2>
            
            <!-- 1. Elige Turno -->
            <label style="display:block; text-align:left; margin-bottom:5px; font-weight:bold;">1. Selecciona tu Turno:</label>
            <select id="reg-turno" onchange="cargarNombresDisponibles(this.value)" style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 6px;">
                <option value="" disabled selected>-- Elige Turno --</option>
                <option value="T1">Turno 1</option>
                <option value="T2">Turno 2</option>
                <option value="T3">Turno 3</option>
                <option value="T4">Turno 4</option>
                <option value="T5">Turno 5</option>
            </select>

            <!-- 2. Elige Nombre (se carga dinámicamente) -->
            <label style="display:block; text-align:left; margin-bottom:5px; font-weight:bold;">2. Selecciona tu Identidad:</label>
            <select id="reg-personal-id" style="width: 100%; padding: 10px; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 6px; background-color: #f9f9f9;" disabled>
                <option value="">-- Primero selecciona Turno --</option>
            </select>

            <!-- Datos de acceso -->
            <label style="display:block; text-align:left; margin-bottom:5px; font-weight:bold;">3. Datos de Acceso:</label>
            <input type="email" id="reg-email" placeholder="Correo electrónico" 
                   style="width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 6px;">
            
            <input type="password" id="reg-pass" placeholder="Contraseña (min 6 carácteres)" 
                   style="width: 100%; padding: 10px; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 6px;">

            <button onclick="handleRegister()" 
                    style="width: 100%; padding: 14px; background: #AA1915; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">
                REGISTRARSE
            </button>
            
            <div style="margin-top: 15px;">
                <button onclick="renderLogin()" style="background:none; border:none; color:#666; text-decoration:underline;">
                    Volver al login
                </button>
            </div>
            
            <p id="reg-error" style="color: red; margin-top: 15px; display: none;"></p>
        </div>
    `;
  render(html, 'Registro', { level: -1 }, true);
  backButton.style.display = 'none';
}

async function handleRegister() {
  const personalId = document.getElementById('reg-personal-id').value;
  const turno = document.getElementById('reg-turno').value;
  const email = document.getElementById('reg-email').value;
  const pass = document.getElementById('reg-pass').value;
  const errorMsg = document.getElementById('reg-error');

  // Obtener nombre y rango del option seleccionado (dataset)
  const selectPersonal = document.getElementById('reg-personal-id');
  const selectedOption = selectPersonal.options[selectPersonal.selectedIndex];

  if (!personalId || !email || !pass || !turno) {
    errorMsg.textContent = "Rellena todos los campos y selecciona tu nombre";
    errorMsg.style.display = 'block';
    return;
  }

  const nombre = selectedOption.getAttribute('data-nombre');
  const rango = selectedOption.getAttribute('data-rango');

  errorMsg.style.color = '#666';
  errorMsg.textContent = "Vinculando cuenta...";
  errorMsg.style.display = 'block';

  try {
    // 1. Crear en Auth
    const userCred = await auth.createUserWithEmailAndPassword(email, pass);
    const user = userCred.user;

    // 2. Transacción Firestore:
    //    a) Crear doc en 'users'
    //    b) Actualizar doc en 'personnel' con linkedUid

    const batch = db.batch();

    // Referencia al usuario
    const userRef = db.collection('users').doc(user.uid);
    batch.set(userRef, {
      nombre: nombre,
      rango: rango,
      turno: turno,
      email: email,
      personalDocId: personalId, // Vinculo inverso
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      stats: {
        ap_gastados: 0,
        vacaciones_gastadas: 0,
        ref_obl_hechos: 0,
        horas_vol_anuales: 0
      }
    });

    // Referencia al personal (marcarlo como ocupado)
    const personalRef = db.collection('personnel').doc(personalId);
    batch.update(personalRef, {
      linkedUid: user.uid
    });

    await batch.commit();

  } catch (error) {
    console.error(error);
    errorMsg.style.color = 'red';
    if (error.code === 'auth/email-already-in-use') {
      errorMsg.textContent = "El correo ya está registrado. Prueba a iniciar sesión.";
    } else {
      errorMsg.textContent = error.message;
    }
  }
}




// --- LÓGICA DE LOGIN ---
function handleLogin() {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;
  const errorMsg = document.getElementById('login-error');

  if (!email || !pass) {
    errorMsg.textContent = "Introduce correo y contraseña";
    errorMsg.style.display = "block";
    return;
  }

  errorMsg.textContent = "Verificando...";
  errorMsg.style.display = "block";
  errorMsg.style.color = "#666";

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => {
      // El onAuthStateChanged se encargará de redirigir
    })
    .catch((error) => {
      console.error(error);
      errorMsg.style.color = "red";
      if (error.code === 'auth/operation-not-allowed') {
        errorMsg.innerHTML = "Error de configuración: Habilita <b>Email/Password</b> en Firebase Console y guarda cambios.";
      } else if (error.message.includes("blocked")) {
        errorMsg.innerHTML = "Acceso bloqueado. Verifica que el proveedor Email/Password esté habilitado y <b>GUARDADO</b> en Firebase.";
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials') {
        errorMsg.textContent = "Nombre de usuario o contraseña incorrectos";
      } else if (error.code === 'auth/invalid-email') {
        errorMsg.textContent = "El correo no es válido";
      } else {
        errorMsg.textContent = "Nombre de usuario o contraseña incorrectos"; // Fallback genérico para otros errores de login
      }
    });
}

function handleLogout() {
  if (confirm("¿Cerrar sesión?")) {
    auth.signOut().then(() => {
      // Re-renderizar dashboard como usuario anónimo (sin botón de sesión)
      renderDashboard();
    });
  }
}

// --- FUNCIÓN RENDER ---
function render(contentHTML, title, state, isBack = false) {

  // 👉 NUEVO: Limpieza del Mapa Aislado
  // Si existe el div del mapa (que sacamos fuera), lo ocultamos para que no tape el Dashboard
  const existingMap = document.getElementById('map');
  if (existingMap) {
    existingMap.style.display = 'none';
  }

  // 👉 NUEVO: Asegurar que la capa de contenido normal sea visible
  // (Porque en la sección mapa la ocultamos)
  if (zoomLayer) {
    zoomLayer.style.display = 'block';
  }

  // ✅ 1) SIEMPRE: resetear zoom y posición antes de dibujar una nueva pantalla
  if (typeof resetAppZoom === "function") {
    // Evita que te “herede” el zoom de la pantalla anterior
    resetAppZoom();
  }
  // ✅ CONTROL CRÍTICO: Si NO es el mapa, bloqueamos el zoom nativo para usar el tuyo.
  // Si ES el mapa, permitimos que el navegador (y Leaflet) gestionen los dedos.
  if (mainScroll) {
    if (state.section === 'mapa') {
      mainScroll.style.touchAction = 'auto'; // Deja que Leaflet trabaje
    } else {
      mainScroll.style.touchAction = 'pan-x pan-y'; // Tu sistema de zoom toma el control
    }
  }
  if (zoomLayer) {
    // Por si quedara algún transform colgado por cualquier razón
    zoomLayer.style.transform = "translate(0px, 0px) scale(1)";
  }

  // ✅ 2) Pintar contenido
  appContent.innerHTML = contentHTML;
  document.querySelector('header h1').textContent = title;

  // ✅ 3) Historial
  if (!isBack) {
    navigationHistory.push(state);
    const idx = navigationHistory.length - 1;

    if (idx === 0) {
      history.replaceState({ stateIndex: 0 }, title);
    } else {
      history.pushState({ stateIndex: idx }, title);
    }
  }

  // ✅ 4) Header
  const actionIcon = document.getElementById('header-action-icon');
  const logoImg = document.getElementById('header-logo-img');

  if (state.level === -1) {
    // Pantalla de Login: ocultar todo
    actionIcon.style.display = 'none';
    backButton.style.display = 'none';
  } else if (state.level === 0) {
    // Dashboard
    actionIcon.style.display = 'block';
    logoImg.src = "images/favicon.png";
    actionIcon.classList.remove('header-logo-active');
    backButton.style.display = 'none';
  } else {
    // Secciones interiores
    actionIcon.style.display = 'block';
    logoImg.src = "images/home-icon.png";
    actionIcon.classList.add('header-logo-active');
    backButton.style.display = 'inline';
  }
}

// ---------------------------------------------------- //
// --- FUNCIONES PARA EL ZOOM ESPECIAL ---------------- //
function __clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function __dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
function __mid(a, b) { return { clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 }; }

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
  if (mainScroll) {
    // Si estuvimos en modo "normalizedScroll", restauramos la posición real
    if (__appZoom.normalizedScroll) {
      const finalScrollLeft = Math.max(0, __appZoom.baseScrollLeft + (-__appZoom.x));
      const finalScrollTop = Math.max(0, __appZoom.baseScrollTop + (-__appZoom.y));

      mainScroll.style.overflow = 'auto';
      mainScroll.scrollLeft = finalScrollLeft;
      mainScroll.scrollTop = finalScrollTop;
    }
  }

  __appZoom.scale = 1;
  __appZoom.x = 0;
  __appZoom.y = 0;
  __appZoom.pointers.clear();
  __appZoom.isPanning = false;

  __appZoom.normalizedScroll = false;
  __appZoom.baseScrollLeft = 0;
  __appZoom.baseScrollTop = 0;

  applyAppZoom();
}

function initAppZoom() {
  if (!mainScroll || !zoomLayer) return;

  applyAppZoom();

  // IMPORTANTE: passive:false para poder usar preventDefault()
  // IMPORTANTE: passive:false para poder usar preventDefault()
  mainScroll.addEventListener('pointerdown', (e) => {
    // NUEVA LÍNEA: Si el toque es dentro del mapa, no ejecutar el zoom de la App
    if (e.target.closest('#map')) return;
    __appZoom.pointers.set(e.pointerId, e);

    // SOLO si ya estamos con zoom, capturamos para hacer pan, y prevenimos default
    if (__appZoom.scale > 1) {
      mainScroll.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }

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

      // ✅ IMPORTANTE: incluir scroll actual
      const sl = mainScroll.scrollLeft;
      const st = mainScroll.scrollTop;

      __appZoom.lastScrollLeft = sl;
      __appZoom.lastScrollTop = st;
      __appZoom.normalizedScroll = false;

      __appZoom.pinchStartDist = __dist(a, b) || 1;
      __appZoom.pinchStartScale = __appZoom.scale;

      // ✅ Punto del contenido (sin escala) que está bajo el midpoint
      __appZoom.pinchRefPx = (mx + sl - __appZoom.x) / __appZoom.scale;
      __appZoom.pinchRefPy = (my + st - __appZoom.y) / __appZoom.scale;

      __appZoom.isPanning = false;
    }
  }, { passive: false });

  mainScroll.addEventListener('pointermove', (e) => {
    if (e.target.closest('#map')) return; // IGNORAR SI ES EL MAPA
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

      // ✅ incluir scroll actual
      const sl = mainScroll.scrollLeft;
      const st = mainScroll.scrollTop;

      const d = __dist(a, b) || 1;
      const nextScale = __appZoom.pinchStartScale * (d / __appZoom.pinchStartDist);
      __appZoom.scale = __clamp(nextScale, __appZoom.min, __appZoom.max);

      // ✅ Mantener el punto bajo el midpoint estable (usando mx+scroll)
      __appZoom.x = (mx + sl) - __appZoom.pinchRefPx * __appZoom.scale;
      __appZoom.y = (my + st) - __appZoom.pinchRefPy * __appZoom.scale;

      // ✅ Cuando pasamos de 1x a >1x por primera vez, movemos scroll -> translate
      if (__appZoom.scale > 1 && !__appZoom.normalizedScroll) {
        // Guardamos el scroll real que había antes de pasar a pan por translate
        __appZoom.baseScrollLeft = sl;
        __appZoom.baseScrollTop = st;

        // Convertimos scroll -> translate
        __appZoom.x -= sl;
        __appZoom.y -= st;

        // A partir de aquí el scroll real queda a 0 y todo se mueve por translate
        mainScroll.scrollLeft = 0;
        mainScroll.scrollTop = 0;

        __appZoom.normalizedScroll = true;
      }

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
    if (__appZoom.scale <= 1.02) {
      __appZoom.scale = 1;
      resetAppZoom();
    }
  };

  mainScroll.addEventListener('pointerup', end, { passive: true });
  mainScroll.addEventListener('pointercancel', end, { passive: true });
}

// ----------------------------------------------------
// Nivel 0: DASHBOARD (Pantall de inicio)
// ----------------------------------------------------
function renderDashboard(isBack = false) {
  // 1. Generar HTML de las tarjetas normales
  const dashboardHTML = SECCIONES_INICIO.map(seccion => `
        <div class="dashboard-item" onclick="navigateToSection('${seccion.id}')">
            ${seccion.image_url ? `<img src="${seccion.image_url}" alt="${seccion.name}" class="dashboard-icon">` : '❓'}
            <p>${seccion.name}</p>
        </div>
    `).join('');

  // 2. Generar HTML del botón Admin (si corresponde)
  const adminHTML = esAdmin() ? `
        <div class="dashboard-item" onclick="renderAdminPanel()" style="border: 2px dashed #AA1915; background-color: #fff0f0;">
             <div style="font-size: 40px; margin-bottom: 10px;">⚙️</div>
             <p style="color:#AA1915;">Panel Admin</p>
        </div>
  ` : '';

  // 3. Botón cerrar sesión: solo si hay sesión activa
  const logoutHTML = currentUser ? `
        <div style="text-align: center; margin-top: 40px; margin-bottom: 60px;">
            <button onclick="handleLogout()" style="background: none; border: 1px solid #ccc; padding: 10px 20px; border-radius: 20px; color: #666; font-size: 0.9em; cursor: pointer;">
                Cerrar Sesión (${currentUser.email})
            </button>
        </div>
  ` : '';

  // 4. Renderizar todo junto
  render(`
        <div class="dashboard-grid">
            ${dashboardHTML}
            ${adminHTML}
        </div>
        ${logoutHTML}
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

    // AQUÍ DEJO EL NOMBRE DE CADA HOTSPOT VACÍO DE MOMENTO. SI BORRO ESTA LÍNEA VUELVE A USARSE LA LÓGICA DE ARRIBA
    shortName = "";

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

  const kitDocs = (kit.docs || []).filter(d => d.url && d.name);
  const kitPhoto = kitDocs.find(d => d.type === 'photo');
  const kitPhotoHTML = kitPhoto ? `
	  <div style="margin-bottom:12px;">
	    <button class="img-thumb-btn"
	            onclick='openImageViewer(${JSON.stringify(kitPhoto.url)}, ${JSON.stringify(kitPhoto.name || kit.name)})'>
	      <img src="${kitPhoto.url}" alt="${kitPhoto.name || kit.name}" class="material-main-img" draggable="false">
	    </button>
	  </div>
	` : '';

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
	  ${kitPhotoHTML}
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
      const { href, attrs } = getPdfDownloadHrefAndAttrs(d);
      return `
        <div class="doc-row">
          <div class="doc-name">${d.name}</div>
          <a class="doc-download-btn" href="${href}" ${attrs}>Descargar pdf</a>
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
    const { href, attrs } = getPdfDownloadHrefAndAttrs(doc);
    return `
    <div class="doc-row">
      <div class="doc-name">${doc.name}</div>
      <a class="doc-download-btn" href="${href}" ${attrs}>Descargar pdf</a>
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

    const isIOS = isIOSDevice();

    // iOS: abrir la URL "view/preview" (la que tú guardas como url_download)
    // Android: mantener descarga directa
    let downloadUrl = url;
    if (docEntry?.url_download) {
      downloadUrl = isIOS
        ? docEntry.url_download
        : driveToDirectDownload(docEntry.url_download);
    }

    const extraAttrs = isIOS
      ? '' // sin target blank, sin download
      : ' target="_blank" rel="noopener noreferrer" download';

    const contentPdf = `
      <div class="pdf-basic">
        <a class="pdf-download"
           href="${downloadUrl}"${extraAttrs}>
          Descargar
        </a>

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

let __eventosMesCargados = []; // Cache simple para la vista actual

async function renderCalendarioSection(isBack = false) {
  const html = `
        <div class="calendar-nav">
            <button onclick="navegarMes(-1)">&#10140;</button>
            <div id="mes-titulo-container" class="select-nav-container"></div>
            <button onclick="navegarMes(1)">&#10140;</button>
        </div>
        <div id="calendar-view-container" class="calendar-view"></div>
        
        <!-- Contenedores de leyenda y stats -->
        <div id="calendar-stats-container" style="padding:10px; font-size:0.9em;"></div>
    `;

  render(html, 'Calendario', { level: 1, section: 'calendario' }, isBack);

  // Carga inicial de eventos y render
  await cargarYRenderizarCalendario();
}

async function cargarYRenderizarCalendario() {
  // 1. Cargar eventos de Firebase (definido en calendar.js)
  if (typeof cargarEventosMes === 'function') {
    __eventosMesCargados = await cargarEventosMes(añoActualCal, mesActualCal);
  }
  actualizarVistaCalendario();
}

function actualizarVistaCalendario() {
  const container = document.getElementById('calendar-view-container');
  const navContainer = document.getElementById('mes-titulo-container');
  if (!container || !navContainer) return;

  const infoTurno = TURNOS_CONFIG.find(t => t.id === turnoSeleccionadoCal);
  const colorDinamico = infoTurno ? infoTurno.color : '#AA1915'; // Color de mi turno

  navContainer.innerHTML = `
        <select onchange="cambiarMesAño(this.value, 'mes')">${Array.from({ length: 12 }, (_, i) => `<option value="${i}" ${i === mesActualCal ? 'selected' : ''}>${obtenerNombreMes(i)}</option>`).join('')}</select>
        <select onchange="cambiarMesAño(this.value, 'año')">${Array.from({ length: 11 }, (_, i) => (añoActualCal - 5) + i).map(a => `<option value="${a}" ${a === añoActualCal ? 'selected' : ''}>${a}</option>`).join('')}</select>
    `;

  let tablaHTML = `<table class="tabla-calendario" style="table-layout:fixed;">
        <thead><tr><th>Lu</th><th>Ma</th><th>Mi</th><th>Ju</th><th>Vi</th><th>Sá</th><th>Do</th></tr></thead>
        <tbody><tr>`;

  const diasMes = new Date(añoActualCal, mesActualCal + 1, 0).getDate();
  let primerDia = new Date(añoActualCal, mesActualCal, 1).getDay() || 7;

  for (let i = 1; i < primerDia; i++) tablaHTML += '<td></td>';

  for (let dia = 1; dia <= diasMes; dia++) {
    const fecha = new Date(añoActualCal, mesActualCal, dia);
    const numeroTurnoDia = calcularTurnoGuardia(fecha); // 1,2,3,4,5
    const nombreTurnoDia = `T${numeroTurnoDia}`;

    // El turno 'T2' corresponde al ciclo 2
    const miTurnoNum = parseInt(turnoSeleccionadoCal.replace('T', ''));
    const esMiGuardia = (numeroTurnoDia === miTurnoNum);

    // Buscar evento en este día
    const fechaStr = `${añoActualCal}-${String(mesActualCal + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const evento = __eventosMesCargados.find(e => e.date === fechaStr);

    const hoy = new Date();
    const esHoy = (dia === hoy.getDate() && mesActualCal === hoy.getMonth() && añoActualCal === hoy.getFullYear());

    // LOGICA DE COLORES Y CONTENIDO
    let cellStyle = `height:90px; vertical-align:top; border:1px solid #ddd; padding:0 !important; cursor:pointer; position:relative; overflow: hidden;`;

    // El color de fondo se aplica a la celda completa (TD)
    let bgColor = esMiGuardia ? '#FFF59D' : 'white';
    cellStyle += `background-color: ${bgColor};`;

    let textColor = 'black';
    let acronimo = '';
    let mostrarTurno = true;

    if (evento) {
      const tipo = TIPOS_EVENTO[evento.type];
      if (tipo) {
        acronimo = tipo.acronimo || '';

        // Si es Refuerzo Voluntario, añadimos las horas al acrónimo para mostrarlo
        if (evento.type === 'REF_VOL' && evento.horas) {
          acronimo += `<div style="font-size:0.9em; font-weight:normal;">(${evento.horas}h)</div>`;
        }

        mostrarTurno = false;

        // Caso 1: Vacaciones (Periodo) + Vacaciones (Guardia)
        if (evento.type === 'VAC_NAT' && esMiGuardia) {
          const colorVacGuardia = TIPOS_EVENTO['VAC'].color;
          const colorVacNat = TIPOS_EVENTO['VAC_NAT'].color;
          // Gradiente en toda la celda
          cellStyle += `background: linear-gradient(to bottom, ${colorVacGuardia} 50%, ${colorVacNat} 50%);`;
          textColor = 'white';
        }
        // Caso 2: Incidencias que coinciden con GUARDIA
        else if (['AP', 'COMP', 'CAMBIO_HACE', 'CAMBIO_DEBE', 'FORM', 'PERMISO'].includes(evento.type) && esMiGuardia) {
          const colorIncidencia = tipo.color;
          const colorGuardia = '#FFF59D';
          cellStyle += `background: linear-gradient(to bottom, ${colorIncidencia} 50%, ${colorGuardia} 50%);`;
          textColor = 'black';
        }
        // Caso 3: Color plano
        else {
          cellStyle += `background-color: ${tipo.color};`;
          textColor = 'white';
        }
      }
    }

    // Estilos de la franja superior (Header)
    let headerColor = '#AA1915'; // Texto Rojo App por defecto

    // Si hay evento (incidencia), el fondo es oscuro/coloreado -> Texto blanco
    if (evento && evento.type) {
      headerColor = 'white';
    }

    let headerFontSize = '0.9em';
    let headerFontWeight = 'bold';

    if (esHoy) {
      // HOY: Borde interior a la celda completa
      cellStyle += `box-shadow: inset 0 0 0 2px #AA1915;`;
      headerFontWeight = '900';
    }

    const notaIcon = (evento && evento.comentario) ? `<span style="position:absolute; top:20px; right:2px; font-size:0.7em;">📝</span>` : '';
    // const textShadowStyle = `text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;`; // ELIMINADO

    tablaHTML += `
            <td style="${cellStyle}" onclick="abrirModalDia(${dia}, ${esMiGuardia}, '${evento ? (evento.type || '') : ''}', '${evento ? (evento.comentario || '').replace(/'/g, "\\'") : ''}', ${evento && evento.horas ? evento.horas : 0})">
                
                <!-- Franja Superior (25%): Transparente con Num Día Rojo -->
                <div style="height: 25%; width: 100%; background-color: transparent; color: ${headerColor}; display: flex; align-items: center; justify-content: flex-end; padding-right: 5px; font-size: ${headerFontSize}; font-weight: ${headerFontWeight};">
                    ${dia}
                </div>
                
                <!-- Cuerpo (75%): Transparente -->
                <div style="height: 75%; width: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2px;">
                    ${mostrarTurno ? `<div style="font-size:0.9em; color:${esMiGuardia ? '#AA1915' : (textColor === 'white' ? 'white' : 'black')}; font-weight:${esMiGuardia ? 'bold' : 'normal'};">${nombreTurnoDia}</div>` : ''}
                    <div style="font-size:0.85em; font-weight:bold; color:${textColor}; text-align:center; white-space:nowrap; overflow:hidden;">${acronimo}</div>
                </div>
                
                ${notaIcon}
            </td>`;

    if (fecha.getDay() === 0 && dia !== diasMes) tablaHTML += '</tr><tr>';
  }

  const hoy = new Date();
  const turnoHoyId = calcularTurnoGuardia(hoy);
  const infoTurnoHoy = TURNOS_CONFIG.find(t => parseInt(t.id.replace('T', '')) === turnoHoyId);

  const footerHTML = `</tr></tbody></table><div class="calendar-footer">
        <div class="hoy-badge" style="border-left: 5px solid ${infoTurnoHoy.color}"><strong>HOY:</strong> Hoy trabaja el <span>${infoTurnoHoy.name}</span></div>
    </div>`;
  container.innerHTML = tablaHTML + footerHTML;
}

// Interacción
function cambiarMesAño(v, t) {
  if (t === 'mes') mesActualCal = parseInt(v);
  else añoActualCal = parseInt(v);
  cargarYRenderizarCalendario();
}
function navegarMes(d) {
  mesActualCal += d;
  if (mesActualCal < 0) { mesActualCal = 11; añoActualCal--; }
  if (mesActualCal > 11) { mesActualCal = 0; añoActualCal++; }
  cargarYRenderizarCalendario();
}
function cambiarTurnoCal(id) { turnoSeleccionadoCal = id; actualizarVistaCalendario(); }
function obtenerNombreMes(n) { return ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][n]; }

// Estado temporal del modal
let _modalState = {
  fechaStr: null,
  tipoId: null,
  horas: 24,
  esGuardia: false
};

function abrirModalDia(dia, esGuardia, eventoTipoActual, comentarioActual = '', horasActuales = 0) {
  if (!currentUser) return alert("Debes iniciar sesión para editar.");

  const fechaStr = `${añoActualCal}-${String(mesActualCal + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  const fechaDisplay = `${String(dia).padStart(2, '0')}/${String(mesActualCal + 1).padStart(2, '0')}/${añoActualCal}`;

  // Inicializar estado
  _modalState = {
    fechaStr: fechaStr,
    tipoId: eventoTipoActual || null,
    horas: horasActuales || 24,
    esGuardia: esGuardia
  };

  // Construir HTML del Modal con estilo "Minimalista"
  // Botonera
  const botonesTipos = Object.values(TIPOS_EVENTO).map(tipo => {
    const isSelected = (_modalState.tipoId === tipo.id);
    const borderStyle = isSelected ? `border: 3px solid #333; transform: scale(1.05);` : `border: 1px solid transparent;`;

    return `
          <button id="btn-tipo-${tipo.id}" 
                  onclick="toggleTipoModal('${tipo.id}')" 
                  style="background:${tipo.color}; color:white; padding:10px; border-radius:6px; margin:4px; width:45%; font-size:0.9em; cursor:pointer; transition:all 0.1s; ${borderStyle}">
              ${tipo.nombre}
          </button>
      `;
  }).join('');

  const modalHTML = `
        <div id="dia-modal" 
             onclick="if(event.target.id === 'dia-modal') cerrarModal()"
             style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000; display:flex; justify-content:center; align-items:center;">
            
            <div style="background:white; padding:20px 25px; border-radius:12px; width:90%; max-width:400px; max-height:90vh; overflow-y:auto; position:relative; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                
                <!-- Botón Cerrar (X) -->
                <button onclick="cerrarModal()" 
                        style="position:absolute; top:15px; right:15px; background:none; border:none; font-size:1.5em; color:#666; cursor:pointer; line-height:1;">
                    &times;
                </button>

                <!-- Título Dinámico -->
                <h3 id="modal-titulo" style="margin-top:0; margin-bottom:5px; padding-right:30px; color:#333;">
                    ${generarTituloModal(fechaDisplay)}
                </h3>
                
                <hr style="margin:15px 0; border:0; border-top:1px solid #eee;">
                
                <!-- Botonera -->
                <div style="display:flex; flex-wrap:wrap; justify-content:center; margin-bottom:20px;">
                    ${botonesTipos}
                </div>
                
                <!-- Nota -->
                <div style="text-align:left; margin-bottom:20px;">
                    <label style="font-weight:bold; display:block; margin-bottom:5px; color:#555;">Nota:</label>
                    <textarea id="dia-notas" style="width:100%; height:80px; padding:10px; border:1px solid #ccc; border-radius:8px; font-family:inherit; resize:vertical;">${comentarioActual}</textarea>
                </div>

                <!-- Botón Guardar -->
                <button onclick="guardarCambiosModal()" style="width:100%; background:#AA1915; color:white; padding:14px; border:none; border-radius:8px; font-size:1.1em; font-weight:bold; cursor:pointer;">
                    GUARDAR
                </button>
            </div>
        </div>
    `;

  const div = document.createElement('div');
  div.innerHTML = modalHTML;
  document.body.appendChild(div.firstElementChild);
}

function generarTituloModal(fechaDisplay) {
  let texto = fechaDisplay;
  if (_modalState.esGuardia) texto += " - Guardia";

  if (_modalState.tipoId) {
    const tipo = TIPOS_EVENTO[_modalState.tipoId];
    let nombre = tipo.nombre;
    // Si es Refuerzo Voluntario y tenemos horas, mostrarlas
    if (_modalState.tipoId === 'REF_VOL') {
      nombre += ` (${_modalState.horas}h)`;
    }
    texto += ` - ${nombre}`;
  }
  return texto;
}

function toggleTipoModal(id) {
  if (_modalState.tipoId === id) {
    // Deseleccionar
    _modalState.tipoId = null;
  } else {
    // Seleccionar
    _modalState.tipoId = id;

    // Si es R.Vol, pedimos horas al momento? O mejor al guardar? 
    // El usuario pidió: "Si la incidencia es un Refuerzo Voluntario [...] aparecerá el número de horas tras 'Refuerzo voluntario'"
    // Para que aparezca en el título dinámico, necesitamos las horas YA.
    if (id === 'REF_VOL') {
      const input = prompt("¿Horas de refuerzo?", "24");
      if (input) _modalState.horas = parseInt(input);
    }
  }

  actualizarUIModal();
}

function actualizarUIModal() {
  // Actualizar bordes
  Object.values(TIPOS_EVENTO).forEach(t => {
    const btn = document.getElementById(`btn-tipo-${t.id}`);
    if (btn) {
      if (t.id === _modalState.tipoId) {
        btn.style.border = "3px solid #333";
        btn.style.transform = "scale(1.05)";
      } else {
        btn.style.border = "1px solid transparent";
        btn.style.transform = "scale(1)";
      }
    }
  });

  // Actualizar Título
  const dia = _modalState.fechaStr.split('-')[2];
  const mes = _modalState.fechaStr.split('-')[1];
  const anyo = _modalState.fechaStr.split('-')[0];
  document.getElementById('modal-titulo').textContent = generarTituloModal(`${dia}/${mes}/${anyo}`);
}

function cerrarModal() {
  const el = document.getElementById('dia-modal');
  if (el) el.remove();
}

async function guardarCambiosModal() {
  const comentario = document.getElementById('dia-notas').value;

  // Si no hay tipo seleccionado, borramos la entrada de "type", pero quizás queramos guardar nota?
  // En Firestore guardábamos todo junto.
  // Si tipoId es null, es que NO hay evento de tipo.
  // Si hay comentario, guardamos evento con type='NOTA' o similar, o simplemente un objeto sin type definido?
  // Para simplificar y limpiar: 
  // - Si hay tipo -> Guardamos
  // - Si NO hay tipo y SÍ nota -> Guardamos tipo='NOTA' (dummy)
  // - Si NO hay tipo y NO nota -> Borramos evento.

  if (!_modalState.tipoId && (!comentario || comentario.trim() === '')) {
    await borrarEventoCalendario(_modalState.fechaStr);
  } else {
    // Guardar
    // Si no hay tipo real, usamos 'NOTA' para que no pinte colores pero guarde el comentario
    const tipoFinal = _modalState.tipoId || 'NOTA';
    await guardarEventoCalendario(_modalState.fechaStr, tipoFinal, _modalState.horas, comentario);
  }

  cerrarModal();
  cargarYRenderizarCalendario();
}

// ----------------------------------------------------
// SISTEMA DE NAVEGACIÓN (ÚNICO)
// ----------------------------------------------------
function handleBackNavigation(event) {
  const idx = event?.state?.stateIndex;

  // Si el navegador nos da un stateIndex válido, sincronizamos ahí
  if (typeof idx === "number" && idx >= 0 && idx < navigationHistory.length) {
    navigationHistory = navigationHistory.slice(0, idx + 1);
    const target = navigationHistory[navigationHistory.length - 1];
    window.scrollTo(0, 0);

    if (target.level === 0) renderDashboard(true);
    else if (target.level === 1) {
      if (target.section === 'material_global') renderGlobalMaterialList(true);
      else if (target.section === 'mapa') renderMapaSection(true);
      else if (target.section === 'calendario') renderCalendarioSection(true);
      else if (target.section === 'ranking') renderRankingSection(true);
      else if (target.section === 'admin') renderAdminPanel(true);
      else renderVehiclesList(true);
    }
    else if (target.level === 2) {
      if (target.section === 'history') {
        if (typeof showHistory === 'function') showHistory(target.targetUserId, true);
      } else {
        showVehicleViews(target.vehicleId, true);
      }
    }
    else if (target.level === 3) showViewHotspots(target.vehicleId, target.viewId, true);
    else if (target.level === 4) showArmarioMaterial(target.vehicleId, target.viewId, target.hotspotIndex, true);
    else if (target.level === 4.5) showKitInventory(target.kitId, target.parentName, true);
    else if (target.level === 5) {
      if (target.section === 'material_global') showGlobalMaterialDetail(target.materialId, true);
      else showMaterialDetails(target.materialId, true);
    }
    else if (target.level === 6) renderResource(target.materialId, target.url, target.type, target.resourceName, true);

    return;
  }

  // Si iOS dispara popstate sin state (pasa), forzamos Home estable
  navigationHistory = [{ level: 0 }];
  renderDashboard(true);
  history.replaceState({ stateIndex: 0 }, 'Bomberos Gijón');
}

// Eventos
backButton.addEventListener('click', (e) => { e.preventDefault(); history.back(); });
window.addEventListener('popstate', handleBackNavigation);

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
  if (__updatesInitDone) return;
  __updatesInitDone = true;
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
    __updateBannerShown = false;
    const banner = document.getElementById('update-banner');
    if (banner) banner.remove();
    window.location.reload();
  });
}

// Llama a esto en DOMContentLoaded (una sola vez)
document.addEventListener('DOMContentLoaded', () => {
  initServiceWorkerUpdates().catch(console.error);
});

function forzarActualizacion() {
  const banner = document.getElementById('update-banner');
  const btn = banner?.querySelector('button');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'ACTUALIZANDO…';
  }

  if (!swRegistration) {
    window.location.reload();
    return;
  }

  const activateWaiting = () => {
    if (swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    }
    return false;
  };

  // 1) Si ya está esperando → activar ya
  if (activateWaiting()) return;

  // 2) Si está instalando → esperamos a que pase a waiting
  if (swRegistration.installing) {
    swRegistration.installing.addEventListener('statechange', () => {
      if (activateWaiting()) return;
    });
    return;
  }

  // 3) Si no hay nada → pedimos update (y el banner se queda hasta que aparezca waiting)
  swRegistration.update().catch(() => { });
}








