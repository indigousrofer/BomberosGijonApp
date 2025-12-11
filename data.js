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
    VEHICLES: [
        {
            id: 'B12',
            name: 'B12',
            image: 'images/B12_general.jpg', // Foto pequeña para la lista principal
            description: 'Vehículo de segunda salida'
        },
        {
            id: 'ae20',
            name: 'B01',
            image: 'images/ae20_general.jpg',
            description: 'Autoescalera pequeña'
        }
    ],

    // 2. Vistas y Armarios de CADA Vehículo
    DETAILS: {
        'B12': {
            views: [
                { id: 'B12-izda', name: 'Lateral Izquierdo', image: 'images/B12_izda_ampliada.jpg' },
                { id: 'B12-dcha', name: 'Lateral Derecho', image: 'images/B12_dcha_ampliada.jpg' },
                // Añade Trasera, Superior, etc.
            ],
            // 🚨 HOTSPOTS: Define las áreas interactivas (armarios) en CADA VISTA.
            // Las coordenadas son relativas a la imagen (en píxeles o porcentaje).
            hotspots: {
                // Armarios en el Lateral Derecho del BUL 1
                'B12-dcha': [
                    {
                        name: 'Armario 6',
                        inventory: [
							{ id: 'motosierra', qty: 1},
							{ id: 'grupo_electrogeno', qty: 1}
						],
                        // Define la posición y tamaño del hotspot. Ejemplo con CSS:
                        style: 'top: 29%; left: 42%; width: 12%; height: 32%;' 
                    },
                    {
                        name: 'Armario 5',
						// Estructura: id del material y su cantidad
						inventory: [
							{ id: 'manguera_45', qty: 5 },
							{ id: 'lanza_regulable', qty: 2 }
						],
						style: 'top: 29%; left: 23%; width: 17%; height: 25%;'
                    }
                ],
                // Armarios en el Lateral Izquierdo del BUL 1
                'B12-izda': [
                    {
                        name: 'Armario 1',
                        // Estructura: id del material y su cantidad
						inventory: [
							{ id: 'bomba_abrepuertas', qty: 1 },
                            { id: 'bomba_pedal', qty: 1 },
                            { id: 'botella_aire', qty: 6 },
                            { id: 'pertiga_dielectrica', qty: 1 },
                            { id: 'halligan', qty: 1 },
                            { id: 'cilindro_ram', qty: 1 },
                            { id: 'cortapedales', qty: 1 },
							{ id: 'manguera_core', qty: 1 }
						],
                        style: 'top: 29%; left: 45%; width: 13%; height: 32%;'
                    },
                    {
                        name: 'Cofre 1',
                        // Estructura: id del material y su cantidad
						inventory: [
							{ id: 'grupo_hidraulico', qty: 1 },
                            { id: 'manguera_core', qty: 2 },
                            { id: 'separador', qty: 1 },
                            { id: 'cizalla', qty: 1 },
                            { id: 'abrepuertas', qty: 1 }
						],
                        style: 'top: 64%; left: 45%; width: 13%; height: 13%;'
                    },
                    {
                        name: 'Armario 2',
                        // Estructura: id del material y su cantidad
						inventory: [
							{ id: 'cono', qty: 6 },
                            { id: 'signal_bomberos', qty: 2 },
                            { id: 'film_autoadhesivo', qty: 1 },
                            { id: 'cinta_balizar', qty: 1 },
                            { id: 'taco_escalonado', qty: 1 },
                            { id: 'eslinga4t', qty: 1 },
                            { id: 'grillete6t', qty: 1 },
                            { id: 'garrafa_gasolina_hidraulico', qty: 1 },
                            { id: 'rollo_alambre', qty: 1 },
                            { id: 'cadena_separador', qty: 1 },
                            { id: 'manta_acopio', qty: 1 },
                            { id: 'lagrima', qty: 1 },
                            { id: 'extintor_CO2', qty: 1 },
                            { id: 'extintor_polvo', qty: 1 },
                            { id: 'mochila_excarcelacion', qty: 1 }
						],
                        style: 'top: 29%; left: 59%; width: 18%; height: 25%;'
                    }
                ]
            }
        },
        // Añade la sección 'ae20' aquí.
    },

    // 3. Documentación y Detalles del Material
    MATERIALS: {
        'motosierra': {
            name: 'Motosierra de corte',
            description: 'Equipo para corte de madera y otros materiales.',
            docs: [
                { type: 'manual', name: 'Manual de Usuario (PDF)', url: 'docs/motosierra_manual.pdf' },
                { type: 'photo', name: 'Foto principal', url: 'images/motosierra.jpg' },
				{ type: 'photo', name: 'Foto de uso', url: 'images/motosierra_uso.jpg' },
                { type: 'video', name: 'Vídeo de arranque', url: 'videos/arranque-motosierra.mp4' }
            ]
        },
        'grupo_electrogeno': {
            name: 'Grupo Electrógeno',
            description: 'Generador de corriente eléctrica portátil.',
            docs: []
        },
		'manguera_45': {
			name: 'Manguera de 45mm',
            description: 'Manguera de 45mm',
            docs: [
                { type: 'photo', name: 'Enrollado en doble', url: 'images/manguera_45.jpg' }
            ]
		},
		'lanza_regulable': {
			name: 'Lanza de 45mm',
            description: 'Lanza',
            docs: [
                { type: 'photo', name: 'Lanza 45mm', url: 'images/lanza_45.jpg' }
            ]
		},
        'bomba_abrepuertas': {
			name: 'Bomba equipo abrepuertas',
            description: 'Bomba manual para usar con el equipo abrepuertas',
            docs: [
                {}
            ]
		},
        'bomba_pedal': {
			name: 'Bomba manual de pedal',
            description: 'Bomba manual de accionamiento mediante pedal para uso con herramientas de excarcelación',
            docs: [
                {}
            ]
		},
        'botella_aire': {
			name: 'Botella de aire',
            description: 'Botella de aire a 300 bar',
            docs: [
                {}
            ]
		},
        'pertiga_dielectrica': {
			name: 'Pértiga dieléctrica',
            description: 'Pértiga telescópica dieléctrica para intervenciones con riesgo eléctrico',
            docs: [
                {}
            ]
		},
        'halligan': {
			name: 'Barra Halligan',
            description: 'Herramienta multipropósito para hacer palanca, torcer, cortar, golpear, o perforar',
            docs: [
                {}
            ]
		},
        'cilindro_ram': {
			name: 'Cilindro RAM',
            description: 'Cilindro hidráulico telescópico para uso en operaciones de excarcelación para separar, levantar o mover objetos',
            docs: [
                {}
            ]
		},
        'cortapedales': {
			name: 'Cortapedales hidráulico',
            description: 'Herramienta hidráulica para cortar pedales en accidentes de tráfico',
            docs: [
                {}
            ]
		},
        'manguera_core': {
			name: 'Manguera CORE',
            description: 'Manguera hidráulica con tecnología CORE. Tubo interior para aceite hidráulico a alta presión (hasta 720 bar), protegido por un tubo exterior por donde retorna el aceite a baja presión (máximo 25 bar)',
            docs: [
                {}
            ]
		},
        'grupo_hidraulico': {
			name: 'Bomba hidráulica',
            description: 'Bomba hidráulica accionada con motor de explosión de 4 tiempos de gasolina (sin mezcla)',
            docs: [
                {}
            ]
		},
        'separador': {
			name: 'Separador hidráulico',
            description: 'Herramienta hidráulica usada para aplastar o separar elementos en operaciones de excarcelación',
            docs: [
                {}
            ]
		},
        'cizalla': {
			name: 'Cizalla hidráulica',
            description: 'Herramienta hidráulica usada para cortar elementos en operaciones de excarcelación',
            docs: [
                {}
            ]
		},
        'abrepuertas': {
			name: 'Equipo abrepuertas',
            description: 'Equipo hidráulico usado para forzar la apertura de puertas. Se acciona mediante la bomba manual asociada',
            docs: [
                {}
            ]
		},
        'cono': {
			name: 'Cono señalización',
            description: '',
            docs: [
                {}
            ]
		},
        'signal_bomberos': {
			name: 'Señal bomberos',
            description: '',
            docs: [
                {}
            ]
		},
        'film_autoadhesivo': {
			name: 'FILM Autoadhesivo',
            description: 'Film autoadhesivo para contener los fragmentos al romper cristales',
            docs: [
                {}
            ]
		},
        'cubo_goma': {
			name: 'Cubo de goma',
            description: '',
            docs: [
                {}
            ]
		},
        'cinta_balizar': {
			name: 'Rollo de cinta de balizar',
            description: '',
            docs: [
                {}
            ]
		},
        'taco_escalonado': {
			name: 'Taco escalonado',
            description: 'Taco escalonado para estabilización de vehículos',
            docs: [
                {}
            ]
		},
        'eslinga4t': {
			name: 'Eslinga textil (4 toneladas)',
            description: 'Eslinga textil para elevación de cargas (carga máxima 4 toneladas)',
            docs: [
                {}
            ]
		},
        'grillete6t': {
			name: 'Grillete de 6 toneladas',
            description: '',
            docs: [
                {}
            ]
		},
        'garrafa_gasolina_hidraulico': {
			name: 'Garrafa de gasolina e hidráulico',
            description: 'Garrafa con gasolina 95 y aceite hidráulico para el grupo hidráulico',
            docs: [
                {}
            ]
		},
        'rollo_alambre': {
			name: 'Rollo de alambre',
            description: '',
            docs: [
                {}
            ]
		},
        'cadena_separador': {
			name: 'Cadena y adaptador separador',
            description: 'Cadenas y adaptador para instalarla en el separador, para operaciones de tracción',
            docs: [
                {}
            ]
		},
        'manta_acopio': {
			name: 'Manta de acopio',
            description: 'Manta de acopio para depositar las herramientas y material en las labores de excarcelación',
            docs: [
                {}
            ]
		},
        'lagrima': {
			name: 'Protección dura o "lágrima"',
            description: 'Protección plástica dura para evitar riesgos a la víctima durante las tareas de excarcelación',
            docs: [
                {}
            ]
		},
        'extintor_CO2': {
			name: 'Extintor de CO2',
            description: 'Extintor "limpio" para uso con equipos sensibles e instalaciones donde el agua o polvo químico pueda causar daños. Fuegos clases B y C',
            docs: [
                {}
            ]
		},
        'extintor_polvo': {
			name: 'Extintor de polvo ABC',
            description: 'Extintor de polvo químico seco versátil. Para fuegos ABC. Deja residuos, disminuye visibilidad.',
            docs: [
                {}
            ]
		},
        'mochila_excarcelacion': {
			name: 'Mochila de excarcelación',
            description: 'Mochila que contiene material usado en tareas de excarcelación',
            docs: [
                {}
            ],
            is_kit: true, // <-- NUEVO: Indica que es un contenedor
            kit_contents: [ // <-- NUEVO: El inventario dentro de la saca
                { id: 'punzon_rompecristales', qty: 1 },
                { id: 'sierra_cristales', qty: 1 },
                { id: 'cortacinturones', qty: 1 },
                { id: 'alicate_cortabornes', qty: 1 },
                { id: 'llave_fija_10-11', qty: 1 },
                { id: 'llave_fija_12-13', qty: 1 },
                { id: 'tijera_cortachapa', qty: 1 },
                { id: 'cuchillo_excarcelacion', qty: 1 },
                { id: 'protector_airbag', qty: 1 },
                { id: 'mascarillas_corte', qty: 6 },
                { id: 'guantes_latex', qty: 3 },
                { id: 'protector_montantes', qty: 1 },
                { id: 'destornillador_curvado_largo', qty: 1 },
                { id: 'destornillador_curvado_corto', qty: 1 },
                { id: 'cinta_extraccion', qty: 1 },
                { id: 'cinta_americana_estrecha', qty: 1 },
                { id: 'proteccion_blanda', qty: 1 },
                { id: 'tijera_cortarropa', qty: 1 },
                { id: 'abarcones', qty: 1 }
            ]
		},
        'punzon_rompecristales': {
			name: 'Punzón rompe-cristales',
            description: '',
            docs: [
                {}
            ]
		},
        'sierra_cristales': {
			name: 'Sierra rompe-cristales',
            description: 'Sierra manual para cortar cristales en tareas de excarcelación (Usar mascarilla)',
            docs: [
                {}
            ]
		},
        'cortacinturones': {
			name: 'Corta-cinturones',
            description: 'Herramienta para cortar rápidamente los cinturones de seguridad',
            docs: [
                {}
            ]
		},
        'alicate_cortabornes': {
			name: 'Alicate corta-bornes',
            description: 'Alicate para cortar los bornes de las baterías en los vehículos accidentados',
            docs: [
                {}
            ]
		},
        'llave_fija_10-11': {
			name: 'Llave fija 10/11',
            description: 'Útil para desmontar asientos y otros elementos',
            docs: [
                {}
            ]
		},
        'llave_fija_12-13': {
			name: 'Llave fija 12/13',
            description: 'Útil para desmontar asientos y otros elementos',
            docs: [
                {}
            ]
		},
        'tijera_cortachapa': {
			name: 'Tijera cortachapa',
            description: '',
            docs: [
                {}
            ]
		},
        'cuchillo_excarcelacion': {
			name: 'Cuchillo',
            description: '',
            docs: [
                {}
            ]
		},
        'protector_airbag': {
			name: 'Protector para airbag',
            description: 'Evita riesgos en caso de activación accidental del airbag durante las tareas de excarcelación',
            docs: [
                {}
            ]
		},
        'mascarillas_corte': {
			name: 'Mascarillas',
            description: 'Mascarillas para uso en las tareas de corte de cristales',
            docs: [
                {}
            ]
		},
        'guantes_latex': {
			name: 'Par de guantes de látex',
            description: 'Para uso con víctimas con posibles heridas sangrantes',
            docs: [
                {}
            ]
		},
        'protector_montantes': {
			name: 'Protector de tela para montantes',
            description: 'Protege de los filos en los montantes cortados',
            docs: [
                {}
            ]
		},
        'destornillador_curvado_largo': {
			name: 'Destornillador curvado largo',
            description: 'Útil para despanelar',
            docs: [
                {}
            ]
		},
        'destornillador_curvado_corto': {
			name: 'Destornillador curvado corto',
            description: 'Útil para despanelar',
            docs: [
                {}
            ]
		},
        'cinta_extraccion': {
			name: 'Cinta amarilla de extracción (5m)',
            description: 'Usada para ayudar en la extracción de víctimas del interior de vehículos. Mide 5 metros',
            docs: [
                {}
            ]
		},
        'cinta_americana_estrecha': {
			name: 'Cinta americana estrecha',
            description: '',
            docs: [
                {}
            ]
		},
        'proteccion_blanda': {
			name: 'Protección blanda',
            description: 'Protección plástica blanda para evitar riesgos a la víctima durante las tareas de corte de cristales',
            docs: [
                {}
            ]
		},
        'tijera_cortarropa': {
			name: 'Tijera corta-ropa',
            description: 'Usada para cortar rápidamente la ropa a las víctimas',
            docs: [
                {}
            ]
		},
        'abarcones': {
			name: 'Abarcones sujetalonas',
            description: 'Útiles para sujetar las lonas de protección',
            docs: [
                {}
            ]
		},
        // Añade el resto de tu material aquí.
    }
};