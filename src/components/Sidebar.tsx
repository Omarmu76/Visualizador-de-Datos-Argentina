/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, Copy, Share2, HelpCircle, Check } from 'lucide-react';

export default function Sidebar() {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    navigator.clipboard.writeText('NACIÓN > BUENOS AIRES (Pobreza: 20%, Desempleo: 13.9%, Gini: 63.61%)');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      alert('Descarga completada: archivo ar_dashboard_data.json listo.');
    }, 1500);
  };

  const handleShare = () => {
    setSharing(true);
    setTimeout(() => {
      setSharing(false);
      alert('Vínculo de acceso copiado al portapapeles.');
    }, 1200);
  };

  return (
    <div id="right-sidebar-actions" className="w-full lg:w-16 bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-row lg:flex-col items-center justify-around lg:justify-start lg:space-y-6 lg:py-6 p-4 relative lg:h-full">
      {/* Botón Descargar */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex flex-col items-center group space-y-1 text-slate-500 hover:text-emerald-400 focus:outline-none cursor-pointer transition-colors"
      >
        <div className="p-2 rounded bg-slate-900 group-hover:bg-slate-800 border border-slate-800 group-hover:border-slate-700 transition-all">
          <Download size={18} className="text-slate-400 group-hover:text-emerald-400" />
        </div>
        <span className="text-[10px] font-bold group-hover:text-emerald-400 transition-colors uppercase tracking-wider text-slate-500">
          {downloading ? 'Bajando' : 'Descargar'}
        </span>
      </button>

      {/* Botón Copiar Código */}
      <button
        onClick={handleCopy}
        className="flex flex-col items-center group space-y-1 text-slate-500 hover:text-emerald-400 focus:outline-none cursor-pointer transition-colors"
      >
        <div className="p-2 rounded bg-slate-900 group-hover:bg-slate-800 border border-slate-800 group-hover:border-slate-700 transition-all">
          {copied ? (
            <Check size={18} className="text-emerald-400" />
          ) : (
            <Copy size={18} className="text-slate-400 group-hover:text-emerald-400" />
          )}
        </div>
        <span className="text-[10px] font-bold group-hover:text-emerald-400 transition-colors uppercase tracking-wider text-slate-500">
          {copied ? 'Copiado!' : 'Copiar Código'}
        </span>
      </button>

      {/* Botón Exportar */}
      <button
        onClick={handleShare}
        className="flex flex-col items-center group space-y-1 text-slate-500 hover:text-emerald-400 focus:outline-none cursor-pointer transition-colors"
      >
        <div className="p-2 rounded bg-slate-900 group-hover:bg-slate-800 border border-slate-800 group-hover:border-slate-700 transition-all">
          <Share2 size={18} className="text-slate-400 group-hover:text-emerald-400" />
        </div>
        <span className="text-[10px] font-bold group-hover:text-emerald-400 transition-colors uppercase tracking-wider text-slate-500">
          {sharing ? 'Compartiendo' : 'Exportar'}
        </span>
      </button>

      {/* Botón Ayuda */}
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="flex flex-col items-center group space-y-1 text-slate-500 hover:text-emerald-400 focus:outline-none cursor-pointer transition-colors"
      >
        <div className="p-2 rounded bg-slate-900 group-hover:bg-slate-800 border border-slate-800 group-hover:border-slate-700 transition-all">
          <HelpCircle size={18} className="text-slate-400 group-hover:text-emerald-400" />
        </div>
        <span className="text-[10px] font-bold group-hover:text-emerald-400 transition-colors uppercase tracking-wider text-slate-500">
          Ayuda
        </span>
      </button>

      {/* Help Modal / Floating Card */}
      {showHelp && (
        <div className="absolute right-4 bottom-18 lg:right-18 lg:bottom-4 z-50 bg-slate-950 text-slate-100 p-5 rounded border border-slate-800 w-64 text-xs flex flex-col space-y-2 pointer-events-auto shadow-2xl">
          <h4 className="font-bold text-sm text-slate-100 font-serif italic">Guía del Visualizador</h4>
          <p className="text-slate-400 leading-relaxed">
            1. <strong>Mapa Interactivo:</strong> Haz clic sobre cualquier provincia en el mapa para actualizar los indicadores económicos y sociales del sector derecho.
          </p>
          <p className="text-slate-400 leading-relaxed">
            2. <strong>Filtros:</strong> Selecciona métricas de escala de color arriba del mapa.
          </p>
          <p className="text-slate-400 leading-relaxed">
            3. <strong>Minimapa:</strong> Visualiza subdivisiones o municipios de la provincia seleccionada para un detalle geográfico granular.
          </p>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-2 bg-emerald-600 hover:bg-emerald-500 font-bold py-1.5 rounded text-white transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      )}
    </div>
  );
}
