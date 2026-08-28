# INFORME TÉCNICO N° 10: DIAGNÓSTICO Y SOLUCIÓN DE CONEXIÓN A GOOGLE DRIVE (OAUTH / DOMINIO NO AUTORIZADO)

**Fecha:** 27 de Agosto de 2026  
**Módulos Afectados:** Modal de Persistencia (`src/components/ProjectDestinationsModal.tsx`), Autenticación Firebase/OAuth  
**Estado:** Diagnóstico completado - Proceso de autorización OAuth iniciado  

---

## 1. Diagnóstico del Error

**Error visualizado:**
`Firebase: Error (auth/unauthorized-domain)` al pulsar "Conectar Drive" / "Guardar en Drive".

**Causa raíz:**
El entorno de ejecución del contenedor se ejecuta bajo un dominio dinámico de Cloud Run (`*.run.app`). Para que Firebase Auth y Google Workspace permitan ventanas emergentes (`signInWithPopup`) y otorguen acceso a Google Drive, el dominio del proyecto debe estar registrado y aprovisionado formalmente mediante el flujo OAuth de Google Workspace / Firebase.

---

## 2. Acciones y Plan de Solución

1. **Aprovisionamiento OAuth de Google Drive:**
   - Iniciar la configuración de los permisos de Google Drive (`https://www.googleapis.com/auth/drive.file`, `userinfo.profile`, `userinfo.email`).
   - Habilitar la vinculación segura para permitir a la aplicación crear, abrir y sincronizar mapas y archivos JSON directamente en la unidad de Google Drive del usuario con su debida autorización.

2. **Sincronización en la Aplicación:**
   - Una vez confirmado el consentimiento en la tarjeta de integración, se procederá al aprovisionamiento final (`userConfirmedInUI: true`).
