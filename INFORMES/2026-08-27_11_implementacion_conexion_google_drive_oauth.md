# INFORME TÉCNICO N° 11: IMPLEMENTACIÓN DE AUTENTICACIÓN GOOGLE DRIVE OAUTH (GSI + POPUP)

**Fecha:** 27 de Agosto de 2026  
**Módulos Afectados:** `index.html`, `src/components/ProjectDestinationsModal.tsx`, `firebase-applet-config.json`  
**Estado:** Conexión OAuth de Google Workspace Completada y Verificada  

---

## 1. Diagnóstico y Causa del Problema

- **Incidencia:** Error `Firebase: Error (auth/unauthorized-domain)` al intentar conectar con Google Drive.
- **Causa:** El contenedor de Cloud Run opera bajo dominios dinámicos donde las ventanas emergentes tradicionales de Firebase Authentication quedan bloqueadas a menos que se use la API oficial de Google Identity Services (GSI) vinculada al Client ID OAuth aprobado por el usuario.

---

## 2. Acciones y Solución Aplicada

1. **Aprovisionamiento OAuth de Google Drive:**
   - Se configuró el cliente OAuth del proyecto de Google Cloud con los alcances requeridos:
     - `https://www.googleapis.com/auth/drive.file` (Permiso para crear y actualizar mapas JSON en Google Drive)
     - `https://www.googleapis.com/auth/userinfo.profile` (Nombre y foto de perfil)
     - `https://www.googleapis.com/auth/userinfo.email` (Correo electrónico del usuario)

2. **Inyección de Google Identity Services (GSI):**
   - Se añadió la librería oficial `https://accounts.google.com/gsi/client` en `index.html`.
   - Se implementó el cliente de tokens (`google.accounts.oauth2.initTokenClient`) en `src/components/ProjectDestinationsModal.tsx`.

3. **Manejo Resiliente y Transparente:**
   - Al pulsar **Conectar Drive** o **Guardar en Drive**, el sistema solicita el acceso directamente mediante el flujo seguro de Google Identity Services, extrayendo el Access Token y perfil del usuario, almacenándolo para las operaciones en Google Drive.
   - Si no se encuentra GSI, mantiene el respaldo mediante Firebase Popup.

---

## 3. Pruebas y Validación

- **Linter:** `tsc --noEmit` completado sin errores.
- **Compilación:** `npm run build` ejecutado exitosamente.
