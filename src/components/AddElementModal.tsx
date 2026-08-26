/**
 * @file AddElementModal.tsx
 * @description Modal profesional e interactivo para agregar nuevos elementos, territorios faltantes
 * (como Islas Malvinas, Sector Antártico), partes anatómicas del cuerpo humano o trazados SVG personalizados
 * al mapa actual sin reemplazar ni perder ninguna de las piezas existentes, con auto-centrado visual perfecto,
 * herramientas de retoque geométrico (escala, rotación, espejo, centrado) y carga flexible desde cualquier medio.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MapPin, 
  Activity, 
  Shapes, 
  Code, 
  Upload, 
  Sparkles, 
  Check, 
  X, 
  ShieldCheck, 
  AlertCircle, 
  Layers,
  ArrowRight,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut,
  Target,
  RefreshCw,
  ClipboardPaste,
  Grid,
  Sun,
  Moon,
  Info,
  Maximize2
} from 'lucide-react';
import { VectorPathItem } from '../types';
import { ALL_PRESETS, TERRITORY_PRESETS, ANATOMY_PRESETS, GEOMETRIC_PRESETS, PresetVectorElement } from '../data/vectorPresets';
import { provincePaths } from '../data/provincePaths';
import { 
  calculateSvgPathBounds, 
  transformSvgPathD, 
  centerSvgPathTo, 
  extractPathDataFromText,
  PathBounds
} from '../utils/svgPathTransform';

// Propiedades recibidas por el componente AddElementModal
interface AddElementModalProps {
  isOpen: boolean; // Controla la visibilidad del modal
  onClose: () => void; // Función para cerrar el modal
  existingPaths: VectorPathItem[]; // Lista de trazados vectoriales actualmente presentes en el mapa
  onAddPath: (newPath: VectorPathItem, options?: { autoSelect?: boolean; focus?: boolean }) => void; // Callback para agregar el nuevo trazado
  onAddMultiplePaths?: (newPaths: VectorPathItem[]) => void; // Callback opcional para agregar múltiples trazados a la vez
  currentContextName?: string; // Nombre contextual del mapa actual
}

// Tipo para las pestañas de categorías disponibles
type TabType = 'territorios' | 'anatomia' | 'geometricos' | 'svg_custom';

// Tipo de fondo para el visor de vista previa
type PreviewBackgroundMode = 'dark' | 'grid' | 'light';

/**
 * COMPONENTE AUXILIAR: VISOR VECTORIAL AUTO-AJUSTADO Y AUTO-CENTRADO
 * Calcula dinámicamente el Bounding Box de las coordenadas 'd' para que cualquier figura
 * (isla, órgano, silueta o territorio) se vea nítida y perfectamente centrada sin importar su posición absoluta.
 */
export const AutoFitSvgViewer: React.FC<{
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
  paddingRatio?: number;
}> = ({
  d,
  fill = '#10b981',
  stroke = '#0f172a',
  strokeWidth = 1.0,
  className = 'w-full h-full',
  paddingRatio = 0.15
}) => {
  // Calcula el Bounding Box y viewBox adaptativo
  const bounds = useMemo(() => {
    return calculateSvgPathBounds(d, paddingRatio);
  }, [d, paddingRatio]);

  if (!d || !d.trim()) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs italic">
        Sin trazado
      </div>
    );
  }

  return (
    <svg
      viewBox={bounds.viewBox}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={d}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const AddElementModal: React.FC<AddElementModalProps> = ({
  isOpen,
  onClose,
  existingPaths,
  onAddPath,
  onAddMultiplePaths,
  currentContextName = 'Mapa Actual'
}) => {
  // Pestaña activa
  const [activeTab, setActiveTab] = useState<TabType>('territorios');
  
  // Búsqueda de elementos en presets
  const [searchQuery, setSearchQuery] = useState('');
  
  // Elemento predefinido seleccionado actualmente
  const [selectedPreset, setSelectedPreset] = useState<PresetVectorElement | null>(TERRITORY_PRESETS[0]);
  
  // Datos del formulario para el nuevo elemento
  const [customName, setCustomName] = useState(TERRITORY_PRESETS[0].name);
  const [customId, setCustomId] = useState(TERRITORY_PRESETS[0].id);
  const [customCategory, setCustomCategory] = useState<string>('provincia');
  const [customFillColor, setCustomFillColor] = useState<string>('#10b981');
  const [customStrokeColor, setCustomStrokeColor] = useState<string>('#0f172a');
  const [customStrokeWidth, setCustomStrokeWidth] = useState<number>(1.0);
  const [customSvgD, setCustomSvgD] = useState<string>(TERRITORY_PRESETS[0].d);
  
  // Trazado original de respaldo para permitir restaurar retoques
  const [originalSvgD, setOriginalSvgD] = useState<string>(TERRITORY_PRESETS[0].d);

  // Modo de fondo para la vista previa (cuadrícula, oscuro, claro)
  const [bgMode, setBgMode] = useState<PreviewBackgroundMode>('grid');

  // Estado para subida o parseo de archivo SVG/JSON manual
  const [fileError, setFileError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Muestra editor manual desplegable de coordenadas 'd'
  const [showManualEditor, setShowManualEditor] = useState<boolean>(false);

  // 1. ANÁLISIS INTELIGENTE DE TERRITORIOS FALTANTES:
  // Compara la lista de provincias y territorios oficiales de Argentina con los trazados actuales en el mapa
  const missingOfficialTerritories = useMemo(() => {
    const existingIds = new Set<string>(existingPaths.map(p => (p.id || '').toUpperCase()));
    const existingNames = new Set<string>(existingPaths.map(p => (p.name || '').toLowerCase().trim()));

    const missingList: { id: string; name: string; d: string; isMalvinas?: boolean }[] = [];

    // Revisa si Islas Malvinas está presente
    const hasMalvinas = existingIds.has('AR-MLV') || 
      Array.from(existingNames).some((n: string) => n.includes('malvinas') || n.includes('falkland'));

    if (!hasMalvinas) {
      const malvinasData = provincePaths.find(p => p.id === 'AR-MLV');
      if (malvinasData) {
        missingList.push({
          id: malvinasData.id,
          name: malvinasData.name,
          d: malvinasData.d,
          isMalvinas: true
        });
      }
    }

    // Revisa las demás provincias oficiales de Argentina
    provincePaths.forEach(prov => {
      if (prov.id === 'AR-MLV') return; // Ya evaluado arriba
      const isPresent = existingIds.has(prov.id.toUpperCase()) || 
        Array.from(existingNames).some((n: string) => n.includes(prov.name.toLowerCase().trim()));
      
      if (!isPresent) {
        missingList.push({
          id: prov.id,
          name: prov.name,
          d: prov.d
        });
      }
    });

    return missingList;
  }, [existingPaths]);

  // Límites y métricas en vivo del trazado actual
  const currentBounds: PathBounds = useMemo(() => {
    return calculateSvgPathBounds(customSvgD, 0.12);
  }, [customSvgD]);

  // Manejador al seleccionar un preset predefinido
  const handleSelectPreset = (preset: PresetVectorElement) => {
    setSelectedPreset(preset);
    setCustomName(preset.name);
    setCustomId(`${preset.id}_${Date.now().toString(36).substring(4)}`);
    setCustomCategory(preset.category);
    setCustomFillColor(preset.defaultFill || '#10b981');
    setCustomStrokeColor(preset.defaultStroke || '#0f172a');
    setCustomStrokeWidth(preset.defaultStrokeWidth ?? 1.0);
    setCustomSvgD(preset.d);
    setOriginalSvgD(preset.d);
    setFileError(null);
    setSuccessMessage(`Silueta "${preset.name}" seleccionada.`);
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  // Manejador para procesar archivo SVG o JSON subido por el usuario
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) throw new Error("El archivo seleccionado está vacío.");

        const extracted = extractPathDataFromText(content);
        if (extracted && extracted.d) {
          setCustomSvgD(extracted.d);
          setOriginalSvgD(extracted.d);
          if (extracted.name) {
            setCustomName(extracted.name);
          } else {
            setCustomName(file.name.replace(/\.[^/.]+$/, ""));
          }
          setCustomId(`IMPORT_${Date.now().toString(36)}`);
          setSuccessMessage(`¡Silueta importada exitosamente desde ${file.name}!`);
          setTimeout(() => setSuccessMessage(null), 3000);
        } else {
          throw new Error("No se pudo extraer ninguna coordenada o etiqueta <path d='...'> del archivo.");
        }
      } catch (err: any) {
        setFileError(err?.message || "Error al procesar el archivo vectorial.");
      }
    };

    reader.readAsText(file);
  };

  // Manejador para pegar directamente desde el portapapeles
  const handlePasteFromClipboard = async () => {
    try {
      setFileError(null);
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setFileError("El portapapeles está vacío. Copia primero un SVG o coordenadas 'd'.");
        return;
      }

      const extracted = extractPathDataFromText(text);
      if (extracted && extracted.d) {
        setCustomSvgD(extracted.d);
        setOriginalSvgD(extracted.d);
        if (extracted.name) setCustomName(extracted.name);
        setSuccessMessage("¡Trazado pegado con éxito desde el portapapeles!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setFileError("El texto en el portapapeles no contiene un trazado SVG ('d') válido.");
      }
    } catch (err) {
      setFileError("No se pudo acceder al portapapeles. Pega el código manualmente en el campo de texto.");
    }
  };

  // =========================================================================
  // RETOQUES GEOMÉTRICOS Y TRANSFORMACIONES EN VIVO
  // =========================================================================
  
  // Escalar figura (+20% o -20%)
  const handleApplyScale = (factor: number) => {
    const transformed = transformSvgPathD(customSvgD, { scale: factor });
    setCustomSvgD(transformed);
    setSuccessMessage(`Escala ajustada a ${(factor * 100).toFixed(0)}%`);
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // Rotar figura (+90° o -90°)
  const handleApplyRotate = (deg: number) => {
    const transformed = transformSvgPathD(customSvgD, { rotateDeg: deg });
    setCustomSvgD(transformed);
    setSuccessMessage(`Rotado ${deg > 0 ? `+${deg}°` : `${deg}°`}`);
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // Voltear horizontalmente (Flip X)
  const handleApplyFlipX = () => {
    const transformed = transformSvgPathD(customSvgD, { flipX: true });
    setCustomSvgD(transformed);
    setSuccessMessage("Invertido Horizontalmente (Flip X)");
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // Voltear verticalmente (Flip Y)
  const handleApplyFlipY = () => {
    const transformed = transformSvgPathD(customSvgD, { flipY: true });
    setCustomSvgD(transformed);
    setSuccessMessage("Invertido Verticalmente (Flip Y)");
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // Centrar silueta en el origen estándar del mapa
  const handleApplyCenter = () => {
    const centered = centerSvgPathTo(customSvgD, 400, 500);
    setCustomSvgD(centered);
    setSuccessMessage("Silueta centrada en el lienzo (X: 400, Y: 500)");
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // Restaurar trazado original descartando retoques
  const handleRestoreOriginal = () => {
    if (originalSvgD) {
      setCustomSvgD(originalSvgD);
      setSuccessMessage("Trazado original restaurado.");
      setTimeout(() => setSuccessMessage(null), 2000);
    }
  };

  // Manejador para enviar y agregar el elemento al mapa
  const handleConfirmAdd = () => {
    if (!customSvgD.trim()) {
      setFileError("Por favor proporciona un trazado vectorial válido ('d').");
      return;
    }

    const cleanName = customName.trim() || 'Nuevo Elemento';
    const finalId = customId.trim() || `ELEM_${Date.now()}`;

    // Estructura completa del nuevo elemento VectorPathItem
    const newItem: VectorPathItem = {
      id: finalId,
      name: cleanName,
      d: customSvgD.trim(),
      category: customCategory,
      fill: customFillColor,
      stroke: customStrokeColor,
      strokeWidth: customStrokeWidth,
      visualStyles: {
        fillColor: customFillColor,
        strokeColor: customStrokeColor,
        strokeWidth: customStrokeWidth
      },
      customData: {
        fill: customFillColor,
        stroke: customStrokeColor,
        strokeWidth: customStrokeWidth,
        valor: 50,
        porcentaje: 20,
        agregadoEn: new Date().toISOString(),
        tipoOrigen: selectedPreset ? selectedPreset.category : 'personalizado'
      }
    };

    // Agrega el elemento mediante la función callback
    onAddPath(newItem, { autoSelect: true, focus: true });
    onClose();
  };

  // Manejador para restaurar un territorio faltante en un solo clic rápido
  const handleQuickRestore = (terr: { id: string; name: string; d: string }) => {
    const newItem: VectorPathItem = {
      id: terr.id,
      name: terr.name,
      d: terr.d,
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
        restaurado: true,
        fechaRestauracion: new Date().toISOString()
      }
    };

    onAddPath(newItem, { autoSelect: true, focus: true });
    onClose();
  };

  // Filtro de presets según búsqueda y pestaña (Se ejecuta SIEMPRE para cumplir las reglas de React Hooks)
  const filteredPresets = useMemo(() => {
    let list: PresetVectorElement[] = [];
    if (activeTab === 'territorios') list = TERRITORY_PRESETS;
    else if (activeTab === 'anatomia') list = ANATOMY_PRESETS;
    else if (activeTab === 'geometricos') list = GEOMETRIC_PRESETS;
    else list = ALL_PRESETS;

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      (item.tags && item.tags.some(t => t.toLowerCase().includes(q)))
    );
  }, [activeTab, searchQuery]);

  // Si el modal no está abierto, no renderiza el DOM (después de ejecutar todos los Hooks)
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* CABECERA DEL MODAL */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Plus size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <span>Agregar Nuevo Elemento al Mapa</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  SUMA ADITIVA PURA
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Incorpora islas, miembros anatómicos, siluetas o trazados SVG sin reemplazar nada de lo existente.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </div>

        {/* BANNER DE DETECCIÓN INTELIGENTE DE TERRITORIOS FALTANTES (EJ: ISLAS MALVINAS) */}
        {missingOfficialTerritories.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-950/80 via-teal-950/70 to-slate-950 border-b border-emerald-500/30 p-3 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center space-x-2.5">
              <Sparkles size={18} className="text-emerald-400 shrink-0 animate-pulse mt-0.5 sm:mt-0" />
              <div>
                <p className="text-xs font-black text-emerald-300">
                  {missingOfficialTerritories.some(t => t.isMalvinas)
                    ? '🇦🇷 ¡Atención! El mapa no tiene el trazado de las "Islas Malvinas".'
                    : `🗺️ Hay ${missingOfficialTerritories.length} territorio(s) oficial(es) no detectados en este mapa.`}
                </p>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">
                  Puedes restaurar la pieza con sus coordenadas oficiales exactas en un solo clic.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {missingOfficialTerritories.find(t => t.isMalvinas) && (
                <button
                  type="button"
                  onClick={() => {
                    const malv = missingOfficialTerritories.find(t => t.isMalvinas);
                    if (malv) handleQuickRestore(malv);
                  }}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-emerald-950/50 hover:scale-105"
                >
                  <Check size={14} className="stroke-[3]" />
                  <span>Restaurar Islas Malvinas</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* NAVEGACIÓN POR PESTAÑAS */}
        <div className="bg-slate-950 border-b border-slate-800 px-4 pt-3 flex items-center space-x-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('territorios');
              if (TERRITORY_PRESETS.length > 0) handleSelectPreset(TERRITORY_PRESETS[0]);
            }}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition-all flex items-center space-x-2 border-t border-x cursor-pointer ${
              activeTab === 'territorios'
                ? 'bg-slate-900 text-emerald-400 border-slate-800 border-b-slate-900 -mb-px shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <MapPin size={14} className={activeTab === 'territorios' ? 'text-emerald-400' : 'text-slate-400'} />
            <span>Territorios Oficiales ({TERRITORY_PRESETS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('anatomia');
              if (ANATOMY_PRESETS.length > 0) handleSelectPreset(ANATOMY_PRESETS[0]);
            }}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition-all flex items-center space-x-2 border-t border-x cursor-pointer ${
              activeTab === 'anatomia'
                ? 'bg-slate-900 text-rose-400 border-slate-800 border-b-slate-900 -mb-px shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <Activity size={14} className={activeTab === 'anatomia' ? 'text-rose-400' : 'text-slate-400'} />
            <span>Cuerpo Humano / Órganos ({ANATOMY_PRESETS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('geometricos');
              if (GEOMETRIC_PRESETS.length > 0) handleSelectPreset(GEOMETRIC_PRESETS[0]);
            }}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition-all flex items-center space-x-2 border-t border-x cursor-pointer ${
              activeTab === 'geometricos'
                ? 'bg-slate-900 text-sky-400 border-slate-800 border-b-slate-900 -mb-px shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <Shapes size={14} className={activeTab === 'geometricos' ? 'text-sky-400' : 'text-slate-400'} />
            <span>Formas & Figuras ({GEOMETRIC_PRESETS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('svg_custom');
              setSelectedPreset(null);
            }}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition-all flex items-center space-x-2 border-t border-x cursor-pointer ${
              activeTab === 'svg_custom'
                ? 'bg-slate-900 text-purple-400 border-slate-800 border-b-slate-900 -mb-px shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <Code size={14} className={activeTab === 'svg_custom' ? 'text-purple-400' : 'text-slate-400'} />
            <span>Pegar SVG / Subir Archivo</span>
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL EN 2 COLUMNAS (SELECTOR A LA IZQUIERDA + RETOQUES Y PREVIEW A LA DERECHA) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 p-4 sm:p-5 gap-5">
          
          {/* COLUMNA IZQUIERDA: LISTA Y BUSCADOR DE PRESETS O SUBIDA */}
          <div className="lg:col-span-5 space-y-3 flex flex-col">
            
            {activeTab !== 'svg_custom' ? (
              <>
                {/* Buscador */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar figura (ej: Malvinas, Brazo, Corazón)..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-100 placeholder:text-slate-500 outline-none font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Lista de elementos predefinidos con miniaturas vectoriales auto-centradas */}
                <div className="flex-1 max-h-[440px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                  {filteredPresets.map(preset => {
                    const isSelected = selectedPreset?.id === preset.id;
                    const isAlreadyInMap = existingPaths.some(p => p.id.toUpperCase() === preset.id.toUpperCase());

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`w-full p-2.5 rounded-2xl border text-left flex items-start justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/60 shadow-md shadow-emerald-950/40 scale-[1.01]'
                            : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800/90 text-slate-300'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          {/* Miniatura visual del SVG auto-centrada con Bounding Box automático */}
                          <div className="w-12 h-12 rounded-xl bg-slate-900/90 border border-slate-800 p-1 flex items-center justify-center shrink-0 shadow-inner">
                            <AutoFitSvgViewer
                              d={preset.d}
                              fill={isSelected ? '#10b981' : (preset.defaultFill || '#38bdf8')}
                              stroke={isSelected ? '#0f172a' : (preset.defaultStroke || '#0f172a')}
                              strokeWidth={1.5}
                              className="w-full h-full"
                            />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className={`text-xs font-bold ${isSelected ? 'text-emerald-300' : 'text-slate-200'}`}>
                                {preset.name}
                              </h4>
                              {isAlreadyInMap && (
                                <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                                  En Mapa
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                              {preset.description}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                            <Check size={12} className="stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {filteredPresets.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800 border-dashed">
                      No se encontraron elementos coincidentes con "{searchQuery}".
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* PESTAÑA DE SUBIDA Y PEGADO LIBRE DE SVG / JSON */
              <div className="space-y-4">
                
                {/* Botón Pegar desde Portapapeles en 1 Clic */}
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="w-full py-2.5 px-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-sm"
                >
                  <ClipboardPaste size={16} />
                  <span>📋 Pegar desde Portapapeles (SVG o Código 'd')</span>
                </button>

                {/* Zona de Subida de Archivo .SVG o .JSON */}
                <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-[10px] font-black uppercase text-purple-400 tracking-wider flex items-center space-x-1">
                    <Upload size={12} />
                    <span>Cargar desde Archivo (.SVG o .JSON)</span>
                  </label>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-purple-500/40 hover:border-purple-400 bg-slate-900/60 p-5 rounded-xl cursor-pointer transition-all">
                    <Upload size={22} className="text-purple-400 mb-1" />
                    <span className="text-xs font-bold text-slate-200">Seleccionar o Arrastrar Archivo</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Soporta coordenadas 'd', etiquetas &lt;path&gt; y GeoJSON</span>
                    <input type="file" accept=".svg,.json" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                {/* Entrada de Código Manual */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                    O escribe/pega el trazado SVG (string 'd'):
                  </label>
                  <textarea
                    value={customSvgD}
                    onChange={(e) => {
                      setCustomSvgD(e.target.value);
                      setOriginalSvgD(e.target.value);
                    }}
                    placeholder="M 100 100 L 200 100 L 150 200 Z"
                    rows={6}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl p-2.5 text-[10px] font-mono text-slate-200 outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* Mensajes de Feedback / Errores */}
            {fileError && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle size={14} className="shrink-0 text-rose-400" />
                <span>{fileError}</span>
              </div>
            )}
            {successMessage && (
              <div className="p-2 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn">
                <Sparkles size={14} className="shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

          </div>

          {/* COLUMNA DERECHA: PROPIEDADES, RETOQUES Y VISOR DE VISTA PREVIA PROFESIONAL */}
          <div className="lg:col-span-7 space-y-4 flex flex-col pl-0 lg:pl-2">
            
            {/* Cabecera del Panel Derecho */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center space-x-1.5">
                <Sparkles size={14} className="text-emerald-400" />
                <span>Silueta & Retoques Vectoriales</span>
              </h3>

              {/* Botón rápido para pegar desde portapapeles o cambiar silueta */}
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                  title="Pegar otra silueta desde el portapapeles"
                >
                  <ClipboardPaste size={11} />
                  <span>Pegar</span>
                </button>
                <label className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1">
                  <Upload size={11} />
                  <span>Cargar</span>
                  <input type="file" accept=".svg,.json" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* VISOR DE VISTA PREVIA AUTO-AJUSTADO CON CONTROLES */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                <span>VISTA PREVIA DEL TRAZADO (AUTO-CENTRADO):</span>
                <div className="flex items-center space-x-1">
                  {/* Selector de Fondo del Visor */}
                  <button
                    type="button"
                    onClick={() => setBgMode('grid')}
                    className={`p-1 rounded cursor-pointer transition-colors ${bgMode === 'grid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Fondo de cuadrícula milimétrica"
                  >
                    <Grid size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgMode('dark')}
                    className={`p-1 rounded cursor-pointer transition-colors ${bgMode === 'dark' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Fondo oscuro"
                  >
                    <Moon size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgMode('light')}
                    className={`p-1 rounded cursor-pointer transition-colors ${bgMode === 'light' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Fondo claro (alto contraste)"
                  >
                    <Sun size={12} />
                  </button>
                </div>
              </div>

              {/* Caja del Canvas de Previsualización */}
              <div 
                className={`w-full h-44 rounded-2xl border border-slate-800 p-3 flex items-center justify-center relative overflow-hidden transition-all shadow-inner ${
                  bgMode === 'grid'
                    ? 'bg-slate-950 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:12px_12px]'
                    : bgMode === 'dark'
                    ? 'bg-slate-950'
                    : 'bg-slate-200'
                }`}
              >
                {customSvgD ? (
                  <AutoFitSvgViewer
                    d={customSvgD}
                    fill={customFillColor}
                    stroke={customStrokeColor}
                    strokeWidth={customStrokeWidth * 1.5}
                    className="w-full h-full max-h-40 drop-shadow-md"
                    paddingRatio={0.15}
                  />
                ) : (
                  <span className="text-xs text-slate-600 italic">Sin trazado definido</span>
                )}

                {/* Badge con dimensiones reales en vivo */}
                <div className="absolute bottom-2 left-2.5 px-2 py-0.5 bg-slate-900/90 border border-slate-800/90 rounded-md text-[9px] font-mono text-slate-300 flex items-center space-x-2 backdrop-blur-xs">
                  <span>📐 {currentBounds.width} × {currentBounds.height} px</span>
                  <span className="text-slate-600">•</span>
                  <span>{currentBounds.pointCount} vértices</span>
                </div>

                <span className="absolute bottom-2 right-2.5 text-[9px] text-slate-400 font-mono font-bold bg-slate-900/80 px-2 py-0.5 rounded">
                  {customName || 'Vista Previa'}
                </span>
              </div>
            </div>

            {/* BARRA DE HERRAMIENTAS DE RETOQUES VECTORIALES (ESCALAR, ROTAR, ESPEJAR, CENTRAR) */}
            <div className="p-2.5 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                <span className="flex items-center space-x-1">
                  <Sparkles size={11} className="text-emerald-400" />
                  <span>Retoques y Ajustes Previos:</span>
                </span>
                <button
                  type="button"
                  onClick={handleRestoreOriginal}
                  className="text-amber-400 hover:text-amber-300 transition-colors flex items-center space-x-1 cursor-pointer font-bold"
                  title="Descartar retoques y restaurar el trazado original"
                >
                  <RefreshCw size={10} />
                  <span>Restaurar Original</span>
                </button>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-[10px] font-bold">
                {/* Escala -20% */}
                <button
                  type="button"
                  onClick={() => handleApplyScale(0.8)}
                  className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-all cursor-pointer flex items-center justify-center space-x-1"
                  title="Reducir tamaño (-20%)"
                >
                  <ZoomOut size={11} />
                  <span>-20%</span>
                </button>

                {/* Escala +20% */}
                <button
                  type="button"
                  onClick={() => handleApplyScale(1.2)}
                  className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-all cursor-pointer flex items-center justify-center space-x-1"
                  title="Aumentar tamaño (+20%)"
                >
                  <ZoomIn size={11} />
                  <span>+20%</span>
                </button>

                {/* Rotar -90° */}
                <button
                  type="button"
                  onClick={() => handleApplyRotate(-90)}
                  className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-all cursor-pointer flex items-center justify-center space-x-1"
                  title="Girar 90° a la izquierda (antihorario)"
                >
                  <RotateCcw size={11} />
                  <span>-90°</span>
                </button>

                {/* Rotar +90° */}
                <button
                  type="button"
                  onClick={() => handleApplyRotate(90)}
                  className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-all cursor-pointer flex items-center justify-center space-x-1"
                  title="Girar 90° a la derecha (horario)"
                >
                  <RotateCw size={11} />
                  <span>+90°</span>
                </button>

                {/* Voltear Horizontal */}
                <button
                  type="button"
                  onClick={handleApplyFlipX}
                  className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-all cursor-pointer flex items-center justify-center space-x-1"
                  title="Espejo horizontal (Flip X)"
                >
                  <FlipHorizontal size={11} />
                  <span>Espejo X</span>
                </button>

                {/* Voltear Vertical */}
                <button
                  type="button"
                  onClick={handleApplyFlipY}
                  className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-all cursor-pointer flex items-center justify-center space-x-1"
                  title="Espejo vertical (Flip Y)"
                >
                  <FlipVertical size={11} />
                  <span>Espejo Y</span>
                </button>

                {/* Centrar en Lienzo */}
                <button
                  type="button"
                  onClick={handleApplyCenter}
                  className="py-1 px-1.5 bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 rounded-lg border border-emerald-700/60 transition-all cursor-pointer flex items-center justify-center space-x-1 col-span-2 sm:col-span-1"
                  title="Centrar en el lienzo (X: 400, Y: 500)"
                >
                  <Target size={11} />
                  <span>Centrar</span>
                </button>
              </div>
            </div>

            {/* FORMULARIO DE PROPIEDADES (NOMBRE, ID, CATEGORÍA, COLOR) */}
            <div className="space-y-3">
              
              {/* Nombre y Texto Identificativo */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Nombre Identificativo:
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="ej: Islas Malvinas, Brazo Izquierdo, Región Nueva"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-2.5 text-xs font-bold text-slate-100 outline-none"
                />
              </div>

              {/* ID y Categoría */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                    ID Único del Trazado:
                  </label>
                  <input
                    type="text"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                    placeholder="ej: AR-MLV"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-2 text-xs font-mono text-slate-200 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                    Categoría:
                  </label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-2 text-xs font-bold text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="provincia">🗺️ Provincia / Territorio</option>
                    <option value="isla">🏝️ Isla / Archipiélago</option>
                    <option value="anatomia">🫀 Anatomía / Miembro</option>
                    <option value="organo">🩸 Órgano / Sistema</option>
                    <option value="geometrico">📐 Geometría / Parcela</option>
                    <option value="custom">✏️ Capa Personalizada</option>
                  </select>
                </div>
              </div>

              {/* Color de Relleno y Paleta Rápida */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Color de Relleno:
                  </label>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">{customFillColor}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={customFillColor}
                    onChange={(e) => setCustomFillColor(e.target.value)}
                    className="w-8 h-8 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer p-0.5 shrink-0"
                  />
                  <div className="flex-1 grid grid-cols-7 gap-1">
                    {['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCustomFillColor(c)}
                        style={{ backgroundColor: c }}
                        className={`h-6 rounded-lg border transition-transform cursor-pointer ${
                          customFillColor === c ? 'scale-110 border-white shadow-md' : 'border-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* PIE DEL MODAL CON BOTONES DE ACCIÓN */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-400 text-xs">
            <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">
              Modo Aditivo Seguro: Se conservan todos los {existingPaths.length} elementos existentes intactos.
            </span>
            <span className="sm:hidden">{existingPaths.length} elementos seguros</span>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmAdd}
              disabled={!customSvgD.trim()}
              className="py-2.5 px-6 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 disabled:opacity-40 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-2 shadow-lg shadow-emerald-950/60 hover:scale-105 active:scale-95"
            >
              <Plus size={16} className="stroke-[3]" />
              <span>Agregar al Mapa</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
