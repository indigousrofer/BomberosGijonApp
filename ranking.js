// ==========================================
// MÓDULO DE RANKING DE REFUERZOS
// ==========================================

// --- RENDERIZADO PRINCIPAL ---
async function renderRankingSection(isBack = false) {
    const html = `
        <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #AA1915; margin: 0;">Lista de Refuerzos</h2>
            </div>
            
            <div style="text-align: center; margin-bottom: 20px;">
                <label for="ranking-turno-select" style="font-weight: bold; margin-right: 10px;">Ver Turno:</label>
                <select id="ranking-turno-select" onchange="renderTurnoTables(this.value)" style="padding: 8px; border-radius: 6px; border: 1px solid #ccc;">
                    <option value="T1">Turno 1</option>
                    <option value="T2">Turno 2</option>
                    <option value="T3">Turno 3</option>
                    <option value="T4">Turno 4</option>
                    <option value="T5">Turno 5</option>
                </select>
            </div>

            <div id="ranking-container">
                <p style="text-align:center;">Cargando datos...</p>
            </div>
        </div>
    `;

    render(html, 'Refuerzos', { level: 1, section: 'ranking' }, isBack);

    // LÓGICA DE SELECCIÓN POR DEFECTO MÁS ROBUSTA
    let targetTurno = 'T1'; // Default
    if (currentUser && currentUser.profile && currentUser.profile.turno) {
        targetTurno = currentUser.profile.turno.trim();
    }

    const select = document.getElementById('ranking-turno-select');
    if (select) {
        select.value = targetTurno;
        // Si el valor guardado no coincide con ninguna opción, el select no cambiará o se quedará en blanco/default.
        // Verificamos si realmente se aplicó (o si targetTurno era "Turno 5" en vez de "T5")
        if (select.value !== targetTurno) {
            console.warn(`El turno del usuario (${targetTurno}) no coincide con el select. Usando T1.`);
            targetTurno = 'T1';
            select.value = 'T1';
        }
    }

    renderTurnoTables(targetTurno);
}

// --- LÓGICA DE DATOS Y RENDERIZADO DE TABLAS ---

async function renderTurnoTables(turno) {
    const container = document.getElementById('ranking-container');
    container.innerHTML = '<div class="loader" style="margin: 0 auto;"></div>';

    try {
        // 1. Obtener usuarios del turno
        const snapshot = await db.collection('users').where('turno', '==', turno).get();
        const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

        // 2. Calcular horas en tiempo real (consultando eventos REF_VOL)
        // Esto es necesario porque 'stats' puede estar desactualizado y necesitamos lógica compleja de fechas
        const usersWithStats = await Promise.all(users.map(async (u) => {
            return await calculateUserStats(u);
        }));

        // 3. Separar listas
        const bomberos = [];
        const mandos = [];

        usersWithStats.forEach(u => {
            if (u.rango === 'Bombero' || u.rango === 'Bombero-Conductor') {
                bomberos.push(u);
            } else {
                mandos.push(u);
            }
        });

        // 4. Ordenar: 
        // Criterio 1: Horas Efectivas (ASC)
        // Criterio 2: Ranking Order (ASC) (Desempate preservando orden previo al reset)
        const sortFn = (a, b) => {
            if (a.effectiveHours !== b.effectiveHours) {
                return a.effectiveHours - b.effectiveHours;
            }
            // Si empatan a horas, usar el orden guardado (default 9999)
            const orderA = (a.stats?.ranking_order !== undefined) ? a.stats.ranking_order : 9999;
            const orderB = (b.stats?.ranking_order !== undefined) ? b.stats.ranking_order : 9999;
            return orderA - orderB;
        };

        bomberos.sort(sortFn);
        mandos.sort(sortFn);

        // 5. Verificar Permisos
        const canEdit = checkEditPermission(turno);

        // 6. Generar HTML
        let html = '';

        // TABLA BOMBEROS
        html += generateTableHTML('Bomberos', bomberos, canEdit, turno, 'bomberos');

        html += '<div style="height: 30px;"></div>';

        // TABLA JEFES DE DOTACIÓN (Filtrar Sargentos fuera de la vista pública de esta tabla, aunque se calculen)
        const jefesSolo = mandos.filter(u => u.rango === 'Jefe de Dotación');
        html += generateTableHTML('Jefes de Dotación', jefesSolo, canEdit, turno, 'mandos');

        container.innerHTML = html;

    } catch (e) {
        console.error(e);
        container.innerHTML = `<p style="color:red; text-align:center;">Error al cargar ranking: ${e.message}</p>`;
    }
}

// Calcula las horas consultando la colección de eventos
async function calculateUserStats(user) {
    // Valores por defecto
    let accumulatedHours = 0;
    let isBosman = false;
    let manualHours = user.stats?.manual_hours;
    let lastResetDate = user.stats?.last_reset_date ? user.stats.last_reset_date.toDate() : new Date('2020-01-01');

    try {
        // Consultar eventos REF_VOL de este usuario
        const eventsSnap = await db.collection('events')
            .where('userId', '==', user.uid)
            .where('type', '==', 'REF_VOL')
            .get();

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let currentMonthHours = 0;

        eventsSnap.docs.forEach(doc => {
            const ev = doc.data();
            const dateParts = ev.date.split('-'); // YYYY-MM-DD
            const evDate = new Date(ev.date); // Cuidado con zonas horarias, pero para comparación >= sirve si usamos strings ISO o date objects UTC

            // 1. Cálculo Total (Desde último reset)
            // Comparamos fechas.
            if (evDate >= lastResetDate) {
                accumulatedHours += (ev.horas || 0);
            }

            // 2. Cálculo Bosman (Mes actual)
            if (parseInt(dateParts[1]) - 1 === currentMonth && parseInt(dateParts[0]) === currentYear) {
                currentMonthHours += (ev.horas || 0);
            }
        });

        if (currentMonthHours >= 48) {
            isBosman = true;
        }

    } catch (e) {
        console.error(`Error calculating stats for ${user.nombre}`, e);
    }

    // Si hay manualHours definido (y no es null), prevalece sobre el calculado acumulado
    // PERO: La lógica de discrepancia sigue aplicando
    const effectiveHours = (manualHours !== undefined && manualHours !== null) ? manualHours : accumulatedHours;

    return {
        ...user,
        calculatedHours: accumulatedHours,
        manualHours: manualHours,
        effectiveHours: effectiveHours,
        isBosman: isBosman,
        discrepancy: (manualHours !== undefined && manualHours !== null && manualHours !== accumulatedHours)
    };
}

function generateTableHTML(title, list, canEdit, turno, listType) {
    if (list.length === 0) return `<h3 style="color:#444; border-bottom: 2px solid #AA1915; padding-bottom:5px;">${title}</h3><p>No hay personal registrado.</p>`;

    // Botón de Reset (Solo si canEdit)
    const resetButton = canEdit ?
        `<button onclick="resetList('${turno}', '${listType}')" style="float:right; background: #fff; color: #AA1915; border: 1px solid #AA1915; padding: 4px 10px; border-radius: 4px; font-size: 0.7em; cursor: pointer;">⚠️ Resetear Lista</button>`
        : '';

    // El titulo incluye el boton
    const headerHTML = `
        <div style="background: #AA1915; color: white; padding: 10px 15px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
            <span>${title}</span>
            ${resetButton}
        </div>
    `;

    let rows = list.map((u, index) => {
        const discrepancyMark = u.discrepancy ? '<span style="color:#d32f2f; font-weight:bold; margin-left:5px;" title="Difiere del cálculo automático">*</span>' : '';
        const editButton = canEdit ? `<button onclick="editUserHours('${u.uid}', ${u.effectiveHours}, '${u.nombre}')" style="font-size:0.8em; margin-left:10px;">✏️</button>` : '';

        let footerInfo = '';
        if (u.stats?.last_modified_by) {
            const date = u.stats.last_modified_date ? new Date(u.stats.last_modified_date.seconds * 1000).toLocaleDateString() : '??';
            footerInfo = `<div style="font-size: 0.75em; color: #666; margin-top: 2px;">Modificado por ${u.stats.last_modified_by} el ${date}</div>`;
        }

        // Estilos
        let rowStyle = 'background-color: white;';
        let bosmanLabel = '';

        if (u.isBosman) {
            rowStyle = 'background-color: #ffcccc;';
            bosmanLabel = ' <span style="font-weight:bold; color:black;">(Bosman)</span>';
        }

        return `
            <tr style="${rowStyle} border-bottom: 1px solid #eee;">
                <td style="padding: 10px; text-align: center; font-weight: bold;">${index + 1}</td>
                <td style="padding: 10px;">
                    <div style="font-weight: bold; color: inherit;">${u.nombre} ${bosmanLabel} ${discrepancyMark}</div>
                    <div style="font-size: 0.85em; color: #555;">${u.rango}</div>
                    ${footerInfo}
                </td>
                <td style="padding: 10px; text-align: center; font-weight: bold; font-size: 1.1em; color: #AA1915;">
                    ${u.effectiveHours}h
                    ${editButton}
                </td>
                <td style="padding: 10px; text-align: center;">
                    <button onclick="showHistory('${u.uid}')" style="background:none; border:none; cursor:pointer;" title="Ver Historial">📜</button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div style="background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); overflow: hidden;">
            ${headerHTML}
            <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
        <div style="text-align: right; font-size: 0.8em; color: #666; margin-top: 5px; margin-bottom: 10px;">
            * Asterisco indica discrepancia entre horas manuales y calendario.
        </div>
    `;
}

// --- RESET LIST ---
async function resetList(turno, listType) {
    if (!confirm(`¿Estás SEGURO de que quieres RESETEAR la lista de ${listType.toUpperCase()} del Turno ${turno}?\n\n- Se pondrán las horas a 0.\n- Se mantendrá el orden actual como referencia.\n- Se guardará la fecha de hoy como inicio de nuevo conteo.`)) return;

    try {
        // 1. Obtener usuarios del turno Y tipo para saber su orden actual
        // Necesitamos 'reconstruir' el orden actual antes de guardar, 
        // así que llamamos a la lógica parecida a render, o iteramos el DOM?
        // Mejor hacer consulta, ordenar igual que el render y guardar índices.

        const snapshot = await db.collection('users').where('turno', '==', turno).get();
        let users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

        // Calcular stats rapidito para ordenar (idealmente deberíamos confiar en lo renderizado, pero bueno)
        // Para simplificar y asegurar consistencia visual, podríamos leer del DOM? No, muy fragile.
        // Hacemos calculo heavy de nuevo.
        const usersWithStats = await Promise.all(users.map(async (u) => await calculateUserStats(u)));

        // Filtrar por lista
        let targetList = [];
        if (listType === 'bomberos') {
            targetList = usersWithStats.filter(u => u.rango === 'Bombero' || u.rango === 'Bombero-Conductor');
        } else {
            // Mandos (incluyendo Sargentos en la data, aunque no se muestren a veces)
            targetList = usersWithStats.filter(u => u.rango !== 'Bombero' && u.rango !== 'Bombero-Conductor');
        }

        // Ordenar actual (Hours ASC, Order ASC)
        targetList.sort((a, b) => {
            if (a.effectiveHours !== b.effectiveHours) return a.effectiveHours - b.effectiveHours;
            const orderA = (a.stats?.ranking_order !== undefined) ? a.stats.ranking_order : 9999;
            const orderB = (b.stats?.ranking_order !== undefined) ? b.stats.ranking_order : 9999;
            return orderA - orderB;
        });

        // 2. Batch update
        const batch = db.batch();
        const now = firebase.firestore.FieldValue.serverTimestamp();

        targetList.forEach((u, index) => {
            const ref = db.collection('users').doc(u.uid);
            batch.update(ref, {
                'stats.accumulated_hours': 0, // Visual mostly
                'stats.last_reset_date': now, // Critical for logic
                'stats.ranking_order': index, // Save current position
                'stats.manual_hours': null, // Reset manual override
                'stats.last_modified_by': currentUser.email + ' (RESET)',
                'stats.last_modified_date': now
            });

            // Log
            const logRef = db.collection('ranking_logs').doc();
            batch.set(logRef, {
                targetUserId: u.uid,
                targetUserName: u.nombre,
                modifiedBy: currentUser.email,
                previousValue: u.effectiveHours,
                newValue: 0,
                action: 'RESET_LIST',
                timestamp: now,
                turno: turno
            });
        });

        await batch.commit();
        alert("Lista reseteada correctamente.");
        renderTurnoTables(turno);

    } catch (e) {
        console.error(e);
        alert("Error reseteando lista: " + e.message);
    }
}


// --- LÓGICA DE PERMISOS ---
function checkEditPermission(turnoTabla) {
    if (!currentUser) return false;

    // 1. Es Admin Global?
    if (esAdmin()) return true;

    // 2. Es Sargento o Jefe de Dotación del MISMO turno?
    if (!currentUser.profile) return false;

    const userRank = currentUser.profile.rango;
    const userTurno = currentUser.profile.turno;

    if (userTurno === turnoTabla) {
        if (userRank === 'Sargento' || userRank === 'Jefe de Dotación') {
            return true;
        }
    }

    return false;
}

// --- EDICIÓN Y GUARDADO ---

function editUserHours(uid, currentHours, nombre) {
    const newHours = prompt(`Modificar horas para ${nombre}:\n(Introduce el nuevo valor total)`, currentHours);

    if (newHours === null) return;

    const parsed = parseFloat(newHours);
    if (isNaN(parsed) || parsed < 0) {
        alert("Por favor, introduce un número válido.");
        return;
    }

    saveVariableHours(uid, parsed, nombre);
}

async function saveVariableHours(targetUid, newVal, targetName) {
    if (!currentUser) return;

    const modifierName = currentUser.profile?.nombre || currentUser.email;

    try {
        const userRef = db.collection('users').doc(targetUid);
        // Get user again to check current val
        const doc = await userRef.get();
        // Here we rely on stored logic or calculate? Stored manual is simpler to read.
        const oldVal = doc.data().stats?.manual_hours ?? 'Auto';

        // 1. Actualizar Usuario
        await userRef.update({
            'stats.manual_hours': newVal,
            'stats.last_modified_by': modifierName,
            'stats.last_modified_date': firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Guardar Log Global
        await db.collection('ranking_logs').add({
            targetUserId: targetUid,
            targetUserName: targetName,
            modifiedBy: modifierName,
            previousValue: oldVal,
            newValue: newVal,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            turno: document.getElementById('ranking-turno-select').value
        });

        alert("Modificación guardada.");
        // Recargar tabla
        renderTurnoTables(document.getElementById('ranking-turno-select').value);

    } catch (e) {
        console.error(e);
        alert("Error al guardar: " + e.message);
    }
}

// --- HISTORIAL ---
async function showHistory(uid, isBack = false) {
    const html = `
        <div style="padding: 20px;">
            <h3 style="color:#AA1915; margin-top:0;">Historial de Cambios</h3>
            <div id="history-list">Cargando...</div>
            <div style="margin-top:20px; text-align:center;">
                <button onclick="closeModal()" style="padding:8px 16px;">Cerrar</button>
            </div>
        </div>
    `;

    render(html, 'Historial', { level: 2, section: 'history', targetUserId: uid }, isBack);

    const container = document.getElementById('history-list');

    try {
        const snapshot = await db.collection('ranking_logs')
            .where('targetUserId', '==', uid)
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();

        if (snapshot.empty) {
            container.innerHTML = "<p>No hay modificaciones registradas.</p>";
            return;
        }

        let listHtml = '<ul style="list-style:none; padding:0;">';
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : '??';

            let changeText = '';
            if (data.action === 'RESET_LIST') {
                changeText = '<span style="color:#d32f2f; font-weight:bold;">RESET DE LISTA (Horas -> 0)</span>';
            } else {
                changeText = `Cambio: <span style="color:#666; text-decoration:line-through;">${data.previousValue}h</span> 
                         ➜ <span style="color:#AA1915; font-weight:bold;">${data.newValue}h</span>`;
            }

            listHtml += `
                <li style="border-bottom:1px solid #eee; padding: 10px 0;">
                    <div style="font-weight:bold; color:#333;">${date}</div>
                    <div>Modificado por: <strong>${data.modifiedBy}</strong></div>
                    <div>${changeText}</div>
                </li>
            `;
        });
        listHtml += '</ul>';
        container.innerHTML = listHtml;

    } catch (e) {
        container.innerHTML = "Error cargando historial: " + e.message;
    }
}

function closeModal() {
    window.history.back();
}
