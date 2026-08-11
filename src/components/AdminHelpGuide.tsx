/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Importación de React y hooks de estado
import React, { useState } from 'react';
// Importación de íconos temáticos de Lucide-React
import { 
  HelpCircle, 
  Layers, 
  MousePointer, 
  FileJson, 
  ArrowRight, 
  ArrowDown, 
  CheckCircle2, 
  Copy, 
  Check, 
  Info, 
  Compass, 
  Globe2, 
  MapPin, 
  Code2, 
  Save, 
  Upload, 
  Sparkles,
  BookOpen
} from 'lucide-react';

// Componente principal de la Guía y Tutorial de Administración de Jerarquías Vectoriales
export default function AdminHelpGuide() {
  // Estado para controlar la confirmación de copiado de código al portapapeles
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Función auxiliar para copiar texto al portapapeles y mostrar retroalimentación
  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text); // Copia el texto al portapapeles del sistema
    setCopiedCode(label); // Registra la clave copiada
    setTimeout(() => setCopiedCode(null), 2500); // Restablece la confirmación tras 2.5s
  };

  // Ejemplo de JSON crudo para copia rápida
  const exampleJsonSnippet = JSON.stringify([
    {
      "id": "ARG",
      "name": "Argentina",
      "parentId": "AMERICA-SUD",
      "category": "País",
      "d": "M 100 100 L 200 100 L 200 200 Z"
    },
    {
      "id": "BRA",
      "name": "Brasil",
      "parentId": "AMERICA-SUD",
      "category": "País",
      "d": "M 200 100 L 300 100 L 300 200 Z"
    }
  ], null, 2);

  return (
    // Contenedor principal con fondo oscuro profesional y scroll suave
    <div className="w-full bg-slate-950 text-slate-100 min-h-screen p-4 sm:p-6 lg:p-8 space-y-8 font-sans">
      
      {/* ENCABEZADO PRINCIPAL DE LA GUÍA DE ADMINISTRACIÓN */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 mb-1">
            <BookOpen size={20} className="text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-2.5 py-0.5 rounded-full">
              Centro de Capacitación Admin
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Guía de Convenciones, Jerarquías y Edición Vectorial
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl">
            Aprende a estructurar, calibrar y vincular nuevos mapas vectoriales (Mundo, Países, Provincias y Municipios) manteniendo la compatibilidad total con el motor gráfico de la plataforma.
          </p>
        </div>

        {/* Botón rápido para ir al Canvas / Editor */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleCopyText(exampleJsonSnippet, 'plantilla')}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-md"
          >
            {copiedCode === 'plantilla' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            <span>{copiedCode === 'plantilla' ? '¡Plantilla Copiada!' : 'Copiar Plantilla JSON'}</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN 1: ARQUITECTURA DE CONVENCIÓN Y JERARQUÍAS */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
        <div className="flex items-center space-x-3 border-b border-slate-800/80 pb-4">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Layers size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">1. Convención Estándar de Nombres y Jerarquía</h2>
            <p className="text-xs text-slate-400">
              Regla fundamental de vinculación relacional para navegar fluidamente entre niveles.
            </p>
          </div>
        </div>

        {/* Diagrama de Jerarquía Visual */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
          {/* Nivel 1: MUNDO */}
          <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 flex flex-col items-center justify-between space-y-2 relative group hover:border-emerald-400 transition-all">
            <div className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider">Nivel Global</div>
            <Globe2 className="text-emerald-400" size={28} />
            <div className="text-sm font-black text-white">MUNDO</div>
            <div className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              parentId: null
            </div>
            <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10 text-emerald-400 font-bold">➡️</div>
          </div>

          {/* Nivel 2: CONTINENTE */}
          <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/30 flex flex-col items-center justify-between space-y-2 relative group hover:border-blue-400 transition-all">
            <div className="text-[10px] font-extrabold uppercase text-blue-400 tracking-wider">Continente</div>
            <Compass className="text-blue-400" size={28} />
            <div className="text-sm font-black text-white">AMERICA-SUD</div>
            <div className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              parentId: "MUNDO"
            </div>
            <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10 text-blue-400 font-bold">➡️</div>
          </div>

          {/* Nivel 3: PAÍS */}
          <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 flex flex-col items-center justify-between space-y-2 relative group hover:border-amber-400 transition-all">
            <div className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider">País (ISO-3)</div>
            <MapPin className="text-amber-400" size={28} />
            <div className="text-sm font-black text-white">ARG</div>
            <div className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              parentId: "AMERICA-SUD"
            </div>
            <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10 text-amber-400 font-bold">➡️</div>
          </div>

          {/* Nivel 4: PROVINCIA */}
          <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/30 flex flex-col items-center justify-between space-y-2 relative group hover:border-purple-400 transition-all">
            <div className="text-[10px] font-extrabold uppercase text-purple-400 tracking-wider">Provincia / Estado</div>
            <Layers className="text-purple-400" size={28} />
            <div className="text-sm font-black text-white">AR-B</div>
            <div className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              parentId: "ARG"
            </div>
            <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10 text-purple-400 font-bold">➡️</div>
          </div>

          {/* Nivel 5: MUNICIPIO */}
          <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/30 flex flex-col items-center justify-between space-y-2 relative group hover:border-rose-400 transition-all">
            <div className="text-[10px] font-extrabold uppercase text-rose-400 tracking-wider">Subdivisión</div>
            <MapPin className="text-rose-400" size={28} />
            <div className="text-sm font-black text-white">MUNICIPIO</div>
            <div className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              parentId: "AR-B"
            </div>
          </div>
        </div>

        {/* Tabla Explicativa de Campos */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">Campo</th>
                <th className="p-3">Obligatorio</th>
                <th className="p-3">Ejemplo</th>
                <th className="p-3">Descripción de la Regla</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              <tr>
                <td className="p-3 font-mono text-emerald-400 font-bold">id</td>
                <td className="p-3"><span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded text-[10px]">SÍ</span></td>
                <td className="p-3 font-mono text-white">"ARG", "BRA", "AR-MNS"</td>
                <td className="p-3 text-slate-400">Identificador único global. Para países usar código ISO 3-Letras mayúsculas.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-emerald-400 font-bold">name</td>
                <td className="p-3"><span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded text-[10px]">SÍ</span></td>
                <td className="p-3 font-mono text-white">"Argentina", "Misiones"</td>
                <td className="p-3 text-slate-400">Nombre oficial descriptivo visible en el hover y panel de datos.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-emerald-400 font-bold">parentId</td>
                <td className="p-3"><span className="bg-blue-950 text-blue-400 px-2 py-0.5 rounded text-[10px]">SÍ</span></td>
                <td className="p-3 font-mono text-white">"MUNDO", "ARG", "AR-B"</td>
                <td className="p-3 text-slate-400">ID del nodo padre al que pertenece este territorio para permitir la navegación fluida.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-emerald-400 font-bold">category</td>
                <td className="p-3"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">RECOMENDADO</span></td>
                <td className="p-3 font-mono text-white">"País", "Provincia", "Municipio"</td>
                <td className="p-3 text-slate-400">Categoría o nivel jerárquico de la entidad.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-emerald-400 font-bold">d</td>
                <td className="p-3"><span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded text-[10px]">SÍ</span></td>
                <td className="p-3 font-mono text-white">"M 10 10 L 20 20 Z"</td>
                <td className="p-3 text-slate-400">Cadena matemática de vectores SVG. Puede ser "" placeholder antes de inyectar trazado.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN 2: MAQUETA VISUAL TUTORIAL PASO A PASO CON FLECHAS */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
        <div className="flex items-center space-x-3 border-b border-slate-800/80 pb-4">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <MousePointer size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">2. Maqueta Tutorial: Paso a Paso en el Editor Canvas</h2>
            <p className="text-xs text-slate-400">
              Captura simulada de pantalla con indicación exacta de dónde hacer clic e ingresar datos.
            </p>
          </div>
        </div>

        {/* CONTENEDOR SIMULADOR DE PANTALLA DE CANVAS CON FLECHAS DIBUJADAS */}
        <div className="bg-slate-950 p-5 rounded-2xl border-2 border-dashed border-slate-700 relative overflow-hidden space-y-6">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-mono text-slate-400 ml-2">Súper Editor Vectorial & Calibrador SVG</span>
            </div>
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-bold">
              Modo Interactivo Activo
            </span>
          </div>

          {/* GRID DE SIMULACIÓN DE CANVAS Y PANEL DE PROPIEDADES */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
            
            {/* LADO IZQUIERDO: LIENZO MAPA SVG SIMULADO */}
            <div className="lg:col-span-7 bg-slate-900/90 rounded-xl border border-slate-800 p-4 relative min-h-[320px] flex flex-col justify-between">
              
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                <span className="font-bold text-slate-200">PASO 1: Selección Directa en el Mapa</span>
                <span className="text-emerald-400 font-mono">1. Haz clic sobre una pieza</span>
              </div>

              {/* MAPA VECTORIAL SIMULADO CON FIGURAS DIBUJADAS */}
              <div className="relative my-6 flex items-center justify-center">
                <svg className="w-full h-48 max-w-sm" viewBox="0 0 400 220">
                  {/* País 1 - Inactivo */}
                  <path d="M 30 40 L 120 30 L 150 110 L 50 120 Z" fill="#1e293b" stroke="#334155" strokeWidth="2" className="hover:fill-slate-700 transition-colors cursor-pointer" />
                  <text x="75" y="80" fill="#94a3b8" fontSize="10" fontWeight="bold">NORTEAMÉRICA</text>

                  {/* País 2 - SELECCIONADO (CON DESTELLO VERDE) */}
                  <g className="cursor-pointer">
                    <path d="M 160 80 L 250 60 L 280 150 L 170 170 Z" fill="#065f46" stroke="#10b981" strokeWidth="3" className="animate-pulse" />
                    <text x="185" y="120" fill="#a7f3d0" fontSize="11" fontWeight="extrabold">MÉXICO (MEX)</text>
                    <circle cx="215" cy="115" r="14" fill="#10b981" fillOpacity="0.3" stroke="#10b981" strokeWidth="2" />
                  </g>

                  {/* País 3 - Inactivo */}
                  <path d="M 290 90 L 370 70 L 380 180 L 300 190 Z" fill="#1e293b" stroke="#334155" strokeWidth="2" className="hover:fill-slate-700 transition-colors cursor-pointer" />
                  <text x="315" y="130" fill="#94a3b8" fontSize="10" fontWeight="bold">SUDAMÉRICA</text>
                </svg>

                {/* ANOTACIÓN / FLECHA DE PASO 1 */}
                <div className="absolute top-2 right-2 bg-emerald-950/90 border border-emerald-500 text-emerald-300 p-2.5 rounded-lg shadow-xl text-[11px] max-w-[200px] flex items-start space-x-2 z-20">
                  <span className="text-base">➡️</span>
                  <div>
                    <strong className="block text-white font-bold">1. Haz clic aquí</strong>
                    El polígono seleccionado se resaltará en color verde neón.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-2 rounded text-[10px] font-mono text-slate-400 border border-slate-800 flex justify-between">
                <span>Pieza activa: <strong className="text-emerald-400">MEX</strong></span>
                <span>Coordenadas SVG: <strong className="text-slate-300">d="M 160 80..."</strong></span>
              </div>
            </div>

            {/* FLECHA CONECTOR EN EL MEDIO (DENTRO DEL GRID) */}
            <div className="hidden lg:flex items-center justify-center text-3xl font-black text-emerald-400 animate-bounce">
              ➡️
            </div>

            {/* LADO DERECHO: PANEL DE INSPECTOR / PROPIEDADES SIMULADO */}
            <div className="lg:col-span-4 bg-slate-900/90 rounded-xl border border-slate-800 p-4 space-y-4 relative">
              
              <div className="text-[11px] font-bold text-slate-200 border-b border-slate-800/80 pb-2 flex items-center justify-between">
                <span>INSPECTOR DE PROPIEDADES</span>
                <span className="text-amber-400 font-mono">PASO 2 Y 3</span>
              </div>

              {/* CAMPO 1: ID CÓDIGO DE 3 LETRAS */}
              <div className="space-y-1 relative">
                <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center justify-between">
                  <span>Código ID (ISO 3-Letras)</span>
                  <span className="text-emerald-400 font-mono font-normal">Paso 2 ⬇️</span>
                </label>
                <input 
                  type="text" 
                  readOnly 
                  value="MEX" 
                  className="w-full bg-slate-950 border-2 border-emerald-500/80 text-emerald-300 font-mono font-bold text-xs p-2 rounded shadow-sm focus:outline-none"
                />
                <span className="text-[9px] text-slate-400 block">Ingresa "MEX" para México o "ARG" para Argentina.</span>
              </div>

              {/* CAMPO 2: NOMBRE REAL */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-300">Nombre Visible</label>
                <input 
                  type="text" 
                  readOnly 
                  value="México" 
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs p-2 rounded focus:outline-none"
                />
              </div>

              {/* CAMPO 3: PARENT ID Y CATEGORÍA */}
              <div className="space-y-1 relative">
                <label className="text-[10px] uppercase font-bold text-slate-300 flex items-center justify-between">
                  <span>Parent ID (Nodo Padre)</span>
                  <span className="text-amber-400 font-mono font-normal">Paso 3 ⬇️</span>
                </label>
                <input 
                  type="text" 
                  readOnly 
                  value="MUNDO" 
                  className="w-full bg-slate-950 border-2 border-amber-500/80 text-amber-300 font-mono font-bold text-xs p-2 rounded focus:outline-none"
                />
                <span className="text-[9px] text-slate-400 block">Asigna "MUNDO" o "AMERICA-NORTE".</span>
              </div>

              {/* CAMPO 4: CATEGORÍA */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-300">Categoría</label>
                <select disabled className="w-full bg-slate-950 border border-slate-700 text-slate-300 text-xs p-2 rounded">
                  <option>País</option>
                </select>
              </div>

              {/* BOTÓN GUARDAR SIMULADO */}
              <div className="pt-2">
                <button disabled className="w-full bg-emerald-600 text-white font-bold py-2 rounded text-xs flex items-center justify-center space-x-2 shadow-lg">
                  <Save size={14} />
                  <span>Aplicar Cambios / Guardar</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* SECCIÓN 3: CÓMO IMPORTAR Y GUARDAR JSON CRUDO */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
        <div className="flex items-center space-x-3 border-b border-slate-800/80 pb-4">
          <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <FileJson size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">3. Importación y Guardado Masivo de JSON Crudo</h2>
            <p className="text-xs text-slate-400">
              Procedimiento estándar para cargar vectores provenientes de generadores externos.
            </p>
          </div>
        </div>

        {/* Pasos en Formato Cards Informativas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 relative">
            <div className="w-6 h-6 rounded-full bg-purple-900 text-purple-300 text-xs font-bold flex items-center justify-center">1</div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Upload size={16} className="text-purple-400" />
              Cargar Archivo o Pegar JSON
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Haz clic en el botón <strong>"Subir Archivo .json"</strong> o pega el texto JSON crudo directamente en el cuadro de texto del lienzo.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 relative">
            <div className="w-6 h-6 rounded-full bg-purple-900 text-purple-300 text-xs font-bold flex items-center justify-center">2</div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Sparkles size={16} className="text-amber-400" />
              Asignar IDs y Jerarquía
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Recorre la lista de capas o haz clic en el mapa para asignar el <code className="text-emerald-400 font-mono">id</code> ISO y la clave <code className="text-amber-400 font-mono">parentId</code>.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 relative">
            <div className="w-6 h-6 rounded-full bg-purple-900 text-purple-300 text-xs font-bold flex items-center justify-center">3</div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Save size={16} className="text-emerald-400" />
              Guardar en BD y Exportar
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Presiona <strong>"Guardar en BD"</strong> o <strong>"Exportar Calibrado"</strong> para publicar el mapa en el visor de datos.
            </p>
          </div>

        </div>

        {/* CÓDIGO DE PLANTILLA EJEMPLO COPIABLE */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-emerald-400">Plantilla de Estructura de Salida Esperada (JSON)</span>
            <button
              onClick={() => handleCopyText(exampleJsonSnippet, 'snippet')}
              className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copiedCode === 'snippet' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedCode === 'snippet' ? 'Copiado' : 'Copiar JSON'}</span>
            </button>
          </div>
          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-48 scrollbar-thin">
            {exampleJsonSnippet}
          </pre>
        </div>

      </div>

    </div>
  );
}
