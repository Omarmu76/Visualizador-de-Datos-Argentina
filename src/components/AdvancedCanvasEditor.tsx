/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'; // Imports fundamentales de React
import { useSearchParams } from 'react-router-dom'; // Para leer parámetros de consulta URL como ?parentId=...
import { 
  Move, Maximize2, Lock, Unlock, Trash2, Edit3, Scissors, Layers, 
  Upload, Download, Shield, ShieldCheck, ShieldAlert, Check, RefreshCw, 
  Plus, Eye, EyeOff, Save, Copy, FileCode, CornerDownRight, ZoomIn, ZoomOut, ArrowLeft,
  FileUp, Sparkles, MapPin
} from 'lucide-react'; // Íconos Lucide para la interfaz tipo Figma
import { VectorPathItem, VectorMapEntity, UserRole, UserProfile, ProvinceData } from '../types'; // Interfaces de TypeScript
import { safeSetItem, safeGetItem } from '../lib/storage'; // Funciones de almacenamiento seguro
import { getPathBBox, getMultiplePathsBBox } from '../lib/mapUtils'; // Calculadoras de Bounding Box
import { provincePaths } from '../data/provincePaths'; // Moldes nativos vectoriales de la República Argentina (REGLA INTOCABLE)

// Interfaz que define las propiedades que recibe el Súper Editor de Espacios Vectoriales
interface AdvancedCanvasEditorProps {
  currentUser: UserProfile; // Usuario actual con su rol RBAC (guest, pro, admin)
  selectedProvince?: ProvinceData; // Provincia activa seleccionada en la app
  onUpdateProvince?: (prov: ProvinceData) => void; // Disparador para guardar cambios en la app pública
  allProvinces?: Record<string, ProvinceData>; // Diccionario de provincias cargadas
  onSaveMapEntity?: (entity: VectorMapEntity) => void; // Callback ejecutado al guardar/aprobar un mapa
}

// Auxiliar: Convierte coordenadas de anillos GeoJSON a trazados de comando SVG 'd'
const geoJsonCoordsToSvgPath = (type: string, coordinates: any[]): string => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) return '';
  
  // Detecta si las coordenadas son lat/long geográficas (lat entre -90 y 90) o espacio de píxeles en pantalla (y > 90)
  let isGeoLatLong = true;
  const sampleRing = type === 'Polygon' ? coordinates[0] : (type === 'MultiPolygon' ? coordinates[0]?.[0] : coordinates);
  if (Array.isArray(sampleRing) && sampleRing.length > 0) {
    const firstPt = sampleRing[0];
    if (Array.isArray(firstPt) && firstPt.length >= 2) {
      if (Math.abs(firstPt[1]) > 90) {
        // Píxeles de pantalla: NO invertir el eje Y
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
    const points = coordinates.map(formatPt).filter(Boolean).join(' ');
    return points;
  }

  if (type === 'MultiLineString') {
    return coordinates.map(line => geoJsonCoordsToSvgPath('LineString', line)).filter(Boolean).join(' ');
  }

  return '';
};

// Auxiliar: Convierte la propiedad 'points' de un elemento <polygon> o <polyline> a comandos 'd' SVG
const polygonPointsToSvgPath = (pointsStr: string): string => {
  if (!pointsStr) return '';
  const pts = pointsStr.trim().split(/\s+|,/);
  const coords: string[] = [];
  for (let i = 0; i < pts.length - 1; i += 2) {
    if (pts[i] && pts[i+1]) {
      coords.push(`${coords.length === 0 ? 'M' : 'L'} ${pts[i]} ${pts[i+1]}`);
    }
  }
  return coords.length > 0 ? `${coords.join(' ')} Z` : '';
};

// FUNCIÓN SANITIZADORA PARA CONVERTIR EXPORTACIONES JS/TS O TEXTO CON COMENTARIOS A JSON PURO
const sanitizeJsonString = (rawContent: string): string => {
  if (!rawContent) return '';
  let cleaned = rawContent.trim();

  // 1. Remueve comentarios multilinea /* ... */ y de una sola linea // ...
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/\/\/.*/g, '');

  // 2. Remueve asignaciones e importaciones iniciales de JS/TS (ej: import ..., const data =, export default)
  cleaned = cleaned.replace(/^import\s+[\s\S]*?;\s*/gi, '');
  cleaned = cleaned.replace(/^(?:export\s+default\s+|const\s+[\w$]+(?::\s*[^=]+)?\s*=\s*|var\s+[\w$]+\s*=\s*|let\s+[\w$]+\s*=\s*|module\.exports\s*=\s*)/i, '');

  // 3. Remueve punto y coma final e instrucciones export default finales
  cleaned = cleaned.replace(/(?:;\s*export\s+default\s+[\w$]+;?|;\s*module\.exports\s*=\s*[\w$]+;?|;?\s*)$/i, '');

  cleaned = cleaned.trim();

  // 4. Extrae la estructura JSON principal desde el primer { o [ hasta el último } o ]
  const firstBrace = cleaned.search(/[\{\[]/);
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return cleaned;
};

// Auxiliar: Parser inteligente con asistencia de IA universal para estructurar SVG, GeoJSON, JS/TSX o JSON raw
const parseVectorContentWithAI = (
  content: string,
  fileName: string,
  ownerId: string,
  level: string
): { paths: VectorPathItem[]; title?: string } => {
  const trimmed = content.trim();
  const sanitized = sanitizeJsonString(content);
  let importedPaths: VectorPathItem[] = [];
  let detectedTitle = '';

  // Helper para normalizar cualquier elemento en VectorPathItem preservando todos sus metadatos y estilos
  const normalizePathItem = (item: any, idx: number, defaultLayer?: string): VectorPathItem | null => {
    if (!item || typeof item !== 'object') return null;

    let pathD = item.d || item.path || item.svgPath || '';
    if (!pathD && item.geometry) {
      if (typeof item.geometry === 'string') {
        pathD = item.geometry;
      } else if (item.geometry.coordinates) {
        if (item.properties && item.properties.d) {
          pathD = item.properties.d;
        } else {
          pathD = geoJsonCoordsToSvgPath(item.geometry.type, item.geometry.coordinates);
        }
      }
    }

    if (!pathD || typeof pathD !== 'string' || pathD.trim().length === 0) return null;

    const props = item.properties || item.customData || {};
    const id = String(item.id || props.id || props.ISO_A2 || props.id_0 || `PATH-${idx + 1}`);
    const name = String(item.name || item.title || item.label || item.nombre || props.name || props.NAME || props.nombre || props.NAME_1 || props.ADMIN || props.STATE_NAME || `Trazado ${idx + 1}`);
    const category = String(item.layer || item.layerId || item.category || props.layer || props.category || defaultLayer || level || 'provincia');
    
    const fill = item.fill || item.fillColor || item.visualStyles?.fillColor || props.fill || props.fillColor;
    const stroke = item.stroke || item.strokeColor || item.visualStyles?.strokeColor || props.stroke || props.strokeColor;
    const strokeWidth = item.strokeWidth || item['stroke-width'] || item.visualStyles?.strokeWidth || props.strokeWidth || props['stroke-width'];

    return {
      id,
      name,
      d: pathD.trim(),
      category,
      ownerId,
      visualStyles: {
        fillColor: fill,
        strokeColor: stroke,
        strokeWidth: typeof strokeWidth === 'number' ? strokeWidth : (strokeWidth ? Number(strokeWidth) : undefined)
      },
      customData: {
        fill,
        stroke,
        strokeWidth,
        layer: category,
        ...props
      }
    };
  };

  // RECURSIVE EXTRACTOR: Explora cualquier árbol de datos JS/TS/JSON
  const extractFromObject = (obj: any, currentLayer?: string) => {
    if (!obj) return;

    if (Array.isArray(obj)) {
      obj.forEach((child, i) => extractFromObject(child, currentLayer));
      return;
    }

    if (typeof obj === 'object') {
      // 1. GeoJSON FeatureCollection
      if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
        if (obj.name) detectedTitle = obj.name;
        obj.features.forEach((feat: any) => {
          const norm = normalizePathItem(feat, importedPaths.length, currentLayer);
          if (norm) importedPaths.push(norm);
        });
        return;
      }

      // 2. Elemento individual con trazado
      if (obj.d || obj.path || (obj.type === 'Feature' && (obj.geometry || obj.properties?.d))) {
        const norm = normalizePathItem(obj, importedPaths.length, currentLayer);
        if (norm) {
          importedPaths.push(norm);
          return;
        }
      }

      // 3. Diccionarios por Capas (Format 2 Componente TSX Record<string, Array<...>>) u objetos contenedores
      const layerName = obj.layer || obj.layerId || obj.name || obj.id || currentLayer;
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (Array.isArray(val)) {
          const effectiveLayer = (key !== 'paths' && key !== 'features' && key !== 'children' && key !== 'layers' && key !== 'groups') ? key : layerName;
          extractFromObject(val, effectiveLayer);
        } else if (typeof val === 'object' && val !== null && key !== 'properties' && key !== 'customData' && key !== 'visualStyles') {
          extractFromObject(val, layerName);
        }
      }
    }
  };

  // 1. INTENTAR PARSEAR COMO ESTRUCTURA JSON / JS
  const jsonToParse = sanitized.length > 0 ? sanitized : trimmed;
  if (jsonToParse.startsWith('{') || jsonToParse.startsWith('[')) {
    try {
      const parsed = JSON.parse(jsonToParse);
      extractFromObject(parsed);
    } catch (e) {
      console.warn("Error en parseo JSON directo, intentando por expresiones regulares / SVG...", e);
    }
  }

  // 2. SI NO SE HALLARON POLÍGONOS, PROBAR CON EXPRESIONES REGULARES JS/TSX
  if (importedPaths.length === 0) {
    const jsObjRegex = /\{\s*["']?id["']?\s*:\s*["']([^"']+)["'][\s\S]*?["']?d["']?\s*:\s*["']([^"']+)["'][\s\S]*?\}/gi;
    const jsMatches = [...trimmed.matchAll(jsObjRegex)];
    if (jsMatches.length > 0) {
      jsMatches.forEach((m, idx) => {
        const fullBlock = m[0];
        const idMatch = fullBlock.match(/["']?id["']?\s*:\s*["']([^"']+)["']/i);
        const nameMatch = fullBlock.match(/["']?(?:name|title|label|nombre)["']?\s*:\s*["']([^"']+)["']/i);
        const dMatch = fullBlock.match(/["']?d["']?\s*:\s*["']([^"']+)["']/i);
        const fillMatch = fullBlock.match(/["']?fill["']?\s*:\s*["']([^"']+)["']/i);
        const strokeMatch = fullBlock.match(/["']?stroke["']?\s*:\s*["']([^"']+)["']/i);
        const layerMatch = fullBlock.match(/["']?(?:layer|layerId|category)["']?\s*:\s*["']([^"']+)["']/i);

        if (dMatch && dMatch[1]) {
          const fill = fillMatch ? fillMatch[1] : undefined;
          const stroke = strokeMatch ? strokeMatch[1] : undefined;
          const layer = layerMatch ? layerMatch[1] : level || 'provincia';
          importedPaths.push({
            id: idMatch ? idMatch[1] : `JS-PATH-${idx + 1}`,
            name: nameMatch ? nameMatch[1] : `Trazado ${idx + 1}`,
            d: dMatch[1],
            category: layer,
            ownerId,
            visualStyles: { fillColor: fill, strokeColor: stroke },
            customData: { fill, stroke, layer }
          });
        }
      });
    }
  }

  // 3. EXTRAER ETIQUETAS SVG COMPLETA (<path d="...">, <polygon points="...">)
  if (importedPaths.length === 0) {
    const pathRegex = /<path[^>]*d=["']([^"']+)["'][^>]*>/gi;
    const pathMatches = [...trimmed.matchAll(pathRegex)];
    if (pathMatches.length > 0) {
      pathMatches.forEach((m, idx) => {
        const fullTag = m[0];
        const idMatch = fullTag.match(/(?:id|data-id)=["']([^"']+)["']/i);
        const nameMatch = fullTag.match(/(?:title|name|data-name|inkscape:label)=["']([^"']+)["']/i);
        const fillMatch = fullTag.match(/fill=["']([^"']+)["']/i);
        const strokeMatch = fullTag.match(/stroke=["']([^"']+)["']/i);
        const strokeWidthMatch = fullTag.match(/stroke-width=["']([^"']+)["']/i);
        const layerMatch = fullTag.match(/(?:data-layer|layer)=["']([^"']+)["']/i);
        const propsMatch = fullTag.match(/data-properties=["']([^"']+)["']/i);

        let parsedProps = {};
        if (propsMatch && propsMatch[1]) {
          try {
            parsedProps = JSON.parse(propsMatch[1]);
          } catch {}
        }

        const fill = fillMatch ? fillMatch[1] : undefined;
        const stroke = strokeMatch ? strokeMatch[1] : undefined;
        const strokeWidth = strokeWidthMatch ? Number(strokeWidthMatch[1]) : undefined;
        const layer = layerMatch ? layerMatch[1] : level || 'provincia';

        importedPaths.push({
          id: idMatch ? idMatch[1] : `SVG-PATH-${idx + 1}`,
          name: nameMatch ? nameMatch[1] : `Trazado SVG ${idx + 1}`,
          d: m[1],
          category: layer,
          ownerId,
          visualStyles: {
            fillColor: fill,
            strokeColor: stroke,
            strokeWidth
          },
          customData: {
            fill,
            stroke,
            strokeWidth,
            layer,
            ...parsedProps
          }
        });
      });
    }

    const polyRegex = /<polygon[^>]*points=["']([^"']+)["'][^>]*>/gi;
    const polyMatches = [...trimmed.matchAll(polyRegex)];
    if (polyMatches.length > 0) {
      polyMatches.forEach((m, idx) => {
        const fullTag = m[0];
        const idMatch = fullTag.match(/id=["']([^"']+)["']/i);
        const nameMatch = fullTag.match(/(?:title|name|inkscape:label)=["']([^"']+)["']/i);
        const convertedD = polygonPointsToSvgPath(m[1]);
        if (convertedD) {
          importedPaths.push({
            id: idMatch ? idMatch[1] : `SVG-POLY-${idx + 1}`,
            name: nameMatch ? nameMatch[1] : `Polígono SVG ${idx + 1}`,
            d: convertedD,
            category: level || 'provincia',
            ownerId
          });
        }
      });
    }
  }

  return { paths: importedPaths, title: detectedTitle || fileName.replace(/\.[^/.]+$/, "") };
};

// Función auxiliar para construir el mapa contextual en base al nivel activo y la región seleccionada
const getInitialContextualMap = (
  province?: ProvinceData,
  urlParentId?: string | null
): VectorMapEntity => {
  // 1. Si la provincia seleccionada tiene municipios con vectores SVG definidos, los carga directamente
  if (province && province.municipalities && province.municipalities.length > 0) {
    const validSubs = province.municipalities.filter(m => m.d && m.d.trim().length > 0);
    if (validSubs.length > 0) {
      return {
        id: `map-${province.id.toLowerCase()}`,
        title: `Municipios y Terrenos - ${province.name}`,
        level: 'provincia',
        parentId: province.id,
        ownerId: 'system',
        isApproved: true,
        paths: validSubs.map(m => ({
          id: m.id,
          name: m.name,
          d: m.d!,
          category: 'municipio',
          ownerId: 'system'
        })),
        transform: {
          scale: province.mapTransform?.scale || 1,
          translateX: province.mapTransform?.panX || 0,
          translateY: province.mapTransform?.panY || 0,
          aspectRatioLocked: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  // 2. Si es EXPLICITAMENTE Argentina o nivel País / Nacional, carga automáticamente los 24 trazos nativos de provincePaths.ts
  if (province && (province.id === 'country' || province.id === 'AR' || province.id === 'ARGENTINA')) {
    return {
      id: 'map-argentina-nativa',
      title: 'Mapa Vectorial Nativo de la República Argentina (24 Provincias)',
      level: 'pais',
      parentId: 'WORLD',
      ownerId: 'system',
      isApproved: true,
      paths: provincePaths.map(p => ({
        id: p.id,
        name: p.name,
        d: p.d,
        category: 'provincia',
        ownerId: 'system'
      })),
      transform: {
        scale: 1,
        translateX: 0,
        translateY: 0,
        aspectRatioLocked: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // 3. Si es una provincia argentina individual (ej: AR-B) sin municipios definidos, busca su contorno en provincePaths.ts
  if (province) {
    const foundOutline = provincePaths.find(p => p.id === province.id || p.name.toLowerCase() === province.name.toLowerCase());
    if (foundOutline) {
      return {
        id: `map-silueta-${province.id.toLowerCase()}`,
        title: `Silueta y Contorno - ${province.name}`,
        level: 'provincia',
        parentId: province.id,
        ownerId: 'system',
        isApproved: true,
        paths: [{
          id: foundOutline.id,
          name: foundOutline.name,
          d: foundOutline.d,
          category: 'provincia',
          ownerId: 'system'
        }],
        transform: {
          scale: 1,
          translateX: 0,
          translateY: 0,
          aspectRatioLocked: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  // 4. Para cualquier otra región o vista por defecto, hereda automáticamente los 24 trazados nativos de provincePaths.ts
  return {
    id: `map-nuevo-${province ? province.id.toLowerCase() : 'argentina'}`,
    title: `Lienzo Vectorial - ${province ? province.name : 'Argentina (24 Provincias)'}`,
    level: province ? (province.id === 'WORLD_MAP' ? 'mundo' : province.id === 'CONTINENT_MAP' ? 'continente' : 'pais') : 'pais',
    parentId: urlParentId || 'WORLD',
    ownerId: 'system',
    isApproved: true,
    paths: provincePaths.map(p => ({
      id: p.id,
      name: p.name,
      d: p.d,
      category: 'provincia',
      ownerId: 'system'
    })),
    transform: {
      scale: 1,
      translateX: 0,
      translateY: 0,
      aspectRatioLocked: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

// COMPONENTE PRINCIPAL DEL SÚPER EDITOR CANVAS
export default function AdvancedCanvasEditor({
  currentUser,
  selectedProvince,
  onUpdateProvince,
  allProvinces,
  onSaveMapEntity
}: AdvancedCanvasEditorProps) {
  const [searchParams] = useSearchParams(); // Permite leer ?parentId=... de la URL
  const urlParentId = searchParams.get('parentId'); // Obtiene la referencia superior enviada en la URL

  // ESTADO DEL MAPA VECTORIAL EN EDICIÓN CON HERENCIA CONTEXTUAL
  const [mapEntity, setMapEntity] = useState<VectorMapEntity>(() => {
    // Intenta cargar el mapa específico guardado para esta región
    const provKey = selectedProvince?.id || 'country';
    const saved = safeGetItem(`argentina_advanced_canvas_map_${provKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.paths)) {
          if (urlParentId) {
            parsed.parentId = urlParentId; // Aplica la referencia de la URL si existe
          }
          return parsed;
        }
      } catch (e) {
        console.error("Error al des-serializar mapa cargado:", e);
      }
    }

    // Retorna el mapa contextual correspondiente a la provincia/región activa
    return getInitialContextualMap(selectedProvince, urlParentId);
  });

  // ESTADO DE APERTURA DE PANELES MODALES Y TEXTO CÓDIGO JSON EN CALIENTE (FASE 3 - AUTO-FILL & BINDING)
  const [showJsonImportModal, setShowJsonImportModal] = useState<boolean>(false); // Modal para pegar/editar JSON
  const [rawJsonText, setRawJsonText] = useState<string>(() => {
    // Carga inicial obligatoria: si mapEntity tiene paths los usa, de lo contrario formatea provincePaths
    const activePaths = (mapEntity && Array.isArray(mapEntity.paths) && mapEntity.paths.length > 0)
      ? mapEntity.paths
      : provincePaths.map(p => ({ id: p.id, name: p.name, d: p.d, category: 'provincia', ownerId: 'system' }));
    return JSON.stringify(activePaths, null, 2);
  });

  // SINCRONIZAR EL MAPA EN EDICIÓN Y AUTO-FILL EN MONTAJE
  useEffect(() => {
    const provKey = selectedProvince?.id || 'country';
    const saved = safeGetItem(`argentina_advanced_canvas_map_${provKey}`);
    let entityToSet: VectorMapEntity;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.paths) && parsed.paths.length > 0) {
          entityToSet = parsed;
        } else {
          entityToSet = getInitialContextualMap(selectedProvince, urlParentId);
        }
      } catch (e) {
        console.error("Error al sincronizar mapa guardado:", e);
        entityToSet = getInitialContextualMap(selectedProvince, urlParentId);
      }
    } else {
      entityToSet = getInitialContextualMap(selectedProvince, urlParentId);
    }

    // Herencia Automática: Si la entidad no posee polígonos, fuerza provincePaths
    if (!entityToSet.paths || entityToSet.paths.length === 0) {
      entityToSet.paths = provincePaths.map(p => ({
        id: p.id,
        name: p.name,
        d: p.d,
        category: 'provincia',
        ownerId: 'system'
      }));
    }

    setMapEntity(entityToSet);
    setSelectedPathIds([]);

    // Auto-Fill Inmediato del textarea en montaje (REGLA 1 FASE 3)
    try {
      setRawJsonText(JSON.stringify(entityToSet.paths, null, 2));
    } catch (err) {
      console.error("Error al formatear JSON inicial:", err);
    }
  }, [selectedProvince?.id, urlParentId]);

  // Sincronización continua Visual -> Código: Mantiene rawJsonText actualizado cuando cambian los polígonos en lienzo
  useEffect(() => {
    if (mapEntity && Array.isArray(mapEntity.paths) && mapEntity.paths.length > 0) {
      try {
        const formatted = JSON.stringify(mapEntity.paths, null, 2);
        try {
          if (rawJsonText && rawJsonText.trim().length > 0) {
            const currentParsed = JSON.parse(sanitizeJsonString(rawJsonText));
            if (JSON.stringify(currentParsed) === JSON.stringify(mapEntity.paths)) {
              return;
            }
          }
        } catch {
          // Si el texto en rawJsonText se está tipeando manualmente y tiene error sintáctico temporal, no sobrescribir
        }
        setRawJsonText(formatted);
      } catch (e) {
        console.error("Error al sincronizar rawJsonText en AdvancedCanvasEditor:", e);
      }
    }
  }, [mapEntity.paths]);

  // ESTADO DE SELECCIÓN DE PATHS (SELECCIÓN MÚLTIPLE COMPATIBLE)
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]); // Lista de IDs seleccionados
  
  // ESTADOS DE TRANSFORMACIÓN E INTERACCIÓN
  const [aspectRatioLocked, setAspectRatioLocked] = useState<boolean>(mapEntity.transform.aspectRatioLocked ?? true); // Candado 🔒
  const [notification, setNotification] = useState<string | null>(null); // Mensajes emergentes de confirmación
  const [zoomLevel, setZoomLevel] = useState<number>(1); // Nivel de zoom de la vista de trabajo
  
  // ESTADOS DE FORMULARIO DE EDICIÓN DE PATH
  const [editingPathData, setEditingPathData] = useState<{ id: string; name: string; d: string; category: string }>({
    id: '',
    name: '',
    d: '',
    category: ''
  });

  // ESTADO DE PEGANO RÁPIDO DE TRAZADOS SVG
  const [quickPathD, setQuickPathD] = useState<string>(''); // Código path d pegado
  const [quickPathName, setQuickPathName] = useState<string>(''); // Nombre rápido del trazado

  // ESTADO DE CARGA Y PROCESAMIENTO VECTORIAL ASISTIDO POR IA CON MONITOR DE TRABADO
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false); // Controla la visibilidad de la barra de progreso
  const [fileProgress, setFileProgress] = useState<number>(0); // Porcentaje numérico (0 a 100)
  const [fileProgressText, setFileProgressText] = useState<string>(''); // Texto explicativo del paso actual
  const [isStalled, setIsStalled] = useState<boolean>(false); // Indica si el proceso de carga se considera trabado o demorado
  const activeTimeoutsRef = useRef<NodeJS.Timeout[]>([]); // Colección de referencias a temporizadores para cancelación limpia

  // Cancela la operación de carga y limpia todos los temporizadores sin perder el estado del mapa previo
  const cancelProcessing = () => {
    activeTimeoutsRef.current.forEach(clearTimeout); // Limpia cada temporizador en ejecución
    activeTimeoutsRef.current = []; // Vacía la lista de referencias
    setIsProcessingFile(false); // Oculta la pantalla de carga
    setIsStalled(false); // Desactiva la alerta de lentitud
    setFileProgress(0); // Resetea el porcentaje a 0
    showNotify("[🛑] Carga cancelada. Se mantuvo la estructura previa sin modificaciones."); // Notifica la acción
  };

  // Resetea el proceso de carga reiniciando el progreso a 0%
  const resetProcessing = () => {
    activeTimeoutsRef.current.forEach(clearTimeout); // Detiene los temporizadores anteriores
    activeTimeoutsRef.current = []; // Resetea el arreglo de referencias
    setIsStalled(false); // Remueve la advertencia de estancamiento
    setFileProgress(5); // Inicia el porcentaje desde 5%
    setFileProgressText("Reiniciando asistente y re-analizando el archivo..."); // Notifica el reinicio
  };

  // Otorga más tiempo de espera al asistente para archivos vectoriales de gran tamaño
  const extendWaitProcessing = () => {
    setIsStalled(false); // Oculta temporalmente la advertencia de demora
    showNotify("[⏳] Tiempo de espera extendido. El asistente continúa procesando los nodos vectoriales..."); // Notifica al usuario
  };

  // REFERENCIA AL SVG
  const svgRef = useRef<SVGSVGElement | null>(null); // Referencia al nodo SVG en el DOM
  const fileInputRef = useRef<HTMLInputElement | null>(null); // Referencia al input de archivos

  // VERIFICACIÓN DE PERMISOS RBAC PARA EL MAPA ACTUAL
  const canEditMap = useMemo(() => {
    if (currentUser.role === 'admin') return true; // Super Admin puede editar todo
    if (currentUser.role === 'pro') {
      // Usuario Pro solo puede editar sus propios mapas (donde ownerId coincide)
      return mapEntity.ownerId === currentUser.id || mapEntity.ownerId === 'system';
    }
    return false; // Usuario Guest visitante no puede editar
  }, [currentUser, mapEntity.ownerId]);

  // MOSTRAR NOTIFICACIÓN TEMPORAL
  const showNotify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // OBTIENE TODOS LOS PATHS SELECCIONADOS ACTUALMENTE
  const selectedPaths = useMemo(() => {
    return mapEntity.paths.filter(p => selectedPathIds.includes(p.id));
  }, [mapEntity.paths, selectedPathIds]);

  // CALCULA LA CAJA DE LÍMITES (BOUNDING BOX) DE LA SELECCIÓN ACTUAL
  const selectionBBox = useMemo(() => {
    if (selectedPaths.length === 0) return null;
    return getMultiplePathsBBox(selectedPaths.map(p => ({ d: p.d })));
  }, [selectedPaths]);

  // CALCULA EL VIEWBOX DINÁMICO DEL CANVAS PARA AUTO-ACOMODAR TODOS LOS PATHS
  const canvasViewBox = useMemo(() => {
    if (mapEntity.paths.length === 0) return "0 0 800 600";
    const bbox = getMultiplePathsBBox(mapEntity.paths.map(p => ({ d: p.d })));
    const pad = Math.max(30, Math.max(bbox.width, bbox.height) * 0.1); // Margen de holgura
    return `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`;
  }, [mapEntity.paths]);

  // SINCRO CON FORMULARIO CUANDO CAMBIA LA SELECCIÓN
  useEffect(() => {
    if (selectedPaths.length === 1) {
      const p = selectedPaths[0];
      setEditingPathData({
        id: p.id,
        name: p.name,
        d: p.d,
        category: p.category || 'provincia'
      });
    } else {
      setEditingPathData({ id: '', name: '', d: '', category: '' });
    }
  }, [selectedPathIds, selectedPaths]);

  // SELECCIÓN O DESELECCIÓN DE UN TRAZO VECTORIAL
  const handleToggleSelectPath = (id: string, isMulti: boolean) => {
    if (isMulti) {
      setSelectedPathIds(prev => 
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
    } else {
      setSelectedPathIds([id]);
    }
  };

  // SELECCIONAR TODOS LOS ELEMENTOS DEL CANVAS
  const handleSelectAll = () => {
    if (selectedPathIds.length === mapEntity.paths.length) {
      setSelectedPathIds([]); // Deselecciona todos
    } else {
      setSelectedPathIds(mapEntity.paths.map(p => p.id)); // Selecciona todos
    }
  };

  // RECARGAR TRAZADOS CONTEXTUALES DESDE LA REGIÓN ACTIVA O PROVINCEPATHS
  const handleReloadContextualVectors = () => {
    const contextual = getInitialContextualMap(selectedProvince, urlParentId);
    setMapEntity(contextual);
    setSelectedPathIds([]);
    showNotify(`[🔄] Se recargaron los trazados contextuales de ${selectedProvince?.name || 'Argentina'}.`);
  };

  // AGREGAR TRAZADO SVG DIRECTO DESDE EL INPUT RÁPIDO
  const handleAddQuickPath = () => {
    if (!quickPathD.trim()) return;

    let extractedD = quickPathD.trim();
    const dMatch = extractedD.match(/d=["']([^"']+)["']/i);
    if (dMatch && dMatch[1]) {
      extractedD = dMatch[1];
    }

    const newPathItem: VectorPathItem = {
      id: `PATH-${Date.now().toString().slice(-5)}`,
      name: quickPathName.trim() || `Trazado ${mapEntity.paths.length + 1}`,
      d: extractedD,
      category: mapEntity.level || 'provincia',
      ownerId: currentUser.id
    };

    setMapEntity(prev => ({
      ...prev,
      paths: [...prev.paths, newPathItem],
      updatedAt: new Date().toISOString()
    }));

    setQuickPathD('');
    setQuickPathName('');
    setSelectedPathIds([newPathItem.id]);
    showNotify(`[✓] Nuevo trazado "${newPathItem.name}" agregado al canvas.`);
  };

  // CAMBIO DE ESCALA O PANORÁMICA GLOBAL CON BLOQUEO DE PROPORCIÓN
  const handleTransformChange = (key: 'scale' | 'translateX' | 'translateY', val: number) => {
    if (!canEditMap) return;
    setMapEntity(prev => ({
      ...prev,
      transform: {
        ...prev.transform,
        [key]: val,
        aspectRatioLocked
      },
      updatedAt: new Date().toISOString()
    }));
  };

  // TOGGLE DE CANDADO DE PROPORCIÓN 🔒
  const handleToggleAspectRatioLock = () => {
    setAspectRatioLocked(!aspectRatioLocked);
    setMapEntity(prev => ({
      ...prev,
      transform: {
        ...prev.transform,
        aspectRatioLocked: !aspectRatioLocked
      }
    }));
    showNotify(!aspectRatioLocked ? "[🔒] Candado de proporción activado" : "[🔓] Candado de proporción desactivado");
  };

  // ELIMINAR ELEMENTOS SELECCIONADOS
  const handleDeleteSelectedPaths = () => {
    if (!canEditMap) return;
    if (selectedPathIds.length === 0) return;

    if (window.confirm(`¿Estás seguro de eliminar ${selectedPathIds.length} elemento(s) seleccionado(s)?`)) {
      setMapEntity(prev => ({
        ...prev,
        paths: prev.paths.filter(p => !selectedPathIds.includes(p.id)),
        updatedAt: new Date().toISOString()
      }));
      setSelectedPathIds([]);
      showNotify(`[✓] Se eliminaron ${selectedPathIds.length} elementos.`);
    }
  };

  // RENOMBRAR / GUARDAR CAMBIOS DE UN PATH INDIVIDUAL
  const handleSaveEditingPath = () => {
    if (!canEditMap) return;
    if (selectedPathIds.length !== 1) return;

    const targetId = selectedPathIds[0];
    setMapEntity(prev => ({
      ...prev,
      paths: prev.paths.map(p => {
        if (p.id === targetId) {
          return {
            ...p,
            id: editingPathData.id.trim() || p.id,
            name: editingPathData.name.trim() || p.name,
            d: editingPathData.d.trim() || p.d,
            category: editingPathData.category || p.category
          };
        }
        return p;
      }),
      updatedAt: new Date().toISOString()
    }));

    if (editingPathData.id !== targetId) {
      setSelectedPathIds([editingPathData.id]);
    }
    showNotify("[✓] Trazado actualizado exitosamente.");
  };

  // EXTRAER PATH (CORTAR/AISLAR POLÍGONO EN UN NUEVO MAPA INDEPENDIENTE)
  const handleExtractPath = () => {
    if (!canEditMap) return;
    if (selectedPaths.length === 0) return;

    const extractedMap: VectorMapEntity = {
      id: `extracted-${Date.now()}`,
      title: `Sub-capa Extraída: ${selectedPaths.map(p => p.name).join(', ')}`,
      level: 'sub_municipio',
      parentId: mapEntity.id,
      ownerId: currentUser.id,
      isApproved: currentUser.role === 'admin',
      paths: selectedPaths.map(p => ({ ...p, parentId: mapEntity.id, ownerId: currentUser.id })),
      transform: { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setMapEntity(prev => ({
      ...prev,
      paths: prev.paths.filter(p => !selectedPathIds.includes(p.id)),
      updatedAt: new Date().toISOString()
    }));

    safeSetItem(`argentina_map_extracted_${extractedMap.id}`, JSON.stringify(extractedMap));
    setSelectedPathIds([]);
    showNotify(`[✂️] Sub-capa extraída con éxito como entidad independiente.`);
  };

  // MOTOR DE AUTO-ACOMODACIÓN (MUÑECA RUSA)
  const handleAutoFitToParent = () => {
    if (!canEditMap) return;
    if (!mapEntity.paths || mapEntity.paths.length === 0) return;

    const currentBBox = getMultiplePathsBBox(mapEntity.paths.map(p => ({ d: p.d })));
    if (currentBBox.width === 0 || currentBBox.height === 0) return;

    const targetWidth = 600;
    const targetHeight = 450;
    const scaleX = targetWidth / currentBBox.width;
    const scaleY = targetHeight / currentBBox.height;
    const computedScale = Math.min(scaleX, scaleY);

    const centerX = currentBBox.x + currentBBox.width / 2;
    const centerY = currentBBox.y + currentBBox.height / 2;

    const panX = 400 - centerX * computedScale;
    const panY = 300 - centerY * computedScale;

    setMapEntity(prev => ({
      ...prev,
      transform: {
        scale: Number(computedScale.toFixed(3)),
        translateX: Number(panX.toFixed(1)),
        translateY: Number(panY.toFixed(1)),
        aspectRatioLocked: true
      },
      updatedAt: new Date().toISOString()
    }));

    showNotify("[🎯] Auto-acomodación completada: Mapa centrado y escalado jerárquicamente.");
  };

  // CLONAR MAPA DEL SISTEMA PARA USUARIOS PRO
  const handleCloneAsProUser = () => {
    const clonedEntity: VectorMapEntity = {
      ...mapEntity,
      id: `map-user-${currentUser.id}-${Date.now()}`,
      title: `${mapEntity.title} (Mi Versión Pro)`,
      ownerId: currentUser.id,
      isApproved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setMapEntity(clonedEntity);
    safeSetItem('argentina_advanced_canvas_map', JSON.stringify(clonedEntity));
    showNotify("[⚡] Mapa clonado con éxito. ¡Ahora es tuyo y tienes permisos totales de edición!");
  };

  // APROBAR MAPA DE USUARIO PRO (SOLO SUPER ADMIN)
  const handleApproveMapByAdmin = () => {
    if (currentUser.role !== 'admin') return;
    const updated = { ...mapEntity, isApproved: !mapEntity.isApproved, updatedAt: new Date().toISOString() };
    setMapEntity(updated);
    safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updated));
    showNotify(updated.isApproved ? "[👑 Super Admin] Mapa APROBADO para publicación oficial." : "[👑 Super Admin] Estado del mapa cambiado a Pendiente.");
  };

  // GUARDAR MAPA EN LA APLICACIÓN / PERSISTENCIA EN TIEMPO REAL
  const handleSaveMapToApp = () => {
    if (!canEditMap) return;

    safeSetItem('argentina_advanced_canvas_map', JSON.stringify(mapEntity));

    if (onSaveMapEntity) {
      onSaveMapEntity(mapEntity);
    }

    if (selectedProvince && onUpdateProvince) {
      const updatedMunicipalities = mapEntity.paths.map(p => ({
        id: p.id,
        name: p.name,
        value: p.customData?.valor || p.customData?.value || 0,
        percentage: p.customData?.porcentaje || p.customData?.percentage || 0,
        d: p.d,
        color: p.customData?.fill || p.visualStyles?.fillColor || p.fill,
        layer: p.category || p.customData?.layer || selectedProvince.name,
        visualStyles: {
          fillColor: p.customData?.fill || p.visualStyles?.fillColor || p.fill,
          strokeColor: p.customData?.stroke || p.visualStyles?.strokeColor || p.stroke,
          strokeWidth: p.customData?.strokeWidth || p.visualStyles?.strokeWidth || p.strokeWidth
        },
        customData: p.customData || {}
      }));

      onUpdateProvince({
        ...selectedProvince,
        municipalities: updatedMunicipalities,
        mapTransform: {
          scale: mapEntity.transform.scale,
          panX: mapEntity.transform.translateX,
          panY: mapEntity.transform.translateY
        }
      });
    }

    showNotify("[💾] Mapa guardado y sincronizado inmediatamente con la vista principal.");
  };

  // FUNCIÓN CENTRAL DE PROCESAMIENTO VECTORIAL ASISTIDO POR IA CON BARRA DE PROGRESO % Y DETECCIÓN DE TRABADO
  const processVectorContent = (content: string, fileName: string) => {
    // Limpia cualquier temporizador de ejecuciones pasadas
    activeTimeoutsRef.current.forEach(clearTimeout);
    activeTimeoutsRef.current = [];

    setIsProcessingFile(true); // Activa la visibilidad del overlay de progreso
    setIsStalled(false); // Reinicia el indicador de estancamiento
    setFileProgress(15); // Avance inicial del 15%
    setFileProgressText("Iniciando Asistente Vectorial IA y lectura de archivo...");

    // Temporizador de liveness (Detección de demora/trabado a los 3.8 segundos)
    const stallDetector = setTimeout(() => {
      setIsStalled(true); // Activa la advertencia si el proceso demora por tamaño o nodos
    }, 3800);
    activeTimeoutsRef.current.push(stallDetector);

    const t1 = setTimeout(() => {
      setFileProgress(45); // Avance al 45%
      setFileProgressText("Limpiando código JS/TS, analizando nodos y normalizando GeoJSON / SVG...");

      const t2 = setTimeout(() => {
        // Ejecuta el parser inteligente asistido por IA
        const { paths: importedPaths, title: detectedTitle } = parseVectorContentWithAI(
          content,
          fileName,
          currentUser.id,
          mapEntity.level || 'provincia'
        );

        if (importedPaths.length === 0) {
          setIsProcessingFile(false);
          setIsStalled(false);
          showNotify("[⚠️] No se encontraron polígonos o trazados vectoriales válidos.");
          return;
        }

        setFileProgress(75); // Avance al 75%
        setFileProgressText(`Se normalizaron ${importedPaths.length} polígonos. Calculando caja de límites (Bounding Box)...`);

        const t3 = setTimeout(() => {
          // CALCULAR BOUNDING BOX Y ESCALA ÓPTIMA PARA CENTRAR EN PANTALLA INSTANTÁNEAMENTE
          const bbox = getMultiplePathsBBox(importedPaths.map(p => ({ d: p.d })));
          let computedScale = 1;
          let panX = 0;
          let panY = 0;

          if (bbox && bbox.width > 0 && bbox.height > 0) {
            const canvasW = 800;
            const canvasH = 600;
            const targetW = 680;
            const targetH = 480;
            const scaleX = targetW / bbox.width;
            const scaleY = targetH / bbox.height;
            computedScale = Math.min(scaleX, scaleY);
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            panX = (canvasW / 2) - (centerX * computedScale);
            panY = (canvasH / 2) - (centerY * computedScale);
          }

          setFileProgress(95); // Avance al 95%
          setFileProgressText("Auto-centrando mapa en el lienzo y sincronizando aplicación...");

          const provKey = selectedProvince?.id || 'country';
          const updatedEntity: VectorMapEntity = {
            ...mapEntity,
            title: detectedTitle ? `${mapEntity.title} - ${detectedTitle}` : mapEntity.title,
            paths: importedPaths,
            transform: {
              scale: Number(computedScale.toFixed(3)),
              translateX: Number(panX.toFixed(1)),
              translateY: Number(panY.toFixed(1)),
              aspectRatioLocked: true
            },
            updatedAt: new Date().toISOString()
          };

          setMapEntity(updatedEntity);
          setSelectedPathIds([]);

          // Guardar en almacenamiento persistente seguro para la región activa
          safeSetItem(`argentina_advanced_canvas_map_${provKey}`, JSON.stringify(updatedEntity));
          safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));

          if (onSaveMapEntity) {
            onSaveMapEntity(updatedEntity);
          }

          if (selectedProvince && onUpdateProvince) {
            onUpdateProvince({
              ...selectedProvince,
              municipalities: importedPaths.map(p => ({
                id: p.id,
                name: p.name,
                value: p.customData?.valor || p.customData?.value || 0,
                percentage: p.customData?.porcentaje || p.customData?.percentage || 0,
                d: p.d,
                color: p.customData?.fill || p.visualStyles?.fillColor || p.fill,
                layer: p.category || p.customData?.layer || selectedProvince.name,
                visualStyles: {
                  fillColor: p.customData?.fill || p.visualStyles?.fillColor || p.fill,
                  strokeColor: p.customData?.stroke || p.visualStyles?.strokeColor || p.stroke,
                  strokeWidth: p.customData?.strokeWidth || p.visualStyles?.strokeWidth || p.strokeWidth
                },
                customData: p.customData || {}
              })),
              mapTransform: {
                scale: updatedEntity.transform.scale,
                panX: updatedEntity.transform.translateX,
                panY: updatedEntity.transform.translateY
              }
            });
          }

          setFileProgress(100); // 100% Completado
          setFileProgressText("¡Carga y centrado completados exitosamente!");
          setIsStalled(false); // Limpia la advertencia de trabado al finalizar

          const t4 = setTimeout(() => {
            setIsProcessingFile(false); // Oculta overlay de carga
            setShowJsonImportModal(false);
            setRawJsonText('');
            showNotify(`[✓] ¡Mapa cargado exitosamente con ${importedPaths.length} elementos centrados!`);
          }, 400);
          activeTimeoutsRef.current.push(t4);

        }, 200);
        activeTimeoutsRef.current.push(t3);

      }, 200);
      activeTimeoutsRef.current.push(t2);

    }, 150);
    activeTimeoutsRef.current.push(t1);
  };

  // MANEJO DE SUBIDA DE ARCHIVO JSON / SVG CON LECTURA Y PROGRESO
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      processVectorContent(content, file.name);
    };
    reader.readAsText(file);
    if (e.target) e.target.value = ''; // Resetea el input para permitir volver a subir el mismo archivo
  };

  // EXPORTAR MAPA A ARCHIVO JSON
  const handleExportJsonFile = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mapEntity, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${mapEntity.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotify("[📥] Archivo JSON exportado exitosamente.");
  };

  // IMPORTAR MAPA DESDE JSON PEGADO MANUALMENTE CON ASISTENCIA IA
  const handleImportJsonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawJsonText.trim()) return;
    processVectorContent(rawJsonText, "texto_pegado.json");
  };

  return (
    <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
      
      {/* NOTIFICACIÓN FLOTANTE DE ACCIONES */}
      {notification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-2xl z-50 animate-bounce">
          {notification}
        </div>
      )}

      {/* ENCABEZADO Y BARRA DE HERRAMIENTAS PRINCIPAL DE EDICIÓN */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 px-5 flex flex-wrap items-center justify-between gap-3">
        
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Layers size={18} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-100">
                {mapEntity.title}
              </h2>
              
              {/* Badge de Propietario */}
              {mapEntity.ownerId === 'system' ? (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded-full flex items-center space-x-1">
                  <ShieldCheck size={10} />
                  <span>Mapa Sistema</span>
                </span>
              ) : (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full flex items-center space-x-1">
                  <Shield size={10} />
                  <span>Mapa Pro ({mapEntity.ownerId})</span>
                </span>
              )}

              {/* Estado de Aprobación por Super Admin */}
              {mapEntity.isApproved ? (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                  ✓ Aprobado
                </span>
              ) : (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-full">
                  ⏳ Pendiente Admin
                </span>
              )}
            </div>
            
            {/* Referencia Jerárquica */}
            <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
              <span>Región Activa: <strong className="text-emerald-400 uppercase">{selectedProvince ? selectedProvince.name : 'Argentina (Nacional)'}</strong></span>
              <span>•</span>
              <span>Jerarquía: <strong className="text-sky-400 uppercase">{mapEntity.level}</strong></span>
            </div>
          </div>
        </div>

        {/* ACCIONES RBAC Y BOTONERA DE CONTROL */}
        <div className="flex items-center space-x-2 flex-wrap">
          {/* Recargar trazados contextuales */}
          <button
            onClick={handleReloadContextualVectors}
            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
            title="Cargar o resetear los trazados vectoriales nativos de esta región"
          >
            <RefreshCw size={13} className="text-emerald-400" />
            <span>Recargar Vectores Nativos</span>
          </button>

          {/* Subir archivo SVG / JSON directo */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!canEditMap}
            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <FileUp size={13} className="text-sky-400" />
            <span>Subir Archivo .json/.svg</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json,.svg"
            className="hidden"
          />

          {/* Si el mapa es del Sistema y el usuario es Pro (no Admin), ofrecer opción de clonar */}
          {currentUser.role === 'pro' && mapEntity.ownerId === 'system' && (
            <button
              onClick={handleCloneAsProUser}
              className="py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
              title="Clonar mapa del sistema para editar tu propia copia"
            >
              <Copy size={13} />
              <span>Clonar para Editar (Pro)</span>
            </button>
          )}

          {/* Botón de aprobación del Super Admin */}
          {currentUser.role === 'admin' && (
            <button
              onClick={handleApproveMapByAdmin}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1.5 ${
                mapEntity.isApproved 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30' 
                  : 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
              }`}
            >
              <ShieldCheck size={13} />
              <span>{mapEntity.isApproved ? 'Aprobado (Desmarcar)' : 'Aprobar Mapa'}</span>
            </button>
          )}

          {/* Cargar JSON Modal */}
          <button
            onClick={() => setShowJsonImportModal(true)}
            disabled={!canEditMap}
            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <Upload size={13} />
            <span>Pegar JSON</span>
          </button>

          {/* Exportar JSON */}
          <button
            onClick={handleExportJsonFile}
            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <Download size={13} />
            <span>Exportar</span>
          </button>

          {/* Guardar cambios globales */}
          <button
            onClick={handleSaveMapToApp}
            disabled={!canEditMap}
            className="py-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-emerald-950/40"
          >
            <Save size={13} />
            <span>Aplicar Cambios</span>
          </button>
        </div>
      </div>

      {/* ADVERTENCIA SI EL MAPA ES DE SOLO LECTURA PARA ESTE ROL */}
      {!canEditMap && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 p-2.5 px-4 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert size={15} />
            <span>
              <strong>Modo Solo Lectura:</strong> {currentUser.role === 'guest' 
                ? 'Inicia sesión como usuario Pro o Admin para editar mapas vectoriales.' 
                : 'Este mapa pertenece al sistema. Haz clic en "Clonar para Editar" para crear tu copia editable.'}
            </span>
          </div>
        </div>
      )}

      {/* ÁREA DE TRABAJO EN TRES COLUMNAS (PANEL DE CAPAS + CANVAS VECTORIAL + INSPECTOR) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* COLUMNA IZQUIERDA: ÁRBOL DE CAPAS Y JERARQUÍA */}
        <div className="w-64 bg-slate-900/60 border-r border-slate-800 flex flex-col overflow-y-auto">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Layers size={13} />
              <span>Capas / Polígonos ({mapEntity.paths.length})</span>
            </h3>
            <button
              onClick={handleSelectAll}
              className="text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer"
            >
              {selectedPathIds.length === mapEntity.paths.length ? 'Deseleccionar' : 'Todos'}
            </button>
          </div>

          {/* Lista de Polígonos/Paths */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-1">
            {mapEntity.paths.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <p>No hay trazados vectoriales en este lienzo.</p>
                <p className="text-[10px] text-slate-600">Sube un archivo .svg / .json o pega código &lt;path d="..."&gt; abajo.</p>
              </div>
            ) : (
              mapEntity.paths.map(p => {
                const isSelected = selectedPathIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={(e) => handleToggleSelectPath(p.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between group my-0.5 ${
                      isSelected
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                      <div className="truncate">
                        <p className="text-xs truncate leading-snug">{p.name || p.id}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">{p.id}</p>
                      </div>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPathIds([p.id]);
                        }}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                        title="Seleccionar e inspeccionar"
                      >
                        <Edit3 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* SECCIÓN DE PEGAR TRAZADOS DIRECTOS (PEGADO RÁPIDO <path d="...">) */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center space-x-1">
              <Plus size={11} />
              <span>Pegado Rápido &lt;path d="..."&gt;</span>
            </h4>

            <input
              type="text"
              value={quickPathName}
              onChange={(e) => setQuickPathName(e.target.value)}
              disabled={!canEditMap}
              placeholder="Nombre (ej: Prov. São Paulo)"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-hidden focus:border-emerald-500"
            />

            <textarea
              value={quickPathD}
              onChange={(e) => setQuickPathD(e.target.value)}
              disabled={!canEditMap}
              placeholder='Pega trazado: M 100 100 L 200 200 Z o <path d="..." />'
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-[10px] font-mono text-slate-300 outline-hidden focus:border-emerald-500 resize-none"
            />

            <button
              onClick={handleAddQuickPath}
              disabled={!canEditMap || !quickPathD.trim()}
              className="w-full py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 text-emerald-300 border border-emerald-500/30 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center space-x-1"
            >
              <Plus size={12} />
              <span>Agregar Trazado al Canva</span>
            </button>
          </div>

          {/* SECCIÓN DE JERARQUÍA RELATIVA */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Jerarquía del Nivel</h4>
            
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 uppercase font-bold">Nivel del Mapa</label>
              <select
                value={mapEntity.level}
                onChange={(e) => canEditMap && setMapEntity({ ...mapEntity, level: e.target.value })}
                disabled={!canEditMap}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-200 outline-hidden focus:border-emerald-500"
              >
                <option value="mundo">Mundo</option>
                <option value="continente">Continente</option>
                <option value="pais">País</option>
                <option value="provincia">Provincia / Estado</option>
                <option value="municipio">Municipio / Departamento</option>
                <option value="barrio">Barrio / Comuna</option>
              </select>
            </div>

            <button
              onClick={handleAutoFitToParent}
              disabled={!canEditMap}
              className="w-full mt-1 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Maximize2 size={12} />
              <span>Auto-Acomodar Mapa</span>
            </button>
          </div>
        </div>

        {/* COLUMNA CENTRAL: CANVAS INTERACTIVO CON SVG Y NODOS DE ESCALA/TRANSLACIÓN */}
        <div className="flex-1 bg-slate-950 relative flex flex-col overflow-hidden items-center justify-center p-4">
          
          {/* CONTROLES DE ZOOM Y HERRAMIENTAS DE VISOR */}
          <div className="absolute top-4 right-4 bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 flex items-center space-x-1 z-20 shadow-xl backdrop-blur-md">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 3))}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn size={14} />
            </button>
            <span className="text-[10px] font-mono text-slate-400 font-bold px-1.5">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.5))}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors cursor-pointer"
              title="Alejar Zoom"
            >
              <ZoomOut size={14} />
            </button>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors cursor-pointer text-[10px] font-bold"
              title="Restablecer vista"
            >
              Reset
            </button>
          </div>

          {/* LIENZO SVG DINÁMICO CON TRANSFORMACIÓN DE MATRIZ Y SELECCIÓN DE POLÍGONOS */}
          <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
            <svg
              ref={svgRef}
              viewBox={canvasViewBox}
              className="w-full h-full max-h-[75vh] select-none transition-transform duration-100"
              style={{
                transform: `scale(${zoomLevel})`
              }}
            >
              {/* Grilla orientativa sutil */}
              <defs>
                <pattern id="editorGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#editorGrid)" />

              {/* GRUPO PRINCIPAL CON TRANSFORMACIÓN GLOBAL (ESCALA + PAN X/Y) */}
              <g transform={`translate(${mapEntity.transform.translateX}, ${mapEntity.transform.translateY}) scale(${mapEntity.transform.scale})`}>
                
                {/* RENDERIZADO DE TODOS LOS TRAZOS VECTORIALES */}
                {mapEntity.paths.map(p => {
                  const isSelected = selectedPathIds.includes(p.id);
                  const pathFill = p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#1e293b';
                  const pathStroke = p.customData?.stroke || p.visualStyles?.strokeColor || p.stroke || '#475569';
                  const baseStrokeWidth = p.customData?.strokeWidth || p.visualStyles?.strokeWidth || p.strokeWidth || 1;
                  const computedStrokeWidth = (isSelected ? baseStrokeWidth * 2 : baseStrokeWidth) / mapEntity.transform.scale;

                  return (
                    <path
                      key={p.id}
                      d={p.d}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelectPath(p.id, e.ctrlKey || e.metaKey || e.shiftKey);
                      }}
                      className="cursor-pointer transition-all duration-150 hover:opacity-80"
                      fill={isSelected ? '#10b981' : pathFill}
                      fillOpacity={isSelected ? 0.8 : 0.7}
                      stroke={isSelected ? '#34d399' : pathStroke}
                      strokeWidth={computedStrokeWidth}
                    />
                  );
                })}

                {/* OVERLAY DE BOUNDING BOX SOBRE LOS ELEMENTOS SELECCIONADOS CON NODOS (TIRADORES) DE ESCALA */}
                {selectionBBox && (
                  <g className="pointer-events-none">
                    {/* Caja envolvente principal */}
                    <rect
                      x={selectionBBox.x}
                      y={selectionBBox.y}
                      width={selectionBBox.width}
                      height={selectionBBox.height}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={1.5 / mapEntity.transform.scale}
                      strokeDasharray="4,4"
                    />

                    {/* Esquinas (Nodos/Tiradores de Escala) */}
                    {[
                      { x: selectionBBox.x, y: selectionBBox.y }, // NW
                      { x: selectionBBox.x + selectionBBox.width, y: selectionBBox.y }, // NE
                      { x: selectionBBox.x, y: selectionBBox.y + selectionBBox.height }, // SW
                      { x: selectionBBox.x + selectionBBox.width, y: selectionBBox.y + selectionBBox.height } // SE
                    ].map((node, i) => (
                      <rect
                        key={i}
                        x={node.x - 4 / mapEntity.transform.scale}
                        y={node.y - 4 / mapEntity.transform.scale}
                        width={8 / mapEntity.transform.scale}
                        height={8 / mapEntity.transform.scale}
                        fill="#ffffff"
                        stroke="#10b981"
                        strokeWidth={1.5 / mapEntity.transform.scale}
                      />
                    ))}
                  </g>
                )}
              </g>
            </svg>

            {/* OVERLAY Y BARRA DE PROGRESO DE CARGA Y NORMALIZACIÓN VECTORIAL CON PORCENTAJE % Y MONITOR DE TRABADO */}
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
                      <Sparkles size={16} className="animate-spin text-emerald-400" />
                      Asistente de Inteligencia Vectorial
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
                      <span>ESTADO DEL PROCESO</span>
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
                            ¿El archivo está demorando o parece haberse trabado?
                          </p>
                          <p className="text-[11px] text-amber-300/80 mt-0.5">
                            Debido a la densidad de nodos vectoriales el proceso toma más tiempo. ¿Qué deseas hacer?
                          </p>
                        </div>
                      </div>

                      {/* Botones de acción para Suspender, Resetear o Esperar */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={cancelProcessing}
                          className="bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-[10px] font-bold py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1"
                          title="Suspender la carga y mantener el mapa previo intacto"
                        >
                          🛑 Suspender
                        </button>
                        <button
                          onClick={resetProcessing}
                          className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[10px] font-bold py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1"
                          title="Reiniciar la carga desde cero"
                        >
                          🔄 Resetear
                        </button>
                        <button
                          onClick={extendWaitProcessing}
                          className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 text-[10px] font-bold py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1"
                          title="Continuar esperando a que la IA termine el procesamiento"
                        >
                          ⏳ Esperar
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* ESTADO VACÍO ELEGANTE EN EL LIENZO CUANDO NO HAY TRAZADOS VECTORIALES (EJ: MUNDO, CONTINENTE) */}
            {mapEntity.paths.length === 0 && !isProcessingFile && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none z-20">
                <div className="p-6 bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-md max-w-md space-y-4 pointer-events-auto border-dashed">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
                    <Sparkles size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                      Lienzo Vacío • {selectedProvince ? selectedProvince.name : 'Mundo / Nueva Región'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Sin datos vectoriales para esta región. Importa un archivo JSON o SVG desde la barra superior para comenzar a estructurar este territorio.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-2.5">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!canEditMap}
                      className="px-3.5 py-2 bg-sky-600/20 hover:bg-sky-600/30 disabled:opacity-40 text-sky-300 border border-sky-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm"
                    >
                      <FileUp size={14} />
                      <span>Subir .json / .svg</span>
                    </button>
                    <button
                      onClick={() => setShowJsonImportModal(true)}
                      disabled={!canEditMap}
                      className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm"
                    >
                      <Upload size={14} />
                      <span>Pegar JSON</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BARRA DE HERRAMIENTAS RÁPIDAS VECTORIALES (BORRAR / CORTAR) */}
          {selectedPathIds.length > 0 && canEditMap && (
            <div className="absolute bottom-6 bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl p-2 px-4 shadow-2xl flex items-center space-x-3 z-30 animate-fade-in">
              <span className="text-xs font-bold text-emerald-400">
                {selectedPathIds.length} elemento(s) seleccionado(s)
              </span>

              <div className="w-px h-5 bg-slate-800" />

              {/* Botón Extraer/Cortar */}
              <button
                onClick={handleExtractPath}
                className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                title="Extraer polígono como nueva subcapa"
              >
                <Scissors size={12} className="text-sky-400" />
                <span>Extraer</span>
              </button>

              {/* Botón Borrar */}
              <button
                onClick={handleDeleteSelectedPaths}
                className="py-1 px-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                title="Borrar trazados seleccionados"
              >
                <Trash2 size={12} />
                <span>Borrar</span>
              </button>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: INSPECTOR DE PROPIEDADES (TRANSFORMACIONES Y CAMPOS DE TEXTO) */}
        <div className="w-80 bg-slate-900/80 border-l border-slate-800 p-4 flex flex-col space-y-5 overflow-y-auto">
          
          {/* SECCIÓN 1: CONTROLES DE TRANSFORMACIÓN GLOBAL (PAN Y ESCALA) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                <Move size={14} />
                <span>Transformación Espacial</span>
              </h3>
              
              {/* Botón Candado de Proporción 🔒 */}
              <button
                onClick={handleToggleAspectRatioLock}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  aspectRatioLocked 
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title={aspectRatioLocked ? "Proporción bloqueada (Mantener W/H)" : "Proporción libre"}
              >
                {aspectRatioLocked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>

            {/* Inputs Numéricos X e Y */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block">Posición X (Pan X)</label>
                <input
                  type="number"
                  value={mapEntity.transform.translateX}
                  onChange={(e) => handleTransformChange('translateX', parseFloat(e.target.value) || 0)}
                  disabled={!canEditMap}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block">Posición Y (Pan Y)</label>
                <input
                  type="number"
                  value={mapEntity.transform.translateY}
                  onChange={(e) => handleTransformChange('translateY', parseFloat(e.target.value) || 0)}
                  disabled={!canEditMap}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Input Escala General */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Escala Global (Scale)</label>
                <span className="text-[10px] font-mono text-emerald-400">{mapEntity.transform.scale}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.05"
                value={mapEntity.transform.scale}
                onChange={(e) => handleTransformChange('scale', parseFloat(e.target.value))}
                disabled={!canEditMap}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* SECCIÓN 2: EDICIÓN Y RENOMBRADO DEL POLÍGONO SELECCIONADO */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Edit3 size={14} className="text-sky-400" />
              <span>Inspector de Trazo ({selectedPathIds.length})</span>
            </h3>

            {selectedPathIds.length === 1 ? (
              <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">ID del Polígono</label>
                  <input
                    type="text"
                    value={editingPathData.id}
                    onChange={(e) => setEditingPathData({ ...editingPathData, id: e.target.value })}
                    disabled={!canEditMap}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Nombre Territorial</label>
                  <input
                    type="text"
                    value={editingPathData.name}
                    onChange={(e) => setEditingPathData({ ...editingPathData, name: e.target.value })}
                    disabled={!canEditMap}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Geometría SVG (Path d)</label>
                  <textarea
                    value={editingPathData.d}
                    onChange={(e) => setEditingPathData({ ...editingPathData, d: e.target.value })}
                    disabled={!canEditMap}
                    rows={4}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] font-mono text-slate-300 outline-hidden focus:border-emerald-500 resize-none leading-normal"
                  />
                </div>

                <button
                  onClick={handleSaveEditingPath}
                  disabled={!canEditMap}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Check size={13} />
                  <span>Guardar Trazo</span>
                </button>
              </div>
            ) : selectedPathIds.length > 1 ? (
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  Hay <strong>{selectedPathIds.length}</strong> elementos seleccionados simultáneamente.
                </p>
                <p className="text-[10px] text-slate-500">
                  Usa los botones flotantes o borra/extrae en lote.
                </p>
              </div>
            ) : (
              <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800/80 text-center text-xs text-slate-500">
                Haz clic sobre cualquier polígono en el mapa o en la lista de capas para desplegar sus propiedades.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL PARA PEGAR JSON EXTERNO LIBREMENTE */}
      {showJsonImportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center space-x-2">
                <FileCode className="text-emerald-400" size={18} />
                <span>Importar JSON de Trazados Vectoriales</span>
              </h3>
              <button
                onClick={() => setShowJsonImportModal(false)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Pega la estructura JSON generada con tus trazos vectoriales. Soporta arreglos de objetos con propiedades <code className="text-emerald-400 font-mono">id</code>, <code className="text-emerald-400 font-mono">name</code> y <code className="text-emerald-400 font-mono">d</code>.
            </p>

            <form onSubmit={handleImportJsonSubmit} className="space-y-4">
              <textarea
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                placeholder='[{"id": "BR-SP", "name": "São Paulo", "d": "M 10 10 L 50 10 Z"}]'
                rows={8}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 outline-hidden focus:border-emerald-500 leading-normal"
              />

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowJsonImportModal(false)}
                  className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  Importar Ahora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
