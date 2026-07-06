
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { provincePaths } from '../data/provincePaths';
import { MetricType, ProvinceData, MunicipalityData } from '../types';
import { mockProvincesData } from '../data/mockData';

// Helper function to calculate Bounding Box of an SVG Path dynamically
function getPathBBox(d: string) {
  const matches = d.match(/[-+]?[0-9]*\.?[0-9]+/g);
  if (!matches || matches.length < 2) {
    return { x: 260, y: -2, width: 440, height: 964 };
  }
  const numbers = matches.map(Number);
  const xCoords: number[] = [];
  const yCoords: number[] = [];
  
  for (let i = 0; i < numbers.length; i += 2) {
    if (i + 1 < numbers.length) {
      xCoords.push(numbers[i]);
      yCoords.push(numbers[i+1]);
    }
  }
  
  if (xCoords.length === 0) {
    return { x: 260, y: -2, width: 440, height: 964 };
  }
  
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

interface InteractiveMapProps {
  selectedProvince: ProvinceData;
  onSelectProvince: (province: ProvinceData) => void;
  onUpdateProvince: (province: ProvinceData) => void;
  selectedMetric: MetricType;
  onChangeMetric: (metric: MetricType) => void;
  activeMapLevel: 'world' | 'continent' | 'country' | 'municipality';
  setActiveMapLevel: (level: 'world' | 'continent' | 'country' | 'municipality') => void;
}

export default function InteractiveMap({
  selectedProvince,
  onSelectProvince,
  onUpdateProvince,
  selectedMetric,
  onChangeMetric,
  activeMapLevel,
  setActiveMapLevel
}: InteractiveMapProps) {
  const [hoveredProv, setHoveredProv] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [hoveredMuni, setHoveredMuni] = useState<string | null>(null);

  // States for Map Layer and Vector Manager
  const [showManager, setShowManager] = useState(false);
  const [managerTab, setManagerTab] = useState<'import' | 'palette' | 'divisions'>('import');
  const [importText, setImportText] = useState('');
  const [selectedSubdivisionId, setSelectedSubdivisionId] = useState<string | null>(null);

  // Input states for editing individual subdivisions
  const [editSubName, setEditSubName] = useState('');
  const [editSubVal, setEditSubVal] = useState(30);
  const [editSubPct, setEditSubPct] = useState(10);

  // Custom transform states for the selected province minimap
  const [miniScale, setMiniScale] = useState(1.0);
  const [miniPanX, setMiniPanX] = useState(0);
  const [miniPanY, setMiniPanY] = useState(0);

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
    const updatedMunis = selectedProvince.municipalities.map(m => {
      if (m.id === muniId) {
        return { ...m, ...changes };
      }
      return m;
    });
    updateProvince({ municipalities: updatedMunis });
  };

  // SVG Paths for the 24 provinces of Argentina (Coordenadas reales integradas)
  // provincePaths has been migrated to src/data/provincePaths.ts

  // Sincronización dinámica de coordenadas de mapas calibradas
  const [calibratedPathsTimestamp, setCalibratedPathsTimestamp] = useState<string>(() => {
    return localStorage.getItem('argentina_paths_last_updated') || '';
  });

  const activeProvincePaths = React.useMemo(() => {
    const saved = localStorage.getItem('argentina_calibrated_map_paths');
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

  useEffect(() => {
    const checkPathsUpdated = () => {
      const ts = localStorage.getItem('argentina_paths_last_updated') || '';
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
        return data.socialEmployment.pobreza;
      case 'desempleo':
        return data.socialEmployment.desempleo;
      case 'gini':
        return data.economicProfile.gini;
      case 'conectividad':
        return data.connectivity.internetAccess[2]?.value || 50;
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
      {/* Selector de Métrica */}
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

      {/* Caja Principal del Mapa SVG */}
      <div id="svg-map-wrapper" className="relative flex-1 min-h-[380px] bg-slate-950 rounded border border-slate-800 overflow-hidden flex items-center justify-center p-4">
        {/* Selector de Nivel de Mapas Desplegable (Súper Pro y Elegante) */}
        <div className="absolute top-4 left-4 z-10 flex flex-col space-y-1.5 bg-slate-900/95 backdrop-blur-md p-3 rounded-lg border border-slate-800 shadow-xl min-w-[180px]">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
            Alcance del Mapa (Vista)
          </span>
          <select
            id="map-level-select"
            value={activeMapLevel}
            onChange={(e) => setActiveMapLevel(e.target.value as any)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold rounded p-1.5 outline-none transition-all focus:border-emerald-500 cursor-pointer text-emerald-400"
          >
            <option value="world">🌎 Mundo</option>
            <option value="continent">🗺️ Continente</option>
            <option value="country">🇦🇷 País (Nación)</option>
            <option value="municipality">📍 Municipio (Zoom)</option>
          </select>
          <div className="flex items-center space-x-1.5 text-[8.5px] text-slate-400 mt-1">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            <span>Ver y calibrar capa</span>
          </div>
        </div>

        {/* Mapa SVG Interactivo */}
        <motion.svg
          id="argentina-svg-map"
          viewBox={
            activeMapLevel === 'world' ? "0 0 1024 512" :
            activeMapLevel === 'continent' ? "0 0 800 1000" :
            activeMapLevel === 'country' ? "260 -2 440 964" :
            (() => {
              const selectedProvincePath = activeProvincePaths.find(p => p.id === selectedProvince.id)?.d || '';
              const bbox = getPathBBox(selectedProvincePath);
              const pad = 20;
              return `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`;
            })()
          }
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
          {/* Fondo Guía del Mapamundi Lineal */}
          {activeMapLevel === 'world' && (
            <image
              href="https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/World_map_blank_black_white.svg/1024px-World_map_blank_black_white.svg.png"
              x="0"
              y="0"
              width="1024"
              height="512"
              opacity="0.3"
              className="pointer-events-none"
            />
          )}

          {/* Fondo Guía Continental (Sudamérica) */}
          {activeMapLevel === 'continent' && (
            <image
              href="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/South_America_blank_map.svg/800px-South_America_blank_map.svg.png"
              x="0"
              y="0"
              width="800"
              height="1000"
              opacity="0.3"
              className="pointer-events-none"
            />
          )}

          {/* Sombra de agua / Mar Argentino en vista País */}
          {activeMapLevel === 'country' && (
            <rect x="260" y="-2" width="440" height="964" fill="transparent" />
          )}

          {/* Capas e items vectoriales según el nivel */}
          {activeMapLevel === 'country' ? (
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
                      const fullData = mockProvincesData[prov.id];
                      if (fullData) onSelectProvince(fullData);
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
            /* En Mundo, Continente o Zoom Municipio: Renderizar las subdivisiones (municipalities) de selectedProvince */
            <g id="subdivisions-group">
              {/* Silueta de la provincia seleccionada como fondo de guía en el nivel municipio */}
              {activeMapLevel === 'municipality' && (
                <path
                  d={activeProvincePaths.find(p => p.id === selectedProvince.id)?.d || ''}
                  fill="rgba(30, 41, 59, 0.1)"
                  stroke="rgba(148, 163, 184, 0.3)"
                  strokeWidth={2}
                  className="pointer-events-none"
                />
              )}

              {selectedProvince.municipalities.map((muni) => {
                if (muni.paused) return null;
                const dPath = muni.d || activeProvincePaths.find(p => p.id === selectedProvince.id)?.d || '';
                const isSelected = selectedSubdivisionId === muni.id;
                const isHovered = hoveredMuni === muni.id;
                const val = muni.value;
                const fillHex = muni.color || getColorForValue(val, selectedMetric);

                return (
                  <path
                    key={muni.id}
                    d={dPath}
                    fill={fillHex}
                    stroke={isSelected ? '#f59e0b' : '#334155'}
                    strokeWidth={isSelected ? 2.5 : 1.2}
                    className="transition-all duration-150 cursor-pointer animate-fade-in"
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
                      filter: isSelected
                        ? 'drop-shadow(0px 0px 8px #f59e0b)'
                        : isHovered
                        ? 'brightness(1.2)'
                        : 'none',
                    }}
                  />
                );
              })}
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
              selectedProvince.municipalities.map((muni) => {
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
                    <foreignObject x={cx - 50} y={cy - 35} width="100" height="30">
                      <div className="flex justify-center">
                        <span className="bg-slate-950 text-[9px] text-amber-400 border border-amber-500/30 font-bold px-1.5 py-0.5 rounded shadow-lg tracking-wider uppercase whitespace-nowrap font-sans">
                          {muni.name}
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
                {selectedProvince.municipalities.find(m => m.id === hoveredMuni)?.name || 'Detalle'}
              </span>
              <span className="text-[10px] text-slate-400">
                {metricLabels[selectedMetric]}:{' '}
                <span className="font-semibold text-amber-400">
                  {selectedProvince.municipalities.find(m => m.id === hoveredMuni)?.value}
                  {selectedMetric === 'gini' ? '' : '%'}
                </span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recuadro de Detalle: Provincia Seleccionada (Minimapa municipios) */}
      <div id="province-municipios-detail" className="bg-slate-900/40 rounded-xl border border-slate-800 p-4 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Detalle: Provincia Seleccionada
            </h4>
            <h2 className="text-xl font-serif italic text-emerald-400 flex items-center mt-0.5">
              <MapPin size={16} className="text-emerald-500 mr-1.5" />
              NACIÓN &gt; {selectedProvince.name.toUpperCase()}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowManager(!showManager)}
              className={`flex items-center space-x-1.5 text-[10px] font-bold border rounded px-2.5 py-1.5 transition-all cursor-pointer ${
                showManager 
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-emerald-950/20' 
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings size={12} className={showManager ? 'animate-spin' : ''} />
              <span>GESTOR DE CAPAS</span>
            </button>
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
                  onClick={() => setManagerTab('import')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    managerTab === 'import' ? 'bg-slate-900 text-emerald-400 border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  📥 Importar & Escalar
                </button>
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

              {/* Contenido Pestaña 1: Importar y Escalar */}
              {managerTab === 'import' && (
                <div className="flex flex-col space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex flex-col space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                        <span>Escala</span>
                        <span className="text-emerald-400">{miniScale.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="10.0"
                        step="0.05"
                        value={miniScale}
                        onChange={(e) => {
                          const s = parseFloat(e.target.value);
                          setMiniScale(s);
                          updateProvince({ mapTransform: { scale: s, panX: miniPanX, panY: miniPanY } });
                        }}
                        className="w-full accent-emerald-500 cursor-pointer bg-slate-900 h-1.5 rounded-lg appearance-none"
                      />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                        <span>Desplazar X</span>
                        <span className="text-emerald-400">{miniPanX}px</span>
                      </div>
                      <input
                        type="range"
                        min="-2000"
                        max="2000"
                        step="1"
                        value={miniPanX}
                        onChange={(e) => {
                          const px = parseInt(e.target.value);
                          setMiniPanX(px);
                          updateProvince({ mapTransform: { scale: miniScale, panX: px, panY: miniPanY } });
                        }}
                        className="w-full accent-emerald-500 cursor-pointer bg-slate-900 h-1.5 rounded-lg appearance-none"
                      />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                        <span>Desplazar Y</span>
                        <span className="text-emerald-400">{miniPanY}px</span>
                      </div>
                      <input
                        type="range"
                        min="-2000"
                        max="2000"
                        step="1"
                        value={miniPanY}
                        onChange={(e) => {
                          const py = parseInt(e.target.value);
                          setMiniPanY(py);
                          updateProvince({ mapTransform: { scale: miniScale, panX: miniPanX, panY: py } });
                        }}
                        className="w-full accent-emerald-500 cursor-pointer bg-slate-900 h-1.5 rounded-lg appearance-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Importar Nuevos Vectores</span>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder='Pega código SVG d="..." o JSON completo: [{"id":"z1","name":"Región A","d":"M..."}]'
                      className="w-full h-16 bg-slate-900 border border-slate-800 rounded p-2 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-slate-700"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <button
                      onClick={() => {
                        if (selectedProvince.id === 'AR-MLV') {
                          setMiniScale(2.2);
                          setMiniPanX(-1218);
                          setMiniPanY(-1715);
                          updateProvince({ mapTransform: { scale: 2.2, panX: -1218, panY: -1715 } });
                        } else {
                          setMiniScale(1.0);
                          setMiniPanX(0);
                          setMiniPanY(0);
                          updateProvince({ mapTransform: { scale: 1.0, panX: 0, panY: 0 } });
                        }
                      }}
                      className="text-[10px] bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded cursor-pointer transition-colors"
                    >
                      Centrado Inicial Preset
                    </button>

                    <button
                      onClick={() => {
                        if (!importText.trim()) return;
                        try {
                          if (importText.trim().startsWith('[')) {
                            // Parse list
                            const parsed = JSON.parse(importText);
                            if (Array.isArray(parsed)) {
                              const valid = parsed.map((item, idx) => ({
                                id: item.id || `muni_${Date.now()}_${idx}`,
                                name: item.name || `Subdivisión ${idx + 1}`,
                                value: item.value !== undefined ? item.value : 35,
                                percentage: item.percentage !== undefined ? item.percentage : 10,
                                d: item.d
                              }));
                              updateProvince({ municipalities: valid });
                              setImportText('');
                              alert("¡Vectores JSON cargados exitosamente!");
                            }
                          } else {
                            // Single raw path
                            if (selectedSubdivisionId) {
                              updateMunicipality(selectedSubdivisionId, { d: importText.trim() });
                              setImportText('');
                              alert("¡Ruta SVG asignada a la subdivisión seleccionada!");
                            } else {
                              // Create new one with the path
                              const newId = `sub_${Date.now()}`;
                              const newSub = {
                                id: newId,
                                name: `Nueva Zona Importada`,
                                value: 40,
                                percentage: 12,
                                d: importText.trim()
                              };
                              updateProvince({ municipalities: [...selectedProvince.municipalities, newSub] });
                              setSelectedSubdivisionId(newId);
                              setImportText('');
                              alert("¡Nueva subdivisión creada con el vector SVG proporcionado!");
                            }
                          }
                        } catch (err) {
                          alert("Error al importar: Asegúrate de que el formato sea un JSON válido o una ruta SVG 'd' válida.");
                        }
                      }}
                      className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-1.5 rounded cursor-pointer transition-colors"
                    >
                      Procesar & Aplicar
                    </button>
                  </div>
                </div>
              )}

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
              const selectedProvincePath = activeProvincePaths.find(p => p.id === selectedProvince.id)?.d || '';
              const bbox = getPathBBox(selectedProvincePath);
              const padding = 15;
              const viewBoxStr = `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`;
              
              // Centro de la caja para transformaciones relativas
              const cx = bbox.x + bbox.width / 2;
              const cy = bbox.y + bbox.height / 2;
              
              // Aplicar pan y escala manual si el usuario los ajusta en el panel
              const groupTransform = `translate(${miniPanX}, ${miniPanY}) translate(${cx}, ${cy}) scale(${miniScale}) translate(${-cx}, ${-cy})`;

              return (
                <svg viewBox={viewBoxStr} className="w-full h-full max-h-40 p-2">
                  {/* Silueta de la provincia seleccionada como guía de fondo (Elegante y precisa) */}
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

                  {/* Grupo de divisiones de municipios */}
                  <g id="minimap-municipalities-group" transform={groupTransform}>
                    {selectedProvince.municipalities.map((muni, idx) => {
                      if (muni.paused) return null; // Saltar renderizado si está pausado

                      // Si no tiene d de subdivisión específico, hereda el path real completo de la provincia seleccionada
                      // ¡De esta forma, las formas feas y cuadradas desaparecen por completo y siempre se ve hermoso!
                      const dPath = muni.d || selectedProvincePath;

                      const isHovered = hoveredMuni === muni.id;
                      const isSelected = selectedSubdivisionId === muni.id;
                      
                      // Color de relleno (color personalizado o según la métrica)
                      const color = muni.color || getColorForValue(muni.value, selectedMetric);

                      return (
                        <path
                          key={muni.id}
                          d={dPath}
                          fill={color}
                          stroke={isSelected ? '#f59e0b' : 'rgba(30, 41, 59, 0.5)'}
                          strokeWidth={isSelected ? 2 : 1}
                          className="transition-all duration-150 cursor-pointer"
                          onClick={() => {
                            setSelectedSubdivisionId(muni.id);
                            setEditSubName(muni.name);
                            setEditSubVal(muni.value);
                            setEditSubPct(muni.percentage);
                            // Abrir pestaña de paleta al hacer clic
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
              Distribución Regional de {metricLabels[selectedMetric]}
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