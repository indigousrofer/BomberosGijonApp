// ==========================================
// MÓDULO DE ADMINISTRACIÓN (Gestión de Personal)
// ==========================================

// Verifica si el usuario actual es admin
function esAdmin() {
    if (!currentUser || !currentUser.email) {
        console.log("esAdmin: No user or email", currentUser);
        return false;
    }
    const isAdmin = ADMIN_EMAILS.includes(currentUser.email);
    console.log(`esAdmin check: ${currentUser.email} -> ${isAdmin}`);
    return isAdmin;
}

// ----------------------------------------------------
// RENDERIZADO DEL PANEL
// ----------------------------------------------------
async function renderAdminPanel(isBack = false) {
    if (!esAdmin()) {
        alert("Acceso denegado");
        renderDashboard();
        return;
    }

    const html = `
        <div class="header-compact">
            <h3 style="margin:0; color:white;">Panel de Administración</h3>
        </div>
        
        <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
            
            <!-- SECCIÓN: AÑADIR PERSONAL -->
            <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 20px;">
                <h4 style="margin-top:0; color:#AA1915; border-bottom: 1px solid #eee; padding-bottom: 10px;">Alta de Personal</h4>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <input type="text" id="admin-nombre" placeholder="Nombre y Apellidos" style="flex: 2; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <select id="admin-rango" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="Bombero">Bombero</option>
                        <option value="Jefe de Dotación">Jefe de Dotación</option>
                        <option value="Sargento">Sargento</option>
                    </select>
                    <select id="admin-turno" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="T1">Turno 1</option>
                        <option value="T2">Turno 2</option>
                        <option value="T3">Turno 3</option>
                        <option value="T4">Turno 4</option>
                        <option value="T5">Turno 5</option>
                    </select>
                    <button onclick="crearPersonal()" style="background: #AA1915; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        AÑADIR
                    </button>
                </div>
            </div>

            <!-- SECCIÓN: LISTADO -->
            <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h4 style="margin:0; color:#333;">Listado de Personal</h4>
                    <button onclick="cargarPersonalUI()" style="background:none; border:none; color:#666; cursor:pointer;">🔄 Refrescar</button>
                </div>
                
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                        <thead>
                            <tr style="background: #f5f5f5; text-align: left;">
                                <th style="padding: 10px;">Nombre</th>
                                <th style="padding: 10px;">Rango</th>
                                <th style="padding: 10px;">Turno</th>
                                <th style="padding: 10px;">Estado</th>
                                <th style="padding: 10px;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="admin-personal-list">
                            <tr><td colspan="5" style="padding:20px; text-align:center;">Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    render(html, 'Admin Panel', { level: 1, section: 'admin' }, isBack);
    cargarPersonalUI();
}

// ----------------------------------------------------
// LÓGICA DE DATOS
// ----------------------------------------------------

// Cargar y pintar la tabla
async function cargarPersonalUI() {
    const listBody = document.getElementById('admin-personal-list');
    if (!listBody) return;

    try {
        const snapshot = await db.collection('personnel').orderBy('turn').orderBy('rank').get();

        if (snapshot.empty) {
            listBody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center;">No hay personal registrado.</td></tr>';
            return;
        }

        let html = '';
        snapshot.docs.forEach(doc => {
            const p = doc.data();
            const id = doc.id;
            const estado = p.linkedUid ?
                `<span style="color:green; font-weight:bold;">● Registrado</span>` :
                `<span style="color:orange;">○ Disponible</span>`;

            html += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;"><strong>${p.name}</strong></td>
                    <td style="padding: 10px;">${p.rank}</td>
                    <td style="padding: 10px;">${p.turn}</td>
                    <td style="padding: 10px;">${estado}</td>
                    <td style="padding: 10px;">
                        <button onclick="borrarPersonal('${id}', '${p.name}')" style="color:red; background:none; border:none; cursor:pointer;" title="Eliminar">🗑️</button>
                    </td>
                </tr>
            `;
        });
        listBody.innerHTML = html;

    } catch (e) {
        console.error(e);
        listBody.innerHTML = `<tr><td colspan="5" style="color:red; padding:20px;">Error al cargar: ${e.message}</td></tr>`;
    }
}

// Crear nuevo personal
async function crearPersonal() {
    const nombre = document.getElementById('admin-nombre').value.trim();
    const rango = document.getElementById('admin-rango').value;
    const turno = document.getElementById('admin-turno').value;

    if (!nombre) return alert("Introduce un nombre");

    try {
        await db.collection('personnel').add({
            name: nombre,
            rank: rango,
            turn: turno,
            linkedUid: null, // Inicialmente no tiene cuenta de usuario asociada
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Limpiar y recargar
        document.getElementById('admin-nombre').value = '';
        cargarPersonalUI();

    } catch (e) {
        alert("Error al crear: " + e.message);
    }
}

// Borrar personal
async function borrarPersonal(id, nombre) {
    if (!confirm(`¿Seguro que quieres eliminar a ${nombre}?\n\nSi ya tiene cuenta registrada, podría perder acceso a su perfil.`)) return;

    try {
        await db.collection('personnel').doc(id).delete();
        cargarPersonalUI();
    } catch (e) {
        alert("Error al borrar: " + e.message);
    }
}
