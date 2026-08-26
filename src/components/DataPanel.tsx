/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp,
  Percent,
  Briefcase,
  AlertTriangle,
  Users,
  DollarSign,
  Wifi,
  Smartphone,
  BookOpen,
  PieChart as PieIcon,
  Layers,
  MapPin,
  TrendingDown,
  Navigation,
  CheckCircle,
  HelpCircle,
  Clock,
  RotateCcw
} from 'lucide-react';
import { ProvinceData, RegionNode, NavNode } from '../types'; // Importación de tipos de datos e interfaces

interface DataPanelProps {
  province: ProvinceData; // Datos de la provincia o lienzo territorial activo
  selectedSubdivisionId: string | null; // ID de la subdivisión o departamento seleccionado
  onSelectSubdivision: (id: string | null) => void; // Función callback para seleccionar subdivisión
  navigationPath?: RegionNode[]; // Arreglo opcional de ruta jerárquica regional tradicional
  onBreadcrumbClick?: (index: number) => void; // Función opcional para retroceder en migas tradicionales
  navPath?: NavNode[]; // Arreglo del historial de navegación dinámico universal (Motor Vectorial)
  goBackToNode?: (index: number) => void; // Función para retroceder hasta el índice de nodo seleccionado en el historial
  onRestoreWorldMap?: () => void; // Función de recuperación pura del mapa mundial original
}

// 1. Mini SVG Segmented Ring Chart (for sectors and spending)
const SimpleRingChart = ({
  sectors,
  centerLabel = 'PIB'
}: {
  sectors: { name: string; value: number; color: string }[];
  centerLabel?: string;
}) => {
  let accumulatedPercent = 0;
  return (
    <div className="flex items-center justify-between space-x-4">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg viewBox="0 0 36 36" className="w-20 h-20 transform -rotate-90">
          <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#1e293b" strokeWidth="3" />
          {sectors.map((sec, idx) => {
            const strokeDasharray = `${sec.value} ${100 - sec.value}`;
            const strokeDashoffset = 100 - accumulatedPercent;
            accumulatedPercent += sec.value;
            return (
              <circle
                key={idx}
                cx="18"
                cy="18"
                r="15.915"
                fill="transparent"
                stroke={sec.color}
                strokeWidth="4"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300"
              />
            );
          })}
        </svg>
        <div className="absolute flex flex-col items-center text-center">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{centerLabel}</span>
          <span className="text-xs font-bold text-slate-200">100%</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col space-y-1.5 text-[10px]">
        {sectors.map((sec, idx) => (
          <div key={idx} className="flex items-center justify-between font-medium">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sec.color }} />
              <span className="text-slate-400">{sec.name}</span>
            </div>
            <span className="font-bold text-slate-300">{sec.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 2. Mini SVG Animated Bar Chart
const SimpleBarChart = ({
  data,
  color = '#10b981',
  height = 80
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div
      className="flex items-end justify-between px-2 pt-2 border-b border-slate-850 w-full"
      style={{ height: `${height}px` }}
    >
      {data.map((item, idx) => {
        const pct = (item.value / maxVal) * 100;
        return (
          <div key={idx} className="flex flex-col items-center flex-1 mx-2 group relative">
            <div className="w-full bg-slate-950 hover:bg-slate-900 rounded-t-sm flex items-end justify-center h-full relative border-l border-r border-t border-transparent hover:border-slate-800 transition-all">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                className="w-full rounded-t-sm transition-colors duration-200"
                style={{ backgroundColor: color }}
              />
              <span className="absolute -top-7 text-[9px] font-bold text-slate-200 bg-slate-950 border border-slate-800 shadow-xl px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {item.value.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-bold mt-1.5 whitespace-nowrap">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
};

import { safeGetItem } from '../lib/storage'; // Importación de lectura segura de localStorage
import { defaultDashboardConfig } from './AdminDashboardBuilder'; // Importación de la configuración por defecto de dashboards
import { DashboardConfig } from '../types'; // Importación del tipo DashboardConfig

export default function DataPanel({
  province,
  selectedSubdivisionId,
  onSelectSubdivision,
  navigationPath = [],
  onBreadcrumbClick,
  navPath,
  goBackToNode,
  onRestoreWorldMap
}: DataPanelProps) {
  const [navToMuni, setNavToMuni] = useState(false);
  const selectedSubdivision = province.municipalities?.find(m => m.id === selectedSubdivisionId);

  // Estado local para la configuración de widgets de dashboard del administrador
  const [dashConfig, setDashConfig] = useState<DashboardConfig>(() => {
    const saved = safeGetItem('app_dashboard_config'); // Lee localStorage
    if (saved) { // Si existe la entrada
      try { // Parsea JSON
        const parsed = JSON.parse(saved); // Objeto parseado
        if (parsed && parsed.widgets) return parsed; // Si es válido retorna
      } catch (e) {} // Captura errores
    } // Fin condicional
    return defaultDashboardConfig; // Retorna fallback
  });

  // Escucha actualizaciones en tiempo real del AdminDashboardBuilder
  React.useEffect(() => {
    const handleConfigUpdate = (e: any) => {
      if (e.detail) {
        setDashConfig(e.detail);
      }
    };
    window.addEventListener('dashboardConfigUpdated', handleConfigUpdate);
    return () => window.removeEventListener('dashboardConfigUpdated', handleConfigUpdate);
  }, []);

  // Determinación de la lista de nodos de navegación a desplegar (priorizando navPath universal)
  const displayNodes = (navPath && navPath.length > 0)
    ? navPath
    : navigationPath.map(n => ({ id: n.id, name: n.name, type: n.level }));

  // Manejador unificado para la interacción con los eslabones de las migas de pan
  const handleNodeClick = (index: number) => {
    if (goBackToNode) {
      goBackToNode(index); // Ejecuta el recorte del historial universal navPath
    } else if (onBreadcrumbClick) {
      onBreadcrumbClick(index); // Ejecuta el manejador de navegación regional tradicional
    }
  };

  return (
    <div id="data-panel-container" className="flex flex-col space-y-4">
      {/* Breadcrumbs Universales Dinámicas - Historial de Ruta Vectorial Jerárquica */}
      {displayNodes.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 px-4 py-2.5 rounded-xl flex flex-wrap items-center gap-1 text-[11px] font-mono shadow-sm">
          <span className="text-slate-500 font-bold uppercase tracking-wider mr-1">Ruta Universal:</span>
          {displayNodes.map((node, index) => {
            const isLast = index === displayNodes.length - 1; // Verifica si el nodo es la posición actual activa
            return (
              <span key={`${node.id}-${index}`} className="flex items-center">
                <button
                  onClick={() => handleNodeClick(index)} // Llama a la función al hacer clic en un eslabón anterior
                  disabled={isLast} // Deshabilita el clic si es la posición actual
                  className={`transition-all font-bold tracking-tight rounded px-1.5 py-0.5 ${
                    isLast
                      ? 'text-emerald-400 cursor-default font-black' // Estilo para la ubicación actual
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 cursor-pointer' // Estilo para eslabones navegables
                  }`}
                >
                  {node.name} {/* Muestra el nombre dinámico del nodo */}
                </button>
                {!isLast && <span className="text-slate-600 mx-1 font-sans">{'>'}</span>} {/* Separador de eslabón */}
              </span>
            );
          })}
        </div>
      )}

      {/* Tarjeta de detalle de la división / municipio activo */}
      {selectedSubdivision && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-amber-500/30 p-5 rounded-2xl shadow-xl relative overflow-hidden"
        >
          {/* Fondo luminoso decorativo */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                  Detalle de División Activa
                </span>
                <span className="text-slate-600 font-mono text-[9px]">{selectedSubdivision.id}</span>
              </div>
              <h3 className="text-2xl font-serif italic text-amber-400 tracking-tight">
                {selectedSubdivision.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Datos específicos para la división territorial dentro de <strong className="text-slate-300">{province.name}</strong>.
              </p>
            </div>
            
            <button
              onClick={() => onSelectSubdivision(null)}
              className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded transition-all cursor-pointer font-bold uppercase tracking-wider"
            >
              Cerrar Detalle ×
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-800">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 flex items-center space-x-3">
              <span className="text-xl">📊</span>
              <div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block">Índice / Valor</span>
                <span className="text-base font-extrabold text-slate-200">{selectedSubdivision.value} pts</span>
              </div>
            </div>

            <div className="bg-[#0b1325]/80 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
              <span className="text-xl">📈</span>
              <div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block">Porcentaje Provincial</span>
                <span className="text-base font-extrabold text-slate-200">{selectedSubdivision.percentage}%</span>
              </div>
            </div>

            <div className="bg-amber-950/10 p-3 rounded-xl border border-amber-900/20 flex items-center space-x-3">
              <span className="text-xl">⚖️</span>
              <div>
                <span className="text-[9px] text-amber-400 font-bold uppercase tracking-widest block">Desviación Media</span>
                <span className="text-base font-extrabold text-amber-400">
                  {((selectedSubdivision.value ?? 50) - 50) >= 0 ? '+' : ''}{((selectedSubdivision.value ?? 50) - 50).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      {/* Encabezado del Sector de Datos con Indicación de Vista Actual Master */}
      <motion.div
        key={province.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col space-y-4"
      >
        <div id="data-panel-header" className="bg-slate-900/40 rounded-xl border border-slate-800 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Contenedor de títulos e indicadores de jerarquía Master */}
        <div>
          {/* Insignia indicadora de vista de alcance o nivel macro activo */}
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1 animate-pulse" /> {/* Punto indicador */}
              Vista Master Actual {/* Etiqueta de la arquitectura Maestro-Detalle */}
            </span>
            <span className="text-slate-500 font-mono text-[9px]">
              {province.abbreviation || province.id} {/* Abreviatura de la entidad */}
            </span>
          </div>
          {/* Subtítulo indicativo del nivel de datos según el territorio activo */}
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">
            {province.id === 'WORLD_MAP' ? 'Indicadores Globales (Mundo)' : // Caso Nivel Mundo
             province.id === 'CONTINENT_MAP' ? 'Indicadores Continentales' : // Caso Nivel Continente
             province.id === 'COUNTRY_MAP' ? 'Indicadores Federales (Nivel País)' : // Caso Nivel País (República Argentina)
             `Indicadores Regionales (${province.name})`} {/* Caso Provincia o Región territorial específica */}
          </span>
          {/* Título principal con el nombre del territorio Master activo */}
          <h2 className="text-2xl font-serif italic text-emerald-400 tracking-tight">
            {province.name} {/* Nombre de la provincia o país activo */}
          </h2>
        </div>

        {/* Interruptor de Navegación Maestro-Detalle hacia Municipios o Hijos */}
        <div className="flex items-center space-x-3">
          {/* Botón de Restauración Rápida de Mundo */}
          {province.id === 'WORLD_MAP' && onRestoreWorldMap && (
            <button
              onClick={onRestoreWorldMap}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="Restaurar el mapa mundial original con todos los continentes y países (sin alterar Argentina)"
            >
              <RotateCcw size={13} className="text-amber-400" />
              <span>↺ Recuperar Mapa Mundo</span>
            </button>
          )}

          <div className="flex items-center space-x-3 bg-slate-950 p-2 px-3 rounded-lg border border-slate-800 shadow-sm">
            {/* Botón de switch o toggle */}
            <button
              onClick={() => setNavToMuni(!navToMuni)} // Alterna el estado de navegación
              className={`w-10 h-5 rounded-full transition-all duration-300 relative focus:outline-none cursor-pointer ${
                navToMuni ? 'bg-emerald-600' : 'bg-slate-800' // Cambia color de fondo según el estado
              }`} // Clases base de Tailwind
            >
              <div // Píldora circular deslizante
                className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all duration-300 shadow-sm ${
                  navToMuni ? 'left-5.5' : 'left-1' // Desplaza la bolita
                }`} // Clases de posición
              />
            </button>
            {/* Etiqueta de texto de la acción */}
            <span className="text-xs text-slate-300 font-bold flex items-center">
              <Navigation size={13} className="mr-1.5 text-emerald-400" /> {/* Icono de brújula de navegación */}
              {province.id === 'WORLD_MAP' || province.id === 'CONTINENT_MAP' ? 'Navegar a Países' : 'Explorar Municipios'} {/* Texto de acción */}
            </span>
          </div>
        </div>
      </div>

      {/* Grid de Tarjetas de Datos */}
      <div id="data-panel-grid" className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* CARD 1: Perfil Económico */}
        <div id="card-economic-profile" className="bg-slate-900/40 rounded-xl border border-slate-800 p-5 shadow-sm hover:border-slate-700/80 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                <Layers className="text-emerald-400 mr-1.5" size={14} />
                Perfil Económico ({province.abbreviation})
              </h3>
              <div className="flex space-x-1">
                <span className="w-2.5 h-2.5 bg-slate-950 text-[8px] font-bold text-slate-500 rounded-xs flex items-center justify-center border border-slate-800">E</span>
                <span className="w-2.5 h-2.5 bg-slate-950 text-[8px] font-bold text-slate-500 rounded-xs flex items-center justify-center border border-slate-800">I</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800 flex items-center space-x-2">
                <Percent size={18} className="text-emerald-400" />
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase leading-tight">Gini</span>
                  <span className="text-base font-extrabold text-slate-200 leading-none">{province.economicProfile?.gini ?? 0}%</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800 flex items-center space-x-2">
                <TrendingUp size={18} className="text-emerald-400" />
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase leading-tight">
                    {province.id === 'WORLD_MAP' ? 'PIB Mundial' : province.id === 'CONTINENT_MAP' ? 'PIB Continental' : 'PIB Provincial'}
                  </span>
                  <span className="text-base font-extrabold text-emerald-400 leading-none">{province.economicProfile?.pib ?? 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/40 items-center">
            <div className="flex flex-col space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Distribución por sector</span>
              <SimpleRingChart sectors={province.economicProfile?.sectors || []} centerLabel="Sect" />
            </div>

            <div className="bg-emerald-950/10 p-3 rounded border border-emerald-900/30 flex flex-col justify-center h-full">
              <span className="text-[9px] text-emerald-400 font-bold uppercase block tracking-widest mb-1">Salario Promedio</span>
              <span className="text-lg font-bold text-emerald-400 font-serif italic">{province.economicProfile?.averageSalary ?? 'N/A'} <span className="text-[10px] text-emerald-500/80 font-semibold font-sans not-italic">{province.id === 'WORLD_MAP' ? 'Mundo' : province.id === 'CONTINENT_MAP' ? 'Regional' : 'Provincia'}</span></span>
            </div>
          </div>
        </div>

        {/* CARD 2: Situación Social y Empleo */}
        <div id="card-social-employment" className="bg-slate-900/40 rounded-xl border border-slate-800 p-5 shadow-sm hover:border-slate-700/80 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                <Briefcase className="text-emerald-400 mr-1.5" size={14} />
                Situación Social y Empleo ({province.abbreviation})
              </h3>
              <HelpCircle size={14} className="text-slate-600" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-950/10 p-3 rounded border border-red-900/30 flex items-center space-x-3">
                <AlertTriangle size={20} className="text-red-400" />
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Pobreza (%)</span>
                  <span className="text-lg font-black text-slate-200 leading-none">{(province.socialEmployment?.pobreza ?? 0).toFixed(1)}</span>
                  <span className="text-[8px] text-slate-500 block mt-0.5">{province.name}</span>
                </div>
              </div>

              <div className="bg-amber-950/10 p-3 rounded border border-amber-900/30 flex items-center space-x-3">
                <TrendingDown size={20} className="text-amber-400" />
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Desempleo (%)</span>
                  <span className="text-lg font-black text-slate-200 leading-none">{(province.socialEmployment?.desempleo ?? 0).toFixed(1)}</span>
                  <span className="text-[8px] text-slate-500 block mt-0.5">{province.name}</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-3 rounded border border-slate-800 flex items-center space-x-3">
                <Users size={20} className="text-slate-500" />
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Empleo Informal (%)</span>
                  <span className="text-lg font-black text-slate-200 leading-none">{province.socialEmployment?.informalEmployment ?? 0}%</span>
                  <span className="text-[8px] text-slate-500 block mt-0.5">{province.name}</span>
                </div>
              </div>

              <div className="bg-emerald-950/10 p-3 rounded border border-emerald-900/20 flex items-center space-x-3">
                <Percent size={20} className="text-emerald-400" />
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Informalidad Juvenil</span>
                  <span className="text-lg font-black text-slate-200 leading-none">{province.socialEmployment?.youthInformality ?? 0}%</span>
                  <span className="text-[8px] text-slate-500 block mt-0.5">{province.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: Estructura de Ingresos */}
        <div id="card-income-structure" className="bg-slate-900/40 rounded-xl border border-slate-800 p-5 shadow-sm hover:border-slate-700/80 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                <DollarSign className="text-emerald-400 mr-1.5" size={14} />
                Estructura de Ingresos ({province.abbreviation})
              </h3>
              <div className="flex space-x-1">
                <span className="w-2.5 h-2.5 bg-slate-950 text-[8px] font-bold text-slate-500 rounded-xs flex items-center justify-center border border-slate-800">S</span>
                <span className="w-2.5 h-2.5 bg-slate-950 text-[8px] font-bold text-slate-500 rounded-xs flex items-center justify-center border border-slate-800">M</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  {province.id === 'WORLD_MAP' ? 'Salario Mínimo Global' : province.id === 'CONTINENT_MAP' ? 'Salario Mínimo Regional' : 'Salario Mínimo Provincial'}
                </span>
                <SimpleBarChart data={province.incomeStructure?.minimumSalary || []} color="#10b981" />
              </div>

              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Brecha Salarial de Género</span>
                <SimpleBarChart data={province.incomeStructure?.genderGap || []} color="#059669" />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 4: Conectividad */}
        <div id="card-connectivity" className="bg-slate-900/40 rounded-xl border border-slate-800 p-5 shadow-sm hover:border-slate-700/80 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                <Wifi className="text-emerald-400 mr-1.5" size={14} />
                Conectividad ({province.abbreviation})
              </h3>
              <div className="flex space-x-1">
                <span className="w-2.5 h-2.5 bg-slate-950 text-[8px] font-bold text-slate-500 rounded-xs flex items-center justify-center border border-slate-800">W</span>
                <span className="w-2.5 h-2.5 bg-slate-950 text-[8px] font-bold text-slate-500 rounded-xs flex items-center justify-center border border-slate-800">M</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center">
                  <Wifi size={11} className="mr-1 text-slate-600" />
                  Acceso a Internet (%)
                </span>
                <SimpleBarChart data={province.connectivity?.internetAccess || []} color="#047857" />
              </div>

              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center">
                  <Smartphone size={11} className="mr-1 text-slate-600" />
                  Líneas Móviles
                </span>
                <SimpleBarChart data={province.connectivity?.mobileLines || []} color="#10b981" />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 5: Presupuesto y Gasto Público */}
        <div id="card-budget-spending" className="bg-slate-900/40 rounded-xl border border-slate-800 p-5 shadow-sm hover:border-slate-700/80 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                <BookOpen className="text-emerald-400 mr-1.5" size={14} />
                Presupuesto y Gasto Público ({province.abbreviation})
              </h3>
              <div className="flex space-x-1">
                <span className="w-2.5 h-2.5 bg-slate-950 text-[8px] font-bold text-slate-500 rounded-xs flex items-center justify-center border border-slate-800">G</span>
                <span className="w-2.5 h-2.5 bg-slate-950 text-[8px] font-bold text-slate-500 rounded-xs flex items-center justify-center border border-slate-800">P</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center">
                  <PieIcon size={11} className="mr-1 text-slate-600" />
                  Gasto Social
                </span>
                <SimpleRingChart sectors={province.budgetSpending?.socialSpending || []} centerLabel="Gto" />
              </div>

              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center">
                  <BookOpen size={11} className="mr-1 text-slate-600" />
                  Inversión en Educación
                </span>
                <SimpleBarChart data={province.budgetSpending?.educationInvestment || []} color="#34d399" height={70} />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 6: Movilidad y Servicios */}
        <div id="card-mobility-services" className="bg-slate-900/40 rounded-xl border border-slate-800 p-5 shadow-sm hover:border-slate-700/80 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                <Layers className="text-emerald-400 mr-1.5" size={14} />
                Movilidad y Servicios ({province.abbreviation})
              </h3>
              <HelpCircle size={14} className="text-slate-600" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800 flex flex-col items-center text-center justify-center">
                <span className="text-[14px] font-bold text-slate-500">A</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase block tracking-wider mt-1">Red Vial Provincial</span>
                <span className="text-base font-black text-slate-200 mt-1 leading-tight">{province.mobilityServices?.roadNetwork ?? 'N/A'}</span>
                <span className="text-[8px] text-slate-500 mt-0.5">Acceso provincial</span>
              </div>

              <div className="bg-emerald-950/10 p-2.5 rounded border border-emerald-900/20 flex flex-col items-center text-center justify-center">
                <span className="text-[14px] font-bold text-emerald-400">💧</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase block tracking-wider mt-1">Acceso a Agua Potable</span>
                <span className="text-base font-bold text-emerald-400 font-serif italic mt-1 leading-tight">{province.mobilityServices?.waterAccess ?? 0}%</span>
                <span className="text-[8px] text-emerald-500/50 mt-0.5">Servicios de red</span>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800 flex flex-col items-center text-center justify-center">
                <span className="text-[14px] font-bold text-emerald-400">🚌</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase block tracking-wider mt-1">Transporte Público</span>
                <span className="text-base font-black text-slate-200 mt-1 leading-tight">{province.mobilityServices?.publicTransportLines ?? 0}</span>
                <span className="text-[8px] text-slate-500 mt-0.5">Líneas registradas</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD DINÁMICA: Widgets de Métricas Personalizadas del Administrador */}
        {dashConfig.widgets && dashConfig.widgets.filter(w => w.enabled).length > 0 && (
          <div id="card-admin-custom-widgets" className="bg-slate-900/60 rounded-xl border border-emerald-500/30 p-5 shadow-xl col-span-1 xl:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center">
                  <TrendingUp className="text-emerald-400 mr-1.5" size={14} />
                  Panel Métrico Dinámico ({province.abbreviation})
                </h3>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                  {dashConfig.widgets.filter(w => w.enabled).length} Widgets Activos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {dashConfig.widgets.filter(w => w.enabled).map((widget) => (
                  <div key={widget.id} className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2 hover:border-emerald-500/40 transition-all">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {widget.title}
                    </span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-extrabold text-slate-100">
                        {widget.metricKey === 'pobreza' ? `${(province.socialEmployment?.pobreza ?? 0).toFixed(1)}%` :
                         widget.metricKey === 'desempleo' ? `${(province.socialEmployment?.desempleo ?? 0).toFixed(1)}%` :
                         widget.metricKey === 'gini' ? `${(province.economicProfile?.gini ?? 0).toFixed(1)}%` :
                         widget.metricKey === 'conectividad' ? `${province.connectivity?.internetAccess?.[2]?.value ?? 50}%` :
                         '100%'}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                        {widget.chartType.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>
      </motion.div>
    </div>
  );
}
