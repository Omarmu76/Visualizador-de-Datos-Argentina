// src/components/MapSafetyConfirmModal.tsx
// Modal de Confirmación y Advertencia de Seguridad Previa con Gráficos SVG y Diagnóstico Visual de Cambios
// Evita la sobreescritura accidental de territorios (ej: sobreescribir Tierra del Fuego con Islas Malvinas).

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, X, PlusCircle, ShieldAlert, Palette, Eye, Sparkles } from 'lucide-react';
import { getPathBBox } from '../lib/mapUtils';
import { isPathMatchingMalvinas, isPathMatchingTierraDelFuego } from '../utils/mapRecovery';
import { VectorPathItem } from '../types';

export interface MapSafetyConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Datos del territorio actualmente seleccionado que se vería afectado
  targetId: string;
  targetName: string;
  targetCurrentD: string;
  targetPaths?: VectorPathItem[]; // Lista opcional de objetos vectoriales previos con sus colores reales
  // Datos de la nueva silueta o figura propuesta para inyectar
  proposedD: string;
  proposedName?: string;
  proposedPaths?: VectorPathItem[]; // Lista opcional de objetos vectoriales resultantes con sus colores reales
  // Origen o tipo de operación
  operationType?: 'silhouette_mutation' | 'save_map' | 'associate_map';
  // Callbacks de acción
  onConfirmReplace: () => void;
  onConfirmAsIndependent?: () => void; // Para agregar como territorio separado (ej: agregar Malvinas sin tocar Tierra del Fuego)
}

export const MapSafetyConfirmModal: React.FC<MapSafetyConfirmModalProps> = ({
  isOpen,
  onClose,
  targetId,
  targetName,
  targetCurrentD,
  targetPaths,
  proposedD,
  proposedName,
  proposedPaths,
  operationType = 'silhouette_mutation',
  onConfirmReplace,
  onConfirmAsIndependent
}) => {
  // Modo de visualización: 'realistic' (Muestra colores reales del mapa / índice de ruta) vs 'vector_silhouette' (Silueta de diagnóstico)
  const [viewMode, setViewMode] = useState<'realistic' | 'vector_silhouette'>('realistic');

  // 1. Diagnóstico geométrico de cajas contenedoras (Bounding Boxes) con protección total
  // Todos los Hooks de React se ejecutan SIEMPRE en la parte superior para cumplir las reglas incondicionales de React
  const currentBBox = useMemo(() => {
    try {
      if (targetPaths && targetPaths.length > 0) {
        const combinedD = targetPaths.map(p => (p.d || '').trim()).filter(Boolean).join(' ');
        if (combinedD) return getPathBBox(combinedD);
      }
      if (!targetCurrentD || typeof targetCurrentD !== 'string') {
        return { x: 0, y: 0, width: 100, height: 100 };
      }
      return getPathBBox(targetCurrentD);
    } catch (e) {
      console.warn("Aviso: Error no bloqueante al calcular BBox de targetCurrentD:", e);
      return { x: 0, y: 0, width: 100, height: 100 };
    }
  }, [targetCurrentD, targetPaths]);

  const proposedBBox = useMemo(() => {
    try {
      if (proposedPaths && proposedPaths.length > 0) {
        const combinedD = proposedPaths.map(p => (p.d || '').trim()).filter(Boolean).join(' ');
        if (combinedD) return getPathBBox(combinedD);
      }
      if (!proposedD || typeof proposedD !== 'string') {
        return { x: 0, y: 0, width: 100, height: 100 };
      }
      return getPathBBox(proposedD);
    } catch (e) {
      console.warn("Aviso: Error no bloqueante al calcular BBox de proposedD:", e);
      return { x: 0, y: 0, width: 100, height: 100 };
    }
  }, [proposedD, proposedPaths]);

  // 2. Detección de conflicto crítico (ej: Malvinas sobre Tierra del Fuego o viceversa)
  const isTargetTierraDelFuego = targetId === 'AR-V' || (targetName && targetName.toLowerCase().includes('tierra del fuego'));
  const isProposedMalvinas = isPathMatchingMalvinas(proposedD) || (proposedName && proposedName.toLowerCase().includes('malvin'));
  const isTargetMalvinas = targetId === 'AR-MLV' || (targetName && targetName.toLowerCase().includes('malvin'));
  const isProposedTierraDelFuego = isPathMatchingTierraDelFuego(proposedD);

  const hasHighRiskMismatch = (isTargetTierraDelFuego && isProposedMalvinas) || (isTargetMalvinas && isProposedTierraDelFuego);

  // 3. ViewBox unificado o adaptativo para sincronizar el encuadre entre ambas vistas
  const unifiedViewBox = useMemo(() => {
    // Si ambas vistas tienen dimensiones válidas, genera una escala y encuadre compartido
    if (currentBBox.width > 0 && currentBBox.height > 0 && proposedBBox.width > 0 && proposedBBox.height > 0) {
      const minX = Math.min(currentBBox.x, proposedBBox.x);
      const minY = Math.min(currentBBox.y, proposedBBox.y);
      const maxX = Math.max(currentBBox.x + currentBBox.width, proposedBBox.x + proposedBBox.width);
      const maxY = Math.max(currentBBox.y + currentBBox.height, proposedBBox.y + proposedBBox.height);
      const width = maxX - minX;
      const height = maxY - minY;

      if (width > 0 && height > 0) {
        const pad = Math.max(10, Math.max(width, height) * 0.06);
        return `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`;
      }
    }
    // Si solo una tiene BBox, usa el correspondiente
    if (currentBBox.width > 0 && currentBBox.height > 0) {
      const pad = Math.max(10, Math.max(currentBBox.width, currentBBox.height) * 0.08);
      return `${currentBBox.x - pad} ${currentBBox.y - pad} ${currentBBox.width + pad * 2} ${currentBBox.height + pad * 2}`;
    }
    if (proposedBBox.width > 0 && proposedBBox.height > 0) {
      const pad = Math.max(10, Math.max(proposedBBox.width, proposedBBox.height) * 0.08);
      return `${proposedBBox.x - pad} ${proposedBBox.y - pad} ${proposedBBox.width + pad * 2} ${proposedBBox.height + pad * 2}`;
    }
    return "0 0 100 100";
  }, [currentBBox, proposedBBox]);

  // ViewBox específico para el estado anterior (si difiere radicalmente)
  const currentViewBox = unifiedViewBox;
  // ViewBox específico para el estado propuesto
  const proposedViewBox = unifiedViewBox;

  // Detecta qué polígonos del estado anterior ya no están en el propuesto (elementos eliminados)
  const deletedPathIds = useMemo(() => {
    if (!targetPaths || !proposedPaths) return new Set<string>();
    const proposedIds = new Set(proposedPaths.map(p => p.id));
    return new Set(targetPaths.filter(p => p.id && !proposedIds.has(p.id)).map(p => p.id));
  }, [targetPaths, proposedPaths]);

  // Retorno condicional colocado DESPUÉS de todos los hooks incondicionales
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera del Modal con Alerta de Seguridad y Selector de Modo de Vista */}
        <div className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b ${
          hasHighRiskMismatch 
            ? 'bg-rose-950/50 border-rose-800/60 text-rose-100' 
            : 'bg-slate-800/60 border-slate-700/60 text-slate-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl flex items-center justify-center ${
              hasHighRiskMismatch 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 ring-4 ring-rose-500/10' 
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 ring-4 ring-amber-500/10'
            }`}>
              {hasHighRiskMismatch ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
                {hasHighRiskMismatch ? '¡Advertencia de Reemplazo Crítico!' : 'Confirmar Aplicación de Cambios'}
              </h2>
              <p className="text-xs text-slate-300">
                Verifica visualmente el mapa antes y después de aplicar la edición
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Interruptor de Modo de Vista: Gráfico Real vs Silueta Vectorial */}
            <div className="bg-slate-950/80 p-1 rounded-xl border border-slate-700/70 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('realistic')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'realistic'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Muestra los colores y estilos reales de cada territorio en el mapa"
              >
                <Palette size={13} />
                <span>Colores Reales</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('vector_silhouette')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'vector_silhouette'
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-950/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Muestra el trazado vectorial puro en modo diagnóstico"
              >
                <Eye size={13} />
                <span>Silueta Path</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Cerrar sin aplicar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mensaje de Alerta Crítica en caso de conflicto Tierra del Fuego vs Malvinas */}
        {hasHighRiskMismatch && (
          <div className="bg-rose-900/30 border-b border-rose-800/50 p-4 px-6 text-xs text-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-rose-100 text-sm block">
                ⚠️ Estás por sobreescribir "{targetName}" con la figura de "{proposedName || 'Islas Malvinas'}"
              </span>
              <p className="leading-relaxed">
                El territorio actualmente activo en tu editor es <strong>{targetName} ({targetId})</strong>. Si confirmas el reemplazo, 
                la silueta original de {targetName} se borrará y será reemplazada por las islas.
              </p>
              <p className="text-rose-300 font-semibold pt-1">
                💡 Solución Segura recomendada: Usa el botón verde <strong>"Incorporar como Territorio Independiente"</strong> para añadir las Islas Malvinas conservando Tierra del Fuego 100% intacta.
              </p>
            </div>
          </div>
        )}

        {/* Banner Informativo de Preservación de Colores */}
        <div className="bg-emerald-950/40 border-b border-emerald-800/40 px-5 py-2.5 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-400 shrink-0" />
            <span>
              <strong>Preservación Exacta:</strong> Los colores, polígonos y datos de cada objeto se mantienen intactos. 
              {viewMode === 'realistic' ? ' Estás viendo el resultado real con su paleta original.' : ' Modo silueta de diagnóstico.'}
            </span>
          </div>
        </div>

        {/* Cuerpo del Modal: Comparador Visual Lado a Lado */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Tarjeta Izquierda: Estado Anterior (Antes de la modificación / Índice de Ruta) */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Estado Anterior (Índice de Ruta)
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40">
                  {targetPaths ? `${targetPaths.length} Polígonos` : targetId}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-200 mb-2 truncate w-full text-center">
                {targetName} {targetPaths && targetPaths.length > 0 ? `(${targetPaths.length} elementos)` : ''}
              </div>

              {/* Vista Previa SVG del Territorio Actual / Índice de Ruta Original */}
              <div className="w-full h-52 bg-slate-900/90 rounded-xl border border-slate-800/80 flex items-center justify-center p-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:12px_12px] opacity-20 pointer-events-none"></div>
                {targetPaths && targetPaths.length > 0 ? (
                  <svg
                    viewBox={currentViewBox}
                    className="w-full h-full max-h-48 drop-shadow-md transition-transform"
                    style={{ overflow: 'visible' }}
                  >
                    {targetPaths.map((tp, idx) => {
                      const isDeleted = tp.id ? deletedPathIds.has(tp.id) : false;
                      const fillColor = viewMode === 'realistic'
                        ? (isDeleted ? '#f43f5e' : (tp.visualStyles?.fillColor || tp.customData?.fill || '#38bdf8'))
                        : (isDeleted ? '#f43f5e' : '#3b82f6');
                      const strokeColor = viewMode === 'realistic'
                        ? (isDeleted ? '#fda4af' : (tp.visualStyles?.strokeColor || '#0f172a'))
                        : (isDeleted ? '#fda4af' : '#60a5fa');
                      const fillOpacity = viewMode === 'realistic' 
                        ? (isDeleted ? 0.95 : 0.85) 
                        : (isDeleted ? 0.9 : 0.4);
                      return (
                        <path
                          key={tp.id || idx}
                          d={tp.d}
                          fill={fillColor}
                          fillOpacity={fillOpacity}
                          stroke={strokeColor}
                          strokeWidth={isDeleted ? 2 : (tp.visualStyles?.strokeWidth || 1)}
                          strokeLinejoin="round"
                        >
                          <title>{isDeleted ? `[Eliminado en la edición] ${tp.name || tp.id}` : (tp.name || tp.id)}</title>
                        </path>
                      );
                    })}
                  </svg>
                ) : targetCurrentD ? (
                  <svg
                    viewBox={currentViewBox}
                    className="w-full h-full max-h-48 drop-shadow-md transition-transform"
                    style={{ overflow: 'visible' }}
                  >
                    <path
                      d={targetCurrentD}
                      fill="#3b82f6"
                      fillOpacity={viewMode === 'realistic' ? 0.8 : 0.4}
                      stroke="#60a5fa"
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="text-xs text-slate-500">Sin geometría previa</span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-slate-400 font-mono">
                {targetPaths && targetPaths.length > 0 ? `${targetPaths.length} polígonos • ` : ''}
                BBox: {Math.round(currentBBox.width)} × {Math.round(currentBBox.height)} px
                {deletedPathIds.size > 0 && (
                  <span className="ml-2 text-rose-400 font-semibold">({deletedPathIds.size} a borrar en rojo)</span>
                )}
              </div>
            </div>

            {/* Tarjeta Derecha: Nueva Versión Editada (Cambio Solicitado) */}
            <div className="bg-slate-950/60 border border-emerald-900/40 rounded-xl p-4 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Cambio Solicitado (Resultado Editado)
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                  {proposedPaths ? `${proposedPaths.length} Polígonos` : 'Propuesta'}
                </span>
              </div>
              <div className="text-sm font-bold text-emerald-200 mb-2 truncate w-full text-center">
                {proposedName || 'Nueva Figura Vectorial'}
              </div>

              {/* Vista Previa SVG de la Nueva Figura Editada */}
              <div className="w-full h-52 bg-slate-900/90 rounded-xl border border-emerald-900/40 flex items-center justify-center p-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#059669_1px,transparent_1px)] [background-size:12px_12px] opacity-20 pointer-events-none"></div>
                {proposedPaths && proposedPaths.length > 0 ? (
                  <svg
                    viewBox={proposedViewBox}
                    className="w-full h-full max-h-48 drop-shadow-md transition-transform"
                    style={{ overflow: 'visible' }}
                  >
                    {proposedPaths.map((pp, idx) => {
                      const fillColor = viewMode === 'realistic'
                        ? (pp.visualStyles?.fillColor || pp.customData?.fill || '#10b981')
                        : '#10b981';
                      const strokeColor = viewMode === 'realistic'
                        ? (pp.visualStyles?.strokeColor || '#0f172a')
                        : '#34d399';
                      const fillOpacity = viewMode === 'realistic' ? 0.85 : 0.5;
                      return (
                        <path
                          key={pp.id || idx}
                          d={pp.d}
                          fill={fillColor}
                          fillOpacity={fillOpacity}
                          stroke={strokeColor}
                          strokeWidth={pp.visualStyles?.strokeWidth || 1}
                          strokeLinejoin="round"
                        >
                          <title>{pp.name || pp.id}</title>
                        </path>
                      );
                    })}
                  </svg>
                ) : proposedD ? (
                  <svg
                    viewBox={proposedViewBox}
                    className="w-full h-full max-h-48 drop-shadow-md transition-transform"
                    style={{ overflow: 'visible' }}
                  >
                    <path
                      d={proposedD}
                      fill="#10b981"
                      fillOpacity={viewMode === 'realistic' ? 0.8 : 0.5}
                      stroke="#34d399"
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="text-xs text-slate-500">Sin geometría propuesta</span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-emerald-400 font-mono">
                {proposedPaths ? `${proposedPaths.length} polígonos activos • ` : ''}
                BBox: {Math.round(proposedBBox.width)} × {Math.round(proposedBBox.height)} px
              </div>
            </div>
          </div>

          {/* Resumen Detallado de la Operación */}
          <div className="bg-slate-950/40 rounded-xl p-3.5 border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span>Tipo de Operación:</span>
              <span className="font-semibold text-slate-200">
                {operationType === 'silhouette_mutation' 
                  ? 'Edición de Silueta' 
                  : operationType === 'save_map' 
                  ? 'Guardado y Sincronización de Mapa' 
                  : 'Asociación a Ruta'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Mapa / Territorio Afectado:</span>
              <span className="font-semibold text-amber-300">
                {targetName} ({targetId})
              </span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
              💡 Cada polígono conservará su color, nombre y métricas. Si deseas volver al estado anterior o cancelar, pulsa "Cancelar y Descartar".
            </p>
          </div>
        </div>

        {/* Barra de Botones de Acción */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* Botón Cancelar */}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-400" />
            Cancelar y Descartar
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Opción 1: Agregar como Territorio Independiente (Recomendado para Islas Malvinas o nuevos territorios) */}
            {onConfirmAsIndependent && (
              <button
                onClick={() => {
                  onConfirmAsIndependent();
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl border border-emerald-600/70 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-emerald-200" />
                <span>Incorporar como Territorio Independiente (Seguro)</span>
              </button>
            )}

            {/* Opción 2: Confirmar Reemplazo Quirúrgico */}
            <button
              onClick={() => {
                onConfirmReplace();
                onClose();
              }}
              className={`px-5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-lg transition-all hover:scale-[1.02] cursor-pointer ${
                hasHighRiskMismatch
                  ? 'border-rose-600 bg-rose-700 hover:bg-rose-600 text-white shadow-rose-950/40'
                  : 'border-emerald-600 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Confirmar y Guardar Cambios en "{targetName}"</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

