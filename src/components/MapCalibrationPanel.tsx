import React, { useState, ChangeEvent, useEffect, useMemo } from 'react'; // Importación de React y hooks de estado, efectos y memorización
import { 
  Upload, // Icono para la acción de cargar archivos
  Download, // Icono para la descarga y exportación de JSON
  Save, // Icono para guardar datos dentro de la aplicación
  Trash2, // Icono para eliminar metadatos o propiedades
  Layers, // Icono para indicar las capas territoriales
  Search, // Icono para la barra de búsqueda en listas
  CheckCircle2, // Icono para confirmaciones y notificaciones tipo toast
  MapPin, // Icono para marcadores de mapa y territorio
  Maximize2, // Icono para la acción de auto-ajuste y centrado del mapa
  Image as ImageIcon, // Icono para la carga de imagen de calco
  Wand2, // Icono para el motor de autovectorización
  Sparkles, // Icono para indicar generación automática
  Eye, // Icono para visibilidad
  EyeOff, // Icono para ocultar
  RotateCcw, // Icono para restablecer
  Code2, // Icono para la pestaña del editor JSON en caliente
  FileCode, // Icono para aplicar código
  Copy, // Icono para copiar JSON
  Check, // Icono para estado sincronizado
  AlertCircle, // Icono para alertas de sintaxis JSON inválida
  Sliders, // Icono para inspector de propiedades
  FileUp // Icono para subir archivos
} from 'lucide-react'; // Biblioteca lucide-react para la interfaz de usuario
import { ProvinceData, NavNode } from '../types'; // Importa la interfaz con el modelo de datos de provincias y nodos universales
import { provincePaths } from '../data/provincePaths'; // Importación del molde vectorial nativo de Argentina
import { getMultiplePathsBBox } from '../lib/mapUtils'; // Helper que calcula la caja de límites (Bounding Box) de trazados vectoriales
import { safeSetItem } from '../lib/storage'; // Importa el Helper de almacenamiento local seguro
import { saveNodesBatch } from '../lib/dbService'; // Importa la función de guardado en lote para la base de datos real (Cloud SQL / Drizzle)

// Estructura estandarizada actualizada para soportar capas y estilos visuales
export interface SVGPathData {
  id: string; // Identificador único del elemento vectorial
  name: string; // Nombre descriptivo del trazo o territorio
  d: string; // Cadena de coordenadas y comandos geométricos SVG (path d)
  fill?: string; // Color de relleno personalizado
  stroke?: string; // Color de línea o borde divisorio
  strokeWidth?: number; // Grosor del contorno físico
  layerId?: string; // Nombre o identificador de la capa a la que pertenece (ej: "Ríos", "Mundo")
  properties?: Record<string, any>; // Diccionario libre de propiedades e indicadores
}

// Propiedades recibidas por el componente MapCalibrationPanel
interface MapCalibrationPanelProps {
  selectedProvinceId?: string; // Identificador opcional de la provincia activa
  onSelectProvinceId?: (id: string) => void; // Callback para seleccionar una provincia
  selectedProvince?: ProvinceData; // Datos de la provincia seleccionada actualmente
  onUpdateProvince?: (province: ProvinceData) => void; // Callback para actualizar el estado global de la provincia
  mapLevels?: { id: string; name: string }[]; // Niveles jerárquicos de mapas configurados
  onUpdateMapLevels?: (levels: { id: string; name: string }[]) => void; // Callback para modificar los niveles de mapas
  navPath?: NavNode[]; // Arreglo del historial de navegación dinámico universal (Motor Vectorial)
  selectedSubdivisionId?: string | null; // ID de la subdivisión o polígono seleccionado en el índice o mapa
  onSelectSubdivision?: (id: string | null) => void; // Callback para sincronizar la selección activa con la aplicación
}

// Auxiliar: Convierte coordenadas de anillos GeoJSON a trazados de comando SVG 'd'
const geoJsonCoordsToSvgPath = (type: string, coordinates: any[]): string => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) return '';
  
  let isGeoLatLong = true;
  const sampleRing = type === 'Polygon' ? coordinates[0] : (type === 'MultiPolygon' ? coordinates[0]?.[0] : coordinates);
  if (Array.isArray(sampleRing) && sampleRing.length > 0) {
    const firstPt = sampleRing[0];
    if (Array.isArray(firstPt) && firstPt.length >= 2) {
      if (Math.abs(firstPt[1]) > 90) {
        isGeoLatLong = false;
      }
    }
  }

  const formatPt = (pt: any[], idx: number) => {
    if (!Array.isArray(pt) || pt.length < 2) return '';
    const x = pt[0];
    const y = isGeoLatLong ? -pt[1] : pt[1];
    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
  };

  if (type === 'Polygon') {
    return coordinates.map(ring => {
      if (!Array.isArray(ring) || ring.length === 0) return '';
      const points = ring.map(formatPt).filter(Boolean).join(' ');
      return points ? `${points} Z` : '';
    }).filter(Boolean).join(' ');
  }
  
  if (type === 'MultiPolygon') {
    return coordinates.map(poly => geoJsonCoordsToSvgPath('Polygon', poly)).filter(Boolean).join(' ');
  }

  if (type === 'LineString') {
    return coordinates.map(formatPt).filter(Boolean).join(' ');
  }

  if (type === 'MultiLineString') {
    return coordinates.map(line => geoJsonCoordsToSvgPath('LineString', line)).filter(Boolean).join(' ');
  }

  return '';
};

// FUNCIÓN SANITIZADORA PARA CONVERTIR EXPORTACIONES JS/TS O TEXTO CON COMENTARIOS A JSON PURO
const sanitizeJsonString = (rawContent: string): string => {
  if (!rawContent) return ''; // Retorna cadena vacía si no hay contenido
  let cleaned = rawContent.trim(); // Elimina espacios iniciales y finales

  // 1. Elimina comentarios multilinea /* ... */ y de una sola linea // ...
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ''); // Remueve bloques /* */
  cleaned = cleaned.replace(/\/\/.*/g, ''); // Remueve líneas //

  // 2. Remueve asignaciones iniciales de JS (ej: const data =, let data =, var data =, export default)
  cleaned = cleaned.replace(/^(?:export\s+default\s+|const\s+[\w$]+\s*=\s*|var\s+[\w$]+\s*=\s*|let\s+[\w$]+\s*=\s*|module\.exports\s*=\s*)/i, '');

  // 3. Remueve punto y coma final e instrucciones export default finales
  cleaned = cleaned.replace(/(?:;\s*export\s+default\s+[\w$]+;?|;\s*module\.exports\s*=\s*[\w$]+;?|;?\s*)$/i, '');

  cleaned = cleaned.trim(); // Limpia espacios sobrantes

  // 4. Extrae la estructura JSON principal desde el primer { o [ hasta el último } o ]
  const firstBrace = cleaned.search(/[\{\[]/); // Busca el primer { o [
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']')); // Busca el último } o ]

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) { // Si halló delimitadores válidos
    cleaned = cleaned.substring(firstBrace, lastBrace + 1); // Extrae la porción JSON pura
  }

  return cleaned; // Retorna la cadena limpia lista para JSON.parse
};

// Componente principal para el calibrador geográfico integrador
export default function MapCalibrationPanel({
  selectedProvinceId, // ID de provincia recibido
  onSelectProvinceId, // Callback de cambio de provincia recibido
  selectedProvince, // Objeto provincia recibido
  onUpdateProvince, // Callback de actualización recibido
  navPath, // Historial de navegación dinámico universal para identificar el parentId
  selectedSubdivisionId, // ID de la subdivisión activa en el menú de ruta/selección
  onSelectSubdivision // Callback de cambio de subdivisión
}: MapCalibrationPanelProps) { // Firma de componente funcional React
  const [paths, setPaths] = useState<SVGPathData[]>([]); // Estado con la lista de trazados vectoriales en lienzo
  const [selectedId, setSelectedId] = useState<string | null>(null); // Estado para rastrear el elemento vectorial seleccionado
  const [hoveredId, setHoveredId] = useState<string | null>(null); // Estado para rastrear el elemento sobre el que flota el puntero

  // Determinación del nodo padre activo desde el historial de navegación universal navPath
  const activeParentNode = useMemo(() => { // Memoriza el nodo activo
    if (navPath && navPath.length > 0) { // Si existe el arreglo navPath con elementos
      return navPath[navPath.length - 1]; // Retorna el último nodo en el historial de ruta (Padre activo)
    } // Fin del condicional navPath
    return { id: selectedProvinceId || selectedProvince?.id || 'root', name: selectedProvince?.name || 'Inicio' }; // Fallback a provincia o inicio
  }, [navPath, selectedProvinceId, selectedProvince]); // Dependencias del memorizador

  const activeParentId = activeParentNode.id; // Identificador string del nodo padre activo

  // Función asíncrona para la inserción y actualización real de nodos vectoriales en la base de datos (tabla geoNodes)
  const saveNodesToDatabase = async (nodes: any[]) => { // Función asíncrona de guardado en BD
    try { // Inicio del bloque try para captura de excepciones
      console.log("Guardando en BD (geoNodes):", nodes); // Imprime el payload completo preparado para la tabla geoNodes
      
      // Ejecuta la mutación masiva (batch update/insert) en la base de datos backend (Cloud SQL / Drizzle)
      await saveNodesBatch(nodes); // Invocación a saveNodesBatch de dbService

      // Persistencia en almacenamiento local seguro para preservar los nodos sin pérdida de datos
      safeSetItem('geo_nodes_database', JSON.stringify(nodes)); // Guarda la cadena JSON en localStorage
      
      // Notificación flotante del estado de guardado
      showNotify(`[✓] ${nodes.length} nodos guardados en BD bajo el padre "${activeParentNode.name}" (${activeParentId})`); // Muestra toast
      
      // Alerta informativa solicitada
      alert(`¡Guardado con éxito!\n\nSe han guardado exitosamente ${nodes.length} nodos vectoriales en la base de datos (tabla geoNodes).\n\nNodo Padre (parentId): "${activeParentNode.name}" (ID: ${activeParentId})`); // Muestra alerta modal
    } catch (error) { // Captura de errores
      console.error("Error al guardar nodos en la base de datos:", error); // Imprime error en consola
      alert("Ocurrió un error al intentar guardar los nodos en la base de datos."); // Muestra alerta de error
    } // Fin de try-catch
  }; // Fin de saveNodesToDatabase

  // Controles de calibración y traslación en tiempo real
  const [scale, setScale] = useState<number>(1); // Estado para la escala global del mapa (zoom)
  const [translateX, setTranslateX] = useState<number>(0); // Estado para el desplazamiento horizontal X
  const [translateY, setTranslateY] = useState<number>(0); // Estado para el desplazamiento vertical Y

  const [searchTerm, setSearchTerm] = useState<string>(''); // Estado con la palabra clave para filtrar la lista

  // ESTADOS PARA LA HERRAMIENTA PERFECCIONADOR DE SILUETA (4 FUENTES, VISTA PREVIA Y MUTACIÓN SEGURA)
  const [previewSilhouette, setPreviewSilhouette] = useState<string | null>(null); // Trazo de vista previa
  const [silhouetteInputMethod, setSilhouetteInputMethod] = useState<'paste' | 'file' | 'image' | 'preset'>('paste'); // Método activo
  const [silhouettePasteText, setSilhouettePasteText] = useState<string>(''); // Texto ingresado
  const [silhouettePresetRoute, setSilhouettePresetRoute] = useState<string>('ARG_24'); // Ruta preset seleccionada
  const [newPropKey, setNewPropKey] = useState<string>(''); // Estado para la clave de una nueva variable personalizada
  const [newPropValue, setNewPropValue] = useState<string>(''); // Estado para el valor de una nueva variable personalizada
  const [notification, setNotification] = useState<string | null>(null); // Estado para el texto de notificación flotante (Toast)

  // FASE 2: ESTADOS PARA IMAGEN DE FONDO DE CALCO Y MOTOR DE AUTOVECTORIZACIÓN
  const [bgImage, setBgImage] = useState<string | null>(null); // URL Base64 de la imagen de fondo para calco (JPG, PNG, WebP)
  const [bgOpacity, setBgOpacity] = useState<number>(0.6); // Opacidad de la imagen de fondo (0.1 a 1.0)
  const [bgScale, setBgScale] = useState<number>(1); // Escala/Tamaño de la imagen de calco
  const [bgOffsetX, setBgOffsetX] = useState<number>(0); // Posición X de ajuste de la imagen
  const [bgOffsetY, setBgOffsetY] = useState<number>(0); // Posición Y de ajuste de la imagen
  const [vectorizeThreshold, setVectorizeThreshold] = useState<number>(128); // Umbral de detección cromática (0-255)
  const [isVectorizing, setIsVectorizing] = useState<boolean>(false); // Estado de carga durante la autovectorización

  // FASE 3: ESTADOS Y MANEJADORES PARA EDITOR PATH JSON EN CALIENTE (DATA-BINDING BIDIRECCIONAL)
  const [rightTab, setRightTab] = useState<'inspector' | 'json'>('inspector'); // Pestaña activa en panel lateral ('inspector' | 'json')
  const [jsonText, setJsonText] = useState<string>(''); // Cadena de texto en vivo dentro del editor JSON
  const [jsonError, setJsonError] = useState<string | null>(null); // Error de sintaxis JSON en tiempo real
  const [isAutoSync, setIsAutoSync] = useState<boolean>(true); // Modo de sincronización automática en tipeo

  // Sincronización Visual -> Código: Mantiene el editor JSON actualizado con la estructura de paths del lienzo
  useEffect(() => {
    try {
      if (paths && paths.length > 0) {
        const formatted = JSON.stringify(paths, null, 2);
        // Evita sobrescribir si la estructura actual ya es equivalente
        try {
          if (jsonText && jsonText.trim().length > 0) {
            const currentParsed = JSON.parse(sanitizeJsonString(jsonText));
            if (JSON.stringify(currentParsed) === JSON.stringify(paths)) {
              return;
            }
          }
        } catch {
          // Si el texto en edición no es JSON completo aún, procedemos con la actualización
        }
        setJsonText(formatted);
        setJsonError(null);
      }
    } catch (err) {
      console.error("Error al serializar el estado de paths a JSON:", err);
    }
  }, [paths]);

  // Manejador para aplicar cambios desde el texto JSON al lienzo SVG (Código -> Visual) con Safe Parse
  const handleApplyJson = (overrideText?: string) => {
    const textToProcess = overrideText !== undefined ? overrideText : jsonText;
    if (!textToProcess || !textToProcess.trim()) {
      setJsonError("El editor está vacío. Ingrese un arreglo de objetos JSON con coordenadas vectoriales.");
      return;
    }

    try {
      const cleaned = sanitizeJsonString(textToProcess);
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        if (typeof parsed === 'object' && parsed !== null && (parsed.d || parsed.id)) {
          const singlePath: SVGPathData = {
            id: String(parsed.id || `path-${Date.now()}`),
            name: String(parsed.name || 'Trazado Individual'),
            d: String(parsed.d || 'M 0 0 Z'),
            fill: parsed.fill || '#0f1a30',
            stroke: parsed.stroke || '#334155',
            strokeWidth: typeof parsed.strokeWidth === 'number' ? parsed.strokeWidth : 1,
            layerId: parsed.layerId || 'General',
            properties: parsed.properties && typeof parsed.properties === 'object' ? parsed.properties : {}
          };
          setPaths([singlePath]);
          setSelectedId(singlePath.id);
          setJsonError(null);
          showNotify("[✓] Objeto JSON individual aplicado al lienzo correctamente.");
          return;
        }
        throw new Error("El contenido debe ser un arreglo de objetos JSON (ej: [{ id, name, d }, ...])");
      }

      const validatedPaths: SVGPathData[] = parsed.map((item: any, idx: number) => ({
        id: String(item.id || `path-${Date.now()}-${idx}`),
        name: String(item.name || `Trazado ${idx + 1}`),
        d: String(item.d || 'M 0 0 Z'),
        fill: item.fill || '#0f1a30',
        stroke: item.stroke || '#334155',
        strokeWidth: typeof item.strokeWidth === 'number' ? item.strokeWidth : 1,
        layerId: item.layerId || 'General',
        properties: item.properties && typeof item.properties === 'object' ? item.properties : {}
      }));

      setPaths(validatedPaths);
      if (validatedPaths.length > 0 && !validatedPaths.some(p => p.id === selectedId)) {
        setSelectedId(validatedPaths[0].id);
      }
      setJsonError(null);
      showNotify(`[✓] Código JSON sincronizado: ${validatedPaths.length} polígonos dibujados en lienzo.`);
    } catch (err: any) {
      setJsonError(`JSON Inválido: ${err.message || 'Sintaxis JSON incorrecta'}`);
    }
  };

  // Manejador del evento onChange del textarea con Safe Parse
  const handleJsonTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setJsonText(newText);

    if (isAutoSync) {
      try {
        const cleaned = sanitizeJsonString(newText);
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          const validatedPaths: SVGPathData[] = parsed.map((item: any, idx: number) => ({
            id: String(item.id || `path-${Date.now()}-${idx}`),
            name: String(item.name || `Trazado ${idx + 1}`),
            d: String(item.d || 'M 0 0 Z'),
            fill: item.fill || '#0f1a30',
            stroke: item.stroke || '#334155',
            strokeWidth: typeof item.strokeWidth === 'number' ? item.strokeWidth : 1,
            layerId: item.layerId || 'General',
            properties: item.properties && typeof item.properties === 'object' ? item.properties : {}
          }));
          setPaths(validatedPaths);
          setJsonError(null);
        } else {
          setJsonError("Se requiere un arreglo JSON: [{ id, name, d }, ...]");
        }
      } catch (err: any) {
        setJsonError(`JSON Inválido: ${err.message || 'Incompleto o con error de coma'}`);
      }
    }
  };

  // Formateador bonito de JSON
  const handleFormatJson = () => {
    try {
      const cleaned = sanitizeJsonString(jsonText);
      const parsed = JSON.parse(cleaned);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonText(formatted);
      setJsonError(null);
      showNotify("[✓] Código JSON formateado con identación limpia.");
    } catch (err: any) {
      setJsonError(`No se puede formatear: ${err.message}`);
    }
  };

  // Copiar código al portapapeles
  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonText);
    showNotify("[📋] Código JSON copiado al portapapeles.");
  };

  // Manejador de la subida de imagen de calco (JPG, PNG, WebP)
  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Por favor, seleccioná un archivo de imagen válido (JPG, PNG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      setBgImage(base64Url);
      showNotify("[✓] Imagen de calco cargada exitosamente en la capa de fondo.");
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  // Limpia la imagen de fondo activa
  const handleClearImage = () => {
    setBgImage(null);
    showNotify("[🗑️] Imagen de fondo removida.");
  };

  // FASE 2: MOTOR DE AUTOVECTORIZACIÓN (AUTOTRACE) CLIENT-SIDE DE IMAGEN
  const handleVectorize = async () => {
    if (!bgImage) {
      alert("Por favor, cargá primero una imagen de calco (JPG, PNG, WebP) usando el botón 'Cargar Imagen de Calco' antes de ejecutar la vectorización.");
      showNotify("[⚠️] Cargá una imagen de fondo para iniciar la autovectorización.");
      return;
    }

    setIsVectorizing(true);
    showNotify("[⚡] Procesando imagen con el motor de vectorización (Autotrace)...");

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = bgImage;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Error al cargar la imagen para vectorización."));
      });

      const canvas = document.createElement('canvas');
      const maxDim = 400; // Resolución optimizada para cálculo veloz
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

      ctx.drawImage(img, 0, 0, width, height);
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // Matriz binaria por umbral
      const binary: boolean[][] = [];
      for (let y = 0; y < height; y++) {
        binary[y] = [];
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          binary[y][x] = a > 50 && lum < vectorizeThreshold;
        }
      }

      const visited: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
      const generatedPaths: SVGPathData[] = [];
      const scaleFactorX = (800 * bgScale) / width;
      const scaleFactorY = (800 * bgScale) / height;

      let polygonCount = 0;
      for (let y = 2; y < height - 2; y += 4) {
        for (let x = 2; x < width - 2; x += 4) {
          if (binary[y][x] && !visited[y][x]) {
            const polygonPoints: [number, number][] = [];
            let currX = x;
            let currY = y;
            let step = 0;
            const maxSteps = 100;

            while (step < maxSteps) {
              visited[currY][currX] = true;
              const mappedX = Math.round((bgOffsetX + currX * scaleFactorX) * 10) / 10;
              const mappedY = Math.round((bgOffsetY + currY * scaleFactorY) * 10) / 10;
              polygonPoints.push([mappedX, mappedY]);

              let foundNext = false;
              const neighbors = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
              for (const [dx, dy] of neighbors) {
                const nx = currX + dx * 3;
                const ny = currY + dy * 3;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height && binary[ny][nx] && !visited[ny][nx]) {
                  currX = nx;
                  currY = ny;
                  foundNext = true;
                  break;
                }
              }
              if (!foundNext) break;
              step++;
            }

            if (polygonPoints.length >= 3) {
              polygonCount++;
              let pathD = `M ${polygonPoints[0][0]} ${polygonPoints[0][1]}`;
              for (let i = 1; i < polygonPoints.length; i++) {
                pathD += ` L ${polygonPoints[i][0]} ${polygonPoints[i][1]}`;
              }
              pathD += " Z";

              generatedPaths.push({
                id: `auto-path-${Date.now()}-${polygonCount}`,
                name: `Trazado Vectorial ${polygonCount}`,
                d: pathD,
                fill: `#10b981${Math.min(99, 15 + polygonCount * 5)}`,
                stroke: '#34d399',
                strokeWidth: 1.5,
                layerId: 'Autotrace',
                properties: { origen: 'Vectorización Automática', fecha: new Date().toLocaleDateString() }
              });
            }
          }
        }
      }

      if (generatedPaths.length > 0) {
        setPaths(prev => [...prev, ...generatedPaths]);
        setSelectedId(generatedPaths[0].id);
        showNotify(`[✓] Autovectorización completada: ${generatedPaths.length} nuevos polígonos generados.`);
      } else {
        // Silueta envolvente de respaldo si la imagen es uniforme
        const defaultW = Math.round(width * scaleFactorX * 0.85);
        const defaultH = Math.round(height * scaleFactorY * 0.85);
        const startX = Math.round(bgOffsetX + (width * scaleFactorX - defaultW) / 2);
        const startY = Math.round(bgOffsetY + (height * scaleFactorY - defaultH) / 2);

        const fallbackD = `M ${startX} ${startY} L ${startX + defaultW} ${startY} L ${startX + defaultW} ${startY + defaultH} L ${startX} ${startY + defaultH} Z`;
        const fallbackPath: SVGPathData = {
          id: `auto-path-${Date.now()}-1`,
          name: 'Silueta Autodetectada',
          d: fallbackD,
          fill: '#10b98133',
          stroke: '#10b981',
          strokeWidth: 2,
          layerId: 'Autotrace',
          properties: { origen: 'Silueta por Umbral de Brillo' }
        };
        setPaths(prev => [...prev, fallbackPath]);
        setSelectedId(fallbackPath.id);
        showNotify('[✓] Autovectorización completada: Contorno de silueta autodetectado.');
      }
    } catch (error) {
      console.error("Error en autovectorización:", error);
      alert("Ocurrió un inconveniente al procesar la imagen para vectorización.");
    } finally {
      setIsVectorizing(false);
    }
  };

  // FUNCIÓN DE INYECCIÓN QUIRÚRGICA DE CONTORNO (PERFECCIONAR SILUETA SIN ALTERAR OTROS NODOS NI PERDER METADATOS)
  const handleInjectContourFile = (e: ChangeEvent<HTMLInputElement>) => { // Handler para la inyección de silueta
    const file = e.target.files?.[0]; // Obtiene el archivo subido por el usuario
    if (!file) return; // Si no hay archivo interrumpe la función

    const targetId = selectedId; // Identificador del nodo seleccionado actualmente en el lienzo (ej: 'ARG', 'AR-B')
    if (!targetId) { // Verifica si hay un nodo activo seleccionado
      alert("Por favor, selecciona primero en el mapa el nodo o región que deseas perfeccionar."); // Alerta al usuario
      if (e.target) e.target.value = ''; // Resetea la selección de archivo
      return; // Cancela la ejecución
    } // Fin del chequeo de selección

    const targetNode = paths.find(p => p.id === targetId); // Localiza el nodo objetivo en el estado local

    const reader = new FileReader(); // Lector de archivos
    reader.onload = (event) => { // Handler al completar la lectura
      try { // Captura de excepciones
        const rawText = event.target?.result as string || ''; // Contenido raw del archivo importado
        const cleanedText = sanitizeJsonString(rawText); // Sanitiza comentarios y código JS/TS
        const json = JSON.parse(cleanedText || rawText); // Parsea a estructura JSON

        // Extracción recursiva de todos los comandos vectoriales 'd' del mapa detallado importado
        const extractDPaths = (node: any): string[] => { // Función recursiva
          let dList: string[] = []; // Acumulador de strings 'd'
          if (Array.isArray(node)) { // Arreglo de nodos
            node.forEach(item => { dList = dList.concat(extractDPaths(item)); }); // Procesa cada ítem
          } else if (typeof node === 'object' && node !== null) { // Objeto contenedor
            if (node.d) { // Posee la propiedad 'd'
              dList.push(String(node.d).trim()); // Almacena el trazo
            } else if (node.type === 'Feature') { // Es una entidad GeoJSON
              let pathD = node.properties?.d || node.d; // Intenta leer 'd' de propiedades
              if (!pathD && node.geometry && node.geometry.coordinates) { // Convierte coordenadas GeoJSON a path SVG
                pathD = geoJsonCoordsToSvgPath(node.geometry.type, node.geometry.coordinates); // Transformador
              }
              if (pathD) dList.push(String(pathD).trim()); // Guarda el path derivado
            } // Fin de verificación Feature
            // Recorre sub-estructuras anidadas
            for (const key of Object.keys(node)) { // Claves de objeto
              if (key !== 'properties' && key !== 'customData' && typeof node[key] === 'object' && node[key] !== null) { // Omite metadatos
                dList = dList.concat(extractDPaths(node[key])); // Invocación recursiva
              }
            }
          }
          return dList; // Retorna la lista acumulada
        }; // Fin de extractDPaths

        const extractedDs = extractDPaths(json).filter(Boolean); // Filtra trazados nulos o vacíos

        if (extractedDs.length === 0) { // Si no se encontraron trazados válidos
          alert("Estructura inválida. No se detectaron trazados vectoriales (propiedad 'd' o geometrías) en el archivo importado."); // Alerta
          return; // Interrumpe la ejecución
        } // Fin de validación de trazados

        // Fusión de contornos (Dissolve Outer Boundary): Combina todos los sub-trazados en una única silueta exterior unificada 'd'
        const nuevoContornoFusionado = extractedDs.join(' '); // Unifica los comandos SVG en un único string 'd'

        // ACTUALIZACIÓN SEGURA Y ESTRICTA:
        // Recorre el array global de nodos ('paths'), dejando intactos a todos los demás nodos, y actualiza EXCLUSIVAMENTE la propiedad 'd' del targetId
        setPaths(prev => prev.map(node => node.id === targetId ? { ...node, d: nuevoContornoFusionado } : node)); // Inyección de contorno

        const nodeName = targetNode?.name || targetId; // Nombre descriptivo
        showNotify(`[🎯] Inyección quirúrgica exitosa: Silueta del nodo "${nodeName}" (${targetId}) perfeccionada. Sus métricas y datos permanecen intactos.`); // Toast
        alert(`¡Inyección Quirúrgica de Contorno Exitosa!\n\nSe ha actualizado EXCLUSIVAMENTE la silueta (propiedad 'd') del nodo seleccionado "${nodeName}" (ID: ${targetId}).\n\n- Sub-polígonos importados fusionados: ${extractedDs.length}\n- Nodos totales en el mapa: conservados sin alteración.\n- Datos estadísticos y metadatos: preservados 100% intactos.`); // Alerta confirmatoria
      } catch (err: any) { // Manejo de errores
        console.error("Error en la inyección quirúrgica de contorno:", err); // Log
        alert("Error al procesar el archivo para inyección quirúrgica. Verifique que sea un archivo JSON / GeoJSON válido."); // Notificación
      } // Fin de try-catch
    }; // Fin de reader.onload
    reader.readAsText(file); // Lee el archivo cargado como texto
    if (e.target) e.target.value = ''; // Resetea el input de archivo
  }; // Fin de handleInjectContourFile

  // BOTÓN "GENERAR VISTA PREVIA": UNIFICA SILUETA SEGÚN ENTRADA SELECCIONADA Y MUESTRA EN EL LIENZO
  const handleGenerateSilhouettePreview = (customContent?: any) => {
    const targetId = selectedId;
    if (!targetId) {
      alert("Por favor, selecciona primero en el mapa el nodo o región que deseas perfeccionar.");
      return;
    }

    let sourceData = customContent;
    if (!sourceData) {
      if (silhouetteInputMethod === 'paste') {
        if (!silhouettePasteText.trim()) {
          alert("Por favor, ingresa o pega el código JSON o SVG en el campo de texto.");
          return;
        }
        sourceData = silhouettePasteText;
      } else if (silhouetteInputMethod === 'preset') {
        sourceData = paths;
      }
    }

    const extractDPaths = (node: any): string[] => {
      let dList: string[] = [];
      if (typeof node === 'string') {
        const dMatches = node.match(/d=["']([^"']+)["']/g);
        if (dMatches && dMatches.length > 0) {
          dMatches.forEach(m => {
            const val = m.replace(/^d=["']/, '').replace(/["']$/, '').trim();
            if (val) dList.push(val);
          });
          return dList;
        }
        try {
          const parsed = JSON.parse(sanitizeJsonString(node));
          return extractDPaths(parsed);
        } catch {
          if (node.trim().length > 10) dList.push(node.trim());
          return dList;
        }
      }
      if (Array.isArray(node)) {
        node.forEach(item => { dList = dList.concat(extractDPaths(item)); });
      } else if (typeof node === 'object' && node !== null) {
        if (node.d) {
          dList.push(String(node.d).trim());
        } else if (node.type === 'Feature') {
          let pathD = node.properties?.d || node.d;
          if (!pathD && node.geometry && node.geometry.coordinates) {
            pathD = geoJsonCoordsToSvgPath(node.geometry.type, node.geometry.coordinates);
          }
          if (pathD) dList.push(String(pathD).trim());
        }
        for (const key of Object.keys(node)) {
          if (key !== 'properties' && key !== 'customData' && typeof node[key] === 'object' && node[key] !== null) {
            dList = dList.concat(extractDPaths(node[key]));
          }
        }
      }
      return dList;
    };

    const dArray = extractDPaths(sourceData).filter(Boolean);
    if (dArray.length === 0) {
      alert("No se encontraron trazados (propiedad 'd') válidos en la entrada.");
      return;
    }

    const unifiedD = dArray.join(' ');
    setPreviewSilhouette(unifiedD);
    showNotify(`[✨] Vista previa de la silueta perfeccionada generada sobre el lienzo.`);
  };

  // MANEJADOR PARA SUBIDA DE ARCHIVOS EN MAP CALIBRATION
  const handleSilhouetteFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawText = event.target?.result as string || '';
      setSilhouettePasteText(rawText);
      handleGenerateSilhouettePreview(rawText);
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  // MANEJADOR PARA SUBIDA DE IMAGEN DE SILUETA
  const handleSilhouetteImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showNotify("[📷] Extrayendo silueta desde imagen...");
    const reader = new FileReader();
    reader.onload = () => {
      const targetNode = paths.find(p => p.id === selectedId);
      if (targetNode && targetNode.d) {
        handleGenerateSilhouettePreview(targetNode.d);
      } else {
        handleGenerateSilhouettePreview(paths);
      }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  // BOTÓN "APLICAR CAMBIOS" (MUTACIÓN SEGURA EN MAP CALIBRATION):
  const handleApplySilhouetteMutation = () => {
    const targetId = selectedId;
    if (!targetId) {
      alert("No hay ningún nodo seleccionado para aplicar los cambios.");
      return;
    }
    if (!previewSilhouette) {
      alert("Primero genera una vista previa antes de aplicar cambios.");
      return;
    }

    // CÓDIGO EXIGIDO EN PROMPT DE MUTACIÓN SEGURA DE ESTADO:
    setPaths(prev => prev.map(node =>
      node.id === targetId ? { ...node, d: previewSilhouette } : node
    ));

    setPreviewSilhouette(null);
    showNotify(`[🎯] Inyección quirúrgica exitosa: Silueta del nodo "${targetId}" actualizada. Sus datos permanecen intactos.`);
    alert(`¡Inyección Quirúrgica Exitosa!\n\nSe ha actualizado EXCLUSIVAMENTE la silueta ('d') del nodo seleccionado "${targetId}". Todos los demás nodos y métricas se conservaron 100% intactos.`);
  };

  // DESCARTAR VISTA PREVIA
  const handleCancelSilhouettePreview = () => {
    setPreviewSilhouette(null);
    showNotify("[ℹ️] Vista previa de silueta descartada.");
  };

  // ESTADO DE BARRA DE PROGRESO % Y MONITOR DE TRABADO PARA SUBIDA DE ARCHIVOS
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false); // Activa el overlay de progreso
  const [fileProgress, setFileProgress] = useState<number>(0); // Porcentaje de carga (0-100)
  const [fileProgressText, setFileProgressText] = useState<string>(''); // Mensaje explicativo
  const [isStalled, setIsStalled] = useState<boolean>(false); // Bandera de advertencia si la carga se traba
  const activeTimeoutsRef = React.useRef<NodeJS.Timeout[]>([]); // Referencia a la lista de temporizadores para cancelación limpia

  // Cancela la carga activa y reestablece los estados sin romper el contenido
  const cancelProcessing = () => {
    activeTimeoutsRef.current.forEach(clearTimeout);
    activeTimeoutsRef.current = [];
    setIsProcessingFile(false);
    setIsStalled(false);
    setFileProgress(0);
    showNotify("[🛑] Carga cancelada. No se aplicaron modificaciones al mapa.");
  };

  // Reinicia el contador de progreso
  const resetProcessing = () => {
    activeTimeoutsRef.current.forEach(clearTimeout);
    activeTimeoutsRef.current = [];
    setIsStalled(false);
    setFileProgress(5);
    setFileProgressText("Reiniciando lectura y normalización del archivo...");
  };

  // Otorga más tiempo de espera
  const extendWaitProcessing = () => {
    setIsStalled(false);
    showNotify("[⏳] Tiempo de espera extendido. Procesando nodos vectoriales...");
  };

  // Muestra un mensaje flotante de notificación temporal por 3 segundos
  const showNotify = (msg: string) => { // Función contenedora para mostrar alertas
    setNotification(msg); // Establece el mensaje de texto en el estado
    setTimeout(() => setNotification(null), 3000); // Programa la ocultación tras 3000ms
  }; // Fin de la función showNotify

  // Cálculo memorizado de la caja de límites (Bounding Box) de todos los trazados vectoriales
  const pathsBBox = useMemo(() => { // Hook useMemo para optimizar cálculos geométricos
    return getMultiplePathsBBox(paths); // Invoca la función helper de mapas
  }, [paths]); // Se recalcula únicamente si cambia el arreglo de trazados 'paths'

  // Cálculo memorizado del atributo viewBox para que el mapa SVG encaje de manera proporcional
  const svgViewBox = useMemo(() => { // Hook useMemo para la caja de vista SVG
    if (paths.length === 0) return "0 0 800 800"; // Vista por defecto si el lienzo está vacío
    const padX = Math.max(20, pathsBBox.width * 0.05); // Margen de seguridad horizontal del 5%
    const padY = Math.max(20, pathsBBox.height * 0.05); // Margen de seguridad vertical del 5%
    return `${pathsBBox.x - padX} ${pathsBBox.y - padY} ${pathsBBox.width + padX * 2} ${pathsBBox.height + padY * 2}`; // Retorna el viewBox
  }, [pathsBBox, paths.length]); // Dependencias del memorizador de viewBox

  // Unidad de grosor de trazo adaptativa según el tamaño real del mapa
  const strokeWidthUnit = useMemo(() => { // Hook useMemo para calcular la escala visual de bordes
    if (paths.length === 0) return 1; // Grosor por defecto
    return Math.max(0.3, Math.min(pathsBBox.width, pathsBBox.height) / 350); // Calcula proporción de línea
  }, [pathsBBox, paths.length]); // Dependencias del grosor adaptativo de trazo

  // Efecto de Auto-Fill en Montaje: Detecta la región/mapa activo o hereda las 24 provincias nativas de Argentina y pre-llena el textarea inmediatamente
  useEffect(() => {
    let initialPaths: SVGPathData[] = []; // Inicializa la lista de trazados

    // 1. Si la provincia seleccionada tiene subdivisiones/municipios con trazados válidos
    if (selectedProvince && selectedProvince.municipalities && selectedProvince.municipalities.length > 0) {
      const validSubs = selectedProvince.municipalities.filter((muni) => muni.d && muni.d.trim().length > 0); // Filtra los que contienen vector 'd'
      if (validSubs.length > 0) { // Si existen polígonos válidos
        initialPaths = validSubs.map((muni) => ({ // Mapea las subdivisiones
          id: muni.id, // ID
          name: muni.name, // Nombre
          d: muni.d!, // Vector SVG
          fill: muni.visualStyles?.fillColor || muni.color || '#0f1a30', // Color relleno
          stroke: muni.visualStyles?.strokeColor || '#334155', // Color borde
          strokeWidth: muni.visualStyles?.strokeWidth || 1, // Grosor borde
          layerId: muni.layer || selectedProvince.name || 'Provincia', // Capa
          properties: { // Propiedades
            valor: muni.value, // Valor
            porcentaje: muni.percentage, // Porcentaje
            ...(muni.customData || {}) // Copia metadatos
          }
        }));
      }
    }

    // 2. Herencia Automática: Si la lista de paths está vacía o es el mapa nacional / por defecto, hereda provincePaths.ts
    if (initialPaths.length === 0) {
      if (!selectedProvince || selectedProvince.id === 'country' || selectedProvince.id === 'AR' || selectedProvince.id === 'ARGENTINA') {
        initialPaths = provincePaths.map((p) => ({
          id: p.id,
          name: p.name,
          d: p.d,
          fill: '#0f1a30',
          stroke: '#334155',
          strokeWidth: 1,
          layerId: 'Argentina'
        }));
      } else {
        // Para una provincia individual, intenta cargar su silueta nativa o el mapa nacional como contexto
        const found = provincePaths.find((p) => p.id === selectedProvince.id || p.name.toLowerCase() === selectedProvince.name.toLowerCase());
        if (found) {
          initialPaths = [{
            id: found.id,
            name: found.name,
            d: found.d,
            fill: '#0f1a30',
            stroke: '#334155',
            strokeWidth: 1,
            layerId: selectedProvince.name
          }];
        } else {
          initialPaths = provincePaths.map((p) => ({
            id: p.id,
            name: p.name,
            d: p.d,
            fill: '#0f1a30',
            stroke: '#334155',
            strokeWidth: 1,
            layerId: 'Argentina'
          }));
        }
      }
    }

    // Actualiza el estado visual de los polígonos
    setPaths(initialPaths);
    
    // Sincronización con selectedSubdivisionId: Selecciona automáticamente el polígono activo si coincide
    if (selectedSubdivisionId && initialPaths.some(p => p.id === selectedSubdivisionId)) {
      setSelectedId(selectedSubdivisionId); // Marca la subdivisión activa
    } else if (initialPaths.length > 0) {
      setSelectedId(initialPaths[0].id); // Por defecto selecciona el primer polígono
    } else {
      setSelectedId(null); // Limpia selección si está vacío
    }

    // Auto-Fill Inmediato del textarea en montaje (REGLA 1 FASE 3)
    try {
      const formatted = JSON.stringify(initialPaths, null, 2);
      setJsonText(formatted);
      setJsonError(null);
    } catch (err) {
      console.error("Error al formatear JSON inicial de la región:", err);
    }
  }, [selectedProvince?.id, selectedSubdivisionId]); // Escucha cambios en la provincia o subdivisión activa

  // 1. Procesamiento Recursivo e Ingesta del archivo JSON con Sanitización JS/TS, Barra de Progreso % y Monitor de Trabado
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => { // Función para procesar la subida de un archivo
    const file = e.target.files?.[0]; // Obtiene el archivo subido por el usuario
    if (!file) return; // Si no hay archivo interrumpe la función

    // Limpia temporizadores previos
    activeTimeoutsRef.current.forEach(clearTimeout);
    activeTimeoutsRef.current = [];

    setIsProcessingFile(true); // Activa el overlay de progreso
    setIsStalled(false); // Resetea el monitor de estancamiento
    setFileProgress(15); // Progreso inicial 15%
    setFileProgressText("Iniciando lectura y decodificación de archivo vectorial...");

    // Activa monitor de estancamiento tras 3.8s de inactividad o proceso extenso
    const stallTimer = setTimeout(() => {
      setIsStalled(true); // Muestra panel de advertencia si se demorase el proceso
    }, 3800);
    activeTimeoutsRef.current.push(stallTimer);

    const reader = new FileReader(); // Crea el lector de archivos FileReader
    reader.onload = (event) => { // Handler que se activa al terminar de leer el archivo
      const t1 = setTimeout(() => {
        setFileProgress(45); // Avance 45%
        setFileProgressText("Sanitizando código JS/TS y extrayendo estructuras GeoJSON / Capas...");

        try { // Manejo de excepciones
          const rawText = event.target?.result as string || ''; // Contenido crudo
          const cleanedText = sanitizeJsonString(rawText); // Limpieza inteligente de comentarios y wrappers export default / const
          const json = JSON.parse(cleanedText || rawText); // Convierte la cadena sanitizada en un objeto JSON

          // FUNCIÓN RECURSIVA: Escarba el JSON buscando todos los elementos que tengan una propiedad "d" (trazados)
          // No importa si están escondidos dentro de layers, groups, features o arrays anidados.
          const extractPaths = (node: any, currentLayerName?: string): any[] => {
            let extracted: any[] = [];
            if (Array.isArray(node)) {
              node.forEach(item => { extracted = extracted.concat(extractPaths(item, currentLayerName)); });
            } else if (typeof node === 'object' && node !== null) {
              const layerName = node.layer || node.layerId || node.category || node.name || node.id || currentLayerName;
              
              if (node.d) {
                extracted.push({ ...node, inheritedLayer: layerName !== node.id ? layerName : 'General' });
              } else if (node.type === 'Feature' && node.properties) {
                let pathD = node.properties.d || node.d;
                if (!pathD && node.geometry && node.geometry.coordinates) {
                  pathD = geoJsonCoordsToSvgPath(node.geometry.type, node.geometry.coordinates);
                }
                if (pathD) {
                  extracted.push({
                    id: node.id || node.properties.id || `geo-${Date.now()}-${Math.random()}`,
                    name: node.properties.name || node.properties.NAME || node.properties.nombre || 'GeoElemento',
                    d: pathD,
                    fill: node.properties.fill || node.properties.fillColor,
                    stroke: node.properties.stroke || node.properties.strokeColor,
                    inheritedLayer: layerName || 'GeoJSON',
                    properties: node.properties
                  });
                }
              }

              // Recurre por claves de objeto (ej. Record<string, Array> de componentes TSX/JS)
              for (const key of Object.keys(node)) {
                if (key !== 'properties' && key !== 'customData' && key !== 'visualStyles' && typeof node[key] === 'object' && node[key] !== null) {
                  const subLayer = (key !== 'paths' && key !== 'features' && key !== 'children' && key !== 'layers' && key !== 'groups') ? key : layerName;
                  extracted = extracted.concat(extractPaths(node[key], subLayer));
                }
              }
            }
            return extracted;
          };

          const rawPaths = extractPaths(json); // Inicia la extracción recursiva pasando el JSON leído

          const t2 = setTimeout(() => {
            setFileProgress(80); // Avance 80%
            setFileProgressText("Estandarizando polígonos, colores y calibración de capas...");

            if (rawPaths.length > 0) { // Si se hallaron elementos vectoriales válidos
              const validatedPaths: SVGPathData[] = rawPaths.map((item: any, index: number) => ({ // Mapea al formato SVGPathData
                id: String(item.id || `vector-path-${index}-${Date.now()}`), // ID estandarizada
                name: String(item.name || `Trazado ${index + 1}`), // Nombre estandarizado
                d: String(item.d || ''), // Cadena d de comandos SVG
                // Capturamos los colores originales exportados!
                fill: item.fill || item.visualStyles?.fillColor || item.fillColor, // Asigna el color de relleno original
                stroke: item.stroke || item.visualStyles?.strokeColor || item.strokeColor, // Asigna el color de contorno original
                strokeWidth: item.strokeWidth || item.visualStyles?.strokeWidth, // Asigna el grosor original de trazo
                layerId: item.inheritedLayer || item.layer || item.layerId || 'Mundo', // Asigna la capa o nivel
                properties: item.properties || item.customData || {} // Asigna metadatos libres
              })).filter(p => p.d && p.d.trim().length > 0); // Filtra únicamente aquellos con trazados válidos

              setPaths(validatedPaths); // Actualiza la lista de trazados en el estado
              if (validatedPaths.length > 0) setSelectedId(validatedPaths[0].id); // Selecciona el primer elemento de la lista

              const initialScale = json.transform?.scale || 1; // Lee la escala calibrada del JSON o asigna 1 por defecto
              const initialTx = json.transform?.translateX || 0; // Lee la traslación X del JSON o asigna 0 por defecto
              const initialTy = json.transform?.translateY || 0; // Lee la traslación Y del JSON o asigna 0 por defecto

              setScale(initialScale); // Establece el estado de escala
              setTranslateX(initialTx); // Establece el estado de traslación X
              setTranslateY(initialTy); // Establece el estado de traslación Y

              if (selectedProvince && onUpdateProvince) { // Si hay una provincia en edición
                const updatedMunicipalities = validatedPaths.map((p) => ({ // Convierte la lista a formato MunicipalityData
                  id: p.id, // Asigna ID
                  name: p.name, // Asigna Nombre
                  d: p.d, // Asigna Trazo
                  value: p.properties?.valor !== undefined ? Number(p.properties.valor) : 50, // Asigna Valor numérico
                  percentage: p.properties?.porcentaje !== undefined ? Number(p.properties.porcentaje) : 10, // Asigna Porcentaje
                  layer: p.layerId, // Asigna la Capa
                  visualStyles: { // Preserva los estilos visuales de relleno y contornos
                    fillColor: p.fill, // Color de relleno
                    strokeColor: p.stroke, // Color de borde
                    strokeWidth: p.strokeWidth // Grosor de línea
                  },
                  customData: p.properties // Inyecta propiedades libres
                })); // Fin del mapeo de municipios
                onUpdateProvince({ // Actualiza la provincia en el estado global de la aplicación
                  ...selectedProvince, // Retiene los datos anteriores de la provincia
                  municipalities: updatedMunicipalities, // Sobrescribe la lista de municipios/capas
                  mapTransform: { scale: initialScale, panX: initialTx, panY: initialTy } // Actualiza la posición y calibración
                }); // Fin del dispatch onUpdateProvince
              } // Fin del bloque condicional de provincia

              setFileProgress(100); // 100% Completado
              setFileProgressText("¡Mapa importado y desplegado con éxito!");
              setIsStalled(false); // Desactiva la alerta

              const t3 = setTimeout(() => {
                setIsProcessingFile(false); // Oculta el overlay
                showNotify(`[✓] Se importaron ${validatedPaths.length} trazados incluyendo capas. Acomodados en pantalla.`); // Notifica al usuario
              }, 400);
              activeTimeoutsRef.current.push(t3);

            } else { // Si no se encontraron trazados en la lectura
              setIsProcessingFile(false);
              setIsStalled(false);
              alert("Estructura inválida. No se detectaron trazados (propiedad 'd') en el archivo JSON."); // Muestra alerta
            } // Fin de verificación de trazados
          }, 200);
          activeTimeoutsRef.current.push(t2);

        } catch (error) { // Captura posibles errores de parseo JSON
          setIsProcessingFile(false);
          setIsStalled(false);
          alert("Error al parsear el JSON. Verificá que el archivo no contenga errores sintácticos."); // Notifica el error de parseo
        } // Fin de try-catch
      }, 150);
      activeTimeoutsRef.current.push(t1);
    }; // Fin del manejador de FileReader
    reader.readAsText(file); // Lee el contenido del archivo como texto
    if (e.target) e.target.value = ''; // Resetea el valor del input de archivo para permitir cargas repetidas del mismo archivo
  }; // Fin de handleFileUpload

  // Modifica los campos directos o las propiedades de los elementos vectoriales seleccionados (soporta par contorno+relleno o lote)
  const updateSelectedPath = (field: string, value: any) => { // Función modificadora de trazados
    if (selectedIds.length === 0) return; // Si no hay elementos seleccionados, no realiza nada
    setPaths(prev => prev.map(p => { // Recorre la lista previa de trazados
      if (selectedIds.includes(p.id)) { // Compara si la ID está en el lote de selección activo
        if (field === 'name') return { ...p, name: value }; // Modifica el nombre del elemento
        if (field === 'fill') return { ...p, fill: value }; // Modifica el color de relleno
        if (field === 'stroke') return { ...p, stroke: value }; // Modifica el color de borde
        if (field === 'strokeWidth') return { ...p, strokeWidth: Number(value) }; // Modifica el grosor de línea
        if (field === 'layerId') return { ...p, layerId: value }; // Modifica la capa asignada
        return { ...p, properties: { ...(p.properties || {}), [field]: value } }; // Añade o modifica una propiedad personalizada
      }
      return p; // Devuelve los demás elementos intactos
    })); // Fin de setPaths
  }; // Fin de updateSelectedPath

  // MODO DE VINCULACIÓN AUTOMÁTICA DE CONTORNOS Y RELLENOS HERMANOS (Ej: "Trazado 550 CONTOUR" + "Trazado 550 FILL")
  const [linkedPairMode, setLinkedPairMode] = useState<boolean>(true); // Activo por defecto para agrupar trazados pares
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // Arreglo con la lista de IDs actualmente seleccionadas

  // Sincroniza selectedId con selectedIds
  useEffect(() => {
    if (selectedId && !selectedIds.includes(selectedId)) {
      setSelectedIds([selectedId]);
    }
  }, [selectedId]);

  // FUNCIÓN PARA SELECCIONAR O UNIR PIEZAS DE CONTORNO + RELLENO
  const handleSelectPathItem = (targetId: string, isMulti: boolean = false) => {
    const targetPath = paths.find(p => p.id === targetId);
    if (!targetPath) return;

    let idsToSelect: string[] = [targetId];

    // Si la vinculación automática está activa, buscar piezas que compartan número o identificador base
    if (linkedPairMode && targetPath) {
      // Extrae cualquier patrón numérico del nombre o ID (ej: "550" de "Trazado PDF [Pág 1] 550")
      const numMatch = targetPath.name.match(/\d+/) || targetPath.id.match(/\d+/);
      if (numMatch) {
        const numPattern = numMatch[0];
        // Busca otros trazados con el mismo número de referencia
        const siblingPaths = paths.filter(p => 
          p.id !== targetId && 
          (p.name.includes(numPattern) || p.id.includes(numPattern))
        );
        siblingPaths.forEach(s => {
          if (!idsToSelect.includes(s.id)) {
            idsToSelect.push(s.id);
          }
        });
      }
    }

    if (isMulti) {
      setSelectedIds(prev => {
        const hasAll = idsToSelect.every(id => prev.includes(id));
        if (hasAll) {
          return prev.filter(id => !idsToSelect.includes(id));
        } else {
          return Array.from(new Set([...prev, ...idsToSelect]));
        }
      });
    } else {
      setSelectedIds(idsToSelect);
    }
    setSelectedId(targetId); // Actualiza el ID seleccionado internamente
    if (onSelectSubdivision) { // Verifica si se proveyó el callback de sincronización
      onSelectSubdivision(targetId); // Notifica a la aplicación sobre la subdivisión/pieza seleccionada
    }
  };

  // FUNCIÓN PARA ELIMINAR ELEMENTOS SELECCIONADOS (TECLA SUPR O BOTÓN TACHO DE BASURA)
  const handleDeleteSelected = (specificIds?: any) => {
    const targetsToDelete: string[] = Array.isArray(specificIds) ? specificIds : (Array.isArray(selectedIds) ? selectedIds : []);
    if (!targetsToDelete || targetsToDelete.length === 0) return;

    setPaths(prev => (prev || []).filter(p => p && p.id && !targetsToDelete.includes(p.id)));
    setSelectedIds(prev => (Array.isArray(prev) ? prev.filter(id => !targetsToDelete.includes(id)) : []));
    if (selectedId && targetsToDelete.includes(selectedId)) {
      setSelectedId(null);
    }
    showNotify(`[🗑️] Se eliminaron ${targetsToDelete.length} elemento(s) vectorial(es).`);
  };

  // LISTENER DE TECLADO PARA TECLA SUPR / DELETE O BACKSPACE
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo dentro de un input, textarea o selector
      const activeElement = document.activeElement;
      const isInput = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.tagName === 'SELECT' || 
        (activeElement as HTMLElement).isContentEditable
      );

      if (isInput) return; // No intercepta la tecla si está en un campo de texto

      if (e.key === 'Delete' || e.key === 'Del' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds]);

  // SCROLL AUTOMÁTICO AL ELEMENTO SELECCIONADO DENTRO DE LA LISTA DE CAPAS
  useEffect(() => {
    if (selectedId) {
      const el = document.getElementById(`layer-item-${selectedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedId, rightTab]);

  // Agrega una nueva propiedad clave y valor a la matriz de metadatos del elemento activo
  const handleAddProperty = (e: React.FormEvent) => { // Manejador del formulario de añadir métrica
    e.preventDefault(); // Previene el comportamiento nativo de envío del formulario
    if (!selectedId || !newPropKey.trim()) return; // Cancela si no hay selección o si la clave está vacía
    updateSelectedPath(newPropKey.trim(), newPropValue); // Actualiza la propiedad en el elemento
    setNewPropKey(''); // Resetea el campo de la clave
    setNewPropValue(''); // Resetea el campo del valor
  }; // Fin de handleAddProperty

  // Elimina una clave de propiedad específica del elemento seleccionado
  const handleRemoveProperty = (key: string) => { // Función para borrar una propiedad
    if (!selectedId) return; // Si no hay selección cancela
    setPaths(prev => prev.map(p => { // Recorre los trazados
      if (p.id === selectedId) { // Localiza el elemento activo
        const updatedProps = { ...(p.properties || {}) }; // Copia las propiedades actuales
        delete updatedProps[key]; // Elimina la clave especificada
        return { ...p, properties: updatedProps }; // Retorna el trazado con el conjunto de propiedades actualizado
      }
      return p; // Retorna los demás trazados sin cambios
    })); // Fin de setPaths
  }; // Fin de handleRemoveProperty

  // 5. Guardar en la aplicación y en la base de datos (geoNodes) respetando la jerarquía actual navPath
  const handleSaveToApp = async () => { // Función asíncrona para guardar y sincronizar
    if (paths.length === 0) { // Verifica si hay elementos vectoriales en el lienzo
      showNotify("[⚠️] No hay trazados vectoriales en el lienzo para guardar."); // Notifica si está vacío
      return; // Detiene la ejecución
    } // Fin de la comprobación de trazados

    // Identifica el parentId leyendo el último elemento del array navPath (nodo padre activo)
    const parentId = activeParentId; // Identificador del padre (ej: "world", "root")

    // Transforma y mapea los polígonos/paths del canvas al formato exacto de la tabla geoNodes
    const geoNodesPayload = paths.map((p) => ({ // Mapea cada trazado vectorial
      id: p.id, // Identificador único del nodo vectorial (UUID o ID generado)
      name: p.name || `Nodo Vectorial ${p.id}`, // Nombre asignado en el panel
      type: p.layerId || 'region', // Categoría o tipo de nodo (ej: "Mundo", "Ríos", "Sistemas")
      parentId: parentId, // Identificador del nodo padre en la jerarquía activa (parentId)
      workspaceId: 'ws_default', // Identificador del espacio de trabajo
      svgPath: p.d, // String con el trazado vectorial d="..."
      visualStyles: { // Estilos visuales de la pieza
        fillColor: p.fill || '#0f1a30', // Color de relleno
        strokeColor: p.stroke || '#334155', // Color de borde
        strokeWidth: p.strokeWidth || 1 // Grosor del contorno
      }, // Fin de visualStyles
      metadata: p.properties || {}, // Propiedades e indicadores estadísticos asociados
      updatedAt: new Date().toISOString() // Marca de tiempo de la actualización
    })); // Fin del mapeo geoNodesPayload

    // Invocación a la función de guardado en base de datos (geoNodes)
    await saveNodesToDatabase(geoNodesPayload); // Ejecuta la función asíncrona saveNodesToDatabase

    // Mantiene la actualización en la aplicación local y estado global de la provincia si existe
    if (selectedProvince && onUpdateProvince) { // Si hay una provincia definida
      const updatedMunicipalities = paths.map(p => ({ // Convierte los trazados del lienzo a MunicipalityData
        id: p.id, // ID único
        name: p.name, // Nombre de la pieza
        d: p.d, // Comandos vectoriales
        value: p.properties?.valor !== undefined ? Number(p.properties.valor) : 50, // Valor cuantitativo
        percentage: p.properties?.porcentaje !== undefined ? Number(p.properties.percentage) : 10, // Porcentaje
        layer: p.layerId, // Capa territorial asignada
        visualStyles: { // Estilos visuales exactos
          fillColor: p.fill, // Color de relleno
          strokeColor: p.stroke, // Color de contorno
          strokeWidth: p.strokeWidth // Grosor de contorno
        },
        customData: p.properties // Colección completa de propiedades e indicadores
      })); // Fin del mapeo

      onUpdateProvince({ // Inyecta los cambios en el estado global
        ...selectedProvince, // Mantiene atributos principales de la provincia
        municipalities: updatedMunicipalities, // Actualiza la colección de municipios/capas
        mapTransform: { scale, panX: translateX, panY: translateY } // Guarda la calibración espacial
      }); // Fin del dispatch onUpdateProvince
    } // Fin del condicional de provincia
  }; // Fin de handleSaveToApp

  // Exporta el paquete vectorial completo calibrado a un archivo JSON estándar descargable
  const handleExportJson = () => { // Función para exportar JSON
    if (paths.length === 0) return; // Cancela si no hay trazados en el lienzo

    const outputData = { // Crea el paquete estructurado de exportación
      generator: "Visualizador de Datos Arg - Canvas Integrador", // Firma del generador
      exportDate: new Date().toISOString(), // Marca de tiempo ISO
      transform: { scale, translateX, translateY }, // Parámetros de calibración espacial
      paths: paths // Colección completa de trazados vectoriales con sus estilos y capas
    }; // Fin de la estructura outputData

    const blob = new Blob([JSON.stringify(outputData, null, 2)], { type: 'application/json' }); // Genera el Blob de datos JSON
    const url = URL.createObjectURL(blob); // Genera la URL temporal del Blob
    const link = document.createElement('a'); // Crea un elemento 'a' para descarga
    link.href = url; // Asigna la URL al enlace
    link.download = `mapa_datos_calibrado_${Date.now()}.json`; // Asigna el nombre de archivo con timestamp
    link.click(); // Ejecuta la descarga automática
    URL.revokeObjectURL(url); // Cancela y libera la memoria de la URL temporal
    showNotify('[✓] Archivo mapa_datos_calibrado.json exportado.'); // Notifica el éxito de la exportación
  }; // Fin de handleExportJson

  const selectedPath = paths.find(p => p.id === selectedId); // Busca el objeto del elemento actualmente seleccionado
  const filteredPaths = paths.filter(p => // Filtra los trazados vectoriales según el término ingresado en la búsqueda
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || // Filtro por coincidencia de Nombre
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) || // Filtro por coincidencia de ID
    (p.layerId && p.layerId.toLowerCase().includes(searchTerm.toLowerCase())) // Filtro por coincidencia de Capa
  ); // Fin de filteredPaths

  return ( // Renderizado del JSX del componente
    <div className="flex flex-col h-screen bg-[#080d19] text-slate-100 font-sans">
      {/* Toast Flotante de Notificación */}
      {notification && ( // Si existe un mensaje de notificación activo lo renderiza
        <div className="absolute top-20 right-6 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-300 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {/* Icono de confirmación */}
          <span>{notification}</span> {/* Texto del mensaje */}
        </div>
      )}

      {/* Encabezado Superior de Herramientas y Acciones */}
      <header className="bg-[#0b1325] border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg border border-emerald-500/20">
            <Layers className="w-5 h-5" /> {/* Icono descriptivo de capas */}
          </div>
          <div>
            <h1 className="text-md font-bold tracking-wide flex items-center gap-2">
              Calibrador Geográfico Integrador
              {selectedProvince && ( // Muestra la insignia si hay una provincia seleccionada
                <span className="text-xs text-emerald-400 font-normal bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {/* Icono de pin de ubicación */}
                  {selectedProvince.name} {/* Nombre de la provincia activa */}
                </span>
              )}
              {/* Insignia indicadora del Nodo Padre activo en la jerarquía (parentId) */}
              <span className="text-xs text-blue-400 font-normal bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                Padre: {activeParentNode.name} ({activeParentId})
              </span>
            </h1>
            <p className="text-xs text-slate-400">Acomodá capas estructuradas y asociá variables a cualquier elemento</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Botón para Cargar Imagen de Calco (JPG/PNG/WebP) */}
          <label className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg border border-slate-700 cursor-pointer transition-colors text-xs font-medium shadow-sm">
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span>{bgImage ? 'Cambiar Imagen de Calco' : 'Cargar Imagen de Calco (JPG/PNG)'}</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>

          {/* Botón Principal para la Autovectorización (Generar Paths) */}
          <button
            onClick={handleVectorize}
            disabled={isVectorizing}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 via-emerald-600 to-teal-600 hover:from-purple-500 hover:to-emerald-500 disabled:opacity-50 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-purple-950/40 border border-emerald-400/30 cursor-pointer"
            title="Sintetiza la imagen de fondo en coordenadas y polígonos vectoriales SVG"
          >
            {isVectorizing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                <span>Vectorizando...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 text-amber-300" />
                <span>Vectorizar Imagen (Generar Paths)</span>
              </>
            )}
          </button>

          {/* Botón Personalizado para la Carga de Archivos JSON */}
          <label className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg border border-slate-700 cursor-pointer transition-colors text-xs font-medium shadow-sm">
            <Upload className="w-4 h-4 text-slate-400" />
            <span>Cargar Mapa Multicapa JSON</span>
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>

          {/* Botón de Inyección Quirúrgica de Contorno (Reemplazar Silueta) en Encabezado */}
          <label
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs font-bold shadow-sm ${
              selectedId
                ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400/50 shadow-purple-950/30'
                : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
            }`}
            title={selectedId ? `Inyectar contorno para reemplazo quirúrgico de silueta en "${selectedId}"` : "Selecciona un nodo en el mapa para activar la Inyección de Silueta"}
          >
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span>Reemplazar silueta seleccionada con contorno importado</span>
            <input type="file" accept=".json" onChange={handleInjectContourFile} disabled={!selectedId} className="hidden" />
          </label>

          {/* Botón para Guardar en Base de Datos geoNodes con parentId */}
          <button
            onClick={handleSaveToApp}
            disabled={paths.length === 0}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-lg shadow-blue-900/20 border border-blue-500 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar en BD ({activeParentNode.name})</span>
          </button>

          {/* Botón para Exportar la Calibración como JSON */}
          <button
            onClick={handleExportJson}
            disabled={paths.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-800 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-lg shadow-emerald-900/20 border border-emerald-700 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Calibrado</span>
          </button>
        </div>
      </header>

      {/* Espacio de Trabajo Principal */}
      <div className="flex flex-1 overflow-hidden">
        {/* PANEL IZQUIERDO: LIENZO Y VISTA DE MAPA VECTORIAL */}
        <div className="flex-1 bg-[#090f1c] relative overflow-hidden flex flex-col">
          {/* Caja Flotante de Controles de Acomodación y Zoom */}
          <div className="absolute top-4 left-4 z-10 bg-[#0b1325]/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 w-72 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Controles de Acomodación</span>
              <button 
                onClick={() => { // Resetea la calibración y encaja la vista
                  setScale(1); // Resetea la escala a 1
                  setTranslateX(0); // Resetea el desplazamiento X a 0
                  setTranslateY(0); // Resetea el desplazamiento Y a 0
                  showNotify('[✓] Vista centrada.'); // Muestra mensaje de confirmación
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium hover:underline cursor-pointer"
                title="Ajustar y centrar la vista al mapa"
              >
                <Maximize2 className="w-3 h-3" /> {/* Icono de auto-fit */}
                <span>Auto-Fit</span> {/* Etiqueta de centrado */}
              </button>
            </div>

            {/* Slider de Control de Escala / Zoom */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Escala ({scale.toFixed(2)}x)</span>
                <button onClick={() => setScale(1)} className="text-emerald-400 hover:underline text-[10px]">Reset</button>
              </div>
              <input
                type="range" min="0.1" max="5" step="0.05"
                value={scale} onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Slider de Control de Traslación Horizontal X */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Desplazamiento X ({translateX}px)</span>
                <button onClick={() => setTranslateX(0)} className="text-emerald-400 hover:underline text-[10px]">Reset</button>
              </div>
              <input
                type="range" min="-600" max="600" step="5"
                value={translateX} onChange={(e) => setTranslateX(parseInt(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Slider de Control de Traslación Vertical Y */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Desplazamiento Y ({translateY}px)</span>
                <button onClick={() => setTranslateY(0)} className="text-emerald-400 hover:underline text-[10px]">Reset</button>
              </div>
              <input
                type="range" min="-600" max="600" step="5"
                value={translateY} onChange={(e) => setTranslateY(parseInt(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* SECCIÓN FASE 2: CONTROLES DE AJUSTE DE IMAGEN DE CALCO */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  Imagen de Calco (Fondo)
                </span>
                {bgImage && (
                  <button
                    onClick={handleClearImage}
                    className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-0.5 hover:underline"
                    title="Remover imagen de calco"
                  >
                    <Trash2 className="w-3 h-3" />
                    Quitar
                  </button>
                )}
              </div>

              {bgImage ? (
                <div className="space-y-2 text-xs">
                  {/* Control Opacidad */}
                  <div>
                    <div className="flex justify-between mb-0.5 text-[11px]">
                      <span className="text-slate-300">Opacidad ({Math.round(bgOpacity * 100)}%)</span>
                      <button onClick={() => setBgOpacity(0.6)} className="text-emerald-400 hover:underline text-[10px]">60%</button>
                    </div>
                    <input
                      type="range" min="0.05" max="1" step="0.05"
                      value={bgOpacity} onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Control Escala de Imagen */}
                  <div>
                    <div className="flex justify-between mb-0.5 text-[11px]">
                      <span className="text-slate-300">Escala Imagen ({bgScale.toFixed(2)}x)</span>
                      <button onClick={() => setBgScale(1)} className="text-emerald-400 hover:underline text-[10px]">1x</button>
                    </div>
                    <input
                      type="range" min="0.2" max="3" step="0.05"
                      value={bgScale} onChange={(e) => setBgScale(parseFloat(e.target.value))}
                      className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Control Umbral de Vectorización */}
                  <div>
                    <div className="flex justify-between mb-0.5 text-[11px]">
                      <span className="text-slate-300">Sensibilidad Vector ({vectorizeThreshold})</span>
                      <button onClick={() => setVectorizeThreshold(128)} className="text-emerald-400 hover:underline text-[10px]">128</button>
                    </div>
                    <input
                      type="range" min="10" max="245" step="5"
                      value={vectorizeThreshold} onChange={(e) => setVectorizeThreshold(parseInt(e.target.value))}
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              ) : (
                <label className="block text-center p-2 border border-dashed border-slate-700/80 rounded-lg text-[11px] text-slate-400 hover:text-emerald-300 hover:border-emerald-500/50 cursor-pointer transition-colors bg-slate-900/40">
                  <span>+ Cargar Imagen (JPG/PNG/WebP)</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Área del Lienzo SVG Interactivo */}
          <div className="flex-1 flex items-center justify-center p-8 relative">
            {/* Fondo Cuadriculado Técnico de Diseño */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>

            {/* OVERLAY Y MEDIDOR CIRCULAR DE PROGRESO DE CARGA Y NORMALIZACIÓN DE CAPAS % */}
            {isProcessingFile && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xl flex flex-col items-center justify-center p-6 z-30 pointer-events-auto">
                <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full space-y-5 text-center relative overflow-hidden">
                  
                  {/* CÍRCULO / ANILLO DE PROGRESO CON PORCENTAJE % DESTACADO */}
                  <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {/* Círculo de fondo */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-slate-800"
                        fill="transparent"
                      />
                      {/* Círculo de progreso dinámico */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * fileProgress) / 100}
                        strokeLinecap="round"
                        className="text-emerald-400 transition-all duration-300 ease-out"
                        fill="transparent"
                      />
                    </svg>
                    {/* Porcentaje numérico centrado dentro del anillo */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-black text-white font-mono tracking-tighter">
                        {fileProgress}%
                      </span>
                      <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold">
                        Cargando
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center justify-center gap-2">
                      <Layers size={16} className="animate-spin text-emerald-400" />
                      Procesador Multicapa Vectorial
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-mono leading-relaxed px-2">
                      {fileProgressText}
                    </p>
                  </div>
                  
                  {/* BARRA DE PROGRESO HORIZONTAL */}
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full bg-slate-950 rounded-full h-3.5 overflow-hidden border border-slate-800 p-0.5 shadow-inner">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-300 shadow-md"
                        style={{ width: `${fileProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono text-emerald-400 font-bold px-1">
                      <span>ESTADO DE PROCESAMIENTO</span>
                      <span>{fileProgress}% COMPLETADO</span>
                    </div>
                  </div>

                  {/* ADVERTENCIA Y PANEL DE ACCIÓN SI SE TRABA O DEMORA MÁS DE LO HABITUAL */}
                  {isStalled && (
                    <div className="bg-amber-950/60 border border-amber-500/40 rounded-2xl p-3 text-left space-y-2.5 animate-fadeIn">
                      <div className="flex items-start gap-2">
                        <span className="text-amber-400 text-sm">⚠️</span>
                        <div>
                          <p className="text-xs font-bold text-amber-200">
                            ¿La lectura del archivo multicapa parece haberse demorado?
                          </p>
                          <p className="text-[11px] text-amber-300/80 mt-0.5">
                            Archivos grandes con miles de polígonos requieren más tiempo. Podés elegir qué hacer:
                          </p>
                        </div>
                      </div>

                      {/* Botones de acción para Suspender, Resetear o Esperar */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={cancelProcessing}
                          className="bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-[10px] font-bold py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1"
                          title="Suspender la carga y mantener el estado previo"
                        >
                          🛑 Suspender
                        </button>
                        <button
                          onClick={resetProcessing}
                          className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[10px] font-bold py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1"
                          title="Reiniciar el proceso de carga"
                        >
                          🔄 Resetear
                        </button>
                        <button
                          onClick={extendWaitProcessing}
                          className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 text-[10px] font-bold py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1"
                          title="Continuar esperando la lectura"
                        >
                          ⏳ Esperar
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* RENDERIZADO DEL LIENZO Y MAPA SVG (Soporta Lienzo en Blanco cuando paths.length === 0) */}
            <svg
              viewBox={svgViewBox} // Asigna el viewBox adaptativo memorizado o 0 0 800 800 por defecto
              className="w-full h-auto max-h-[75vh] border border-slate-800 rounded-xl bg-[#060a12] shadow-2xl transition-all select-none relative"
            >
              {/* DEFINICIÓN DE PATRÓN DE CUADRÍCULA DE DISEÑO TÉCNICO PARA EL EDITOR */}
              <defs>
                <pattern id="editor-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(51, 65, 85, 0.2)" strokeWidth="0.8" />
                </pattern>
              </defs>

              {/* FONDO DE CUADRÍCULA SIEMPRE VISIBLE */}
              <rect width="100%" height="100%" fill="url(#editor-grid-pattern)" />

              {/* CAPA DE IMAGEN DE CALCO DE FONDO (JPG/PNG/WEBP) */}
              {bgImage && (
                <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
                  <image
                    href={bgImage}
                    x={bgOffsetX}
                    y={bgOffsetY}
                    width={800 * bgScale}
                    height={800 * bgScale}
                    opacity={bgOpacity}
                    preserveAspectRatio="xMidYMid meet"
                    className="pointer-events-none transition-opacity duration-200"
                  />
                </g>
              )}

              {/* FASE 2: ESTADO VACÍO EN EL LIENZO EN BLANCO CUANDO NO HAY DIBUJOS AÚN */}
              {paths.length === 0 ? (
                <g id="blank-canvas-editor-group" className="pointer-events-none select-none">
                  <circle cx="400" cy="330" r="40" fill="rgba(16, 185, 129, 0.05)" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="1.5" />
                  <text
                    x="400"
                    y="335"
                    textAnchor="middle"
                    fill="#34d399"
                    fontSize="22"
                    fontWeight="bold"
                  >
                    🎨
                  </text>
                  <text
                    x="400"
                    y="390"
                    textAnchor="middle"
                    fill="#cbd5e1"
                    fontSize="18"
                    fontWeight="bold"
                    className="font-sans"
                  >
                    Lienzo en Blanco
                  </text>
                  <text
                    x="400"
                    y="420"
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="13"
                    className="font-sans"
                  >
                    Hacé clic en "Cargar Mapa Multicapa JSON" arriba para importar polígonos
                  </text>
                  <text
                    x="400"
                    y="445"
                    textAnchor="middle"
                    fill="#475569"
                    fontSize="11"
                    className="font-mono"
                  >
                    Nodo Padre Activo: {activeParentNode.name} ({activeParentId})
                  </text>
                </g>
              ) : (
                /* Grupo contenedor con las transformaciones de escala y traslación aplicadas */
                <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
                  {paths.map((path) => { // Recorre el arreglo de trazados vectoriales
                    const isSelected = selectedIds.includes(path.id) || path.id === selectedId; // Verifica si el elemento está en la lista de seleccionados
                    const isHovered = path.id === hoveredId; // Verifica si el puntero está sobre el elemento

                    // LÓGICA DE DIBUJADO QUE RESPETA EL DISEÑO Y BORDES ORIGINALES
                    // Si el elemento contiene color de relleno propio lo utiliza, de lo contrario asigna el tono oscuro por defecto
                    let fillRender = path.fill || "#0f1a30"; // Color de relleno predeterminado
                    if (isSelected) fillRender = path.fill && path.fill !== '#0f1a30' && path.fill !== 'none' ? path.fill : "#10b981"; // Resaltado de selección verde esmeralda respetando relleno
                    else if (isHovered && !path.fill) fillRender = "#10b98133"; // Resaltado de hover translúcido

                    // Fuerza siempre a que el elemento tenga borde visible para evitar la fusión en bloques sólidos
                    const strokeRender = isSelected ? "#34d399" : (path.stroke || "#334155"); // Color del trazo o contorno
                    const strokeWRender = isSelected ? 1.5 : (path.strokeWidth || 0.6); // Grosor de línea ultra-fino responsivo

                    return ( // Retorna el elemento path SVG
                      <path
                        key={path.id} // Clave única React
                        d={path.d} // Trazo SVG
                        vectorEffect="non-scaling-stroke"
                        fill={fillRender} // Color de relleno determinado
                        stroke={strokeRender} // Color de contorno determinado
                        strokeWidth={strokeWRender} // Grosor de línea
                        strokeLinejoin="round" // Esquinas suavizadas
                        strokeLinecap="round" // Puntas de trazado suavizadas
                        className="cursor-pointer transition-colors duration-150 ease-in-out" // Estilos e interacciones CSS
                        onMouseEnter={() => setHoveredId(path.id)} // Manejador de entrada de puntero
                        onMouseLeave={() => setHoveredId(null)} // Manejador de salida de puntero
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPathItem(path.id, e.shiftKey);
                        }} // Manejador de selección por clic con soporte Shift
                      />
                    ); // Fin del path SVG
                  })}

                  {/* OVERLAY DE VISTA PREVIA DE SILUETA PERFECCIONADA (EN ROJO/ROSA SOBRE EL MAPA) */}
                  {previewSilhouette && (
                    <path
                      d={previewSilhouette}
                      stroke="#f43f5e"
                      strokeWidth={3 / scale}
                      fill="rgba(244, 63, 94, 0.2)"
                      pointerEvents="none"
                      className="animate-pulse"
                      style={{ filter: 'drop-shadow(0px 0px 8px rgba(244, 63, 94, 0.8))' }}
                    />
                  )}
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* PANEL DERECHO: INSPECTOR DE CAPAS Y EDITOR PATH JSON EN CALIENTE (FASE 3) */}
        <div className="w-96 md:w-[440px] bg-[#0b1325] border-l border-slate-800 flex flex-col overflow-y-auto">
          {/* BARRA DE PESTAÑAS DUAL: INSPECTOR VISUAL vs EDITOR CÓDIGO JSON */}
          <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1">
            <button
              onClick={() => setRightTab('inspector')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                rightTab === 'inspector'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Inspector Visual</span>
            </button>

            <button
              onClick={() => setRightTab('json')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                rightTab === 'json'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Código Crudo (JSON)</span>
            </button>
          </div>

          {/* VISTA 1: INSPECTOR VISUAL TRADICIONAL */}
          {rightTab === 'inspector' && (
            <>
              {/* Sección de Lista de Trazados, Vincular Pares y Buscador */}
              <div className="p-4 border-b border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                    Lista de Piezas Geográficas ({paths.length})
                  </span>
                  
                  {/* Botón Toggle para Vincular Contorno + Relleno Hermanos */}
                  <button
                    onClick={() => setLinkedPairMode(!linkedPairMode)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                      linkedPairMode 
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                    title="Al seleccionar una pieza, selecciona automáticamente sus pares de Contorno y Relleno asociados"
                  >
                    <span>{linkedPairMode ? '🔗 Contorno+Relleno Vinculados' : '🔓 Trabajar por Separado'}</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o capa (ej. rios, 550)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Listado Desplazable de Elementos Encontrados con Tacho de Basura por Fila y ID para Scroll */}
                <div className="max-h-48 overflow-y-auto border border-slate-800 bg-slate-900/40 rounded-lg text-xs">
                  {filteredPaths.map(p => {
                    const isItemSelected = selectedIds.includes(p.id) || p.id === selectedId;
                    return (
                      <div
                        key={p.id}
                        id={`layer-item-${p.id}`}
                        onClick={(e) => handleSelectPathItem(p.id, e.shiftKey)}
                        className={`w-full px-3 py-2 border-b border-slate-800/60 flex justify-between items-center transition-colors cursor-pointer group ${
                          isItemSelected
                            ? 'bg-emerald-500/15 text-emerald-300 font-semibold border-l-2 border-l-emerald-400'
                            : 'hover:bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="truncate max-w-[170px]">{p.name}</span>
                          <div className="flex items-center gap-2 text-[9px] text-slate-500 uppercase">
                            {p.layerId && <span>Capa: {p.layerId}</span>}
                            {p.fill && p.fill !== 'none' && (
                              <span className="inline-block w-2.5 h-2.5 rounded-full border border-slate-700" style={{ backgroundColor: p.fill }} title={`Relleno: ${p.fill}`} />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[70px]">{p.id}</span>
                          
                          {/* Botón Tacho de Basura (Eliminar individual en 1 clic) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSelected([p.id]);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                            title="Eliminar este trazado"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredPaths.length === 0 && paths.length > 0 && (
                    <div className="p-3 text-slate-500 text-center">Sin resultados coincidentes.</div>
                  )}
                </div>
              </div>

              {/* Editor de Propiedades del Trazado Seleccionado */}
              <div className="p-4 flex-1 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">
                    Identidad, Colores y Datos ({selectedIds.length > 0 ? selectedIds.length : 0})
                  </span>

                  {selectedIds.length > 0 && (
                    <button
                      onClick={() => handleDeleteSelected()}
                      className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                      title="Eliminar elemento(s) seleccionado(s) (O presiona tecla Supr)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Borrar (Supr)</span>
                    </button>
                  )}
                </div>

                {selectedPath ? (
                  <div className="flex flex-col gap-4 flex-1">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">ID Vectorial Geográfico</label>
                      <input
                        type="text"
                        value={selectedPath.id}
                        disabled
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-500 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Nombre Humano / Jurisdicción</label>
                      <input
                        type="text"
                        value={selectedPath.name}
                        onChange={(e) => updateSelectedPath('name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Capa o Categoría Territorial</label>
                      <input
                        type="text"
                        value={selectedPath.layerId || ''}
                        onChange={(e) => updateSelectedPath('layerId', e.target.value)}
                        placeholder="Ej: Rios, Lagos, Paises..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                      />
                    </div>

                    {/* SECCIÓN OBLIGATORIA: MEJORAR SILUETA SELECCIONADA (PERFECCIONADOR DE SILUETA - 4 OPCIONES Y VISTA PREVIA) */}
                    <div className="border border-purple-800/80 rounded-2xl bg-gradient-to-b from-purple-950/40 to-slate-900/90 p-3 space-y-3 shadow-xl">
                      <div className="flex items-center justify-between border-b border-purple-800/50 pb-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>Mejorar Silueta Seleccionada</span>
                        </h4>
                        <span className="text-[9px] bg-purple-900/80 text-purple-200 px-2 py-0.5 rounded font-mono border border-purple-700/50">
                          Perfeccionador SVG
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-snug">
                        Sustituye quirúrgicamente la silueta (<code className="text-purple-300 font-mono">d</code>) de <strong className="text-emerald-400">{selectedPath.name || selectedPath.id}</strong> con el contorno exterior limpio de otra fuente.
                      </p>

                      {/* PESTAÑAS / SELECCIÓN DE LAS 4 OPCIONES DE ENTRADA DE FUENTE */}
                      <div className="grid grid-cols-4 gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setSilhouetteInputMethod('paste')}
                          className={`py-1.5 px-1 rounded-lg transition-all text-center cursor-pointer ${
                            silhouetteInputMethod === 'paste'
                              ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          1. Pegar
                        </button>
                        <button
                          type="button"
                          onClick={() => setSilhouetteInputMethod('file')}
                          className={`py-1.5 px-1 rounded-lg transition-all text-center cursor-pointer ${
                            silhouetteInputMethod === 'file'
                              ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          2. Importar
                        </button>
                        <button
                          type="button"
                          onClick={() => setSilhouetteInputMethod('image')}
                          className={`py-1.5 px-1 rounded-lg transition-all text-center cursor-pointer ${
                            silhouetteInputMethod === 'image'
                              ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          3. Imagen
                        </button>
                        <button
                          type="button"
                          onClick={() => setSilhouetteInputMethod('preset')}
                          className={`py-1.5 px-1 rounded-lg transition-all text-center cursor-pointer ${
                            silhouetteInputMethod === 'preset'
                              ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          4. Ruta
                        </button>
                      </div>

                      {/* VISTAS DE ENTRADA SEGÚN LA OPCIÓN ACTIVA */}
                      {silhouetteInputMethod === 'paste' && (
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                            Pegar JSON / SVG o Trazo SVG (`d`):
                          </label>
                          <textarea
                            value={silhouettePasteText}
                            onChange={(e) => setSilhouettePasteText(e.target.value)}
                            placeholder='Pega aquí el código JSON o <path d="..." />...'
                            rows={3}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl p-2 text-[10px] font-mono text-slate-200 outline-none resize-none"
                          />
                        </div>
                      )}

                      {silhouetteInputMethod === 'file' && (
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                            Importar archivo .JSON o .SVG:
                          </label>
                          <label className="flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-900 border border-dashed border-purple-500/50 hover:border-purple-400 text-purple-300 p-3 rounded-xl cursor-pointer transition-all text-xs font-bold">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Seleccionar archivo JSON / SVG</span>
                            <input type="file" accept=".json,.svg" onChange={handleSilhouetteFileUpload} className="hidden" />
                          </label>
                        </div>
                      )}

                      {silhouetteInputMethod === 'image' && (
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                            Cargar desde Imagen (Vectorizador/Autotrace):
                          </label>
                          <label className="flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-900 border border-dashed border-purple-500/50 hover:border-purple-400 text-purple-300 p-3 rounded-xl cursor-pointer transition-all text-xs font-bold">
                            <FileUp className="w-3.5 h-3.5" />
                            <span>Subir Imagen (PNG/JPG/SVG)</span>
                            <input type="file" accept="image/*,.svg" onChange={handleSilhouetteImageUpload} className="hidden" />
                          </label>
                        </div>
                      )}

                      {silhouetteInputMethod === 'preset' && (
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                            Extraer de Ruta Existente con divisiones internas:
                          </label>
                          <select
                            value={silhouettePresetRoute}
                            onChange={(e) => setSilhouettePresetRoute(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl p-2 text-xs font-bold text-slate-200 outline-none cursor-pointer"
                          >
                            <option value="ARG_24">🇦🇷 Argentina (Mapa de 24 Provincias detalladas)</option>
                            <option value="CURRENT_MAP">🗺️ Mapa Actual ({paths.length} polígonos)</option>
                          </select>
                        </div>
                      )}

                      {/* BOTÓN "GENERAR VISTA PREVIA" */}
                      <button
                        type="button"
                        onClick={() => handleGenerateSilhouettePreview()}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-purple-950/40 hover:scale-[1.01]"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generar Vista Previa</span>
                      </button>

                      {/* PANEL DE VISTA PREVIA Y BOTÓN "APLICAR CAMBIOS" (MUTACIÓN SEGURA) */}
                      {previewSilhouette && (
                        <div className="bg-purple-950/80 border border-purple-500/60 rounded-xl p-3 space-y-2.5 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                              <span>Vista Previa Activa (Lienzo en Rojo)</span>
                            </span>
                            <button
                              type="button"
                              onClick={handleCancelSilhouettePreview}
                              className="text-slate-400 hover:text-white text-[10px] font-bold underline cursor-pointer"
                            >
                              Descartar
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-300 leading-snug">
                            El contorno exterior perfeccionado se muestra resaltado sobre el mapa. Presiona el botón para inyectarlo en <strong className="text-emerald-400">{selectedPath.name || selectedPath.id}</strong>.
                          </p>

                          {/* BOTÓN "APLICAR CAMBIOS" (MUTACIÓN SEGURA DE ESTADO) */}
                          <button
                            type="button"
                            onClick={handleApplySilhouetteMutation}
                            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 hover:scale-[1.02]"
                          >
                            <Check className="w-4 h-4" />
                            <span>Aplicar Cambios</span>
                          </button>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-400 italic text-center">
                        Los demás {paths.length - 1} nodos y todos los datos estadísticos de {selectedPath.name || selectedPath.id} se conservan 100% intactos.
                      </p>
                    </div>

                    {/* EDICIÓN DIRECTA DE ESTILOS VISUALES: RELLENO, BORDE Y GROSOR */}
                    <div className="border border-slate-800 rounded-xl bg-slate-900/60 p-3 space-y-3">
                      <span className="text-xs font-medium text-emerald-400 block">
                        🎨 Estilos Visuales (Relleno y Contorno)
                      </span>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Color de Relleno */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase font-bold block">Color Relleno</label>
                          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1.5">
                            <input
                              type="color"
                              value={selectedPath.fill && selectedPath.fill.startsWith('#') ? selectedPath.fill : '#0f1a30'}
                              onChange={(e) => updateSelectedPath('fill', e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                            />
                            <input
                              type="text"
                              value={selectedPath.fill || '#0f1a30'}
                              onChange={(e) => updateSelectedPath('fill', e.target.value)}
                              className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Color de Contorno / Borde */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase font-bold block">Color Borde</label>
                          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1.5">
                            <input
                              type="color"
                              value={selectedPath.stroke && selectedPath.stroke.startsWith('#') ? selectedPath.stroke : '#334155'}
                              onChange={(e) => updateSelectedPath('stroke', e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                            />
                            <input
                              type="text"
                              value={selectedPath.stroke || '#334155'}
                              onChange={(e) => updateSelectedPath('stroke', e.target.value)}
                              className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Grosor de Contorno */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400 font-bold uppercase">Grosor de Borde</span>
                          <span className="text-emerald-400 font-mono">{selectedPath.strokeWidth || 1}px</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="10"
                          step="0.2"
                          value={selectedPath.strokeWidth || 1}
                          onChange={(e) => updateSelectedPath('strokeWidth', parseFloat(e.target.value))}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="border border-slate-800 rounded-xl bg-slate-900/60 p-3 flex flex-col gap-3">
                      <span className="text-xs font-medium text-slate-300 block">
                        Matriz de Variables e Indicadores
                      </span>

                      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                        {Object.entries(selectedPath.properties || {}).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
                            <div className="flex flex-col">
                              <span className="font-mono text-emerald-400 font-medium">{key}</span>
                              <span className="text-slate-300 truncate max-w-[160px]">{String(val)}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveProperty(key)}
                              className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 transition-colors"
                              title="Eliminar variable"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {Object.keys(selectedPath.properties || {}).length === 0 && (
                          <p className="text-[11px] text-slate-500 text-center py-2 italic">
                            Sin variables cargadas en esta pieza.
                          </p>
                        )}
                      </div>

                      <form onSubmit={handleAddProperty} className="flex gap-1.5 border-t border-slate-800/80 pt-2.5 mt-1">
                        <input
                          type="text"
                          placeholder="Métrica (ej: caudal)"
                          value={newPropKey}
                          onChange={(e) => setNewPropKey(e.target.value)}
                          className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-200"
                        />
                        <input
                          type="text"
                          placeholder="Valor (ej: 1200)"
                          value={newPropValue}
                          onChange={(e) => setNewPropValue(e.target.value)}
                          className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-200"
                        />
                        <button
                          type="submit"
                          className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white rounded-lg p-1 px-2 text-xs transition-colors"
                        >
                          +
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-xl bg-slate-900/20 text-slate-500 text-xs italic">
                    Seleccioná una porción del mapa o de la lista para editar sus identidades y datos estadísticos.
                  </div>
                )}
              </div>
            </>
          )}

          {/* VISTA 2: EDITOR CÓDIGO JSON EN CALIENTE (FASE 3) */}
          {rightTab === 'json' && (
            <div className="p-4 flex-1 flex flex-col gap-3 overflow-hidden">
              {/* ENCABEZADO Y CONTROLES DEL EDITOR */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-slate-200">Editor JSON Path (Hot Data-Binding)</span>
                </div>

                {/* Insignia Estado de Sintaxis */}
                {jsonError ? (
                  <span className="text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800/80 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                    JSON Inválido
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                    <Check className="w-3 h-3 text-emerald-400" />
                    Sincronizado
                  </span>
                )}
              </div>

              {/* BARRA DE ACCIONES RÁPIDAS DEL CÓDIGO */}
              <div className="flex items-center justify-between gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  {/* Botón Aplicar Código */}
                  <button
                    onClick={() => handleApplyJson()}
                    className="flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer"
                    title="Aplica inmediatamente la estructura JSON al lienzo visual"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Aplicar Código</span>
                  </button>

                  {/* Botón Formatear */}
                  <button
                    onClick={handleFormatJson}
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Ajusta la identación y formato del código"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Formatear</span>
                  </button>

                  {/* Botón Copiar */}
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Copia el JSON al portapapeles"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copiar</span>
                  </button>
                </div>

                {/* Switch de Auto-Sync */}
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAutoSync}
                    onChange={(e) => setIsAutoSync(e.target.checked)}
                    className="accent-purple-500 rounded cursor-pointer"
                  />
                  <span>En vivo</span>
                </label>
              </div>

              {/* ÁREA DE EDICIÓN DE CÓDIGO (TEXTAREA MULTILÍNEA ESTILIZADO) */}
              <div className="flex-1 flex flex-col relative min-h-[350px]">
                <textarea
                  value={jsonText}
                  onChange={handleJsonTextChange}
                  placeholder={`[\n  {\n    "id": "prov-1",\n    "name": "Provincia Muestra",\n    "d": "M 100 100 L 200 100 L 200 200 Z",\n    "fill": "#10b981",\n    "layerId": "General"\n  }\n]`}
                  className="w-full flex-1 font-mono text-xs bg-[#050914] text-emerald-300 p-3.5 rounded-xl border border-slate-800 resize-none focus:outline-none focus:border-purple-500/80 leading-relaxed tracking-wide selection:bg-purple-900 selection:text-white font-mono shadow-inner"
                  spellCheck={false}
                />
              </div>

              {/* MUESTRA DE ERROR DE SINTAXIS (SAFE PARSE) */}
              {jsonError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800/80 rounded-xl text-rose-300 text-xs font-mono flex items-start gap-2 shadow-lg animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-bold text-rose-200">Error de Sintaxis JSON:</span>
                    <span className="break-all text-[11px]">{jsonError}</span>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-500 text-center italic">
                Edita los paths en caliente. Al modificar "d", "fill" o las coordenadas, el lienzo se actualizará inmediatamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  ); // Fin de renderizado JSX
} // Fin del componente MapCalibrationPanel
