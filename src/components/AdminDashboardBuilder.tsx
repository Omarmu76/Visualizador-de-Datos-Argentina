/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Importaciones principales de React y Lucide Icons
import React, { useState, useEffect } from 'react'; // React hooks para gestión de estado y ciclo de vida
import { 
  Palette, 
  BarChart2, 
  PieChart, 
  TrendingUp, 
  Layers, 
  Plus, 
  Trash2, 
  Sliders, 
  Check, 
  Eye, 
  Sparkles, 
  Settings2,
  Activity
} from 'lucide-react'; // Íconos vectoriales para la interfaz gráfica del Administrador
import { DashboardConfig, DashboardConfigItem, PaletteConfig, MapVisualizationMode } from '../types'; // Interfaces de tipos de datos
import { safeGetItem, safeSetItem } from '../lib/storage'; // Funciones para persistencia segura en localStorage

// Propiedades recibidas por el componente Administrador de Dashboards
interface AdminDashboardBuilderProps {
  onConfigChange?: (config: DashboardConfig) => void; // Callback opcional al cambiar cualquier parámetro
  onClose?: () => void; // Callback para cerrar el panel si es un modal
}

// Configuración por defecto de la paleta institucional y modo coropleta
export const defaultPaletteConfig: PaletteConfig = {
  mode: 'choropleth', // Modo coropleta (mapa de calor por variable) por defecto
  baseColor: '#0f1a30', // Color slate azul oscuro institucional base
  minColor: '#064e3b', // Verde esmeralda oscuro para valores mínimos
  maxColor: '#10b981', // Verde esmeralda brillante para valores máximos
  selectedColor: '#34d399', // Verde brillante al seleccionar una provincia o subdivisión
  hoverColor: '#059669', // Verde medio al pasar el cursor
  strokeColor: '#334155', // Gris slate para bordes limpios
  strokeWidth: 1.2 // Grosor de contorno predeterminado
};

// Configuración predeterminada de elementos del dashboard con recharts / KPI
export const defaultDashboardConfig: DashboardConfig = {
  activeDataKey: 'pobreza', // Métrica activa inicial para colorear el mapa
  palette: defaultPaletteConfig, // Asignación de paleta inicial
  items: [
    {
      id: 'item-pobreza',
      dataKey: 'pobreza',
      label: 'Tasa de Pobreza Social (%)',
      chartType: 'bar',
      color: '#10b981'
    },
    {
      id: 'item-desempleo',
      dataKey: 'desempleo',
      label: 'Índice de Desempleo (%)',
      chartType: 'kpi',
      color: '#3b82f6'
    },
    {
      id: 'item-gini',
      dataKey: 'gini',
      label: 'Coeficiente Gini (Desigualdad)',
      chartType: 'pie',
      color: '#f59e0b'
    },
    {
      id: 'item-conectividad',
      dataKey: 'conectividad',
      label: 'Acceso a Conectividad (%)',
      chartType: 'line',
      color: '#ec4899'
    }
  ]
};

// Componente Administrador Constructor de Dashboards y Paletas Dinámicas
export default function AdminDashboardBuilder({ onConfigChange, onClose }: AdminDashboardBuilderProps) {
  // Estado local para almacenar la configuración completa del dashboard
  const [config, setConfig] = useState<DashboardConfig>(() => {
    const saved = safeGetItem('app_dashboard_config'); // Lee la configuración persistida en el almacenamiento del navegador
    if (saved) { // Si existe datos guardados
      try { // Intenta deserializar el objeto JSON
        const parsed = JSON.parse(saved); // Convierte la cadena JSON en objeto JS
        if (parsed && parsed.palette && Array.isArray(parsed.items)) { // Valida estructura correcta
          return parsed; // Retorna los datos persistidos
        } // Fin de validación
      } catch (e) { // Captura cualquier fallo de parsing
        console.error('Error al cargar app_dashboard_config:', e); // Imprime el error en consola
      } // Fin de catch
    } // Fin de condicional saved
    return defaultDashboardConfig; // Retorna configuración predeterminada si no hay datos persistidos
  }); // Fin de useState config

  // Estado para la pestaña activa dentro del panel del Administrador ('palette' o 'widgets')
  const [activeTab, setActiveTab] = useState<'palette' | 'widgets'>('palette');

  // Estado para nuevo widget que el administrador desea añadir
  const [newLabel, setNewLabel] = useState<string>(''); // Nombre del nuevo indicador
  const [newDataKey, setNewDataKey] = useState<string>('poblacion'); // Clave de la variable
  const [newChartType, setNewChartType] = useState<'kpi' | 'bar' | 'pie' | 'line' | 'area'>('bar'); // Tipo de gráfico
  const [newColor, setNewColor] = useState<string>('#10b981'); // Color predeterminado

  // Efecto para notificar cambios y persistir automáticamente cada vez que config se actualiza
  useEffect(() => {
    safeSetItem('app_dashboard_config', JSON.stringify(config)); // Guarda la configuración en localStorage
    if (onConfigChange) { // Si el componente padre envió una función de callback
      onConfigChange(config); // Notifica la nueva configuración al mapa e indicadores públicos
    } // Fin de condicional callback
    // Dispara evento personalizado para sincronizar en tiempo real otros componentes conectados
    window.dispatchEvent(new CustomEvent('dashboardConfigUpdated', { detail: config }));
  }, [config, onConfigChange]); // Dependencias de sincronización

  // Actualizador para cambiar el modo de color de la paleta ('cartographic', 'choropleth', 'custom')
  const handleModeChange = (mode: MapVisualizationMode) => {
    setConfig(prev => ({ // Actualiza de forma inmutable el estado
      ...prev, // Mantiene resto de propiedades del dashboard
      palette: { // Modifica la sub-propiedad de paleta
        ...prev.palette, // Mantiene colores actuales
        mode // Asigna nuevo modo de visualización
      }
    }));
  }; // Fin de handleModeChange

  // Actualizador de cualquier campo numérico o hexadecimal en PaletteConfig
  const handlePaletteFieldChange = (field: keyof PaletteConfig, value: any) => {
    setConfig(prev => ({ // Actualiza de forma inmutable
      ...prev, // Conserva configuración anterior
      palette: { // Actualiza sub-objeto palette
        ...prev.palette, // Copia valores existentes
        [field]: value // Asigna la clave enviada con su nuevo valor
      }
    }));
  }; // Fin de handlePaletteFieldChange

  // Añade un nuevo módulo gráfico/indicador a la lista de widgets del Dashboard
  const handleAddWidget = (e: React.FormEvent) => {
    e.preventDefault(); // Evita la recarga nativa de la página al presionar submit
    if (!newLabel.trim()) return; // Si la etiqueta está vacía no realiza acción

    const newItem: DashboardConfigItem = { // Crea el nuevo objeto widget
      id: `item-${Date.now()}`, // Genera un ID único con timestamp
      dataKey: newDataKey.trim() || 'variable_custom', // Asigna la clave de variable elegida
      label: newLabel.trim(), // Asigna el texto descriptivo
      chartType: newChartType, // Asigna el formato visual (barras, torta, kpi, etc.)
      color: newColor // Asigna el color seleccionado
    };

    setConfig(prev => ({ // Actualiza la lista de items
      ...prev, // Conserva resto del estado
      items: [...prev.items, newItem] // Concatena el nuevo widget al arreglo
    }));

    setNewLabel(''); // Limpia el campo de entrada del formulario
  }; // Fin de handleAddWidget

  // Elimina un widget del dashboard por su ID único
  const handleDeleteWidget = (id: string) => {
    setConfig(prev => ({ // Filtra y elimina el elemento especificado
      ...prev, // Mantiene propiedades
      items: prev.items.filter(item => item.id !== id) // Retorna sólo los elementos distintos al ID enviado
    }));
  }; // Fin de handleDeleteWidget

  // Selecciona qué clave de datos controlará la coropleta del mapa
  const handleSelectActiveDataKey = (key: string) => {
    setConfig(prev => ({ // Actualiza la clave activa
      ...prev, // Copia estado anterior
      activeDataKey: key // Establece la variable que pintará el mapa
    }));
  }; // Fin de handleSelectActiveDataKey

  return (
    <div id="admin-dashboard-builder" className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-200 max-w-4xl mx-auto space-y-5">
      {/* Encabezado Principal del Constructor de Dashboards Admin */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Settings2 size={24} /> {/* Ícono de configuración técnica */}
          </div>
          <div>
            <h2 className="text-xl font-serif italic text-emerald-400 tracking-tight flex items-center space-x-2">
              <span>Constructor de Dashboards y Paletas</span>
              <Sparkles size={16} className="text-emerald-400" />
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configurá los modos de color del mapa, escalas de calor (Coropleta) y gráficos dinámicos sin tocar el archivo base.
            </p>
          </div>
        </div>

        {onClose && ( // Si se proporciona botón para cerrar modal
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar ×
          </button>
        )}
      </div>

      {/* Selector de Pestañas Principales (Paleta de Colores vs. Módulos Gráficos) */}
      <div className="flex space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('palette')} // Cambia a pestaña de Paletas
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeTab === 'palette'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Palette size={16} />
          <span>1. Paletas y Modos de Color del Mapa</span>
        </button>

        <button
          onClick={() => setActiveTab('widgets')} // Cambia a pestaña de Widgets de Gráficos
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeTab === 'widgets'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <BarChart2 size={16} />
          <span>2. Módulos Gráficos e Indicadores</span>
        </button>
      </div>

      {/* SECCIÓN 1: CONFIGURACIÓN DE PALETAS Y MODOS DE COLOR */}
      {activeTab === 'palette' && (
        <div className="space-y-5">
          {/* Selección del Modo de Visualización del Mapa */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
              Modo de Visualización de Colores en el Mapa:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Opción 1: Cartográfico Institucional */}
              <button
                type="button"
                onClick={() => handleModeChange('cartographic')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  config.palette.mode === 'cartographic'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs uppercase tracking-wider">Cartográfico Institucional</span>
                    {config.palette.mode === 'cartographic' && <Check size={16} className="text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Estilo limpio y sobrio en tonos slate/azules. Ignora colores duros del archivo y aplica la paleta institucional.
                  </p>
                </div>
              </button>

              {/* Opción 2: Coropleta / Mapa de Calor Estadístico */}
              <button
                type="button"
                onClick={() => handleModeChange('choropleth')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  config.palette.mode === 'choropleth'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs uppercase tracking-wider">Coropleta (Mapa de Calor)</span>
                    {config.palette.mode === 'choropleth' && <Check size={16} className="text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Pinta cada provincia/municipio en un degradado entre Color Mínimo y Máximo según el dato seleccionado.
                  </p>
                </div>
              </button>

              {/* Opción 3: Temático / Personalizado */}
              <button
                type="button"
                onClick={() => handleModeChange('custom')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  config.palette.mode === 'custom'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs uppercase tracking-wider">Temático / Personalizado</span>
                    {config.palette.mode === 'custom' && <Check size={16} className="text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Respeta o permite elegir un color manual específico por cada pieza (ideal para mapas médicos o técnicos).
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Selector de Variable Activa para el Mapa Coropleta */}
          {config.palette.mode === 'choropleth' && (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Variable Estadística que Colorea el Mapa Coropleta:
              </label>
              <select
                value={config.activeDataKey}
                onChange={(e) => handleSelectActiveDataKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-semibold focus:border-emerald-500 focus:outline-none"
              >
                {config.items.map(item => (
                  <option key={item.id} value={item.dataKey}>
                    {item.label} (Clave: {item.dataKey})
                  </option>
                ))}
                <option value="poblacion">Población / Habitantes</option>
                <option value="pobreza">Pobreza (%)</option>
                <option value="desempleo">Desempleo (%)</option>
                <option value="gini">Desigualdad Gini</option>
                <option value="conectividad">Conectividad (%)</option>
              </select>
            </div>
          )}

          {/* Ajuste Fino de Colores de la Escala y Bordes */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
            <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
              Ajuste Fino de la Paleta Hexadecimal:
            </span>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Color Mínimo (Coropleta) */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase block">Color Mínimo (Base Escala)</label>
                <div className="flex items-center space-x-2 bg-slate-900 p-1.5 border border-slate-800 rounded-lg">
                  <input
                    type="color"
                    value={config.palette.minColor}
                    onChange={(e) => handlePaletteFieldChange('minColor', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={config.palette.minColor}
                    onChange={(e) => handlePaletteFieldChange('minColor', e.target.value)}
                    className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Color Máximo (Coropleta) */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase block">Color Máximo (Top Escala)</label>
                <div className="flex items-center space-x-2 bg-slate-900 p-1.5 border border-slate-800 rounded-lg">
                  <input
                    type="color"
                    value={config.palette.maxColor}
                    onChange={(e) => handlePaletteFieldChange('maxColor', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={config.palette.maxColor}
                    onChange={(e) => handlePaletteFieldChange('maxColor', e.target.value)}
                    className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Color Seleccionado */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase block">Color Selección Activa</label>
                <div className="flex items-center space-x-2 bg-slate-900 p-1.5 border border-slate-800 rounded-lg">
                  <input
                    type="color"
                    value={config.palette.selectedColor}
                    onChange={(e) => handlePaletteFieldChange('selectedColor', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={config.palette.selectedColor}
                    onChange={(e) => handlePaletteFieldChange('selectedColor', e.target.value)}
                    className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Color del Borde Geográfico */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase block">Color de Contorno / Borde</label>
                <div className="flex items-center space-x-2 bg-slate-900 p-1.5 border border-slate-800 rounded-lg">
                  <input
                    type="color"
                    value={config.palette.strokeColor}
                    onChange={(e) => handlePaletteFieldChange('strokeColor', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={config.palette.strokeColor}
                    onChange={(e) => handlePaletteFieldChange('strokeColor', e.target.value)}
                    className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Slider de Grosor de Borde */}
            <div className="pt-2">
              <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                <span>Grosor del Contorno Geográfico</span>
                <span className="text-emerald-400 font-mono">{config.palette.strokeWidth} px</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="5"
                step="0.1"
                value={config.palette.strokeWidth}
                onChange={(e) => handlePaletteFieldChange('strokeWidth', parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: CONFIGURACIÓN DE MÓDULOS GRÁFICOS (DASHBOARD BUILDER) */}
      {activeTab === 'widgets' && (
        <div className="space-y-5">
          {/* Formulario para añadir un nuevo indicador/gráfico */}
          <form onSubmit={handleAddWidget} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
              Agregar Nuevo Indicador / Gráfico al Panel:
            </span>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Campo 1: Nombre legible */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Etiqueta Visor</label>
                <input
                  type="text"
                  placeholder="Ej: Empleo Formal (%)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              {/* Campo 2: Clave de la variable */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Clave de Dato (Key)</label>
                <input
                  type="text"
                  placeholder="Ej: empleo_formal"
                  value={newDataKey}
                  onChange={(e) => setNewDataKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              {/* Campo 3: Tipo de gráfico */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Tipo de Gráfico</label>
                <select
                  value={newChartType}
                  onChange={(e) => setNewChartType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="kpi">Tarjeta KPI Grande</option>
                  <option value="bar">Gráfico de Barras</option>
                  <option value="pie">Gráfico de Torta (Pie)</option>
                  <option value="line">Gráfico de Línea</option>
                  <option value="area">Gráfico de Área</option>
                </select>
              </div>

              {/* Campo 4: Color y Botón de Submit */}
              <div className="flex items-end space-x-2">
                <div className="space-y-1 shrink-0">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Color</label>
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer border-0 bg-slate-900 p-1"
                  />
                </div>

                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer h-9 shadow-md"
                >
                  <Plus size={16} />
                  <span>Agregar</span>
                </button>
              </div>
            </div>
          </form>

          {/* Lista de Widgets Actuales del Dashboard */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
              Módulos Activos en el Dashboard Público ({config.items.length}):
            </span>

            <div className="space-y-2">
              {config.items.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between transition-all hover:border-slate-700"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-4 h-4 rounded-full border border-slate-700 shrink-0" style={{ backgroundColor: item.color || '#10b981' }} />
                    <div>
                      <span className="font-bold text-xs text-slate-200 block">{item.label}</span>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                        <span>Clave: {item.dataKey}</span>
                        <span>•</span>
                        <span className="uppercase text-emerald-400 font-bold">Tipo: {item.chartType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleSelectActiveDataKey(item.dataKey)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        config.activeDataKey === item.dataKey
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                      title="Establecer esta variable para colorear el mapa en modo coropleta"
                    >
                      {config.activeDataKey === item.dataKey ? '✓ Mapa Activo' : 'Usar en Mapa'}
                    </button>

                    <button
                      onClick={() => handleDeleteWidget(item.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                      title="Eliminar este widget"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}

              {config.items.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">
                  No tenés módulos gráficos configurados. Agregá uno usando el formulario de arriba.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
