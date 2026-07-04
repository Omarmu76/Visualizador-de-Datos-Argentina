/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileText, Download, User, CheckCircle2 } from 'lucide-react';

export default function Header() {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = (type: 'PDF' | 'Excel') => {
    setExporting(type);
    setTimeout(() => {
      setExporting(null);
      alert(`Éxito: Reporte exportado a formato ${type} correctamente.`);
    }, 1500);
  };

  return (
    <header id="app-header" className="bg-slate-950/50 backdrop-blur-md border-b border-slate-800 py-3 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-50">
      {/* Brand & Flag */}
      <div className="flex items-center space-x-3">
        <div id="argentina-flag-emblem" className="w-10 h-7 rounded bg-sky-600/10 p-0.5 flex flex-col justify-between overflow-hidden shadow-xs border border-slate-800">
          <div className="bg-sky-500/50 h-2 w-full" />
          <div className="bg-white/80 h-2 w-full flex items-center justify-center relative">
            <span className="text-[6px] absolute">☀️</span>
          </div>
          <div className="bg-sky-500/50 h-2 w-full" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="font-black text-slate-100 tracking-wider text-sm">ARGENTINA</span>
            <span className="text-xs bg-slate-900 text-slate-400 font-bold px-1.5 py-0.5 rounded border border-slate-800">DATOS</span>
          </div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-0.5">
            Plataforma Federal Integrada
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="text-sm md:text-base font-light tracking-tight text-center md:text-left flex-1 md:px-6">
        SISTEMA <span className="font-extrabold text-slate-100">ARGENTINA</span> DATA <span className="text-emerald-400 italic font-medium">v.2.4</span>
      </div>

      {/* Buttons & Profile */}
      <div className="flex items-center justify-end space-x-3">
        <button
          onClick={() => handleExport('PDF')}
          disabled={exporting !== null}
          className="flex items-center space-x-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold py-2 px-3.5 rounded transition-all cursor-pointer disabled:opacity-50"
        >
          <FileText size={14} className="text-red-400" />
          <span>{exporting === 'PDF' ? 'Generando...' : 'EXPORTAR PDF'}</span>
        </button>

        <button
          onClick={() => handleExport('Excel')}
          disabled={exporting !== null}
          className="flex items-center space-x-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-slate-100 font-bold py-2 px-3.5 rounded transition-all cursor-pointer disabled:opacity-50"
        >
          <FileText size={14} className="text-slate-100" />
          <span>{exporting === 'Excel' ? 'Generando...' : 'GENERAR EXCEL'}</span>
        </button>

        <div className="w-px h-6 bg-slate-800 mx-1" />

        <button className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-full cursor-pointer transition-colors" title="Perfil de Usuario">
          <User size={16} />
        </button>
      </div>
    </header>
  );
}
