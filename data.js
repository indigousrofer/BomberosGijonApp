// ==========================================================
// 🚨 ATENCIÓN: Esta es la "Base de Datos" de la aplicación.
// Modifica los valores aquí para reflejar tus vehículos y material.
// ==========================================================


const SECCIONES_INICIO = [
    { id: 'inventario', name: 'Vehículos y material', image_url: './images/camion-icon.png' },
    { id: 'mapa', name: 'Mapa de hidrantes', image_url: './images/mapa-icon.png' },
    { id: 'calendario', name: 'Calendario de Turnos', image_url: './images/calendar-icon.png' }
];

// Añadir esto al principio de data.js
const TURNOS_CONFIG = [
    { id: 'T1', name: 'Turno 1', color: '#ff4444' },
    { id: 'T2', name: 'Turno 2', color: '#44bb44' },
    { id: 'T3', name: 'Turno 3', color: '#4444ff' },
    { id: 'T4', name: 'Turno 4', color: '#ffbb00' },
    { id: 'T5', name: 'Turno 5', color: '#990099' }
];

const DATA = {
    // 1. Lista de Vehículos
    VEHICLES: [],

    // 2. Vistas y Armarios de CADA Vehículo
    DETAILS: {},

    // 3. Documentación y Detalles del Material
    MATERIALS: {},
    }

};
