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
  Clock
} from 'lucide-react';
import { ProvinceData } from '../types';

interface DataPanelProps {
  province: ProvinceData;
  selectedSubdivisionId: string | null;
  onSelectSubdivision: (id: string | null) => void;
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

export default function DataPanel({
  province,
  selectedSubdivisionId,
  onSelectSubdivision
}: DataPanelProps) {
  const [navToMuni, setNavToMuni] = useState(false);
  const selectedSubdivision = province.municipalities?.find(m => m.id === selectedSubdivisionId);

  return (
    <div id="data-panel-container" className="flex flex-col space-y-4">
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

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 flex items-center space-x-3">
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
                  {selectedSubdivision.value > 50 ? '+' : ''}{(selectedSubdivision.value - 50).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      {/* Encabezado del Sector de Datos */}
      <div id="data-panel-header" className="bg-slate-900/40 rounded-xl border border-slate-800 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">
            Indicadores Federales
          </span>
          <h2 className="text-2xl font-serif italic text-emerald-400 tracking-tight">
            {province.name}
          </h2>
        </div>

        {/* Toggle Navegar a Municipios */}
        <div className="flex items-center space-x-3 bg-slate-950 p-1.5 px-3 rounded border border-slate-800">
          <button
            onClick={() => setNavToMuni(!navToMuni)}
            className={`w-10 h-5 rounded-full transition-all duration-300 relative focus:outline-none cursor-pointer ${
              navToMuni ? 'bg-emerald-600' : 'bg-slate-800'
            }`}
          >
            <div
              className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all duration-300 shadow-sm ${
                navToMuni ? 'left-5.5' : 'left-1'
              }`}
            />
          </button>
          <span className="text-xs text-slate-300 font-bold flex items-center">
            <Navigation size={13} className="mr-1 text-slate-500" />
            Navegar a Municipios
          </span>
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
                  <span className="text-base font-extrabold text-slate-200 leading-none">{province.economicProfile.gini}%</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800 flex items-center space-x-2">
                <TrendingUp size={18} className="text-emerald-400" />
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase leading-tight">PIB Provincial</span>
                  <span className="text-base font-extrabold text-emerald-400 leading-none">{province.economicProfile.pib}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/40 items-center">
            <div className="flex flex-col space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Distribución por sector</span>
              <SimpleRingChart sectors={province.economicProfile.sectors} centerLabel="Sect" />
            </div>

            <div className="bg-emerald-950/10 p-3 rounded border border-emerald-900/30 flex flex-col justify-center h-full">
              <span className="text-[9px] text-emerald-400 font-bold uppercase block tracking-widest mb-1">Salario Promedio</span>
              <span className="text-lg font-bold text-emerald-400 font-serif italic">{province.economicProfile.averageSalary} <span className="text-[10px] text-emerald-500/80 font-semibold font-sans not-italic">Provincia</span></span>
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
                  <span className="text-lg font-black text-slate-200 leading-none">{province.socialEmployment.pobreza.toFixed(1)}</span>
                  <span className="text-[8px] text-slate-500 block mt-0.5">{province.name}</span>
                </div>
              </div>

              <div className="bg-amber-950/10 p-3 rounded border border-amber-900/30 flex items-center space-x-3">
                <TrendingDown size={20} className="text-amber-400" />
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Desempleo (%)</span>
                  <span className="text-lg font-black text-slate-200 leading-none">{province.socialEmployment.desempleo.toFixed(1)}</span>
                  <span className="text-[8px] text-slate-500 block mt-0.5">{province.name}</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-3 rounded border border-slate-800 flex items-center space-x-3">
                <Users size={20} className="text-slate-500" />
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Empleo Informal (%)</span>
                  <span className="text-lg font-black text-slate-200 leading-none">{province.socialEmployment.informalEmployment}%</span>
                  <span className="text-[8px] text-slate-500 block mt-0.5">{province.name}</span>
                </div>
              </div>

              <div className="bg-emerald-950/10 p-3 rounded border border-emerald-900/20 flex items-center space-x-3">
                <Percent size={20} className="text-emerald-400" />
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Informalidad Juvenil</span>
                  <span className="text-lg font-black text-slate-200 leading-none">{province.socialEmployment.youthInformality}%</span>
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
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Salario Mínimo Provincial</span>
                <SimpleBarChart data={province.incomeStructure.minimumSalary} color="#10b981" />
              </div>

              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Brecha Salarial de Género</span>
                <SimpleBarChart data={province.incomeStructure.genderGap} color="#059669" />
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
                <SimpleBarChart data={province.connectivity.internetAccess} color="#047857" />
              </div>

              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center">
                  <Smartphone size={11} className="mr-1 text-slate-600" />
                  Líneas Móviles
                </span>
                <SimpleBarChart data={province.connectivity.mobileLines} color="#10b981" />
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
                <SimpleRingChart sectors={province.budgetSpending.socialSpending} centerLabel="Gto" />
              </div>

              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center">
                  <BookOpen size={11} className="mr-1 text-slate-600" />
                  Inversión en Educación
                </span>
                <SimpleBarChart data={province.budgetSpending.educationInvestment} color="#34d399" height={70} />
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
                <span className="text-base font-black text-slate-200 mt-1 leading-tight">{province.mobilityServices.roadNetwork}</span>
                <span className="text-[8px] text-slate-500 mt-0.5">Acceso provincial</span>
              </div>

              <div className="bg-emerald-950/10 p-2.5 rounded border border-emerald-900/20 flex flex-col items-center text-center justify-center">
                <span className="text-[14px] font-bold text-emerald-400">💧</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase block tracking-wider mt-1">Acceso a Agua Potable</span>
                <span className="text-base font-bold text-emerald-400 font-serif italic mt-1 leading-tight">{province.mobilityServices.waterAccess}%</span>
                <span className="text-[8px] text-emerald-500/50 mt-0.5">Servicios de red</span>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800 flex flex-col items-center text-center justify-center">
                <span className="text-[14px] font-bold text-emerald-400">🚌</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase block tracking-wider mt-1">Transporte Público</span>
                <span className="text-base font-black text-slate-200 mt-1 leading-tight">{province.mobilityServices.publicTransportLines}</span>
                <span className="text-[8px] text-slate-500 mt-0.5">Líneas registradas</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
