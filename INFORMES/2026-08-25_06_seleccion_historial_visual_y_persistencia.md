# Informe Técnico: Preservación de Mapa Completo, Herramientas de Selección Avanzada, Historial Visual Antigravity y Sincronización de Base de Datos / Drive

**Fecha:** 2026-08-25  
**Correlativo:** INFORME_006_SELECCION_HISTORIAL_VISUAL_Y_PERSISTENCIA  
**Estado:** IMPLEMENTADO, DOCUMENTADO, COMENTADO Y COMPILADO CON ÉXITO  

---

## 1. Resumen de la Solicitud del Usuario

El usuario reportó los siguientes problemas y requerimientos para el editor y gestor de mapas:
1. **Pérdida visual del mapa al seleccionar piezas:** Al seleccionar una provincia o subdivisión para editar o eliminar, el editor aislaba forzosamente la pieza seleccionada y hacía desaparecer todo el resto del mapa nacional o provincial. Se solicitó que al seleccionar un elemento se mantenga todo el mapa visible en su contexto general para poder editarlo o eliminarlo sin perder de vista los demás trazados.
2. **Nuevas herramientas sobre la selección:**
   - Poder seleccionar una o varias piezas y **Duplicarlas** con copia rápida en el lienzo.
   - Poder seleccionar piezas y **Guardar / Exportar la Selección Aparte** como un archivo SVG/JSON independiente.
   - Poder **Eliminar únicamente la pieza seleccionada** conservando intacto todo el resto del mapa.
   - Disponer de un modo de **Aislamiento Voluntario (Focus)** para ver solo la pieza cuando el usuario explícitamente lo decida, pero manteniendo por defecto el mapa completo visible.
3. **Historial Visual de Versiones (Estilo Antigravity / Timeline Visual):**
   - Disponer de un historial interactivo con previsualización gráfica instantánea de cada modificación o paso anterior.
   - Poder inspeccionar cómo lucía el mapa en cada snapshot, comparar cambios y decidir si **Restaurar** o **Bifurcar (Guardar Copia)** sin perder nada de trabajo.
4. **Flujo de Aplicación de Cambios (Draft vs. Live):**
   - Saber si hay modificaciones pendientes con un indicador visual (`● Cambios pendientes`).
   - Botón `[APLICAR CAMBIOS]` para sincronizar el mapa editado con la aplicación y `[Descartar Cambios]` para cancelar sin guardar.
5. **Solución a Persistencia en Base de Datos y Google Drive:**
   - La base de datos Cloud SQL / backend ahora cuenta con sincronización e indexación local garantizada (`saveProjectToDatabase` y `fetchProjectsFromDatabase` híbridos), asegurando que los proyectos guardados nunca desaparezcan ni queden inaccesibles ante cortes de red o reinicios de backend.
   - Enlace y actualización in-place optimizada con Google Drive API v3.

---

## 2. Detalle del Código Modificado, Explicación Técnica y Justificación

### A. Modificación en `src/components/AdvancedCanvasEditor.tsx`

#### 1. Construcción del Mapa Contextual (`getInitialContextualMap`)
- **Problema previo:** Si existía un `selectedSubdivisionId` o se seleccionaba una provincia individual, la función retornaba un objeto `VectorMapEntity` con un solo `path`, causando que el lienzo borrara todos los demás polígonos de Argentina o de la región.
- **Solución implementada:** Se agregó el parámetro `isolateSelectionExplicitly: boolean = false`. Por defecto (`false`), la función construye el mapa completo (todas las provincias de `provincePaths` o todos los municipios) y resalta con estilo visual específico (`fillColor`, `strokeColor: '#38bdf8'`, `strokeWidth: 2.5`) la provincia o subdivisión seleccionada, manteniendo el 100% del territorio visible y editable.

```typescript
// FUNCIÓN DE CONSTRUCCIÓN DE MAPA INICIAL SEGÚN CONTEXTO (PRESERVA SIEMPRE TODO EL MAPA COMPLETO)
export const getInitialContextualMap = (
  province?: ProvinceData | null, // Provincia o entidad seleccionada en la vista general
  urlParentId?: string | null, // ID del padre obtenido por URL query param
  selectedSubdivisionId?: string | null, // ID de la subdivisión/polígono seleccionado para resaltado
  allProvinces?: Record<string, ProvinceData>, // Diccionario global de todas las provincias
  isolateSelectionExplicitly: boolean = false // Si es true (solo si el usuario activa el modo aislamiento), aísla la selección
): VectorMapEntity => {
  // Solo si se solicita explícitamente aislar se reduce al polígono único
  if (isolateSelectionExplicitly && selectedSubdivisionId) {
    // ... Lógica de aislamiento voluntario
  }
  // Si es provincia o país, devuelve el conjunto completo de paths manteniendo el mapa entero visible
  // ...
```

#### 2. Nuevos Estados y Funciones de Manipulación de Selección
- **`handleDuplicateSelectedPaths`**: Duplica en memoria los trazados seleccionados aplicando un desplazamiento vectorial (`translatePathD`) y agregándolos a la lista `paths` del mapa sin reemplazar los existentes.
- **`handleSaveSelectionSeparately`**: Filtra los `selectedPaths`, solicita un nombre al usuario y genera la descarga de un archivo `.json` independiente con solo esos elementos, permitiendo crear sub-mapas o capas modulares.
- **`toggleFocusIsolation`**: Alterna entre el modo de visualización de mapa completo y el modo de aislamiento focalizado.
- **`hasPendingChanges`**: Compara mediante serialización profunda el snapshot inicial `initialMapSnapshotRef.current` contra el estado en vivo `mapEntity` para avisar al usuario si tiene cambios sin aplicar.

```typescript
// MODO AISLAR SELECCIÓN (OPCIONAL Y REVERSIBLE - POR DEFECTO FALSE PARA VER TODO EL MAPA)
const [isFocusIsolated, setIsFocusIsolated] = useState<boolean>(false);

// ESTADOS DEL HISTORIAL VISUAL ANTIGRAVITY TIMELINE
const [isVisualHistoryModalOpen, setIsVisualHistoryModalOpen] = useState<boolean>(false);
const [previewHistoryIndex, setPreviewHistoryIndex] = useState<number | null>(null);

// DUPLICAR TRAZADOS SELECCIONADOS (COPIA RÁPIDA CON OFFSET INSTANTÁNEA)
const handleDuplicateSelectedPaths = () => {
  if (!canEditMap || selectedPathIds.length === 0) return;
  const offset = 18;
  const duplicatedPaths: VectorPathItem[] = [];
  // ...
};

// GUARDAR / EXPORTAR SELECCIÓN APARTE (COMO NUEVO ARCHIVO JSON/SVG INDEPENDIENTE)
const handleSaveSelectionSeparately = () => {
  // ...
};
```

#### 3. Modal de Historial Visual Antigravity (`isVisualHistoryModalOpen`)
- Se implementó un modal de pantalla completa con dos columnas:
  - **Columna izquierda:** Línea de tiempo con cada snapshot registrado en memoria, número de polígonos, hora exacta de guardado y botón para restaurar.
  - **Columna derecha:** Visor gráfico SVG en vivo que renderiza instantáneamente el snapshot seleccionado usando cálculo dinámico de `viewBox` (`getMultiplePathsBBox`) para que el usuario previsualice el mapa antes de decidir aplicarlo o descargarlo como bifurcación.

```tsx
{/* MODAL HISTORIAL VISUAL DE VERSIONES (ANTIGRAVITY TIMELINE CON PREVISUALIZACIÓN Y DIFF) */}
{isVisualHistoryModalOpen && (
  <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
    {/* Lista de Snapshots con selección interactiva */}
    {/* Previsualizador SVG en tiempo real con botones de Restaurar y Bifurcar / Guardar Copia */}
  </div>
)}
```

---

### B. Modificación en `src/lib/projectService.ts`

#### Persistencia Híbrida en Base de Datos e Índice Local Resiliente
- **Problema previo:** Si el servidor backend no respondía o se reiniciaba, `fetchProjectsFromDatabase` retornaba un arreglo vacío y la pestaña de proyectos en base de datos mostraba `(0)` proyectos.
- **Solución implementada:**
  - `saveProjectToDatabase` guarda de forma síncrona en el índice persistente local `indexed_local_projects` e intenta la sincronización por API con el backend Cloud SQL (`/api/projects`).
  - `fetchProjectsFromDatabase` consulta la API REST y fusiona los resultados con el almacén local persistente usando un `Map<string, SavedProjectRecord>`, garantizando que el usuario **nunca pierda el acceso a sus proyectos guardados**.

```typescript
// Guarda o actualiza in-place un proyecto en la base de datos backend y en índice local sincronizado
export async function saveProjectToDatabase(
  projectId: string | null,
  projectName: string,
  payload: any,
  description: string = '',
  category: string = 'cartografia'
): Promise<{ success: boolean; id: string; name: string; updatedAt: string }> {
  // 1. Siempre guardar en índice local persistente como respaldo garantizado
  // 2. Intentar guardar en backend / Cloud SQL via fetch API
}

// Obtiene todos los proyectos guardados en la base de datos (y combina con el índice local persistente)
export async function fetchProjectsFromDatabase(): Promise<SavedProjectRecord[]> {
  // Combina proyectos del servidor y caché local para máxima disponibilidad
}
```

---

## 3. Estado de Compilación y Verificación
- Se ejecutó `compile_applet` verificando que la aplicación compile sin ningún error TypeScript ni de empaquetado Vite/esbuild.
- Todos los componentes y servicios existentes se preservaron intactos, cumpliendo con la regla de no eliminar ni perder ninguna funcionalidad previa.

---

## 4. Índice de Informes Técnicos del Proyecto
1. `2026-07-03_01_actualizacion_mapa.md` - Estructura inicial y capas cartográficas.
2. `2026-07-04_02_reposicionamiento_malvinas.md` - Reposicionamiento y escalas de Malvinas.
3. `2026-07-05_03_mejora_vectorizacion_y_control_calidad.md` - Autotrace CORS dynamic bypass y controles de vectorización.
4. `2026-07-06_04_eliminacion_piezas_y_optimizacion_autotrace.md` - Optimización de memoria RAM y simplificación RDP.
5. `2026-07-07_05_fusión_y_reemplazo_sistema_d_svg.md` - Fusión compuesta SVG, vaciado de paths e inyección por lotes JSON.
6. `2026-08-25_06_seleccion_historial_visual_y_persistencia.md` - **[Este informe]** Preservación de mapa completo en selección, herramientas de duplicar/guardar aparte, Historial Visual Antigravity Timeline y persistencia híbrida BD/Local/Drive.
