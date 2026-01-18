# GUÍA DE TRABAJO: De Local a Internet

Esta guía te ayudará a probar tus cambios antes de subirlos.

## 1. El Concepto
- **Local (Tu PC)**: Tu zona de pruebas. Solo tú lo ves.
- **GitHub**: La versión pública. Todo el mundo lo ve.

**Objetivo**: Probar en "Local" -> Si funciona -> Subir a "GitHub".

## 2. Pasos (El Ciclo)

### Paso 1: Hacer cambios
Modifica tus archivos (`.html`, `.css`, `.js`) en VS Code.

### Paso 2: Probar (El Servidor Local)
Para ver la web en tu ordenador:

1. Abre la terminal en VS Code.
2. Escribe y pulsa Enter:
   ```powershell
   python -m http.server
   ```
3. Abre en tu navegador: `http://localhost:8000`
4. **¡Prueba tu web!** Si cambias algo, guarda el archivo y recarga la página (`F5`).

> **Para detener el servidor**: Ve a la terminal y pulsa `Ctrl` + `C`.

### Paso 3: Guardar y Subir
Cuando todo funcione perfecto:

1. Ve al icono de **Source Control** (3 bolitas) a la izquierda.
2. Escribe un mensaje (ej: "Areglado el menú").
3. Pulsa **Commit** (o el check).
4. Pulsa **Sync Changes** (o Push).

En unos minutos, se actualizará en tu web pública.
