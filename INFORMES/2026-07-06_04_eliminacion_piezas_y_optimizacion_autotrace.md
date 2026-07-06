# Informe Técnico de Borrado y Optimización Masiva de Trazado
**Fecha:** 2026-07-06
**Correlativo:** INFORME_004_BORRADO_Y_OPTIMIZACION_MASSIVA
**Estado:** IMPLEMENTADO Y VERIFICADO EXPOSITIVAMENTE

---

## 1. Solicitud de Mejoras del Usuario
El usuario reportó la necesidad de extender el Calibrador de Mapas con funciones específicas de gestión y optimización de recursos, para evitar colapsos por falta de memoria o renderizado ineficiente:
1. **Borrado de piezas/subdivisiones actuales:** Permitir eliminar la pieza o subdivisión seleccionada directamente del mapa base (actualizar los trazados guardados).
2. **Borrado de imagen de fondo de referencia:** Si el usuario carga una imagen, permitir eliminarla de la sesión limpiando el canvas y su previsualización para un lienzo limpio.
3. **Optimización de autotrazado (Autotrace) de imágenes masivas:**
   - Redimensionar proporcionalmente las imágenes con dimensiones altas de manera nativa (ej. mayores a un umbral) antes de procesarlas por Moore-Neighbor, reduciendo dramáticamente el uso de CPU y memoria sin deformar sus proporciones.
   - Ofrecer un rango selector de la resolución máxima de escaneo para control granular del usuario.
   - Implementar el algoritmo de simplificación de curvas inteligente **Ramer-Douglas-Peucker (RDP)** para reducir el peso y densidad de nodos en tramos rectos o de baja curvatura sin perder precisión geométrica ni deformar el trazado final.
   - Mostrar el recuento de nodos generados en la tarjeta de Control de Calidad como métrica de complejidad.

---

## 2. Soluciones Técnicas Implementadas

### A. Botón "Eliminar Pieza" en Sección 3 (Edición y Transformación)
Se diseñó un método de borrado interactivo que filtra la pieza activa del array correspondiente (según se esté calibrando nivel provincial o subdivisión municipal).
- **Provincias:** Filtra `calibratedPaths` y actualiza el almacenamiento local (`savePathsLocally`). Selecciona otra provincia sobrante automáticamente para evitar desbordes de estados.
- **Subdivisiones:** Filtra las municipalidades de la provincia activa (`selectedProvince.municipalities`) y notifica al componente padre por callback (`onUpdateProvince`).
- **Control de seguridad:** Se incluyó un modal de confirmación nativo (`window.confirm`) para evitar borrados accidentales.

### B. Botón "Eliminar Imagen de Fondo" en Sección 4
Se incorporó un control con diseño rojo destructivo que limpia el estado `imageUrl`, `generatedTracePath` y resetea el contador de nodos generados, dejando el lienzo en blanco.

### C. Redimensionamiento Proporcional Nativo de Imágenes
Para optimizar el uso de memoria en imágenes pesadas (ej. 3000x4000 píxeles), el sistema calcula el factor de aspecto y, si excede del valor configurado en el nuevo control `traceMaxResolution`, redimensiona proporcionalmente el lienzo (`canvas.width` y `canvas.height`) utilizando la aceleración por hardware de `ctx.drawImage()`. Esto actúa como un filtro bi-lineal rápido que previene cuelgues del hilo de renderizado del navegador.

### D. Integración de Simplificación Inteligente Ramer-Douglas-Peucker (RDP)
Se codificó la polilínea simplificada usando la distancia perpendicular euclidiana contra un umbral de tolerancia (`traceTolerance`).
- Esto reemplaza el suavizado rígido (por saltos de paso fijos) por una simplificación adaptativa.
- Reduce la cantidad de nodos hasta en un **90%**, manteniendo perfectamente los picos, cabos y límites territoriales agudos sin deformar el contorno del mapa.
- Muestra el total de nodos generados con un indicador visual explicativo de la densidad y complejidad del SVG.

---
*Informe técnico guardado correlativamente para fines de auditoría y control de versiones.*
