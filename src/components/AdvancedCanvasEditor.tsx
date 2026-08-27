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
  Folder, FolderOpen, Spline, Unlink, MousePointer, GitMerge, Puzzle
} from 'lucide-react'; // Íconos Lucide para la interfaz tipo CorelDRAW, Figma y calibrador vector
import { VectorPathItem, VectorMapEntity, UserRole, UserProfile, ProvinceData, NavNode } from '../types'; // Interfaces de TypeScript
import { safeSetItem, safeGetItem } from '../lib/storage'; // Funciones de almacenamiento seguro
import { getPathBBox, getMultiplePathsBBox, fitPathToBBox, translatePathD, scalePathD } from '../lib/mapUtils'; // Calculadoras de Bounding Box y transformaciones espaciales
import { provincePaths } from '../data/provincePaths'; // Moldes nativos vectoriales de la República Argentina (REGLA INTOCABLE)
import { defaultWorldVectorMap } from '../data/defaultWorldMap'; // Moldes vectoriales mundiales
import { mockProvincesData } from '../data/mockData'; // Datos iniciales con indicadores provinciales
import { AddElementModal } from './AddElementModal'; // Modal para agregar nuevos elementos, miembros o territorios sin reemplazar nada
import { MapSafetyConfirmModal } from './MapSafetyConfirmModal'; // Modal de advertencia y confirmación previa con imágenes SVG
import { 
  CANONICAL_TIERRA_DEL_FUEGO_D, 
  CANONICAL_MALVINAS_D, 
  isPathMatchingMalvinas, 
  isPathMatchingTierraDelFuego, 
  restoreTierraDelFuegoToOriginal, 
  restoreMalvinasToOriginal,
  autoRepairArgentinaMap 
} from '../utils/mapRecovery'; // Motor de recuperación geográfica y blindaje de territorios históricos

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
  onDirtyChange?: (isDirty: boolean) => void; // Notifica el estado de cambios sin guardar al gestor de proyectos
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

// FUNCIÓN DE CONSTRUCCIÓN DE MAPA INICIAL SEGÚN CONTEXTO (PRESERVA SIEMPRE TODO EL MAPA COMPLETO)
export const getInitialContextualMap = (
  province?: ProvinceData | null, // Provincia o entidad seleccionada en la vista general
  urlParentId?: string | null, // ID del padre obtenido por URL query param
  selectedSubdivisionId?: string | null, // ID de la subdivisión/polígono seleccionado para resaltado
  allProvinces?: Record<string, ProvinceData>, // Diccionario global de todas las provincias
  isolateSelectionExplicitly: boolean = false // Si es true (solo si el usuario activa el modo aislamiento), aísla la selección
): VectorMapEntity => {
  // CASO 1: Si el usuario pidió explícitamente aislar la subdivisión seleccionada
  if (isolateSelectionExplicitly && selectedSubdivisionId) {
    const subNormalized = selectedSubdivisionId.toLowerCase().replace(/^ar-/, '');
    const isMalvinas = selectedSubdivisionId.toLowerCase().includes('malvin') || selectedSubdivisionId.toLowerCase().includes('mlv');

    const foundSub = province?.municipalities?.find(m => 
      m.id === selectedSubdivisionId || 
      m.id.toLowerCase() === selectedSubdivisionId.toLowerCase() ||
      m.id.toLowerCase().replace(/^ar-/, '') === subNormalized ||
      (m.name && m.name.toLowerCase() === selectedSubdivisionId.toLowerCase()) ||
      (isMalvinas && m.name.toLowerCase().includes('malvin'))
    );

    const foundInPaths = provincePaths.find(p => 
      p.id === selectedSubdivisionId || 
      p.id.toLowerCase() === selectedSubdivisionId.toLowerCase() ||
      p.id.toLowerCase().replace(/^ar-/, '') === subNormalized ||
      p.name.toLowerCase() === selectedSubdivisionId.toLowerCase() ||
      (isMalvinas && (p.name.toLowerCase().includes('malvin') || p.id === 'AR-MLV'))
    );

    const foundInAll = allProvinces ? Object.values(allProvinces).find(p => 
      p.id === selectedSubdivisionId || 
      p.id.toLowerCase() === selectedSubdivisionId.toLowerCase() ||
      p.id.toLowerCase().replace(/^ar-/, '') === subNormalized ||
      p.name.toLowerCase() === selectedSubdivisionId.toLowerCase() ||
      (isMalvinas && (p.name.toLowerCase().includes('malvin') || p.id === 'AR-MLV'))
    ) : undefined;

    const matchedItem = foundSub || foundInPaths || foundInAll;

    if (matchedItem) {
      const subItems = (matchedItem as any).customData?.subItems;
      if (Array.isArray(subItems) && subItems.length > 0) {
        return {
          id: `map-subdivision-${matchedItem.id.toLowerCase()}`,
          title: `Edición Aislada - ${matchedItem.name}`,
          level: 'subdivision',
          parentId: province?.id || 'country',
          ownerId: 'system',
          isApproved: true,
          paths: subItems,
          transform: { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      const itemD = matchedItem.d || (foundInPaths ? foundInPaths.d : '');
      return {
        id: `map-subdivision-${matchedItem.id.toLowerCase()}`,
        title: `Edición Aislada - ${matchedItem.name}`,
        level: 'subdivision',
        parentId: province?.id || 'country',
        ownerId: 'system',
        isApproved: true,
        paths: [{
          id: matchedItem.id,
          name: matchedItem.name,
          d: itemD,
          category: 'subdivision',
          ownerId: 'system',
          visualStyles: {
            fillColor: (matchedItem as any).visualStyles?.fillColor || (matchedItem as any).color || '#10b981',
            strokeColor: (matchedItem as any).visualStyles?.strokeColor || '#0f172a',
            strokeWidth: 1.5
          },
          customData: {
            valor: (matchedItem as any).value || 35,
            porcentaje: (matchedItem as any).percentage || 18,
            fill: (matchedItem as any).color || '#10b981',
            layer: 'subdivision'
          }
        }],
        transform: { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  // CASO 2: Si es una provincia individual específica con municipios detallados
  if (province && province.id !== 'COUNTRY_MAP' && province.id !== 'country' && province.id !== 'AR' && province.id !== 'ARGENTINA' && province.id !== 'WORLD_MAP' && province.id !== 'WORLD' && province.id !== 'world') {
    // Si tiene municipios detallados con trazados SVG 'd'
    if (province.municipalities && province.municipalities.length > 0) {
      const validSubs = province.municipalities.filter(m => m.d && m.d.trim().length > 0);
      if (validSubs.length > 0) {
        return {
          id: `map-${province.id.toLowerCase()}`,
          title: `Mapa Vectorial Completo - ${province.name}`,
          level: 'provincia',
          parentId: province.id,
          ownerId: 'system',
          isApproved: true,
          paths: validSubs.map(m => ({
            id: m.id,
            name: m.name,
            d: m.d!,
            category: 'municipio',
            ownerId: 'system',
            visualStyles: {
              fillColor: m.visualStyles?.fillColor || m.color || '#10b981',
              strokeColor: m.visualStyles?.strokeColor || '#0f172a',
              strokeWidth: 1.5
            },
            customData: {
              valor: m.value,
              porcentaje: m.percentage,
              fill: m.visualStyles?.fillColor || m.color || '#10b981',
              stroke: m.visualStyles?.strokeColor || '#0f172a',
              ...(m.customData || {})
            }
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

    // Si no tiene municipios, devolvemos el mapa nacional completo resaltando esta provincia para mantener el contexto global
    return {
      id: `map-contexto-${province.id.toLowerCase()}`,
      title: `Mapa Nacional con foco en ${province.name}`,
      level: 'pais',
      parentId: 'WORLD',
      ownerId: 'system',
      isApproved: true,
      paths: provincePaths.map(p => {
        const isMatch = p.id === province.id || p.id.toLowerCase() === province.id.toLowerCase() || p.id.toLowerCase().replace(/^ar-/, '') === province.id.toLowerCase().replace(/^ar-/, '') || p.name.toLowerCase() === province.name.toLowerCase();
        return {
          id: p.id,
          name: p.name,
          d: isMatch && province.d ? province.d : p.d,
          category: 'provincia',
          ownerId: 'system',
          visualStyles: {
            fillColor: isMatch ? ((province as any).color || '#10b981') : ((p as any).color || '#334155'),
            strokeColor: isMatch ? '#38bdf8' : '#0f172a',
            strokeWidth: isMatch ? 2.5 : 1.2
          },
          customData: {
            valor: isMatch ? ((province as any).population || (province as any).value || 35) : (p as any).value || 25,
            porcentaje: isMatch ? ((province as any).percentage || 18) : (p as any).percentage || 10,
            fill: isMatch ? ((province as any).color || '#10b981') : ((p as any).color || '#334155'),
            layer: 'provincia'
          }
        };
      }),
      transform: { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // CASO 2.5: Nivel Global / Mundial (WORLD_MAP)
  if (province && (province.id === 'WORLD_MAP' || province.id === 'world' || province.id === 'MUNDO')) {
    // 1. Si la entidad mundial ya contiene municipios o polígonos detallados (ej: 868 trazados de mapa detallado), preservarlos siempre
    if (province.municipalities && province.municipalities.length > 0) {
      const validSubs = province.municipalities.filter(m => m.d && m.d.trim().length > 0);
      if (validSubs.length > 0) {
        return {
          id: `map-world-${province.id.toLowerCase()}`,
          title: province.name || 'Mapa Vectorial Mundial Completo',
          level: 'mundo',
          parentId: 'root',
          ownerId: 'system',
          isApproved: true,
          paths: validSubs.map(m => ({
            id: m.id,
            name: m.name,
            d: m.d!,
            category: m.layer || 'pais',
            ownerId: 'system',
            visualStyles: {
              fillColor: m.visualStyles?.fillColor || m.color || '#10b981',
              strokeColor: m.visualStyles?.strokeColor || '#0f172a',
              strokeWidth: 1.2
            },
            customData: {
              valor: m.value,
              porcentaje: m.percentage,
              fill: m.visualStyles?.fillColor || m.color || '#10b981',
              stroke: m.visualStyles?.strokeColor || '#0f172a',
              layer: m.layer || 'pais',
              ...(m.customData || {})
            }
          })),
          transform: { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    }

    // 2. Si allProvinces contiene la versión mundial detallada
    if (allProvinces && (allProvinces['WORLD_MAP']?.municipalities?.length || allProvinces['world']?.municipalities?.length)) {
      const globalProv = allProvinces['WORLD_MAP'] || allProvinces['world'];
      const validSubs = globalProv?.municipalities?.filter(m => m.d && m.d.trim().length > 0) || [];
      if (validSubs.length > 0) {
        return {
          id: `map-world-global`,
          title: globalProv?.name || 'Mapa Vectorial Mundial Completo',
          level: 'mundo',
          parentId: 'root',
          ownerId: 'system',
          isApproved: true,
          paths: validSubs.map(m => ({
            id: m.id,
            name: m.name,
            d: m.d!,
            category: m.layer || 'pais',
            ownerId: 'system',
            visualStyles: {
              fillColor: m.visualStyles?.fillColor || m.color || '#10b981',
              strokeColor: m.visualStyles?.strokeColor || '#0f172a',
              strokeWidth: 1.2
            },
            customData: {
              valor: m.value,
              porcentaje: m.percentage,
              fill: m.visualStyles?.fillColor || m.color || '#10b981',
              stroke: m.visualStyles?.strokeColor || '#0f172a',
              layer: m.layer || 'pais',
              ...(m.customData || {})
            }
          })),
          transform: { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    }

    // 3. Fallback solo si no hay polígonos detallados
    const worldPaths = defaultWorldVectorMap.map(c => ({
      id: c.id,
      name: c.name,
      d: c.d,
      category: c.category || 'Mundo',
      ownerId: 'system',
      visualStyles: {
        fillColor: c.color || '#10b981',
        strokeColor: '#0f172a',
        strokeWidth: 1.2
      },
      customData: {
        valor: c.value || 30,
        porcentaje: c.percentage || 10,
        fill: c.color || '#10b981',
        layer: c.category || 'Mundo'
      }
    }));
    return {
      id: 'map-world-global',
      title: 'Mapa Vectorial Mundial Completo (Todos los Continentes y Países)',
      level: 'mundo',
      parentId: 'root',
      ownerId: 'system',
      isApproved: true,
      paths: worldPaths,
      transform: { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // CASO 3: Nivel Nacional / País (Argentina) sin selección de subdivisión
  if (province && (province.id === 'country' || province.id === 'AR' || province.id === 'ARGENTINA' || province.id === 'COUNTRY_MAP')) {
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
        ownerId: 'system',
        visualStyles: {
          fillColor: (p as any).color || '#10b981',
          strokeColor: '#0f172a',
          strokeWidth: 1.5
        },
        customData: {
          valor: (p as any).value !== undefined ? (p as any).value : 45,
          porcentaje: (p as any).percentage !== undefined ? (p as any).percentage : 22,
          fill: (p as any).color || '#10b981',
          layer: 'provincia'
        }
      })),
      transform: { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // CASO 4: Por defecto para cualquier otro caso
  return {
    id: `map-nuevo-${province ? province.id.toLowerCase() : 'argentina'}`,
    title: `Lienzo Vectorial - ${province ? province.name : 'Argentina (24 Provincias)'}`,
    level: province ? (province.id === 'WORLD_MAP' ? 'mundo' : 'pais') : 'pais',
    parentId: urlParentId || 'WORLD',
    ownerId: 'system',
    isApproved: true,
    paths: provincePaths.map(p => ({
      id: p.id,
      name: p.name,
      d: p.d,
      category: 'provincia',
      ownerId: 'system',
      visualStyles: {
        fillColor: (p as any).color || '#10b981',
        strokeColor: '#0f172a',
        strokeWidth: 1.5
      },
      customData: {
        valor: (p as any).value !== undefined ? (p as any).value : 40,
        porcentaje: (p as any).percentage !== undefined ? (p as any).percentage : 20,
        fill: (p as any).color || '#10b981',
        layer: 'provincia'
      }
    })),
    transform: { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
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
  navPath, // Historial de navegación dinámico universal
  onDirtyChange // Notifica el estado de cambios sin guardar
}: AdvancedCanvasEditorProps) {
  const [searchParams] = useSearchParams(); // Permite leer ?parentId=... de la URL
  const urlParentId = searchParams.get('parentId'); // Obtiene la referencia superior enviada en la URL

  // ESTADO DEL MAPA VECTORIAL EN EDICIÓN CON HERENCIA CONTEXTUAL
  const [mapEntity, setMapEntity] = useState<VectorMapEntity>(() => {
    // Clave objetivo específica (subdivisión seleccionada o provincia activa)
    const targetKey = selectedSubdivisionId || selectedProvince?.id || 'country';
    const saved = safeGetItem(`argentina_advanced_canvas_map_${targetKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.paths) && parsed.paths.length > 0) {
          if (urlParentId) {
            parsed.parentId = urlParentId; // Aplica la referencia de la URL si existe
          }
          parsed.transform = {
            scale: parsed.transform?.scale ?? 1,
            translateX: parsed.transform?.translateX ?? 0,
            translateY: parsed.transform?.translateY ?? 0,
            aspectRatioLocked: parsed.transform?.aspectRatioLocked ?? true
          };
          return parsed;
        }
      } catch (e) {
        console.error("Error al des-serializar mapa cargado:", e);
      }
    }

    // Retorna el mapa contextual correspondiente al elemento o subdivisión seleccionada en la ruta
    const initialMap = getInitialContextualMap(selectedProvince, urlParentId, selectedSubdivisionId, allProvinces);
    if (!initialMap.transform) {
      initialMap.transform = { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true };
    }
    return initialMap;
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

  // MODO EXCLUSIVO DE INTERACCIÓN EN EL LIENZO: 'select' (SELECCIÓN NORMAL), 'move' (MODO MOVER EXCLUSIVO), 'resize' (MODO REDIMENSIONAR EXCLUSIVO)
  // ESTE ESTADO BLOQUEA OTRAS OPCIONES PARA EVITAR CONFLICTOS Y FACILITAR EL ARRASTRE Y LA ESCALA TANTO AGRUPADO COMO DESAGRUPADO
  const [canvasMode, setCanvasMode] = useState<'select' | 'move' | 'resize'>('select'); // Modo activo de interacción en el lienzo

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

  // ESTADOS Y MANEJADOR PARA EL MODAL DE ASOCIAR MAPA COMPLETO O TRAZADOS A OTRA RUTA O PROVINCIA
  const [isAssociateModalOpen, setIsAssociateModalOpen] = useState<boolean>(false); // Control de apertura del modal
  const [targetAssociateRouteId, setTargetAssociateRouteId] = useState<string>(''); // ID de la ruta / provincia destino seleccionada
  const [associateSearchQuery, setAssociateSearchQuery] = useState<string>(''); // Filtro de búsqueda en la lista de rutas
  const [associateMode, setAssociateMode] = useState<'append' | 'replace' | 'merge_single'>('append'); // Modo: Anexar/Combinar, Reemplazar todo, o Fusionar en un solo trazado compuesto
  const [associateScope, setAssociateScope] = useState<'all' | 'selected'>('selected'); // Alcance: Todo el lienzo o solo los objetos seleccionados (ej: la isla/parte)

  // ESTADOS PARA EL MODAL DE COMBINAR / ASOCIAR UN OBJETO ESPECÍFICO CON OTRO DEL LIENZO
  const [isCombineObjectModalOpen, setIsCombineObjectModalOpen] = useState<boolean>(false); // Modal de combinación entre objetos
  const [combineSourcePathId, setCombineSourcePathId] = useState<string | null>(null); // Objeto de origen (ej: la isla o recorte)
  const [combineTargetPathId, setCombineTargetPathId] = useState<string>(''); // Objeto destino (ej: el país / continente)
  const [combineObjectMode, setCombineObjectMode] = useState<'merge_geometry' | 'group_hierarchy' | 'same_identity'>('merge_geometry'); // Modo de unión
  const [combineObjectSearch, setCombineObjectSearch] = useState<string>(''); // Buscador dentro de los objetos disponibles

  // ESTADO PARA EL MODAL DE CONFIRMACIÓN PREVIA Y SEGURIDAD CON IMÁGENES SVG (SAFETY MODAL)
  const [safetyModalConfig, setSafetyModalConfig] = useState<{
    isOpen: boolean; // Estado de visibilidad del modal de confirmación
    targetId: string; // Identificador del territorio o mapa destino
    targetName: string; // Nombre descriptivo del territorio o mapa
    targetCurrentD: string; // Trazado geométrico del estado anterior
    targetPaths?: VectorPathItem[]; // Colección completa de polígonos/rutas del estado anterior con colores reales
    proposedD: string; // Trazado geométrico resultante de la edición
    proposedName?: string; // Nombre del resultado propuesto
    proposedPaths?: VectorPathItem[]; // Colección completa de polígonos resultantes de la edición con colores reales
    operationType?: 'silhouette_mutation' | 'save_map' | 'associate_map'; // Tipo de operación realizada
    onConfirmReplace: () => void; // Callback al confirmar los cambios
    onConfirmAsIndependent?: () => void; // Callback para incorporar como elemento independiente (ej: Malvinas)
  }>({
    isOpen: false, // Inicialmente cerrado
    targetId: '', // ID vacío inicial
    targetName: '', // Nombre vacío inicial
    targetCurrentD: '', // Path SVG vacío inicial
    targetPaths: undefined, // Sin paths previos iniciales
    proposedD: '', // Path propuesto vacío
    proposedPaths: undefined, // Sin paths propuestos iniciales
    onConfirmReplace: () => {}, // Función vacía por defecto
    onConfirmAsIndependent: undefined // Sin callback independiente inicial
  });

  // Estado para desplegar el menú de recuperación de blindaje territorial
  const [isSafetyRecoveryMenuOpen, setIsSafetyRecoveryMenuOpen] = useState<boolean>(false);

  // FUNCIÓN MEJORADA PARA ASOCIAR Y GUARDAR/COMBINAR EN OTRA RUTA O PROVINCIA
  const handleAssociateMapToSelectedRoute = (targetRouteId: string) => { // Función principal de asociación a ruta
    if (!canEditMap || !targetRouteId) return; // Validación de permisos y ruta destino
    const targetProv = (allProvinces && allProvinces[targetRouteId]) || mockProvincesData[targetRouteId]; // Datos de la ruta destino
    const targetName = targetProv?.name || targetRouteId; // Nombre amigable de la ruta

    // Determina los trazados que se van a procesar según el alcance seleccionado
    const pathsToProcess = (associateScope === 'selected' && selectedPathIds.length > 0)
      ? mapEntity.paths.filter(p => selectedPathIds.includes(p.id))
      : mapEntity.paths;

    if (pathsToProcess.length === 0) {
      showNotify("[⚠️] No hay trazados seleccionados para asociar.");
      return;
    }

    // Carga los trazados/municipios existentes de la ruta destino si existían previamente
    let existingMunicipalities: any[] = [];
    const savedTargetCanvas = safeGetItem(`argentina_advanced_canvas_map_${targetRouteId}`);
    if (savedTargetCanvas) {
      try {
        const parsed = JSON.parse(savedTargetCanvas);
        if (parsed && Array.isArray(parsed.paths)) {
          existingMunicipalities = parsed.paths.map((p: any) => ({
            id: p.id,
            name: p.name,
            value: p.customData?.valor || p.customData?.value || 0,
            percentage: p.customData?.porcentaje || p.customData?.percentage || 0,
            d: p.d,
            color: p.customData?.fill || p.visualStyles?.fillColor || p.fill,
            layer: p.category || p.customData?.layer || targetName,
            visualStyles: p.visualStyles || {},
            customData: p.customData || {}
          }));
        }
      } catch (err) {
        // Fallback a los datos base
      }
    }

    if (existingMunicipalities.length === 0 && targetProv?.municipalities && Array.isArray(targetProv.municipalities)) {
      existingMunicipalities = [...targetProv.municipalities];
    }

    let finalMunicipalities: any[] = [];
    let finalCanvasPaths: VectorPathItem[] = [];

    // CASO 1: MODO ANEXAR / COMBINAR CON LA RUTA (Añade las islas o trazados sin borrar el continente o mapa existente)
    if (associateMode === 'append') {
      const newItemsConverted = pathsToProcess.map(p => ({
        id: p.id,
        name: p.name || `${targetName} - Parte`,
        value: p.customData?.valor || p.customData?.value || 0,
        percentage: p.customData?.porcentaje || p.customData?.percentage || 0,
        d: p.d,
        color: p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#10b981',
        layer: p.category || p.customData?.layer || targetName,
        visualStyles: {
          fillColor: p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#10b981',
          strokeColor: p.customData?.stroke || p.visualStyles?.strokeColor || p.stroke || '#0f172a',
          strokeWidth: p.customData?.strokeWidth || p.visualStyles?.strokeWidth || p.strokeWidth || 1.5
        },
        customData: {
          ...(p.customData || {}),
          associatedToRoute: targetRouteId,
          associatedAt: new Date().toISOString()
        }
      }));

      // Combina los existentes con los nuevos evitando duplicados exactos de ID
      const existingFiltered = existingMunicipalities.filter(em => !newItemsConverted.some(ni => ni.id === em.id));
      finalMunicipalities = [...existingFiltered, ...newItemsConverted];

      // Mapea a paths para el canvas guardado de la ruta destino
      finalCanvasPaths = finalMunicipalities.map(m => ({
        id: m.id,
        name: m.name,
        d: m.d,
        category: m.layer || targetName,
        ownerId: currentUser.id,
        visualStyles: m.visualStyles,
        customData: m.customData
      }));
    } 
    // CASO 2: MODO FUSIONAR EN UN SOLO POLÍGONO COMPUESTO (MULTI-PATH SVG)
    else if (associateMode === 'merge_single') {
      // Busca la geometría base de la ruta o toma el primer municipio existente o molde
      const baseD = existingMunicipalities[0]?.d || provincePaths[targetRouteId] || '';
      const annexedD = pathsToProcess.map(p => p.d.trim()).join(' ');
      const unifiedD = baseD ? `${baseD} ${annexedD}` : annexedD;

      const unifiedItem = {
        id: `TERR_${targetRouteId}_UNIFIED`,
        name: targetName,
        value: pathsToProcess[0]?.customData?.valor || 0,
        percentage: pathsToProcess[0]?.customData?.porcentaje || 0,
        d: unifiedD,
        color: pathsToProcess[0]?.customData?.fill || '#10b981',
        layer: targetName,
        visualStyles: {
          fillColor: pathsToProcess[0]?.customData?.fill || '#10b981',
          strokeColor: '#0f172a',
          strokeWidth: 1.5
        },
        customData: {
          isMergedMultiPath: true,
          mergedPartsCount: pathsToProcess.length + (baseD ? 1 : 0),
          associatedToRoute: targetRouteId
        }
      };

      finalMunicipalities = [unifiedItem];
      finalCanvasPaths = [{
        id: unifiedItem.id,
        name: unifiedItem.name,
        d: unifiedItem.d,
        category: targetName,
        ownerId: currentUser.id,
        visualStyles: unifiedItem.visualStyles,
        customData: unifiedItem.customData
      }];
    } 
    // CASO 3: MODO REEMPLAZAR MAPA COMPLETO (Sobrescribe todo el mapa de la ruta destino)
    else {
      finalMunicipalities = pathsToProcess.map(p => ({
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

      finalCanvasPaths = pathsToProcess.map(p => ({
        ...p,
        category: p.category || targetName
      }));
    }

    const fallbackProv = mockProvincesData['AR-B'];
    const targetProvinceData: ProvinceData = {
      ...(targetProv || fallbackProv),
      id: targetRouteId,
      name: targetName,
      abbreviation: targetProv?.abbreviation || targetRouteId,
      municipalities: finalMunicipalities,
      mapTransform: {
        scale: mapEntity.transform.scale,
        panX: mapEntity.transform.translateX,
        panY: mapEntity.transform.translateY
      }
    };

    // Actualiza el estado global de provincias si se provee el callback
    if (onUpdateProvince) {
      onUpdateProvince(targetProvinceData);
    }

    // Guarda en almacenamiento persistente seguro el mapa vectorizado asociado
    const serializedTarget = JSON.stringify({
      ...mapEntity,
      id: targetRouteId,
      name: targetName,
      paths: finalCanvasPaths,
      updatedAt: new Date().toISOString()
    });

    safeSetItem(`argentina_advanced_canvas_map_${targetRouteId}`, serializedTarget);

    // Sincroniza con las siluetas calibradas a nivel nacional
    try {
      const rawCal = safeGetItem('argentina_calibrated_map_paths');
      let currentCal: Array<{ id: string; name?: string; d: string }> = [];
      if (rawCal) {
        const parsed = JSON.parse(rawCal);
        if (Array.isArray(parsed)) currentCal = parsed;
      }
      if (currentCal.length === 0) {
        currentCal = provincePaths.map(p => ({ id: p.id, name: p.name, d: p.d }));
      }

      const combinedDForNational = finalCanvasPaths.map(p => p.d.trim()).join(' ');
      const existingNationalIdx = currentCal.findIndex(p => p.id === targetRouteId);
      if (existingNationalIdx !== -1) {
        currentCal[existingNationalIdx].d = combinedDForNational;
        currentCal[existingNationalIdx].name = targetName;
      } else {
        currentCal.push({
          id: targetRouteId,
          name: targetName,
          d: combinedDForNational
        });
      }

      safeSetItem('argentina_calibrated_map_paths', JSON.stringify(currentCal));
      safeSetItem('argentina_paths_last_updated', Date.now().toString());
      window.dispatchEvent(new CustomEvent('argentina_paths_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error("Error al sincronizar siluetas nacionales:", e);
    }

    setIsAssociateModalOpen(false); // Cierra el modal de asociación
    const modeLabel = associateMode === 'append' ? 'combinado y anexado' : associateMode === 'merge_single' ? 'fusionado en un solo polígono' : 'asociado y reemplazado';
    showNotify(`[🔗] Trazado(s) ${modeLabel} con éxito en la ruta "${targetName}" (${targetRouteId}).`);
    alert(`¡Asociación Exitosa!\n\nSe han ${modeLabel} ${pathsToProcess.length} trazado(s) en la ruta "${targetName}" (${targetRouteId}).\nAl navegar a esa ruta, se mostrará completo con todas sus partes integradas.`);
  };

  // FUNCIÓN PARA COMBINAR UN OBJETO ESPECÍFICO (EJ: TRAZADO PDF DE ISLA) CON OTRO OBJETO DEL LIENZO
  const handleCombineSpecificObjects = (sourceId: string, targetId: string, mode: 'merge_geometry' | 'group_hierarchy' | 'same_identity') => {
    if (!canEditMap || !sourceId || !targetId || sourceId === targetId) {
      showNotify("[⚠️] Por favor selecciona dos objetos distintos para combinar.");
      return;
    }

    const sourceObj = mapEntity.paths.find(p => p.id === sourceId); // Objeto origen (ej: la isla o recorte)
    const targetObj = mapEntity.paths.find(p => p.id === targetId); // Objeto destino (ej: el país / continente)

    if (!sourceObj || !targetObj) {
      showNotify("[⚠️] No se encontraron los objetos seleccionados.");
      return;
    }

    // 1. MODO FUSIÓN GEOMÉTRICA (Multi-path SVG: Une coordenadas d en una sola figura compuesta)
    if (mode === 'merge_geometry') {
      const combinedD = `${targetObj.d.trim()} ${sourceObj.d.trim()}`; // Geometría multi-polígono
      const combinedName = targetObj.name || targetObj.id; // Mantiene el nombre del territorio principal
      const newCombinedId = `COMBINED_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // Guarda las piezas vivas para poder descombinar cuando se desee
      const subItems = [
        ...(targetObj.customData?.subItems || [targetObj]),
        ...(sourceObj.customData?.subItems || [sourceObj])
      ];

      const mergedItem: VectorPathItem = {
        ...targetObj,
        id: newCombinedId,
        name: combinedName,
        d: combinedD,
        isCombined: true,
        customData: {
          ...(targetObj.customData || {}),
          subItems: JSON.parse(JSON.stringify(subItems)),
          mergedAt: new Date().toISOString()
        }
      };

      setMapEntity(prev => ({
        ...prev,
        paths: prev.paths.filter(p => p.id !== sourceId && p.id !== targetId).concat(mergedItem),
        updatedAt: new Date().toISOString()
      }));

      setSelectedPathIds([newCombinedId]);
      showNotify(`[🧩] Se fusionó "${sourceObj.name}" dentro de "${targetObj.name}" formando un territorio completo.`);
    }
    // 2. MODO AGRUPACIÓN JERÁRQUICA (Establece un Padre común tipo CorelDRAW)
    else if (mode === 'group_hierarchy') {
      const groupName = targetObj.name || 'Territorio Unificado';
      const newGroupId = `GRP_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      setMapEntity(prev => ({
        ...prev,
        paths: prev.paths.map(p => {
          if (p.id === sourceId || p.id === targetId) {
            return {
              ...p,
              groupId: newGroupId,
              groupName: groupName
            };
          }
          return p;
        }),
        updatedAt: new Date().toISOString()
      }));

      setSelectedPathIds([sourceId, targetId]);
      showNotify(`[📁] Objetos agrupados bajo el contenedor padre "${groupName}".`);
    }
    // 3. MODO MISMA IDENTIDAD (Sincroniza nombre, categoría y métricas)
    else {
      setMapEntity(prev => ({
        ...prev,
        paths: prev.paths.map(p => {
          if (p.id === sourceId) {
            return {
              ...p,
              name: targetObj.name,
              category: targetObj.category,
              customData: {
                ...(p.customData || {}),
                layer: targetObj.category,
                valor: targetObj.customData?.valor,
                porcentaje: targetObj.customData?.porcentaje,
                linkedToParentId: targetObj.id
              }
            };
          }
          return p;
        }),
        updatedAt: new Date().toISOString()
      }));

      setSelectedPathIds([sourceId, targetId]);
      showNotify(`[🔗] "${sourceObj.name}" ahora comparte la misma identidad que "${targetObj.name}".`);
    }

    setIsCombineObjectModalOpen(false); // Cierra el modal de combinación de objetos
  };

  // Alterna el estado colapsable de las sub-listas del Inspector
  const toggleInspectorPickerSection = (key: string) => { // Función conmutadora
    setInspectorPickerSections(prev => ({ ...prev, [key]: !prev[key] })); // Invierte el estado
  }; // Fin de toggleInspectorPickerSection

  // SINCRONIZAR EL MAPA EN EDICIÓN Y SELECCIÓN DE SUBDIVISIÓN EN MONTAJE O CAMBIO DE REGIÓN
  useEffect(() => {
    // Si ya tenemos el mapa cargado con múltiples polígonos y solo cambió selectedSubdivisionId para seleccionar un elemento en el lienzo
    if (selectedSubdivisionId && mapEntity && Array.isArray(mapEntity.paths) && mapEntity.paths.length > 0) {
      const matchPath = mapEntity.paths.find(p => 
        p.id === selectedSubdivisionId || 
        p.id.toLowerCase() === selectedSubdivisionId.toLowerCase() || 
        p.id.toLowerCase().replace(/^ar-/, '') === selectedSubdivisionId.toLowerCase().replace(/^ar-/, '') ||
        (p.name && p.name.toLowerCase() === selectedSubdivisionId.toLowerCase())
      );
      if (matchPath) {
        // Solo actualiza la selección sin recargar ni destruir el lienzo completo de polígonos
        setSelectedPathIds([matchPath.id]);
        setEditingPathData({
          id: matchPath.id,
          name: matchPath.name,
          d: matchPath.d,
          category: matchPath.category || 'subdivision',
          color: matchPath.customData?.fill || matchPath.visualStyles?.fillColor || '#10b981',
          value: Number(matchPath.customData?.valor || 35),
          percentage: Number(matchPath.customData?.porcentaje || 18)
        });
        return;
      }
    }

    // Clave objetivo precisa (provincia o nivel de mapa contenedor)
    const targetKey = selectedProvince?.id || 'country';
    let entityToSet: VectorMapEntity; // Variable para almacenar la entidad resultante

    const saved = safeGetItem(`argentina_advanced_canvas_map_${targetKey}`); // Carga mapa persistido específico
    if (saved) { // Si existe en localStorage
      try { // Intenta decodificar
        const parsed = JSON.parse(saved); // Parsea JSON
        if (parsed && Array.isArray(parsed.paths) && parsed.paths.length > 0) { // Si es válido y no está vacío
          entityToSet = parsed; // Usa el mapa guardado
        } else { // Si está vacío
          entityToSet = getInitialContextualMap(selectedProvince, urlParentId, selectedSubdivisionId, allProvinces); // Genera mapa contextual
        }
      } catch (e) { // En caso de fallo
        console.error("Error al sincronizar mapa guardado:", e); // Registra el error
        entityToSet = getInitialContextualMap(selectedProvince, urlParentId, selectedSubdivisionId, allProvinces); // Fallback contextual
      }
    } else { // Si no hay entrada guardada
      entityToSet = getInitialContextualMap(selectedProvince, urlParentId, selectedSubdivisionId, allProvinces); // Carga el mapa activo de la región o subdivisión
    }

    // Herencia Automática: Si la entidad no posee polígonos y estamos a nivel país global, inyecta las provincias nativas
    if ((!entityToSet.paths || entityToSet.paths.length === 0) && (!selectedProvince || selectedProvince.id === 'COUNTRY_MAP' || selectedProvince.id === 'country' || selectedProvince.id === 'AR')) {
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

    // Garantiza que la entidad posea la estructura de transformación matemática
    entityToSet.transform = {
      scale: entityToSet.transform?.scale ?? 1,
      translateX: entityToSet.transform?.translateX ?? 0,
      translateY: entityToSet.transform?.translateY ?? 0,
      aspectRatioLocked: entityToSet.transform?.aspectRatioLocked ?? true
    };

    setMapEntity(entityToSet); // Actualiza el estado del mapa en el Súper Editor

    // Sincronización Inteligente de la Selección para Subdivisiones, Argentina y Provincias
    if (selectedSubdivisionId) {
      const matchPath = entityToSet.paths.find(p => p.id === selectedSubdivisionId || p.id.toLowerCase() === selectedSubdivisionId.toLowerCase() || p.id.toLowerCase().replace(/^ar-/, '') === selectedSubdivisionId.toLowerCase().replace(/^ar-/, ''));
      if (matchPath) {
        setSelectedPathIds([matchPath.id]);
        setEditingPathData({
          id: matchPath.id,
          name: matchPath.name,
          d: matchPath.d,
          category: matchPath.category || 'subdivision',
          color: matchPath.customData?.fill || matchPath.visualStyles?.fillColor || '#10b981',
          value: Number(matchPath.customData?.valor || 35),
          percentage: Number(matchPath.customData?.porcentaje || 18)
        });
      } else if (entityToSet.paths.length > 0) {
        setSelectedPathIds(entityToSet.paths.map(p => p.id));
        const first = entityToSet.paths[0];
        setEditingPathData({
          id: first.id,
          name: first.name,
          d: first.d,
          category: first.category || 'subdivision',
          color: first.customData?.fill || first.visualStyles?.fillColor || '#10b981',
          value: Number(first.customData?.valor || 35),
          percentage: Number(first.customData?.porcentaje || 18)
        });
      }
    } else if (selectedProvince && (selectedProvince.id === 'COUNTRY_MAP' || selectedProvince.id === 'country' || selectedProvince.id === 'AR')) {
      // Si la región es Argentina sin subdivisión, no fuerza selección para ver todas las provincias
      setSelectedPathIds([]);
    } else if (selectedProvince && (selectedProvince.id === 'WORLD' || selectedProvince.id === 'world' || selectedProvince.id === 'WORLD_MAP' || selectedProvince.id === 'MUNDO' || selectedProvince.id === 'mundo' || (selectedProvince as any).category === 'world' || entityToSet.level === 'mundo')) {
      // Si la región activa es MUNDO / Mapa Mundial, remueve cualquier preselección automática de país
      setSelectedPathIds([]); // Sin selección inicial en el mapa mundial
    } else if (selectedProvince && entityToSet.paths.some(p => p.id === selectedProvince.id)) { // Si el ID de la provincia coincide con un vector activo
      setSelectedPathIds([selectedProvince.id]); // Selecciona el vector de la provincia activa (ej: AR-B)
    } else if (entityToSet.paths.length === 1) { // Si hay un único polígono cargado
      setSelectedPathIds([entityToSet.paths[0].id]); // Lo selecciona automáticamente
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
      if (onDirtyChange) onDirtyChange(true); // Sincroniza estado con el botón de Guardar
      window.dispatchEvent(new CustomEvent('projectDataModified')); // Notifica modificación global
    }
  }, [mapEntity]); // Se ejecuta cada vez que el mapa vectorial sufre alguna modificación

  // FUNCIÓN PARA DESHACER LA ÚLTIMA ACCIÓN (UNDO / DESHACER)
  const handleUndo = () => {
    if (historyIndex > 0) { // Si existen estados previos en la pila
      const prevIndex = historyIndex - 1; // Calcula el índice anterior
      const targetState = JSON.parse(JSON.stringify(historyStack[prevIndex])); // Clona el estado previo
      setHistoryIndex(prevIndex); // Retrocede el puntero del historial
      setMapEntity(targetState); // Restaura el estado del mapa en React
      if (initialMapSnapshotRef.current && JSON.stringify(initialMapSnapshotRef.current) === JSON.stringify(targetState)) {
        if (onDirtyChange) onDirtyChange(false);
        window.dispatchEvent(new CustomEvent('projectDataSaved'));
      } else {
        if (onDirtyChange) onDirtyChange(true);
        window.dispatchEvent(new CustomEvent('projectDataModified'));
      }
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
      if (onDirtyChange) onDirtyChange(true);
      window.dispatchEvent(new CustomEvent('projectDataModified'));
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
    if (onDirtyChange) onDirtyChange(false); // Restablece indicador sin cambios
    window.dispatchEvent(new CustomEvent('projectDataSaved')); // Notifica guardado
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
  
  // MODO AISLAR SELECCIÓN (OPCIONAL Y REVERSIBLE - POR DEFECTO FALSE PARA VER TODO EL MAPA)
  const [isFocusIsolated, setIsFocusIsolated] = useState<boolean>(false); // Alterna entre ver solo selección o todo el mapa

  // ESTADOS DEL HISTORIAL VISUAL ANTIGRAVITY TIMELINE
  const [isVisualHistoryModalOpen, setIsVisualHistoryModalOpen] = useState<boolean>(false); // Modal de historial visual
  const [previewHistoryIndex, setPreviewHistoryIndex] = useState<number | null>(null); // Índice del estado en preview temporal

  // ESTADOS DE TRANSFORMACIÓN E INTERACCIÓN
  const [aspectRatioLocked, setAspectRatioLocked] = useState<boolean>(mapEntity?.transform?.aspectRatioLocked ?? true); // Candado 🔒
  const [notification, setNotification] = useState<string | null>(null); // Mensajes emergentes de confirmación
  const [zoomLevel, setZoomLevel] = useState<number>(1); // Nivel de zoom de la vista de trabajo
  
  // DETECCIÓN DE CAMBIOS PENDIENTES DE APLICAR (DRAFT VS LIVE)
  const hasPendingChanges = useMemo(() => {
    if (!initialMapSnapshotRef.current || !mapEntity) return false;
    return JSON.stringify(initialMapSnapshotRef.current) !== JSON.stringify(mapEntity);
  }, [mapEntity]);

  // DUPLICAR TRAZADOS SELECCIONADOS (COPIA RÁPIDA CON OFFSET INSTANTÁNEA)
  const handleDuplicateSelectedPaths = () => {
    if (!canEditMap || selectedPathIds.length === 0) return;
    const offset = 18; // Desplazamiento sutil
    const duplicatedPaths: VectorPathItem[] = [];
    const newSelectedIds: string[] = [];

    mapEntity.paths.forEach(p => {
      if (selectedPathIds.includes(p.id)) {
        const newId = `${p.id}_copy_${Date.now().toString().slice(-4)}`;
        const newName = `${p.name} (Copia)`;
        const newD = translatePathD(p.d, offset, offset);
        const newPath: VectorPathItem = {
          ...p,
          id: newId,
          name: newName,
          d: newD,
          customData: { ...(p.customData || {}), fill: p.customData?.fill || '#38bdf8' },
          visualStyles: { ...(p.visualStyles || {}), fillColor: p.visualStyles?.fillColor || '#38bdf8' }
        };
        duplicatedPaths.push(newPath);
        newSelectedIds.push(newId);
      }
    });

    if (duplicatedPaths.length > 0) {
      setMapEntity(prev => ({
        ...prev,
        paths: [...prev.paths, ...duplicatedPaths],
        updatedAt: new Date().toISOString()
      }));
      setSelectedPathIds(newSelectedIds);
      showNotify(`[📋] Se duplicaron ${duplicatedPaths.length} trazado(s). Ahora puedes moverlos y editarlos.`);
    }
  };

  // FUNCIÓN AUXILIAR PARA DESCARGAR UN ARCHIVO JSON DIRECTAMENTE
  const downloadJsonBlob = (content: string, filename: string) => {
    try {
      const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error al descargar JSON:", e);
    }
  };

  // GUARDAR / EXPORTAR SELECCIÓN APARTE (COMO NUEVO ARCHIVO JSON/SVG INDEPENDIENTE)
  const handleSaveSelectionSeparately = () => {
    if (selectedPaths.length === 0) {
      showNotify("[⚠️] Selecciona al menos un elemento para guardar aparte.");
      return;
    }
    const defaultName = selectedPaths.length === 1 ? selectedPaths[0].name : `${mapEntity.title || 'Mapa'} - Selección`;
    let exportName: string | null = null;
    try {
      exportName = prompt("Ingresa el nombre para exportar la selección de forma independiente:", defaultName);
    } catch {
      exportName = defaultName;
    }
    if (!exportName || !exportName.trim()) return;

    const cleanName = exportName.trim();
    const separateEntity: VectorMapEntity = {
      id: `map_sel_${Date.now()}`,
      title: cleanName,
      level: 'subdivision',
      parentId: mapEntity.id,
      ownerId: currentUser.id,
      isApproved: true,
      paths: JSON.parse(JSON.stringify(selectedPaths)),
      transform: { scale: 1, translateX: 0, translateY: 0, aspectRatioLocked: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    downloadJsonBlob(JSON.stringify(separateEntity, null, 2), `${cleanName.replace(/[\\/:*?"<>|]/g, '_')}.json`);
    showNotify(`[💾] Selección exportada aparte como "${cleanName}.json".`);
  };

  // ALTERNAR MODO AISLAMIENTO (FOCUS MODE VOLUNTARIO)
  const toggleFocusIsolation = () => {
    setIsFocusIsolated(prev => {
      const next = !prev;
      showNotify(next ? "[🔍] Modo Aislamiento activado: solo se visualizan los elementos seleccionados." : "[🗺️] Modo Mapa Completo: todos los trazados visibles.");
      return next;
    });
  };
  
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
          const saveKey = selectedSubdivisionId || selectedProvince?.id || 'country'; // Clave contextual del territorio
          safeSetItem(`argentina_advanced_canvas_map_${saveKey}`, JSON.stringify(latest)); // Persiste en clave de territorio
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
  }, [isDraggingCanvas, isDraggingElement, isResizingElement, dragStartPos, initialTransformPos, zoomLevel, elementDragStartPos, initialPathsD, initialSelectionBBox, selectedPathIds, aspectRatioLocked, mapEntity?.transform, selectedSubdivisionId, selectedProvince?.id]);

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


  // Handler para iniciar el arrastre en el Canva SVG (Manito o Modo Mover Elementos)
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // 1. Si está activa la herramienta Manito para mover el mapa libremente
    if (isPanToolActive || e.button === 1 || e.button === 2) {
      setIsDraggingCanvas(true); // Activa el arrastre de lienzo
      setDragStartPos({ x: e.clientX, y: e.clientY }); // Guarda posición inicial del cursor
      setInitialTransformPos({ // Guarda coordenadas espaciales previas
        x: mapEntity?.transform?.translateX ?? 0,
        y: mapEntity?.transform?.translateY ?? 0
      });
      e.preventDefault(); // Previene arrastre por defecto
      return;
    }

    // 2. Si está activo el MODO MOVER (botón MOVER) y hay elementos seleccionados
    if (canvasMode === 'move' && canEditMap && selectedPathIds.length > 0) {
      e.stopPropagation(); // Detiene propagación de eventos
      const svgPos = getSvgCoordinates(e); // Mapea cursor al espacio SVG
      setIsDraggingElement(true); // Activa el arrastre de elementos
      setElementDragStartPos(svgPos); // Guarda punto de partida
      const initialMap: Record<string, string> = {}; // Diccionario con los 'd' iniciales
      mapEntity.paths.forEach(item => {
        if (selectedPathIds.includes(item.id)) {
          initialMap[item.id] = item.d; // Preserva el trazado original de cada elemento seleccionado
        }
      });
      setInitialPathsD(initialMap); // Guarda en estado para traslación precisa
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

  // FUNCIÓN PARA REUBICAR Y ALINEAR AUTOMÁTICAMENTE EL OBJETO SELECCIONADO EN EL INDICADOR Y ANIMACIÓN DE UBICACIÓN GEOGRÁFICA
  // RESUELVE LA POSICIÓN CANÓNICA DE ISLAS MALVINAS Y DE CUALQUIER PROVINCIA/TERRITORIO PARA QUE NO PISE OTRO OBJETO
  const handleAlignWithGeographicRouteMarker = () => {
    if (!canEditMap || selectedPathIds.length === 0 || !selectionBBox) {
      showNotify("[⚠️] Selecciona primero el objeto o territorio que deseas ubicar.");
      return;
    }

    // Detecta si es Malvinas o si la provincia activa es Malvinas
    const targetKey = (selectedSubdivisionId || selectedProvince?.id || '').toLowerCase();
    const isMalvinas = targetKey.includes('malvin') || targetKey.includes('mlv') || 
                       selectedPaths.some(p => p.id.toLowerCase().includes('malvin') || p.id.toLowerCase().includes('mlv') || (p.name || '').toLowerCase().includes('malvin'));

    let targetBBox: { x: number; y: number; width: number; height: number };

    if (isMalvinas) {
      // Coordenadas canónicas exactas de la ubicación de Islas Malvinas y su indicador/animación en el mapa de Argentina
      targetBBox = { x: 440, y: 710, width: 85, height: 60 };
    } else {
      // Busca en la base de trazados de referencia provinciales de Argentina
      const provMatch = provincePaths.find(p => p.id === (selectedSubdivisionId || selectedProvince?.id) || p.id.toLowerCase() === targetKey.replace(/^ar-/, ''));
      if (provMatch && provMatch.d) {
        targetBBox = getPathBBox(provMatch.d);
      } else {
        // Fallback: Centroide del mapa general
        const mapBBox = mapEntity.paths.length > 0
          ? getMultiplePathsBBox(mapEntity.paths.map(p => ({ d: p.d })))
          : { x: 0, y: 0, width: 800, height: 600 };
        targetBBox = mapBBox;
      }
    }

    if (!targetBBox) return;

    const targetCenterX = targetBBox.x + targetBBox.width / 2;
    const targetCenterY = targetBBox.y + targetBBox.height / 2;

    const currentCenterX = selectionBBox.x + selectionBBox.width / 2;
    const currentCenterY = selectionBBox.y + selectionBBox.height / 2;

    const deltaX = targetCenterX - currentCenterX;
    const deltaY = targetCenterY - currentCenterY;

    // Traslada todos los trazados seleccionados exactamente hacia el indicador geográfico
    setMapEntity(prev => {
      const updatedEntity = {
        ...prev,
        paths: prev.paths.map(p => {
          if (selectedPathIds.includes(p.id)) {
            return {
              ...p,
              d: translatePathD(p.d, deltaX, deltaY)
            };
          }
          return p;
        }),
        updatedAt: new Date().toISOString()
      };
      const saveKey = selectedSubdivisionId || selectedProvince?.id || 'country';
      safeSetItem(`argentina_advanced_canvas_map_${saveKey}`, JSON.stringify(updatedEntity));
      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));
      return updatedEntity;
    });

    showNotify(`[📍] Objeto ubicado exactamente en la posición del indicador de ruta y animación de ubicación geográfica.`);
  };

  // FUNCIÓN PARA ALTERNAR EL MODO EXCLUSIVO DE MOVER
  const toggleMoveMode = () => {
    if (canvasMode === 'move') {
      setCanvasMode('select');
      showNotify("[ℹ️] Modo de Selección Normal activado.");
    } else {
      setCanvasMode('move');
      setIsPanToolActive(false); // Desactiva manito para evitar conflictos
      if (selectedPathIds.length === 0 && mapEntity.paths.length > 0) {
        // Si no había selección, selecciona todos los elementos para mover en bloque
        setSelectedPathIds(mapEntity.paths.map(p => p.id));
      }
      showNotify("[✥] MODO MOVER ACTIVADO: Haz clic y arrastra directamente en el lienzo para mover y reubicar sin conflictos.");
    }
  };

  // FUNCIÓN PARA ALTERNAR EL MODO EXCLUSIVO DE REDIMENSIONAR
  const toggleResizeMode = () => {
    if (canvasMode === 'resize') {
      setCanvasMode('select');
      showNotify("[ℹ️] Modo de Selección Normal activado.");
    } else {
      setCanvasMode('resize');
      setIsPanToolActive(false); // Desactiva manito para evitar conflictos
      if (selectedPathIds.length === 0 && mapEntity.paths.length > 0) {
        // Si no había selección, selecciona todos los elementos
        setSelectedPathIds(mapEntity.paths.map(p => p.id));
      }
      showNotify("[⤢] MODO REDIMENSIONAR ACTIVADO: Usa los tiradores ampliados o los botones rápidos de escala para ajustar el tamaño.");
    }
  };

  // FUNCIÓN PARA ESCALAR RÁPIDAMENTE LA SELECCIÓN EN UN PORCENTAJE DADO (+10%, -10%, etc.)
  const handleQuickScaleSelection = (factor: number) => {
    if (!canEditMap || selectedPathIds.length === 0 || !selectionBBox) return;
    const anchorX = selectionBBox.x + selectionBBox.width / 2; // Anclaje en el centro X
    const anchorY = selectionBBox.y + selectionBBox.height / 2; // Anclaje en el centro Y

    setMapEntity(prev => {
      const updatedEntity = {
        ...prev,
        paths: prev.paths.map(p => {
          if (selectedPathIds.includes(p.id)) {
            return {
              ...p,
              d: scalePathD(p.d, factor, factor, anchorX, anchorY)
            };
          }
          return p;
        }),
        updatedAt: new Date().toISOString()
      };
      const saveKey = selectedSubdivisionId || selectedProvince?.id || 'country';
      safeSetItem(`argentina_advanced_canvas_map_${saveKey}`, JSON.stringify(updatedEntity));
      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));
      return updatedEntity;
    });

    const percentText = factor > 1 ? `+${Math.round((factor - 1) * 100)}%` : `-${Math.round((1 - factor) * 100)}%`;
    showNotify(`[⤢] Tamaño ajustado: ${percentText}`);
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
  // ESTADO Y LÓGICA PARA AGREGAR NUEVOS ELEMENTOS / TERRITORIOS / MIEMBROS
  // (INTEGRACIÓN ADITIVA PURA: NO REEMPLAZA NI BORRA NADA DE LO EXISTENTE)
  // =========================================================================
  const [isAddElementModalOpen, setIsAddElementModalOpen] = useState<boolean>(false); // Modal para agregar nuevo elemento

  // FUNCIÓN PARA AGREGAR UN NUEVO ELEMENTO VECTORIAL AL MAPA ACTUAL SIN REEMPLAZAR NADA
  const handleAddNewVectorPath = (
    newPath: VectorPathItem,
    options?: { autoSelect?: boolean; focus?: boolean }
  ) => {
    if (!canEditMap || !newPath) return; // Validación de permisos y elemento

    // 1. Genera un ID único asegurando que no colisione con los elementos existentes
    let finalId = newPath.id ? newPath.id.trim() : `ITEM_${Date.now()}`;
    const idAlreadyExists = mapEntity.paths.some(p => p.id === finalId);
    if (idAlreadyExists) {
      finalId = `${finalId}_${Date.now().toString().slice(-4)}`;
    }

    // 2. Prepara el objeto VectorPathItem completo con estilos y metadatos limpios
    const finalItem: VectorPathItem = {
      ...newPath,
      id: finalId,
      name: newPath.name || 'Nuevo Elemento',
      d: newPath.d,
      category: newPath.category || selectedProvince?.name || 'provincia',
      ownerId: currentUser.id,
      fill: newPath.fill || '#10b981',
      stroke: newPath.stroke || '#0f172a',
      strokeWidth: newPath.strokeWidth ?? 1.0,
      visualStyles: {
        fillColor: newPath.visualStyles?.fillColor || newPath.fill || '#10b981',
        strokeColor: newPath.visualStyles?.strokeColor || newPath.stroke || '#0f172a',
        strokeWidth: newPath.visualStyles?.strokeWidth ?? newPath.strokeWidth ?? 1.0
      },
      customData: {
        ...(newPath.customData || {}),
        fill: newPath.visualStyles?.fillColor || newPath.fill || '#10b981',
        stroke: newPath.visualStyles?.strokeColor || newPath.stroke || '#0f172a',
        strokeWidth: newPath.visualStyles?.strokeWidth ?? newPath.strokeWidth ?? 1.0,
        agregadoEn: new Date().toISOString()
      }
    };

    // 3. Agrega el nuevo elemento al final de paths sin alterar ninguno de los elementos existentes
    setMapEntity(prev => {
      const updatedPaths = [...prev.paths, finalItem];
      const updatedEntity: VectorMapEntity = {
        ...prev,
        paths: updatedPaths,
        updatedAt: new Date().toISOString()
      };

      // Guarda en el almacenamiento local seguro
      const targetKey = selectedSubdivisionId || selectedProvince?.id || 'country';
      safeSetItem(`argentina_advanced_canvas_map_${targetKey}`, JSON.stringify(updatedEntity));
      safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));

      return updatedEntity;
    });

    // 4. Si autoSelect es true, selecciona inmediatamente el nuevo elemento y activa el modo mover/inspector
    if (options?.autoSelect !== false) {
      setSelectedPathIds([finalItem.id]);
      setCanvasMode('move'); // Facilita el arrastre para ubicarlo donde corresponde
      setShowRightSidebar(true); // Abre el inspector para permitir redimensionar y posicionar
    }

    // 5. Cierra el modal de agregar y notifica al usuario con feedback claro
    setIsAddElementModalOpen(false);
    showNotify(`[➕] ¡Elemento "${finalItem.name}" agregado con éxito! Puedes moverlo, redimensionarlo y ubicarlo en el mapa.`);
  };

  // RESTAURACIÓN INSTANTÁNEA EN 1 CLIC PARA ISLAS MALVINAS CON COORDENADAS OFICIALES
  const handleQuickRestoreMalvinas = () => {
    if (!canEditMap) return;
    const malvinasPreset = provincePaths.find(p => p.id === 'AR-MLV');
    if (!malvinasPreset) {
      showNotify("[⚠️] No se encontraron las coordenadas oficiales de Islas Malvinas.");
      return;
    }

    // 1. Restaura en el almacenamiento global y calibrado de Argentina
    restoreMalvinasToOriginal();

    // 2. Inserta la pieza en el canvas actual
    const malvinasItem: VectorPathItem = {
      id: 'AR-MLV',
      name: 'Islas Malvinas',
      d: malvinasPreset.d,
      category: 'provincia',
      fill: '#10b981',
      stroke: '#0f172a',
      strokeWidth: 1.0,
      visualStyles: {
        fillColor: '#10b981',
        strokeColor: '#0f172a',
        strokeWidth: 1.0
      },
      customData: {
        fill: '#10b981',
        stroke: '#0f172a',
        strokeWidth: 1.0,
        valor: 100,
        porcentaje: 100,
        territorioOficial: true
      }
    };

    handleAddNewVectorPath(malvinasItem, { autoSelect: true, focus: true });
    showNotify("🛡️ Islas Malvinas restauradas en su ubicación y trazado original independiente.");
  };

  // Detecta si las Islas Malvinas están ausentes en el mapa actual
  const isMalvinasMissing = useMemo(() => {
    if (!mapEntity || !Array.isArray(mapEntity.paths)) return false;
    return !mapEntity.paths.some(p => 
      p.id === 'AR-MLV' || 
      p.id.toLowerCase().includes('malvina') || 
      p.name.toLowerCase().includes('malvina')
    );
  }, [mapEntity.paths]);

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
      const parentName = selectedProvince?.name || mapEntity.title || mapEntity.name || 'GRUPO VECTORIAL'; // Nombre de la división o porción principal
      groupName = parentName; // Asigna el elemento padre por defecto sin bloquear el iframe
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

  // INICIAR MODO DE ASOCIACIÓN DIRECTA POR CLIC EN EL MAPA (SIN MODALES)
  const handleStartDirectAssociateToMap = (pathId?: string) => {
    const targetPathId = pathId || (selectedPathIds.length > 0 ? selectedPathIds[0] : null);
    if (!targetPathId) {
      alert("Por favor selecciona un trazado u objeto en el editor para asociar al mapa.");
      return;
    }

    const p = mapEntity.paths.find(item => item.id === targetPathId);
    if (!p) {
      alert("No se encontró el objeto seleccionado.");
      return;
    }

    const detail = {
      pathId: p.id,
      name: p.name || p.id,
      d: p.d,
      fill: p.customData?.fill || p.visualStyles?.fillColor || '#10b981',
      customData: p.customData || {}
    };

    sessionStorage.setItem('argentina_direct_associate_source', JSON.stringify(detail));
    window.dispatchEvent(new CustomEvent('start_direct_associate_map', { detail }));

    setIsCombineObjectModalOpen(false);
    showNotify(`[🎯] ¡Modo Asociar al Clic Activo! Haz clic en el país/provincia en el mapa (ej: Argentina) para unir "${p.name}".`);
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
    let unifiedD = dArray.join(' ');

    // Si la silueta viene de un archivo importado o pegado con coordenadas desacopladas (ej: origen 0,0) y el nodo objetivo tiene posición geográfica real:
    const targetNode = mapEntity.paths.find(p => p.id === targetId);
    if (targetNode && targetNode.d) {
      const origBBox = getPathBBox(targetNode.d);
      const incomingBBox = getPathBBox(unifiedD);
      if (origBBox && origBBox.width > 1 && origBBox.height > 1 && incomingBBox) {
        // Si el SVG importado está en coordenadas aisladas (lejos de la posición original)
        if (Math.abs(incomingBBox.x - origBBox.x) > 200 && incomingBBox.x < 150 && incomingBBox.y < 150) {
          unifiedD = fitPathToBBox(unifiedD, origBBox);
        }
      }
    }

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

  // EJECUCIÓN DIRECTA CONFIRMADA DE LA MUTACIÓN QUIRÚRGICA:
  const executeDirectSilhouetteMutation = (targetId: string, newD: string) => {
    const updatedPaths = (mapEntity.paths || []).map(node =>
      node.id === targetId ? { ...node, d: newD } : node
    );

    const updatedEntity: VectorMapEntity = {
      ...mapEntity,
      paths: updatedPaths,
      updatedAt: new Date().toISOString()
    };

    setMapEntity(updatedEntity);
    setEditingPathData(prev => prev ? { ...prev, d: newD } : prev);
    setPreviewSilhouette(null);

    safeSetItem('argentina_advanced_canvas_map', JSON.stringify(updatedEntity));
    const provKey = selectedProvince?.id || mapEntity.id || 'country';
    safeSetItem(`argentina_advanced_canvas_map_${provKey}`, JSON.stringify(updatedEntity));

    if (onSaveMapEntity) {
      onSaveMapEntity(updatedEntity);
    }

    showNotify(`[🎯] Silueta de "${targetId}" actualizada quirúrgicamente.`);
  };

  // BOTÓN "APLICAR CAMBIOS" (CON ADVERTENCIA VISUAL PREVIA Y BLINDAJE DE SEGURIDAD):
  const handleApplySilhouetteMutation = () => { // Aplica la silueta modificada con confirmación visual
    const targetId = selectedPathIds[0] || (editingPathData ? editingPathData.id : null);
    if (!targetId) {
      alert("No hay ningún nodo seleccionado para aplicar los cambios.");
      return;
    }
    if (!previewSilhouette) {
      alert("Primero genera una vista previa de la silueta antes de aplicar cambios.");
      return;
    }

    const targetNode = mapEntity.paths.find(p => p.id === targetId);
    const targetName = targetNode?.name || targetId;
    const targetCurrentD = targetNode?.d || '';

    // Abre el modal de seguridad mostrando la imagen antes vs después
    setSafetyModalConfig({
      isOpen: true, // Abre el modal
      targetId: targetId, // ID del territorio seleccionado
      targetName: targetName, // Nombre del territorio seleccionado
      targetCurrentD: targetCurrentD, // D de la silueta actual
      targetPaths: targetNode ? [targetNode] : undefined, // Objeto vectorial previo con sus colores
      proposedD: previewSilhouette, // D de la silueta propuesta
      proposedName: `Silueta Perfeccionada de ${targetName}`, // Nombre descriptivo
      proposedPaths: mapEntity.paths.map(p => p.id === targetId ? { ...p, d: previewSilhouette } : p), // Conjunto de paths con la modificación
      operationType: 'silhouette_mutation', // Tipo de operación
      onConfirmReplace: () => {
        executeDirectSilhouetteMutation(targetId, previewSilhouette);
      },
      onConfirmAsIndependent: isPathMatchingMalvinas(previewSilhouette) ? () => {
        restoreMalvinasToOriginal();
        showNotify("✅ Islas Malvinas incorporadas en su posición original independiente. Tierra del Fuego permanece 100% intacta.");
      } : undefined
    });
  }; // Fin de handleApplySilhouetteMutation

  // DESCARTAR VISTA PREVIA
  const handleCancelSilhouettePreview = () => { // Función para descartar la vista previa
    setPreviewSilhouette(null); // Resetea el estado a nulo
    showNotify("[ℹ️] Vista previa de silueta descartada."); // Notificación informativa
  }; // Fin de handleCancelSilhouettePreview

  // EJECUCIÓN DIRECTA DEL GUARDADO DE MAPA TRAS CONFIRMACIÓN
  const executeDirectSaveMapToApp = () => {
    const activeTargetId = selectedSubdivisionId || selectedProvince?.id || mapEntity.paths[0]?.id || mapEntity.id || 'country';
    const activeTargetName = selectedProvince?.name || mapEntity.paths[0]?.name || mapEntity.title || activeTargetId;
    const targetNormalized = activeTargetId.toLowerCase().replace(/^ar-/, '');
    const isMalvinas = activeTargetId.toLowerCase().includes('malvin') || activeTargetId.toLowerCase().includes('mlv') || activeTargetName.toLowerCase().includes('malvin');

    const serializedEntity = JSON.stringify(mapEntity);

    safeSetItem('argentina_advanced_canvas_map', serializedEntity);
    safeSetItem(`argentina_advanced_canvas_map_${activeTargetId}`, serializedEntity);
    if (selectedProvince?.id && selectedProvince.id !== activeTargetId) {
      safeSetItem(`argentina_advanced_canvas_map_${selectedProvince.id}`, serializedEntity);
    }
    if (activeTargetId.toUpperCase() === 'WORLD_MAP' || mapEntity.level === 'world' || mapEntity.id === 'WORLD_MAP') {
      safeSetItem('argentina_advanced_canvas_map_WORLD_MAP', serializedEntity);
    }

    if (onSaveMapEntity) {
      onSaveMapEntity(mapEntity);
    }

    const rawUnifiedD = mapEntity.paths.map(p => (p.d || '').trim()).filter(Boolean).join(' ');

    let countryMap: ProvinceData | undefined = undefined;
    if (allProvinces) {
      countryMap = allProvinces['COUNTRY_MAP'] || allProvinces['argentina'] || allProvinces['country'];
    }

    const refPathObj = provincePaths.find(p => {
      const pId = p.id.toLowerCase().replace(/^ar-/, '');
      const pName = p.name.toLowerCase();
      const tName = activeTargetName.toLowerCase();
      return (
        p.id === activeTargetId ||
        p.id.toLowerCase() === activeTargetId.toLowerCase() ||
        pId === targetNormalized ||
        pName === tName ||
        pName.includes(tName) ||
        tName.includes(pName) ||
        (isMalvinas && (pName.includes('malvin') || p.id === 'AR-MLV'))
      );
    });

    let matchedIndex = -1;
    let oldMacroSub: any = undefined;

    if (countryMap && Array.isArray(countryMap.municipalities)) {
      matchedIndex = countryMap.municipalities.findIndex(m => {
        const mId = m.id.toLowerCase().replace(/^ar-/, '');
        const mName = (m.name || '').toLowerCase();
        const tName = activeTargetName.toLowerCase();
        return (
          m.id === activeTargetId ||
          m.id.toLowerCase() === activeTargetId.toLowerCase() ||
          mId === targetNormalized ||
          mName === tName ||
          mName.includes(tName) ||
          tName.includes(mName) ||
          (isMalvinas && (mName.includes('malvin') || m.id === 'AR-MLV' || m.id === 'MALVINAS'))
        );
      });
      if (matchedIndex !== -1) {
        oldMacroSub = countryMap.municipalities[matchedIndex];
      }
    }

    const origRefD = oldMacroSub?.d || refPathObj?.d || '';
    const targetBBox = getPathBBox(origRefD);

    let finalFittedD = rawUnifiedD;
    const currentBBox = getPathBBox(rawUnifiedD);
    if (targetBBox && targetBBox.width > 1 && targetBBox.height > 1 && currentBBox) {
      if (Math.abs(currentBBox.x - targetBBox.x) > 300 && currentBBox.x < 100 && currentBBox.y < 100) {
        finalFittedD = fitPathToBBox(rawUnifiedD, targetBBox);
      }
    }

    const rawCalibrated = safeGetItem('argentina_calibrated_map_paths');
    let currentCalibrated: { id: string; d: string }[] = [];
    if (rawCalibrated) {
      try { currentCalibrated = JSON.parse(rawCalibrated); } catch (e) {}
    }
    if (!Array.isArray(currentCalibrated) || currentCalibrated.length === 0) {
      currentCalibrated = provincePaths.map(p => ({ id: p.id, d: p.d }));
    }

    const idsToUpdate = [
      activeTargetId,
      oldMacroSub?.id,
      refPathObj?.id,
      ...(isMalvinas ? ['AR-MLV', 'MALVINAS'] : [])
    ].filter(Boolean) as string[];

    idsToUpdate.forEach(targetIdToSync => {
      const calIndex = currentCalibrated.findIndex(p => 
        p.id === targetIdToSync || 
        p.id.toLowerCase() === targetIdToSync.toLowerCase() || 
        p.id.toLowerCase().replace(/^ar-/, '') === targetIdToSync.toLowerCase().replace(/^ar-/, '')
      );
      if (calIndex !== -1) {
        currentCalibrated[calIndex].d = finalFittedD;
      } else {
        currentCalibrated.push({ id: targetIdToSync, d: finalFittedD });
      }
    });

    safeSetItem('argentina_calibrated_map_paths', JSON.stringify(currentCalibrated));
    safeSetItem('argentina_paths_last_updated', Date.now().toString());

    if (selectedProvince && onUpdateProvince) {
      const updatedMunicipalities = mapEntity.paths.map(p => ({
        id: p.id,
        name: p.name,
        value: p.customData?.valor || p.customData?.value || 0,
        percentage: p.customData?.porcentaje || p.customData?.percentage || 0,
        d: p.d,
        color: p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#10b981',
        layer: p.category || p.customData?.layer || selectedProvince.name,
        visualStyles: {
          fillColor: p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#10b981',
          strokeColor: p.customData?.stroke || p.visualStyles?.strokeColor || p.stroke || '#0f172a',
          strokeWidth: p.customData?.strokeWidth || p.visualStyles?.strokeWidth || p.strokeWidth || 1.5
        },
        customData: p.customData || {}
      }));

      onUpdateProvince({
        ...selectedProvince,
        d: finalFittedD || selectedProvince.d,
        municipalities: updatedMunicipalities,
        mapTransform: {
          scale: mapEntity.transform.scale,
          panX: mapEntity.transform.translateX,
          panY: mapEntity.transform.translateY
        }
      });
    }

    // 7. Propagación e impacto directo al mapa macro nacional ("COUNTRY_MAP" / ARGENTINA)
    if (onUpdateProvince && countryMap) {
      const updatedCountryMunicipalities = countryMap.municipalities ? [...countryMap.municipalities] : [];
      if (matchedIndex !== -1 && oldMacroSub) {
        updatedCountryMunicipalities[matchedIndex] = {
          ...oldMacroSub,
          d: finalFittedD || oldMacroSub.d,
          customData: {
            ...(oldMacroSub.customData || {}),
            subItems: mapEntity.paths
          }
        };
      }

      const updatedCountryMap: ProvinceData = {
        ...countryMap,
        municipalities: updatedCountryMunicipalities
      };

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

      onUpdateProvince(updatedCountryMap);
    }

    // 8. Notifica a toda la ventana del navegador para recarga inmediata en el mapa interactivo
    window.dispatchEvent(new CustomEvent('argentina_paths_updated'));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('mapDataUpdated', { detail: { provinceId: activeTargetId, d: finalFittedD } }));
    window.dispatchEvent(new CustomEvent('projectDataSaved'));

    // Actualiza el snapshot inicial con la nueva versión recién guardada
    initialMapSnapshotRef.current = JSON.parse(JSON.stringify(mapEntity));
    if (onDirtyChange) onDirtyChange(false);

    showNotify(`[✅] ¡Cambios aplicados con éxito! La nueva forma de "${activeTargetName}" se ha actualizado en el mapa principal respetando sus medidas y ubicación exactas.`);
  };

  // GUARDAR MAPA EN LA APLICACIÓN / PERSISTENCIA EN TIEMPO REAL CON MODAL PREVIO DE SEGURIDAD
  const handleSaveMapToApp = () => { // Función principal para aplicar cambios y sincronizar con la aplicación
    if (!canEditMap) return; // Validación de permisos de edición

    // Detecta si la entidad actual es el Mapa Mundial o un mapa provincial/nacional
    const isWorldLevel = mapEntity.level === 'world' || 
                         mapEntity.id === 'WORLD_MAP' || 
                         mapEntity.id?.toLowerCase().includes('world') ||
                         mapEntity.title?.toLowerCase().includes('mundial') || 
                         mapEntity.title?.toLowerCase().includes('world');

    const activeTargetId = isWorldLevel ? 'WORLD_MAP' : (selectedProvince?.id || mapEntity.id || 'country');
    const activeTargetName = isWorldLevel ? (mapEntity.title || 'Mapa Mundial') : (selectedProvince?.name || mapEntity.title || 'Mapa Actual');
    const rawUnifiedD = mapEntity.paths.map(p => (p.d || '').trim()).filter(Boolean).join(' ');

    // Polígonos del estado previo / original (antes de las ediciones realizadas)
    const previousPaths: VectorPathItem[] = (initialMapSnapshotRef.current?.paths && initialMapSnapshotRef.current.paths.length > 0)
      ? initialMapSnapshotRef.current.paths
      : (historyStack && historyStack.length > 0 && historyStack[0].paths && historyStack[0].paths.length > 0)
      ? historyStack[0].paths
      : (!isWorldLevel && selectedProvince?.municipalities && selectedProvince.municipalities.length > 0)
      ? selectedProvince.municipalities.map(m => ({
          id: m.id,
          name: m.name,
          d: m.d || '',
          category: m.layer || 'subdivision',
          ownerId: 'system',
          visualStyles: {
            fillColor: m.visualStyles?.fillColor || m.color || '#38bdf8',
            strokeColor: m.visualStyles?.strokeColor || '#0f172a',
            strokeWidth: 1.2
          },
          customData: {
            valor: m.value,
            porcentaje: m.percentage,
            fill: m.visualStyles?.fillColor || m.color || '#38bdf8'
          }
        }))
      : mapEntity.paths;

    // Calcula el trazado unificado completo del estado anterior para la silueta
    const previousUnifiedD = previousPaths.map(p => (p.d || '').trim()).filter(Boolean).join(' ');

    // Abre el modal de confirmación con vista previa visual SVG y diagnóstico exacto antes vs después
    setSafetyModalConfig({
      isOpen: true,
      targetId: activeTargetId,
      targetName: activeTargetName,
      targetCurrentD: previousUnifiedD,
      targetPaths: previousPaths,
      proposedD: rawUnifiedD,
      proposedName: `${mapEntity.title || activeTargetName} (${mapEntity.paths.length} polígonos)`,
      proposedPaths: mapEntity.paths,
      operationType: 'save_map',
      onConfirmReplace: () => {
        executeDirectSaveMapToApp();
      },
      onConfirmAsIndependent: isPathMatchingMalvinas(rawUnifiedD) ? () => {
        // Guarda Malvinas de forma independiente sin alterar Tierra del Fuego
        restoreTierraDelFuegoToOriginal();
        const rawCalibrated = safeGetItem('argentina_calibrated_map_paths');
        let currentCal: Array<{ id: string; name?: string; d: string }> = [];
        if (rawCalibrated) {
          try { currentCal = JSON.parse(rawCalibrated); } catch (e) {}
        }
        const mlvIdx = currentCal.findIndex(c => c.id === 'AR-MLV' || (c.name && c.name.toLowerCase().includes('malvin')));
        if (mlvIdx !== -1) {
          currentCal[mlvIdx].d = rawUnifiedD || CANONICAL_MALVINAS_D;
          currentCal[mlvIdx].name = 'Islas Malvinas';
          currentCal[mlvIdx].id = 'AR-MLV';
        } else {
          currentCal.push({ id: 'AR-MLV', name: 'Islas Malvinas', d: rawUnifiedD || CANONICAL_MALVINAS_D });
        }
        safeSetItem('argentina_calibrated_map_paths', JSON.stringify(currentCal));
        safeSetItem('argentina_paths_last_updated', Date.now().toString());
        window.dispatchEvent(new CustomEvent('argentina_paths_updated'));
        showNotify("✅ Islas Malvinas agregadas como territorio soberano independiente. ¡Tierra del Fuego protegida e intacta!");
      } : undefined
    });
  };

  // RESTAURACIONES RÁPIDAS DE EMERGENCIA CON UN SOLO CLIC
  const handleQuickRestoreTierraDelFuego = () => {
    restoreTierraDelFuegoToOriginal();
    showNotify("🛡️ Tierra del Fuego ha sido restaurada con su trazado original histórico.");
    // Si estamos viendo Tierra del Fuego, recarga los paths en el lienzo
    if (selectedProvince?.id === 'AR-V') {
      const cleanEntity = {
        ...mapEntity,
        paths: [{
          id: 'AR-V',
          name: 'Tierra del Fuego',
          d: CANONICAL_TIERRA_DEL_FUEGO_D,
          category: 'provincia',
          ownerId: 'system',
          visualStyles: { fillColor: '#10b981', strokeColor: '#0f172a', strokeWidth: 1.5 },
          customData: { valor: 45, porcentaje: 20 }
        }]
      };
      setMapEntity(cleanEntity);
    }
  };

  const handleQuickRestoreFullArgentina = () => {
    if (window.confirm("¿Deseas restaurar todas las provincias de Argentina a sus trazados originales históricos de fábrica?")) {
      autoRepairArgentinaMap();
      showNotify("🛡️ Mapa completo de Argentina restaurado y verificado con éxito.");
    }
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
              {/* BOTÓN HISTORIAL VISUAL ANTIGRAVITY (TIMELINE CON PREVIEWS Y RESTAURACIÓN) */}
              <button
                type="button"
                onClick={() => setIsVisualHistoryModalOpen(true)}
                className="py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border-indigo-500/40 shadow-sm"
                title="Abrir Historial Visual de Versiones estilo Antigravity (previsualización, diff y restauración)"
              >
                <History size={13} className="text-indigo-400" />
                <span>Historial Visual</span>
                <span className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded-full text-indigo-300 font-extrabold border border-indigo-500/30">
                  {historyStack.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsHistoryMenuOpen(!isHistoryMenuOpen)}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1 ${
                  isHistoryMenuOpen 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Ver lista rápida de pasos y gestionar memoria"
              >
                <span className="text-[10px] text-slate-400 font-mono">
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
                      <History size={11} /> Pasos Recientes ({historyStack.length})
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

                  {/* BOTÓN PARA ABRIR EL HISTORIAL VISUAL COMPLETO */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsHistoryMenuOpen(false);
                      setIsVisualHistoryModalOpen(true);
                    }}
                    className="w-full py-1.5 px-2 bg-indigo-950/50 hover:bg-indigo-900/70 border border-indigo-500/40 text-indigo-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 mt-1"
                  >
                    <Eye size={11} />
                    <span>Abrir Visor Visual Antigravity</span>
                  </button>

                  {/* BOTÓN PARA LIMPIAR HISTORIAL Y ELIMINAR ESTADOS PASADOS DE MEMORIA */}
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="w-full py-1.5 px-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="Elimina los pasos anteriores conservando solo el estado actual para liberar memoria y espacio local"
                  >
                    <Trash2 size={11} />
                    <span>Limpiar Historial (Liberar Memoria)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* INDICADOR DE CAMBIOS PENDIENTES */}
          {hasPendingChanges && (
            <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Cambios pendientes</span>
            </div>
          )}

          {/* ALERTA / BOTÓN RESTAURACIÓN RÁPIDA DE ISLAS MALVINAS SI NO ESTÁN EN EL MAPA */}
          {isMalvinasMissing && canEditMap && (
            <button
              type="button"
              onClick={handleQuickRestoreMalvinas}
              className="hidden md:flex py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer items-center space-x-1.5 shadow-md hover:scale-105"
              title="Las Islas Malvinas no están en este mapa. Haz clic para restaurarlas automáticamente en 1 clic."
            >
              <Sparkles size={13} className="text-amber-400 animate-spin" />
              <span>Restaurar Malvinas</span>
            </button>
          )}

          {/* BOTÓN PRINCIPAL: AGREGAR NUEVO ELEMENTO / TERRITORIO / MIEMBRO */}
          <button
            type="button"
            onClick={() => setIsAddElementModalOpen(true)}
            disabled={!canEditMap}
            className="py-1.5 px-3.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-emerald-950/50 hover:scale-105 active:scale-95"
            title="Agregar nuevo elemento, isla, territorio, miembro o figura sin reemplazar nada"
          >
            <Plus size={14} className="stroke-[3]" />
            <span>➕ Agregar Elemento</span>
          </button>

          {/* BOTÓN DE CANCELAR SIN GUARDAR (DESCARTAR CAMBIOS Y REVERTIR AL ESTADO INICIAL) */}
          <button
            type="button"
            onClick={handleCancelUnsavedChanges}
            disabled={!canEditMap}
            className="py-1.5 px-3 bg-rose-950/60 hover:bg-rose-900/80 disabled:opacity-40 text-rose-200 border border-rose-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-md shadow-rose-950/40"
            title="Descarca todos los cambios no guardados y vuelve al estado original"
          >
            <RotateCcw size={13} className="text-rose-400" />
            <span>Descartar Cambios</span>
          </button>

          {/* Guardar cambios globales / Aplicar Cambios */}
          <button
            onClick={handleSaveMapToApp}
            disabled={!canEditMap}
            className={`py-1.5 px-3.5 disabled:opacity-40 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg ${
              hasPendingChanges
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-400/50'
                : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-emerald-950/40'
            }`}
            title="Aplica todos los cambios y sincroniza el mapa con la aplicación"
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

          {/* BOTÓN Y MENÚ DE BLINDAJE GEOGRÁFICO Y RECUPERACIÓN HISTÓRICA */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSafetyRecoveryMenuOpen(!isSafetyRecoveryMenuOpen)}
              className="py-1.5 px-3 bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-md shadow-indigo-950/40"
              title="Opciones de blindaje y recuperación de Tierra del Fuego, Malvinas y provincias de Argentina"
            >
              <ShieldAlert size={13} className="text-indigo-400" />
              <span>🛡️ Blindaje Geográfico</span>
            </button>

            {isSafetyRecoveryMenuOpen && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-2 w-72 bg-slate-950 border border-indigo-500/30 rounded-2xl shadow-2xl p-3 space-y-2 z-50 animate-fadeIn text-left"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                    <ShieldAlert size={13} className="text-indigo-400" />
                    Blindaje y Recuperación
                  </span>
                  <button
                    onClick={() => setIsSafetyRecoveryMenuOpen(false)}
                    className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg text-xs"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Restaura instantáneamente las formas originales de fábrica sin perder tus otros datos:
                </p>

                <div className="space-y-1.5 pt-1">
                  {/* Restaurar Tierra del Fuego */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSafetyRecoveryMenuOpen(false);
                      handleQuickRestoreTierraDelFuego();
                    }}
                    className="w-full text-left p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-900/40 hover:border-emerald-500/50 text-slate-200 text-xs transition-all flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-emerald-300 truncate">Restaurar Tierra del Fuego</div>
                      <div className="text-[10px] text-slate-400 truncate">Recupera la silueta original histórica (AR-V)</div>
                    </div>
                  </button>

                  {/* Restaurar Islas Malvinas */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSafetyRecoveryMenuOpen(false);
                      handleQuickRestoreMalvinas();
                    }}
                    className="w-full text-left p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-900/40 hover:border-sky-500/50 text-slate-200 text-xs transition-all flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sky-300 truncate">Restaurar Islas Malvinas</div>
                      <div className="text-[10px] text-slate-400 truncate">Reinserta el archipiélago en su posición (AR-MLV)</div>
                    </div>
                  </button>

                  {/* Restaurar Mapa Completo */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSafetyRecoveryMenuOpen(false);
                      handleQuickRestoreFullArgentina();
                    }}
                    className="w-full text-left p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-indigo-900/40 hover:border-indigo-500/50 text-slate-200 text-xs transition-all flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-indigo-300 truncate">Auto-Reparar Mapa Completo</div>
                      <div className="text-[10px] text-slate-400 truncate">Verifica y repara las 24 provincias</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

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
                  type="button"
                  onClick={() => setIsAddElementModalOpen(true)}
                  disabled={!canEditMap}
                  className="text-[10px] font-extrabold text-emerald-300 hover:text-emerald-200 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center space-x-1 shadow-xs"
                  title="Agregar nuevo elemento, miembro o isla al mapa"
                >
                  <Plus size={10} className="stroke-[3]" />
                  <span>Agregar</span>
                </button>
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

                          {/* Botón Asociar Directo al Clic en Mapa */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartDirectAssociateToMap(p.id);
                            }}
                            className="p-1 hover:bg-purple-500/20 rounded text-purple-400 hover:text-purple-300 transition-colors"
                            title="🎯 Asociar directamente al hacer clic en el mapa (ej: a Argentina u otra provincia sin modales)"
                          >
                            <Target size={11} />
                          </button>

                          {/* Botón Combinar / Unir con otro objeto */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCombineSourcePathId(p.id);
                              // Por defecto preselecciona otro objeto si hay alguno
                              const other = mapEntity.paths.find(op => op.id !== p.id);
                              setCombineTargetPathId(other ? other.id : '');
                              setIsCombineObjectModalOpen(true);
                            }}
                            className="p-1 hover:bg-purple-500/20 rounded text-purple-400 hover:text-purple-300 transition-colors"
                            title="Combinar o unir con otro trazado / territorio"
                          >
                            <GitMerge size={11} />
                          </button>

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
          
          {/* CONTROLES DE ZOOM Y HERRAMIENTA MANITO */}
          <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-800 rounded-xl p-1.5 flex items-center space-x-1.5 z-20 shadow-2xl backdrop-blur-md">
            {/* BOTÓN HERRAMIENTA MANITO (MOVER / ARRASTRAR MAPA LIBREMENTE) */}
            <button
              onClick={() => {
                setIsPanToolActive(!isPanToolActive);
              }}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 border ${
                isPanToolActive
                  ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.7)]'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800 hover:text-sky-400'
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
              <>
                <button
                  onClick={handleFocusOnSelection}
                  className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-fade-in"
                  title="Centrar el zoom y la pantalla directamente en la figura u objeto seleccionado"
                >
                  <Target size={12} className="text-emerald-400" />
                  <span>Enfocar</span>
                </button>

                {/* BOTÓN DUPLICAR SELECCIÓN */}
                <button
                  onClick={handleDuplicateSelectedPaths}
                  disabled={!canEditMap}
                  className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 animate-fade-in disabled:opacity-40"
                  title="Duplicar o copiar los elementos seleccionados para editarlos por separado"
                >
                  <Copy size={12} className="text-sky-400" />
                  <span>Duplicar ({selectedPathIds.length})</span>
                </button>

                {/* BOTÓN GUARDAR SELECCIÓN APARTE */}
                <button
                  onClick={handleSaveSelectionSeparately}
                  className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 animate-fade-in"
                  title="Exportar y guardar solo los elementos seleccionados como un archivo independiente"
                >
                  <Download size={12} className="text-indigo-400" />
                  <span>Guardar Aparte</span>
                </button>

                {/* BOTÓN AISLAR / VER TODO EL MAPA */}
                <button
                  onClick={toggleFocusIsolation}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 animate-fade-in border ${
                    isFocusIsolated
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                  title={isFocusIsolated ? "Volver a mostrar todos los polígonos del mapa" : "Aislar visualmente solo la selección"}
                >
                  {isFocusIsolated ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span>{isFocusIsolated ? 'Ver Todo' : 'Aislar'}</span>
                </button>

                {/* BOTÓN ELIMINAR SELECCIÓN */}
                <button
                  onClick={() => handleDeleteSelectedPaths(selectedPathIds)}
                  disabled={!canEditMap}
                  className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 animate-fade-in disabled:opacity-40"
                  title="Eliminar los elementos seleccionados conservando el resto del mapa"
                >
                  <Trash2 size={12} className="text-rose-400" />
                  <span>Eliminar ({selectedPathIds.length})</span>
                </button>

                {/* BOTÓN DESELECCIONAR */}
                <button
                  onClick={() => setSelectedPathIds([])}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 animate-fade-in"
                  title="Deseleccionar todos los polígonos y figuras"
                >
                  <X size={12} className="text-slate-400" />
                  <span>Deseleccionar</span>
                </button>
              </>
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
              <g transform={`translate(${mapEntity?.transform?.translateX ?? 0}, ${mapEntity?.transform?.translateY ?? 0}) scale(${mapEntity?.transform?.scale ?? 1})`}>
                
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
                type="button"
                onClick={() => setIsAddElementModalOpen(true)}
                className="py-1.5 px-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-emerald-950/40 hover:scale-105"
                title="Agregar nuevo elemento, isla, territorio o miembro al mapa"
              >
                <Plus size={14} className="stroke-[3]" />
                <span>➕ Agregar Elemento</span>
              </button>
              <button
                onClick={handleSelectAll}
                className="py-1.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 border border-slate-700 hover:scale-105"
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

              {/* Botón Agregar Elemento Rápido */}
              <button
                type="button"
                onClick={() => setIsAddElementModalOpen(true)}
                className="py-1 px-2.5 rounded-lg text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer flex items-center space-x-1"
                title="Agregar otro elemento o territorio adicional al mapa"
              >
                <Plus size={12} className="stroke-[3]" />
                <span>Agregar Otro</span>
              </button>

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

              {/* BOTÓN MODO MOVER EN LA BARRA DE ACCIÓN INFERIOR */}
              <button
                onClick={toggleMoveMode}
                className={`py-1 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center space-x-1 border uppercase tracking-wider ${
                  canvasMode === 'move'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
                title="Activar Modo Mover exclusivo para arrastrar y reubicar este elemento"
              >
                <Move size={12} />
                <span>{canvasMode === 'move' ? '✥ Moviendo' : 'Mover'}</span>
              </button>

              {/* BOTÓN MODO REDIMENSIONAR EN LA BARRA DE ACCIÓN INFERIOR */}
              <button
                onClick={toggleResizeMode}
                className={`py-1 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center space-x-1 border uppercase tracking-wider ${
                  canvasMode === 'resize'
                    ? 'bg-purple-500 text-slate-950 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.7)]'
                    : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30'
                }`}
                title="Activar Modo Redimensionar exclusivo para ajustar escala y tamaño"
              >
                <Maximize2 size={12} />
                <span>{canvasMode === 'resize' ? '⤢ Escalando' : 'Redimensionar'}</span>
              </button>

              {/* BOTÓN RÁPIDO: UBICAR EN INDICADOR DE RUTA GEOGRÁFICA */}
              <button
                onClick={handleAlignWithGeographicRouteMarker}
                className="py-1 px-2.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-sm"
                title="Alinear automáticamente con el marcador y animación de ruta geográfica"
              >
                <MapPin size={12} className="text-emerald-400" />
                <span>🎯 Ubicar en Ruta</span>
              </button>

              {/* BOTÓN ASOCIAR DIRECTAMENTE AL HACER CLIC EN EL MAPA (SIN MODALES) */}
              {selectedPathIds.length >= 1 && (
                <button
                  onClick={() => handleStartDirectAssociateToMap()}
                  className="py-1 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 shadow-[0_0_15px_rgba(168,85,247,0.6)] border border-purple-300 animate-pulse"
                  title="🎯 Asociar al Clic en Mapa: Haz clic aquí y luego toca el país/provincia en el mapa (ej: Argentina) para unirlos directamente sin modales."
                >
                  <Target size={13} className="text-white" />
                  <span>🎯 Asociar al Clic en Mapa</span>
                </button>
              )}

              {/* BOTÓN UNIR / COMBINAR CON OTRO OBJETO (SI HAY 1 SELECCIONADO) */}
              {selectedPathIds.length === 1 && (
                <button
                  onClick={() => {
                    setCombineSourcePathId(selectedPathIds[0]);
                    const other = mapEntity.paths.find(op => op.id !== selectedPathIds[0]);
                    setCombineTargetPathId(other ? other.id : '');
                    setIsCombineObjectModalOpen(true);
                  }}
                  className="py-1 px-2.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-sm"
                  title="Unir o combinar este trazo/isla con otro objeto del mapa"
                >
                  <GitMerge size={12} className="text-purple-400" />
                  <span>Unir con...</span>
                </button>
              )}

              {/* BOTÓN ASOCIAR / ANEXAR A OTRA RUTA */}
              <button
                onClick={() => {
                  setAssociateScope('selected');
                  setIsAssociateModalOpen(true);
                }}
                className="py-1 px-2.5 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-sm"
                title="Asociar o anexar los trazos seleccionados a una ruta/provincia de destino"
              >
                <Globe size={12} className="text-sky-400" />
                <span>Asociar a Ruta</span>
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

      {/* MODAL DE ASOCIAR / COMBINAR MAPA A OTRA RUTA O PROVINCIA */}
      {isAssociateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-sky-400 flex items-center space-x-2">
                <Globe size={18} />
                <span>Asociar o Combinar con Otra Ruta / Provincia</span>
              </h3>
              <button
                onClick={() => setIsAssociateModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Selector de Alcance (Todo el lienzo vs Solo seleccionados) */}
            <div className="space-y-1 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                Alcance del Trazado a Asociar:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssociateScope('selected')}
                  disabled={selectedPathIds.length === 0}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer ${
                    associateScope === 'selected' && selectedPathIds.length > 0
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 font-black shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 disabled:opacity-30'
                  }`}
                >
                  🎯 Solo Seleccionados ({selectedPathIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAssociateScope('all')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer ${
                    associateScope === 'all' || selectedPathIds.length === 0
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 font-black shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  🌐 Todo el Lienzo ({mapEntity.paths.length})
                </button>
              </div>
            </div>

            {/* Selector de Modo de Asociación */}
            <div className="space-y-1 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                Modo de Integración con la Ruta Destino:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAssociateMode('append')}
                  className={`p-2 rounded-lg text-[10px] font-bold border transition-all text-center flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                    associateMode === 'append'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Añade las piezas/islas al mapa existente de esa ruta sin borrar lo que ya tiene"
                >
                  <Puzzle size={14} className="text-emerald-400" />
                  <span>Anexar / Combinar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAssociateMode('merge_single')}
                  className={`p-2 rounded-lg text-[10px] font-bold border transition-all text-center flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                    associateMode === 'merge_single'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Fusiona las geometrías en un solo polígono multi-path compuesto"
                >
                  <GitMerge size={14} className="text-purple-400" />
                  <span>Fusión Multi-path</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAssociateMode('replace')}
                  className={`p-2 rounded-lg text-[10px] font-bold border transition-all text-center flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                    associateMode === 'replace'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Sobrescribe todo el mapa de la ruta destino"
                >
                  <RefreshCw size={14} className="text-amber-400" />
                  <span>Reemplazar Todo</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 italic">
                {associateMode === 'append' && "✨ Modo Anexar: Ideal para islas o subdivisiones. Suma estos trazados a la ruta sin eliminar su territorio principal."}
                {associateMode === 'merge_single' && "✨ Modo Fusión: Funde este trazo y el territorio destino en una sola figura SVG unificada."}
                {associateMode === 'replace' && "✨ Modo Reemplazar: Sustituye completamente todo el mapa previo de esa ruta."}
              </p>
            </div>

            {/* Buscador de ruta destino */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={associateSearchQuery}
                onChange={(e) => setAssociateSearchQuery(e.target.value)}
                placeholder="Buscar provincia o ruta objetivo (ej: Argentina, Córdoba)..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-100 placeholder:text-slate-500 outline-none font-bold"
              />
            </div>

            {/* Lista de rutas disponibles */}
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {availableTerritories
                .filter(t => !associateSearchQuery || t.name.toLowerCase().includes(associateSearchQuery.toLowerCase()) || t.id.toLowerCase().includes(associateSearchQuery.toLowerCase()))
                .map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTargetAssociateRouteId(t.id)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      targetAssociateRouteId === t.id
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold shadow-sm'
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
                <span>Ejecutar Asociación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COMBINAR / ASOCIAR OBJETO ESPECÍFICO CON OTRO DEL LIENZO */}
      {isCombineObjectModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-purple-400 flex items-center space-x-2">
                <GitMerge size={18} />
                <span>Combinar / Unir Objeto con otro Trazado</span>
              </h3>
              <button
                onClick={() => setIsCombineObjectModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Objeto de origen a combinar */}
            {combineSourcePathId && (() => {
              const src = mapEntity.paths.find(p => p.id === combineSourcePathId);
              return (
                <div className="p-2.5 bg-slate-950 border border-purple-500/30 rounded-xl space-y-2">
                  <div>
                    <span className="text-[10px] text-purple-400 font-black uppercase tracking-wider">Objeto a Integrar (Origen / Isla / Parte):</span>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <Spline size={14} className="text-purple-400" />
                      <p className="text-xs font-bold text-slate-200">{src?.name || combineSourcePathId}</p>
                      <span className="text-[9px] font-mono text-slate-500">({src?.id})</span>
                    </div>
                  </div>

                  {/* Acceso Rápido Directo al Clic en Mapa (Sin Modal) */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-purple-300">¿Prefieres tocarlo directo en el mapa?</span>
                    <button
                      type="button"
                      onClick={() => handleStartDirectAssociateToMap(combineSourcePathId)}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-sm cursor-pointer border border-purple-400"
                    >
                      <Target size={11} />
                      <span>Elegir en Mapa</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Selector del Modo de Combinación entre Objetos */}
            <div className="space-y-1 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                Tipo de Unión / Asociación:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCombineObjectMode('merge_geometry')}
                  className={`p-2 rounded-lg text-[10px] font-bold border transition-all text-center flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                    combineObjectMode === 'merge_geometry'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Une las coordenadas en un solo polígono continuo/discontinuo (se puede descombinar)"
                >
                  <GitMerge size={14} className="text-purple-400" />
                  <span>Fusión Geométrica</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCombineObjectMode('group_hierarchy')}
                  className={`p-2 rounded-lg text-[10px] font-bold border transition-all text-center flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                    combineObjectMode === 'group_hierarchy'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/60 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Crea un Contenedor Padre tipo CorelDRAW conservando trazos independientes"
                >
                  <Folder size={14} className="text-indigo-400" />
                  <span>Agrupar Padre</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCombineObjectMode('same_identity')}
                  className={`p-2 rounded-lg text-[10px] font-bold border transition-all text-center flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                    combineObjectMode === 'same_identity'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Sincroniza nombres, capas y métricas sin alterar las curvas"
                >
                  <Link size={14} className="text-sky-400" />
                  <span>Misma Identidad</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 italic">
                {combineObjectMode === 'merge_geometry' && "✨ Fusión Geométrica: Ambos objetos pasan a ser una sola figura SVG unificada (ej: Territorio + Isla) con opción de descombinar."}
                {combineObjectMode === 'group_hierarchy' && "✨ Agrupar Padre: Los dos objetos quedan vinculados bajo un mismo grupo organizativo."}
                {combineObjectMode === 'same_identity' && "✨ Misma Identidad: Sincroniza nombres y valores para que funcionen como el mismo territorio en las métricas."}
              </p>
            </div>

            {/* Buscador de objeto destino */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={combineObjectSearch}
                onChange={(e) => setCombineObjectSearch(e.target.value)}
                placeholder="Buscar trazado destino en el lienzo (ej: Argentina, Continente)..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-100 placeholder:text-slate-500 outline-none font-bold"
              />
            </div>

            {/* Lista de objetos disponibles en el lienzo */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {mapEntity.paths
                .filter(p => p.id !== combineSourcePathId)
                .filter(p => !combineObjectSearch || (p.name && p.name.toLowerCase().includes(combineObjectSearch.toLowerCase())) || p.id.toLowerCase().includes(combineObjectSearch.toLowerCase()))
                .map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCombineTargetPathId(p.id)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      combineTargetPathId === p.id
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-bold shadow-sm'
                        : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-300 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full border border-slate-700 shrink-0" style={{ backgroundColor: p.customData?.fill || p.visualStyles?.fillColor || '#10b981' }} />
                      <div className="truncate">
                        <p className="text-xs font-bold truncate">{p.name || p.id}</p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">ID: {p.id}</p>
                      </div>
                    </div>
                    {combineTargetPathId === p.id && (
                      <span className="text-[10px] bg-purple-500 text-slate-950 px-2 py-0.5 rounded-full font-black shrink-0">
                        Destino Seleccionado
                      </span>
                    )}
                  </button>
                ))}
            </div>

            {/* Botones de acción del modal */}
            <div className="flex items-center justify-end space-x-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setIsCombineObjectModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!combineSourcePathId || !combineTargetPathId) {
                    alert("Por favor selecciona el objeto destino con el cual combinar.");
                    return;
                  }
                  handleCombineSpecificObjects(combineSourcePathId, combineTargetPathId, combineObjectMode);
                }}
                disabled={!combineTargetPathId || !combineSourcePathId}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-purple-950/50 flex items-center space-x-1.5 cursor-pointer"
              >
                <GitMerge size={14} />
                <span>Confirmar Unión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL VISUAL DE VERSIONES (ANTIGRAVITY TIMELINE CON PREVISUALIZACIÓN Y DIFF) */}
      {isVisualHistoryModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Cabecera del Historial */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    <span>Historial Visual de Versiones</span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-bold">
                      {historyStack.length} snapshots
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Inspecciona visualmente cómo estaba el mapa en cada modificación y decide si restaurar o bifurcar sin perder nada.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsVisualHistoryModalOpen(false);
                  setPreviewHistoryIndex(null);
                }}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido Principal: Dos Columnas (Lista de Snapshots + Previsualizador SVG) */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Columna Izquierda: Línea de tiempo de snapshots */}
              <div className="w-full md:w-80 bg-slate-950/70 border-r border-slate-800 flex flex-col overflow-y-auto p-3 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                  Línea de Tiempo (Snapshots)
                </span>
                
                {historyStack.map((snap, idx) => {
                  const isCurrent = idx === historyIndex;
                  const isInspecting = (previewHistoryIndex ?? historyIndex) === idx;
                  const pathCount = snap.paths?.length || 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => setPreviewHistoryIndex(idx)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col space-y-1.5 ${
                        isInspecting
                          ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                          : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${isCurrent ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
                          <span className="text-xs font-bold text-slate-200">
                            {idx === 0 ? 'Estado Inicial' : `Snapshot #${idx}`}
                          </span>
                        </div>
                        {isCurrent && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded-full font-black uppercase">
                            Canvas Actual
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{pathCount} polígonos</span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {snap.updatedAt ? new Date(snap.updatedAt).toLocaleTimeString() : 'Guardado'}
                        </span>
                      </div>

                      {/* Botón de Restaurar directo */}
                      <div className="pt-1.5 flex items-center space-x-1.5 border-t border-slate-800/60">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryIndex(idx);
                            setMapEntity(JSON.parse(JSON.stringify(snap)));
                            setIsVisualHistoryModalOpen(false);
                            setPreviewHistoryIndex(null);
                            showNotify(`[↩️] Restaurado al snapshot #${idx} (${pathCount} polígonos).`);
                          }}
                          className="flex-1 py-1 px-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 rounded-lg text-[10px] font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <RotateCcw size={10} />
                          <span>Restaurar en Canvas</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Columna Derecha: Visor y Comparador Gráfico */}
              {(() => {
                const targetIdx = previewHistoryIndex ?? historyIndex;
                const inspectedSnapshot = historyStack[targetIdx] || mapEntity;
                const inspectedPaths = inspectedSnapshot.paths || [];
                const inspectedBBox = inspectedPaths.length > 0 ? getMultiplePathsBBox(inspectedPaths.map(p => ({ d: p.d }))) : { x: 0, y: 0, width: 800, height: 600 };
                const pad = Math.max(25, Math.max(inspectedBBox.width, inspectedBBox.height) * 0.1);
                const viewBoxStr = `${inspectedBBox.x - pad} ${inspectedBBox.y - pad} ${inspectedBBox.width + pad * 2} ${inspectedBBox.height + pad * 2}`;

                return (
                  <div className="flex-1 flex flex-col bg-slate-950 p-4 space-y-3 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Eye size={14} className="text-indigo-400" />
                        <span className="text-xs font-bold text-slate-200">
                          Previsualización de: {targetIdx === 0 ? 'Estado Inicial' : `Snapshot #${targetIdx}`}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          ({inspectedPaths.length} elementos vectoriales)
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            downloadJsonBlob(JSON.stringify(inspectedSnapshot, null, 2), `version_snapshot_${targetIdx}.json`);
                            showNotify(`[💾] Snapshot #${targetIdx} guardado como archivo independiente.`);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
                          title="Descargar este punto específico de la historia como archivo JSON"
                        >
                          <Download size={12} />
                          <span>Bifurcar / Guardar Copia</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryIndex(targetIdx);
                            setMapEntity(JSON.parse(JSON.stringify(inspectedSnapshot)));
                            setIsVisualHistoryModalOpen(false);
                            setPreviewHistoryIndex(null);
                            showNotify(`[✅] Aplicado snapshot #${targetIdx} al editor principal.`);
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1 cursor-pointer shadow-md shadow-emerald-950/40"
                        >
                          <Check size={12} />
                          <span>Aplicar este Estado</span>
                        </button>
                      </div>
                    </div>

                    {/* Lienzo SVG en vivo de la versión seleccionada */}
                    <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-center p-3 relative overflow-hidden">
                      <svg
                        viewBox={viewBoxStr}
                        className="w-full h-full max-h-[50vh] select-none"
                      >
                        {inspectedPaths.map(p => {
                          const fill = p.customData?.fill || p.visualStyles?.fillColor || '#10b981';
                          const stroke = p.customData?.stroke || p.visualStyles?.strokeColor || '#0f172a';
                          return (
                            <path
                              key={p.id}
                              d={p.d}
                              vectorEffect="non-scaling-stroke"
                              fill={fill}
                              fillOpacity={0.8}
                              stroke={stroke}
                              strokeWidth={0.8}
                            />
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Pie del modal */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Consejo: Puedes presionar <kbd className="bg-slate-800 px-1 py-0.5 rounded text-slate-300 font-mono">Ctrl+Z</kbd> o <kbd className="bg-slate-800 px-1 py-0.5 rounded text-slate-300 font-mono">Ctrl+Y</kbd> en cualquier momento para navegar los pasos.</span>
              <button
                type="button"
                onClick={() => {
                  setIsVisualHistoryModalOpen(false);
                  setPreviewHistoryIndex(null);
                }}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold cursor-pointer transition-colors"
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR NUEVO ELEMENTO / TERRITORIO / MIEMBRO AL MAPA (SIN REEMPLAZAR NADA) */}
      <AddElementModal
        isOpen={isAddElementModalOpen}
        onClose={() => setIsAddElementModalOpen(false)}
        onAddPath={handleAddNewVectorPath}
        existingPaths={mapEntity.paths}
        currentContextName={selectedProvince?.name || mapEntity.title || 'Mapa Actual'}
      />

      {/* MODAL DE ADVERTENCIA VISUAL Y BLINDAJE DE SEGURIDAD ANTES DE APLICAR O GUARDAR CAMBIOS */}
      <MapSafetyConfirmModal
        isOpen={safetyModalConfig.isOpen}
        onClose={() => setSafetyModalConfig(prev => ({ ...prev, isOpen: false }))}
        targetId={safetyModalConfig.targetId}
        targetName={safetyModalConfig.targetName}
        targetCurrentD={safetyModalConfig.targetCurrentD}
        targetPaths={safetyModalConfig.targetPaths}
        proposedD={safetyModalConfig.proposedD}
        proposedName={safetyModalConfig.proposedName}
        proposedPaths={safetyModalConfig.proposedPaths}
        operationType={safetyModalConfig.operationType}
        onConfirmReplace={() => {
          setSafetyModalConfig(prev => ({ ...prev, isOpen: false }));
          safetyModalConfig.onConfirmReplace();
        }}
        onConfirmAsIndependent={safetyModalConfig.onConfirmAsIndependent ? () => {
          setSafetyModalConfig(prev => ({ ...prev, isOpen: false }));
          safetyModalConfig.onConfirmAsIndependent?.();
        } : undefined}
      />
    </div>
  );
}
