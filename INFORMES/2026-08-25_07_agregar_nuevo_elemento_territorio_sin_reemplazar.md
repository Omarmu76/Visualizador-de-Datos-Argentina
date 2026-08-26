# INFORME TÉCNICO N° 07: SISTEMA PARA AGREGAR NUEVOS ELEMENTOS AL MAPA (SIN REEMPLAZAR NADA)

**Fecha:** 25 de Agosto de 2026  
**Módulo:** Editor Vectorial Avanzado (`AdvancedCanvasEditor`, `AddElementModal`, `vectorPresets`)  
**Objetivo:** Permitir al usuario agregar nuevos elementos, figuras, miembros o territorios (ej: Islas Malvinas o partes faltantes) al mapa actual de manera aditiva, sin borrar, reemplazar ni perder ninguno de los elementos ya existentes, con interfaz intuitiva, calibración de escala y posición, y restauración en 1 clic.

---

## 1. Contexto del Problema y Necesidad del Usuario

En sesiones anteriores, al realizar modificaciones o pruebas en el editor, el territorio de **Islas Malvinas** se había perdido o desasociado del mapa activo. El usuario requería:
1. **Poder agregar un nuevo elemento** al mapa actual sin tener que seleccionar nada previamente ni reemplazar el mapa existente.
2. **Biblioteca de elementos listos para usar** clasificados por Territorios (Islas Malvinas, Antártida, Regiones), Anatomía (Órganos, Miembros como brazo, pierna, etc. en analogía solicitada), Formas Geométricas e Insignias.
3. **Restauración automática e inteligente** que detecte si faltan provincias o territorios oficiales (especialmente Islas Malvinas) y permita incorporarlas con 1 solo clic con sus coordenadas oficiales íntegras.
4. **Posibilidad de importar SVG o código manual** (`<path d="..." />` o JSON) o subir archivos vectoriales.
5. **Acomodación y ajuste inmediato:** Una vez agregado el nuevo elemento, el editor lo selecciona automáticamente y habilita los controles de arrastre, movimiento direccional D-Pad (1px, 5px, 10px, 20px) y factores de escala (0.5x, 0.8x, 1.2x, 1.5x, 2x) para ubicarlo y dimensionarlo con precisión milimétrica.

---

## 2. Archivos Creados y Modificados

### A. Archivos Nuevos Creados
1. `/src/data/vectorPresets.ts`:
   - Biblioteca de plantillas vectoriales organizadas por categorías:
     - `TERRITORY_PRESETS`: Islas Malvinas (coordenadas oficiales), Antártida e Islas del Atlántico Sur, CABA, Patagonia, Cuyo, NOA, NEA, Centro.
     - `ANATOMY_PRESETS`: Miembro Superior (Brazo/Mano), Miembro Inferior (Pierna/Pie), Corazón/Órgano Central, Cerebro/Nódulo Superior, Pulmón/Lóbulo Lateral.
     - `GEOMETRIC_PRESETS`: Marcador / Pin de Ubicación, Estrella de 5 Puntas, Círculo / Nodo de Red, Escudo / Insignia de Región.
     - `getPresetById(id)`: Función buscadora para extracción rápida.

2. `/src/components/AddElementModal.tsx`:
   - Componente modal completo y reactivo con 3 pestañas principales:
     - **Pestaña 1 - Galería de Presets / Biblioteca Vectorial**: Visualización por tarjetas con mini-previsualización SVG en vivo, badges de categoría, buscador en tiempo real y detector de elementos faltantes en 1 clic.
     - **Pestaña 2 - Código SVG / JSON Directo**: Área para pegar código `<path d="..." />` o JSON de coordenadas, con vista previa inmediata del contorno renderizado.
     - **Pestaña 3 - Subir Archivo (.SVG / .JSON)**: Zona Drag-and-Drop y explorador de archivos con parseador automático de geometrías vectoriales.
   - Panel de propiedades para personalizar antes de insertar: Nombre identificativo (ej: "Islas Malvinas"), ID único, Categoría y Color de relleno.

### B. Archivos Modificados
1. `/src/components/AdvancedCanvasEditor.tsx`:
   - **Import:** Se importó `AddElementModal` desde `./AddElementModal`.
   - **Estado:** Se añadió `isAddElementModalOpen` (boolean).
   - **Lógica de Integración:**
     - `handleAddNewVectorPath(newPath, options)`: Añade el nuevo objeto a `mapEntity.paths` de forma puramente aditiva (`[...prev.paths, finalItem]`), previniendo colisiones de ID y seleccionando el nuevo objeto para acomodación inmediata.
     - `handleQuickRestoreMalvinas()`: Restaura instantáneamente las Islas Malvinas con sus coordenadas oficiales en 1 clic.
     - `isMalvinasMissing`: Memo que detecta si las Islas Malvinas faltan en el mapa actual para mostrar un aviso/botón destacado.
   - **UI / Botones Integrados:**
     - **Barra Superior:** Botón destacado `➕ Agregar Elemento` con gradiente esmeralda y botón `Restaurar Malvinas` (si no están en el mapa).
     - **Cabecera de Capas / Objetos:** Botón `➕ Agregar` junto al botón `Todos`.
     - **Barra Flotante Inferior:** Botón `➕ Agregar Elemento` (cuando no hay selección) y `➕ Agregar Otro` (cuando hay elementos seleccionados).
     - **Render del Modal:** Montado al final del componente con propiedades completas (`isOpen`, `onClose`, `onAddPath`, `existingPaths`, `currentContextName`).
   - **Utilidades:** Se agregó `downloadJsonBlob` para exportación y bifurcación segura de estados.

---

## 3. Verificación y Pruebas Realizadas

1. **Linter de TypeScript (`tsc --noEmit`):**
   - Ejecutado con código de salida 0 (sin advertencias ni errores de tipos).
2. **Compilador de Producción Vite (`npm run build`):**
   - Ejecutado satisfactoriamente con empaquetado optimizado de todos los módulos.
3. **Preservación de Código:**
   - No se eliminó ninguna funcionalidad existente (se conservan intactos los sistemas de Fusión de SVG, Árbol Jerárquico de Capas, Inspector de Propiedades, Historial Visual y Persistencia Segura).
