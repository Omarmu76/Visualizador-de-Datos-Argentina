import React, { useState, useEffect } from 'react'; // Importación de React y los hooks de estado (useState) y sincronización (useEffect)
import { Save, Plus, Trash2, X, Sparkles, Type } from 'lucide-react'; // Importación de íconos estilizados desde lucide-react para un diseño moderno tipo Figma

// Interfaz que define la estructura del objeto Territorio editable en el inspector
export interface EditableTerritory {
  id: string; // Identificador único del territorio (ej: 'world_ar_buenosaires_lamatanza')
  name: string; // Nombre amigable (ej: "La Matanza")
  level: string; // Nivel de la jerarquía (ej: 'province', 'city', 'neighborhood', etc.)
  svgPath?: string; // Coordenadas opcionales del path SVG
  visualStyles: { // Estilos visuales dinámicos
    fillColor: string; // Color hexadecimal de relleno del polígono
    strokeColor: string; // Color hexadecimal del contorno o borde
    strokeWidth: number; // Grosor físico del trazo en píxeles
    fontFamily: string; // Fuente asignada (ej: 'Inter', 'JetBrains Mono', 'Playfair Display')
    fontSize: number; // Tamaño físico del texto o etiquetas de datos en píxeles
  };
  customData: Record<string, any>; // Diccionario JSON de pares Clave/Valor para métricas específicas del Catastro
}

// Propiedades que recibe el componente PropertyEditor desde el lienzo o panel superior
interface PropertyEditorProps {
  territory: EditableTerritory; // Territorio actualmente seleccionado por el administrador para editar
  onSave: (updated: EditableTerritory) => void; // Función Callback que se activa al presionar "Guardar Cambios"
  onClose: () => void; // Función Callback para cerrar el inspector de propiedades
}

export default function PropertyEditor({ territory, onSave, onClose }: PropertyEditorProps) {
  // Estado local para los estilos visuales, inicializado a partir del territorio seleccionado
  const [fillColor, setFillColor] = useState(territory.visualStyles.fillColor); // Estado para el color de relleno
  const [strokeColor, setStrokeColor] = useState(territory.visualStyles.strokeColor); // Estado para el color del borde
  const [strokeWidth, setStrokeWidth] = useState(territory.visualStyles.strokeWidth); // Estado para el grosor del borde
  const [fontFamily, setFontFamily] = useState(territory.visualStyles.fontFamily); // Estado para la tipografía
  const [fontSize, setFontSize] = useState(territory.visualStyles.fontSize); // Estado para el tamaño de letra
  const [name, setName] = useState(territory.name); // Estado para el nombre del territorio

  // Estados locales para gestionar la tabla de metadatos clave/valor en customData
  const [metaKeys, setMetaKeys] = useState<string[]>([]); // Almacena las claves del diccionario
  const [metaValues, setMetaValues] = useState<string[]>([]); // Almacena los valores correspondientes del diccionario
  const [newKey, setNewKey] = useState(''); // Estado para la nueva clave a agregar
  const [newValue, setNewValue] = useState(''); // Estado para el nuevo valor a agregar

  // Sincroniza los estados internos cada vez que cambie el territorio seleccionado en el mapa
  useEffect(() => {
    setName(territory.name); // Sincroniza el nombre
    setFillColor(territory.visualStyles.fillColor || '#10b981'); // Sincroniza o aplica color por defecto
    setStrokeColor(territory.visualStyles.strokeColor || '#0f172a'); // Sincroniza o aplica contorno por defecto
    setStrokeWidth(territory.visualStyles.strokeWidth !== undefined ? territory.visualStyles.strokeWidth : 1.5); // Sincroniza grosor
    setFontFamily(territory.visualStyles.fontFamily || 'Inter'); // Sincroniza fuente
    setFontSize(territory.visualStyles.fontSize || 12); // Sincroniza tamaño de letra
    
    // Desglosa el JSON de customData en arreglos separados de llaves y valores para facilitar el mapeo HTML
    const keys = Object.keys(territory.customData || {}); // Obtiene las llaves
    const values = keys.map(k => String(territory.customData[k] || '')); // Obtiene los valores como strings
    setMetaKeys(keys); // Guarda las llaves en el estado
    setMetaValues(values); // Guarda los valores en el estado
  }, [territory]); // Se dispara únicamente cuando el objeto 'territory' es reemplazado

  // Función para agregar un nuevo par Clave/Valor al set de metadatos de Catastro
  const handleAddMeta = () => {
    if (!newKey.trim()) return; // Si la clave está vacía, no hace nada para evitar llaves sin nombre
    const cleanKey = newKey.trim().toLowerCase().replace(/\s+/g, '_'); // Limpia la clave haciéndola segura (snake_case)
    
    if (metaKeys.includes(cleanKey)) { // Evita la duplicidad de claves
      alert('Esta propiedad ya existe en los metadatos catastrales.'); // Alerta simple al usuario
      return;
    }

    setMetaKeys([...metaKeys, cleanKey]); // Añade la clave limpia al arreglo
    setMetaValues([...metaValues, newValue.trim()]); // Añade el valor correspondiente al arreglo
    setNewKey(''); // Resetea el input de clave
    setNewValue(''); // Resetea el input de valor
  };

  // Función para eliminar una fila de metadatos catastrales
  const handleRemoveMeta = (indexToRemove: number) => {
    setMetaKeys(metaKeys.filter((_, idx) => idx !== indexToRemove)); // Filtra y elimina la clave del índice elegido
    setMetaValues(metaValues.filter((_, idx) => idx !== indexToRemove)); // Filtra y elimina el valor del índice elegido
  };

  // Función para actualizar un valor existente sobre la marcha en la grilla dinámica
  const handleValueChange = (index: number, val: string) => {
    const updated = [...metaValues]; // Copia el arreglo de valores
    updated[index] = val; // Modifica el valor en el índice correspondiente
    setMetaValues(updated); // Actualiza el estado
  };

  // Procesa y guarda todos los cambios modificados en el panel hacia el backend
  const handleSaveChanges = () => {
    // Reconstruye el objeto de customData a partir de los arreglos de claves y valores
    const customDataObj: Record<string, any> = {}; // Inicializa un objeto vacío
    metaKeys.forEach((key, idx) => { // Recorre cada clave y la asocia a su valor
      if (key.trim()) { // Filtra claves vacías por seguridad
        const numericVal = Number(metaValues[idx]); // Intenta parsear a número por si es una métrica
        customDataObj[key] = isNaN(numericVal) || metaValues[idx] === '' ? metaValues[idx] : numericVal; // Guarda número o texto según corresponda
      }
    });

    // Construye el objeto completo con los nuevos estados consolidados
    const updatedTerritory: EditableTerritory = {
      ...territory, // Conserva propiedades de base como el ID y el svgPath
      name: name.trim(), // Asigna el nuevo nombre corregido
      visualStyles: { // Asigna la estructura de diseño visual
        fillColor, // Color de relleno
        strokeColor, // Color del trazo del contorno
        strokeWidth: Number(strokeWidth), // Grosor del contorno
        fontFamily, // Familia tipográfica
        fontSize: Number(fontSize) // Tamaño de la letra
      },
      customData: customDataObj // Guarda las métricas catastrales actualizadas
    };

    onSave(updatedTerritory); // Despacha el objeto actualizado al gestor superior
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 flex flex-col space-y-5 relative overflow-hidden">
      {/* Luz ambiental decorativa de fondo */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* CABECERA DEL PANEL INSPECTOR DE PROPIEDADES */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Sparkles size={14} />
          </span>
          <div>
            <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">
              Inspector de Capa (Figma Mode)
            </h3>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">
              ID: {territory.id} [{territory.level}]
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-850 rounded transition-all cursor-pointer"
          title="Cerrar Inspector"
        >
          <X size={14} />
        </button>
      </div>

      {/* FORMULARIO DE PROPIEDADES BÁSICAS */}
      <div className="space-y-3">
        <div>
          <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
            Nombre del Polígono / Área
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Provincia de Buenos Aires"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 outline-none transition-all font-serif italic"
          />
        </div>

        {/* CONTROLES DE ESTILO VISUAL (Lienzo, Relleno y Contorno) */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
              🎨 Color Relleno (Fill)
            </label>
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
              <input
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                className="w-7 h-7 bg-transparent border-0 outline-none cursor-pointer rounded-md overflow-hidden"
              />
              <input
                type="text"
                value={fillColor.toUpperCase()}
                onChange={(e) => setFillColor(e.target.value)}
                className="w-full bg-transparent border-0 text-[10px] text-slate-300 font-mono focus:outline-none uppercase"
                maxLength={7}
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
              ✏️ Borde (Stroke)
            </label>
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="w-7 h-7 bg-transparent border-0 outline-none cursor-pointer rounded-md overflow-hidden"
              />
              <input
                type="text"
                value={strokeColor.toUpperCase()}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="w-full bg-transparent border-0 text-[10px] text-slate-300 font-mono focus:outline-none uppercase"
                maxLength={7}
              />
            </div>
          </div>
        </div>

        {/* AJUSTES DE ANCHO DEL BORDE */}
        <div className="pt-2">
          <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
            <span>📏 Grosor del Contorno</span>
            <span className="text-emerald-400 font-mono">{strokeWidth}px</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-full accent-emerald-500 bg-slate-950 cursor-pointer h-1.5 rounded-lg appearance-none"
          />
        </div>

        {/* SECCIÓN DE AJUSTES TIPOGRÁFICOS */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-2.5">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
            <Type size={10} />
            <span>Configuración de Texto / Etiquetas</span>
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">
                Tipografía
              </label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[10px] text-slate-300 outline-none focus:border-emerald-500"
              >
                <option value="Inter">Inter (Sans-Serif)</option>
                <option value="Fira Code">Fira Code (Mono)</option>
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Playfair Display">Playfair Display (Serif)</option>
                <option value="Space Grotesk">Space Grotesk</option>
              </select>
            </div>

            <div>
              <label className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">
                Tamaño (Size)
              </label>
              <input
                type="number"
                min="6"
                max="32"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[10px] text-slate-300 outline-none focus:border-emerald-500 text-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE DATOS DINÁMICOS Y MÉTRICAS (JSONB customData) */}
      <div className="space-y-2 pt-2">
        <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest">
          📊 Métricas y Datos Catastrales (customData)
        </label>
        <p className="text-[8px] text-slate-500 leading-normal">
          Agrega pares de información descriptiva e ilimitada que se mostrarán en el panel de datos públicos al seleccionar esta área.
        </p>

        {/* TABLA DE PAR CLAVE/VALOR */}
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {metaKeys.map((key, idx) => (
            <div key={key} className="flex items-center space-x-1.5 bg-slate-950 p-1.5 rounded border border-slate-850 text-[10px]">
              <span className="text-emerald-400 font-mono truncate w-1/3 bg-slate-900 px-1.5 py-0.5 rounded font-bold" title={key}>
                {key}
              </span>
              <input
                type="text"
                value={metaValues[idx]}
                onChange={(e) => handleValueChange(idx, e.target.value)}
                placeholder="Valor numérico o texto"
                className="w-full bg-transparent border-0 text-[10px] text-slate-200 outline-none focus:ring-0 px-1"
              />
              <button
                onClick={() => handleRemoveMeta(idx)}
                className="text-slate-600 hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                title="Eliminar métrica"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          {metaKeys.length === 0 && (
            <div className="text-center py-4 border border-dashed border-slate-800 rounded-lg text-[9px] text-slate-500">
              No hay métricas específicas cargadas para esta parcela.
            </div>
          )}
        </div>

        {/* FORMULARIO PARA AGREGAR NUEVA MÉTRICA */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-950/60 p-2 rounded-xl border border-slate-850">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Clave (ej: poblacion)"
            className="bg-slate-900 border border-slate-800 rounded p-1 text-[9px] text-slate-200 outline-none focus:border-emerald-500 font-mono"
          />
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Valor (ej: 4200)"
            className="bg-slate-900 border border-slate-800 rounded p-1 text-[9px] text-slate-200 outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleAddMeta}
            className="col-span-2 py-1 bg-slate-900 hover:bg-slate-850 text-emerald-400 border border-slate-800 rounded text-[8.5px] font-bold uppercase cursor-pointer flex items-center justify-center space-x-1 transition-colors"
          >
            <Plus size={10} />
            <span>Agregar Propiedad Catastral</span>
          </button>
        </div>
      </div>

      {/* BOTÓN GENERAL DE GUARDADO */}
      <button
        onClick={handleSaveChanges}
        className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-emerald-950/10"
      >
        <Save size={13} />
        <span>Guardar Cambios de Capa</span>
      </button>
    </div>
  );
}
