/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Importaciones principales de React y hooks de estado
import React, { useState } from 'react'; // Hook useState para manejar estados locales del componente
// Importaciones de animación fluida con Framer Motion (motion/react)
import { motion, AnimatePresence } from 'motion/react'; // Componentes de movimiento y animación de entrada/salida
// Importación de íconos vectoriales explicativos de Lucide React
import { 
  Globe, 
  HeartPulse, 
  Plus, 
  Lock, 
  FolderPlus, 
  ArrowRight, 
  Sparkles, 
  Layers, 
  Compass, 
  ShieldCheck, 
  Eye, 
  EyeOff,
  Pencil, 
  Activity, 
  MapPin, 
  CheckCircle2, 
  X,
  UserCheck,
  Star,
  Key,
  Crown,
  ChevronRight,
  Share2
} from 'lucide-react'; // Íconos Lucide para representar navegación, categorías y permisos RBAC
// Importación de tipos globales del sistema
import { UserRole, UserProfile, NavNode } from '../types'; // Modelos de datos para roles, perfiles y nodos

// Interfaz de propiedades del componente HomeDashboard (Lobby Hotel 5 Estrellas)
interface HomeDashboardProps {
  userRole: UserRole; // Rol de acceso actual: 'guest' | 'pro' | 'admin'
  currentUser: UserProfile; // Información del perfil de usuario autenticado
  onNavigateToNode: (node: NavNode) => void; // Función para profundizar en la jerarquía del motor vectorial
  onSelectRole?: (role: UserRole) => void; // Callback opcional para alternar roles en pruebas de demostración
}

// Interfaz local para proyectos del creador con estado de visibilidad
interface UserProjectItem {
  id: string; // Identificador único del proyecto
  name: string; // Nombre descriptivo del proyecto
  description: string; // Breve descripción técnica
  type: string; // Tipo de nodo geográfico o anatómico
  isPublic: boolean; // Estado del toggle: true = Público (Catálogo Abierto), false = Oculto (Privado)
  updatedAt: string; // Fecha de última modificación
  category: 'cartografia' | 'salud'; // Categoría principal a la que pertenece
}

// COMPONENTE PRINCIPAL HOMEDASHBOARD (LOBBY DE BIENVENIDA SaaS PREMIUM)
export default function HomeDashboard({
  userRole, // Rol de usuario recibido por props
  currentUser, // Perfil de usuario recibido por props
  onNavigateToNode, // Función de navegación
  onSelectRole // Selector de rol para pruebas
}: HomeDashboardProps) { // Firma del componente funcional
  
  // Estado local para visibilidad del modal de Registro / Paywall Creador PRO
  const [showPaywallModal, setShowPaywallModal] = useState<boolean>(false); // Controla si se abre el modal de suscripción

  // Estado local interactivo para gestionar "Mis Proyectos" y su switch Público/Oculto
  const [myProjects, setMyProjects] = useState<UserProjectItem[]>([ // Lista inicial de proyectos simulados del creador
    {
      id: 'mi_mapa_buenos_aires', // ID del proyecto 1
      name: '📍 Cuencas Hídricas de Buenos Aires', // Nombre
      description: '13 trazados de ríos calibrados con el Súper Editor BoundingBox.', // Descripción
      type: 'provincia', // Tipo
      isPublic: true, // Inicialmente Público
      updatedAt: 'Hace 10 min', // Actualización
      category: 'cartografia' // Categoría
    },
    {
      id: 'mi_corazon_morfologia', // ID del proyecto 2
      name: '🫀 Morfología Cardíaca & Válvulas', // Nombre
      description: 'Esquema de cámaras y presión sanguínea coronaria.', // Descripción
      type: 'anatomia', // Tipo
      isPublic: false, // Inicialmente Oculto / Privado
      updatedAt: 'Ayer', // Actualización
      category: 'salud' // Categoría
    }
  ]); // Fin de inicialización de estado myProjects

  // Evaluación booleana para determinar si el usuario tiene rol Creador (PRO o ADMIN)
  const isCreator = userRole === 'pro' || userRole === 'admin'; // True si es PRO o ADMIN

  // Manejador para alternar el switch "Público / Oculto" de un proyecto en "Mis Proyectos"
  const toggleProjectVisibility = (id: string) => { // Recibe la ID del proyecto a modificar
    setMyProjects((prev) => // Actualiza el arreglo de proyectos
      prev.map((proj) => // Mapea cada proyecto
        proj.id === id ? { ...proj, isPublic: !proj.isPublic } : proj // Invierte el estado isPublic si coincide el ID
      )
    ); // Fin de setMyProjects
  }; // Fin de toggleProjectVisibility

  // Manejador del botón "+ Crear Nuevo Proyecto" (Action Bar / Paywall)
  const handleCreateProjectClick = () => { // Disparado al presionar el botón de creación
    if (!isCreator) { // Si el usuario es un visitante (guest)
      setShowPaywallModal(true); // Despliega el modal Paywall con beneficios PRO
    } else { // Si tiene permisos de creador PRO/ADMIN
      onNavigateToNode({ id: 'nuevo_proyecto', name: 'Nuevo Proyecto Vectorial', type: 'editor' }); // Navega al taller de creación
    } // Fin de condicional
  }; // Fin de handleCreateProjectClick

  return ( // Renderizado principal del marcado JSX del Dashboard
    <div id="home-dashboard-container" className="w-full flex flex-col space-y-8 p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100 font-sans min-h-screen">
      
      {/* 1. SECCIÓN LA PUERTA DE ENTRADA (HERO & ACTION BAR) */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} // Estado inicial de animación entrada
        animate={{ opacity: 1, y: 0 }} // Estado animado final
        transition={{ duration: 0.4 }} // Duración de transición
        id="hero-welcome-section" 
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-6 sm:p-8 shadow-2xl"
      >
        {/* Efectos de luces y resplandor de fondo estilo Hotel 5 Estrellas */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Columna de Bienvenida con Reconocimiento de Nombre y Estatus RBAC */}
          <div className="space-y-3 max-w-3xl">
            {/* Insignia de Estado y Versión del Motor */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Sparkles size={12} className="animate-spin-slow" />
                <span>Motor Universal Vectorial v2.5</span>
              </span>

              {/* Insignia de Estatus del Usuario (Visitante, PRO, Admin) */}
              <span className={`flex items-center space-x-1 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${
                userRole === 'admin' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                userRole === 'pro' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {userRole === 'admin' && <ShieldCheck size={12} className="text-purple-400" />}
                {userRole === 'pro' && <Crown size={12} className="text-amber-400" />}
                {userRole === 'guest' && <Eye size={12} className="text-slate-400" />}
                <span>Estatus: {userRole === 'admin' ? 'Gerente / Admin' : userRole === 'pro' ? 'VIP / Creador Pro' : 'Visitante'}</span>
              </span>
            </div>

            {/* Saludo personalizado en El Hero con Datos del Perfil */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-100 tracking-tight leading-tight">
              {!isCreator ? ( // Saludo para Visitante (Guest)
                <span>Bienvenido al Lobby, <span className="text-emerald-400">{currentUser.name} {currentUser.lastName || ''}</span></span>
              ) : ( // Saludo para VIP Pro / Admin
                <span>Hola, <span className="text-amber-400">{currentUser.name} {currentUser.lastName || ''}</span>. Bienvenido a tu Workspace</span>
              )}
            </h1>

            {/* Muestra el Cargo u Organización si está configurado en el perfil */}
            {(currentUser.position || currentUser.organization) && (
              <p className="text-xs font-bold text-sky-400 flex items-center space-x-2">
                <span>{currentUser.position || ''}</span>
                {currentUser.position && currentUser.organization && <span>•</span>}
                <span className="text-amber-300">{currentUser.organization || ''}</span>
              </p>
            )}

            {/* Subtítulo dinámico de bienvenida */}
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {!isCreator ? ( // Subtítulo visitante
                'Explora libremente el catálogo público de cartografía y anatomía. Para acceder al taller de creación de proyectos personalizados, activa tu membresía Creador PRO.'
              ) : ( // Subtítulo creador
                'Tienes la llave completa del taller vectorial. Diseña, calibra trazados SVG, gestiona la visibilidad pública de tus mapas y colabora en tiempo real.'
              )}
            </p>
          </div>

          {/* El Mostrador de Suscripciones (Action Bar con Botón + Crear Nuevo Proyecto) */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 min-w-[240px]">
            <button
              onClick={handleCreateProjectClick} // Llama al manejador con lógica de Paywall
              className={`flex items-center justify-center space-x-2.5 px-6 py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer ${
                !isCreator
                  ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-950/50 border border-amber-300'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-950/50 border border-emerald-300'
              }`}
            >
              {!isCreator ? ( // Icono y texto para Visitante con candado Paywall
                <>
                  <Lock size={16} className="text-slate-950" />
                  <span>Registrarse para Crear (+ PRO)</span>
                </>
              ) : ( // Icono y texto para Creador Habilitado
                <>
                  <Plus size={18} className="text-slate-950 font-black" />
                  <span>+ Crear Nuevo Proyecto</span>
                </>
              )}
            </button>

            {/* Probador rápido de Roles para demostración en AI Studio */}
            {onSelectRole && (
              <div className="flex items-center space-x-1 bg-slate-950/90 p-1.5 rounded-lg border border-slate-800 text-[10px]">
                <span className="text-slate-500 font-bold px-1">Probar Rol:</span>
                {(['guest', 'pro', 'admin'] as UserRole[]).map((r) => (
                  <button
                    key={r} // Clave de rol
                    onClick={() => onSelectRole(r)} // Cambia el rol
                    className={`px-2 py-0.5 rounded font-bold uppercase transition-colors cursor-pointer ${
                      userRole === r 
                        ? 'bg-emerald-500 text-slate-950 font-black' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* 2. LOS ASCENSORES PRINCIPALES (CATEGORÍAS GRANDES: CARTOGRAFÍA Y SALUD) */}
      <div id="main-categories-section" className="space-y-4">
        {/* Encabezado de la Sección de Categorías */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
              Los Ascensores Principales
            </span>
            <h2 className="text-lg font-extrabold text-slate-100 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <span>Grandes Categorías Estructurales</span>
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">2 Rutas Principales</span>
        </div>

        {/* Cuadrícula Estricta de 2 Tarjetas Inmensas (Gestalt por Proximidad y Contraste) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* TARJETA 1: 🗺️ CARTOGRAFÍA & GEOGRAFÍA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} // Animación inicial
            animate={{ opacity: 1, y: 0 }} // Animación de entrada
            transition={{ duration: 0.3, delay: 0.1 }} // Retardo ligero
            whileHover={{ y: -4, scale: 1.01 }} // Efecto hover de elevación
            whileTap={{ scale: 0.985 }} // Animación al hacer clic
            onClick={() => onNavigateToNode({ id: 'cartografia', name: 'Cartografía & Geografía', type: 'categoria' })} // Navega a la categoría Cartografía
            className="group relative bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 hover:border-emerald-500/70 p-6 rounded-2xl cursor-pointer transition-all shadow-xl hover:shadow-emerald-950/40 flex flex-col justify-between space-y-6 overflow-hidden"
          >
            {/* Luz resplandeciente de fondo */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/25 transition-all pointer-events-none" />

            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl group-hover:bg-emerald-500/20 transition-colors">
                  <Globe className="w-8 h-8 text-emerald-400" />
                </div>
                <span className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-3.5 py-1.5 rounded-full group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                  <span>Entrar al Ascensor</span>
                  <ArrowRight size={14} />
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-100 group-hover:text-emerald-400 transition-colors">
                  🗺️ CARTOGRAFÍA & GEOGRAFÍA
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Mapas vectoriales georreferenciados para la Tierra, continentes, países, provincias y municipios con capas de indicadores socioeconómicos.
                </p>
              </div>
            </div>

            {/* PÍLDORAS CON LA RUTA ESTRICTA: Mundo > Continente > País > Provincia > Municipio */}
            <div className="relative z-10 space-y-2 pt-4 border-t border-slate-800/60">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                Ruta Jerárquica Estricta:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: 'Mundo', step: 1 },
                  { label: 'Continente', step: 2 },
                  { label: 'País', step: 3 },
                  { label: 'Provincia', step: 4 },
                  { label: 'Municipio', step: 5 }
                ].map((item, idx) => (
                  <React.Fragment key={item.label}>
                    <span className="text-[10px] bg-slate-950 border border-slate-800 text-emerald-300/90 px-2.5 py-1 rounded-md font-semibold flex items-center space-x-1">
                      <span className="text-[8px] text-emerald-500/60 font-mono">#{item.step}</span>
                      <span>{item.label}</span>
                    </span>
                    {idx < 4 && <ChevronRight size={12} className="text-slate-600 shrink-0" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </motion.div>

          {/* TARJETA 2: 🧬 SALUD & ANATOMÍA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} // Animación inicial
            animate={{ opacity: 1, y: 0 }} // Animación de entrada
            transition={{ duration: 0.3, delay: 0.2 }} // Retardo ligero
            whileHover={{ y: -4, scale: 1.01 }} // Efecto hover de elevación
            whileTap={{ scale: 0.985 }} // Animación al presionar
            onClick={() => onNavigateToNode({ id: 'salud', name: 'Salud & Anatomía', type: 'categoria' })} // Navega a la categoría Salud
            className="group relative bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 hover:border-rose-500/70 p-6 rounded-2xl cursor-pointer transition-all shadow-xl hover:shadow-rose-950/40 flex flex-col justify-between space-y-6 overflow-hidden"
          >
            {/* Luz resplandeciente de fondo */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/25 transition-all pointer-events-none" />

            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl group-hover:bg-rose-500/20 transition-colors">
                  <HeartPulse className="w-8 h-8 text-rose-400" />
                </div>
                <span className="flex items-center space-x-1.5 text-xs font-bold text-rose-400 bg-rose-950/80 border border-rose-800/80 px-3.5 py-1.5 rounded-full group-hover:bg-rose-500 group-hover:text-slate-950 transition-all">
                  <span>Entrar al Ascensor</span>
                  <ArrowRight size={14} />
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-100 group-hover:text-rose-400 transition-colors">
                  🧬 SALUD & ANATOMÍA
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Modelos biológicos del cuerpo humano, sistemas orgánicos, corazón y diagnóstico médico por capas vectoriales interactivas.
                </p>
              </div>
            </div>

            {/* PÍLDORAS CON LA RUTA ESTRICTA: Organismo > Sistema Orgánico > Órgano Vital > Tejido > Célula */}
            <div className="relative z-10 space-y-2 pt-4 border-t border-slate-800/60">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                Ruta Jerárquica Anatómica:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: 'Organismo', step: 1 },
                  { label: 'Sistema Orgánico', step: 2 },
                  { label: 'Órgano Vital', step: 3 },
                  { label: 'Tejido', step: 4 },
                  { label: 'Célula', step: 5 }
                ].map((item, idx) => (
                  <React.Fragment key={item.label}>
                    <span className="text-[10px] bg-slate-950 border border-slate-800 text-rose-300/90 px-2.5 py-1 rounded-md font-semibold flex items-center space-x-1">
                      <span className="text-[8px] text-rose-500/60 font-mono">#{item.step}</span>
                      <span>{item.label}</span>
                    </span>
                    {idx < 4 && <ChevronRight size={12} className="text-slate-600 shrink-0" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* 3. LA GALERÍA DE ARTE (CATÁLOGO ABIERTO / PROYECTOS DE LA COMUNIDAD) */}
      <div id="open-catalog-section" className="space-y-4 pt-4">
        {/* Encabezado de la Galería de Arte */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">
              La Galería de Arte
            </span>
            <h2 className="text-lg font-extrabold text-slate-100 flex items-center space-x-2">
              <Globe className="w-5 h-5 text-blue-400" />
              <span>Proyectos de la Comunidad (Catálogo Abierto)</span>
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">Modelos Ordenados por Nivel</span>
        </div>

        {/* Rejilla Bento (grid-cols-1 md:grid-cols-3) de Obras Maestras Públicas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Obra 1: Mapamundi Político [Nivel: Mundo] */}
          <motion.div
            whileHover={{ y: -3 }} // Elevación suave
            onClick={() => onNavigateToNode({ id: 'world', name: 'Mapamundi Político', type: 'mundo' })} // Abre Mapamundi
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
                Cartografía
              </span>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                Nivel: Mundo
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                🌍 Mapamundi Político Global
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Estructura con 195 países georreferenciados e indicadores económicos internacionales.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs text-slate-500">
              <span className="font-mono">Por: Sistema Global</span>
              <span className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:underline">
                <span>Ver Mapa</span>
                <Eye size={14} />
              </span>
            </div>
          </motion.div>

          {/* Obra 2: América del Sur [Nivel: Continente] */}
          <motion.div
            whileHover={{ y: -3 }} // Elevación
            onClick={() => onNavigateToNode({ id: 'continent', name: 'América del Sur', type: 'continente' })} // Abre América del Sur
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
                Cartografía
              </span>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                Nivel: Continente
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                🌎 América del Sur & Mercosur
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                12 naciones sudamericanas con desglose de fronteras e integración regional.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs text-slate-500">
              <span className="font-mono">Por: Mercosur Data</span>
              <span className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:underline">
                <span>Ver Mapa</span>
                <Eye size={14} />
              </span>
            </div>
          </motion.div>

          {/* Obra 3: República Argentina [Nivel: País] */}
          <motion.div
            whileHover={{ y: -3 }} // Elevación
            onClick={() => onNavigateToNode({ id: 'country', name: 'Argentina', type: 'pais' })} // Abre Argentina
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
                Cartografía
              </span>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                Nivel: País
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                🇦🇷 República Argentina (Provincias)
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                24 provincias con sus subdivisiones municipales y métricas de Pobreza y Gini.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs text-slate-500">
              <span className="font-mono">Por: INDEC Oficial</span>
              <span className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:underline">
                <span>Ver Mapa</span>
                <Eye size={14} />
              </span>
            </div>
          </motion.div>

          {/* Obra 4: Cuerpo Humano & Órganos [Nivel: Organismo] */}
          <motion.div
            whileHover={{ y: -3 }} // Elevación
            onClick={() => onNavigateToNode({ id: 'cuerpo_humano', name: 'Cuerpo Humano', type: 'anatomia' })} // Abre Anatomía
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/50 p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-950/80 border border-rose-800/80 px-2.5 py-0.5 rounded-full">
                Salud
              </span>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                Nivel: Organismo
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-100 group-hover:text-rose-400 transition-colors">
                🧬 Cuerpo Humano Completo
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Modelo biológico con 12 órganos vitales y diagnóstico por escalas médicas.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs text-slate-500">
              <span className="font-mono">Por: MedTech Bio</span>
              <span className="flex items-center space-x-1 text-rose-400 font-bold group-hover:underline">
                <span>Ver Modelo</span>
                <Eye size={14} />
              </span>
            </div>
          </motion.div>

          {/* Obra 5: Sistema Nervioso Central [Nivel: Sistema Orgánico] */}
          <motion.div
            whileHover={{ y: -3 }} // Elevación
            onClick={() => onNavigateToNode({ id: 'sistema_nervioso', name: 'Sistema Nervioso', type: 'anatomia' })} // Abre Sistema Nervioso
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/50 p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-950/80 border border-rose-800/80 px-2.5 py-0.5 rounded-full">
                Salud
              </span>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                Nivel: Sistema Orgánico
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-100 group-hover:text-rose-400 transition-colors">
                🧠 Sistema Nervioso Central
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Red de cerebro, médula espinal y vías neuronales vectoriales interconectadas.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs text-slate-500">
              <span className="font-mono">Por: NeuroLab SVG</span>
              <span className="flex items-center space-x-1 text-rose-400 font-bold group-hover:underline">
                <span>Ver Modelo</span>
                <Eye size={14} />
              </span>
            </div>
          </motion.div>

          {/* Obra 6: Válvulas Cardíacas [Nivel: Órgano Vital] */}
          <motion.div
            whileHover={{ y: -3 }} // Elevación
            onClick={() => onNavigateToNode({ id: 'corazon_valvulas', name: 'Corazón & Válvulas', type: 'anatomia' })} // Abre Corazón
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/50 p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-950/80 border border-rose-800/80 px-2.5 py-0.5 rounded-full">
                Salud
              </span>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                Nivel: Órgano Vital
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-100 group-hover:text-rose-400 transition-colors">
                🫀 Corazón & Aurículas
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Despiece anatómico del miocardio con trazados vectoriales de precisión.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs text-slate-500">
              <span className="font-mono">Por: CardioTech</span>
              <span className="flex items-center space-x-1 text-rose-400 font-bold group-hover:underline">
                <span>Ver Modelo</span>
                <Eye size={14} />
              </span>
            </div>
          </motion.div>

        </div>
      </div>

      {/* 4. LOS TALLERES PRIVADOS: "MIS PROYECTOS CREADOS" (CONDICIONAL ROL PRO / ADMIN CON SWITCH PÚBLICO/OCULTO) */}
      {isCreator && ( // Solo visible si userRole es pro o admin
        <motion.div 
          initial={{ opacity: 0, y: 20 }} // Animación de entrada
          animate={{ opacity: 1, y: 0 }} // Animación visible
          id="my-projects-section" 
          className="space-y-4 pt-6 border-t border-slate-800/80"
        >
          {/* Encabezado del Taller Privado */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                Los Talleres Privados (VIP)
              </span>
              <h2 className="text-lg font-extrabold text-slate-100 flex items-center space-x-2">
                <FolderPlus className="w-5 h-5 text-amber-400" />
                <span>Mis Proyectos Creados</span>
              </h2>
            </div>
            <span className="text-xs text-amber-400/90 font-mono flex items-center space-x-1">
              <Key size={14} />
              <span>Acceso Exclusivo Creador</span>
            </span>
          </div>

          {/* Lista/Tabla de Proyectos Creados con Switch Interactivo de Visibilidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            
            {myProjects.map((proj) => ( // Renderizado de la lista interactiva de proyectos
              <div 
                key={proj.id} // Clave del proyecto
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-5 rounded-2xl transition-all flex flex-col justify-between space-y-4 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    proj.category === 'cartografia' ? 'text-amber-400 bg-amber-950/80 border border-amber-800/80' : 'text-rose-400 bg-rose-950/80 border border-rose-800/80'
                  }`}>
                    {proj.category.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{proj.updatedAt}</span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-slate-100">
                    {proj.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {proj.description}
                  </p>
                </div>

                {/* Switch / Toggle Simulado e Interactivo: Público vs Oculto */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/60">
                  {/* Botón para Abrir en el Editor */}
                  <button
                    onClick={() => onNavigateToNode({ id: proj.id, name: proj.name, type: 'editor' })} // Abre proyecto en el editor
                    className="flex items-center space-x-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    <Pencil size={14} />
                    <span>Abrir Editor</span>
                  </button>

                  {/* Switch Interactivo de Visibilidad (Público/Oculto) */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold text-slate-400">
                      {proj.isPublic ? 'Público' : 'Oculto'}
                    </span>
                    <button
                      onClick={() => toggleProjectVisibility(proj.id)} // Invierte el estado de visibilidad
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        proj.isPublic ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                      title={proj.isPublic ? 'Publicado en el Catálogo Abierto' : 'Privado / Oculto en tu taller'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                          proj.isPublic ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      >
                        {proj.isPublic ? (
                          <Eye size={10} className="text-emerald-400" />
                        ) : (
                          <EyeOff size={10} className="text-slate-400" />
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Tarjeta para Crear un Proyecto en Blanco Rápidamente */}
            <div
              onClick={handleCreateProjectClick} // Llama al manejador de creación
              className="border-2 border-dashed border-slate-800 hover:border-emerald-500/60 p-5 rounded-2xl transition-all flex flex-col items-center justify-center space-y-3 cursor-pointer bg-slate-950 hover:bg-slate-900/50 group text-center min-h-[160px]"
            >
              <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                <Plus size={22} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition-colors block">
                  + Crear Proyecto en Blanco
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Diseña o importa trazados SVG personalizados
                </span>
              </div>
            </div>

          </div>
        </motion.div>
      )}

      {/* 5. MODAL EL MOSTRADOR DE SUSCRIPCIONES (PAYWALL / VENTANA PRO) */}
      <AnimatePresence>
        {showPaywallModal && ( // Renderiza cuando showPaywallModal es true
          <motion.div
            initial={{ opacity: 0 }} // Entrada suave
            animate={{ opacity: 1 }} // Estado activo
            exit={{ opacity: 0 }} // Salida
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} // Escala inicial
              animate={{ scale: 1, opacity: 1 }} // Escala completa
              exit={{ scale: 0.95, opacity: 0 }} // Escala de salida
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6"
            >
              {/* Botón para cerrar el modal Paywall */}
              <button
                onClick={() => setShowPaywallModal(false)} // Cierra el modal
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                    <Crown size={22} />
                  </div>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
                    Pase VIP Creador PRO
                  </span>
                </div>
                <h3 className="text-2xl font-black text-slate-100">
                  Desbloquea el Taller de Creación Vectorial
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Los visitantes pueden explorar todos los mapas y modelos públicos. Para crear mapas propios, calibrar polígonos SVG y publicar proyectos en el catálogo, activa tu membresía de **Creador PRO**.
                </p>
              </div>

              {/* Lista de Beneficios Exclusivos PRO */}
              <div className="space-y-2.5 bg-slate-950/90 p-4.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                {[
                  'Taller privado para crear proyectos ilimitados',
                  'Importador y calibrador de trazados SVG externos',
                  'Inspector visual de polígonos estilo Figma',
                  'Control de visibilidad (Switch Público / Oculto)',
                  'Exportación estándar en formatos GeoJSON y JSON'
                ].map((benefit, i) => (
                  <div key={i} className="flex items-start space-x-2.5">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>

              {/* Botones de Acción para Cambiar de Rol en Demostración */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (onSelectRole) onSelectRole('pro'); // Activa rol de Creador PRO
                    setShowPaywallModal(false); // Cierra el modal
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xl cursor-pointer transition-all flex items-center justify-center space-x-2 border border-amber-300"
                >
                  <UserCheck size={18} />
                  <span>Activar Pase Creador PRO (Prueba Gratuita)</span>
                </button>

                <button
                  onClick={() => setShowPaywallModal(false)} // Cierra y se mantiene como visitante
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Seguir Explorando el Catálogo como Visitante
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  ); // Fin de retorno JSX
} // Fin del componente HomeDashboard
