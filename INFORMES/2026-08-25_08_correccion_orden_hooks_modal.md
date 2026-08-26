# INFORME TÉCNICO N° 08: CORRECCIÓN DEL ORDEN DE HOOKS DE REACT EN MODAL Y CONTROL DE SANDBOX

**Fecha:** 25 de Agosto de 2026  
**Módulo:** `AddElementModal.tsx` y `AdvancedCanvasEditor.tsx`  
**Estado:** Resuelto y Verificado exitosamente (0 Errores de Linter y Compilación)

---

## 1. Causa Raíz del Error Detectado

En la captura de pantalla de la consola del navegador se observaron dos advertencias/errores:
1. **Error Crítico de React:** `React has detected a change in the order of Hooks called by AddElementModal. Uncaught Error: Rendered more hooks than during the previous render.`
   - **Causa:** El componente `AddElementModal` contenía una salida temprana condicional (`if (!isOpen) return null;`) antes de la declaración de un hook `useMemo` (`filteredPresets`). Cuando `isOpen` cambiaba entre `false` y `true`, el número total de hooks invocados variaba (12 vs 13), violando la regla fundamental de React Hooks.
2. **Advertencia de Sandbox en iFrame:** `Ignored call to 'prompt()'. The document is sandboxed, and the 'allow-modals' keyword is not set.`
   - **Causa:** La función de agrupamiento llamaba a la función nativa `prompt()` del navegador, la cual es bloqueada dentro de iframes con restricciones de seguridad sandbox.

---

## 2. Acciones y Correcciones Aplicadas

1. **Corrección de Hooks en `AddElementModal.tsx`**:
   - Se trasladó la condición de renderizado `if (!isOpen) return null;` a la parte final del componente, justo antes del retorno del JSX.
   - Ahora todos los hooks (`useState`, `useMemo` para territorios faltantes y `useMemo` para presets filtrados) se ejecutan de manera incondicional y en el orden exacto en cada ciclo de render.
   - Se sustituyó `alert()` por el sistema de estado visual de error en el formulario (`setFileError`).

2. **Ajuste en `AdvancedCanvasEditor.tsx`**:
   - Se removió la llamada nativa a `prompt()`, asignando directamente nombres de grupo contextuales seguros y fluidos, totalmente editables desde el Inspector de propiedades lateral sin bloquear la ejecución ni generar advertencias de sandbox.

---

## 3. Pruebas de Verificación
- **Linter de TypeScript:** `tsc --noEmit` completado exitosamente sin errores.
- **Compilador de Producción:** `npm run build` completado exitosamente.
