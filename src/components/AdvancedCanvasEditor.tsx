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
  FileUp, Sparkles, MapPin, Globe, Palette, ChevronDown, Search, Link,
  Hand, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ChevronLeft, ChevronRight,
  Target, X, CheckSquare, Undo2, Redo2, RotateCcw, XCircle, History, CheckCircle,
  Folder, FolderOpen, Spline, Unlink
} from 'lucide-react'; // Íconos Lucide para la interfaz tipo CorelDRAW, Figma y calibrador vector
import { VectorPathItem, VectorMapEntity, UserRole, UserProfile, ProvinceData, NavNode } from '../types'; // Interfaces de TypeScript
import { safeSetItem, safeGetItem } from '../lib/storage'; // Funciones de almacenamiento seguro
import { getPathBBox, getMultiplePathsBBox, fitPathToBBox, translatePathD, scalePathD } from '../lib/mapUtils'; // Calculadoras de Bounding Box y transformaciones espaciales
import { provincePaths } from '../data/provincePaths'; // Moldes nativos vectoriales de la República Argentina (REGLA INTOCABLE)
import { mockProvincesData } from '../data/mockData'; // Datos iniciales con indicadores provinciales

// Interfaz que define las propiedades que recibe el Súper Editor de Espacios Vectoriales
interface AdvancedCanvasEditorProps {
  currentUser: UserProfile; // Usuario actual con su rol RBAC (guest, pro, admin)
  selectedProvince?: ProvinceData; // Provincia o entidad activa seleccionada en la app
  onUpdateProvince?: (prov: ProvinceData) => void; // Disparador para guardar cambios en la app pública
  allProvinces?: Record<string, ProvinceData>; // Diccionario de provincias cargadas
  onSaveMapEntity?: (entity: VectorMapEntity) => void; // Callback ejecutado al guardar/aprobar un mapa
  selectedSubdivisionId?: string | null; // ID de la subdivisión/polígono seleccionado en el índice o mapa
  onSelectSubdivision?: (id: string | null) => void; // Callback para sincronizar la selección con la vista global
  navPath?: NavNode[]; // Historial de navegación dinámico universal
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
  province?: ProvinceData, // Objeto de provincia/nivel territorial activo
  urlParentId?: string | null // Referencia enviada por URL si existe
): VectorMapEntity => {
  // 1. Si la provincia seleccionada tiene municipios/subdivisiones con vectores SVG definidos, los carga directamente en el lienzo
  if (province && province.municipalities && province.municipalities.length > 0) {
    const validSubs = province.municipalities.filter(m => m.d && m.d.trim().length > 0); // Filtra los municipios con vector SVG 'd' no vacío
    if (validSubs.length > 0) { // Si se encontraron polígonos válidos
      return { // Devuelve el objeto del mapa vectorial con los polígonos del mapa activo
        id: `map-${province.id.toLowerCase()}`, // ID del mapa basado en el territorio activo
        title: `Mapa Vectorial Activo - ${province.name}`, // Título contextual del mapa
        level: province.id === 'WORLD_MAP' ? 'mundo' : province.id === 'CONTINENT_MAP' ? 'continente' : 'provincia', // Nivel jerárquico
        parentId: province.id, // ID del padre
        ownerId: 'system', // Propietario por defecto
        isApproved: true, // Estado aprobado
        paths: validSubs.map(m => ({ // Mapea cada subdivisión a un ítem vectorial con todos sus estilos
          id: m.id, // ID del polígono
          name: m.name, // Nombre de la división o país
          d: m.d!, // Comando vectorial 'd'
          category: province.id === 'WORLD_MAP' ? 'pais' : province.id === 'CONTINENT_MAP' ? 'pais' : 'municipio', // Categoría
          ownerId: 'system', // Propietario
          visualStyles: { // Preserva los estilos de color
            fillColor: m.visualStyles?.fillColor || m.color || '#10b981', // Color de relleno
            strokeColor: m.visualStyles?.strokeColor || '#0f172a', // Color de contorno
            strokeWidth: m.visualStyles?.strokeWidth || 1 // Grosor de línea
          },
          customData: { // Preserva metadatos
            valor: m.value, // Métrica
            porcentaje: m.percentage, // Porcentaje
            fill: m.visualStyles?.fillColor || m.color || '#10b981', // Color
            stroke: m.visualStyles?.strokeColor || '#0f172a', // Contorno
            ...(m.customData || {}) // Copia de propiedades personalizadas
          }
        })),
        transform: { // Matriz de transformación inicial
          scale: province.mapTransform?.scale || 1, // Escala zoom
          translateX: province.mapTransform?.panX || 0, // Desplazamiento X
          translateY: province.mapTransform?.panY || 0, // Desplazamiento Y
          aspectRatioLocked: true // Candado de proporción
        },
        createdAt: new Date().toISOString(), // Fecha creación
        updatedAt: new Date().toISOString() // Fecha actualización
      };
    }
  }

  // 2. Si es EXPLICITAMENTE Argentina o nivel País / Nacional sin subdivisiones personalizadas, carga los 24 trazos nativos con metadatos completos
  if (province && (province.id === 'country' || province.id === 'AR' || province.id === 'ARGENTINA')) { // Verifica si el nivel territorial es Argentina
    return { // Retorna la entidad vectorial nacional
      id: 'map-argentina-nativa', // Identificador del mapa argentino
      title: 'Mapa Vectorial Nativo de la República Argentina (24 Provincias)', // Título descriptivo
      level: 'pais', // Nivel de país
      parentId: 'WORLD', // Padre mundo
      ownerId: 'system', // Propietario del sistema
      isApproved: true, // Aprobado por defecto
      paths: provincePaths.map(p => ({ // Mapea cada una de las 24 provincias nativas con datos editables
        id: p.id, // ID único de la provincia (ej: AR-B)
        name: p.name, // Nombre de la provincia (ej: Buenos Aires)
        d: p.d, // Vector o geometría SVG
        category: 'provincia', // Categoría inicial del trazo
        ownerId: 'system', // Propietario del elemento
        visualStyles: { // Estilos visuales de relleno y borde
          fillColor: (p as any).color || '#10b981', // Color de relleno inicial por defecto
          strokeColor: '#0f172a', // Color del contorno del vector
          strokeWidth: 1.5 // Grosor del contorno
        }, // Fin de estilos visuales
        customData: { // Metadatos para el Inspector de Trazo y estadísticas
          valor: (p as any).value !== undefined ? (p as any).value : 45, // Métrica de valor o población
          porcentaje: (p as any).percentage !== undefined ? (p as any).percentage : 22, // Porcentaje o tasa indicadora
          fill: (p as any).color || '#10b981', // Color personalizado de relleno
          layer: 'provincia', // Capa territorial
          ...(p as any).customData || {} // Mantiene propiedades previas si existen
        } // Fin de metadatos personalizados
      })), // Fin del mapeo de provincias
      transform: { // Transformación centrada del lienzo
        scale: 1, // Escala inicial zoom
        translateX: 0, // Desplazamiento X
        translateY: 0, // Desplazamiento Y
        aspectRatioLocked: true // Bloqueo de relación de aspecto
      }, // Fin de transformación
      createdAt: new Date().toISOString(), // Marca de tiempo de creación
      updatedAt: new Date().toISOString() // Marca de tiempo de actualización
    }; // Fin de retorno de mapa de Argentina
  } // Fin de condicional de Argentina

  // 3. Si es una provincia argentina individual (ej: AR-B) sin municipios definidos, busca su contorno en provincePaths.ts
  if (province) { // Verifica si existe una provincia seleccionada
    const foundOutline = provincePaths.find(p => p.id === province.id || p.name.toLowerCase() === province.name.toLowerCase()); // Busca coincidencia en el diccionario nativo
    if (foundOutline) { // Si se encontró la silueta de la provincia
      return { // Devuelve el mapa vectorial de la silueta provincial
        id: `map-silueta-${province.id.toLowerCase()}`, // ID del mapa provincial
        title: `Silueta y Contorno - ${province.name}`, // Título descriptivo de la silueta
        level: 'provincia', // Nivel provincial
        parentId: province.id, // Identificador del padre
        ownerId: 'system', // Propietario del sistema
        isApproved: true, // Estado aprobado
        paths: [{ // Silueta única de la provincia con metadatos completos editables
          id: foundOutline.id, // ID del vector provincial
          name: foundOutline.name, // Nombre de la provincia
          d: foundOutline.d, // Geometría vectorial SVG
          category: 'provincia', // Categoría del trazo
          ownerId: 'system', // Propietario
          visualStyles: { // Estilos de color para la silueta
            fillColor: (province as any).color || (foundOutline as any).color || '#10b981', // Color de relleno
            strokeColor: '#0f172a', // Color del contorno
            strokeWidth: 1.5 // Grosor del borde
          }, // Fin de estilos visuales
          customData: { // Metadatos del Inspector de Trazo
            valor: (province as any).population || (province as any).value || 35, // Valor o población
            porcentaje: (province as any).percentage || 18, // Porcentaje relativo
            fill: (province as any).color || (foundOutline as any).color || '#10b981', // Color de relleno
            layer: 'provincia' // Nombre de la capa
          } // Fin de customData
        }], // Fin de paths
        transform: { // Transformación inicial centrada
          scale: 1, // Escala de zoom
          translateX: 0, // Desplazamiento X
          translateY: 0, // Desplazamiento Y
          aspectRatioLocked: true // Relación de aspecto bloqueada
        }, // Fin de transform
        createdAt: new Date().toISOString(), // Marca de tiempo
        updatedAt: new Date().toISOString() // Marca de tiempo
      }; // Fin de retorno
    } // Fin de verificación de foundOutline
  } // Fin de verificación de province

  // 4. Para cualquier otra región o vista por defecto, hereda automáticamente los 24 trazados nativos de provincePaths.ts
  return { // Devuelve la entidad vectorial con las 24 provincias por defecto
    id: `map-nuevo-${province ? province.id.toLowerCase() : 'argentina'}`, // ID del mapa
    title: `Lienzo Vectorial - ${province ? province.name : 'Argentina (24 Provincias)'}`, // Título
    level: province ? (province.id === 'WORLD_MAP' ? 'mundo' : province.id === 'CONTINENT_MAP' ? 'continente' : 'pais') : 'pais', // Nivel
    parentId: urlParentId || 'WORLD', // Padre
    ownerId: 'system', // Propietario
    isApproved: true, // Aprobado
    paths: provincePaths.map(p => ({ // Inyecta las 24 provincias nativas con datos completos
      id: p.id, // ID único
      name: p.name, // Nombre
      d: p.d, // Geometría SVG
      category: 'provincia', // Categoría
      ownerId: 'system', // Propietario
      visualStyles: { // Estilos visuales
        fillColor: (p as any).color || '#10b981', // Color de relleno
        strokeColor: '#0f172a', // Color de borde
        strokeWidth: 1.5 // Grosor de borde
      }, // Fin de visualStyles
      customData: { // Metadatos para el inspector
        valor: (p as any).value !== undefined ? (p as any).value : 40, // Métrica de valor
        porcentaje: (p as any).percentage !== undefined ? (p as any).percentage : 20, // Porcentaje
        fill: (p as any).color || '#10b981', // Color
        layer: 'provincia' // Capa
      } // Fin de customData
    })), // Fin del mapeo de provincias
    transform: { // Transformación por defecto
      scale: 1, // Escala
      translateX: 0, // Pan X
      translateY: 0, // Pan Y
      aspectRatioLocked: true // Candado
    }, // Fin de transform
    createdAt: new Date().toISOString(), // Fecha creación
    updatedAt: new Date().toISOString() // Fecha actualización
  }; // Fin de retorno por defecto
}; // Fin de la función getInitialContextualMap

// COMPONENTE PRINCIPAL DEL SÚPER EDITOR CANVAS
export default function AdvancedCanvasEditor({
  currentUser, // Perfil de usuario activo con sus permisos RBAC
  selectedProvince, // Provincia/entidad territorial activa en la app
  onUpdateProvince, // Función para propagar actualizaciones de mapa a la vista pública
  allProvinces, // Colección de provincias
  onSaveMapEntity, // Callback de guardado de mapa
  selectedSubdivisionId, // ID del polígono o subdivisión seleccionada en la vista izquierda o selector
  onSelectSubdivision, // Callback para notificar cambios de selección al selector general
  navPath // Historial de navegación dinámico universal
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
        if (parsed && Array.isArray(parsed.paths) && parsed.paths.length > 0) {
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

  // ESTADO PARA EDICIÓN EN LÍNEA DEL NOMBRE EN LA LISTA LATERAL (EL LÁPIZ - OBJETIVO 1)
  const [inlineEditingPathId, setInlineEditingPathId] = useState<string | null>(null); // Armazena el ID del trazo cuyo nombre se edita en línea
  const [inlineEditingNameValue, setInlineEditingNameValue] = useState<string>(''); // Armazena el valor temporal escrito en el input de nombre

  // ESTADO PARA EL MENÚ DESPLEGABLE DE VINCULACIÓN A RUTA EN LA LISTA LATERAL (OBJETIVO 2)
  const [activeLinkMenuPathId, setActiveLinkMenuPathId] = useState<string | null>(null); // Armazena el ID del trazo que tiene desplegado el menú de vinculación

  // ESTADO PARA EL MENÚ DESPLEGABLE DE SUSTITUIR SILUETA POR MAPA DE OTRA RUTA (ÍCONO DE MAPA)
  const [activeMapSelectorPathId, setActiveMapSelectorPathId] = useState<string | null>(null); // Almacena el ID del trazo que tiene desplegado el selector de mapa de ruta
  const [mapSelectorSearch, setMapSelectorSearch] = useState<string>(''); // Texto del buscador de mapas de ruta

  // ESTADOS PARA ARRASTRAR (MOVER / ACOMODAR) Y REDIMENSIONAR (ESCALAR) ELEMENTOS Y SILUETAS EN EL CANVAS
  const [isDraggingElement, setIsDraggingElement] = useState<boolean>(false); // Estado de movimiento de elementos activo
  const [isResizingElement, setIsResizingElement] = useState<string | null>(null); // Esquina activa de redimensionado ('nw', 'ne', 'sw', 'se')
  const [elementDragStartPos, setElementDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // Posición inicial del puntero en SVG
  const [initialPathsD, setInitialPathsD] = useState<Record<string, string>>({}); // Trazados 'd' originales antes de mover o escalar
  const [initialSelectionBBox, setInitialSelectionBBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null); // Bounding box original de la selección

  // ESTADOS PARA ESCONDER/OCULTAR LOS PANELES LATERALES (PANEL IZQUIERDO Y DERECHO RESALTADOS EN ROJO POR EL USUARIO)
  const [showLeftSidebar, setShowLeftSidebar] = useState<boolean>(true); // Visibilidad de panel izquierdo (Capas/Polígonos/Jerarquía)
  const [showRightSidebar, setShowRightSidebar] = useState<boolean>(false); // Visibilidad de panel derecho Inspector de Trazo (oculto por defecto según preferencia del usuario)

  // ESTADOS PARA EL BUSCADOR Y MENÚ DESPLEGABLE CON SUB-LISTAS EN EL INSPECTOR
  const [inspectorPickerSearch, setInspectorPickerSearch] = useState<string>(''); // Término ingresado en el buscador del Inspector
  const [showInspectorPickerDropdown, setShowInspectorPickerDropdown] = useState<boolean>(false); // Visibilidad del panel de sub-listas
  const [inspectorPickerSections, setInspectorPickerSections] = useState<Record<string, boolean>>({ // Colapso de secciones del acordeón
    paises: false, // Sub-lista de países abierta por defecto
    provincias: false, // Sub-lista de provincias abierta por defecto
    municipios: false // Sub-lista de municipios
  }); // Fin de estados de sub-listas

  // ESTADO PARA RENOMBRADO EN LOTE DE ELEMENTOS SELECCIONADOS
  const [batchRenameText, setBatchRenameText] = useState<string>(''); // Texto base para el renombrado masivo/en lote
  const [batchRenameSequential, setBatchRenameSequential] = useState<boolean>(true); // Si true numera (1, 2, 3...), si false aplica el mismo nombre exacto

  // ESTADOS Y BUSCADOR PARA EL ÁRBOL JERÁRQUICO DE OBJETOS ESTILO CORELDRAW / ILLUSTRATOR
  const [layerSearchQuery, setLayerSearchQuery] = useState<string>(''); // Término de búsqueda en el panel de objetos/capas
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({}); // Control de contracción/expansión de carpetas de grupo
  const [collapsedCombined, setCollapsedCombined] = useState<Record<string, boolean>>({}); // Control de contracción/expansión de elementos combinados

  // FUNCIÓN PARA ALTERNAR EXPANSIÓN/CONTRACCIÓN DE GRUPOS EN EL ÁRBOL
  const toggleGroupCollapse = (groupId: string) => { // Función para abrir/cerrar carpeta de grupo
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  }; // Fin de toggleGroupCollapse

  // FUNCIÓN PARA ALTERNAR EXPANSIÓN/CONTRACCIÓN DE ELEMENTOS COMBINADOS EN EL ÁRBOL
  const toggleCombinedCollapse = (combinedId: string) => { // Función para abrir/cerrar detalles de objeto combinado
    setCollapsedCombined(prev => ({
      ...prev,
      [combinedId]: !prev[combinedId]
    }));
  }; // Fin de toggleCombinedCollapse

  // ESTADOS Y MANEJADOR PARA EL MODAL DE ASOCIAR MAPA COMPLETO A OTRA RUTA O PROVINCIA
  const [isAssociateModalOpen, setIsAssociateModalOpen] = useState<boolean>(false);
  const [targetAssociateRouteId, setTargetAssociateRouteId] = useState<string>('');
  const [associateSearchQuery, setAssociateSearchQuery] = useState<string>('');

  // FUNCIÓN PARA ASOCIAR Y GUARDAR EL MAPA COMPLETO EN OTRA RUTA O PROVINCIA
  const handleAssociateMapToSelectedRoute = (targetRouteId: string) => {
    if (!canEditMap || !targetRouteId) return;
    const targetProv = (allProvinces && allProvinces[targetRouteId]) || mockProvincesData[targetRouteId];
    const targetName = targetProv?.name || targetRouteId;

    const updatedMunicipalities = mapEntity.paths.map(p => ({
      id: p.id,
      name: p.name,
      value: p.customData?.valor || p.customData?.value || 0,
      percentage: p.customData?.porcentaje || p.customData?.percentage || 0,
      d: p.d,
      color: p.customData?.fill || p.visualStyles?.fillColor || p.fill,
      layer: p.category || p.customData?.layer || targetName,
      visualStyles: {
        fillColor: p.customData?.fill || p.visualStyles?.fillColor || p.fill,
        strokeColor: p.customData?.stroke || p.visualStyles?.strokeColor || p.stroke,
        strokeWidth: p.customData?.strokeWidth || p.visualStyles?.strokeWidth || p.strokeWidth
      },
      customData: p.customData || {}
    }));

    const fallbackProv = mockProvincesData['AR-B'];
    const targetProvinceData: ProvinceData = {
      ...(targetProv || fallbackProv),
      id: targetRouteId,
      name: targetName,
      abbreviation: targetProv?.abbreviation || targetRouteId,
      municipalities: updatedMunicipalities,
      mapTransform: {
        scale: mapEntity.transform.scale,
        panX: mapEntity.transform.translateX,
        panY: mapEntity.transform.translateY
      }
    };

    if (onUpdateProvince) {
      onUpdateProvince(targetProvinceData);
    }

    const serializedTarget = JSON.stringify({
      ...mapEntity,
      id: targetRouteId,
      name: targetName
    });

    safeSetItem(`argentina_advanced_canvas_map_${targetRouteId}`, serializedTarget);

    setIsAssociateModalOpen(false);
    showNotify(`[🔗] Mapa asociado y guardado exitosamente en la ruta "${targetName}" (${targetRouteId}).`);
    alert(`¡Asociación Exitosa!\n\nEste mapa ha sido guardado y asociado a la ruta "${targetName}" (${targetRouteId}). Al seleccionar esa ruta en la app, se mostrará este mapa con todas sus formas vectorizadas actualizadas.`);
  };

  // Alterna el estado colapsable de las sub-listas del Inspector
  const toggleInspectorPickerSection = (key: string) => { // Función conmutadora
    setInspectorPickerSections(prev => ({ ...prev, [key]: !prev[key] })); // Invierte el estado
  }; // Fin de toggleInspectorPickerSection

  // SINCRONIZAR EL MAPA EN EDICIÓN Y SELECCIÓN DE SUBDIVISIÓN EN MONTAJE O CAMBIO DE REGIÓN
  useEffect(() => {
    const provKey = selectedProvince?.id || 'country'; // Clave de almacenamiento por región
    const saved = safeGetItem(`argentina_advanced_canvas_map_${provKey}`); // Carga mapa persistido
    let entityToSet: VectorMapEntity; // Variable para almacenar la entidad resultante

    if (saved) { // Si existe en localStorage
      try { // Intenta decodificar
        const parsed = JSON.parse(saved); // Parsea JSON
        if (parsed && Array.isArray(parsed.paths) && parsed.paths.length > 0) { // Si es válido y no está vacío
          entityToSet = parsed; // Usa el mapa guardado
        } else { // Si está vacío
          entityToSet = getInitialContextualMap(selectedProvince, urlParentId); // Genera mapa contextual
        }
      } catch (e) { // En caso de fallo
        console.error("Error al sincronizar mapa guardado:", e); // Registra el error
        entityToSet = getInitialContextualMap(selectedProvince, urlParentId); // Fallback contextual
      }
    } else { // Si no hay entrada guardada
      entityToSet = getInitialContextualMap(selectedProvince, urlParentId); // Carga el mapa activo de la región
    }

    // Herencia Automática: Si la entidad no posee polígonos, fuerza las provincias nativas con datos completos
    if (!entityToSet.paths || entityToSet.paths.length === 0) { // Verifica si la lista de polígonos está vacía
      entityToSet.paths = provincePaths.map(p => ({ // Inyecta las 24 provincias con metadatos y colores editables
        id: p.id, // ID único
        name: p.name, // Nombre
        d: p.d, // Geometría SVG
        category: 'provincia', // Categoría
        ownerId: 'system', // Propietario del sistema
        visualStyles: { // Estilos de color de relleno y contorno
          fillColor: (p as any).color || '#10b981', // Color de relleno
          strokeColor: '#0f172a', // Color de borde
          strokeWidth: 1.5 // Grosor del contorno
        }, // Fin de visualStyles
        customData: { // Metadatos para el Inspector de Trazo
          valor: (p as any).value !== undefined ? (p as any).value : 35, // Valor o métrica
          porcentaje: (p as any).percentage !== undefined ? (p as any).percentage : 18, // Porcentaje indicativo
          fill: (p as any).color || '#10b981', // Color
          layer: 'provincia' // Capa
        } // Fin de customData
      })); // Fin del mapeo de herencia
    } // Fin de condicional de herencia

    setMapEntity(entityToSet); // Actualiza el estado del mapa en el Súper Editor

    // Sincronización Inteligente de la Selección para MUNDO, Argentina y Provincias
    if (selectedSubdivisionId && entityToSet.paths.some(p => p.id === selectedSubdivisionId)) { // Si existe una subdivisión seleccionada válida
      setSelectedPathIds([selectedSubdivisionId]); // Marca la subdivisión activa seleccionada
    } else if (selectedProvince && (selectedProvince.id === 'COUNTRY_MAP' || selectedProvince.id === 'country' || selectedProvince.id === 'AR')) {
      // Si la región es Argentina, busca el trazo de Argentina 'AR' o 'country' o la primera provincia
      const arPath = entityToSet.paths.find(p => p.id === 'AR' || p.id === 'country' || p.id === 'COUNTRY_MAP');
      if (arPath) {
        setSelectedPathIds([arPath.id]);
        setEditingPathData({
          id: arPath.id,
          name: arPath.name || 'Argentina',
          d: arPath.d,
          category: arPath.category || 'pais',
          color: arPath.customData?.fill || arPath.visualStyles?.fillColor || '#10b981',
          value: Number(arPath.customData?.valor || 45000000),
          percentage: Number(arPath.customData?.porcentaje || 100)
        });
      } else {
        setSelectedPathIds([]); // Limpia la lista si no se encuentra la coincidencia
      }
    } else if (selectedProvince && (selectedProvince.id === 'WORLD' || selectedProvince.id === 'world' || selectedProvince.id === 'WORLD_MAP' || selectedProvince.id === 'MUNDO' || selectedProvince.id === 'mundo' || (selectedProvince as any).category === 'world' || entityToSet.level === 'mundo')) {
      // Si la región activa es MUNDO / Mapa Mundial, remueve cualquier preselección automática de país
      setSelectedPathIds([]); // Sin selección inicial en el mapa mundial
    } else if (selectedProvince && entityToSet.paths.some(p => p.id === selectedProvince.id)) { // Si el ID de la provincia coincide con un vector activo
      setSelectedPathIds([selectedProvince.id]); // Selecciona el vector de la provincia activa (ej: AR-B)
    } else { // Si no hay selección explícita por subdivisión o región
      setSelectedPathIds([]); // Mantiene limpia la lista de selección para no preseleccionar ningún elemento indeseado
    } // Fin de condicional de selección inteligente

    // Auto-Fill Inmediato del textarea en montaje
    try {
      setRawJsonText(JSON.stringify(entityToSet.paths, null, 2)); // Formatea el JSON de polígonos
    } catch (err) {
      console.error("Error al formatear JSON inicial:", err); // Error
    }
  }, [selectedProvince?.id, urlParentId, selectedSubdivisionId]); // Escucha cambios en la región o la subdivisión seleccionada

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

  // =========================================================================
  // SISTEMA DE HISTORIAL (UNDO / REDO) Y SNAPSHOT INICIAL DE SEGURIDAD
  // =========================================================================
  // PILA DE ESTADOS PARA HISTORIAL DE DESHACER / REHACER (DESHACER Y REHACER ACCIONES)
  const [historyStack, setHistoryStack] = useState<VectorMapEntity[]>([]); // Almacena la secuencia de estados del mapa
  const [historyIndex, setHistoryIndex] = useState<number>(-1); // Puntero al índice del estado activo en el historial
  const initialMapSnapshotRef = useRef<VectorMapEntity | null>(null); // Copia del mapa original no guardado (Permite "Cancelar sin guardar")
  const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState<boolean>(false); // Visibilidad del panel flotante con la lista del historial

  // REGISTRO Y CONGELAMIENTO AUTOMÁTICO DE SNAPSHOT INICIAL Y PILA DE HISTORIAL
  useEffect(() => {
    if (!mapEntity) return; // Si no hay entidad válida, omite
    const cloned = JSON.parse(JSON.stringify(mapEntity)); // Clona profundamente la entidad de mapa
    
    // Si aún no se ha guardado el snapshot original inicial, congela este primer estado para el botón "Cancelar sin guardar"
    if (!initialMapSnapshotRef.current) {
      initialMapSnapshotRef.current = cloned; // Guarda la referencia original de arrepentimiento
    }

    // Inicializa la pila de historial si se encuentra vacía
    if (historyStack.length === 0) {
      setHistoryStack([cloned]); // Establece el primer estado en la pila
      setHistoryIndex(0); // Posiciona el puntero en el estado 0
      return;
    }

    // Captura cambios reactivos para el Historial (Undo / Redo):
    // Compara el estado actual de mapEntity con la versión almacenada en la posición historyIndex
    const currentHistoryState = historyStack[historyIndex]; // Recupera el estado registrado actualmente
    if (currentHistoryState && JSON.stringify(currentHistoryState) !== JSON.stringify(mapEntity)) { // Si difieren
      // Trunca cualquier camino alternativo creado tras haber deshecho acciones previamente
      const newStack = [...historyStack.slice(0, historyIndex + 1), cloned]; // Añade el nuevo estado al final
      // Limita el historial a los últimos 30 pasos para no sobrecargar el almacenamiento ni la memoria RAM
      const trimmedStack = newStack.length > 30 ? newStack.slice(newStack.length - 30) : newStack; // Trunca si excede 30
      setHistoryStack(trimmedStack); // Actualiza la pila de estados
      setHistoryIndex(trimmedStack.length - 1); // Desplaza el puntero al último estado recién añadido
    }
  }, [mapEntity]); // Se ejecuta cada vez que el mapa vectorial sufre alguna modificación

  // FUNCIÓN PARA DESHACER LA ÚLTIMA ACCIÓN (UNDO / DESHACER)
  const handleUndo = () => {
    if (historyIndex > 0) { // Si existen estados previos en la pila
      const prevIndex = historyIndex - 1; // Calcula el índice anterior
      const targetState = JSON.parse(JSON.stringify(historyStack[prevIndex])); // Clona el estado previo
      setHistoryIndex(prevIndex); // Retrocede el puntero del historial
      setMapEntity(targetState); // Restaura el estado del mapa en React
      showNotify(`[↩️] Acción deshecha (Paso ${prevIndex + 1} de ${historyStack.length})`); // Muestra notificación
    }
  }; // Fin de handleUndo

  // FUNCIÓN PARA REHACER LA ACCIÓN PREVIAMENTE DESHECHA (REDO / REHACER)
  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) { // Si existen estados futuros disponibles
      const nextIndex = historyIndex + 1; // Calcula el índice siguiente
      const targetState = JSON.parse(JSON.stringify(historyStack[nextIndex])); // Clona el estado futuro
      setHistoryIndex(nextIndex); // Avanza el puntero del historial
      setMapEntity(targetState); // Aplica el estado en React
      showNotify(`[↪️] Acción rehecha (Paso ${nextIndex + 1} de ${historyStack.length})`); // Notifica al usuario
    }
  }; // Fin de handleRedo

  // FUNCIÓN PARA LIMPIAR EL HISTORIAL Y ELIMINAR PASOS ANTIGUOS (LIBERAR MEMORIA Y ESPACIO A FUTURO)
  const handleClearHistory = () => {
    if (mapEntity) { // Si existe el mapa activo
      const currentState = JSON.parse(JSON.stringify(mapEntity)); // Clona la versión presente
      setHistoryStack([currentState]); // Reduce la pila únicamente al estado actual
      setHistoryIndex(0); // Resetea el puntero al origen 0
      setIsHistoryMenuOpen(false); // Cierra el menú desplegable del historial
      showNotify(`[🧹] Historial limpiado: Se conservó el estado actual y se liberó espacio de memoria.`); // Confirmación
    }
  }; // Fin de handleClearHistory

  // FUNCIÓN "CANCELAR SIN GUARDAR" (DESCARTAR CAMBIOS NO GUARDADOS Y VOLVER AL ESTADO ORIGINAL)
  const handleCancelUnsavedChanges = () => {
    if (!initialMapSnapshotRef.current) return; // Si no hay referencia inicial, cancela
    const originalSnapshot = JSON.parse(JSON.stringify(initialMapSnapshotRef.current)); // Clona el mapa original sin guardar
    
    // Verifica si el mapa actual ya es idéntico a la versión original de partida
    if (JSON.stringify(originalSnapshot) === JSON.stringify(mapEntity)) {
      showNotify("[ℹ️] No hay cambios pendientes por descartar."); // Aviso al usuario
      return;
    }

    setMapEntity(originalSnapshot); // Restaura el mapa al snapshot inicial
    setSelectedPathIds([]); // Limpia la lista de trazos seleccionados
    showNotify("[↩️] Cambios descartados: El mapa volvió a su estado inicial sin guardar."); // Notifica al usuario
  }; // Fin de handleCancelUnsavedChanges

  // ESCUCHADOR DE ATAJOS DE TECLADO PARA DESHACER (CTRL+Z) Y REHACER (CTRL+Y / CTRL+SHIFT+Z)
  useEffect(() => {
    const handleUndoRedoKeyDown = (e: KeyboardEvent) => {
      // Si el foco del usuario está dentro de un campo de texto o input, omite los atajos globales del editor
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.tagName === 'SELECT' || 
        (activeElement as HTMLElement).isContentEditable
      )) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { // Si se presiona Ctrl + Z o Cmd + Z
        if (e.shiftKey) { // Si además se presiona Shift (Ctrl + Shift + Z)
          e.preventDefault();
          handleRedo(); // Dispara Rehacer
        } else { // Si solo es Ctrl + Z
          e.preventDefault();
          handleUndo(); // Dispara Deshacer
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { // Si se presiona Ctrl + Y
        e.preventDefault();
        handleRedo(); // Dispara Rehacer
      }
    };

    window.addEventListener('keydown', handleUndoRedoKeyDown); // Registra el escuchador de eventos
    return () => window.removeEventListener('keydown', handleUndoRedoKeyDown); // Desregistra al desmontar
  }, [historyIndex, historyStack]);

  // ESTADO DE SELECCIÓN DE PATHS (SELECCIÓN MÚLTIPLE COMPATIBLE)
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]); // Lista de IDs seleccionados
  
  // ESTADOS DE TRANSFORMACIÓN E INTERACCIÓN
  const [aspectRatioLocked, setAspectRatioLocked] = useState<boolean>(mapEntity.transform.aspectRatioLocked ?? true); // Candado 🔒
  const [notification, setNotification] = useState<string | null>(null); // Mensajes emergentes de confirmación
  const [zoomLevel, setZoomLevel] = useState<number>(1); // Nivel de zoom de la vista de trabajo
  
  // ESTADOS DE FORMULARIO DE EDICIÓN DE PATH COMPLETO (COLOR, VALOR, PORCENTAJE, CATEGORÍA Y GEOMETRÍA)
  const [editingPathData, setEditingPathData] = useState<{
    id: string;
    name: string;
    d: string;
    category: string;
    color: string;
    value: number;
    percentage: number;
  }>({
    id: '',
    name: '',
    d: '',
    category: '',
    color: '#10b981',
    value: 0,
    percentage: 0
  });

  // ESTADO DE PEGANO RÁPIDO DE TRAZADOS SVG
  const [quickPathD, setQuickPathD] = useState<string>(''); // Código path d pegado
  const [quickPathName, setQuickPathName] = useState<string>(''); // Nombre rápido del trazado

  // ESTADOS DE CONTROL DE BORDES Y LÍNEAS RESPONSIVAS VECTORIALES
  const [globalStrokeMode, setGlobalStrokeMode] = useState<'none' | 'thin' | 'medium' | 'thick' | 'custom'>('thin'); // Modo de línea ('none', 'thin', 'medium', 'thick')
  const [globalStrokeWidth, setGlobalStrokeWidth] = useState<number>(0.5); // Grosor predeterminado (0.5px ultra-fino)
  const [globalStrokeColor, setGlobalStrokeColor] = useState<string>('#0f172a'); // Color de contorno slate
  const [nudgeStep, setNudgeStep] = useState<number>(5); // Paso de desplazamiento en píxeles (1px, 5px, 10px, 20px)

  // ESTADOS PARA LA HERRAMIENTA PERFECCIONADOR DE SILUETA (4 FUENTES, VISTA PREVIA Y MUTACIÓN SEGURA)
  const [previewSilhouette, setPreviewSilhouette] = useState<string | null>(null); // Trazo unificado en vista previa sobre el lienzo
  const [silhouetteInputMethod, setSilhouetteInputMethod] = useState<'paste' | 'file' | 'image' | 'preset'>('paste'); // Opción de entrada activa (1 de 4)
  const [silhouettePasteText, setSilhouettePasteText] = useState<string>(''); // Texto ingresado en el Textarea
  const [silhouettePresetRoute, setSilhouettePresetRoute] = useState<string>('ARG_24'); // Ruta seleccionada en el selector desplegable

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

  // ESTADO Y HANDLERS PARA LA HERRAMIENTA MANITO (ARRASTRAR Y MOVER EL MAPA LIBREMENTE EN 360°)
  const [isPanToolActive, setIsPanToolActive] = useState<boolean>(false); // Activa la herramienta Manito
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false); // Estado de arrastre activo
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // Posición inicial del cursor
  const [initialTransformPos, setInitialTransformPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // Posición X/Y previa del mapa

  // EFECTO DE ARRASTRE Y REDIMENSIONADO EN TIEMPO REAL PARA LIENZO Y ELEMENTOS SELECCIONADOS
  useEffect(() => {
    if (!isDraggingCanvas && !isDraggingElement && !isResizingElement) return; // Si no hay acción activa, no suscribe oyentes

    // Manejador del movimiento global del puntero
    const handleGlobalPointerMove = (e: PointerEvent) => {
      // 1. SI ESTÁ ACTIVA LA HERRAMIENTA MANITO (ARRASTRAR LIENZO COMPLETO)
      if (isDraggingCanvas) {
        const deltaX = Math.round((e.clientX - dragStartPos.x) / zoomLevel); // Desplazamiento X
        const deltaY = Math.round((e.clientY - dragStartPos.y) / zoomLevel); // Desplazamiento Y

        setMapEntity(prev => ({
          ...prev,
          transform: {
            ...prev.transform,
            translateX: initialTransformPos.x + deltaX, // Desplaza en X
            translateY: initialTransformPos.y + deltaY  // Desplaza en Y
          }
        }));
        return;
      }

      const currentSvgPos = getSvgCoordinates(e); // Coordenadas del cursor en el espacio del SVG

      // 2. SI SE ESTÁ MOVIENDO / ACOMODANDO EL ELEMENTO SELECCIONADO (DRAG TO MOVE)
      if (isDraggingElement) {
        const deltaX = currentSvgPos.x - elementDragStartPos.x; // Delta horizontal acumulado
        const deltaY = currentSvgPos.y - elementDragStartPos.y; // Delta vertical acumulado

        setMapEntity(prev => ({
          ...prev,
          paths: prev.paths.map(p => {
            if (selectedPathIds.includes(p.id) && initialPathsD[p.id]) { // Si forma parte de la selección
              return {
                ...p,
                d: translatePathD(initialPathsD[p.id], deltaX, deltaY) // Traslada quirúrgicamente las coordenadas del trazo
              };
            }
            return p;
          })
        }));
        return;
      }

      // 3. SI SE ESTÁ REDIMENSIONANDO / ESCALANDO EL ELEMENTO MEDIANTE NODOS DE ESQUINA (DRAG TO RESIZE)
      if (isResizingElement && initialSelectionBBox) {
        const startBox = initialSelectionBBox; // Bounding box original al pulsar el tirador
        let scaleX = 1; // Factor de escala X por defecto
        let scaleY = 1; // Factor de escala Y por defecto
        let anchorX = startBox.x; // Anclaje por defecto X
        let anchorY = startBox.y; // Anclaje por defecto Y

        if (isResizingElement === 'se') { // Esquina inferior derecha -> Anclaje en esquina superior izquierda
          anchorX = startBox.x;
          anchorY = startBox.y;
          const newWidth = Math.max(10, currentSvgPos.x - startBox.x);
          const newHeight = Math.max(10, currentSvgPos.y - startBox.y);
          scaleX = newWidth / startBox.width;
          scaleY = newHeight / startBox.height;
        } else if (isResizingElement === 'sw') { // Esquina inferior izquierda -> Anclaje en esquina superior derecha
          anchorX = startBox.x + startBox.width;
          anchorY = startBox.y;
          const newWidth = Math.max(10, (startBox.x + startBox.width) - currentSvgPos.x);
          const newHeight = Math.max(10, currentSvgPos.y - startBox.y);
          scaleX = newWidth / startBox.width;
          scaleY = newHeight / startBox.height;
        } else if (isResizingElement === 'ne') { // Esquina superior derecha -> Anclaje en esquina inferior izquierda
          anchorX = startBox.x;
          anchorY = startBox.y + startBox.height;
          const newWidth = Math.max(10, currentSvgPos.x - startBox.x);
          const newHeight = Math.max(10, (startBox.y + startBox.height) - currentSvgPos.y);
          scaleX = newWidth / startBox.width;
          scaleY = newHeight / startBox.height;
        } else if (isResizingElement === 'nw') { // Esquina superior izquierda -> Anclaje en esquina inferior derecha
          anchorX = startBox.x + startBox.width;
          anchorY = startBox.y + startBox.height;
          const newWidth = Math.max(10, (startBox.x + startBox.width) - currentSvgPos.x);
          const newHeight = Math.max(10, (startBox.y + startBox.height) - currentSvgPos.y);
          scaleX = newWidth / startBox.width;
          scaleY = newHeight / startBox.height;
        }

        if (aspectRatioLocked) { // Si el candado de proporción está activo
          const uniformScale = Math.max(scaleX, scaleY); // Escala uniforme manteniendo proporción
          scaleX = uniformScale;
          scaleY = uniformScale;
        }

        setMapEntity(prev => ({
          ...prev,
          paths: prev.paths.map(p => {
            if (selectedPathIds.includes(p.id) && initialPathsD[p.id]) { // Si es un elemento seleccionado
              return {
                ...p,
                d: scalePathD(initialPathsD[p.id], scaleX, scaleY, anchorX, anchorY) // Escala las coordenadas del trazado respecto al anclaje
              };
            }
            return p;
          })
        }));
      }
    };

    // Manejador de liberación del puntero
    const handleGlobalPointerUp = () => {
      setIsDraggingCanvas(false); // Finaliza arrastre del lienzo
      if (isDraggingElement || isResizingElement) { // Si se movió o redimensionó algún elemento
        setIsDraggingElement(false); // Desactiva movimiento
        setIsResizingElement(null); // Desactiva redimensionado
        setMapEntity(latest => {
          safeSetItem('argentina_advanced_canvas_map', JSON.stringify(latest)); // Persiste los cambios en almacenamiento local
          return latest;
        });
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove); // Oyente de movimiento
    window.addEventListener('pointerup', handleGlobalPointerUp);     // Oyente de soltar
    window.addEventListener('pointercancel', handleGlobalPointerUp); // Oyente de cancelar

    return () => { // Limpieza de oyentes
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [isDraggingCanvas, isDraggingElement, isResizingElement, dragStartPos, initialTransformPos, zoomLevel, elementDragStartPos, initialPathsD, initialSelectionBBox, selectedPathIds, aspectRatioLocked, mapEntity.transform]);

  // EFECTO DE MIGRACIÓN Y DESPLAZAMIENTO ULTRA-FINO CON TECLAS DE DIRECCIÓN (FLECHAS DEL TECLADO)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canEditMap || selectedPathIds.length === 0) return;
      const activeElem = document.activeElement;
      if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA' || activeElem.getAttribute('contenteditable') === 'true')) {
        return;
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? nudgeStep * 4 : nudgeStep;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        handleNudgeSelectedPaths(dx, dy);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canEditMap, selectedPathIds, nudgeStep]);


  // Handler para iniciar el arrastre con la herramienta Manito en el Canva SVG
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (isPanToolActive || e.button === 1 || e.button === 2) { // Si está activa la manito o se presiona rueda/botón derecho
      setIsDraggingCanvas(true); // Activa el arrastre
      setDragStartPos({ x: e.clientX, y: e.clientY }); // Guarda posición inicial del cursor
      setInitialTransformPos({ // Guarda coordenadas espaciales previas
        x: mapEntity.transform.translateX,
        y: mapEntity.transform.translateY
      });
      e.preventDefault(); // Previene arrastre por defecto
    }
  };

  // FUNCIÓN PARA CENTRAR EL ZOOM Y LA PANTALLA EN EL OBJETO O POLÍGONO SELECCIONADO
  const handleFocusOnSelection = () => {
    if (!selectionBBox || selectedPaths.length === 0) { // Si no hay selección
      showNotify("Selecciona un objeto o polígono para centrar el zoom."); // Avisa al usuario
      return; // Detiene la función
    }

    // 1. Calcula el centro X y Y de la selección en coordenadas del plano
    const selCenterX = selectionBBox.x + selectionBBox.width / 2;
    const selCenterY = selectionBBox.y + selectionBBox.height / 2;

    // 2. Calcula el centro general del lienzo o conjunto vectorial
    const totalBBox = mapEntity.paths.length > 0 
      ? getMultiplePathsBBox(mapEntity.paths.map(p => ({ d: p.d }))) 
      : { x: 0, y: 0, width: 800, height: 600 };

    const totalCenterX = totalBBox.x + totalBBox.width / 2;
    const totalCenterY = totalBBox.y + totalBBox.height / 2;

    // 3. Calcula el vector de desplazamiento requerido para centrar la selección
    const targetPanX = Math.round(totalCenterX - selCenterX);
    const targetPanY = Math.round(totalCenterY - selCenterY);

    // 4. Calcula la escala/zoom recomendada para encuadrar la selección con holgura
    const selSize = Math.max(selectionBBox.width, selectionBBox.height);
    const totalSize = Math.max(totalBBox.width, totalBBox.height);
    let targetZoom = 1.8;
    if (selSize > 0 && totalSize > 0) {
      const ratio = totalSize / selSize;
      targetZoom = Math.min(Math.max(Number((ratio * 0.45).toFixed(2)), 1.2), 8); // Ajusta zoom entre 1.2x y 8x
    }

    // 5. Aplica la nueva transformación espacial centrada
    setMapEntity(prev => ({
      ...prev,
      transform: {
        ...prev.transform,
        translateX: targetPanX,
        translateY: targetPanY
      }
    }));
    setZoomLevel(targetZoom); // Eleva el zoom directamente al elemento centrado
    showNotify(`Zoom centrado en: ${selectedPaths.map(p => p.name || p.id).join(', ')}`); // Confirmación
  };

  // SINCRONIZACIÓN CON EL INSPECTOR DE PROPIEDADES CUANDO CAMBIA LA SELECCIÓN
  useEffect(() => {
    if (selectedPaths.length === 1) { // Si hay exactamente un elemento seleccionado
      const p = selectedPaths[0]; // Obtiene la referencia del elemento seleccionado
      setEditingPathData({ // Inyecta todos sus campos y estilos en el formulario inspector
        id: p.id,
        name: p.name,
        d: p.d,
        category: p.category || 'provincia',
        color: p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#10b981',
        value: Number(p.customData?.valor || p.customData?.value || 0),
        percentage: Number(p.customData?.porcentaje || p.customData?.percentage || 0)
      });
    } else { // Si no hay selección o hay selección múltiple
      setEditingPathData({ id: '', name: '', d: '', category: '', color: '#10b981', value: 0, percentage: 0 }); // Limpia el estado
    }
  }, [selectedPathIds, selectedPaths]); // Escucha cambios en la selección de trazos

  // SELECCIÓN O DESELECCIÓN DE UN TRAZO VECTORIAL CON SINCRONIZACIÓN BIDIRECCIONAL DE RUTA Y SUBDIVISIÓN
  const handleToggleSelectPath = (id: string, isMulti: boolean) => {
    if (isMulti) { // Si se mantiene presionada la tecla Shift/Cmd para selección múltiple
      setSelectedPathIds(prev => { // Actualiza el arreglo de IDs seleccionados
        const next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]; // Alterna selección
        if (next.length === 1 && onSelectSubdivision) { // Si queda un único elemento
          onSelectSubdivision(next[0]); // Comunica la subdivisión activa a la aplicación
        }
        return next; // Retorna la lista actualizada
      });
    } else { // Selección simple individual
      setSelectedPathIds([id]); // Establece el ID único
      if (onSelectSubdivision) { // Si el callback existe
        onSelectSubdivision(id); // Sincroniza la subdivisión seleccionada con la app y el selector de ruta
      }
    }
  };

  // SELECCIONAR O DESELECCIONAR TODOS LOS ELEMENTOS DEL CANVAS CON NOTIFICACIÓN Y SINCRONIZACIÓN
  const handleSelectAll = () => { // Función para seleccionar o deseleccionar la totalidad de elementos en el lienzo
    if (!mapEntity.paths || mapEntity.paths.length === 0) return; // Si no hay elementos vectoriales, ignora
    if (selectedPathIds.length === mapEntity.paths.length) { // Si todos los elementos ya están seleccionados
      setSelectedPathIds([]); // Limpia la selección dejando 0 elementos activos
      showNotify("[ℹ️] Selección despejada: 0 elementos seleccionados."); // Notificación de confirmación
    } else { // Si faltan elementos por seleccionar
      const allIds = mapEntity.paths.map(p => p.id); // Extrae la lista completa de IDs de los trazados
      setSelectedPathIds(allIds); // Asigna la totalidad de IDs a la selección activa
      if (allIds.length > 0) { // Si la lista no está vacía
        const firstItem = mapEntity.paths[0]; // Toma el primer trazado vectorial como referencia
        setEditingPathData({ // Inyecta datos por defecto en el panel inspector
          id: firstItem.id,
          name: firstItem.name,
          d: firstItem.d,
          category: firstItem.category || 'provincia',
          color: firstItem.customData?.fill || firstItem.visualStyles?.fillColor || firstItem.fill || '#10b981',
          value: Number(firstItem.customData?.valor || firstItem.customData?.value || 0),
          percentage: Number(firstItem.customData?.porcentaje || firstItem.customData?.percentage || 0)
        });
      }
      showNotify(`[☑️] Se seleccionaron todos los ${allIds.length} elementos/porciones del mapa.`); // Muestra notificación explicativa
    }
  }; // Fin de handleSelectAll

  // FUNCIÓN PARA RENOMBRAR EN LOTE TODOS LOS ELEMENTOS SELECCIONADOS
  const handleBatchRename = (baseName: string, isSequential: boolean = true) => { // Renombra masivamente los elementos activos
    if (!canEditMap || selectedPathIds.length === 0) return; // Verifica permisos de edición RBAC y selección activa
    const cleanBase = baseName.trim(); // Sanitiza la cadena ingresada descartando espacios
    if (!cleanBase) return; // Cancela si el texto ingresado está vacío

    setMapEntity(prev => ({ // Actualiza la entidad del mapa vectorial en React
      ...prev, // Preserva la configuración anterior del mapa
      paths: prev.paths.map((p) => { // Recorre cada trazado vectorial individual
        if (selectedPathIds.includes(p.id)) { // Si el elemento pertenece a la selección activa
          const selectedIndex = selectedPathIds.indexOf(p.id); // Encuentra su índice dentro del grupo seleccionado
          const newName = !isSequential || selectedPathIds.length === 1 
            ? cleanBase 
            : `${cleanBase} ${selectedIndex + 1}`; // Aplica el nombre base único o numerado (ej: Islas Malvinas 1, Islas Malvinas 2)
          return {
            ...p, // Preserva la forma vectorial 'd', color, métricas y metadatos intactos
            name: newName // Actualiza únicamente la etiqueta de nombre
          };
        }
        return p; // Mantiene intactos los demás elementos del mapa no seleccionados
      }),
      updatedAt: new Date().toISOString() // Inyecta la marca de tiempo de actualización
    }));
    showNotify(`[✏️] Se renombraron ${selectedPathIds.length} elementos con la base "${cleanBase}".`); // Notificación de confirmación
  }; // Fin de handleBatchRename

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

  // ELIMINAR ELEMENTOS SELECCIONADOS DE FORMA ULTRA SEGURA
  const handleDeleteSelectedPaths = (overrideIds?: any) => {
    if (!canEditMap) return;
    const targetIds: string[] = Array.isArray(overrideIds) ? overrideIds : (Array.isArray(selectedPathIds) ? selectedPathIds : []);
    if (targetIds.length === 0) return;

    setMapEntity(prev => ({
      ...prev,
      paths: (prev.paths || []).filter(p => p && p.id && !targetIds.includes(p.id)),
      updatedAt: new Date().toISOString()
    }));
    setSelectedPathIds(prev => (Array.isArray(prev) ? prev.filter(id => !targetIds.includes(id)) : []));
    showNotify(`[✓] Se eliminaron ${targetIds.length} elementos.`);
  };

  // LISTENER TECLADO PARA TECLAS DE ELIMINACIÓN (DELETE/BACKSPACE) Y ATAJO CTRL+A / CMD+A (SELECCIONAR TODO)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { // Escuchador de teclado global
      // Evita interceptar si el usuario escribe en un campo de formulario activo
      const activeElement = document.activeElement;
      const isInput = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.tagName === 'SELECT' || 
        (activeElement as HTMLElement).isContentEditable
      );

      if (isInput) return; // Si hay foco en un input, no intercepta las teclas rápidas

      // 1. Teclas de eliminación (Delete / Backspace)
      if (e.key === 'Delete' || e.key === 'Del' || e.key === 'Backspace') {
        if (selectedPathIds.length > 0) {
          e.preventDefault();
          handleDeleteSelectedPaths();
        }
      }

      // 2. Shortcut Ctrl+A o Cmd+A para "Seleccionar Todo"
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (mapEntity.paths && mapEntity.paths.length > 0) {
          e.preventDefault(); // Evita la selección nativa de texto del navegador
          handleSelectAll(); // Selecciona o deselecciona la totalidad de elementos
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPathIds, canEditMap, mapEntity.paths]);

  // SCROLL AUTOMÁTICO A LA CAPA SELECCIONADA EN LA LISTA IZQUIERDA
  useEffect(() => {
    if (selectedPathIds.length > 0) {
      const firstId = selectedPathIds[0];
      const el = document.getElementById(`adv-layer-item-${firstId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedPathIds]);

  // RENOMBRAR Y GUARDAR CAMBIOS COMPLETOS DE UN TRAZO INDIVIDUAL (ID, NOMBRE, VECTOR SVG, COLOR, VALOR, PORCENTAJE, CATEGORÍA)
  const handleSaveEditingPath = () => {
    if (!canEditMap) return; // Verifica permisos de edición RBAC
    if (selectedPathIds.length !== 1) return; // Verifica que haya exactamente un elemento seleccionado

    const targetId = selectedPathIds[0]; // ID del trazo objetivo
    const updatedPaths = mapEntity.paths.map(p => { // Recorre y mapea cada elemento
      if (p.id === targetId) { // Si coincide con el trazo seleccionado
        const updatedCustomData = { // Prepara los metadatos actualizados
          ...(p.customData || {}), // Mantiene propiedades previas
          valor: editingPathData.value, // Nueva métrica de valor
          porcentaje: editingPathData.percentage, // Nuevo porcentaje
          fill: editingPathData.color, // Nuevo color de relleno
          layer: editingPathData.category // Nueva capa/categoría
        };
        return {
          ...p,
          id: editingPathData.id.trim() || p.id, // Actualiza ID
          name: editingPathData.name.trim() || p.name, // Actualiza Nombre
          d: editingPathData.d.trim() || p.d, // Actualiza trazado SVG
          category: editingPathData.category || p.category, // Actualiza categoría
          visualStyles: { // Actualiza los estilos visuales del polígono
            fillColor: editingPathData.color, // Color de relleno
            strokeColor: p.visualStyles?.strokeColor || '#0f172a', // Contorno
            strokeWidth: p.visualStyles?.strokeWidth || 1.5 // Grosor
          },
          customData: updatedCustomData // Asigna el diccionario de metadatos
        };
      }
      return p; // Retorna sin cambios si no coincide
    });

    const updatedMapEntity: VectorMapEntity = { // Construye la entidad de mapa actualizada
      ...mapEntity, // Hereda estado previo
      paths: updatedPaths, // Reemplaza la lista de polígonos
      updatedAt: new Date().toISOString() // Actualiza marca de tiempo
    };

    setMapEntity(updatedMapEntity); // Actualiza la entidad del mapa en React state

    // Persistencia inmediata para evitar pérdidas al salir o reiniciar
    const provKey = selectedProvince?.id || mapEntity.id || 'country'; // Obtiene la clave de la región activa
    const serialized = JSON.stringify(updatedMapEntity); // Serializa la entidad a JSON
    safeSetItem('argentina_advanced_canvas_map', serialized); // Guarda en clave principal
    safeSetItem(`argentina_advanced_canvas_map_${provKey}`, serialized); // Guarda en clave de provincia/región

    if (onSaveMapEntity) { // Si existe callback externo
      onSaveMapEntity(updatedMapEntity); // Notifica la actualización
    }

    if (selectedProvince && onUpdateProvince) { // Sincroniza con la estructura global de la aplicación
      onUpdateProvince({ // Actualiza los municipios/polígonos de la provincia
        ...selectedProvince,
        municipalities: updatedPaths.map(p => ({
          id: p.id,
          name: p.name,
          value: p.customData?.valor || p.customData?.value || 0,
          percentage: p.customData?.porcentaje || p.customData?.percentage || 0,
          d: p.d,
          color: p.customData?.fill || p.visualStyles?.fillColor || p.fill,
          layer: p.category || selectedProvince.name,
          visualStyles: p.visualStyles,
          customData: p.customData || {}
        }))
      });
    }

    if (editingPathData.id !== targetId) { // Si cambió el ID del trazado
      setSelectedPathIds([editingPathData.id]); // Actualiza la selección activa
    }
    showNotify("[✓] Trazado y metadatos (color, valor, nombre) guardados y sincronizados exitosamente."); // Notifica confirmación
  };

  // LISTA ORDENADA ALFABÉTICAMENTE DE LAS 24 PROVINCIAS NATIVAS DE ARGENTINA PARA EL DESPLEGABLE
  const sortedProvinces = useMemo(() => {
    return [...provincePaths].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, []);

  // BASE DE DATOS Y LISTA DE TERRITORIOS/RUTAS DISPONIBLES EN EL SISTEMA PARA VINCULACIÓN Y SUSTITUCIÓN DE SILUETAS
  const availableTerritories = useMemo(() => {
    const list: Array<{ id: string; name: string; category: string; d: string; value?: number; percentage?: number; color?: string }> = [
      // 1. Países / Regiones Nivel Nacional
      { id: 'AR', name: 'Argentina', category: 'pais', d: provincePaths.map(p => p.d).join(' '), value: 45000000, percentage: 100, color: '#10b981' },
      { id: 'BR', name: 'Brasil', category: 'pais', d: '', value: 214000000, percentage: 100, color: '#3b82f6' },
      { id: 'CL', name: 'Chile', category: 'pais', d: '', value: 19000000, percentage: 100, color: '#ef4444' },
      { id: 'UY', name: 'Uruguay', category: 'pais', d: '', value: 3500000, percentage: 100, color: '#f59e0b' },
      { id: 'CO', name: 'Colombia', category: 'pais', d: '', value: 51000000, percentage: 100, color: '#8b5cf6' },
      { id: 'PE', name: 'Perú', category: 'pais', d: '', value: 33000000, percentage: 100, color: '#ec4899' },
      { id: 'MX', name: 'México', category: 'pais', d: '', value: 126000000, percentage: 100, color: '#10b981' },
      { id: 'ES', name: 'España', category: 'pais', d: '', value: 47000000, percentage: 100, color: '#f97316' },
      { id: 'US', name: 'Estados Unidos', category: 'pais', d: '', value: 331000000, percentage: 100, color: '#06b6d4' },
      // 2. Provincias Nativas de Argentina (24 A-Z) con su propiedad 'd' (perímetro exterior único)
      ...provincePaths.map(p => {
        const foundData = (allProvinces && allProvinces[p.id]) || mockProvincesData[p.id];
        return {
          id: p.id,
          name: p.name,
          category: 'provincia',
          d: p.d, // PROPAGACIÓN EXCLUSIVA DEL STRING 'd' DEL PERÍMETRO EXTERIOR
          value: (foundData as any)?.value || (p as any)?.value || 35,
          percentage: (foundData as any)?.percentage || (p as any)?.percentage || 18,
          color: (foundData as any)?.color || (p as any)?.color || '#10b981'
        };
      })
    ];

    // 3. Añade Departamentos y Municipios con contorno 'd' definido
    const sourceProvinces = allProvinces || mockProvincesData;
    if (sourceProvinces) {
      Object.values(sourceProvinces).forEach(provData => {
        if (provData && Array.isArray(provData.municipalities)) {
          provData.municipalities.forEach(muni => {
            if (muni && muni.d && muni.name) {
              list.push({
                id: muni.id || `muni-${muni.name}`,
                name: `${muni.name} (${provData.name})`,
                category: 'departamento',
                d: muni.d,
                value: muni.value || 0,
                percentage: muni.percentage || 0,
                color: muni.color || '#3b82f6'
              });
            }
          });
        }
      });
    }

    return list;
  }, [allProvinces]);

  // CONVIERTE PUNTOS DE PANTALLA (e.clientX, e.clientY) A COORDENADAS INTERNAS DEL GRUPO SVG
  const getSvgCoordinates = (e: React.PointerEvent | PointerEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 }; // Si no existe referencia al elemento SVG, retorna origen
    const pt = svgRef.current.createSVGPoint(); // Crea un punto SVG matricial
    pt.x = e.clientX; // Asigna posición X del cursor en la ventana
    pt.y = e.clientY; // Asigna posición Y del cursor en la ventana
    const ctm = svgRef.current.getScreenCTM(); // Obtiene la matriz de transformación de la pantalla al SVG
    if (ctm) {
      const svgPt = pt.matrixTransform(ctm.inverse()); // Invierte la matriz para mapear a coordenadas globales del SVG
      // Cancela el desplazamiento (translateX/translateY) y escala del grupo SVG para obtener coordenadas relativas del canvas
      const groupX = (svgPt.x - mapEntity.transform.translateX) / (mapEntity.transform.scale || 1);
      const groupY = (svgPt.y - mapEntity.transform.translateY) / (mapEntity.transform.scale || 1);
      return { x: groupX, y: groupY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  // FUNCIÓN PARA ESCALAR EL TRAZO SELECCIONADO AL PORCENTAJE O FACTOR INDICADO
  const handleScaleSelectedPaths = (factor: number) => {
    if (!canEditMap || selectedPathIds.length === 0 || !selectionBBox) return; // Si no hay permisos o selección, detiene
    const centerX = selectionBBox.x + selectionBBox.width / 2; // Centro X de la selección
    const centerY = selectionBBox.y + selectionBBox.height / 2; // Centro Y de la selección

    setMapEntity(prev => {
      const updatedEntity = {
        ...prev,
        paths: prev.paths.map(p => {
          if (selectedPathIds.includes(p.id)) { // Si el polígono está seleccionado
            return {
              ...p,
              d: scalePathD(p.d, factor, factor, centerX, centerY) // Escala uniformemente en X/Y respecto al centro
            };
          }
          return p;
        }),
        updatedAt: new Date().toISOString()
      };
      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity)); // Guarda en almacenamiento local
      return updatedEntity;
    });
    showNotify(`[📐] Tamaño del trazo escalado al ${(factor * 100).toFixed(0)}%`);
  };

  // FUNCIÓN PARA AUTO-ACOMODAR Y CENTRAR EL TRAZO SELECCIONADO AL TAMAÑO DEL LIENZO O MAPA GENERAL
  const handleFitSelectedPathToCanvas = () => {
    if (!canEditMap || selectedPathIds.length === 0) return; // Verifica permisos
    const targetBBox = mapEntity.paths.length > 0
      ? getMultiplePathsBBox(mapEntity.paths.map(p => ({ d: p.d })))
      : { x: 0, y: 0, width: 800, height: 600 }; // Bounding box del lienzo

    setMapEntity(prev => {
      const updatedEntity = {
        ...prev,
        paths: prev.paths.map(p => {
          if (selectedPathIds.includes(p.id)) { // Si el elemento está seleccionado
            return {
              ...p,
              d: fitPathToBBox(p.d, targetBBox) // Ajusta y redimensiona para encajar dentro del mapa
            };
          }
          return p;
        }),
        updatedAt: new Date().toISOString()
      };
      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));
      return updatedEntity;
    });
    showNotify(`[🎯] Trazo auto-acomodado al tamaño del lienzo.`);
  };

  // FUNCIÓN PARA ACOMODAR / MOVER (NUDGE) EL OBJETO SELECCIONADO EN DIRECCIONES CARDINALES
  const handleNudgeSelectedPaths = (deltaX: number, deltaY: number) => {
    if (!canEditMap || selectedPathIds.length === 0) return; // Verifica permisos
    setMapEntity(prev => {
      const updatedEntity = {
        ...prev,
        paths: prev.paths.map(p => {
          if (selectedPathIds.includes(p.id)) { // Si el elemento está seleccionado
            return {
              ...p,
              d: translatePathD(p.d, deltaX, deltaY) // Desplaza en el plano X y Y
            };
          }
          return p;
        }),
        updatedAt: new Date().toISOString()
      };
      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));
      return updatedEntity;
    });
  };

  // FUNCIÓN PARA CENTRAR EL TRAZO SELECCIONADO EXACTAMENTE EN EL CENTRO DEL LIENZO O MAPA
  const handleCenterSelectedPathOnCanvas = () => {
    if (!canEditMap || selectedPathIds.length === 0 || !selectionBBox) return;
    const mapBBox = mapEntity.paths.length > 0
      ? getMultiplePathsBBox(mapEntity.paths.map(p => ({ d: p.d })))
      : { x: 0, y: 0, width: 800, height: 600 };

    const canvasCenterX = mapBBox.x + mapBBox.width / 2;
    const canvasCenterY = mapBBox.y + mapBBox.height / 2;

    const selectionCenterX = selectionBBox.x + selectionBBox.width / 2;
    const selectionCenterY = selectionBBox.y + selectionBBox.height / 2;

    const deltaX = canvasCenterX - selectionCenterX;
    const deltaY = canvasCenterY - selectionCenterY;

    handleNudgeSelectedPaths(deltaX, deltaY);
    showNotify(`[🎯] Elemento centrado en el lienzo en (X: ${Math.round(canvasCenterX)}, Y: ${Math.round(canvasCenterY)})`);
  };

  // FUNCIÓN PARA APLICAR GROSOR DE LÍNEA Y TIPO DE BORDE A TODOS LOS TRAZOS DEL MAPA
  const handleApplyGlobalStrokeToAllPaths = (strokeW: number, strokeColorVal?: string) => {
    if (!canEditMap) return;
    setMapEntity(prev => {
      const updatedEntity = {
        ...prev,
        paths: prev.paths.map(p => ({
          ...p,
          strokeWidth: strokeW,
          stroke: strokeW === 0 ? 'none' : (strokeColorVal || p.stroke || globalStrokeColor),
          visualStyles: {
            ...p.visualStyles,
            strokeWidth: strokeW,
            strokeColor: strokeW === 0 ? 'none' : (strokeColorVal || p.visualStyles?.strokeColor || globalStrokeColor)
          },
          customData: {
            ...(p.customData || {}),
            strokeWidth: strokeW,
            stroke: strokeW === 0 ? 'none' : (strokeColorVal || p.customData?.stroke || globalStrokeColor)
          }
        })),
        updatedAt: new Date().toISOString()
      };
      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));
      return updatedEntity;
    });
    showNotify(`[✏️] Bordes de todo el mapa actualizados a ${strokeW === 0 ? '100% LISO (Sin Bordes)' : strokeW + 'px'}`);
  };

  // FUNCIÓN PARA COPIAR EL ESTILO Y GROSOR DE BORDE DE LOS OTROS OBJETOS VECINOS AL OBJETO SELECCIONADO
  const handleCopyStrokeFromOtherObjects = (targetPathId?: string) => {
    if (!canEditMap) return; // Permisos de edición RBAC
    const targetId = targetPathId || selectedPathIds[0]; // ID del trazo objetivo seleccionado
    if (!targetId) return; // Cancela si no existe objetivo

    // Localiza un objeto vecino en el mapa para extraer sus propiedades de borde
    const siblingNode = mapEntity.paths.find(p => p.id !== targetId);
    if (!siblingNode) return; // Cancela si no existen otros objetos

    // Determina el grosor y color del objeto vecino (si no tiene, asume 0/none para mantenerlo liso)
    const siblingStrokeWidth = siblingNode.strokeWidth ?? siblingNode.visualStyles?.strokeWidth ?? siblingNode.customData?.strokeWidth ?? 0;
    const siblingStrokeColor = siblingNode.stroke ?? siblingNode.visualStyles?.strokeColor ?? siblingNode.customData?.stroke ?? 'none';

    setMapEntity(prev => {
      const updatedEntity = {
        ...prev,
        paths: prev.paths.map(p => {
          if (p.id === targetId || selectedPathIds.includes(p.id)) { // Aplica a los seleccionados
            return {
              ...p,
              strokeWidth: siblingStrokeWidth,
              stroke: siblingStrokeColor,
              visualStyles: {
                ...p.visualStyles,
                strokeWidth: siblingStrokeWidth,
                strokeColor: siblingStrokeColor
              },
              customData: {
                ...(p.customData || {}),
                strokeWidth: siblingStrokeWidth,
                stroke: siblingStrokeColor
              }
            };
          }
          return p; // Mantiene intacto el resto
        }),
        updatedAt: new Date().toISOString()
      };
      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));
      return updatedEntity;
    });

    showNotify(`[📋] Estilo de borde copiado de los otros objetos (${siblingStrokeWidth === 0 ? '100% Liso Sin Borde' : siblingStrokeWidth + 'px'}).`);
  };

  // FUNCIÓN PARA DEJAR UN TRAZO U OBJETO TOTALMENTE LISO (SIN BORDES NI LÍNEAS VISIBLES)
  const handleMakeSelectedPathSmooth = (targetPathId?: string) => {
    if (!canEditMap) return; // Permisos de edición RBAC
    const targetId = targetPathId || selectedPathIds[0]; // ID del trazo seleccionado
    if (!targetId && selectedPathIds.length === 0) return;

    setMapEntity(prev => {
      const updatedEntity = {
        ...prev,
        paths: prev.paths.map(p => {
          if (p.id === targetId || selectedPathIds.includes(p.id)) { // Aplica a la selección
            return {
              ...p,
              strokeWidth: 0,
              stroke: 'none',
              visualStyles: {
                ...p.visualStyles,
                strokeWidth: 0,
                strokeColor: 'none'
              },
              customData: {
                ...(p.customData || {}),
                strokeWidth: 0,
                stroke: 'none'
              }
            };
          }
          return p;
        }),
        updatedAt: new Date().toISOString()
      };
      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));
      return updatedEntity;
    });

    showNotify(`[🚫] Trazo ajustado a 100% LISO (Sin Borde ni líneas internas).`);
  };

  // FUNCIÓN PARA REEMPLAZAR LA SILUETA DEL POLÍGONO CON EL MAPA VECTORIAL DE OTRA RUTA (CON AUTO-AJUSTE DE TAMAÑO Y COPIA FIEL DE ESTILOS DE BORDE LISO)
  const handleReplaceSilhouetteWithRouteMap = (targetPathId: string, territory: { id: string; name: string; d: string; color?: string; value?: number; percentage?: number }) => {
    if (!canEditMap) return; // Permisos de edición RBAC

    if (!territory.d) {
      showNotify(`⚠️ El mapa de "${territory.name}" no tiene un trazado vectorial 'd' disponible.`);
      return;
    }

    let finalFittedD = territory.d; // Declaración inicial de la nueva geometría

    // Reemplaza quirúrgicamente el contorno ('d') y nombre auto-ajustando las dimensiones al trazo objetivo
    setMapEntity(prev => {
      const targetNode = prev.paths.find(p => p.id === targetPathId); // Encuentra el elemento sustituido
      const siblingNode = prev.paths.find(p => p.id !== targetPathId); // Objeto vecino para copiar estilo
      
      // COPIA FIELMENTE EL ESTILO DE BORDE DE LOS DEMÁS OBJETOS O DEL NODO DESTINO
      // Si el mapa actual no tiene bordes (strokeWidth = 0 o stroke = 'none'), el trazo traído será 100% liso
      const inheritedStrokeWidth = targetNode?.strokeWidth ?? targetNode?.visualStyles?.strokeWidth ?? targetNode?.customData?.strokeWidth ?? siblingNode?.strokeWidth ?? siblingNode?.visualStyles?.strokeWidth ?? siblingNode?.customData?.strokeWidth ?? 0;
      const inheritedStrokeColor = targetNode?.stroke ?? targetNode?.visualStyles?.strokeColor ?? targetNode?.customData?.stroke ?? siblingNode?.stroke ?? siblingNode?.visualStyles?.strokeColor ?? siblingNode?.customData?.stroke ?? 'none';

      if (targetNode && targetNode.d) {
        const targetBBox = getPathBBox(targetNode.d); // Obtiene sus dimensiones espaciales previas
        if (targetBBox.width > 5 && targetBBox.height > 5) { // Si poseía tamaño válido
          finalFittedD = fitPathToBBox(territory.d, targetBBox); // Ajusta y escala automáticamente la silueta traída al tamaño del contenedor sustituido
        }
      }

      const updatedPaths = prev.paths.map(node => {
        if (node.id === targetPathId) {
          return {
            ...node,
            name: territory.name, // Actualiza el nombre al mapa seleccionado
            d: finalFittedD, // Sustituye la silueta exterior por la nueva silueta auto-ajustada al tamaño (sin divisiones internas)
            strokeWidth: inheritedStrokeWidth, // Copia exactamente el grosor de borde de los otros objetos
            stroke: inheritedStrokeColor, // Copia el color de borde de los otros objetos
            visualStyles: {
              ...node.visualStyles,
              strokeWidth: inheritedStrokeWidth, // Refleja grosor liso en estilos visuales
              strokeColor: inheritedStrokeColor, // Refleja color en estilos visuales
              fillColor: territory.color || node.visualStyles?.fillColor || node.fill || '#10b981'
            },
            customData: {
              ...(node.customData || {}),
              territoryId: territory.id,
              territoryName: territory.name,
              strokeWidth: inheritedStrokeWidth,
              stroke: inheritedStrokeColor,
              valor: territory.value ?? node.customData?.valor,
              porcentaje: territory.percentage ?? node.customData?.porcentaje
            }
          };
        }
        return node;
      });

      const updatedEntity = {
        ...prev,
        paths: updatedPaths,
        updatedAt: new Date().toISOString()
      };

      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));
      return updatedEntity;
    });

    if (editingPathData && (editingPathData.id === targetPathId || selectedPathIds.includes(targetPathId))) {
      setEditingPathData(prev => prev ? {
        ...prev,
        name: territory.name,
        d: finalFittedD,
        color: territory.color || prev.color
      } : prev);
    }

    setActiveMapSelectorPathId(null); // Cierra el selector
    showNotify(`[🗺️] Silueta sustituida y lisa: El trazo ahora tiene la forma exterior de "${territory.name}" imitando el estilo de borde liso de los demás objetos.`);
  };


  // FUNCIÓN PARA GUARDAR LA EDICIÓN EN LÍNEA DEL NOMBRE DEL TRAZADO (EL LÁPIZ - OBJETIVO 1)
  const handleSaveInlineName = (targetPathId: string, newNameValue: string) => {
    // 1. Sanitiza el texto ingresado por el usuario
    const cleanName = newNameValue.trim();
    if (!cleanName) {
      setInlineEditingPathId(null); // Desactiva la edición si el campo está vacío
      return;
    }

    // 2. Modifica quirúrgicamente la lista de trazados en mapEntity preservando intacto todo el resto del mapa
    setMapEntity(prev => {
      const updatedPaths = prev.paths.map(node =>
        node.id === targetPathId ? { ...node, name: cleanName } : node
      );
      const updatedEntity = {
        ...prev,
        paths: updatedPaths,
        updatedAt: new Date().toISOString()
      };
      // Persiste los cambios en localStorage seguro
      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));
      return updatedEntity;
    });

    // 3. Si el trazo editado está seleccionado en el Inspector, actualiza el objeto editingPathData
    if (editingPathData && editingPathData.id === targetPathId) {
      setEditingPathData(prev => prev ? { ...prev, name: cleanName } : prev);
    }

    // 4. Finaliza el estado de edición en línea
    setInlineEditingPathId(null);
    showNotify(`[✏️] Nombre de trazado actualizado a "${cleanName}".`);
  };

  // FUNCIÓN DE VINCULACIÓN DE RUTA Y TERRITORIO CON REEMPLAZO QUIRÚRGICO DEL CONTORNO (OBJETIVOS 2 Y 3)
  const handleLinkTerritoryToPath = (targetPathId: string, territoryId: string) => {
    if (!canEditMap) return; // Permisos de edición RBAC

    // 1. Localiza el territorio seleccionado dentro de la base disponible de rutas
    const territory = availableTerritories.find(t => t.id === territoryId || t.name.toLowerCase() === territoryId.toLowerCase());
    if (!territory) return; // Si no existe el territorio, cancela la acción

    // 2. Obtiene el nodo actual del trazado en el estado del mapa
    const currentPath = mapEntity.paths.find(node => node.id === targetPathId);
    if (!currentPath) return; // Si no existe el nodo objetivo, cancela la acción

    // 3. OBJETIVO 2: Salta la alerta requerida window.confirm antes de modificar el contorno visual SVG
    const userConfirmedVisualReplace = window.confirm(
      `¿Deseas reemplazar el contorno visual seleccionado con el contorno de ${territory.name}?`
    );

    // 4. OBJETIVO 3 (LA REGLA DE ORO DEL REEMPLAZO QUIRÚRGICO):
    // Si el usuario acepta, extrae ÚNICAMENTE la propiedad 'd' (string SVG) del contorno exterior del territorio.
    // PROHIBICIÓN ABSOLUTA: NO se traen, iteran ni importan arrays de divisiones internas (hijos, provincias, municipios).
    // Si el usuario cancela el confirm, se conserva la propiedad 'd' original del trazado actual.
    const finalDProperty = (userConfirmedVisualReplace && territory.d) ? territory.d : currentPath.d;

    // 5. Asocia los DATOS del territorio seleccionado al trazo actual y aplica el reemplazo quirúrgico
    // COPIA FIELMENTE EL ESTILO DE BORDE DE LOS DEMÁS OBJETOS VECINOS O DEL NODO ACTUAL
    const siblingNode = mapEntity.paths.find(node => node.id !== targetPathId); // Objeto vecino para consultar estilo
    const inheritedStrokeWidth = currentPath.strokeWidth ?? currentPath.visualStyles?.strokeWidth ?? currentPath.customData?.strokeWidth ?? siblingNode?.strokeWidth ?? siblingNode?.visualStyles?.strokeWidth ?? siblingNode?.customData?.strokeWidth ?? 0;
    const inheritedStrokeColor = currentPath.stroke ?? currentPath.visualStyles?.strokeColor ?? currentPath.customData?.stroke ?? siblingNode?.stroke ?? siblingNode?.visualStyles?.strokeColor ?? siblingNode?.customData?.stroke ?? 'none';

    const updatedPaths = mapEntity.paths.map(node => {
      if (node.id === targetPathId) { // Coincidencia exclusiva del trazo objetivo
        return {
          ...node,
          id: territory.id !== 'AR' && territory.id.startsWith('AR-') ? territory.id : node.id,
          name: territory.name, // Asocia el nuevo nombre oficial del territorio
          d: finalDProperty, // REEMPLAZO QUIRÚRGICO DE LA PROPIEDAD 'd' (SOLO EL STRING DEL CONTORNO EXTERNO SIN DIVISIONES INTERNAS)
          category: territory.category || node.category, // Asocia la categoría jerárquica
          strokeWidth: inheritedStrokeWidth, // Copia exactamente el grosor de borde liso o existente
          stroke: inheritedStrokeColor, // Copia el color de borde de los vecinos
          visualStyles: {
            ...node.visualStyles,
            strokeWidth: inheritedStrokeWidth, // Refleja grosor liso en estilos visuales
            strokeColor: inheritedStrokeColor, // Refleja color de borde en estilos visuales
            fillColor: territory.color || node.visualStyles?.fillColor || '#10b981'
          },
          customData: {
            ...(node.customData || {}),
            territoryId: territory.id,
            territoryName: territory.name,
            strokeWidth: inheritedStrokeWidth,
            stroke: inheritedStrokeColor,
            valor: territory.value,
            porcentaje: territory.percentage,
            fill: territory.color || '#10b981'
          }
        };
      }
      return node; // PROHIBICIÓN ABSOLUTA: Todos los demás trazados y países en el Canvas quedan 100% INTACTOS
    });

    // 6. Actualiza el estado principal del mapa
    const updatedMapEntity: VectorMapEntity = {
      ...mapEntity,
      paths: updatedPaths,
      updatedAt: new Date().toISOString()
    };

    setMapEntity(updatedMapEntity);

    // 7. Sincroniza los cambios con el Inspector si es el elemento actualmente activo
    if (editingPathData && (editingPathData.id === targetPathId || selectedPathIds.includes(targetPathId))) {
      setEditingPathData(prev => prev ? {
        ...prev,
        name: territory.name,
        d: finalDProperty,
        color: territory.color || prev.color
      } : prev);
    }

    // 8. Persistencia de seguridad en localStorage
    safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedMapEntity));

    // 9. Feedback visual explicativo según la respuesta del confirm
    if (userConfirmedVisualReplace) {
      showNotify(`[🎯] Reemplazo quirúrgico exitoso: Contorno visual y datos de "${territory.name}" vinculados al trazo.`);
    } else {
      showNotify(`[📊] Datos de "${territory.name}" vinculados al trazo. El contorno visual original se conservó intacto.`);
    }
  };

  // ASIGNAR TERRITORIO PREDEFINIDO DESDE EL INSPECTOR (REUTILIZA LA MISMA LÓGICA QUIRÚRGICA)
  const handleAssignPredefinedTerritory = (territoryId: string) => {
    if (!canEditMap) return; // Permisos de edición RBAC
    if (selectedPathIds.length !== 1) return; // Requiere exactamente 1 trazo seleccionado
    if (!territoryId) return; // Si la opción está vacía
    handleLinkTerritoryToPath(selectedPathIds[0], territoryId); // Ejecuta la función quirúrgica unificada
  };

  // CAMBIAR COLOR EN LOTE PARA TODOS LOS ELEMENTOS SELECCIONADOS
  const handleBatchColorChange = (newColor: string) => {
    if (!canEditMap || selectedPathIds.length === 0) return; // Verifica permisos y selección

    setMapEntity(prev => ({ // Actualiza la colección de paths en el estado
      ...prev,
      paths: prev.paths.map(p => {
        if (selectedPathIds.includes(p.id)) { // Si está en la selección
          return {
            ...p,
            visualStyles: { ...(p.visualStyles || {}), fillColor: newColor }, // Aplica nuevo color
            customData: { ...(p.customData || {}), fill: newColor } // Sincroniza en customData
          };
        }
        return p;
      }),
      updatedAt: new Date().toISOString()
    }));
    showNotify(`[🎨] Color actualizado en lote para ${selectedPathIds.length} elementos.`); // Notificación
  };

  // AGRUPAR SELECCIÓN O MAPA COMPLETO EN UNA NUEVA RAMA / CONTINENTE (EJ: AMÉRICA DEL SUR, EUROPA, CONTINENTE)
  const handleGroupSelectionIntoContinent = (continentNameInput?: string) => {
    if (!canEditMap) return; // Verifica permisos RBAC
    const targetPaths = selectedPaths.length > 0 ? selectedPaths : mapEntity.paths; // Usa los seleccionados o todos
    if (targetPaths.length === 0) { // Si no hay elementos
      showNotify("[⚠️] No hay trazados vectoriales para agrupar en una rama.");
      return;
    }

    // Solicita o usa el nombre del Continente / Rama deseada
    const name = continentNameInput || prompt(
      "Ingresa el nombre de la nueva rama o Continente (ej: América del Sur, Europa, Continente):", 
      "América del Sur"
    );
    if (!name || !name.trim()) return; // Cancela si está vacío

    const cleanName = name.trim(); // Nombre limpio
    const continentId = `CONTINENT_${cleanName.toUpperCase().replace(/\s+/g, '_')}`; // ID normalizado

    // 1. Actualiza la categoría y metadatos de los polígonos seleccionados en el mapa activo
    const updatedPaths = mapEntity.paths.map(p => {
      if (targetPaths.some(tp => tp.id === p.id)) { // Si pertenece a los elementos agrupados
        return {
          ...p,
          category: cleanName, // Actualiza la categoría/rama
          customData: {
            ...(p.customData || {}),
            continent: cleanName,
            layer: cleanName
          }
        };
      }
      return p;
    });

    const updatedEntity: VectorMapEntity = {
      ...mapEntity,
      paths: updatedPaths,
      updatedAt: new Date().toISOString()
    };
    setMapEntity(updatedEntity); // Guarda el mapa vectorial actualizado en el editor

    // 2. Crea la entidad de territorio/nodo de nivel Continente para la aplicación global
    const continentMunicipalities = targetPaths.map(p => ({
      id: p.id,
      name: p.name,
      value: p.customData?.valor || p.customData?.value || 30,
      percentage: p.customData?.porcentaje || p.customData?.percentage || 15,
      d: p.d,
      color: p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#10b981',
      layer: cleanName,
      visualStyles: {
        fillColor: p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#10b981',
        strokeColor: p.customData?.stroke || p.visualStyles?.strokeColor || '#0f172a',
        strokeWidth: 1.5
      },
      customData: p.customData || {}
    }));

    const continentProvinceData: ProvinceData = {
      id: continentId,
      name: cleanName,
      abbreviation: cleanName.substring(0, 3).toUpperCase(),
      economicProfile: {
        gini: 42,
        pib: "$450.000M USD",
        averageSalary: "$750 USD",
        sectors: [
          { name: 'Servicios', value: 55, color: '#3b82f6' },
          { name: 'Industria', value: 30, color: '#10b981' },
          { name: 'Agro', value: 15, color: '#f59e0b' }
        ]
      },
      socialEmployment: {
        pobreza: 30,
        desempleo: 7.5,
        informalEmployment: 40,
        youthInformality: 50
      },
      incomeStructure: {
        minimumSalary: [{ label: 'Promedio Continental', value: 400 }],
        genderGap: [{ label: 'Brecha Promedio', value: 15 }]
      },
      connectivity: {
        internetAccess: [{ label: 'Fijo/Móvil', value: 75 }],
        mobileLines: [{ label: 'Penetración 4G/5G', value: 85 }]
      },
      budgetSpending: {
        socialSpending: [{ name: 'Gasto Social', value: 60, color: '#3b82f6' }],
        educationInvestment: [{ label: 'Inversión Educativa', value: 18 }]
      },
      mobilityServices: {
        roadNetwork: '500.000 km de rutas continentales',
        waterAccess: 88,
        publicTransportLines: 12000
      },
      municipalities: continentMunicipalities,
      mapTransform: mapEntity.transform ? {
        scale: mapEntity.transform.scale,
        panX: mapEntity.transform.translateX,
        panY: mapEntity.transform.translateY
      } : undefined
    };

    // 3. Notifica a la aplicación para registrar el nuevo Continente en provincesData y persistir en localStorage
    if (onUpdateProvince) {
      onUpdateProvince(continentProvinceData);
    }

    // 4. Guarda la nueva rama en el almacenamiento local seguro
    const serializedContinentMap = JSON.stringify({
      id: continentId,
      name: cleanName,
      level: 'continent',
      parentId: 'WORLD_MAP',
      paths: targetPaths,
      transform: mapEntity.transform
    });
    safeSetItem(`argentina_advanced_canvas_map_${continentId}`, serializedContinentMap);
    safeSetItem('argentina_advanced_canvas_map_CONTINENT_MAP', serializedContinentMap);

    showNotify(`[🌎] ¡Se creó exitosamente la nueva rama "${cleanName}" (${targetPaths.length} elementos agrupados en nivel Continente)!`);
  };

  // =========================================================================
  // SISTEMA DE AGRUPAMIENTO, COMBINACIÓN Y SEPARACIÓN VECTORIAL DE ALTA PRECISIÓN
  // (AGRUPAR / DESAGRUPAR / COMBINAR / DESCOMBINAR / SEPARAR SIN PERDER DATOS)
  // =========================================================================

  // 1. AGRUPAR ELEMENTOS SELECCIONADOS (ASIGNA UN GROUP ID SIN PERDER NINGÚN DATO INDIVIDUAL)
  const handleGroupSelectedPaths = (customGroupName?: string) => { // Función para agrupar elementos vectoriales
    if (!canEditMap) return; // Permisos RBAC de edición
    if (selectedPathIds.length < 2) { // Exige al menos 2 elementos seleccionados
      showNotify("[⚠️] Por favor, selecciona al menos 2 trazados vectoriales para agrupar."); // Notificación de advertencia
      return;
    }

    // Solicita o define el nombre del elemento PADRE con fallback automático usando el territorio o división activa
    let groupName = customGroupName; // Variable para almacenar el nombre del grupo padre
    if (!groupName) { // Si no se especificó un nombre personalizado previo
      const parentName = selectedProvince?.name || mapEntity.title || mapEntity.name || 'ISLAS MALVINAS'; // Nombre de la división o porción principal
      const defaultName = parentName; // Asigna el elemento padre por defecto
      try {
        const prompted = prompt("Ingresa el nombre para el elemento PADRE que agrupa a todos los objetos hijos:", defaultName); // Pide confirmación de nombre padre
        groupName = (prompted && prompted.trim()) ? prompted.trim() : defaultName; // Si cancela o vacía, usa el nombre del padre
      } catch (err) { // Captura bloqueo de prompt en iframes
        groupName = defaultName; // Asigna nombre por defecto del elemento padre
      }
    }

    const cleanGroupName = groupName.trim(); // Sanitiza la cadena ingresada
    const newGroupId = `GRP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`; // Genera ID único de grupo

    // Asigna el groupId y groupName a todos los trazos seleccionados en el estado de React
    setMapEntity(prev => ({ // Actualiza la entidad vectorial
      ...prev, // Mantiene la estructura base
      paths: prev.paths.map(p => { // Recorre los trazados vectoriales
        if (selectedPathIds.includes(p.id)) { // Si pertenece a la selección
          return {
            ...p, // Conserva INTACTOS todos los atributos originales (id, name, d, valor, porcentaje, customData)
            groupId: newGroupId, // Asigna el identificador de grupo
            groupName: cleanGroupName // Asigna el nombre visible del elemento padre (ej: ISLAS MALVINAS)
          };
        }
        return p; // Mantiene intactos los demás elementos
      }),
      updatedAt: new Date().toISOString() // Marca de tiempo
    }));

    showNotify(`[📁] Elemento Padre "${cleanGroupName}" configurado exitosamente agrupando ${selectedPathIds.length} objetos hijos.`); // Notificación de éxito
  }; // Fin de handleGroupSelectedPaths

  // 2. DESAGRUPAR ELEMENTOS SELECCIONADOS O UN GRUPO COMPLETO (REMUEVE REFERENCIA DE GRUPO SIN BORRAR DATOS)
  const handleUngroupSelectedPaths = (targetGroupId?: string) => { // Función para desagrupar
    if (!canEditMap) return; // Permisos RBAC

    let pathsToUngroupIds: string[] = []; // Inicializa la lista de IDs a desagrupar
    if (targetGroupId) { // Si se recibe un ID de grupo específico
      pathsToUngroupIds = mapEntity.paths.filter(p => p.groupId === targetGroupId).map(p => p.id); // Filtra los elementos del grupo
    } else { // Si no, toma los elementos agrupados de la selección activa
      pathsToUngroupIds = selectedPathIds.filter(id => {
        const item = mapEntity.paths.find(p => p.id === id);
        return item && item.groupId;
      });
    }

    if (pathsToUngroupIds.length === 0) { // Si no se encontraron elementos agrupados
      showNotify("[⚠️] No hay elementos agrupados en la selección activa para desagrupar."); // Notificación
      return;
    }

    setMapEntity(prev => ({ // Actualiza el estado de la entidad
      ...prev,
      paths: prev.paths.map(p => {
        if (pathsToUngroupIds.includes(p.id)) {
          const { groupId, groupName, ...rest } = p; // Elimina las propiedades de grupo
          return rest; // Devuelve el objeto libre manteniendo intactos sus datos
        }
        return p;
      }),
      updatedAt: new Date().toISOString()
    }));

    showNotify(`[📂] Se desagruparon ${pathsToUngroupIds.length} elemento(s). Nombres, geometrías y métricas se mantuvieron intactas.`);
  };

  // 3. RENOMBRAR UN GRUPO EXISTENTE
  const handleRenameGroup = (groupId: string, currentName: string) => { // Función para renombrar grupo
    if (!canEditMap || !groupId) return; // Verifica permisos
    let newName: string | null = null; // Declaración de variable de nuevo nombre
    try {
      newName = prompt("Ingresa el nuevo nombre para este grupo:", currentName); // Solicita nuevo nombre
    } catch (err) {
      newName = currentName; // En caso de error de prompt
    }
    if (!newName || !newName.trim()) return; // Cancela si no hay cambio

    const cleanName = newName.trim(); // Sanitiza
    setMapEntity(prev => ({ // Actualiza el nombre del grupo
      ...prev,
      paths: prev.paths.map(p => p.groupId === groupId ? { ...p, groupName: cleanName } : p),
      updatedAt: new Date().toISOString()
    }));

    showNotify(`[✏️] Grupo renombrado a "${cleanName}".`);
  };

  // 4. SEPARAR UN ELEMENTO INDIVIDUAL DE UN GRUPO
  const handleSeparatePartFromGroup = (pathId: string) => { // Separa un solo trazo del grupo
    if (!canEditMap || !pathId) return;

    setMapEntity(prev => ({
      ...prev,
      paths: prev.paths.map(p => {
        if (p.id === pathId) {
          const { groupId, groupName, ...rest } = p;
          return rest;
        }
        return p;
      }),
      updatedAt: new Date().toISOString()
    }));

    showNotify(`[✂️] Elemento separado del grupo. Conserva sus datos e identidad individual intacta.`);
  };

  // 5. COMBINAR SELECCIÓN (UNIR GEOMETRÍAS SVG RESPALDANDO EL 100% DE INTEGRANTES EN customData.subItems)
  const handleCombineSelectedPaths = (customCombinedName?: string) => { // Función para combinar trazados
    if (!canEditMap) return; // Permisos RBAC
    if (selectedPathIds.length < 2) { // Exige al menos 2 trazados
      showNotify("[⚠️] Por favor, selecciona al menos 2 trazados vectoriales para combinar en uno solo.");
      return;
    }

    const itemsToCombine = mapEntity.paths.filter(p => selectedPathIds.includes(p.id)); // Filtra los trazados a combinar
    if (itemsToCombine.length === 0) return; // Cancela si está vacío

    // Solicita o asigna el nombre del trazado combinado con fallback automático si prompt es bloqueado o cancelado
    let combinedName = customCombinedName; // Variable para el nombre del combinado
    if (!combinedName) { // Si no hay nombre personalizado previo
      const parentName = selectedProvince?.name || mapEntity.title || mapEntity.name || 'ISLAS MALVINAS'; // Elemento padre
      const defaultName = `${parentName} (Porción Unificada)`; // Nombre por defecto con padre
      try {
        const prompted = prompt("Ingresa el nombre para la porción o trazado combinado PADRE:", defaultName); // Pide nombre
        combinedName = (prompted && prompted.trim()) ? prompted.trim() : defaultName; // Si cancela o vacía usa por defecto
      } catch (err) { // Captura si el navegador bloquea prompt
        combinedName = defaultName; // Nombre por defecto
      }
    }

    const cleanCombinedName = combinedName.trim(); // Sanitiza el nombre
    const combinedId = `COMBINED_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`; // ID único de la entidad combinada

    // Une las geometrías 'd' de todos los elementos seleccionados en un único string SVG multifigura
    const combinedD = itemsToCombine.map(i => i.d.trim()).join(' ');

    // Calcula métricas consolidadas de la entidad combinada
    const totalValue = itemsToCombine.reduce((acc, curr) => acc + Number(curr.customData?.valor || curr.customData?.value || 0), 0);
    const avgPercentage = itemsToCombine.length > 0
      ? Math.round(itemsToCombine.reduce((acc, curr) => acc + Number(curr.customData?.porcentaje || curr.customData?.percentage || 0), 0) / itemsToCombine.length)
      : 0;

    // Crea la entidad combinada guardando las subPartes vivas en subItems
    const combinedPathItem: VectorPathItem = {
      id: combinedId, // Identificador de la entidad combinada
      name: cleanCombinedName, // Nombre asignado
      d: combinedD, // Geometría unificada SVG
      category: itemsToCombine[0]?.category || 'combinado', // Categoria de la capa
      ownerId: currentUser.id, // Propietario
      isCombined: true, // Flag de objeto combinado
      visualStyles: {
        fillColor: itemsToCombine[0]?.customData?.fill || itemsToCombine[0]?.visualStyles?.fillColor || '#10b981',
        strokeColor: itemsToCombine[0]?.customData?.stroke || itemsToCombine[0]?.visualStyles?.strokeColor || '#0f172a',
        strokeWidth: itemsToCombine[0]?.customData?.strokeWidth || itemsToCombine[0]?.visualStyles?.strokeWidth || 1.5
      },
      customData: {
        fill: itemsToCombine[0]?.customData?.fill || itemsToCombine[0]?.visualStyles?.fillColor || '#10b981',
        stroke: itemsToCombine[0]?.customData?.stroke || itemsToCombine[0]?.visualStyles?.strokeColor || '#0f172a',
        valor: totalValue,
        porcentaje: avgPercentage,
        layer: itemsToCombine[0]?.category || 'combinado',
        // RESPALDO COMPLETO INMUTABLE DE LOS INTEGRANTES ORIGINALES CON TODOS SUS DATOS
        subItems: JSON.parse(JSON.stringify(itemsToCombine))
      }
    };

    setMapEntity(prev => { // Actualiza el lienzo en React
      const remainingPaths = prev.paths.filter(p => !selectedPathIds.includes(p.id)); // Reemplaza los elementos individuales
      return {
        ...prev,
        paths: [...remainingPaths, combinedPathItem], // Inyecta el objeto único combinado
        updatedAt: new Date().toISOString()
      };
    });

    setSelectedPathIds([combinedId]); // Selecciona la nueva entidad combinada unificada
    showNotify(`[🧩] Se combinaron ${itemsToCombine.length} trazados en "${cleanCombinedName}". Sus componentes originales fueron guardados para permitir descombinar en cualquier momento.`);
  }; // Fin de handleCombineSelectedPaths

  // 6. DESCOMBINAR / SEPARAR UN TRAZADO COMBINADO (RESTAURA TODAS LAS PIEZAS ORIGINALES CON SUS DATOS EXACTOS)
  const handleUncombineSelectedPath = (targetCombinedId?: string) => {
    if (!canEditMap) return;

    const combinedIdToProcess = targetCombinedId || (selectedPathIds.length === 1 ? selectedPathIds[0] : null);
    if (!combinedIdToProcess) {
      showNotify("[⚠️] Por favor, selecciona el elemento combinado que deseas descombinar.");
      return;
    }

    const combinedItem = mapEntity.paths.find(p => p.id === combinedIdToProcess);
    if (!combinedItem) return;

    // RESTAURACIÓN 1: Mediante los subItems guardados en customData (Recuperación directa y perfecta)
    if (combinedItem.customData?.subItems && Array.isArray(combinedItem.customData.subItems) && combinedItem.customData.subItems.length > 0) {
      const restoredItems: VectorPathItem[] = JSON.parse(JSON.stringify(combinedItem.customData.subItems));

      setMapEntity(prev => {
        const remainingPaths = prev.paths.filter(p => p.id !== combinedIdToProcess);
        return {
          ...prev,
          paths: [...remainingPaths, ...restoredItems],
          updatedAt: new Date().toISOString()
        };
      });

      setSelectedPathIds(restoredItems.map(r => r.id));
      showNotify(`[✂️] Se descombinó "${combinedItem.name}". Se restauraron ${restoredItems.length} trazados independientes con sus nombres, geometrías y datos intactos.`);
      return;
    }

    // RESTAURACIÓN 2: Fisión geométrica si no había subItems explícitos
    const pathD = combinedItem.d.trim();
    const subPaths = pathD.split(/(?=[M|m])/).filter(sp => sp.trim().length > 0);

    if (subPaths.length <= 1) {
      showNotify("[⚠️] Este elemento contiene una sola trayectoria vectorial simple.");
      return;
    }

    const splitItems: VectorPathItem[] = subPaths.map((spD, idx) => ({
      id: `${combinedItem.id}_PART_${idx + 1}`,
      name: `${combinedItem.name} (Parte ${idx + 1})`,
      d: spD.trim(),
      category: combinedItem.category,
      ownerId: combinedItem.ownerId,
      visualStyles: { ...combinedItem.visualStyles },
      customData: {
        ...(combinedItem.customData || {}),
        layer: combinedItem.category,
        partIndex: idx + 1
      }
    }));

    setMapEntity(prev => {
      const remainingPaths = prev.paths.filter(p => p.id !== combinedIdToProcess);
      return {
        ...prev,
        paths: [...remainingPaths, ...splitItems],
        updatedAt: new Date().toISOString()
      };
    });

    setSelectedPathIds(splitItems.map(s => s.id));
    showNotify(`[✂️] Se dividió la geometría en ${splitItems.length} partes independientes.`);
  };

  // 7. EXTRAER UNA SUB-PIEZA ESPECÍFICA DE UN COMBINADO
  const handleExtractPartFromCombined = (combinedId: string, subItemId: string) => {
    if (!canEditMap || !combinedId || !subItemId) return;

    const combinedItem = mapEntity.paths.find(p => p.id === combinedId);
    if (!combinedItem || !combinedItem.customData?.subItems) return;

    const subItems: VectorPathItem[] = combinedItem.customData.subItems;
    const extractedItem = subItems.find(s => s.id === subItemId);
    const remainingSubItems = subItems.filter(s => s.id !== subItemId);

    if (!extractedItem) return;

    if (remainingSubItems.length === 0) {
      handleUncombineSelectedPath(combinedId);
      return;
    }

    const newCombinedD = remainingSubItems.map(s => s.d.trim()).join(' ');

    setMapEntity(prev => {
      const updatedPaths = prev.paths.map(p => {
        if (p.id === combinedId) {
          return {
            ...p,
            d: newCombinedD,
            customData: {
              ...p.customData,
              subItems: remainingSubItems
            }
          };
        }
        return p;
      });

      return {
        ...prev,
        paths: [...updatedPaths, extractedItem],
        updatedAt: new Date().toISOString()
      };
    });

    showNotify(`[📤] Se extrajo "${extractedItem.name}" del combinado como trazado independiente.`);
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

  // FUNCIÓN DE INYECCIÓN QUIRÚRGICA DE CONTORNO EN SÚPER EDITOR CANVAS
  const handleInjectContourFile = (e: React.ChangeEvent<HTMLInputElement>) => { // Handler para la inyección de silueta
    const file = e.target.files?.[0]; // Obtiene el archivo subido
    if (!file) return; // Cancela si no hay archivo

    const targetId = selectedPathIds[0] || (editingPathData ? editingPathData.id : null); // ID del nodo activo seleccionado
    if (!targetId) { // Verifica la selección
      alert("Por favor, selecciona primero en el mapa el nodo o región que deseas perfeccionar."); // Notificación
      if (e.target) e.target.value = ''; // Resetea el input
      return; // Cancela la ejecución
    }

    const reader = new FileReader(); // Lector de archivos
    reader.onload = (event) => { // Handler al terminar la lectura
      try { // Captura de excepciones
        const rawText = event.target?.result as string || ''; // Texto crudo
        const cleanedText = sanitizeJsonString(rawText); // Sanitización de comentarios y JS/TS
        const json = JSON.parse(cleanedText || rawText); // Parsea JSON

        // Extracción recursiva de comandos 'd'
        const extractDPaths = (node: any): string[] => { // Función recursiva
          let dList: string[] = [];
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

        const extractedDs = extractDPaths(json).filter(Boolean); // Filtra nulos
        if (extractedDs.length === 0) {
          alert("Estructura inválida. No se encontraron trazados (propiedad 'd') en el archivo importado.");
          return;
        }

        const nuevoContornoFusionado = extractedDs.join(' '); // Fusión exterior

        // ACTUALIZACIÓN SEGURA Y ESTRICTA EN MAPENTITY:
        // Recorre mapEntity.paths conservando todos los demás nodos intactos, y actualiza ÚNICAMENTE la propiedad 'd' del targetId
        setMapEntity(prev => ({
          ...prev,
          paths: (prev.paths || []).map(node => node.id === targetId ? { ...node, d: nuevoContornoFusionado } : node),
          updatedAt: new Date().toISOString()
        }));

        showNotify(`[🎯] Inyección quirúrgica exitosa: Silueta del nodo "${targetId}" perfeccionada. Sus métricas y datos permanecen intactos.`);
        alert(`¡Inyección Quirúrgica de Contorno Exitosa!\n\nSe ha actualizado EXCLUSIVAMENTE la silueta (propiedad 'd') del nodo seleccionado "${targetId}". Sus datos estadísticos y metadatos se conservaron 100% intactos.`);
      } catch (err: any) {
        console.error("Error en inyección quirúrgica de contorno:", err);
        alert("Error al procesar el archivo para inyección quirúrgica.");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  // EXTRAE RECURSIVAMENTE TODOS LOS COMANDOS 'd' DE CUALQUIER FORMATO (JSON, SVG, CADENA RAW)
  const extractAllDFromInput = (inputData: any): string[] => {
    let dList: string[] = [];
    if (typeof inputData === 'string') {
      const dMatches = inputData.match(/d=["']([^"']+)["']/g);
      if (dMatches && dMatches.length > 0) {
        dMatches.forEach(m => {
          const val = m.replace(/^d=["']/, '').replace(/["']$/, '').trim();
          if (val) dList.push(val);
        });
        return dList;
      }
      try {
        const parsed = JSON.parse(sanitizeJsonString(inputData));
        return extractAllDFromInput(parsed);
      } catch {
        if (inputData.trim().length > 10) {
          dList.push(inputData.trim());
        }
        return dList;
      }
    }
    if (Array.isArray(inputData)) {
      inputData.forEach(item => {
        dList = dList.concat(extractAllDFromInput(item));
      });
    } else if (typeof inputData === 'object' && inputData !== null) {
      if (inputData.d) {
        dList.push(String(inputData.d).trim());
      } else if (inputData.type === 'Feature') {
        let pathD = inputData.properties?.d || inputData.d;
        if (!pathD && inputData.geometry && inputData.geometry.coordinates) {
          pathD = geoJsonCoordsToSvgPath(inputData.geometry.type, inputData.geometry.coordinates);
        }
        if (pathD) dList.push(String(pathD).trim());
      }
      for (const key of Object.keys(inputData)) {
        if (key !== 'properties' && key !== 'customData' && typeof inputData[key] === 'object' && inputData[key] !== null) {
          dList = dList.concat(extractAllDFromInput(inputData[key]));
        }
      }
    }
    return dList;
  };

  // BOTÓN "GENERAR VISTA PREVIA": CALCULA EL CONTORNO EXTERIOR UNIFICADO Y LO MUESTRA EN EL LIENZO
  const handleGenerateSilhouettePreview = (customContent?: any) => {
    const targetId = selectedPathIds[0] || (editingPathData ? editingPathData.id : null);
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
        if (silhouettePresetRoute === 'ARG_24') {
          sourceData = provincePaths;
        } else if (silhouettePresetRoute === 'CURRENT_MAP') {
          sourceData = mapEntity.paths;
        } else {
          sourceData = provincePaths;
        }
      }
    }

    const dArray = extractAllDFromInput(sourceData).filter(Boolean);
    if (dArray.length === 0) {
      alert("No se detectaron trazados vectoriales (propiedad 'd') válidos en la entrada proporcionada.");
      return;
    }

    // Fusión exterior de trazados (Dissolve Outer Boundary)
    const unifiedD = dArray.join(' ');
    setPreviewSilhouette(unifiedD);
    showNotify(`[✨] Vista previa de la silueta perfeccionada generada sobre el lienzo (resaltado rosa/rojo).`);
  };

  // MANEJADOR PARA SUBIDA DE ARCHIVO DE SILUETA (JSON / SVG)
  const handleSilhouetteFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // MANEJADOR PARA SUBIDA DE IMAGEN Y VECTORIZACIÓN DE SILUETA
  const handleSilhouetteImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showNotify("[📷] Extrayendo contorno exterior desde la imagen cargada...");
    const reader = new FileReader();
    reader.onload = () => {
      const targetId = selectedPathIds[0] || editingPathData.id;
      const targetNode = mapEntity.paths.find(p => p.id === targetId);
      if (targetNode && targetNode.d) {
        handleGenerateSilhouettePreview(targetNode.d);
      } else {
        handleGenerateSilhouettePreview(provincePaths);
      }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  // BOTÓN "APLICAR CAMBIOS" (MUTACIÓN QUIRÚRGICA SEGURA DE ESTADO GLOBAL):
  const handleApplySilhouetteMutation = () => { // Aplica la silueta modificada quirúrgicamente
    const targetId = selectedPathIds[0] || (editingPathData ? editingPathData.id : null); // ID objetivo
    if (!targetId) { // Si no hay nodo activo
      alert("No hay ningún nodo seleccionado para aplicar los cambios."); // Muestra alerta
      return; // Cancela la operación
    }
    if (!previewSilhouette) { // Si no hay vista previa generada
      alert("Primero genera una vista previa de la silueta perfeccionada antes de aplicar cambios."); // Muestra aviso
      return; // Cancela la operación
    }

    // CÓDIGO EXIGIDO PARA LA MUTACIÓN SEGURA DE ESTADO GLOBAL:
    const updatedPaths = (mapEntity.paths || []).map(node => // Recorre los nodos vectoriales
      node.id === targetId ? { ...node, d: previewSilhouette } : node // Sustituye la geometría 'd' exclusivamente en el objetivo
    ); // Fin de mapa de actualización

    const updatedEntity: VectorMapEntity = { // Construye la entidad de mapa actualizada
      ...mapEntity, // Mantiene metadatos previos
      paths: updatedPaths, // Inyecta los trazados actualizados
      updatedAt: new Date().toISOString() // Actualiza marca de tiempo
    };

    setMapEntity(updatedEntity); // Aplica el nuevo estado en React

    // Actualiza los datos del inspector en el componente
    setEditingPathData(prev => prev ? { ...prev, d: previewSilhouette } : prev); // Sincroniza el formulario del inspector

    // Limpia la vista previa de la silueta
    setPreviewSilhouette(null); // Desactiva el overlay de vista previa

    // Sincroniza y persiste inmediatamente los cambios con la aplicación global
    safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity)); // Guarda en almacenamiento global
    const provKey = selectedProvince?.id || mapEntity.id || 'country'; // Clave de región activa
    safeSetItem(`argentina_advanced_canvas_map_${provKey}`, JSON.stringify(updatedEntity)); // Guarda clave por región

    if (onSaveMapEntity) { // Si existe el callback externo de guardado
      onSaveMapEntity(updatedEntity); // Notifica el cambio de entidad
    }

    showNotify(`[🎯] Silueta de "${targetId}" actualizada quirúrgicamente. Sus datos y los demás nodos permanecen intactos.`); // Notificación exitosa
    alert(`¡Inyección Quirúrgica Exitosa!\n\nSe ha actualizado EXCLUSIVAMENTE la silueta (propiedad 'd') del nodo seleccionado "${targetId}".\n\n- Todos los demás nodos del mapa global: conservados 100% intactos.\n- Datos estadísticos, metadatos y nombre de "${targetId}": preservados intactos.`); // Confirmación al usuario
  }; // Fin de handleApplySilhouetteMutation

  // DESCARTAR VISTA PREVIA
  const handleCancelSilhouettePreview = () => { // Función para descartar la vista previa
    setPreviewSilhouette(null); // Resetea el estado a nulo
    showNotify("[ℹ️] Vista previa de silueta descartada."); // Notificación informativa
  }; // Fin de handleCancelSilhouettePreview

  // GUARDAR MAPA EN LA APLICACIÓN / PERSISTENCIA EN TIEMPO REAL MULTI-CLAVE CON IMPACTO DIRECTO EN MAPA MACRO NACIONAL
  const handleSaveMapToApp = () => { // Función principal para aplicar cambios y sincronizar con la aplicación
    if (!canEditMap) return; // Verifica permisos de edición RBAC del usuario

    const provKey = selectedProvince?.id || mapEntity.id || 'country'; // Obtiene la clave o ID de la región activa
    const serializedEntity = JSON.stringify(mapEntity); // Serializa el objeto de mapa vectorial completo a formato JSON

    // 1. PERSISTENCIA ASEGURADA EN MÚLTIPLES ENTRADAS DE LOCALSTORAGE
    safeSetItem('argentina_advanced_canvas_map', serializedEntity); // Guarda la entrada por defecto
    safeSetItem(`argentina_advanced_canvas_map_${provKey}`, serializedEntity); // Guarda bajo la clave propia de la región activa
    if (provKey.toUpperCase() === 'WORLD_MAP' || mapEntity.level === 'world' || mapEntity.id === 'WORLD_MAP') { // Si es el mapa del mundo
      safeSetItem('argentina_advanced_canvas_map_WORLD_MAP', serializedEntity); // Guarda en la clave específica de mapa mundial
    }

    if (onSaveMapEntity) { // Notifica al callback externo si fue proporcionado
      onSaveMapEntity(mapEntity); // Sincroniza la entidad de mapa
    }

    // 2. ACTUALIZACIÓN DE LA PROVINCIA ACTIVA Y DE SUS MUNICIPIOS DETALLADOS
    const activeTargetId = selectedSubdivisionId || selectedProvince?.id || mapEntity.id; // Identifica la región o subdivisión activa
    const targetNormalized = activeTargetId ? activeTargetId.toLowerCase().replace(/^ar-/, '') : ''; // Normaliza el código

    // Unifica todos los trazos de SÚPER EDITOR en una silueta única limpia para el contorno macro
    const rawUnifiedD = mapEntity.paths.map(p => (p.d || '').trim()).filter(Boolean).join(' ');

    // Busca la geometría nativa de referencia en provincePaths si oldMacroSub.d está vacía
    const refPathObj = provincePaths.find(p => p.id === activeTargetId || p.id.toLowerCase() === activeTargetId.toLowerCase() || p.id.toLowerCase().replace(/^ar-/, '') === targetNormalized || p.name.toLowerCase().includes((mapEntity.title || '').toLowerCase()));

    let countryMap: ProvinceData | undefined = undefined;
    let matchedIndex = -1;

    if (allProvinces) {
      countryMap = allProvinces['COUNTRY_MAP'] || allProvinces['argentina'] || allProvinces['country'];
      if (countryMap && Array.isArray(countryMap.municipalities)) {
        matchedIndex = countryMap.municipalities.findIndex(m => {
          const mId = m.id.toLowerCase().replace(/^ar-/, '');
          const mName = (m.name || '').toLowerCase();
          const activeName = (selectedProvince?.name || mapEntity.title || '').toLowerCase();

          return (
            (targetNormalized && (mId === targetNormalized || m.id.toLowerCase() === activeTargetId.toLowerCase())) ||
            (mName && activeName && (mName === activeName || mName.includes(activeName) || activeName.includes(mName)))
          );
        });
      }
    }

    // Determina la geometría de referencia para calcular el Bounding Box original
    const oldMacroSub = matchedIndex !== -1 && countryMap ? countryMap.municipalities[matchedIndex] : undefined;
    const origRefD = oldMacroSub?.d || refPathObj?.d || '';
    const targetBBox = getPathBBox(origRefD);

    let finalFittedD = rawUnifiedD;
    if (targetBBox && targetBBox.width > 1 && targetBBox.height > 1 && rawUnifiedD) {
      finalFittedD = fitPathToBBox(rawUnifiedD, targetBBox); // Ajusta exactamente al tamaño y posición original
    }

    if (selectedProvince && onUpdateProvince) { // Si existe la provincia activa y la función de actualización
      const updatedMunicipalities = mapEntity.paths.map(p => ({ // Mapea todos los trazados vectoriales del canvas
        id: p.id, // Conserva el ID único del trazado
        name: p.name, // Conserva o asigna el nombre del trazado
        value: p.customData?.valor || p.customData?.value || 0, // Mantiene el valor estadístico
        percentage: p.customData?.porcentaje || p.customData?.percentage || 0, // Mantiene el porcentaje
        d: p.d, // Conserva la geometría vectorial 'd'
        color: p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#10b981', // Color de relleno
        layer: p.category || p.customData?.layer || selectedProvince.name, // Capa
        visualStyles: { // Estilos visuales
          fillColor: p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#10b981',
          strokeColor: p.customData?.stroke || p.visualStyles?.strokeColor || p.stroke || '#0f172a',
          strokeWidth: p.customData?.strokeWidth || p.visualStyles?.strokeWidth || p.strokeWidth || 1.5
        },
        customData: p.customData || {} // Preserva metadatos
      }));

      onUpdateProvince({ // Actualiza los datos de la provincia activa
        ...selectedProvince, // Preserva los datos principales
        d: finalFittedD || selectedProvince.d, // Asigna la nueva silueta ajustada
        municipalities: updatedMunicipalities, // Asigna los municipios o subdivisiones detalladas
        mapTransform: { // Preserva transformaciones de vista
          scale: mapEntity.transform.scale,
          panX: mapEntity.transform.translateX,
          panY: mapEntity.transform.translateY
        }
      });
    }

    // 3. PROPAGACIÓN E IMPACTO DIRECTO AL MAPA MACRO NACIONAL ("COUNTRY_MAP" / ARGENTINA)
    if (onUpdateProvince && countryMap && matchedIndex !== -1 && oldMacroSub) {
      const updatedCountryMunicipalities = [...countryMap.municipalities]; // Copia el arreglo de provincias
      const targetIdToSync = oldMacroSub.id || activeTargetId;

      updatedCountryMunicipalities[matchedIndex] = {
        ...oldMacroSub, // Mantiene metadatos existentes
        d: finalFittedD || oldMacroSub.d, // Asigna la nueva geometría auto-escalada respetando la medida
        customData: {
          ...(oldMacroSub.customData || {}),
          subItems: mapEntity.paths // Almacena las capas/polígonos vectoriales para inspección
        }
      };

      const updatedCountryMap: ProvinceData = {
        ...countryMap, // Mantiene los metadatos del mapa macro
        municipalities: updatedCountryMunicipalities // Inyecta la lista de provincias con la silueta actualizada
      };

      // Guarda la lista de rutas calibradas en localStorage para consumo del mapa principal
      const rawCalibrated = safeGetItem('argentina_calibrated_map_paths');
      let currentCalibrated: { id: string; d: string }[] = [];
      if (rawCalibrated) {
        try { currentCalibrated = JSON.parse(rawCalibrated); } catch (e) {}
      }
      if (!Array.isArray(currentCalibrated) || currentCalibrated.length === 0) {
        currentCalibrated = provincePaths.map(p => ({ id: p.id, d: p.d }));
      }
      const calIndex = currentCalibrated.findIndex(p => p.id === targetIdToSync || p.id.toLowerCase() === activeTargetId.toLowerCase() || p.id.toLowerCase().replace(/^ar-/, '') === targetNormalized);
      if (calIndex !== -1) {
        currentCalibrated[calIndex].d = finalFittedD;
      } else {
        currentCalibrated.push({ id: targetIdToSync, d: finalFittedD });
      }
      safeSetItem('argentina_calibrated_map_paths', JSON.stringify(currentCalibrated));
      safeSetItem('argentina_paths_last_updated', Date.now().toString());

      // Guarda la versión actualizada de Argentina en localStorage
      safeSetItem('argentina_advanced_canvas_map_COUNTRY_MAP', JSON.stringify({
        id: 'COUNTRY_MAP',
        name: updatedCountryMap.name,
        level: 'country',
        paths: updatedCountryMunicipalities.map(m => ({
          id: m.id,
          name: m.name,
          d: m.d || '',
          customData: { valor: m.value, porcentaje: m.percentage, fill: m.color, subItems: m.customData?.subItems },
          visualStyles: { fillColor: m.color || '#10b981', strokeColor: '#0f172a', strokeWidth: 1.5 }
        }))
      }));

      onUpdateProvince(updatedCountryMap); // Notifica el cambio en el mapa de Argentina para que impacte en la UI principal

      window.dispatchEvent(new Event('storage')); // Notifica actualización a todos los componentes
      window.dispatchEvent(new CustomEvent('mapDataUpdated', { detail: { provinceId: targetIdToSync, d: finalFittedD } }));
    }

    // Actualiza el snapshot inicial con la nueva versión recién guardada (marca de arrepentimiento)
    initialMapSnapshotRef.current = JSON.parse(JSON.stringify(mapEntity)); // Clona el snapshot actualizado

    showNotify("[💾] Cambios aplicados e impactados en el mapa principal. La nueva forma respeta la medida y ubicación exacta."); // Notificación de éxito
  }; // Fin de handleSaveMapToApp

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
          {/* Agrupar selección o mapa en nueva rama / continente */}
          <button
            onClick={() => handleGroupSelectionIntoContinent()}
            disabled={!canEditMap}
            className="py-1.5 px-3 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-md shadow-indigo-950/40"
            title="Agrupar los trazados seleccionados en una nueva rama/continente (ej: América del Sur, Europa)"
          >
            <Globe size={13} className="text-indigo-400" />
            <span>Crear Rama Continente</span>
          </button>

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

          {/* GRUPO DE ACCIONES DE HISTORIAL (DESHACER / REHACER / MENÚ HISTORIAL) */}
          <div className="flex items-center space-x-1 border-l border-r border-slate-800 px-2 my-0.5">
            {/* BOTÓN DESHACER (UNDO) */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canEditMap || historyIndex <= 0}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
              title="Deshacer acción (Ctrl + Z)"
            >
              <Undo2 size={13} className="text-amber-400" />
              <span className="hidden md:inline text-[11px]">Deshacer</span>
            </button>

            {/* BOTÓN REHACER (REDO) */}
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canEditMap || historyIndex >= historyStack.length - 1}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
              title="Rehacer acción (Ctrl + Y o Ctrl + Shift + Z)"
            >
              <Redo2 size={13} className="text-sky-400" />
              <span className="hidden md:inline text-[11px]">Rehacer</span>
            </button>

            {/* MENÚ FLOTANTE GESTOR DE HISTORIAL Y LIMPIEZA */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsHistoryMenuOpen(!isHistoryMenuOpen)}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1 ${
                  isHistoryMenuOpen 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Ver historial de cambios y gestionar memoria"
              >
                <History size={13} className="text-emerald-400" />
                <span className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded-full text-emerald-400 font-extrabold border border-emerald-500/30">
                  {historyStack.length > 0 ? `${historyIndex + 1}/${historyStack.length}` : '0'}
                </span>
              </button>

              {/* DESPLEGABLE CON LISTA DE HISTORIAL Y LIMPIEZA */}
              {isHistoryMenuOpen && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2 w-64 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2.5 space-y-2 z-50 animate-fadeIn text-left"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 px-1">
                    <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1">
                      <History size={11} /> Historial de Pasos ({historyStack.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsHistoryMenuOpen(false)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1 text-[10.5px]">
                    {historyStack.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setHistoryIndex(idx);
                          setMapEntity(JSON.parse(JSON.stringify(item)));
                          showNotify(`[📜] Saltado al paso ${idx + 1} del historial.`);
                        }}
                        className={`w-full text-left p-1.5 rounded-xl border transition-all flex items-center justify-between ${
                          idx === historyIndex
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                            : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 border-slate-800/80'
                        }`}
                      >
                        <span className="truncate pr-2">
                          {idx === 0 ? '🌱 Estado Inicial' : `✏️ Cambio #${idx} (${item.paths?.length || 0} trazos)`}
                        </span>
                        {idx === historyIndex && (
                          <span className="text-[9px] bg-emerald-500 text-slate-950 font-black px-1 rounded uppercase">Activo</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* BOTÓN PARA LIMPIAR HISTORIAL Y ELIMINAR ESTADOS PASADOS DE MEMORIA */}
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="w-full py-1.5 px-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 mt-1"
                    title="Elimina los pasos anteriores conservando solo el estado actual para liberar memoria y espacio local"
                  >
                    <Trash2 size={11} />
                    <span>Limpiar Historial (Liberar Espacio)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* BOTÓN DE CANCELAR SIN GUARDAR (DESCARTAR CAMBIOS Y REVERTIR AL ESTADO INICIAL) */}
          <button
            type="button"
            onClick={handleCancelUnsavedChanges}
            disabled={!canEditMap}
            className="py-1.5 px-3 bg-rose-950/60 hover:bg-rose-900/80 disabled:opacity-40 text-rose-200 border border-rose-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-md shadow-rose-950/40"
            title="Descarca todos los cambios no guardados y vuelve al estado original"
          >
            <RotateCcw size={13} className="text-rose-400" />
            <span>Cancelar sin guardar</span>
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

          {/* BOTÓN ASOCIAR MAPA COMPLETO A OTRA RUTA O PROVINCIA */}
          <button
            type="button"
            onClick={() => setIsAssociateModalOpen(true)}
            disabled={!canEditMap}
            className="py-1.5 px-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-sky-950/40"
            title="Asociar y reemplazar este mapa vectorizado en otra provincia o ruta"
          >
            <Globe size={13} />
            <span>Asociar a Otra Ruta</span>
          </button>

          {/* BOTONES PARA ESCONDER / OCULTAR PANELES LATERALES (RESALTADOS EN ROJO POR EL USUARIO) */}
          <div className="flex items-center space-x-1 border-l border-slate-800 pl-2">
            <button
              onClick={() => setShowLeftSidebar(!showLeftSidebar)}
              className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1 ${
                showLeftSidebar
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              }`}
              title={showLeftSidebar ? "Esconder Panel Izquierdo (Capas/Polígonos)" : "Mostrar Panel Izquierdo (Capas/Polígonos)"}
            >
              {showLeftSidebar ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
              <span className="hidden xl:inline">{showLeftSidebar ? 'Ocultar Capas' : 'Ver Capas'}</span>
            </button>

            <button
              onClick={() => setShowRightSidebar(!showRightSidebar)}
              className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1 ${
                showRightSidebar
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              }`}
              title={showRightSidebar ? "Esconder Panel Derecho (Transformación/Inspector)" : "Mostrar Panel Derecho (Transformación/Inspector)"}
            >
              {showRightSidebar ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
              <span className="hidden xl:inline">{showRightSidebar ? 'Ocultar Inspector' : 'Ver Inspector'}</span>
            </button>
          </div>
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
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* COLUMNA IZQUIERDA: ÁRBOL DE CAPAS Y JERARQUÍA ESTILO CORELDRAW / ILLUSTRATOR */}
        {showLeftSidebar && (
          <div className="w-80 bg-slate-900/90 border-r border-slate-800 flex flex-col overflow-y-auto shrink-0 z-10 shadow-2xl">
            {/* CABECERA PRINCIPAL CON CONTADOR DE OBJETOS, SELECCIONAR TODO Y OCULTAR PANEL */}
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/90 sticky top-0 z-20 backdrop-blur-md">
              <div className="flex items-center space-x-1.5">
                <Layers size={14} className="text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  Objetos ({mapEntity.paths.length})
                </h3>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={handleSelectAll}
                  className="text-[10px] font-extrabold text-emerald-400 hover:text-emerald-300 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center space-x-1 shadow-xs"
                  title={selectedPathIds.length === mapEntity.paths.length ? 'Deseleccionar todos los elementos' : 'Seleccionar todos los elementos vectoriales'}
                >
                  <CheckSquare size={10} />
                  <span>{selectedPathIds.length === mapEntity.paths.length ? 'Deseleccionar' : 'Todos'}</span>
                </button>
                <button
                  onClick={() => setShowLeftSidebar(false)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title="Esconder Panel Izquierdo de Objetos"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>

            {/* BUSCADOR DE OBJETOS ESTILO CORELDRAW ("Buscar...") */}
            <div className="p-2 border-b border-slate-800/80 bg-slate-900/80 sticky top-[45px] z-10">
              <div className="relative flex items-center">
                <Search size={12} className="absolute left-2.5 text-slate-400" />
                <input
                  type="text"
                  value={layerSearchQuery}
                  onChange={(e) => setLayerSearchQuery(e.target.value)}
                  placeholder="Buscar objeto, curva o padre..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg py-1 pl-7 pr-7 text-xs text-slate-100 placeholder:text-slate-500 outline-none font-medium"
                />
                {layerSearchQuery && (
                  <button
                    onClick={() => setLayerSearchQuery('')}
                    className="absolute right-2 text-slate-500 hover:text-slate-300 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* ÁRBOL DE OBJETOS Y CAPAS JERÁRQUICO */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
              {(() => {
                // Filtrado por el término de búsqueda
                const filteredPaths = mapEntity.paths.filter(p => {
                  if (!layerSearchQuery.trim()) return true;
                  const query = layerSearchQuery.toLowerCase();
                  return (p.name && p.name.toLowerCase().includes(query)) ||
                         (p.id && p.id.toLowerCase().includes(query)) ||
                         (p.groupName && p.groupName.toLowerCase().includes(query));
                });

                if (filteredPaths.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                      <p>{mapEntity.paths.length === 0 ? 'No hay trazados vectoriales en este lienzo.' : 'No se encontraron objetos con ese nombre.'}</p>
                      <p className="text-[10px] text-slate-600">Sube un archivo .svg / .json o agrega formas vectoriales.</p>
                    </div>
                  );
                }

                // Agrupa por groupId
                const groupMap: Record<string, VectorPathItem[]> = {};
                const ungroupedPaths: VectorPathItem[] = [];

                filteredPaths.forEach(p => {
                  if (p.groupId) {
                    if (!groupMap[p.groupId]) groupMap[p.groupId] = [];
                    groupMap[p.groupId].push(p);
                  } else {
                    ungroupedPaths.push(p);
                  }
                });

                // Helper interno para renderizar un trazado/curva individual (Hijo o Suelto)
                const renderPathItemRow = (p: VectorPathItem, isInsideGroup: boolean = false) => {
                  const isSelected = selectedPathIds.includes(p.id);
                  const isEditingName = inlineEditingPathId === p.id;
                  const isLinkMenuOpen = activeLinkMenuPathId === p.id;
                  const isMapSelectorOpen = activeMapSelectorPathId === p.id;
                  const fillColor = p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#10b981';

                  return (
                    <div
                      key={p.id}
                      id={`adv-layer-item-${p.id}`}
                      onClick={(e) => handleToggleSelectPath(p.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                      className={`p-2 rounded-xl cursor-pointer transition-all flex flex-col group ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50 font-bold shadow-md ring-1 ring-emerald-500/30'
                          : 'hover:bg-slate-800/80 text-slate-300 border border-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full space-x-1.5">
                        {/* ÍCONO Y TIPO DE OBJETO VECTORIAL */}
                        <div className="flex items-center space-x-2 truncate flex-1 min-w-0">
                          {/* Muestra un cuadro con el color real del objeto (Muestra de Color de CorelDRAW) */}
                          <span 
                            className="w-3 h-3 rounded-xs shrink-0 border border-slate-700/80 shadow-xs" 
                            style={{ backgroundColor: fillColor }}
                            title={`Color de relleno: ${fillColor}`}
                          />

                          {/* Nombre y edición en línea */}
                          <div className="truncate flex-1 min-w-0">
                            {isEditingName ? (
                              <input
                                type="text"
                                value={inlineEditingNameValue}
                                onChange={(e) => setInlineEditingNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineName(p.id, inlineEditingNameValue);
                                  else if (e.key === 'Escape') setInlineEditingPathId(null);
                                }}
                                onBlur={() => handleSaveInlineName(p.id, inlineEditingNameValue)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-slate-950 border border-emerald-500 text-emerald-200 text-xs px-1.5 py-0.5 rounded font-bold outline-none"
                              />
                            ) : (
                              <>
                                <div className="flex items-center space-x-1">
                                  <p className="text-xs truncate leading-snug">{p.name || p.id}</p>
                                </div>
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest truncate font-mono">{p.id}</p>
                              </>
                            )}
                          </div>
                        </div>

                        {/* BOTONES DE ACCIÓN: EDITAR, SEPARAR (SI ES HIJO), VINCULAR Y ELIMINAR */}
                        <div className={`transition-opacity flex items-center space-x-0.5 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          {/* Botón Lápiz (Editar Nombre) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInlineEditingPathId(p.id);
                              setInlineEditingNameValue(p.name || p.id);
                            }}
                            className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Editar nombre del objeto"
                          >
                            <Edit3 size={11} />
                          </button>

                          {/* Botón Separar del Padre si está dentro de un Grupo */}
                          {isInsideGroup && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSeparatePartFromGroup(p.id);
                              }}
                              className="p-1 hover:bg-indigo-500/20 rounded text-indigo-400 hover:text-indigo-300 transition-colors"
                              title="Separar este objeto hijo individual de su contenedor padre"
                            >
                              <Unlink size={11} />
                            </button>
                          )}

                          {/* Botón Vincular Territorio */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveLinkMenuPathId(prev => prev === p.id ? null : p.id);
                              setActiveMapSelectorPathId(null);
                            }}
                            className="p-1 hover:bg-sky-500/20 rounded text-sky-400 hover:text-sky-300 transition-colors"
                            title="Vincular a Ruta y Territorio"
                          >
                            <Globe size={11} />
                          </button>

                          {/* Botón Mapita Reemplazo */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMapSelectorPathId(prev => prev === p.id ? null : p.id);
                              setActiveLinkMenuPathId(null);
                              setMapSelectorSearch('');
                            }}
                            className={`p-1 rounded transition-all ${
                              isMapSelectorOpen
                                ? 'bg-amber-500/30 text-amber-300 ring-1 ring-amber-500/50' 
                                : 'hover:bg-amber-500/20 text-amber-400 hover:text-amber-300'
                            }`}
                            title="Sustituir silueta por mapa de otra ruta"
                          >
                            <MapPin size={11} />
                          </button>

                          {/* Seleccionar e inspeccionar */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPathIds([p.id]);
                            }}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                            title="Seleccionar e inspeccionar"
                          >
                            <Eye size={11} />
                          </button>

                          {/* Eliminar Capa */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSelectedPaths([p.id]);
                            }}
                            className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400"
                            title="Eliminar objeto"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {/* MENÚ VINCULAR A RUTA (TERRITORIO) */}
                      {isLinkMenuOpen && (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 p-2 bg-slate-950 border border-sky-500/50 rounded-xl space-y-2 shadow-2xl animate-fadeIn text-left z-20"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                            <span className="text-[9px] text-sky-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                              <Globe size={10} />
                              <span>Vincular a Ruta</span>
                            </span>
                            <button
                              onClick={() => setActiveLinkMenuPathId(null)}
                              className="text-[10px] text-slate-500 hover:text-slate-300 font-bold"
                            >
                              ✕
                            </button>
                          </div>

                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleLinkTerritoryToPath(p.id, e.target.value);
                                setActiveLinkMenuPathId(null);
                              }
                            }}
                            defaultValue=""
                            className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg p-1.5 text-xs outline-none focus:border-sky-400 font-bold cursor-pointer"
                          >
                            <option value="" disabled>-- Selecciona Territorio --</option>
                            <optgroup label="1. Países / Regiones Macro">
                              <option value="AR">🇦🇷 Argentina</option>
                              <option value="BR">🇧🇷 Brasil</option>
                              <option value="CL">🇨🇱 Chile</option>
                              <option value="UY">🇺🇾 Uruguay</option>
                              <option value="CO">🇨🇴 Colombia</option>
                              <option value="PE">🇵🇪 Perú</option>
                              <option value="MX">🇲🇽 México</option>
                              <option value="ES">🇪🇸 España</option>
                              <option value="US">🇺🇸 Estados Unidos</option>
                            </optgroup>
                            <optgroup label="2. Provincias de Argentina (24 A-Z)">
                              {sortedProvinces.map(prov => (
                                <option key={prov.id} value={prov.id}>
                                  🇦🇷 {prov.name} ({prov.id})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      )}

                      {/* MENÚ SUSTITUIR POR MAPITA */}
                      {isMapSelectorOpen && (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 p-2.5 bg-slate-950 border border-amber-500/60 rounded-xl space-y-2 shadow-2xl animate-fadeIn text-left z-20 relative"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                            <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider flex items-center gap-1">
                              <MapPin size={11} className="text-amber-400" />
                              <span>Sustituir Mapa de Ruta</span>
                            </span>
                            <button
                              onClick={() => setActiveMapSelectorPathId(null)}
                              className="text-[10px] text-slate-500 hover:text-slate-300 font-bold px-1"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="relative flex items-center">
                            <Search size={11} className="absolute left-2 text-amber-400" />
                            <input
                              type="text"
                              value={mapSelectorSearch}
                              onChange={(e) => setMapSelectorSearch(e.target.value)}
                              placeholder="Buscar mapa (ej: Buenos Aires)..."
                              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg py-1 pl-6 pr-6 text-[10px] text-slate-100 placeholder:text-slate-500 outline-none font-bold"
                            />
                            {mapSelectorSearch && (
                              <button onClick={() => setMapSelectorSearch('')} className="absolute right-2 text-slate-500 text-[9px]">✕</button>
                            )}
                          </div>

                          <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                            {availableTerritories
                              .filter(t => t.d && (!mapSelectorSearch || t.name.toLowerCase().includes(mapSelectorSearch.toLowerCase()) || t.id.toLowerCase().includes(mapSelectorSearch.toLowerCase())))
                              .map(terr => (
                                <button
                                  key={terr.id}
                                  onClick={() => handleReplaceSilhouetteWithRouteMap(p.id, terr)}
                                  className="w-full p-1.5 bg-slate-900 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 rounded-lg text-left text-[10px] font-bold text-slate-200 hover:text-amber-300 transition-all cursor-pointer flex items-center justify-between"
                                >
                                  <span className="truncate">{terr.name}</span>
                                  <span className="text-[8px] text-amber-400 font-mono">Sustituir</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {/* 1. SECCIÓN DE OBJETOS AGRUPADOS (CONTENEDORES PADRE ESTILO CORELDRAW) */}
                    {Object.entries(groupMap).map(([groupId, members]) => {
                      const groupName = members[0]?.groupName || selectedProvince?.name || mapEntity.title || 'ISLAS MALVINAS';
                      const isCollapsed = collapsedGroups[groupId] || false;
                      const memberIds = members.map(m => m.id);
                      const isFullySelected = memberIds.every(id => selectedPathIds.includes(id));
                      const isPartiallySelected = !isFullySelected && memberIds.some(id => selectedPathIds.includes(id));

                      return (
                        <div 
                          key={groupId} 
                          className={`rounded-2xl border transition-all mb-2 overflow-hidden ${
                            isFullySelected
                              ? 'bg-indigo-950/60 border-indigo-500/70 shadow-lg ring-1 ring-indigo-500/40'
                              : isPartiallySelected
                              ? 'bg-indigo-950/30 border-indigo-500/40'
                              : 'bg-slate-900/90 border-slate-800/80 hover:border-indigo-500/30'
                          }`}
                        >
                          {/* CABECERA DEL NODO PADRE DE GRUPO */}
                          <div 
                            onClick={() => toggleGroupCollapse(groupId)}
                            className="p-2 bg-slate-950/70 hover:bg-indigo-950/40 flex items-center justify-between cursor-pointer border-b border-indigo-500/20 select-none"
                          >
                            <div className="flex items-center space-x-2 truncate flex-1 min-w-0">
                              {/* Desplegable Arrow */}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGroupCollapse(groupId);
                                }}
                                className="p-0.5 hover:bg-slate-800 rounded text-indigo-400 hover:text-indigo-200"
                              >
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                              </button>

                              {/* Icono de Carpeta / Grupo */}
                              {isCollapsed ? (
                                <Folder size={15} className="text-indigo-400 shrink-0" />
                              ) : (
                                <FolderOpen size={15} className="text-indigo-300 shrink-0" />
                              )}

                              {/* Nombre visible del Padre */}
                              <div className="truncate flex-1 min-w-0">
                                <div className="flex items-center space-x-1.5 truncate">
                                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">PADRE:</span>
                                  <span className="text-xs font-black text-slate-100 truncate">{groupName}</span>
                                </div>
                                <p className="text-[9px] text-indigo-300 font-mono">
                                  Grupo de {members.length} objetos
                                </p>
                              </div>
                            </div>

                            {/* BARRAS DE ACCIONES DEL PADRE */}
                            <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {/* Seleccionar Todos en el Grupo */}
                              <button
                                onClick={() => setSelectedPathIds(memberIds)}
                                className="p-1 hover:bg-indigo-500/20 rounded text-indigo-300 hover:text-indigo-100"
                                title="Seleccionar todos los objetos de este contenedor padre"
                              >
                                <CheckSquare size={12} />
                              </button>

                              {/* Cambiar Nombre al Padre */}
                              <button
                                onClick={() => handleRenameGroup(groupId, groupName)}
                                className="p-1 hover:bg-indigo-500/20 rounded text-indigo-300 hover:text-indigo-100"
                                title="Cambiar nombre al contenedor padre"
                              >
                                <Edit3 size={12} />
                              </button>

                              {/* Desagrupar */}
                              <button
                                onClick={() => handleUngroupSelectedPaths(groupId)}
                                className="p-1 hover:bg-indigo-500/20 rounded text-indigo-300 hover:text-indigo-100"
                                title="Desagrupar y liberar todos los objetos hijos"
                              >
                                <Unlink size={12} />
                              </button>

                              {/* Eliminar todo el Grupo */}
                              <button
                                onClick={() => handleDeleteSelectedPaths(memberIds)}
                                className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400"
                                title="Eliminar este grupo completo"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* LISTADO DE HIJOS INDENTADOS DENTRO DEL GRUPO */}
                          {!isCollapsed && (
                            <div className="p-1.5 pl-3 space-y-1 bg-slate-950/30 border-l-2 border-indigo-500/30 ml-2 my-1">
                              {members.map(memberPath => renderPathItemRow(memberPath, true))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 2. SECCIÓN DE OBJETOS COMBINADOS Y SUELTOS SIN GRUPO */}
                    {ungroupedPaths.map(p => {
                      const isCombined = p.isCombined || (p.customData?.subItems && p.customData.subItems.length > 0);
                      const subItems = p.customData?.subItems || [];
                      const isCollapsed = collapsedCombined[p.id] || false;

                      if (isCombined && subItems.length > 0) {
                        return (
                          <div 
                            key={p.id}
                            className="rounded-2xl border border-purple-500/40 bg-purple-950/20 hover:border-purple-500/60 transition-all mb-2 overflow-hidden"
                          >
                            {/* CABECERA DEL OBJETO COMBINADO */}
                            <div 
                              onClick={() => toggleCombinedCollapse(p.id)}
                              className="p-2 bg-slate-950/80 flex items-center justify-between cursor-pointer border-b border-purple-500/30 select-none"
                            >
                              <div className="flex items-center space-x-2 truncate flex-1 min-w-0">
                                <button className="p-0.5 text-purple-400 hover:text-purple-200">
                                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <span className="text-sm">🧩</span>
                                <div className="truncate flex-1 min-w-0">
                                  <p className="text-xs font-bold text-purple-200 truncate">{p.name || p.id}</p>
                                  <p className="text-[9px] text-purple-400 font-mono">
                                    Objeto Combinado ({subItems.length} porciones)
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleUncombineSelectedPath(p.id)}
                                  className="text-[9px] bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 border border-purple-500/40 px-2 py-0.5 rounded font-bold transition-all cursor-pointer"
                                  title="Descombinar esta figura en sus porciones individuales"
                                >
                                  Descombinar
                                </button>
                                <button
                                  onClick={() => handleDeleteSelectedPaths([p.id])}
                                  className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* SUB-PARTES INTEGRANTES DEL COMBINADO */}
                            {!isCollapsed && (
                              <div className="p-1.5 pl-3 space-y-1 bg-slate-950/40 border-l-2 border-purple-500/40 ml-2 my-1">
                                {subItems.map((subItem: any) => (
                                  <div 
                                    key={subItem.id}
                                    className="p-1.5 bg-slate-900/80 border border-purple-500/20 rounded-lg flex items-center justify-between text-xs"
                                  >
                                    <div className="truncate flex-1 min-w-0 pr-1">
                                      <p className="text-[10px] font-bold text-slate-200 truncate">{subItem.name || subItem.id}</p>
                                      <p className="text-[8px] text-purple-400 font-mono truncate">ID: {subItem.id}</p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleExtractPartFromCombined(p.id, subItem.id);
                                      }}
                                      className="px-1.5 py-0.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 border border-purple-500/40 rounded text-[9px] font-bold shrink-0 cursor-pointer"
                                      title="Extraer esta parte individual del trazado combinado"
                                    >
                                      Extraer
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Objeto individual suelto
                      return renderPathItemRow(p, false);
                    })}
                  </>
                );
              })()}
            </div>

            {/* SECCIÓN DE PEGAR TRAZADOS DIRECTOS (PEGADO RÁPIDO <path d="...">) */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2 shrink-0">
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
            <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2 shrink-0">
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
        )}

        {/* BOTÓN FLOTANTE PARA RE-MOSTRAR PANEL IZQUIERDO CUANDO ESTÁ OCULTO */}
        {!showLeftSidebar && (
          <button
            onClick={() => setShowLeftSidebar(true)}
            className="absolute top-4 left-4 z-30 p-2 bg-slate-900/95 hover:bg-slate-800 border border-slate-800 text-emerald-400 rounded-xl shadow-2xl backdrop-blur-md flex items-center space-x-1.5 cursor-pointer group"
            title="Mostrar Panel Izquierdo de Capas y Polígonos"
          >
            <PanelLeftOpen size={16} />
            <span className="text-xs font-bold hidden group-hover:inline">Capas</span>
          </button>
        )}

        {/* BOTÓN FLOTANTE PARA RE-MOSTRAR PANEL DERECHO CUANDO ESTÁ OCULTO */}
        {!showRightSidebar && (
          <button
            onClick={() => setShowRightSidebar(true)}
            className="absolute top-16 right-4 z-30 p-2 bg-slate-900/95 hover:bg-slate-800 border border-slate-800 text-emerald-400 rounded-xl shadow-2xl backdrop-blur-md flex items-center space-x-1.5 cursor-pointer group"
            title="Mostrar Panel Derecho de Transformación e Inspector"
          >
            <PanelRightOpen size={16} />
            <span className="text-xs font-bold hidden group-hover:inline">Inspector</span>
          </button>
        )}

        {/* COLUMNA CENTRAL: CANVAS INTERACTIVO CON SVG Y NODOS DE ESCALA/TRANSLACIÓN */}
        <div className="flex-1 bg-slate-950 relative flex flex-col overflow-hidden items-center justify-center p-4">
          
          {/* CONTROLES AVANZADOS DE ZOOM Y HERRAMIENTAS DE VISOR CON PORCENTAJE EDITABLE, SLIDER EXTRA Y AJUSTE VISUAL */}
          <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-800 rounded-xl p-1.5 flex items-center space-x-1.5 z-20 shadow-2xl backdrop-blur-md">
            {/* BOTÓN HERRAMIENTA MANITO (MOVER / ARRASTRAR MAPA LIBREMENTE) */}
            <button
              onClick={() => setIsPanToolActive(!isPanToolActive)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 border ${
                isPanToolActive
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800 hover:text-emerald-400'
              }`}
              title={isPanToolActive ? "Desactivar Herramienta Manito" : "Activar Herramienta Manito (Mover y Arrastrar Mapa o Dibujo Libremente)"}
            >
              <Hand size={13} />
              <span>{isPanToolActive ? 'Manito ON' : 'Manito'}</span>
            </button>

            <div className="w-px h-4 bg-slate-800 mx-0.5" />

            {/* Botón Alejar Zoom */}
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.1))}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors cursor-pointer"
              title="Alejar Zoom"
            >
              <ZoomOut size={14} />
            </button>

            {/* Porcentaje de Zoom Editable (%) */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5">
              <input
                type="text"
                value={`${Math.round(zoomLevel * 100)}%`}
                onChange={(e) => {
                  const valStr = e.target.value.replace(/[^0-9.]/g, '');
                  const numVal = parseFloat(valStr);
                  if (!isNaN(numVal) && numVal > 0) {
                    setZoomLevel(numVal / 100);
                  }
                }}
                className="w-12 text-center bg-transparent text-[11px] font-bold text-emerald-400 font-mono outline-none"
                title="Escribe un porcentaje de zoom personalizado (ej: 150%)"
              />
            </div>

            {/* Botón Acercar Zoom */}
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 10))}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn size={14} />
            </button>

            {/* BARRA DE DESPLAZAMIENTO (SLIDER EXTRA) PARA MOVER CON MOUSE SIN LÍMITE DE ACERCAR/ALEJAR */}
            <input
              type="range"
              min="10"
              max="1000"
              step="5"
              value={Math.round(zoomLevel * 100)}
              onChange={(e) => setZoomLevel(parseFloat(e.target.value) / 100)}
              className="w-20 sm:w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              title="Desliza con el mouse para acercar o alejar el zoom de forma fluida y sin límite"
            />

            <div className="w-px h-4 bg-slate-800 mx-0.5" />

            {/* BOTÓN DE AJUSTE VISUAL FIT (SEGÚN PANTALLA Y MAPA SELECCIONADO) */}
            <button
              onClick={handleAutoFitToParent}
              className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1"
              title="Ajustar Visual: Auto-acomodar mapa para encuadrar en la pantalla según la selección"
            >
              <Maximize2 size={12} />
              <span>Fit Visual</span>
            </button>

            {/* BOTÓN FOCUS SELECCIÓN (CENTRAR EL ZOOM EN EL OBJETO SELECCIONADO) */}
            {selectedPathIds.length > 0 && (
              <button
                onClick={handleFocusOnSelection}
                className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-fade-in"
                title="Centrar el zoom y la pantalla directamente en la figura u objeto seleccionado"
              >
                <Target size={12} className="text-emerald-400" />
                <span>Focus Selección</span>
              </button>
            )}

            {/* BOTÓN DESELECCIONAR (LIMPIAR LA SELECCIÓN ACTIVA) */}
            {selectedPathIds.length > 0 && (
              <button
                onClick={() => setSelectedPathIds([])}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 animate-fade-in"
                title="Deseleccionar todos los polígonos y figuras"
              >
                <X size={12} className="text-slate-400" />
                <span>Deseleccionar ({selectedPathIds.length})</span>
              </button>
            )}

            {/* Botón Restablecer a 100% */}
            <button
              onClick={() => setZoomLevel(1)}
              className="px-1.5 py-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
              title="Restablecer vista a 100%"
            >
              Reset
            </button>
          </div>

          {/* LIENZO SVG DINÁMICO CON TRANSFORMACIÓN DE MATRIZ Y SELECCIÓN DE POLÍGONOS */}
          <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
            <svg
              ref={svgRef}
              viewBox={canvasViewBox}
              onPointerDown={handleCanvasPointerDown}
              className={`w-full h-full max-h-[75vh] select-none transition-transform duration-100 ${
                isDraggingCanvas ? 'cursor-grabbing' : isPanToolActive ? 'cursor-grab' : 'cursor-default'
              }`}
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
                  const pathStroke = p.customData?.stroke || p.visualStyles?.strokeColor || p.stroke || globalStrokeColor;
                  
                  // Cálculo de grosor de línea ultra-fino y responsivo con vector-effect="non-scaling-stroke"
                  let effectiveStrokeWidth = p.customData?.strokeWidth ?? p.visualStyles?.strokeWidth ?? p.strokeWidth ?? globalStrokeWidth;

                  if (globalStrokeMode === 'none') {
                    effectiveStrokeWidth = 0;
                  } else if (globalStrokeMode === 'thin') {
                    effectiveStrokeWidth = 0.5;
                  } else if (globalStrokeMode === 'medium') {
                    effectiveStrokeWidth = 1.0;
                  } else if (globalStrokeMode === 'thick') {
                    effectiveStrokeWidth = 2.0;
                  }

                  const finalStrokeWidth = isSelected ? Math.max(1.5, effectiveStrokeWidth * 1.5) : effectiveStrokeWidth;
                  const finalStrokeColor = isSelected ? '#34d399' : (effectiveStrokeWidth === 0 ? 'none' : pathStroke);

                  return (
                    <path
                      key={p.id}
                      d={p.d}
                      vectorEffect="non-scaling-stroke"
                      onPointerDown={(e) => {
                        if (isPanToolActive) return; // Si la manito está activa, ignora
                        // Si el objeto ya está seleccionado y se puede editar, activa el movimiento por arrastre (acomodar)
                        if (canEditMap && isSelected) {
                          e.stopPropagation(); // Previene otros disparadores
                          const svgPos = getSvgCoordinates(e); // Mapea cursor a SVG
                          setIsDraggingElement(true); // Inicia estado de arrastre
                          setElementDragStartPos(svgPos); // Guarda punto de partida
                          const initialMap: Record<string, string> = {}; // Diccionario de trazados iniciales
                          mapEntity.paths.forEach(item => {
                            if (selectedPathIds.includes(item.id)) {
                              initialMap[item.id] = item.d; // Almacena el 'd' original
                            }
                          });
                          setInitialPathsD(initialMap); // Guarda trazados para traslado relacional
                        }
                      }}
                      onClick={(e) => {
                        if (isPanToolActive) return; // Si la herramienta manito está activa, no selecciona al hacer clic
                        e.stopPropagation();
                        handleToggleSelectPath(p.id, e.ctrlKey || e.metaKey || e.shiftKey);
                      }}
                      className={`${isPanToolActive ? 'cursor-grab' : canEditMap && isSelected ? 'cursor-move' : 'cursor-pointer'} transition-all duration-150 hover:opacity-80`}
                      style={{ pointerEvents: isPanToolActive ? 'none' : 'auto' }}
                      fill={isSelected ? '#10b981' : pathFill}
                      fillOpacity={isSelected ? 0.85 : 0.75}
                      stroke={finalStrokeColor}
                      strokeWidth={finalStrokeWidth}
                    />
                  );
                })}

                {/* RENDERIZADO DE MARCOS Y GUÍAS DE AYUDA PARA GRUPOS VECTORIALES (TELAS DE AYUDA) */}
                {(() => {
                  const uniqueGroupIds = Array.from(new Set(mapEntity.paths.map(p => p.groupId).filter(Boolean) as string[]));
                  if (uniqueGroupIds.length === 0) return null;

                  return uniqueGroupIds.map(gId => {
                    const groupMembers = mapEntity.paths.filter(p => p.groupId === gId);
                    if (groupMembers.length === 0) return null;

                    const groupBBox = getMultiplePathsBBox(groupMembers.map(m => ({ d: m.d })));
                    if (!groupBBox || groupBBox.width === 0 || groupBBox.height === 0) return null;

                    const groupName = groupMembers[0]?.groupName || 'Grupo';
                    const isGroupSelected = groupMembers.some(m => selectedPathIds.includes(m.id));

                    return (
                      <g key={`group-box-${gId}`} className="pointer-events-none">
                        <rect
                          x={groupBBox.x - 4}
                          y={groupBBox.y - 4}
                          width={groupBBox.width + 8}
                          height={groupBBox.height + 8}
                          fill={isGroupSelected ? "rgba(129, 140, 248, 0.1)" : "rgba(129, 140, 248, 0.03)"}
                          stroke={isGroupSelected ? "#818cf8" : "rgba(129, 140, 248, 0.5)"}
                          strokeWidth={1}
                          strokeDasharray="4 4"
                          rx={4}
                          vectorEffect="non-scaling-stroke"
                        />
                        <text
                          x={groupBBox.x - 4}
                          y={groupBBox.y - 8}
                          fill="#818cf8"
                          fontSize={Math.max(10, Math.min(14, groupBBox.width / 15))}
                          fontWeight="bold"
                          className="font-mono tracking-wider select-none"
                          style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.8))' }}
                        >
                          📁 PADRE: {groupName} ({groupMembers.length} objetos hijos)
                        </text>
                      </g>
                    );
                  });
                })()}

                {/* OVERLAY DE VISTA PREVIA DE SILUETA PERFECCIONADA (EN ROJO/ROSA SOBRE EL MAPA) */}
                {previewSilhouette && (
                  <path
                    d={previewSilhouette}
                    stroke="#f43f5e"
                    strokeWidth={3 / mapEntity.transform.scale}
                    fill="rgba(244, 63, 94, 0.2)"
                    pointerEvents="none"
                    className="animate-pulse"
                    style={{ filter: 'drop-shadow(0px 0px 8px rgba(244, 63, 94, 0.8))' }}
                  />
                )}

                {/* OVERLAY DE BOUNDING BOX SOBRE LOS ELEMENTOS SELECCIONADOS CON NODOS (TIRADORES) DE ESCALA INTERACTIVOS */}
                {selectionBBox && (() => {
                  const visualScale = (mapEntity.transform.scale || 1) * (zoomLevel || 1);
                  const minBoxDim = Math.min(selectionBBox.width, selectionBBox.height);
                  
                  // Tamaño del tirador adaptado a la escala visual en pantalla (6.5px en pantalla)
                  let handleSize = 6.5 / visualScale;
                  
                  // Para objetos/polígonos pequeños, limitar el tirador a un máximo del 18% del lado menor para que nunca tape la figura
                  if (minBoxDim > 0) {
                    handleSize = Math.min(handleSize, minBoxDim * 0.18);
                  }
                  
                  const halfHandle = handleSize / 2;
                  const strokeW = Math.max(0.6 / visualScale, Math.min(1.2 / visualScale, handleSize * 0.15));
                  const bboxStrokeW = Math.max(0.8 / visualScale, Math.min(1.5 / visualScale, handleSize * 0.2));

                  const cornerHandles = [
                    { type: 'nw', x: selectionBBox.x, y: selectionBBox.y, cursor: 'nwse-resize' },
                    { type: 'ne', x: selectionBBox.x + selectionBBox.width, y: selectionBBox.y, cursor: 'nesw-resize' },
                    { type: 'sw', x: selectionBBox.x, y: selectionBBox.y + selectionBBox.height, cursor: 'nesw-resize' },
                    { type: 'se', x: selectionBBox.x + selectionBBox.width, y: selectionBBox.y + selectionBBox.height, cursor: 'nwse-resize' }
                  ];

                  return (
                    <g className="pointer-events-auto">
                      {/* Caja envolvente principal interactiva para arrastrar y acomodar */}
                      <rect
                        x={selectionBBox.x}
                        y={selectionBBox.y}
                        width={selectionBBox.width}
                        height={selectionBBox.height}
                        fill="rgba(16, 185, 129, 0.04)"
                        stroke="#10b981"
                        vectorEffect="non-scaling-stroke"
                        strokeWidth={0.8}
                        strokeDasharray="4 4"
                        className={`${canEditMap && !isPanToolActive ? 'cursor-move' : ''}`}
                        onPointerDown={(e) => {
                          if (!canEditMap || isPanToolActive) return; // Verifica permisos y herramienta
                          e.stopPropagation(); // Detiene propagación
                          const svgPos = getSvgCoordinates(e); // Coordenadas del cursor
                          setIsDraggingElement(true); // Activa movimiento del conjunto seleccionado
                          setElementDragStartPos(svgPos); // Registra origen del arrastre
                          const initialMap: Record<string, string> = {};
                          mapEntity.paths.forEach(item => {
                            if (selectedPathIds.includes(item.id)) {
                              initialMap[item.id] = item.d;
                            }
                          });
                          setInitialPathsD(initialMap);
                        }}
                      />

                      {/* Esquinas (Nodos/TIRADORES INTERACTIVOS DE REDIMENSIONADO Y ESCALA) */}
                      {cornerHandles.map((h) => (
                        <rect
                          key={h.type}
                          x={h.x - halfHandle}
                          y={h.y - halfHandle}
                          width={handleSize}
                          height={handleSize}
                          rx={Math.max(0.3, handleSize * 0.15)}
                          fill="#ffffff"
                          stroke="#10b981"
                          vectorEffect="non-scaling-stroke"
                          strokeWidth={1}
                          style={{ cursor: isPanToolActive ? 'default' : h.cursor }}
                          className="hover:fill-emerald-400 transition-colors shadow-md cursor-pointer"
                          onPointerDown={(e) => {
                            if (!canEditMap || isPanToolActive) return; // Si no hay permisos o está la manito, ignora
                            e.stopPropagation(); // Detiene propagación a la caja
                            const svgPos = getSvgCoordinates(e); // Coordenadas SVG
                            setIsResizingElement(h.type); // Activa redimensionado en la esquina correspondiente
                            setElementDragStartPos(svgPos); // Posición inicial
                            setInitialSelectionBBox(selectionBBox); // Guarda bounding box de inicio
                            const initialMap: Record<string, string> = {};
                            mapEntity.paths.forEach(item => {
                              if (selectedPathIds.includes(item.id)) {
                                initialMap[item.id] = item.d;
                              }
                            });
                            setInitialPathsD(initialMap);
                          }}
                        />
                      ))}
                    </g>
                  );
                })()}

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

          {/* BARRA DE HERRAMIENTAS RÁPIDAS VECTORIALES (SELECCIONAR TODO / BORRAR / CORTAR / AGRUPAR) */}
          {selectedPathIds.length === 0 && mapEntity.paths.length > 0 && canEditMap && (
            <div className="absolute bottom-6 bg-slate-900/95 border border-slate-800 backdrop-blur-md rounded-2xl p-2 px-4 shadow-2xl flex items-center space-x-3 z-30 animate-fade-in">
              <span className="text-xs font-medium text-slate-400">
                Lienzo activo con <strong className="text-emerald-400 font-bold">{mapEntity.paths.length}</strong> porciones / polígonos
              </span>
              <div className="w-px h-5 bg-slate-800" />
              <button
                onClick={handleSelectAll}
                className="py-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-emerald-950/40 hover:scale-105"
                title="Seleccionar todas las porciones y polígonos del mapa a la vez"
              >
                <CheckSquare size={14} />
                <span>Seleccionar Todo ({mapEntity.paths.length})</span>
              </button>
            </div>
          )}

          {selectedPathIds.length > 0 && canEditMap && (
            <div className="absolute bottom-6 bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl p-2 px-4 shadow-2xl flex items-center space-x-3 z-30 animate-fade-in">
              <span className="text-xs font-bold text-emerald-400">
                {selectedPathIds.length} de {mapEntity.paths.length} seleccionado(s)
              </span>

              <div className="w-px h-5 bg-slate-800" />

              {/* Botón Seleccionar Todo / Alternar Selección Completa */}
              <button
                onClick={handleSelectAll}
                className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  selectedPathIds.length === mapEntity.paths.length
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                }`}
                title={selectedPathIds.length === mapEntity.paths.length ? "Deseleccionar todos los elementos" : "Seleccionar todos los elementos del mapa"}
              >
                <CheckSquare size={12} className={selectedPathIds.length === mapEntity.paths.length ? 'text-amber-400' : 'text-emerald-400'} />
                <span>{selectedPathIds.length === mapEntity.paths.length ? 'Deseleccionar Todo' : `Seleccionar Todo (${mapEntity.paths.length})`}</span>
              </button>

              {/* Botón Focus / Centrar Zoom */}
              <button
                onClick={handleFocusOnSelection}
                className="py-1 px-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                title="Centrar el zoom y la pantalla en la figura o polígono seleccionado"
              >
                <Target size={12} className="text-emerald-400" />
                <span>Focus Selección</span>
              </button>

              {/* BOTONES ESTRUCTURALES: AGRUPAR Y COMBINAR */}
              {selectedPathIds.length >= 2 && (
                <>
                  <button
                    onClick={() => handleGroupSelectedPaths()}
                    className="py-1 px-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                    title="Agrupar elementos seleccionados manteniendo intactos sus datos e identificaciones"
                  >
                    <span>📁 Agrupar</span>
                  </button>

                  <button
                    onClick={() => handleCombineSelectedPaths()}
                    className="py-1 px-2.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                    title="Combinar trazados en una sola figura unificada guardando las piezas originales"
                  >
                    <span>🧩 Combinar</span>
                  </button>
                </>
              )}

              {/* BOTÓN DESAGRUPAR */}
              {selectedPathIds.some(id => mapEntity.paths.find(p => p.id === id)?.groupId) && (
                <button
                  onClick={() => handleUngroupSelectedPaths()}
                  className="py-1 px-2.5 bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                  title="Desagrupar elementos de la selección sin alterar ningún dato"
                >
                  <span>📂 Desagrupar</span>
                </button>
              )}

              {/* BOTÓN DESCOMBINAR */}
              {selectedPathIds.some(id => {
                const item = mapEntity.paths.find(p => p.id === id);
                return item && (item.isCombined || (item.customData?.subItems && item.customData.subItems.length > 0));
              }) && (
                <button
                  onClick={() => handleUncombineSelectedPath()}
                  className="py-1 px-2.5 bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                  title="Descombinar trazado y restaurar cada parte independiente original"
                >
                  <span>✂️ Descombinar</span>
                </button>
              )}

              {/* Botón Deseleccionar */}
              <button
                onClick={() => setSelectedPathIds([])}
                className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                title="Deseleccionar todos los elementos activos"
              >
                <X size={12} className="text-slate-400" />
                <span>Deseleccionar</span>
              </button>

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

        {/* COLUMNA DERECHA: INSPECTOR DE PROPIEDADES (TRANSFORMACIONES Y CAMPOS DE TEXTO) (OCULTABLE) */}
        {showRightSidebar && (
          <div className="w-80 bg-slate-900/80 border-l border-slate-800 p-4 flex flex-col space-y-5 overflow-y-auto shrink-0">
            
            {/* SECCIÓN 1: CONTROLES DE TRANSFORMACIÓN GLOBAL (PAN Y ESCALA) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                  <Move size={14} />
                  <span>Transformación Espacial</span>
                </h3>
                
                <div className="flex items-center space-x-1.5">
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

                  {/* Botón Esconder Panel Derecho */}
                  <button
                    onClick={() => setShowRightSidebar(false)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Esconder Panel Derecho de Inspector"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
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

            {/* SECCIÓN 2.0: CONTROLES DIRECTOS DE REDIMENSIONAR (ESCALAR) Y ACOMODAR (POSICIONAR) ELEMENTO */}
            {selectedPathIds.length > 0 && (
              <div className="space-y-2.5 bg-slate-900/90 p-3 rounded-2xl border border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] text-emerald-400 uppercase font-black tracking-widest flex items-center space-x-1">
                    <Maximize2 size={11} className="text-emerald-400" />
                    <span>Redimensionar y Acomodar Trazo</span>
                  </label>
                  <span className="text-[8px] text-emerald-300 font-bold bg-emerald-950/80 border border-emerald-800/50 px-1.5 py-0.5 rounded-md">
                    {selectedPathIds.length} selec.
                  </span>
                </div>

                {/* BOTONES DE ESCALA RÁPIDA (REDIMENSIONAR PORCENTAJE) */}
                <div className="space-y-1">
                  <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Factores de Escala:</span>
                  <div className="grid grid-cols-5 gap-1">
                    {[0.5, 0.8, 1.2, 1.5, 2.0].map(fac => (
                      <button
                        key={fac}
                        type="button"
                        onClick={() => handleScaleSelectedPaths(fac)}
                        disabled={!canEditMap}
                        className="px-1 py-1 bg-slate-950 hover:bg-emerald-950/60 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer text-center"
                        title={`Escalar objeto al ${(fac * 100).toFixed(0)}%`}
                      >
                        {fac}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* BOTONES AUTO-ACOMODAR Y CENTRAR EN LIENZO */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleFitSelectedPathToCanvas}
                    disabled={!canEditMap}
                    className="py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 shadow-sm"
                    title="Escala y encaja automáticamente el trazo seleccionado dentro del lienzo"
                  >
                    <Target size={12} className="text-emerald-400" />
                    <span>Auto-Acomodar</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCenterSelectedPathOnCanvas}
                    disabled={!canEditMap}
                    className="py-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 shadow-sm"
                    title="Mueve el trazo seleccionado directamente al centro geométrico del lienzo"
                  >
                    <Maximize2 size={12} className="text-sky-400" />
                    <span>Centrar en Lienzo</span>
                  </button>
                </div>

                {/* CONTROLES DIRECCIONALES Y PASO DE MOVIMIENTO CON TECLADO */}
                <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">Paso de Movimiento:</span>
                    <div className="flex items-center space-x-1">
                      {[1, 5, 10, 20].map(step => (
                        <button
                          key={step}
                          type="button"
                          onClick={() => setNudgeStep(step)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                            nudgeStep === step
                              ? 'bg-emerald-500 text-slate-950 font-extrabold'
                              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          {step}px
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleNudgeSelectedPaths(-nudgeStep, 0)}
                      disabled={!canEditMap}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95"
                      title={`Mover ${nudgeStep}px a la izquierda (o usa flecha ←)`}
                    >
                      ←
                    </button>
                    <div className="flex flex-col space-y-1">
                      <button
                        type="button"
                        onClick={() => handleNudgeSelectedPaths(0, -nudgeStep)}
                        disabled={!canEditMap}
                        className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95"
                        title={`Mover ${nudgeStep}px arriba (o usa flecha ↑)`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNudgeSelectedPaths(0, nudgeStep)}
                        disabled={!canEditMap}
                        className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95"
                        title={`Mover ${nudgeStep}px abajo (o usa flecha ↓)`}
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNudgeSelectedPaths(nudgeStep, 0)}
                      disabled={!canEditMap}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95"
                      title={`Mover ${nudgeStep}px a la derecha (o usa flecha →)`}
                    >
                      →
                    </button>
                  </div>

                  <p className="text-[8.5px] text-slate-400 italic text-center pt-0.5">
                    💡 Tip: Usa las flechas del teclado <span className="font-mono font-bold text-emerald-400">(← ↑ ↓ →)</span> para acomodar la posición. Mantiene Shift para dar saltos 4x mayores.
                  </p>
                </div>

                {/* CONTROLES DE GROSOR Y BORDE VECTORIAL RESPONSIVO */}
                <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
                  <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider block">Estilo de Línea / Borde Liso:</span>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { mode: 'none', label: '🚫 Sin Borde', val: 0 },
                      { mode: 'thin', label: '⚡ 0.5px Fino', val: 0.5 },
                      { mode: 'medium', label: '🔹 1px Normal', val: 1 },
                      { mode: 'thick', label: '⬛ 2px Marcado', val: 2 }
                    ].map(item => (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => {
                          setGlobalStrokeMode(item.mode as any);
                          setGlobalStrokeWidth(item.val);
                          if (item.mode === 'none') {
                            handleMakeSelectedPathSmooth();
                          }
                        }}
                        className={`py-1 rounded-lg text-[8.5px] font-bold text-center border transition-all cursor-pointer ${
                          globalStrokeMode === item.mode
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-sm'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* ACCIONES RÁPIDAS DE COPIA Y SUI GENERIS DE BORDES */}
                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleCopyStrokeFromOtherObjects()}
                      disabled={!canEditMap}
                      className="py-1 px-1.5 bg-slate-900 hover:bg-sky-950 border border-slate-800 hover:border-sky-500/50 text-sky-300 rounded-lg text-[8.5px] font-bold transition-all cursor-pointer text-center truncate"
                      title="Copia exactamente el grosor y estilo de borde de los otros objetos del mapa"
                    >
                      📋 Copiar Borde Vecino
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMakeSelectedPathSmooth()}
                      disabled={!canEditMap}
                      className="py-1 px-1.5 bg-slate-900 hover:bg-emerald-950 border border-slate-800 hover:border-emerald-500/50 text-emerald-300 rounded-lg text-[8.5px] font-bold transition-all cursor-pointer text-center truncate"
                      title="Elimina el borde del objeto activo para hacerlo 100% liso"
                    >
                      🚫 Hacer Liso
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyGlobalStrokeToAllPaths(globalStrokeWidth)}
                    disabled={!canEditMap}
                    className="w-full py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-300 rounded-lg text-[9px] font-bold transition-all cursor-pointer mt-0.5"
                  >
                    Aplicar este Grosor de Borde a Todo el Mapa
                  </button>
                </div>
              </div>
            )}


            {selectedPathIds.length === 1 ? (
              <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                
                {/* LISTA DESPLEGABLE CON SUB-LISTAS Y BUSCADOR TIPO GOOGLE PARA VINCULAR TERRITORIO (PAÍS / PROVINCIAS) */}
                <div className="space-y-2 bg-slate-900/90 p-3 rounded-2xl border border-sky-500/40 shadow-inner relative">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] text-sky-400 uppercase font-black tracking-widest flex items-center space-x-1">
                      <Globe size={11} className="text-sky-400" />
                      <span>Vincular Territorio Cargado</span>
                    </label>
                    <span className="text-[8px] text-slate-400 font-bold bg-sky-950/60 border border-sky-800/50 px-1.5 py-0.5 rounded-md">
                      Sub-listas
                    </span>
                  </div>

                  {/* Botón Principal Disparador del Menú con Sub-Listas */}
                  <button
                    type="button"
                    onClick={() => setShowInspectorPickerDropdown(!showInspectorPickerDropdown)}
                    disabled={!canEditMap}
                    className="w-full bg-slate-950 hover:bg-slate-900 border border-sky-500/50 hover:border-sky-400 text-slate-100 rounded-xl p-2.5 text-xs font-bold text-left flex items-center justify-between transition-all cursor-pointer shadow-md"
                  >
                    <span className="truncate flex items-center space-x-1.5">
                      <span className="text-emerald-400">📍</span>
                      <span className="truncate">
                        {editingPathData.id === 'AR' || editingPathData.id === 'ARGENTINA'
                          ? '🇦🇷 Argentina (República Argentina)'
                          : editingPathData.name
                            ? `${editingPathData.name} (${editingPathData.id})`
                            : '-- Buscar en Sub-Listas de Países y Provincias --'}
                      </span>
                    </span>
                    <ChevronDown size={14} className={`text-sky-400 transition-transform duration-200 shrink-0 ${showInspectorPickerDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* DESPLEGABLE CON BUSCADOR Y SUB-LISTAS (PAÍSES, PROVINCIAS, MUNICIPIOS) */}
                  {showInspectorPickerDropdown && (
                    <div className="mt-2 bg-slate-950 border border-slate-700 rounded-2xl p-3 space-y-2.5 z-50 shadow-2xl animate-fadeIn">
                      
                      {/* Campo de Búsqueda Asistido Estilo Google */}
                      <div className="relative flex items-center">
                        <Search size={12} className="absolute left-2.5 text-sky-400" />
                        <input
                          type="text"
                          value={inspectorPickerSearch}
                          onChange={(e) => setInspectorPickerSearch(e.target.value)}
                          placeholder="🔍 Buscador asistido: filtra por nombre..."
                          className="w-full bg-slate-900 border border-slate-700 focus:border-sky-400 rounded-xl py-1 pl-7 pr-7 text-[11px] text-slate-100 placeholder:text-slate-500 outline-hidden"
                        />
                        {inspectorPickerSearch && (
                          <button
                            type="button"
                            onClick={() => setInspectorPickerSearch('')}
                            className="absolute right-2 text-slate-500 hover:text-slate-300 text-[10px] font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                        
                        {/* SUB-LISTA 1: PAÍSES / NIVEL NACIONAL */}
                        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
                          <button
                            type="button"
                            onClick={() => toggleInspectorPickerSection('paises')}
                            className="w-full bg-slate-900 px-2.5 py-1.5 flex items-center justify-between text-[10px] font-extrabold uppercase text-sky-400 tracking-wider text-left border-b border-slate-800 cursor-pointer"
                          >
                            <span className="flex items-center space-x-1">
                              <Globe size={11} />
                              <span>1. Países / Macro Regiones</span>
                            </span>
                            <ChevronDown size={12} className={`text-slate-400 transition-transform ${inspectorPickerSections.paises ? 'rotate-180' : ''}`} />
                          </button>

                          {!inspectorPickerSections.paises && (
                            <div className="p-1.5 space-y-1">
                              {[
                                { id: 'AR', name: 'Argentina (República Argentina)', flag: '🇦🇷' },
                                { id: 'BR', name: 'Brasil', flag: '🇧🇷' },
                                { id: 'CL', name: 'Chile', flag: '🇨🇱' },
                                { id: 'UY', name: 'Uruguay', flag: '🇺🇾' },
                                { id: 'CO', name: 'Colombia', flag: '🇨🇴' },
                                { id: 'PE', name: 'Perú', flag: '🇵🇪' },
                                { id: 'MX', name: 'México', flag: '🇲🇽' },
                                { id: 'ES', name: 'España', flag: '🇪🇸' },
                                { id: 'US', name: 'Estados Unidos', flag: '🇺🇸' }
                              ]
                                .filter(c => !inspectorPickerSearch || c.name.toLowerCase().includes(inspectorPickerSearch.toLowerCase()) || c.id.toLowerCase().includes(inspectorPickerSearch.toLowerCase()))
                                .map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      handleAssignPredefinedTerritory(c.id);
                                      setShowInspectorPickerDropdown(false);
                                    }}
                                    className="w-full p-1.5 bg-slate-950 hover:bg-sky-600/20 border border-slate-800 hover:border-sky-500/50 rounded-lg text-left text-[11px] font-bold text-slate-200 transition-all cursor-pointer flex items-center justify-between group"
                                  >
                                    <span className="flex items-center space-x-1.5 truncate">
                                      <span>{c.flag}</span>
                                      <span className="group-hover:text-sky-300 truncate">{c.name}</span>
                                    </span>
                                    <span className="text-[9px] font-mono text-slate-500 group-hover:text-sky-400 font-bold shrink-0 ml-1">{c.id}</span>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>

                        {/* SUB-LISTA 2: PROVINCIAS DE ARGENTINA (24 EN ORDEN ALFABÉTICO A-Z) */}
                        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
                          <button
                            type="button"
                            onClick={() => toggleInspectorPickerSection('provincias')}
                            className="w-full bg-slate-900 px-2.5 py-1.5 flex items-center justify-between text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider text-left border-b border-slate-800 cursor-pointer"
                          >
                            <span className="flex items-center space-x-1">
                              <MapPin size={11} />
                              <span>2. Provincias de Argentina (24 A-Z)</span>
                            </span>
                            <ChevronDown size={12} className={`text-slate-400 transition-transform ${inspectorPickerSections.provincias ? 'rotate-180' : ''}`} />
                          </button>

                          {!inspectorPickerSections.provincias && (
                            <div className="p-1.5 grid grid-cols-1 gap-1">
                              {sortedProvinces
                                .filter(p => !inspectorPickerSearch || p.name.toLowerCase().includes(inspectorPickerSearch.toLowerCase()) || p.id.toLowerCase().includes(inspectorPickerSearch.toLowerCase()))
                                .map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      handleAssignPredefinedTerritory(p.id);
                                      setShowInspectorPickerDropdown(false);
                                    }}
                                    className="p-1.5 bg-slate-950 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/50 rounded-lg text-left text-[11px] font-bold text-slate-200 transition-all cursor-pointer flex items-center justify-between group"
                                  >
                                    <span className="group-hover:text-emerald-300 truncate">🇦🇷 {p.name}</span>
                                    <span className="text-[9px] font-mono text-slate-500 group-hover:text-emerald-400 font-bold shrink-0 ml-1">{p.id}</span>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>

                        {/* SUB-LISTA 3: MUNICIPIOS O DEPARTAMENTOS */}
                        {selectedProvince && selectedProvince.municipalities && selectedProvince.municipalities.length > 0 && (
                          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
                            <button
                              type="button"
                              onClick={() => toggleInspectorPickerSection('municipios')}
                              className="w-full bg-slate-900 px-2.5 py-1.5 flex items-center justify-between text-[10px] font-extrabold uppercase text-amber-400 tracking-wider text-left border-b border-slate-800 cursor-pointer"
                            >
                              <span className="flex items-center space-x-1">
                                <Layers size={11} />
                                <span>3. Municipios / Sub-divisiones ({selectedProvince.municipalities.length})</span>
                              </span>
                              <ChevronDown size={12} className={`text-slate-400 transition-transform ${inspectorPickerSections.municipios ? 'rotate-180' : ''}`} />
                            </button>

                            {!inspectorPickerSections.municipios && (
                              <div className="p-1.5 space-y-1">
                                {selectedProvince.municipalities
                                  .filter(m => !inspectorPickerSearch || m.name.toLowerCase().includes(inspectorPickerSearch.toLowerCase()) || m.id.toLowerCase().includes(inspectorPickerSearch.toLowerCase()))
                                  .map(m => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        handleAssignPredefinedTerritory(m.id);
                                        setShowInspectorPickerDropdown(false);
                                      }}
                                      className="w-full p-1.5 bg-slate-950 hover:bg-amber-600/20 border border-slate-800 hover:border-amber-500/50 rounded-lg text-left text-[11px] font-bold text-slate-200 transition-all cursor-pointer flex items-center justify-between group"
                                    >
                                      <span className="group-hover:text-amber-300 truncate">📍 {m.name}</span>
                                      <span className="text-[9px] font-mono text-slate-500 group-hover:text-amber-400 font-bold shrink-0 ml-1">{m.id}</span>
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  )}

                  {/* ACCIÓN RÁPIDA: CARGAR MAPA VECTORIAL COMPLETO DE ARGENTINA (24 PROVINCIAS) */}
                  <button
                    type="button"
                    onClick={() => {
                      const nativeArgMap: VectorMapEntity = {
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
                          ownerId: 'system',
                          visualStyles: { fillColor: (p as any).color || '#10b981', strokeColor: '#0f172a', strokeWidth: 1.5 },
                          customData: { valor: (p as any).value || 35, porcentaje: (p as any).percentage || 18, fill: (p as any).color || '#10b981', layer: 'provincia' }
                        })),
                        transform: { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true },
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                      };
                      setMapEntity(nativeArgMap);
                      if (onSaveMapEntity) onSaveMapEntity(nativeArgMap);
                      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(nativeArgMap));
                      safeSetItem('argentina_advanced_canvas_map_country', JSON.stringify(nativeArgMap));
                      showNotify("[🇦🇷] Mapa vectorial completo de las 24 Provincias de Argentina cargado al lienzo.");
                    }}
                    className="w-full bg-slate-950 hover:bg-emerald-950/40 border border-dashed border-emerald-500/40 hover:border-emerald-400/80 rounded-xl p-2 text-[10px] font-extrabold text-emerald-300 hover:text-emerald-200 text-center transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm mt-1"
                  >
                    <span>⚡ Cargar Trazado Vectorial Nativo de Argentina (24 Provincias)</span>
                  </button>

                  <p className="text-[9px] text-slate-400 leading-tight pt-0.5">
                    Busca y selecciona Argentina o una Provincia en las sub-listas para auto-completar datos y sincronizar con MUNDO.
                  </p>
                </div>

                {/* ID del Polígono */}
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

                {/* Nombre Territorial */}
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

                {/* SECCIÓN OBLIGATORIA: MEJORAR SILUETA SELECCIONADA (PERFECCIONADOR DE SILUETA - 4 OPCIONES Y VISTA PREVIA) */}
                <div className="border border-purple-800/80 rounded-2xl bg-gradient-to-b from-purple-950/40 to-slate-900/90 p-3 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between border-b border-purple-800/50 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center space-x-1.5">
                      <Sparkles size={14} className="text-purple-400" />
                      <span>Mejorar Silueta Seleccionada</span>
                    </h4>
                    <span className="text-[9px] bg-purple-900/80 text-purple-200 px-2 py-0.5 rounded font-mono border border-purple-700/50">
                      Perfeccionador SVG
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-snug">
                    Sustituye quirúrgicamente la silueta (<code className="text-purple-300 font-mono">d</code>) de <strong className="text-emerald-400">{editingPathData.name || editingPathData.id}</strong> con el contorno exterior limpio de otra fuente.
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
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl p-2 text-[10px] font-mono text-slate-200 outline-hidden resize-none"
                      />
                    </div>
                  )}

                  {silhouetteInputMethod === 'file' && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                        Importar archivo .JSON o .SVG:
                      </label>
                      <label className="flex items-center justify-center space-x-2 bg-slate-950 hover:bg-slate-900 border border-dashed border-purple-500/50 hover:border-purple-400 text-purple-300 p-3 rounded-xl cursor-pointer transition-all text-xs font-bold">
                        <Upload size={14} />
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
                      <label className="flex items-center justify-center space-x-2 bg-slate-950 hover:bg-slate-900 border border-dashed border-purple-500/50 hover:border-purple-400 text-purple-300 p-3 rounded-xl cursor-pointer transition-all text-xs font-bold">
                        <FileUp size={14} />
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
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl p-2 text-xs font-bold text-slate-200 outline-hidden cursor-pointer"
                      >
                        <option value="ARG_24">🇦🇷 Argentina (Mapa de 24 Provincias detalladas)</option>
                        <option value="CURRENT_MAP">🗺️ Mapa Actual ({mapEntity.paths.length} polígonos)</option>
                      </select>
                    </div>
                  )}

                  {/* BOTÓN "GENERAR VISTA PREVIA" */}
                  <button
                    type="button"
                    onClick={() => handleGenerateSilhouettePreview()}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-md shadow-purple-950/40 hover:scale-[1.01]"
                  >
                    <Sparkles size={14} />
                    <span>Generar Vista Previa</span>
                  </button>

                  {/* PANEL DE VISTA PREVIA Y BOTÓN "APLICAR CAMBIOS" (MUTACIÓN SEGURA) */}
                  {previewSilhouette && (
                    <div className="bg-purple-950/80 border border-purple-500/60 rounded-xl p-3 space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 flex items-center space-x-1">
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
                        El contorno exterior perfeccionado se muestra resaltado sobre el mapa. Presiona el botón para inyectarlo en <strong className="text-emerald-400">{editingPathData.name || editingPathData.id}</strong>.
                      </p>

                      {/* BOTÓN "APLICAR CAMBIOS" (MUTACIÓN SEGURA) */}
                      <button
                        type="button"
                        onClick={handleApplySilhouetteMutation}
                        className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/50 hover:scale-[1.02]"
                      >
                        <Check size={16} />
                        <span>Aplicar Cambios</span>
                      </button>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 italic text-center">
                    Los demás {mapEntity.paths.length - 1} nodos y todos los datos estadísticos de {editingPathData.name || editingPathData.id} se conservan 100% intactos.
                  </p>
                </div>

                {/* Selección de Color de Relleno 🎨 */}
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block flex items-center justify-between">
                    <span>Color de Relleno</span>
                    <span className="font-mono text-emerald-400">{editingPathData.color}</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={editingPathData.color || '#10b981'}
                      onChange={(e) => setEditingPathData({ ...editingPathData, color: e.target.value })}
                      disabled={!canEditMap}
                      className="w-9 h-9 rounded-lg border border-slate-800 bg-slate-900 cursor-pointer p-0.5"
                    />
                    <div className="flex-1 grid grid-cols-5 gap-1">
                      {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEditingPathData({ ...editingPathData, color: preset })}
                          style={{ backgroundColor: preset }}
                          className="w-full h-7 rounded border border-slate-800/60 hover:scale-105 transition-transform cursor-pointer"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Métricas: Valor y Porcentaje */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Valor / Métrica</label>
                    <input
                      type="number"
                      value={editingPathData.value}
                      onChange={(e) => setEditingPathData({ ...editingPathData, value: parseFloat(e.target.value) || 0 })}
                      disabled={!canEditMap}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 outline-hidden focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Porcentaje (%)</label>
                    <input
                      type="number"
                      value={editingPathData.percentage}
                      onChange={(e) => setEditingPathData({ ...editingPathData, percentage: parseFloat(e.target.value) || 0 })}
                      disabled={!canEditMap}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Categoría / Rama / Layer */}
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Categoría / Rama</label>
                  <input
                    type="text"
                    value={editingPathData.category}
                    onChange={(e) => setEditingPathData({ ...editingPathData, category: e.target.value })}
                    disabled={!canEditMap}
                    placeholder="ej: América del Sur, Europa, Provincia"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-hidden focus:border-emerald-500"
                  />
                </div>

                {/* Geometría SVG (Path d) */}
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Geometría SVG (Path d)</label>
                  <textarea
                    value={editingPathData.d}
                    onChange={(e) => setEditingPathData({ ...editingPathData, d: e.target.value })}
                    disabled={!canEditMap}
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] font-mono text-slate-300 outline-hidden focus:border-emerald-500 resize-none leading-normal"
                  />
                </div>

                {/* Botón Guardar Cambios del Trazo */}
                <button
                  onClick={handleSaveEditingPath}
                  disabled={!canEditMap}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-950/40"
                >
                  <Check size={13} />
                  <span>Guardar Trazo</span>
                </button>

                {/* Botón Agrupar en Continente */}
                <button
                  onClick={() => handleGroupSelectionIntoContinent()}
                  disabled={!canEditMap}
                  className="w-full py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Globe size={13} className="text-indigo-400" />
                  <span>Crear Rama Continente para este Trazo</span>
                </button>
              </div>
            ) : selectedPathIds.length > 1 ? (
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs text-emerald-400 font-black flex items-center space-x-1.5">
                    <CheckSquare size={13} />
                    <span>Selección Múltiple ({selectedPathIds.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPathIds([])}
                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Deseleccionar
                  </button>
                </div>

                {/* RENOMBRADO EN LOTE DE POLÍGONOS SELECCIONADOS */}
                <div className="space-y-2 bg-slate-900/90 p-3 rounded-2xl border border-sky-500/30">
                  <label className="text-[9px] text-sky-400 uppercase font-black tracking-widest block flex items-center justify-between">
                    <span>Renombrar en Lote ✏️</span>
                    <span className="text-[8px] text-slate-400 font-mono">base + nº</span>
                  </label>

                  <input
                    type="text"
                    value={batchRenameText}
                    onChange={(e) => setBatchRenameText(e.target.value)}
                    placeholder="ej: Islas Malvinas, Región Norte..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-400 rounded-xl p-2 text-xs font-bold text-slate-100 outline-hidden"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchRenameSequential}
                        onChange={(e) => setBatchRenameSequential(e.target.checked)}
                        className="rounded accent-sky-500 cursor-pointer"
                      />
                      <span>Numerar secuencialmente (1, 2, 3...)</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBatchRename(batchRenameText, batchRenameSequential)}
                    disabled={!canEditMap || !batchRenameText.trim()}
                    className="w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-1 shadow-md shadow-sky-950/40"
                  >
                    <Edit3 size={13} />
                    <span>Aplicar Nombre a {selectedPathIds.length} Elementos</span>
                  </button>
                </div>

                {/* Cambio de color en lote */}
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Cambiar Color en Lote 🎨</label>
                  <div className="flex items-center space-x-2">
                    {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleBatchColorChange(preset)}
                        style={{ backgroundColor: preset }}
                        className="flex-1 h-7 rounded border border-slate-800 hover:scale-105 transition-transform cursor-pointer"
                        title={`Aplicar color ${preset} a la selección`}
                      />
                    ))}
                  </div>
                </div>

                {/* BOTONES ESTRUCTURALES: AGRUPAR Y COMBINAR */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleGroupSelectedPaths()}
                    className="py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1"
                    title="Agrupar elementos seleccionados sin perder identificaciones individuales"
                  >
                    <span>📁 Agrupar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCombineSelectedPaths()}
                    className="py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1"
                    title="Combinar trazados vectoriales en un solo objeto unificado guardando piezas originales"
                  >
                    <span>🧩 Combinar</span>
                  </button>
                </div>

                {/* Agrupar selección en rama continente */}
                <button
                  onClick={() => handleGroupSelectionIntoContinent()}
                  disabled={!canEditMap}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-950/40"
                >
                  <Globe size={14} />
                  <span>Agrupar en Nueva Rama (Continente)</span>
                </button>
              </div>
            ) : (
              <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800/80 text-center text-xs text-slate-500 space-y-2">
                <p>Haz clic sobre cualquier polígono en el mapa o lista para desplegar y editar sus propiedades.</p>
                <p className="text-[10px] text-slate-600">Mantén Shift o Ctrl para seleccionar múltiples piezas y agruparlas en un Continente.</p>
              </div>
            )}
          </div>
        </div>
        )}
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

      {/* MODAL DE ASOCIAR MAPA COMPLETO A OTRA RUTA O PROVINCIA */}
      {isAssociateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-sky-400 flex items-center space-x-2">
                <Globe size={18} />
                <span>Asociar Mapa a Otra Ruta / Provincia</span>
              </h3>
              <button
                onClick={() => setIsAssociateModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Selecciona la provincia o ruta destino donde deseas reemplazar el mapa por este lienzo vectorizado ({mapEntity.paths.length} trazados).
            </p>

            {/* Buscador de ruta destino */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={associateSearchQuery}
                onChange={(e) => setAssociateSearchQuery(e.target.value)}
                placeholder="Buscar provincia o ruta objetivo..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-100 placeholder:text-slate-500 outline-none font-bold"
              />
            </div>

            {/* Lista de rutas disponibles */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {availableTerritories
                .filter(t => !associateSearchQuery || t.name.toLowerCase().includes(associateSearchQuery.toLowerCase()) || t.id.toLowerCase().includes(associateSearchQuery.toLowerCase()))
                .map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTargetAssociateRouteId(t.id)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      targetAssociateRouteId === t.id
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                        : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-300 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-base">{t.category === 'provincia' ? '🇦🇷' : '🌐'}</span>
                      <div>
                        <p className="text-xs font-bold">{t.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">ID: {t.id}</p>
                      </div>
                    </div>
                    {targetAssociateRouteId === t.id && (
                      <span className="text-[10px] bg-sky-500 text-slate-950 px-2 py-0.5 rounded-full font-black">
                        Seleccionado
                      </span>
                    )}
                  </button>
                ))}
            </div>

            {/* Botones de acción del modal */}
            <div className="flex items-center justify-end space-x-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setIsAssociateModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!targetAssociateRouteId) {
                    alert("Por favor selecciona una ruta destino de la lista.");
                    return;
                  }
                  handleAssociateMapToSelectedRoute(targetAssociateRouteId);
                }}
                disabled={!targetAssociateRouteId}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-sky-950/50 flex items-center space-x-1.5 cursor-pointer"
              >
                <CheckCircle size={14} />
                <span>Guardar y Asociar a la Ruta</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
