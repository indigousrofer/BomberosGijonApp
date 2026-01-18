// ==========================================
// MÓDULO DE CALENDARIO Y GESTIÓN DE PERSONAL
// ==========================================

const TIPOS_EVENTO = {
    // FILA 1
    AP: { id: 'AP', nombre: 'Asuntos Propios', acronimo: 'A.P.', color: '#1565C0', requiere_horas: false },
    COMP: { id: 'COMP', nombre: 'Compensatorio', acronimo: 'Comp.', color: '#0D47A1', requiere_horas: false },

    // FILA 2
    CAMBIO_HACE: { id: 'CAMBIO_HACE', nombre: 'Cambio (Hago día)', acronimo: 'Cam. +', color: '#B71C1C', requiere_horas: false },
    CAMBIO_DEBE: { id: 'CAMBIO_DEBE', nombre: 'Cambio (Debo día)', acronimo: 'Cam. -', color: '#EF5350', requiere_horas: false },

    // FILA 3
    REF_VOL: { id: 'REF_VOL', nombre: 'Refuerzo Voluntario', acronimo: 'R.Vol', color: '#F57C00', requiere_horas: true },
    REF_OBL: { id: 'REF_OBL', nombre: 'Refuerzo Obligatorio', acronimo: 'R.Obl', color: '#FBC02D', requiere_horas: false },

    // FILA 4
    VAC: { id: 'VAC', nombre: 'Vacaciones (Guardia)', acronimo: 'Vac.', color: '#2E7D32', requiere_horas: false },
    VAC_NAT: { id: 'VAC_NAT', nombre: 'Vacaciones (Período)', acronimo: 'Vac.', color: '#81C784', requiere_horas: false },

    // FILA 5
    FORM: { id: 'FORM', nombre: 'Permiso (Formación)', acronimo: 'P.F.', color: '#00BCD4', requiere_horas: false },
    PERMISO: { id: 'PERMISO', nombre: 'Permisos Varios', acronimo: 'P.V.', color: '#607D8B', requiere_horas: false }
};

// --- GESTIÓN DE FIREBASE ---

// Guardar un evento en Firestore
async function guardarEventoCalendario(fechaStr, tipoId, horas = 24, comentario = '') {
    if (!currentUser) return alert("Debes iniciar sesión");

    const evento = {
        userId: currentUser.uid,
        userEmail: currentUser.email, // Para búsquedas si hiciera falta
        date: fechaStr, // Formato YYYY-MM-DD
        type: tipoId,
        horas: parseInt(horas),
        comentario: comentario,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        // Usamos la fecha como ID para evitar duplicados en el mismo día (un evento por día simplificado)
        // Ojo: si quieres permitir varios eventos al día, usa .add() en vez de .doc().set()
        // Para simplificar, asumimos uno principal por día, o usamos ID compuesto.
        const eventId = `${currentUser.uid}_${fechaStr}`;
        await db.collection("events").doc(eventId).set(evento);
        console.log("Evento guardado:", evento);

        // Actualizar estadísticas del usuario after-save
        await actualizarEstadisticasUsuario(currentUser.uid);

        return true;
    } catch (e) {
        console.error("Error al guardar evento:", e);
        alert("Error al guardar: " + e.message);
        return false;
    }
}

async function borrarEventoCalendario(fechaStr) {
    if (!currentUser) return;
    const eventId = `${currentUser.uid}_${fechaStr}`;
    try {
        await db.collection("events").doc(eventId).delete();
        await actualizarEstadisticasUsuario(currentUser.uid);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

// Cargar eventos de un mes específico (para pintarlos)
async function cargarEventosMes(year, month) {
    if (!currentUser) return [];

    // Rango de fechas: del 1 del mes al 1 del mes siguiente
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    // Truco: mes+2 para el siguiente, manejando el desborde de año automáticamente Date lo hace? 
    // Mejor formato strings simples
    const endDate = new Date(year, month + 1, 1);
    const startStrCmp = startStr;
    const endStrCmp = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;

    try {
        const snapshot = await db.collection("events")
            .where("userId", "==", currentUser.uid)
            .where("date", ">=", startStrCmp)
            .where("date", "<", endStrCmp)
            .get();

        return snapshot.docs.map(doc => doc.data());
    } catch (e) {
        console.error("Error cargando eventos:", e);
        return [];
    }
}

// --- LOGICA BOSMAN Y ESTADÍSTICAS ---

async function actualizarEstadisticasUsuario(userId) {
    // Esta función recalcula el total anual/mensual leyendo eventos.
    // NOTA: En producción con muchos datos, esto se haría con Cloud Functions.
    // Aquí lo hacemos en cliente (Client-side aggregation) porque tenemos pocos eventos por usuario.

    const year = new Date().getFullYear();
    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;

    const snapshot = await db.collection("events")
        .where("userId", "==", userId)
        .where("date", ">=", startOfYear)
        .where("date", "<=", endOfYear)
        .get();

    let stats = {
        ap_gastados: 0,
        vacaciones_gastadas: 0, // VAC + VAC_NAT (días)
        ref_obl_hechos: 0,
        horas_vol_anuales: 0,
        horas_vol_meses: {} // "2026-01": 24
    };

    snapshot.docs.forEach(doc => {
        const d = doc.data();
        const mesKey = d.date.substring(0, 7); // "2026-03"

        if (d.type === 'AP') stats.ap_gastados++;
        if (d.type === 'VAC' || d.type === 'VAC_NAT') stats.vacaciones_gastadas++; // Aquí podrías diferenciar
        if (d.type === 'REF_OBL') stats.ref_obl_hechos++;

        if (d.type === 'REF_VOL') {
            stats.horas_vol_anuales += d.horas;
            if (!stats.horas_vol_meses[mesKey]) stats.horas_vol_meses[mesKey] = 0;
            stats.horas_vol_meses[mesKey] += d.horas;
        }
    });

    // Guardar en documento de usuario
    await db.collection("users").doc(userId).set({ stats: stats }, { merge: true });
    return stats;
}

// Cálculo de estado Bosman (Color) para un mes
function calcularEstadoBosman(horasMes) {
    if (!horasMes) return 'green'; // 0 horas -> Verde
    if (horasMes <= 48) return 'green'; // Hasta 48h -> Verde (o ámbar si está cerca?)
    // La regla dice: no se puede hacer MÁS de 48h como norma general.
    // Pero si tenías <48h y haces una guardia que te pasa, es "Legal pero Bosman".
    return 'red'; // Bosman
}
