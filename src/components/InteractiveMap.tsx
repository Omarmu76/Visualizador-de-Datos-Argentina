
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  ZoomIn, 
  ZoomOut, 
  Compass, 
  Settings, 
  Trash2, 
  Play, 
  Pause, 
  Plus, 
  RefreshCw, 
  Palette, 
  Layers, 
  HelpCircle,
  X,
  Globe,
  HeartPulse,
  Building2,
  Cpu,
  Grid,
  Navigation
} from 'lucide-react'; // Importación de íconos vectoriales para la interfaz interactiva con Navigation incluida
import { provincePaths } from '../data/provincePaths'; // Importación de los trazos vectoriales de las provincias argentinas
import { MetricType, ProvinceData, MunicipalityData, RegionNode, NavNode } from '../types'; // Importación del modelo de tipos de datos y nodos universales
import { mockProvincesData } from '../data/mockData'; // Importación de datos mock de provincias
import { getPathBBox, getMultiplePathsBBox } from '../lib/mapUtils'; // Helper para cálculo de cajas límite Bounding Box
import { safeGetItem } from '../lib/storage'; // Utilidad para lectura segura protegida contra excepciones

// Interfaz de propiedades actualizadas para el componente del mapa vectorial interactivo universal
interface InteractiveMapProps {
  selectedProvince: ProvinceData; // Provincia o nodo geográfico seleccionado actualmente
  onSelectProvince: (province: ProvinceData) => void; // Manejador para cambiar la provincia seleccionada
  onUpdateProvince: (province: ProvinceData) => void; // Manejador para actualizar datos de la provincia
  selectedMetric: MetricType; // Métrica estadística activa (Pobreza, Desempleo, Gini, Conectividad)
  onChangeMetric: (metric: MetricType) => void; // Manejador para cambiar la métrica activa
  activeMapLevel: string; // Identificador del nivel de alcance de mapa activo (ej: country, world, etc.)
  setActiveMapLevel: (level: string) => void; // Manejador para modificar el nivel activo
  mapLevels: { id: string; name: string }[]; // Colección de niveles de mapa disponibles
  selectedSubdivisionId: string | null; // Identificador de la subdivisión activa seleccionada
  setSelectedSubdivisionId: (id: string | null) => void; // Manejador para seleccionar subdivisión
  navigationPath?: RegionNode[]; // Historial de migas de pan regional tradicional
  onBreadcrumbClick?: (index: number) => void; // Manejador de clics en migas tradicionales
  navPath?: NavNode[]; // Historial de navegación dinámico universal (Motor Vectorial)
  goBackToNode?: (index: number) => void; // Manejador para retroceder en las migas universales
  onNavigateToNode?: (node: NavNode) => void; // Manejador para avanzar jerárquicamente a un nuevo nodo
}

export default function InteractiveMap({
  selectedProvince,
  onSelectProvince,
  onUpdateProvince,
  selectedMetric,
  onChangeMetric,
  activeMapLevel,
  setActiveMapLevel,
  mapLevels,
  selectedSubdivisionId,
  setSelectedSubdivisionId,
  navigationPath = [],
  onBreadcrumbClick,
  navPath = [], // Prop de historial de navegación dinámico con valor por defecto
  goBackToNode, // Manejador para retroceder en la jerarquía universal
  onNavigateToNode // Manejador para profundizar a un nodo hijo
}: InteractiveMapProps) {
  const [hoveredProv, setHoveredProv] = useState<string | null>(null); // Estado de provincia en hover
  const [zoomLevel, setZoomLevel] = useState(1); // Estado de nivel de zoom del lienzo
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }); // Estado de desplazamiento del lienzo (pan)
  const [hoveredMuni, setHoveredMuni] = useState<string | null>(null); // Estado de subdivisión en hover
  const [showCategoryGrid, setShowCategoryGrid] = useState<boolean>(false); // Estado para alternar el menú de categorías grandes

  // Identificación del nodo activo en el historial de navegación dinámico universal navPath
  const currentNode = useMemo(() => { // Memoriza el último nodo activo
    if (navPath && navPath.length > 0) { // Si existe el arreglo navPath
      return navPath[navPath.length - 1]; // Devuelve el último nodo activo
    } // Fin del condicional
    return { id: 'root', name: 'Inicio', type: 'root' }; // Fallback a nodo raíz
  }, [navPath]); // Dependencias del memorizador

  // Evaluación si estamos actualmente en el nivel raíz (Categorías Principales)
  const isAtRoot = useMemo(() => { // Memoriza el estado de raíz
    return currentNode.id === 'root' || (!navPath || navPath.length <= 1); // Evalúa si es la raíz
  }, [currentNode, navPath]); // Dependencias

  // Carga segura de nodos guardados en la base de datos geoNodes local (geo_nodes_database)
  const savedGeoNodes = useMemo(() => { // Memoriza los nodos en BD
    const raw = safeGetItem('geo_nodes_database'); // Lee la cadena JSON desde localStorage
    if (raw) { // Si existe la entrada
      try { // Intenta deserializar el contenido
        const parsed = JSON.parse(raw); // Convierte a objeto JS
        if (Array.isArray(parsed)) return parsed; // Si es un arreglo lo retorna
      } catch (e) { // En caso de fallo
        console.error('Error al analizar geo_nodes_database:', e); // Imprime error
      } // Fin de try-catch
    } // Fin del condicional raw
    return []; // Retorna arreglo vacío por defecto
  }, [currentNode.id]); // Dependencias

  // States for Map Layer and Vector Manager
  const [showManager, setShowManager] = useState(false);
  const [managerTab, setManagerTab] = useState<'palette' | 'divisions'>('palette');

  // Input states for editing individual subdivisions
  const [editSubName, setEditSubName] = useState('');
  const [editSubVal, setEditSubVal] = useState(30);
  const [editSubPct, setEditSubPct] = useState(10);

  // Custom transform states for the selected province minimap
  const [miniScale, setMiniScale] = useState(1.0);
  const [miniPanX, setMiniPanX] = useState(0);
  const [miniPanY, setMiniPanY] = useState(0);

  // Subdivisión / vectores válidos para nivel activo
  const validMunicipalities = useMemo(() => {
    return (selectedProvince.municipalities || []).filter(m => m.d && m.d.trim().length > 0 && !m.paused);
  }, [selectedProvince.municipalities]);

  const dynamicStrokeUnit = useMemo(() => {
    if (validMunicipalities.length === 0) return 1.2;
    const bbox = getMultiplePathsBBox(validMunicipalities);
    return Math.max(0.3, Math.min(bbox.width, bbox.height) / 350);
  }, [validMunicipalities]);

  // Sincronización dinámica de coordenadas de mapas calibradas
  const [calibratedPathsTimestamp, setCalibratedPathsTimestamp] = useState<string>(() => {
    return safeGetItem('argentina_paths_last_updated') || ''; // Carga segura de marca temporal
  });

  const activeProvincePaths = React.useMemo(() => {
    const saved = safeGetItem('argentina_calibrated_map_paths'); // Carga segura de rutas calibradas
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { id: string; d: string }[];
        if (Array.isArray(parsed)) {
          const pathMap = new Map(parsed.map(item => [item.id, item.d]));
          return provincePaths.map(p => {
            if (pathMap.has(p.id)) {
              return { ...p, d: pathMap.get(p.id)! };
            }
            return p;
          });
        }
      } catch (e) {
        console.error('Error parsing calibrated map paths:', e);
      }
    }
    return provincePaths;
  }, [calibratedPathsTimestamp]);

  // Ruta SVG vectorial memorizada de la provincia activa seleccionada
  const selectedProvincePath = useMemo(() => { // Hook useMemo para optimizar el cálculo de la ruta vectorial
    return activeProvincePaths.find(p => p.id === selectedProvince.id)?.d || (selectedProvince as unknown as { d?: string }).d || ''; // Busca la geometría SVG
  }, [activeProvincePaths, selectedProvince.id, selectedProvince]); // Dependencias de sincronización de la provincia

  // Cálculo memorizado del atributo viewBox adaptativo e inmune a errores NaN en estados vacíos
  const dynamicViewBox = useMemo(() => {
    // 1. Nivel País (Argentina con sus 24 provincias): Mantiene exacto el viewBox calibrado (BLINDAJE Y PROTECCIÓN DE ARGENTINA)
    if (activeMapLevel === 'country' || activeMapLevel === 'pais') {
      return "260 -2 440 964"; // Coordenadas geográficas calibradas para la República Argentina
    }

    // 2. Si existen subdivisiones o polígonos vectoriales cargados para el territorio activo:
    // Se calcula automáticamente la caja contenedora (Bounding Box) evitando divisiones por cero o valores NaN
    if (validMunicipalities && validMunicipalities.length > 0) { // Verifica si el arreglo contiene elementos
      const bbox = getMultiplePathsBBox(validMunicipalities); // Determina los límites geográficos
      if (bbox && bbox.width > 0 && bbox.height > 0 && !isNaN(bbox.x) && !isNaN(bbox.y)) { // Validación matemática anti-NaN
        const padX = Math.max(10, bbox.width * 0.05); // Acolchado horizontal responsivo del 5%
        const padY = Math.max(10, bbox.height * 0.05); // Acolchado vertical responsivo del 5%
        return `${bbox.x - padX} ${bbox.y - padY} ${bbox.width + padX * 2} ${bbox.height + padY * 2}`; // Encadre perfecto
      } // Fin de validación matemática
    } // Fin de condicional de municipios válidos

    // 3. Vistas por defecto cuando no hay vectoriales custom o el nodo está vacío (FASE 2: LIENZO EN BLANCO)
    if (activeMapLevel === 'world') return "0 0 1024 512"; // Vista estándar para el mapa mundial
    if (activeMapLevel === 'continent') return "0 0 800 1000"; // Vista estándar para mapa continental

    // 4. Bounding box automático basado en la silueta de la provincia activa en el Lienzo Principal
    if (selectedProvincePath && selectedProvincePath.trim().length > 0) { // Si existe la ruta vectorial de la provincia activa
      const bbox = getPathBBox(selectedProvincePath); // Obtiene la caja límites de la provincia seleccionada
      if (bbox && bbox.width > 0 && bbox.height > 0 && !isNaN(bbox.x) && !isNaN(bbox.y)) { // Validación anti-NaN
        const pad = 20; // Margen uniforme
        return `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`; // Retorna viewBox
      }
    }

    // 5. FALLBACK SEGURO PARA NODOS TOTALMENTE VACÍOS (Lienzo en Blanco predeterminado)
    return "0 0 800 600"; // ViewBox predeterminado por defecto para evitar pantallas rotas
  }, [activeMapLevel, validMunicipalities, selectedProvincePath]);

  // Sync transform states when selected province or its custom mapTransform changes
  useEffect(() => {
    const transform = selectedProvince.mapTransform || (selectedProvince.id === 'AR-MLV' ? { scale: 2.2, panX: -1218, panY: -1715 } : { scale: 1.0, panX: 0, panY: 0 });
    setMiniScale(transform.scale);
    setMiniPanX(transform.panX);
    setMiniPanY(transform.panY);
    
    // Clear selection if it doesn't belong to the newly selected province
    setSelectedSubdivisionId(null);
  }, [selectedProvince.id, selectedProvince.mapTransform]);

  // Color palette for artistic painting
  const customPalette = [
    { name: 'Esmeralda', hex: '#10b981' },
    { name: 'Cielo', hex: '#3b82f6' },
    { name: 'Amatista', hex: '#6366f1' },
    { name: 'Rosa', hex: '#ec4899' },
    { name: 'Fuego', hex: '#ef4444' },
    { name: 'Ámbar', hex: '#f59e0b' },
    { name: 'Pizarra', hex: '#64748b' }
  ];

  // Helper callbacks to push updates upstream and save to localStorage
  const updateProvince = (changes: Partial<ProvinceData>) => {
    const updated = {
      ...selectedProvince,
      ...changes
    };
    onUpdateProvince(updated);
  };

  const updateMunicipality = (muniId: string, changes: Partial<MunicipalityData>) => {
    const updatedMunis = (selectedProvince.municipalities || []).map(m => {
      if (m.id === muniId) {
        return { ...m, ...changes };
      }
      return m;
    });
    updateProvince({ municipalities: updatedMunis });
  };

  // SVG Paths for the 24 provinces of Argentina (Coordenadas reales integradas)
  // provincePaths has been migrated to src/data/provincePaths.ts

  useEffect(() => {
    const checkPathsUpdated = () => {
      const ts = safeGetItem('argentina_paths_last_updated') || ''; // Lee marca de tiempo segura
      if (ts !== calibratedPathsTimestamp) {
        setCalibratedPathsTimestamp(ts);
      }
    };
    window.addEventListener('storage', checkPathsUpdated);
    const interval = setInterval(checkPathsUpdated, 1000);
    return () => {
      window.removeEventListener('storage', checkPathsUpdated);
      clearInterval(interval);
    };
  }, [calibratedPathsTimestamp]);

  // Map metric keys to human friendly terms
  const metricLabels = {
    pobreza: 'Pobreza (%)',
    desempleo: 'Desempleo (%)',
    gini: 'Gini (%)',
    conectividad: 'Acceso a Internet (%)'
  };

  // Metric range helper to assign colors
  const getProvinceValue = (id: string, metric: MetricType) => {
    const data = mockProvincesData[id];
    if (!data) return 0;
    switch (metric) {
      case 'pobreza':
        return data.socialEmployment?.pobreza ?? 0;
      case 'desempleo':
        return data.socialEmployment?.desempleo ?? 0;
      case 'gini':
        return data.economicProfile?.gini ?? 0;
      case 'conectividad':
        return data.connectivity?.internetAccess?.[2]?.value ?? 50;
      default:
        return 0;
    }
  };

  // Color generator based on metric values (Sophisticated Dark monochromatic emerald theme)
  const getColorForValue = (val: number, metric: MetricType) => {
    if (metric === 'pobreza') {
      if (val <= 22) return '#022c22'; // Emerald 950 - dark
      if (val <= 30) return '#064e3b'; // Emerald 900
      if (val <= 38) return '#047857'; // Emerald 700
      return '#10b981'; // Emerald 500 - bright
    } else if (metric === 'desempleo') {
      if (val <= 7.5) return '#022c22';
      if (val <= 10) return '#064e3b';
      if (val <= 12.5) return '#047857';
      return '#10b981';
    } else if (metric === 'gini') {
      if (val <= 44) return '#022c22';
      if (val <= 50) return '#064e3b';
      if (val <= 58) return '#047857';
      return '#10b981';
    } else {
      if (val <= 65) return '#022c22';
      if (val <= 75) return '#064e3b';
      if (val <= 85) return '#047857';
      return '#10b981';
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (direction === 'in') {
      setZoomLevel(prev => Math.min(prev + 0.5, 3));
    } else {
      setZoomLevel(prev => Math.max(prev - 0.5, 1));
      if (zoomLevel <= 1.5) {
        setPanOffset({ x: 0, y: 0 });
      }
    }
  };

  // Highlight color limits for legend
  const legendLimits = {
    pobreza: ['20%', '30%', '40%', '50%'],
    desempleo: ['6%', '9%', '12%', '15%'],
    gini: ['40%', '48%', '56%', '64%'],
    conectividad: ['50%', '65%', '80%', '95%']
  };

  const getLegendGradient = (metric: MetricType) => {
    return 'linear-gradient(to right, #022c22, #064e3b, #047857, #10b981)';
  };

  return (
    <div id="interactive-map-container" className="flex flex-col h-full space-y-4">
      {/* Selector de Métrica y Modo de Categorías Grandes */}
      <div id="map-controls" className="bg-slate-900/40 rounded-xl border border-slate-800 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
              Ver Datos Por:
            </label>
            <select
              id="metric-select"
              value={selectedMetric}
              onChange={(e) => onChangeMetric(e.target.value as MetricType)}
              className="w-full sm:w-64 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded p-2 outline-none font-medium transition-all focus:border-emerald-500"
            >
              {Object.entries(metricLabels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            {/* Botón para alternar el menú de Categorías Grandes Principales */}
            <button
              onClick={() => setShowCategoryGrid(!showCategoryGrid)}
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded border transition-all cursor-pointer ${
                showCategoryGrid || isAtRoot
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-emerald-400'
              }`}
              title="Explorar Categorías Grandes"
            >
              <Grid size={16} />
              <span>Categorías</span>
            </button>
            <button
              onClick={() => handleZoom('in')}
              className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded transition-colors cursor-pointer hover:text-emerald-400"
              title="Acercar"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={() => handleZoom('out')}
              className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded transition-colors cursor-pointer hover:text-emerald-400"
              title="Alejar"
            >
              <ZoomOut size={18} />
            </button>
            <button
              onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
              className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded transition-colors cursor-pointer hover:text-emerald-400"
              title="Restablecer"
            >
              <Compass size={18} />
            </button>
          </div>
        </div>

        {/* Barra de escala de colores */}
        <div id="map-legend" className="mt-4 pt-3 border-t border-slate-800/60">
          <span className="text-[10px] font-bold text-slate-400 block mb-2 uppercase tracking-wider">
            Índice de {selectedMetric === 'conectividad' ? 'Conectividad' : selectedMetric === 'gini' ? 'Desigualdad (Gini)' : selectedMetric === 'pobreza' ? 'Pobreza' : 'Desempleo'} por Provincia
          </span>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-medium text-slate-500">{legendLimits[selectedMetric][0]}</span>
            <div
              className="h-2 flex-1 rounded-full shadow-inner"
              style={{ background: getLegendGradient(selectedMetric) }}
            />
            <span className="text-xs font-medium text-slate-500">{legendLimits[selectedMetric][3]}</span>
          </div>
          <div className="flex justify-between px-8 text-[10px] text-slate-500 font-semibold mt-1">
            <span>{legendLimits[selectedMetric][1]}</span>
            <span>{legendLimits[selectedMetric][2]}</span>
          </div>
        </div>
      </div>

      {/* Renderizado Condicional: Muestra el Menú de Categorías Grandes Principales cuando estamos en el Inicio o activamos showCategoryGrid */}
      {(isAtRoot || showCategoryGrid) ? (
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 flex flex-col space-y-6 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">
                Motor Universal de Visualización Vectorial
              </span>
              <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
                <Grid className="w-5 h-5 text-emerald-400" />
                <span>Explorar Categorías Principales</span>
              </h2>
            </div>
            {!isAtRoot && (
              <button
                onClick={() => setShowCategoryGrid(false)}
                className="text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                Volver a Lienzo Vectorial
              </button>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
            Selecciona una categoría estructural para acceder a sus nodos vectoriales con el Estándar de Oro en renderizado dinámico, colorización por métricas y navegación jerárquica.
          </p>

          {/* Cuadrícula de las 4 Categorías Grandes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. CARTOGRAFÍA & GEOGRAFÍA */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setShowCategoryGrid(false);
                if (onNavigateToNode) {
                  onNavigateToNode({ id: 'cartografia', name: 'Cartografía & Geografía', type: 'categoria' });
                }
                setActiveMapLevel('country');
              }}
              className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between space-y-3 group shadow-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                  <Globe className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                    🗺️ CARTOGRAFÍA & GEOGRAFÍA
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Mundo / Países / Provincias</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Mapas del Planeta Tierra, la República Argentina, provincias y divisiones territoriales con capas métricas.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/40">
                {['República Argentina', 'Provincias', 'Municipios', 'Mundo'].map((tag) => (
                  <span key={tag} className="text-[9px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* 2. SALUD & ANATOMÍA */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setShowCategoryGrid(false);
                if (onNavigateToNode) {
                  onNavigateToNode({ id: 'salud', name: 'Salud & Anatomía', type: 'categoria' });
                }
              }}
              className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/50 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between space-y-3 group shadow-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg group-hover:bg-rose-500/20 transition-colors">
                  <HeartPulse className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-rose-400 transition-colors">
                    🧬 SALUD & ANATOMÍA
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Cuerpo Humano / Órganos</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Anatomía Humana, sistemas biológicos, órganos y modelos diagnósticos vectoriales interactivos.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/40">
                {['Cuerpo Humano', 'Sistema Nervioso', 'Aparato Digestivo', 'Órganos'].map((tag) => (
                  <span key={tag} className="text-[9px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* 3. NEGOCIOS & ORGANIZACIONES */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setShowCategoryGrid(false);
                if (onNavigateToNode) {
                  onNavigateToNode({ id: 'negocios', name: 'Negocios & Estructuras', type: 'categoria' });
                }
              }}
              className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/50 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between space-y-3 group shadow-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg group-hover:bg-sky-500/20 transition-colors">
                  <Building2 className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-sky-400 transition-colors">
                    📊 NEGOCIOS & ORGANIZACIONES
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Organigramas / Procesos</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Organigramas corporativos, mapas de proceso, redes de logística y estructuras organizativas.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/40">
                {['Organigramas', 'Logística', 'Redes de Negocio', 'Flujos'].map((tag) => (
                  <span key={tag} className="text-[9px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* 4. INGENIERÍA & MECÁNICA */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setShowCategoryGrid(false);
                if (onNavigateToNode) {
                  onNavigateToNode({ id: 'ingenieria', name: 'Ingeniería & Mecánica', type: 'categoria' });
                }
              }}
              className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between space-y-3 group shadow-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                  <Cpu className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                    🚗 INGENIERÍA & MECÁNICA
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Circuitos / Maquinaria</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Esquemas técnicos, despiece de maquinaria, circuitos electrónicos y diagramas vectoriales de precisión.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/40">
                {['Automoción', 'Circuitos', 'Sistemas Mecánicos', 'Componentes'].map((tag) => (
                  <span key={tag} className="text-[9px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      ) : (
        /* Caja Principal del Mapa SVG */
      <div id="svg-map-wrapper" className="relative flex-1 min-h-[380px] bg-slate-950 rounded border border-slate-800 overflow-hidden flex items-center justify-center p-4">
        {/* Selector de Nivel y Elementos del Mapa Desplegable (Índice de Ruta Estructurado) */}
        <div id="dropdown-route-index" className="absolute top-4 left-4 z-40 flex flex-col space-y-1.5 bg-slate-900/95 backdrop-blur-md p-3 rounded-lg border border-slate-800 shadow-xl min-w-[220px] pointer-events-auto">
          {/* Etiqueta superior del selector jerárquico de ruta */}
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
            Índice de Ruta / Selección
          </span>
          {/* Selector Unificado: Permite navegar entre niveles macro y elegir las 24 provincias reales o subdivisiones */}
          <select
            id="map-level-select" // Identificador HTML único para el selector desplegable
            value={ // Valor seleccionado en tiempo real según la jerarquía activa y la provincia o subdivisión
              selectedSubdivisionId // 1. Si hay una subdivisión activa seleccionada (ej. municipio)
                ? selectedSubdivisionId // Utiliza la ID del municipio o subdivisión
                : (selectedProvince && mockProvincesData[selectedProvince.id]) // 2. Si hay una de las 24 provincias seleccionadas
                  ? selectedProvince.id // Utiliza la ID de la provincia (ej. AR-M, AR-B)
                  : (activeMapLevel === 'pais' ? 'country' : activeMapLevel || 'country') // 3. En caso contrario, utiliza el nivel macro (world, continent, country)
            } // Fin de la evaluación corregida y sincronizada del valor del select
            onChange={(e) => { // Manejador de evento al cambiar la opción seleccionada por el usuario
              const val = e.target.value; // Almacena el valor recuperado de la opción elegida

              // 1. SI EL USUARIO SELECCIONA UN NIVEL MACRO (Mundo, Continente, País, Provincia, Ciudad)
              if (val === 'world' || val === 'continent' || val === 'country' || val === 'province' || val === 'city' || val === 'neighborhood') { // Comprueba nivel macro
                setActiveMapLevel(val); // Modifica el nivel de mapa activo en el motor de renderizado
                setSelectedSubdivisionId(null); // Limpia la subdivisión activa previamente seleccionada
                if (onNavigateToNode) { // Verifica si está disponible la función de navegación universal navPath
                  const levelName = mapLevels.find(l => l.id === val)?.name || val; // Obtiene el nombre amigable del nivel
                  onNavigateToNode({ id: val, name: levelName, type: 'macro_level' }); // Agrega el nodo jerárquico al historial navPath
                } // Fin de comprobación onNavigateToNode
              } // Fin del condicional de nivel macro
              // 2. SI EL USUARIO SELECCIONA UNA PROVINCIA ARGENTINA DE LAS 24 PROVINCIAS REALES
              else if (mockProvincesData[val]) { // Comprueba si el valor coincide con una provincia válida de Argentina
                setActiveMapLevel('country'); // Asegura que el nivel activo permanezca en 'country' para renderizar el mapa completo de Argentina
                const fullData = mockProvincesData[val]; // Recupera el objeto completo de la provincia seleccionada
                onSelectProvince(fullData); // Asigna la provincia activa en el estado global
                if (onNavigateToNode) { // Verifica la disponibilidad del manejador de navegación
                  onNavigateToNode({ id: val, name: fullData.name, type: 'provincia' }); // Inyecta el nodo de la provincia en navPath
                } // Fin de condicional de navegación
                setSelectedSubdivisionId(null); // Deselecciona subdivisiones secundarias
              } // Fin de condicional de provincia
              // 3. SI EL USUARIO SELECCIONA UNA SUBDIVISIÓN O MUNICIPIO ESPECÍFICO
              else { // Ejecuta la selección de subdivisión interna
                setSelectedSubdivisionId(val); // Guarda la ID de la subdivisión seleccionada
                const foundSub = selectedProvince.municipalities?.find(m => m.id === val); // Localiza los datos del municipio
                if (foundSub && onNavigateToNode) { // Si existe el municipio y la función de navegación
                  onNavigateToNode({ id: val, name: foundSub.name, type: 'subdivision' }); // Agrega la subdivisión al navPath
                } // Fin de condicional de subdivisión
              } // Fin del bloque condicional general
            }} // Fin de onChange
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold rounded p-1.5 outline-none transition-all focus:border-emerald-500 cursor-pointer text-emerald-400" // Estilos Tailwind estéticos y accesibles
          >
            {/* GRUPO 1: VISTAS DE ALCANCE GENERAL Y NIVELES MACRO */}
            <optgroup label="🌐 Niveles de Alcance Macro">
              {mapLevels.map(level => ( // Mapea la lista de niveles jerárquicos disponibles
                <option key={level.id} value={level.id}> {/* Opción con clave e ID única */}
                  {level.id === 'world' ? '🌎 ' : // Emoji representativo para Mundo
                   level.id === 'continent' ? '🗺️ ' : // Emoji para Continente
                   level.id === 'country' ? '🇦🇷 ' : // Emoji para País
                   level.id === 'province' ? '🏢 ' : // Emoji para Provincia
                   level.id === 'city' ? '📍 ' : // Emoji para Ciudad
                   level.id === 'neighborhood' ? '🏘️ ' : '💠 '} {/* Emoji por defecto */}
                  {level.name} {/* Muestra el nombre legible del nivel */}
                </option> // Fin de option
              ))} {/* Fin del mapa de niveles */}
            </optgroup> {/* Fin de optgroup de niveles macro */}

            {/* GRUPO 2: PROVINCIAS REALES DE LA REPÚBLICA ARGENTINA (24 PROVINCIAS CATASTRALES) */}
            <optgroup label="🇦🇷 Provincias de Argentina (24 Nodos)">
              {Object.values(mockProvincesData).map(prov => ( // Recorre las 24 provincias argentinas registradas en la base de datos
                <option key={prov.id} value={prov.id}> {/* Opción asignada a la provincia */}
                  📍 {prov.name} ({prov.abbreviation}) {/* Muestra el nombre oficial y abreviatura ISO */}
                </option> // Fin de option provincia
              ))} {/* Fin del mapeo de provincias */}
            </optgroup> {/* Fin de optgroup provincias */}

            {/* GRUPO 3: MUNICIPIOS / SUBDIVISIONES DEL TERRITORIO SELECCIONADO */}
            {selectedProvince && selectedProvince.municipalities && selectedProvince.municipalities.length > 0 && ( // Verifica existencia de municipios
              <optgroup label={`🏢 Subdivisiones de ${selectedProvince.name}`}> {/* Etiqueta del grupo de subdivisiones */}
                {selectedProvince.municipalities.map(muni => ( // Mapea los municipios de la provincia
                  <option key={muni.id} value={muni.id}> {/* Opción para el municipio */}
                    🔹 {muni.name} ({muni.value}%) {/* Muestra el nombre del municipio y su indicador */}
                  </option> // Fin de option municipio
                ))} {/* Fin de mapeo de municipios */}
              </optgroup> // Fin de optgroup municipios
            )} {/* Fin de evaluación condicional de municipios */}
          </select> {/* Fin de elemento select unificado */}
          {/* Pie informativo del selector sincronizado con navPath */}
          <div className="flex items-center justify-between text-[8.5px] text-slate-400 mt-1">
            {/* Indicador pulsante de sincronización activa */}
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> {/* Círculo verde pulsante */}
              <span>Sincronizado con navPath</span> {/* Texto de estado de sincronización */}
            </span> {/* Fin de contenedor de estado */}
            {/* Abreviatura del territorio activo */}
            <span className="font-mono text-emerald-400/80 font-bold">
              {selectedProvince ? selectedProvince.abbreviation : 'ARG'} {/* Abreviatura de la provincia */}
            </span> {/* Fin de texto de abreviatura */}
          </div> {/* Fin de pie informativo */}
        </div> {/* Fin de contenedor del selector desplegable */}

        {/* Estado Vacío Informativo Banner cuando no hay vectores cargados para esta capa */}
        {validMunicipalities.length === 0 && activeMapLevel !== 'country' && activeMapLevel !== 'pais' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center space-x-2.5 px-3.5 py-2 text-center pointer-events-none bg-slate-900/90 border border-slate-800 rounded-lg shadow-xl">
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-bold text-slate-200">Sin municipios vectoriales en {mapLevels.find(l => l.id === activeMapLevel)?.name || 'esta provincia'}</p>
              <p className="text-[9px] text-slate-400">
                Utiliza el <span className="text-emerald-400 font-medium">Editor Vectorial</span> para importar o dibujar subdivisiones.
              </p>
            </div>
          </div>
        )}

        {/* Mapa SVG Interactivo */}
        <motion.svg
          id="argentina-svg-map"
          viewBox={dynamicViewBox}
          className="w-full h-full max-h-[500px] select-none cursor-grab active:cursor-grabbing"
          style={{
            originX: 0.5,
            originY: 0.5,
          }}
          animate={{
            scale: zoomLevel,
            x: panOffset.x,
            y: panOffset.y,
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 150 }}
        >
          {/* DEFINICIÓN DE PATRÓN DE CUADRÍCULA DE FONDO PARA EL LIENZO EN BLANCO */}
          <defs>
            <pattern id="blank-canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(51, 65, 85, 0.25)" strokeWidth="0.8" />
            </pattern>
          </defs>

          {/* FONDO DE CUADRÍCULA TÉCNICA Y ESTADO VACÍO CUANDO NO HAY GEOMETRÍA NI SUBDIVISIONES NI RUTA PROVINCIAL */}
          {validMunicipalities.length === 0 && !selectedProvincePath && activeMapLevel !== 'country' && activeMapLevel !== 'pais' && (
            <rect width="100%" height="100%" fill="url(#blank-canvas-grid)" />
          )}

          {/* TEXTO Y SÍMBOLO CENTRADO SVG EN EL LIENZO EN BLANCO (FASE 2) */}
          {validMunicipalities.length === 0 && !selectedProvincePath && activeMapLevel !== 'country' && activeMapLevel !== 'pais' && (
            <g id="empty-state-svg-group" className="pointer-events-none select-none">
              <text
                x="400"
                y="270"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="18"
                fontWeight="bold"
                className="font-sans tracking-wide"
              >
                Sin datos geográficos disponibles en esta región
              </text>
              <text
                x="400"
                y="300"
                textAnchor="middle"
                fill="#64748b"
                fontSize="12"
                className="font-sans"
              >
                (Utilice la barra de herramientas para importar un mapa vectorial JSON/SVG)
              </text>
            </g>
          )}

          {/* Sombra de agua / Mar Argentino en vista País */}
          {(activeMapLevel === 'country' || activeMapLevel === 'pais') && (
            <rect x="260" y="-2" width="440" height="964" fill="transparent" />
          )}

          {/* Capas e items vectoriales según el nivel */}
          {(activeMapLevel === 'country' || activeMapLevel === 'pais') ? (
            <g id="provinces-group">
              {activeProvincePaths.map((prov) => {
                const val = getProvinceValue(prov.id, selectedMetric);
                const isSelected = selectedProvince.id === prov.id;
                const isHovered = hoveredProv === prov.id;
                const fillHex = getColorForValue(val, selectedMetric);

                return (
                  <path
                    key={prov.id}
                    id={`province-path-${prov.id}`}
                    d={prov.d}
                    fill={fillHex}
                    stroke={isSelected ? '#10b981' : '#334155'}
                    strokeWidth={isSelected ? 3.5 : 2}
                    className="transition-all duration-150 cursor-pointer"
                    onClick={() => {
                      const fullData = mockProvincesData[prov.id] || {
                        id: prov.id,
                        name: prov.name,
                        abbreviation: prov.id.substring(0, 3).toUpperCase(),
                        municipalities: []
                      };
                      onSelectProvince(fullData as ProvinceData);
                      // El clic directo en el SVG inspecciona la provincia actualizando selectedProvince
                      // sin cambiar activeMapLevel para preservar la vista del mapa de Argentina y el mini-mapa inferior.
                    }}
                    onMouseEnter={() => setHoveredProv(prov.id)}
                    onMouseLeave={() => setHoveredProv(null)}
                    style={{
                      filter: isSelected
                        ? 'drop-shadow(0px 4px 10px rgba(16, 185, 129, 0.4))'
                        : isHovered
                        ? 'brightness(1.2)'
                        : 'none',
                    }}
                  />
                );
              })}
            </g>
          ) : (
            /* LIENZO PRINCIPAL (MAPA GRANDE) EN NIVEL PROVINCIA O SUB-REGIÓN */
            <g id="subdivisions-group">
              {/* Silueta de la provincia seleccionada como fondo de guía en el nivel municipio */}
              {activeMapLevel === 'municipality' && (
                <path
                  d={selectedProvincePath}
                  fill="rgba(30, 41, 59, 0.1)"
                  stroke="rgba(148, 163, 184, 0.3)"
                  strokeWidth={2}
                  className="pointer-events-none"
                />
              )}

              {/* Si la provincia tiene subdivisiones con trazo vectorial, las dibuja individualmente */}
              {validMunicipalities.length > 0 ? (
                (selectedProvince.municipalities || []).map((muni) => { // Recorre el listado de municipios o subdivisiones
                  if (muni.paused || !muni.d || !muni.d.trim()) return null; // Solo renderiza si tiene un path SVG válido
                  const dPath = muni.d;
                  const isSelected = selectedSubdivisionId === muni.id; // Verifica si está seleccionado
                  const isHovered = hoveredMuni === muni.id; // Verifica si el puntero está encima
                  const val = muni.value; // Recupera el valor asignado
                  
                  const fillHex = muni.visualStyles?.fillColor || muni.color || getColorForValue(val, selectedMetric); // Color de relleno
                  const strokeHex = isSelected ? '#f59e0b' : (muni.visualStyles?.strokeColor || '#334155'); // Color de contorno
                  const strokeW = isSelected ? dynamicStrokeUnit * 2.5 : (muni.visualStyles?.strokeWidth !== undefined ? muni.visualStyles.strokeWidth : dynamicStrokeUnit);

                  return ( // Retorna el elemento vectorial del polígono
                    <path
                      key={muni.id}
                      d={dPath}
                      fill={fillHex}
                      stroke={strokeHex}
                      strokeWidth={strokeW}
                      className="transition-all duration-150 cursor-pointer animate-fade-in"
                      onClick={() => {
                        setSelectedSubdivisionId(muni.id);
                        setEditSubName(muni.name);
                        setEditSubVal(muni.value);
                        setEditSubPct(muni.percentage);
                        if (!showManager) setShowManager(true);
                        setManagerTab('palette');
                        if (onNavigateToNode) {
                          onNavigateToNode({ id: muni.id, name: muni.name, type: 'subdivision' });
                        }
                      }}
                      onMouseEnter={() => setHoveredMuni(muni.id)}
                      onMouseLeave={() => setHoveredMuni(null)}
                      style={{
                        filter: isSelected
                          ? 'drop-shadow(0px 0px 8px #f59e0b)'
                          : isHovered
                          ? 'brightness(1.2)'
                          : 'none',
                      }}
                    />
                  );
                })
              ) : selectedProvincePath ? (
                /* REGLA ESTRICTA DEL LIENZO PRINCIPAL: Si la ruta activa es una Provincia y no tiene municipios vectoriales en BD,
                   el Lienzo Principal (Mapa Grande) renderiza la SILUETA DE LA PROVINCIA ACTIVA ocupando el mapa principal */
                <path
                  key={`full-prov-main-${selectedProvince.id}`}
                  id={`full-province-main-path-${selectedProvince.id}`}
                  d={selectedProvincePath}
                  fill={getColorForValue(getProvinceValue(selectedProvince.id, selectedMetric), selectedMetric)}
                  stroke="#10b981"
                  strokeWidth={2.5}
                  className="transition-all duration-150 cursor-pointer animate-fade-in"
                  style={{ filter: 'drop-shadow(0px 4px 10px rgba(16, 185, 129, 0.4))' }}
                />
              ) : null}
            </g>
          )}

          {/* Anclas de Ciudades o Etiquetas de Elemento Seleccionado */}
          <g id="map-pins" pointerEvents="none">
            {activeMapLevel === 'country' ? (
              activeProvincePaths.map((prov) => {
                const isSelected = selectedProvince.id === prov.id;
                if (!isSelected) return null;

                const provinceCenters: Record<string, { cx: number; cy: number }> = {
                  'AR-Y': { cx: 435, cy: 35 },   // Jujuy
                  'AR-A': { cx: 465, cy: 75 },   // Salta
                  'AR-T': { cx: 445, cy: 130 },  // Tucumán
                  'AR-K': { cx: 415, cy: 160 },  // Catamarca
                  'AR-F': { cx: 405, cy: 205 },  // La Rioja
                  'AR-J': { cx: 355, cy: 220 },  // San Juan
                  'AR-M': { cx: 370, cy: 320 },  // Mendoza
                  'AR-D': { cx: 425, cy: 310 },  // San Luis
                  'AR-L': { cx: 435, cy: 400 },  // La Pampa
                  'AR-Q': { cx: 335, cy: 430 },  // Neuquén
                  'AR-R': { cx: 400, cy: 485 },  // Río Negro
                  'AR-U': { cx: 385, cy: 590 },  // Chubut
                  'AR-Z': { cx: 345, cy: 760 },  // Santa Cruz
                  'AR-V': { cx: 405, cy: 935 },  // Tierra del Fuego
                  'AR-G': { cx: 480, cy: 155 },  // Santiago del Estero
                  'AR-H': { cx: 535, cy: 110 },  // Chaco
                  'AR-P': { cx: 560, cy: 65 },   // Formosa
                  'AR-N': { cx: 670, cy: 120 },  // Misiones
                  'AR-W': { cx: 615, cy: 175 },  // Corrientes
                  'AR-E': { cx: 575, cy: 255 },  // Entre Ríos
                  'AR-S': { cx: 525, cy: 230 },  // Santa Fe
                  'AR-X': { cx: 465, cy: 280 },  // Córdoba
                  'AR-B': { cx: 515, cy: 415 },  // Buenos Aires
                  'AR-C': { cx: 593, cy: 319 },  // CABA
                  'AR-MLV': { cx: 600, cy: 847 } // Islas Malvinas
                };

                const center = provinceCenters[prov.id] || { cx: 480, cy: 480 };
                const cx = center.cx;
                const cy = center.cy;

                return (
                  <g key={`pin-${prov.id}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r="8"
                      className="fill-emerald-400 stroke-slate-950 stroke-2 animate-ping"
                      style={{ transformOrigin: `${cx}px ${cy}px` }}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r="5"
                      className="fill-emerald-400 stroke-slate-950 stroke-2"
                    />
                    <foreignObject x={cx - 50} y={cy - 40} width="100" height="30">
                      <div className="flex justify-center">
                        <span className="bg-slate-950 text-[10px] text-emerald-400 border border-emerald-500/30 font-bold px-2 py-1 rounded shadow-lg tracking-wider uppercase whitespace-nowrap font-sans">
                          {prov.name}
                        </span>
                      </div>
                    </foreignObject>
                  </g>
                );
              })
            ) : (
              /* En otros niveles, colocar un indicador en el centro de la pieza seleccionada */
              (selectedProvince.municipalities || []).map((muni) => {
                const isSelected = selectedSubdivisionId === muni.id;
                if (!isSelected || !muni.d) return null;

                const muniBBox = getPathBBox(muni.d);
                const cx = muniBBox.x + muniBBox.width / 2;
                const cy = muniBBox.y + muniBBox.height / 2;

                return (
                  <g key={`muni-pin-${muni.id}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r="7"
                      className="fill-amber-400 stroke-slate-950 stroke-2 animate-ping"
                      style={{ transformOrigin: `${cx}px ${cy}px` }}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r="4.5"
                      className="fill-amber-400 stroke-slate-950 stroke-2"
                    />
                    <foreignObject x={cx - 50} y={cy - 35} width="100" height="30"> {/* Define la caja vectorial donde flotará el texto sobre el centro de gravedad del polígono */}
                      <div className="flex justify-center"> {/* Centra el elemento de texto horizontalmente */}
                        <span // Elemento contenedor para el texto con estilo de píldora oscura flotante
                          className="bg-slate-950 border border-amber-500/30 font-bold px-1.5 py-0.5 rounded shadow-lg tracking-wider uppercase whitespace-nowrap" // Clases base estables para legibilidad
                          style={{ // Aplica estilos dinámicos configurados en el panel de herramientas Figma del administrador
                            fontFamily: muni.visualStyles?.fontFamily || 'Inter', // Si existe tipografía personalizada, la aplica; de lo contrario usa 'Inter'
                            fontSize: muni.visualStyles?.fontSize ? `${muni.visualStyles.fontSize}px` : '9px', // Si existe tamaño personalizado, lo aplica; de lo contrario usa 9 píxeles
                            color: muni.visualStyles?.strokeColor || '#f59e0b', // Sincroniza el color del texto con el color del contorno de la capa catastral para un look consistente
                          }}
                        >
                          {muni.name} {/* Renderiza el nombre de la subdivisión (ej. "La Matanza") */}
                        </span>
                      </div>
                    </foreignObject>
                  </g>
                );
              })
            )}
          </g>
        </motion.svg>

        {/* Tooltip flotante en hover */}
        <AnimatePresence>
          {hoveredProv && activeMapLevel === 'country' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              className="absolute bottom-4 right-4 bg-slate-950/95 backdrop-blur-md text-slate-100 px-3 py-2 rounded border border-slate-800 shadow-2xl text-xs pointer-events-none flex flex-col space-y-0.5"
            >
              <span className="font-bold text-slate-200">
                {mockProvincesData[hoveredProv]?.name || hoveredProv}
              </span>
              <span className="text-[10px] text-slate-400">
                {metricLabels[selectedMetric]}:{' '}
                <span className="font-semibold text-emerald-400">
                  {getProvinceValue(hoveredProv, selectedMetric)}
                  {selectedMetric === 'gini' ? '' : '%'}
                </span>
              </span>
            </motion.div>
          )}

          {hoveredMuni && activeMapLevel !== 'country' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              className="absolute bottom-4 right-4 bg-slate-950/95 backdrop-blur-md text-slate-100 px-3 py-2 rounded border border-slate-800 shadow-2xl text-xs pointer-events-none flex flex-col space-y-0.5"
            >
              <span className="font-bold text-slate-200">
                {(selectedProvince.municipalities || []).find(m => m.id === hoveredMuni)?.name || 'Detalle'}
              </span>
              <span className="text-[10px] text-slate-400">
                {metricLabels[selectedMetric]}:{' '}
                <span className="font-semibold text-amber-400">
                  {(selectedProvince.municipalities || []).find(m => m.id === hoveredMuni)?.value}
                  {selectedMetric === 'gini' ? '' : '%'}
                </span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* Recuadro de Detalle: Provincia Seleccionada y Silueta Aislada con Navegación Drill-down */}
      <div id="province-municipios-detail" className="bg-slate-900/40 rounded-xl border border-slate-800 p-4 shadow-sm flex flex-col">
        {/* Encabezado del panel inferior de detalles y migas de pan locales */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 pb-2 border-b border-slate-800 gap-2">
          {/* Título de la vista de alcance y migas de pan */}
          <div>
            {/* Etiqueta del nivel de detalle activo */}
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {activeMapLevel === 'world' ? 'Detalle: Alcance Mundial' :
               activeMapLevel === 'continent' ? 'Detalle: Alcance Continental' :
               activeMapLevel === 'country' ? 'Detalle: Alcance Nacional / País' :
               activeMapLevel === 'province' ? 'Detalle: Alcance Provincial' :
               'Detalle: Territorio Seleccionado'}
            </h4>
            {/* Título del territorio con enlaces de navegación */}
            <h2 className="text-sm font-bold text-emerald-400 flex flex-wrap items-center mt-1 font-mono tracking-tight gap-1">
              <MapPin size={14} className="text-emerald-500 mr-1 shrink-0" /> {/* Icono de pin de ubicación */}
              {navigationPath.length > 0 ? ( // Si existe un camino regional activo
                navigationPath.map((node, index) => { // Recorre cada nodo del camino
                  const isLast = index === navigationPath.length - 1; // Verifica si es el último nodo
                  return ( // Renderiza el botón del eslabón de la miga de pan
                    <span key={node.id} className="flex items-center">
                      <button // Botón navegable del eslabón
                        onClick={() => onBreadcrumbClick && onBreadcrumbClick(index)} // Llama al manejador de clic en miga de pan
                        disabled={isLast || !onBreadcrumbClick} // Deshabilita si es la posición actual
                        className={`transition-all font-bold ${
                          isLast
                            ? 'text-emerald-400 font-extrabold cursor-default' // Estilo activo
                            : 'text-slate-400 hover:text-slate-200 hover:underline cursor-pointer' // Estilo navegable
                        }`}
                      >
                        {node.name.toUpperCase()} {/* Nombre del nodo en mayúsculas */}
                      </button>
                      {!isLast && <span className="text-slate-600 mx-1 font-sans text-xs">{'>'}</span>} {/* Separador */}
                    </span>
                  ); // Fin de la renderización del eslabón
                })
              ) : ( // Si no hay camino regional
                selectedProvince.name.toUpperCase() // Muestra el nombre de la provincia seleccionada
              )}
            </h2>
          </div>

          {/* Botones de acción del panel inferior: Drill-down a municipios y Gestor de Capas */}
          <div className="flex items-center space-x-2">
            {/* Botón de navegación hacia adentro (Drill-down) a nivel de provincia / municipios */}
            <button
              id="btn-drill-down" // Identificador HTML único del botón de navegación hacia adentro
              onClick={() => { // Manejador de evento para profundizar hacia el nivel provincia
                if (activeMapLevel === 'country' || activeMapLevel === 'pais') { // Si estamos en nivel de país
                  setActiveMapLevel('province'); // Modifica el nivel de mapa activo a Provincia
                  setSelectedSubdivisionId(null); // Resetea subdivisiones
                  if (onNavigateToNode) { // Notifica al motor universal navPath
                    onNavigateToNode({ id: selectedProvince.id, name: selectedProvince.name, type: 'drill_down_provincia' }); // Agrega el nodo de la provincia al historial
                  } // Fin de verificación onNavigateToNode
                } else if (activeMapLevel === 'province') { // Si ya estamos en nivel de provincia
                  setActiveMapLevel('country'); // Regresa al nivel de País
                } // Fin del condicional de nivel
              }} // Fin de onClick
              className="flex items-center space-x-1.5 text-[10px] font-bold border border-emerald-500/50 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 px-2.5 py-1.5 rounded transition-all cursor-pointer shadow-sm" // Estilos Tailwind llamativos y elegantes
              title={activeMapLevel === 'province' ? 'Volver a ver el país completo' : `Ver división municipal de ${selectedProvince.name}`} // Título emergente
            >
              <Navigation size={12} className="text-emerald-400 shrink-0" /> {/* Icono de navegación */}
              <span>
                {activeMapLevel === 'province' ? 'VER PAÍS COMPLETO' : `EXPLORAR ${selectedProvince.abbreviation}`} {/* Texto dinámico del botón */}
              </span>
            </button>

            {/* Botón para desplegar el gestor de capas y herramientas de edición */}
            <button
              onClick={() => setShowManager(!showManager)} // Alterna la visibilidad del gestor
              className={`flex items-center space-x-1.5 text-[10px] font-bold border rounded px-2.5 py-1.5 transition-all cursor-pointer ${
                showManager 
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-emerald-950/20' // Estilo activo
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200' // Estilo inactivo
              }`}
            >
              <Settings size={12} className={showManager ? 'animate-spin' : ''} /> {/* Icono de configuración */}
              <span>GESTOR DE CAPAS</span> {/* Etiqueta del botón de gestor */}
            </button>
            {/* Insignia indicadora de vectores */}
            <span className="text-[10px] bg-slate-950 border border-slate-800 text-slate-500 font-bold px-2 py-1 rounded uppercase">
              Vectores
            </span>
          </div>
        </div>

        {/* Panel Expandible del Gestor de Capas y Vectores */}
        <AnimatePresence>
          {showManager && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden bg-slate-950 border border-slate-850 rounded-lg p-3.5 flex flex-col space-y-3 mb-4 shadow-inner"
            >
              {/* Pestañas (Tabs) */}
              <div className="flex space-x-1 border-b border-slate-900 pb-1.5">
                <button
                  onClick={() => setManagerTab('palette')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    managerTab === 'palette' ? 'bg-slate-900 text-emerald-400 border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  🎨 Pintar & Datos
                </button>
                <button
                  onClick={() => setManagerTab('divisions')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    managerTab === 'divisions' ? 'bg-slate-900 text-emerald-400 border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  📋 Estructura ({selectedProvince.municipalities.length})
                </button>
              </div>

              {/* Contenido Pestaña 2: Pintar y Datos */}
              {managerTab === 'palette' && (
                <div className="flex flex-col space-y-3.5 text-xs text-slate-400">
                  <div className="flex flex-col md:flex-row gap-3.5 items-start md:items-center">
                    <div className="flex flex-col space-y-1 w-full md:w-1/2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Subdivisión Activa</span>
                      <select
                        value={selectedSubdivisionId || ''}
                        onChange={(e) => {
                          const id = e.target.value || null;
                          setSelectedSubdivisionId(id);
                          if (id) {
                            const found = selectedProvince.municipalities.find(m => m.id === id);
                            if (found) {
                              setEditSubName(found.name);
                              setEditSubVal(found.value);
                              setEditSubPct(found.percentage);
                            }
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 text-xs rounded p-2 text-slate-200 focus:outline-none focus:border-slate-700 cursor-pointer"
                      >
                        <option value="">-- Haz clic en el minimapa o selecciona aquí --</option>
                        {selectedProvince.municipalities.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    {selectedSubdivisionId && (
                      <div className="flex flex-col space-y-1 w-full md:w-1/2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Renombrar</span>
                        <input
                          type="text"
                          value={editSubName}
                          onChange={(e) => {
                            setEditSubName(e.target.value);
                            updateMunicipality(selectedSubdivisionId, { name: e.target.value });
                          }}
                          className="w-full bg-slate-900 border border-slate-800 text-xs rounded p-2 text-slate-200 focus:outline-none focus:border-slate-700"
                        />
                      </div>
                    )}
                  </div>

                  {selectedSubdivisionId ? (
                    <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850 flex flex-col space-y-3.5">
                      {/* Metric Indicator Slider */}
                      <div className="flex flex-col space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                          <span>Indicador ({metricLabels[selectedMetric]})</span>
                          <span className="text-emerald-400 font-mono">{editSubVal}%</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={editSubVal}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setEditSubVal(val);
                              updateMunicipality(selectedSubdivisionId, { value: val });
                            }}
                            className="w-full accent-emerald-500 cursor-pointer bg-slate-900 h-1.5 rounded-lg appearance-none"
                          />
                        </div>
                      </div>

                      {/* Representatividad Slider */}
                      <div className="flex flex-col space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                          <span>Representatividad Territorial (%)</span>
                          <span className="text-emerald-400 font-mono">{editSubPct}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          step="1"
                          value={editSubPct}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setEditSubPct(val);
                            updateMunicipality(selectedSubdivisionId, { percentage: val });
                          }}
                          className="w-full accent-emerald-500 cursor-pointer bg-slate-900 h-1.5 rounded-lg appearance-none"
                        />
                      </div>

                      {/* Paleta Interactiva */}
                      <div className="flex flex-col space-y-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Pintar Color de la Capa (Paleta Interactiva)</span>
                        <div className="flex items-center flex-wrap gap-2.5">
                          {customPalette.map(color => (
                            <button
                              key={color.hex}
                              onClick={() => {
                                updateMunicipality(selectedSubdivisionId, { color: color.hex });
                              }}
                              className="w-6 h-6 rounded-full border transition-all hover:scale-115 focus:outline-none cursor-pointer flex items-center justify-center relative"
                              style={{ 
                                backgroundColor: color.hex,
                                borderColor: selectedProvince.municipalities.find(m => m.id === selectedSubdivisionId)?.color === color.hex ? '#ffffff' : '#1e293b'
                              }}
                              title={color.name}
                            >
                              {selectedProvince.municipalities.find(m => m.id === selectedSubdivisionId)?.color === color.hex && (
                                <span className="absolute w-1.5 h-1.5 bg-white rounded-full" />
                              )}
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              updateMunicipality(selectedSubdivisionId, { color: undefined });
                            }}
                            className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 px-2 py-1 rounded cursor-pointer transition-colors"
                          >
                            Reset a Analítico
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-slate-900/30 rounded border border-dashed border-slate-850 text-slate-500">
                      💡 Haz clic en un segmento de la isla/provincia en el minimapa de la izquierda para seleccionarlo y activar las herramientas de pintura y edición live.
                    </div>
                  )}
                </div>
              )}

              {/* Contenido Pestaña 3: Estructura de divisiones */}
              {managerTab === 'divisions' && (
                <div className="flex flex-col space-y-3 text-xs text-slate-400">
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1 bg-slate-900/40 p-2 rounded border border-slate-850">
                    {selectedProvince.municipalities.map((muni) => (
                      <div key={muni.id} className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-900">
                        <div className="flex items-center space-x-2.5">
                          {/* Toggle de Pausa */}
                          <button
                            onClick={() => {
                              updateMunicipality(muni.id, { paused: !muni.paused });
                            }}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              muni.paused 
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-900/40' 
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                            title={muni.paused ? "Reactivar subdivisión" : "Pausar/Desactivar subdivisión"}
                          >
                            {muni.paused ? <Play size={10} /> : <Pause size={10} />}
                          </button>
                          <span className={`font-semibold ${muni.paused ? 'line-through text-slate-600' : 'text-slate-200'}`}>
                            {muni.name}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          {muni.paused && (
                            <span className="text-[8px] bg-amber-950 border border-amber-900/50 text-amber-400 font-bold px-1 py-0.5 rounded uppercase">Pausado</span>
                          )}
                          <span className="font-mono text-emerald-400 text-[11px]">{muni.value}%</span>
                          {/* Botón Eliminar */}
                          <button
                            onClick={() => {
                              if (selectedProvince.municipalities.length <= 1) {
                                alert("No puedes eliminar todas las subdivisiones del mapa. Debe quedar al menos una.");
                                return;
                              }
                              const filtered = selectedProvince.municipalities.filter(m => m.id !== muni.id);
                              updateProvince({ municipalities: filtered });
                              if (selectedSubdivisionId === muni.id) {
                                setSelectedSubdivisionId(null);
                              }
                            }}
                            className="p-1 text-slate-600 hover:text-red-400 rounded transition-colors cursor-pointer"
                            title="Eliminar subdivisión"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      const newId = `muni_${Date.now()}`;
                      const newSub = {
                        id: newId,
                        name: `Nueva Subdivisión #${selectedProvince.municipalities.length + 1}`,
                        value: 45,
                        percentage: 12
                      };
                      updateProvince({ municipalities: [...selectedProvince.municipalities, newSub] });
                      setSelectedSubdivisionId(newId);
                      setEditSubName(newSub.name);
                      setEditSubVal(newSub.value);
                      setEditSubPct(newSub.percentage);
                      setManagerTab('palette');
                    }}
                    className="w-full flex items-center justify-center space-x-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold border border-slate-800 rounded py-2 transition-colors cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Agregar Nueva División</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimapa de municipios/regiones */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* El mini-mapa del municipio en sí */}
          <div className="relative w-full md:w-1/2 h-44 bg-slate-950 rounded border border-slate-800 overflow-hidden flex items-center justify-center p-2">
            {(() => {
              // REGLA ESTRICTA DE ASIGNACIÓN DE VISTAS PARA EL RECUADRO SECUNDARIO (MAPA CHICO ABAJO):
              // 1. Cuando el nivel activo es PAÍS (activeMapLevel === 'country' || 'pais'):
              //    El Mapa Principal muestra Argentina completa.
              //    El Recuadro Chico muestra la provincia seleccionada (selectedProvince).
              // 2. Cuando el nivel activo es PROVINCIA (activeMapLevel !== 'country'):
              //    El Mapa Principal YA muestra la provincia activa en el lienzo grande.
              //    El Recuadro Chico debe buscar los municipios o subdivisiones hijas.
              //    Como aún no existen municipios en la base de datos (array vacío o sin sub-hijos),
              //    el Recuadro Chico DEBE RENDERIZAR EL LIENZO EN BLANCO VACÍO, sin dibujar nada encima.

              const isCountryLevel = activeMapLevel === 'country' || activeMapLevel === 'pais'; // Evalúa si estamos en nivel País
              const activeSubdivisions = (selectedProvince.municipalities || []).filter(m => !m.paused && m.d && m.d.trim().length > 0); // Filtra municipios vectoriales válidos

              // Caso A: Si estamos navegando en Nivel Provincia y no hay municipios sub-hijos cargados en BD
              if (!isCountryLevel && activeSubdivisions.length === 0) { // Si la ruta es Provincia y no hay sub-municipios
                return ( // Devuelve el Lienzo en Blanco Vacío
                  <svg viewBox="0 0 400 250" className="w-full h-full max-h-40 p-2"> {/* SVG limpio del recuadro chico */}
                    <defs> {/* Definiciones de la malla técnica */}
                      <pattern id="mini-blank-grid" width="20" height="20" patternUnits="userSpaceOnUse"> {/* Trama técnica de puntos */}
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(51, 65, 85, 0.2)" strokeWidth="0.5" /> {/* Trazado de rejilla */}
                      </pattern> {/* Fin de patrón */}
                    </defs> {/* Fin de defs */}
                    <rect width="100%" height="100%" fill="url(#mini-blank-grid)" /> {/* Fondo de rejilla técnica */}
                    <g className="pointer-events-none select-none"> {/* Grupo de textos informativos */}
                      <text
                        x="200"
                        y="115"
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="11"
                        fontWeight="bold"
                        className="font-sans"
                      >
                        Lienzo en Blanco (Sin Desglose)
                      </text>
                      <text
                        x="200"
                        y="135"
                        textAnchor="middle"
                        fill="#475569"
                        fontSize="9"
                        className="font-sans"
                      >
                        No existen municipios o subdivisiones cargadas
                      </text>
                    </g>
                  </svg>
                ); // Fin de retorno de Lienzo en Blanco
              } // Fin del condicional de Lienzo en Blanco

              // Caso B: Cuando la ruta es Nivel País o existen sub-polígonos creados
              const bbox = getPathBBox(selectedProvincePath); // Bounding Box del trazado provincial
              const padding = 15; // Margen de holgura
              const viewBoxStr = bbox && bbox.width > 0 && bbox.height > 0 // Generación condicional de ViewBox
                ? `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`
                : "0 0 400 250"; // Fallback seguro
              
              const cx = bbox ? bbox.x + bbox.width / 2 : 200; // Centro relativo X
              const cy = bbox ? bbox.y + bbox.height / 2 : 125; // Centro relativo Y
              const groupTransform = `translate(${miniPanX}, ${miniPanY}) translate(${cx}, ${cy}) scale(${miniScale}) translate(${-cx}, ${-cy})`; // Transformaciones

              return ( // Renderiza el Mapa Secundario con la silueta o sub-municipios
                <svg viewBox={viewBoxStr} className="w-full h-full max-h-40 p-2">
                  {/* Silueta de la provincia seleccionada como guía de fondo cuando estamos en Nivel País */}
                  {selectedProvincePath && (
                    <path
                      d={selectedProvincePath}
                      fill="rgba(16, 185, 129, 0.05)"
                      stroke="rgba(16, 185, 129, 0.25)"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      transform={groupTransform}
                      className="pointer-events-none"
                    />
                  )}

                  {/* Grupo de divisiones de municipios si existen polígonos sub-hijos */}
                  {activeSubdivisions.length > 0 && (
                    <g id="minimap-municipalities-group" transform={groupTransform}>
                      {activeSubdivisions.map((muni) => {
                        const isHovered = hoveredMuni === muni.id;
                        const isSelected = selectedSubdivisionId === muni.id;
                        const color = muni.color || getColorForValue(muni.value, selectedMetric);

                        return (
                          <path
                            key={muni.id}
                            d={muni.d!}
                            fill={color}
                            stroke={isSelected ? '#f59e0b' : 'rgba(30, 41, 59, 0.5)'}
                            strokeWidth={isSelected ? 2 : 1}
                            className="transition-all duration-150 cursor-pointer"
                            onClick={() => {
                              setSelectedSubdivisionId(muni.id);
                              setEditSubName(muni.name);
                              setEditSubVal(muni.value);
                              setEditSubPct(muni.percentage);
                              if (!showManager) setShowManager(true);
                              setManagerTab('palette');
                            }}
                            onMouseEnter={() => setHoveredMuni(muni.id)}
                            onMouseLeave={() => setHoveredMuni(null)}
                            style={{
                              filter: (isHovered || isSelected) ? 'brightness(1.25) drop-shadow(0px 2px 5px rgba(0,0,0,0.4))' : 'none'
                            }}
                          />
                        );
                      })}
                    </g>
                  )}
                </svg>
              );
            })()}

            {/* Floating details inside the minimap */}
            <div className="absolute top-2 left-2 flex flex-col space-y-0.5 bg-slate-900/90 backdrop-blur-md p-1 rounded border border-slate-800 shadow-lg pointer-events-none">
              <span className="text-[8px] text-slate-400 uppercase font-bold">Zonificación</span>
              <div className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[9px] text-slate-300 font-bold">
                  {selectedProvince.municipalities.filter(m => !m.paused).length} Activas
                </span>
              </div>
            </div>

            {/* Hover details over the municipality */}
            <AnimatePresence>
              {hoveredMuni && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute bottom-2 left-2 right-2 bg-slate-950/95 text-slate-100 px-2 py-1 rounded border border-slate-800 text-[10px] pointer-events-none flex justify-between items-center shadow-xl"
                >
                  <span className="font-bold">
                    {selectedProvince.municipalities.find(m => m.id === hoveredMuni)?.name}
                  </span>
                  <span className="font-semibold text-emerald-400">
                    {selectedProvince.municipalities.find(m => m.id === hoveredMuni)?.value}% ({selectedProvince.municipalities.find(m => m.id === hoveredMuni)?.percentage}% representatividad)
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* List of Regions / Municipalities with progress bars */}
          <div className="flex-1 w-full flex flex-col space-y-2 h-44 overflow-y-auto pr-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {activeMapLevel === 'world' || activeMapLevel === 'continent'
                ? `Distribución por Países de ${metricLabels[selectedMetric]}`
                : activeMapLevel === 'country'
                ? `Distribución Provincial de ${metricLabels[selectedMetric]}`
                : `Distribución Regional de ${metricLabels[selectedMetric]}`}
            </span>
            <div className="space-y-2">
              {selectedProvince.municipalities.map((muni) => (
                <div 
                  key={muni.id} 
                  className={`flex flex-col space-y-0.5 transition-opacity duration-200 cursor-pointer p-1 rounded ${
                    selectedSubdivisionId === muni.id ? 'bg-slate-900/50 border border-slate-800' : 'hover:bg-slate-950/30'
                  } ${muni.paused ? 'opacity-30' : 'opacity-100'}`}
                  onClick={() => {
                    setSelectedSubdivisionId(muni.id);
                    setEditSubName(muni.name);
                    setEditSubVal(muni.value);
                    setEditSubPct(muni.percentage);
                    if (!showManager) setShowManager(true);
                    setManagerTab('palette');
                  }}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-1.5">
                      {muni.color && (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: muni.color }} />
                      )}
                      <span className="font-bold text-slate-300">{muni.name}</span>
                      {muni.paused && (
                        <span className="text-[8px] bg-slate-950 border border-slate-800 text-slate-500 px-1 rounded uppercase font-sans">Pausado</span>
                      )}
                    </div>
                    <span className="font-semibold text-slate-400">
                      {muni.value}% <span className="text-[9px] text-slate-500">({muni.percentage}% representatividad)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden border border-slate-900">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(muni.value, 100)}%`,
                        backgroundColor: muni.color || getColorForValue(muni.value, selectedMetric)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}