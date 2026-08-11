/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react'; // Importación de React y hook de estado local
import { useNavigate } from 'react-router-dom'; // Importación de hook para navegación por rutas
import { Download, Copy, Share2, HelpCircle, Check, BookOpen } from 'lucide-react'; // Importación de íconos de Lucide-React

// Componente de la barra lateral de herramientas y botones contextuales rápidos
export default function Sidebar() {
  const navigate = useNavigate(); // Hook para redirigir dinámicamente entre rutas
  const [copied, setCopied] = useState(false); // Estado para controlar animación de código copiado
  const [downloading, setDownloading] = useState(false); // Estado para simular descarga de datos
  const [sharing, setSharing] = useState(false); // Estado para simular la acción de compartir
  const [showHelp, setShowHelp] = useState(false); // Estado para alternar la visibilidad de la tarjeta rápida de ayuda

  // Función para copiar código o datos al portapapeles del navegador
  const handleCopy = () => {
    setCopied(true); // Marca estado de copiado activo
    navigator.clipboard.writeText('NACIÓN > BUENOS AIRES (Pobreza: 20%, Desempleo: 13.9%, Gini: 63.61%)'); // Escribe al portapapeles
    setTimeout(() => setCopied(false), 2000); // Restablece estado después de 2 segundos
  };

  // Función para simular la descarga del paquete JSON con datos
  const handleDownload = () => {
    setDownloading(true); // Activa el indicador visual de descarga
    setTimeout(() => { // Simula retardo de red
      setDownloading(false); // Desactiva el indicador
      alert('Descarga completada: archivo ar_dashboard_data.json listo.'); // Alerta de éxito
    }, 1500); // 1.5 segundos
  };

  // Función para copiar el enlace de compartir
  const handleShare = () => {
    setSharing(true); // Marca estado de compartiendo
    setTimeout(() => { // Simula retardo
      setSharing(false); // Finaliza estado
      alert('Vínculo de acceso copiado al portapapeles.'); // Notificación de éxito
    }, 1200); // 1.2 segundos
  };

  return (
    // Contenedor principal de la barra lateral adaptable
    <div id="right-sidebar-actions" className="w-full lg:w-16 bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-row lg:flex-col items-center justify-around lg:justify-start lg:space-y-6 lg:py-6 p-4 relative lg:h-full">
      {/* Botón Descargar Datos */}
      <button
        onClick={handleDownload} // Ejecuta la descarga
        disabled={downloading} // Deshabilita mientras descarga
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
        onClick={handleCopy} // Ejecuta la copia
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
        onClick={handleShare} // Ejecuta compartir
        className="flex flex-col items-center group space-y-1 text-slate-500 hover:text-emerald-400 focus:outline-none cursor-pointer transition-colors"
      >
        <div className="p-2 rounded bg-slate-900 group-hover:bg-slate-800 border border-slate-800 group-hover:border-slate-700 transition-all">
          <Share2 size={18} className="text-slate-400 group-hover:text-emerald-400" />
        </div>
        <span className="text-[10px] font-bold group-hover:text-emerald-400 transition-colors uppercase tracking-wider text-slate-500">
          {sharing ? 'Compartiendo' : 'Exportar'}
        </span>
      </button>

      {/* Botón Ayuda y Guía de Uso Admin */}
      <button
        onClick={() => setShowHelp(!showHelp)} // Alterna ventana flotante de ayuda
        className="flex flex-col items-center group space-y-1 text-slate-500 hover:text-emerald-400 focus:outline-none cursor-pointer transition-colors"
      >
        <div className="p-2 rounded bg-slate-900 group-hover:bg-slate-800 border border-slate-800 group-hover:border-slate-700 transition-all">
          <HelpCircle size={18} className="text-slate-400 group-hover:text-emerald-400" />
        </div>
        <span className="text-[10px] font-bold group-hover:text-emerald-400 transition-colors uppercase tracking-wider text-slate-500">
          Ayuda
        </span>
      </button>

      {/* Modal / Tarjeta Flotante de Ayuda Rápida */}
      {showHelp && (
        <div className="absolute right-4 bottom-18 lg:right-18 lg:bottom-4 z-50 bg-slate-950 text-slate-100 p-5 rounded-xl border border-slate-800 w-72 text-xs flex flex-col space-y-3 pointer-events-auto shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
              <HelpCircle size={16} className="text-emerald-400" />
              Guía del Visualizador
            </h4>
          </div>
          <p className="text-slate-400 leading-relaxed">
            1. <strong>Mapa Interactivo:</strong> Haz clic sobre cualquier provincia para actualizar métricas.
          </p>
          <p className="text-slate-400 leading-relaxed">
            2. <strong>Filtros y Escalas:</strong> Elige métricas de color sobre el mapa.
          </p>
          <p className="text-slate-400 leading-relaxed">
            3. <strong>Súper Editor y Jerarquía:</strong> Accede al tutorial paso a paso de convenciones.
          </p>

          {/* Botón para navegar a la ruta completa de Guía de Ayuda Admin */}
          <button
            onClick={() => {
              setShowHelp(false); // Cierra la tarjeta flotante
              navigate('/admin/ayuda'); // Navega a la ruta /admin/ayuda
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-2 rounded-lg text-white transition-colors cursor-pointer flex items-center justify-center space-x-2 text-xs shadow-md"
          >
            <BookOpen size={14} />
            <span>Abrir Guía Completa (/admin/ayuda)</span>
          </button>
        </div>
      )}
    </div>
  );
}

