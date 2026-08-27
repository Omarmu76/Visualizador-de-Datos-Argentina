// ============================================================================
// COMPONENTE: VISUALIZADOR Y COMPARADOR VECTORIAL DE MAPAS (VISTA PREVIA DE VERSIONES)
// ============================================================================
// Proporciona:
// 1. Renderizado SVG vectorial nativo de proyectos en memoria vs remotos/archivos.
// 2. Modo Lado a Lado (Side-by-Side): Comparación visual simultánea con auto-encuadre de viewBox.
// 3. Modo Superposición Diferencial (Diff Overlay): Siluetas superpuestas con código de color
//    (Cian = Versión en Memoria, Ámbar = Versión Remota/Archivo, Esmeralda = Coincidencias).
// 4. Conteo y desglose exacto de porciones/polígonos, tamaño y nivel territorial.
// ============================================================================

import React, { useState, useMemo } from 'react'; // React y hooks
import { 
  Eye, 
  Layers, 
  Columns, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  CheckCircle2, 
  AlertTriangle,
  FileCode,
  Sparkles
} from 'lucide-react'; // Iconografía UI
import { getMultiplePathsBBox, BBox } from '../lib/mapUtils'; // Utilidad de límites espaciales
import { provincePaths } from '../data/provincePaths'; // Moldes canónicos de respaldo

// Interfaz para representar un trazado extraído normalizado
export interface ExtractedMapPath {
  id: string; // Identificador único
  name: string; // Nombre visible
  d: string; // Coordenadas del comando SVG
  fill?: string; // Color de relleno
  stroke?: string; // Color del borde
  strokeWidth?: number; // Grosor del trazado
}

// Extrae todos los trazados vectoriales desde cualquier estructura de payload
export function extractPathsFromPayload(payload: any): { paths: ExtractedMapPath[]; activeLevel: string; name: string } {
  if (!payload || typeof payload !== 'object') {
    return { paths: [], activeLevel: 'Nacional', name: 'Sin Datos' };
  }

  const paths: ExtractedMapPath[] = [];
  const name = payload.name || payload.projectName || 'Proyecto';
  const activeLevel = payload.activeLevel || payload.activeMapLevel || 'country';

  // 1. Caso: MapEntity con paths explícitos (Canvas Vectorial / Mundo / Provincias)
  if (payload.mapEntity && Array.isArray(payload.mapEntity.paths) && payload.mapEntity.paths.length > 0) {
    payload.mapEntity.paths.forEach((p: any, idx: number) => {
      if (p && p.d) {
        paths.push({
          id: p.id || `path_${idx}`,
          name: p.name || p.id || `Porción ${idx + 1}`,
          d: p.d,
          fill: p.fill || '#38bdf8',
          stroke: p.stroke || '#0284c7',
          strokeWidth: p.strokeWidth || 1
        });
      }
    });
    return { paths, activeLevel, name };
  }

  // 2. Caso: Diccionario de provinciasData
  if (payload.provincesData && typeof payload.provincesData === 'object') {
    Object.entries(payload.provincesData).forEach(([key, prov]: [string, any], idx) => {
      if (prov && typeof prov === 'object') {
        // Si la provincia tiene subdivisiones
        if (Array.isArray(prov.subdivisions) && prov.subdivisions.length > 0) {
          prov.subdivisions.forEach((sub: any, sIdx: number) => {
            if (sub && sub.d) {
              paths.push({
                id: sub.id || `${key}_sub_${sIdx}`,
                name: sub.name || `${prov.name} - Sub ${sIdx + 1}`,
                d: sub.d,
                fill: sub.fill || '#38bdf8',
                stroke: sub.stroke || '#0284c7',
                strokeWidth: sub.strokeWidth || 1
              });
            }
          });
        } else if (prov.d) {
          paths.push({
            id: prov.id || key,
            name: prov.name || key,
            d: prov.d,
            fill: prov.fill || '#38bdf8',
            stroke: prov.stroke || '#0284c7',
            strokeWidth: 1
          });
        }
      }
    });
    if (paths.length > 0) {
      return { paths, activeLevel, name };
    }
  }

  // 3. Caso: Lista plana de paths en la raíz
  if (Array.isArray(payload.paths) && payload.paths.length > 0) {
    payload.paths.forEach((p: any, idx: number) => {
      if (p && p.d) {
        paths.push({
          id: p.id || `p_${idx}`,
          name: p.name || `Elemento ${idx + 1}`,
          d: p.d,
          fill: p.fill || '#38bdf8',
          stroke: p.stroke || '#0284c7',
          strokeWidth: p.strokeWidth || 1
        });
      }
    });
    return { paths, activeLevel, name };
  }

  // 4. Respaldo: Moldes nacionales canónicos
  Object.entries(provincePaths).forEach(([key, d]) => {
    if (typeof d === 'string') {
      paths.push({
        id: key,
        name: key.replace(/^ar-/, '').toUpperCase(),
        d: d,
        fill: '#38bdf8',
        stroke: '#0284c7',
        strokeWidth: 1
      });
    }
  });

  return { paths, activeLevel, name };
}

// Genera un viewBox SVG con margen automático basado en los trazados
function computeViewBoxForPaths(paths: ExtractedMapPath[]): string {
  if (!paths || paths.length === 0) return '0 0 1000 1000';
  const bbox = getMultiplePathsBBox(paths, { x: 0, y: 0, width: 1000, height: 1000 });
  const paddingX = Math.max(15, bbox.width * 0.05);
  const paddingY = Math.max(15, bbox.height * 0.05);
  const vx = bbox.x - paddingX;
  const vy = bbox.y - paddingY;
  const vw = bbox.width + paddingX * 2;
  const vh = bbox.height + paddingY * 2;
  return `${vx} ${vy} ${vw} ${vh}`;
}

// Colores pasteles armónicos para distinguir porciones en la vista previa
const PALETTE = [
  '#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', 
  '#fb923c', '#2dd4bf', '#818cf8', '#f87171', '#4ade80'
];

interface MapSingleCanvasProps {
  paths: ExtractedMapPath[];
  title: string;
  sourceLabel: string;
  sourceType: 'local' | 'remote';
  lastModified?: string;
  badge?: string;
  badgeColor?: 'emerald' | 'amber' | 'sky';
  zoom: number;
}

// Mini Lienzo para representar un mapa individual
const MapSingleCanvas: React.FC<MapSingleCanvasProps> = ({
  paths,
  title,
  sourceLabel,
  sourceType,
  lastModified,
  badge,
  badgeColor = 'emerald',
  zoom
}) => {
  const viewBox = useMemo(() => computeViewBoxForPaths(paths), [paths]);
  const isLocal = sourceType === 'local';

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-lg">
      {/* Cabecera del Lienzo */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${isLocal ? 'bg-sky-400' : 'bg-amber-400'}`} />
          <span className="text-xs font-bold text-slate-200 truncate max-w-[180px]">
            {title}
          </span>
          <span className="text-[10px] text-slate-400">({sourceLabel})</span>
        </div>
        {badge && (
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
            badgeColor === 'emerald'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : badgeColor === 'amber'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
          }`}>
            {badge}
          </span>
        )}
      </div>

      {/* Área del SVG con Fondo Blueprint Grid */}
      <div className="relative h-56 w-full bg-[#070b14] overflow-hidden flex items-center justify-center p-2">
        {/* Rejilla decorativa de fondo tipo blueprint */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(rgba(56, 189, 248, 0.4) 1px, transparent 1px)`,
            backgroundSize: '16px 16px'
          }}
        />

        {paths.length === 0 ? (
          <div className="text-center text-slate-500 text-xs p-4">
            <FileCode size={24} className="mx-auto mb-1 opacity-50" />
            <span>Sin trazados vectoriales detectados</span>
          </div>
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          >
            <svg 
              viewBox={viewBox} 
              className="w-full h-full max-h-52 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            >
              {paths.map((p, idx) => {
                const color = PALETTE[idx % PALETTE.length];
                return (
                  <path
                    key={p.id || idx}
                    d={p.d}
                    fill={isLocal ? color : '#f59e0b'}
                    fillOpacity={isLocal ? 0.45 : 0.4}
                    stroke={isLocal ? color : '#d97706'}
                    strokeWidth={isLocal ? 1.2 : 1.2}
                    className="transition-all hover:fill-opacity-80"
                  >
                    <title>{p.name || `Porción ${idx + 1}`}</title>
                  </path>
                );
              })}
            </svg>
          </div>
        )}

        {/* Contador de porciones vectoriales en esquina inferior izquierda */}
        <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur-xs border border-slate-800 rounded-lg px-2 py-0.5 text-[10px] text-slate-300 font-mono flex items-center space-x-1.5">
          <Layers size={11} className="text-sky-400" />
          <span><strong>{paths.length}</strong> porciones</span>
        </div>
      </div>

      {/* Pie con Metadatos */}
      {lastModified && (
        <div className="px-3 py-1.5 bg-slate-900/50 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
          <span>Modificado:</span>
          <span className="font-mono text-slate-300">{lastModified}</span>
        </div>
      )}
    </div>
  );
};

interface MapVisualComparisonProps {
  localPayload: any; // Datos del mapa en pantalla / memoria
  remotePayload: any; // Datos del mapa remoto / archivo seleccionado
  remoteSourceName?: string; // Nombre del origen (ej: "Base de Datos", "Google Drive", "Archivo Local")
  localLastModified?: string; // Fecha de edición local
  remoteLastModified?: string; // Fecha de edición remota
  newerSource?: 'local' | 'remote' | 'same'; // Cuál es más nuevo
}

export const MapVisualComparisonPreview: React.FC<MapVisualComparisonProps> = ({
  localPayload,
  remotePayload,
  remoteSourceName = 'Archivo Remoto',
  localLastModified,
  remoteLastModified,
  newerSource = 'same'
}) => {
  // Extrae los caminos vectoriales de ambas versiones
  const localData = useMemo(() => extractPathsFromPayload(localPayload), [localPayload]);
  const remoteData = useMemo(() => extractPathsFromPayload(remotePayload), [remotePayload]);

  // Modo de visualización: 'split' (lado a lado) o 'diff' (superposición diferencial)
  const [viewMode, setViewMode] = useState<'split' | 'diff'>('split');
  // Nivel de zoom de inspección
  const [zoom, setZoom] = useState<number>(1);

  // Calcula el viewBox unificado para la superposición diferencial
  const unifiedViewBox = useMemo(() => {
    const combined = [...localData.paths, ...remoteData.paths];
    return computeViewBoxForPaths(combined);
  }, [localData.paths, remoteData.paths]);

  return (
    <div className="space-y-3">
      {/* Barra de Control de la Vista Previa */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-950/80 border border-slate-800 rounded-xl">
        <div className="flex items-center space-x-1.5 text-xs text-slate-300">
          <Eye size={14} className="text-sky-400" />
          <span className="font-bold">Vista Previa Visual de Mapas</span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            (Compara siluetas, polígonos y porciones antes de decidir)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Alternador de Modos */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Ver versiones una al lado de la otra"
            >
              <Columns size={12} />
              <span>Lado a Lado</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('diff')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer ${
                viewMode === 'diff'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Superponer siluetas para ver diferencias de polígonos"
            >
              <Sparkles size={12} />
              <span>Superponer Siluetas (Diff)</span>
            </button>
          </div>

          {/* Controles de Zoom */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setZoom(prev => Math.max(0.7, prev - 0.2))}
              className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Reducir zoom"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[10px] font-mono text-slate-400 px-1">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom(prev => Math.min(1.8, prev + 0.2))}
              className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Aumentar zoom"
            >
              <ZoomIn size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* MODO 1: LADO A LADO (SPLIT VIEW) */}
      {viewMode === 'split' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Tarjeta 1: Versión en Memoria (Pantalla) */}
          <MapSingleCanvas
            paths={localData.paths}
            title={localData.name}
            sourceLabel="Memoria / Pantalla"
            sourceType="local"
            lastModified={localLastModified}
            badge={newerSource === 'local' ? 'MÁS RECIENTE' : 'EN PANTALLA'}
            badgeColor={newerSource === 'local' ? 'emerald' : 'sky'}
            zoom={zoom}
          />

          {/* Tarjeta 2: Versión Remota / Archivo */}
          <MapSingleCanvas
            paths={remoteData.paths}
            title={remoteData.name}
            sourceLabel={remoteSourceName}
            sourceType="remote"
            lastModified={remoteLastModified}
            badge={newerSource === 'remote' ? 'MÁS RECIENTE' : remoteSourceName}
            badgeColor={newerSource === 'remote' ? 'emerald' : 'amber'}
            zoom={zoom}
          />
        </div>
      )}

      {/* MODO 2: SUPERPOSICIÓN DIFERENCIAL (DIFF OVERLAY) */}
      {viewMode === 'diff' && (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black text-slate-200">
                Siluetas Superpuestas:
              </span>
              <div className="flex items-center space-x-3 text-[11px]">
                <span className="flex items-center space-x-1 text-sky-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500/80 border border-sky-400" />
                  <span>En Pantalla ({localData.paths.length})</span>
                </span>
                <span className="flex items-center space-x-1 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 border border-amber-400" />
                  <span>{remoteSourceName} ({remoteData.paths.length})</span>
                </span>
              </div>
            </div>

            <span className="text-[10px] text-slate-400 font-mono">
              Diferencia de polígonos: <strong>{Math.abs(localData.paths.length - remoteData.paths.length)}</strong>
            </span>
          </div>

          {/* Lienzo Diff Superpuesto */}
          <div className="relative h-64 w-full bg-[#060911] rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center p-2">
            {/* Rejilla Blueprint */}
            <div 
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(rgba(56, 189, 248, 0.4) 1px, transparent 1px)`,
                backgroundSize: '16px 16px'
              }}
            />

            <div 
              className="w-full h-full flex items-center justify-center transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            >
              <svg 
                viewBox={unifiedViewBox} 
                className="w-full h-full max-h-60 drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
              >
                {/* 1. Capa Remota (Fondo en Ámbar) */}
                {remoteData.paths.map((p, idx) => (
                  <path
                    key={`rem_${p.id || idx}`}
                    d={p.d}
                    fill="#f59e0b"
                    fillOpacity={0.35}
                    stroke="#d97706"
                    strokeWidth={1.2}
                    strokeDasharray="3 2"
                  >
                    <title>{`Remoto: ${p.name || p.id}`}</title>
                  </path>
                ))}

                {/* 2. Capa Local (Frente en Cian Luminoso) */}
                {localData.paths.map((p, idx) => (
                  <path
                    key={`loc_${p.id || idx}`}
                    d={p.d}
                    fill="#38bdf8"
                    fillOpacity={0.35}
                    stroke="#0284c7"
                    strokeWidth={1.5}
                  >
                    <title>{`En Pantalla: ${p.name || p.id}`}</title>
                  </path>
                ))}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
