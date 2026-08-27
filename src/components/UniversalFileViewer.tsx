// ============================================================================
// COMPONENTE UNIVERSAL DE EXPLORADOR DE ARCHIVOS Y PROYECTOS (ESTILO GOOGLE DRIVE DARK MODE)
// ============================================================================
// Proporciona:
// 1. Vista de cuadrícula responsiva (Grid: 2 a 6 columnas) inspirada en Google Drive en Dark Theme estricto
// 2. Modelo de datos abstracto y unificado (UniversalFileItem) compatible con Google Drive, Base de Datos y Disco Local
// 3. Miniaturas inteligentes (thumbnails): previsualizaciones vectoriales SVG, imágenes, enlaces Drive o iconos por extensión
// 4. Migas de pan (Breadcrumbs) interactivas y estilizadas para navegación de rutas y carpetas
// 5. Filtrado por tipo, búsqueda en tiempo real y vista en lista o cuadrícula
// 6. Aislamiento total: Solo maneja presentación visual y eventos onClick / onSelect
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Folder,
  FileText,
  FileCode,
  Image as ImageIcon,
  FileSpreadsheet,
  Database,
  Cloud,
  HardDrive,
  ExternalLink,
  Trash2,
  Download,
  Search,
  Grid,
  List as ListIcon,
  ChevronRight,
  Home,
  CheckCircle2,
  Layers,
  Clock,
  HardDriveDownload,
  Info
} from 'lucide-react';
import { getMultiplePathsBBox } from '../lib/mapUtils'; // Cálculo de Bounding Box para encuadre SVG automático
import { extractPathsFromPayload, ExtractedMapPath } from './MapVisualComparisonPreview'; // Extractor vectorial de proyectos

// ============================================================================
// 1. MODELO DE DATOS UNIFICADO (UniversalFileItem)
// ============================================================================

// Tipos de archivos o entidades soportadas
export type UniversalFileType = 'folder' | 'file' | 'image' | 'pdf' | 'json' | 'map' | 'spreadsheet';

// Origen de los datos
export type UniversalFileSource = 'drive' | 'local' | 'db';

// Interfaz universal para representar cualquier archivo o carpeta independientemente de su procedencia
export interface UniversalFileItem {
  id: string; // Identificador único (ID de Drive, ID de Base de Datos o nombre de archivo local)
  name: string; // Nombre visible del archivo o carpeta
  type: UniversalFileType; // Tipo de elemento
  source: UniversalFileSource; // Procedencia: 'drive' | 'local' | 'db'
  size?: number | string; // Tamaño en bytes o texto formateado
  updatedAt?: string; // Fecha de última modificación (ISO string o legible)
  thumbnailUrl?: string; // URL opcional de miniatura (Drive thumbnailLink, URL.createObjectURL local o imagen en base64)
  svgThumbnailPreview?: string; // Trazado o SVG inline opcional para mapas vectoriales
  extractedPaths?: ExtractedMapPath[]; // Trazados vectoriales precalculados para renderizado de miniatura
  description?: string; // Descripción opcional o categoría
  webViewLink?: string; // Enlace externo directo a Google Drive u otro visor
  originalPayload?: any; // Payload original completo para carga directa
  isCurrentActive?: boolean; // Marca si es el proyecto que está abierto actualmente en el lienzo
  subdivisionCount?: number; // Cantidad de municipios/subdivisiones si es un mapa
}

// Interfaz para las migas de pan (Breadcrumb items)
export interface BreadcrumbPathItem {
  id: string; // ID del nivel o carpeta
  name: string; // Nombre visible (ej: "Inicio", "Proyectos Catastrales", "Mapas 2026")
  icon?: React.ReactNode; // Icono opcional
}

// Propiedades recibidas por el componente UniversalFileViewer
export interface UniversalFileViewerProps {
  items: UniversalFileItem[]; // Lista unificada de archivos y carpetas
  onSelectItem: (item: UniversalFileItem) => void; // Callback al hacer clic / seleccionar un elemento
  onDeleteItem?: (item: UniversalFileItem, e: React.MouseEvent) => void; // Callback opcional para eliminar
  onDownloadItem?: (item: UniversalFileItem, e: React.MouseEvent) => void; // Callback opcional para descargar
  breadcrumbs?: BreadcrumbPathItem[]; // Ruta de navegación de carpetas
  onBreadcrumbClick?: (crumb: BreadcrumbPathItem, index: number) => void; // Navegación por migas de pan
  isLoading?: boolean; // Indicador de carga
  emptyMessage?: string; // Mensaje cuando no hay elementos
  title?: string; // Título opcional del panel o visor
  activeSource?: UniversalFileSource | 'all'; // Filtro de procedencia activo
  searchPlaceholder?: string; // Placeholder del buscador
}

// ============================================================================
// 2. COMPONENTE PRINCIPAL: UniversalFileViewer
// ============================================================================

const defaultBreadcrumbs: BreadcrumbPathItem[] = [{ id: 'root', name: 'Inicio' }];

export const UniversalFileViewer: React.FC<UniversalFileViewerProps> = ({
  items,
  onSelectItem,
  onDeleteItem,
  onDownloadItem,
  breadcrumbs = defaultBreadcrumbs,
  onBreadcrumbClick,
  isLoading = false,
  emptyMessage = 'No se encontraron archivos en esta ubicación.',
  title,
  activeSource = 'all',
  searchPlaceholder = 'Buscar archivos y proyectos...'
}) => {
  // Estado local para búsqueda en tiempo real
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Estado local para alternar entre vista Cuadrícula (Grid) y Lista (List)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Filtro secundario por tipo de archivo
  const [typeFilter, setTypeFilter] = useState<'all' | UniversalFileType>('all');

  // Filtrado de elementos
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filtro por texto de búsqueda
      const matchSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

      // Filtro por tipo
      const matchType = typeFilter === 'all' || item.type === typeFilter;

      return matchSearch && matchType;
    });
  }, [items, searchTerm, typeFilter]);

  // Renderizador de insignia de procedencia (Source Badge)
  const renderSourceBadge = (source: UniversalFileSource) => {
    switch (source) {
      case 'drive':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
            <Cloud size={10} className="text-amber-400" />
            <span>Google Drive</span>
          </span>
        );
      case 'db':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
            <Database size={10} className="text-emerald-400" />
            <span>Base de Datos</span>
          </span>
        );
      case 'local':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[9px] font-bold">
            <HardDrive size={10} className="text-purple-400" />
            <span>Disco Local</span>
          </span>
        );
    }
  };

// Subcomponente especializado para renderizar miniaturas vectoriales de mapas en alta definición
const MapVectorCardThumbnail: React.FC<{ item: UniversalFileItem }> = ({ item }) => {
  // Extrae y memoiza los trazados desde extractedPaths, originalPayload o svgThumbnailPreview
  const { paths, count } = useMemo(() => {
    // 1. Si ya vienen pre-extraídos
    if (item.extractedPaths && item.extractedPaths.length > 0) {
      return { paths: item.extractedPaths, count: item.extractedPaths.length };
    }
    // 2. Si viene el payload completo del proyecto
    if (item.originalPayload) {
      const extracted = extractPathsFromPayload(item.originalPayload);
      if (extracted && extracted.paths && extracted.paths.length > 0) {
        return { paths: extracted.paths, count: extracted.paths.length };
      }
    }
    // 3. Si viene una ruta SVG única de previsualización
    if (item.svgThumbnailPreview) {
      return {
        paths: [{ id: 'p0', name: item.name, d: item.svgThumbnailPreview, fill: '#38bdf8' }],
        count: 1
      };
    }
    return { paths: [], count: 0 };
  }, [item.extractedPaths, item.originalPayload, item.svgThumbnailPreview, item.name]);

  // Calcula el viewBox adaptado automáticamente a las dimensiones reales de los polígonos
  const viewBox = useMemo(() => {
    if (!paths || paths.length === 0) return '0 0 1000 1000';
    const bbox = getMultiplePathsBBox(paths, { x: 0, y: 0, width: 1000, height: 1000 });
    const paddingX = Math.max(12, bbox.width * 0.05);
    const paddingY = Math.max(12, bbox.height * 0.05);
    const vx = bbox.x - paddingX;
    const vy = bbox.y - paddingY;
    const vw = Math.max(1, bbox.width + paddingX * 2);
    const vh = Math.max(1, bbox.height + paddingY * 2);
    return `${vx} ${vy} ${vw} ${vh}`;
  }, [paths]);

  // Paleta armónica de colores pasteles para diferenciar polígonos / países / provincias (estilo visual auténtico)
  const MAP_PALETTE = [
    '#fde047', '#86efac', '#fed7aa', '#f472b6', '#7dd3fc',
    '#c4b5fd', '#fca5a5', '#99f6e4', '#fdba74', '#a7f3d0',
    '#fbcfe8', '#cbd5e1', '#e9d5ff', '#bbf7d0', '#bae6fd'
  ];

  // Si no hay trazados vectoriales, fallback limpio al icono .JSON MAP clásico
  if (paths.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-sky-500/5 group-hover:bg-sky-500/10 transition-colors">
        <div className="p-2.5 rounded-xl bg-sky-950/60 border border-sky-500/20 text-sky-400">
          <FileCode size={28} />
        </div>
        <span className="text-[9px] font-mono text-sky-400/80 font-bold mt-1 uppercase">.JSON MAP</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#060911] flex items-center justify-center p-2 select-none">
      {/* Rejilla decorativa de fondo blueprint / mapa */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(56, 189, 248, 0.4) 1px, transparent 1px)`,
          backgroundSize: '10px 10px'
        }}
      />

      {/* Renderizado vectorial SVG del mapa completo con polígonos coloreados */}
      <svg
        viewBox={viewBox}
        className="w-full h-full max-h-24 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] transition-transform duration-300 group-hover:scale-105"
      >
        {paths.map((p, idx) => {
          const color = p.fill || MAP_PALETTE[idx % MAP_PALETTE.length];
          return (
            <path
              key={p.id || idx}
              d={p.d}
              fill={color}
              fillOpacity={0.78}
              stroke="#0f172a"
              strokeWidth={0.75}
              strokeLinejoin="round"
            >
              <title>{p.name || `Porción ${idx + 1}`}</title>
            </path>
          );
        })}
      </svg>

      {/* Insignia .JSON MAP con icono de código en la esquina superior derecha (conservado tal como solicitó el usuario) */}
      <div className="absolute top-1.5 right-1.5 bg-slate-950/90 backdrop-blur-xs border border-sky-500/30 text-sky-300 font-mono text-[8.5px] font-bold px-1.5 py-0.5 rounded-md flex items-center space-x-1 shadow-sm pointer-events-none">
        <FileCode size={10} className="text-sky-400" />
        <span>.JSON MAP</span>
      </div>

      {/* Contador de porciones/polígonos en esquina inferior izquierda */}
      <div className="absolute bottom-1.5 left-1.5 bg-slate-950/90 backdrop-blur-xs border border-slate-800 text-slate-300 font-mono text-[8.5px] px-1.5 py-0.5 rounded-md flex items-center space-x-1 shadow-xs pointer-events-none">
        <Layers size={9} className="text-sky-400" />
        <span><strong>{count}</strong> {count === 1 ? 'polígono' : 'polígonos'}</span>
      </div>
    </div>
  );
};

  // Renderizador del icono o miniatura visual
  const renderThumbnail = (item: UniversalFileItem) => {
    // 1. Si es una carpeta (Folder)
    if (item.type === 'folder') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors">
          <Folder size={38} className="text-amber-400 fill-amber-500/20 stroke-[1.5]" />
        </div>
      );
    }

    // 2. Si tiene URL de miniatura (imagen, Google Drive thumbnail o preview generado)
    if (item.thumbnailUrl) {
      return (
        <div className="w-full h-full relative overflow-hidden bg-slate-950 flex items-center justify-center">
          <img
            src={item.thumbnailUrl}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // Si falla la imagen, ocultamos el tag img y mostramos el fallback
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      );
    }

    // 3. Si es un mapa o archivo JSON con datos vectoriales, renderizamos la miniatura vectorial gráfica
    if (item.type === 'map' || item.type === 'json' || item.originalPayload || item.svgThumbnailPreview || item.extractedPaths) {
      return <MapVectorCardThumbnail item={item} />;
    }

    // 4. Fallback temático según extensión/tipo con iconografía moderna
    switch (item.type) {
      case 'image':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-rose-500/5 group-hover:bg-rose-500/10 transition-colors">
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/20 text-rose-400">
              <ImageIcon size={28} />
            </div>
            <span className="text-[9px] font-mono text-rose-400/80 font-bold mt-1 uppercase">IMAGEN</span>
          </div>
        );
      case 'spreadsheet':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors">
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/20 text-emerald-400">
              <FileSpreadsheet size={28} />
            </div>
            <span className="text-[9px] font-mono text-emerald-400/80 font-bold mt-1 uppercase">TABLA</span>
          </div>
        );
      default:
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/40 group-hover:bg-slate-800/70 transition-colors">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400">
              <FileText size={28} />
            </div>
            <span className="text-[9px] font-mono text-slate-500 font-bold mt-1 uppercase">DOCUMENTO</span>
          </div>
        );
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4 text-slate-200">
      
      {/* ===================================================================== */}
      {/* BARRA SUPERIOR: MIGAS DE PAN (BREADCRUMBS) + CONTROLES DE VISTA       */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
        
        {/* Migas de Pan (Breadcrumbs) Estilo Dark Mode */}
        <nav aria-label="Migas de pan" className="flex items-center space-x-1 overflow-x-auto py-0.5 text-xs font-semibold">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb.id || idx} className="flex items-center space-x-1 shrink-0">
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => onBreadcrumbClick && onBreadcrumbClick(crumb, idx)}
                  className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg transition-colors ${
                    isLast
                      ? 'bg-sky-500/10 text-sky-300 font-bold border border-sky-500/30 cursor-default'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer'
                  }`}
                >
                  {idx === 0 ? <Home size={13} className="text-sky-400" /> : null}
                  {crumb.icon && <span>{crumb.icon}</span>}
                  <span className="truncate max-w-[140px]">{crumb.name}</span>
                </button>
                {!isLast && <ChevronRight size={13} className="text-slate-600 shrink-0" />}
              </div>
            );
          })}
        </nav>

        {/* Controles de Vista y Filtros */}
        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
          {/* Alternador Grid / Lista */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista en Cuadrícula (Google Drive Grid)"
            >
              <Grid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-xs transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista en Lista Detallada"
            >
              <ListIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BARRA DE BÚSQUEDA Y FILTRADO POR TIPO                                  */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Buscador interactivo */}
        <div className="relative w-full sm:flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Contador de elementos */}
        <div className="text-[11px] text-slate-400 px-1 shrink-0">
          Mostrando <strong>{filteredItems.length}</strong> de {items.length} elementos
        </div>
      </div>

      {/* ===================================================================== */}
      {/* CONTENEDOR PRINCIPAL: ESTADO DE CARGA / VACÍO / GRID / LIST           */}
      {/* ===================================================================== */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-950/50 flex flex-col items-center justify-center space-y-3 animate-fade-in">
          <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Cargando elementos del explorador...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 space-y-3">
          <Folder size={32} className="mx-auto text-slate-600 stroke-1" />
          <p className="text-xs text-slate-300 font-semibold">{emptyMessage}</p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-sky-400 hover:underline cursor-pointer"
            >
              Limpiar búsqueda "{searchTerm}"
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* =================================================================== */
        /* VISTA EN CUADRÍCULA (GRID ESTILO GOOGLE DRIVE DARK MODE)             */
        /* =================================================================== */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
          {filteredItems.map((item) => {
            const isFolder = item.type === 'folder';

            return (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={`group relative flex flex-col rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl ${
                  item.isCurrentActive
                    ? 'bg-sky-950/40 border-sky-500/60 shadow-sky-950/50 ring-1 ring-sky-500/40'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850 hover:-translate-y-0.5'
                }`}
              >
                {/* 1. Recuadro de Miniatura / Thumbnail Superior */}
                <div className="h-28 w-full border-b border-slate-800/80 relative overflow-hidden bg-slate-950/40 flex items-center justify-center">
                  {renderThumbnail(item)}

                  {/* Badge de Activo o Estado */}
                  {item.isCurrentActive && (
                    <div className="absolute top-2 left-2 bg-sky-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded shadow flex items-center space-x-1">
                      <CheckCircle2 size={10} />
                      <span>ABIERTO</span>
                    </div>
                  )}

                  {/* Botones de acción flotantes en hover */}
                  <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/80 backdrop-blur-sm p-1 rounded-lg border border-slate-800">
                    {item.webViewLink && (
                      <a
                        href={item.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Ver en Google Drive"
                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {onDownloadItem && (
                      <button
                        type="button"
                        onClick={(e) => onDownloadItem(item, e)}
                        title="Descargar archivo"
                        className="p-1 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded transition"
                      >
                        <Download size={12} />
                      </button>
                    )}
                    {onDeleteItem && (
                      <button
                        type="button"
                        onClick={(e) => onDeleteItem(item, e)}
                        title="Eliminar"
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Sección de Información Inferior */}
                <div className="p-2.5 flex flex-col justify-between flex-1 space-y-1.5 bg-slate-900/60">
                  <div className="flex items-start space-x-1.5">
                    <div className="shrink-0 mt-0.5">
                      {isFolder ? (
                        <Folder size={14} className="text-amber-400 fill-amber-500/20" />
                      ) : (
                        <FileCode size={14} className="text-sky-400" />
                      )}
                    </div>
                    <h4
                      className="text-xs font-bold text-slate-200 group-hover:text-sky-300 transition-colors line-clamp-2 leading-tight"
                      title={item.name}
                    >
                      {item.name}
                    </h4>
                  </div>

                  {/* Metadatos: Origen y Fecha */}
                  <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                    <div className="truncate max-w-[80px]">
                      {renderSourceBadge(item.source)}
                    </div>
                    {item.updatedAt && (
                      <span className="text-slate-400 text-[10px] truncate">
                        {typeof item.updatedAt === 'string' && item.updatedAt.includes('T')
                          ? new Date(item.updatedAt).toLocaleDateString()
                          : item.updatedAt}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* =================================================================== */
        /* VISTA EN LISTA DETALLADA                                             */
        /* =================================================================== */
        <div className="flex flex-col space-y-1.5 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 divide-y divide-slate-850">
          {filteredItems.map((item) => {
            const isFolder = item.type === 'folder';

            return (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={`p-2.5 sm:px-4 flex items-center justify-between gap-3 cursor-pointer transition group ${
                  item.isCurrentActive
                    ? 'bg-sky-950/30 border-l-2 border-sky-500'
                    : 'hover:bg-slate-900/90'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                    {isFolder ? (
                      <Folder size={16} className="text-amber-400 fill-amber-500/20" />
                    ) : (
                      <FileCode size={16} className="text-sky-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-sky-300 transition truncate">
                        {item.name}
                      </h4>
                      {item.isCurrentActive && (
                        <span className="bg-sky-500/20 text-sky-400 text-[9px] font-black px-1.5 py-0.2 rounded border border-sky-500/40 shrink-0">
                          ACTIVO
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-slate-400 truncate">{item.description}</p>
                    )}
                  </div>
                </div>

                {/* Columna de Metadatos */}
                <div className="hidden md:flex items-center space-x-4 text-xs text-slate-400 shrink-0">
                  {renderSourceBadge(item.source)}
                  {item.updatedAt && (
                    <span className="flex items-center space-x-1 text-[11px]">
                      <Clock size={11} />
                      <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                    </span>
                  )}
                  {item.size && (
                    <span className="text-[11px] font-mono">
                      {typeof item.size === 'number'
                        ? `${(item.size / 1024).toFixed(1)} KB`
                        : item.size}
                    </span>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  {item.webViewLink && (
                    <a
                      href={item.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Ver en Google Drive"
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  {onDownloadItem && (
                    <button
                      type="button"
                      onClick={(e) => onDownloadItem(item, e)}
                      title="Descargar archivo"
                      className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded-lg transition"
                    >
                      <Download size={13} />
                    </button>
                  )}
                  {onDeleteItem && (
                    <button
                      type="button"
                      onClick={(e) => onDeleteItem(item, e)}
                      title="Eliminar"
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
