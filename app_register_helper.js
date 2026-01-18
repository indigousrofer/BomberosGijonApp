
// Función auxiliar para cargar nombres en el registro
async function cargarNombresDisponibles(turno) {
    const select = document.getElementById('reg-personal-id');
    if (!select) return;

    select.innerHTML = '<option>Cargando...</option>';
    select.disabled = true;

    try {
        // Buscar personal de ese turno que NO tenga linkedUid (esté libre)
        const snapshot = await db.collection('personnel')
            .where('turn', '==', turno)
            .where('linkedUid', '==', null) // Solo libres
            .get();

        if (snapshot.empty) {
            select.innerHTML = '<option value="">No hay vacantes en este turno</option>';
            return;
        }

        let html = '<option value="" disabled selected>-- Elige tu nombre --</option>';
        snapshot.docs.forEach(doc => {
            const p = doc.data();
            html += `<option value="${doc.id}" data-nombre="${p.name}" data-rango="${p.rank}">${p.name} (${p.rank})</option>`;
        });
        select.innerHTML = html;
        select.disabled = false;

    } catch (e) {
        console.error(e);
        select.innerHTML = '<option>Error al cargar lista</option>';
    }
}
