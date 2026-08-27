/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// IMPORTACIONES DE REACT Y HOOKS BASE
import React, { useState, useMemo } from 'react'; // Importa React y los hooks useState y useMemo para estados y memoización

// IMPORTACIÓN DE ÍCONOS VECTORIALES DE LUCIDE-REACT
import { 
  FileText, // Ícono de documento de texto o PDF
  Download, // Ícono de descarga / guardar como
  User, // Ícono de usuario genérico
  CheckCircle2, // Ícono de verificación
  Shield, // Ícono de escudo de seguridad
  ShieldAlert, // Ícono de alerta de seguridad
  ShieldCheck, // Ícono de seguridad verificada
  LogOut, // Ícono de cerrar sesión
  LogIn, // Ícono de iniciar sesión
  Mail, // Ícono de correo electrónico
  Lock, // Ícono de candado para contraseña
  ChevronDown, // Ícono de flecha desplegable hacia abajo
  Star, // Ícono de estrella
  MapPin, // Ícono de pin de ubicación geográfica
  ChevronRight, // Ícono de flecha hacia la derecha para breadcrumbs
  Edit, // Ícono de edición / lápiz
  Briefcase, // Ícono de maletín para cargo laboral
  Building, // Ícono de edificio para empresa u organización
  Search, // Ícono de lupa de búsqueda
  Compass, // Ícono de brújula de navegación
  Layers, // Ícono de capas territoriales
  Globe, // Ícono de globo terráqueo para países
  FilePlus, // Ícono de nuevo proyecto
  FolderOpen, // Ícono de abrir archivo/proyecto
  Save, // Ícono de disco/guardar
  XCircle, // Ícono de cerrar proyecto
  Cloud, // Ícono de nube / base de datos y drive
  AlertTriangle, // Ícono de advertencia para diálogo de cambios sin guardar
  Trash2, // Ícono para descartar cambios
  X, // Ícono de cerrar toast
  Sparkles // Ícono de confirmación o éxito
} from 'lucide-react'; // Colección de íconos UI

// IMPORTACIÓN DE TIPOS Y MODELOS DE DATOS DE TYPESCRIPT
import { UserRole, RegionNode, UserProfile } from '../types'; // Tipos de datos para roles RBAC, nodos geográficos y perfiles

// INTERFAZ PARA LAS OPCIONES DE SUBDIVISIONES EN EL MENÚ DESPLEGABLE
export interface SubdivisionOption {
  id: string; // Identificador único de la subdivisión geográfica (ej. AR-M)
  name: string; // Nombre amigable (ej. Mendoza)
  value?: number; // Valor numérico o porcentaje asociado opcional
} // Fin de SubdivisionOption

// INTERFAZ QUE DEFINE TODAS LAS PROPIEDADES (PROPS) ACEPTADAS POR EL HEADER
interface HeaderProps {
  isAdmin: boolean; // Indica si el rol de administrador está activo
  userRole?: UserRole; // Rol RBAC del usuario ('guest' | 'pro' | 'admin')
  currentUser?: UserProfile; // Objeto con la información de perfil del usuario
  onOpenProfileModal?: () => void; // Disparador para abrir el modal de edición de perfil
  onLogin: (remember: boolean) => void; // Disparador para iniciar sesión
  onLogout: () => void; // Disparador para cerrar sesión
  onSelectRole?: (role: UserRole) => void; // Disparador para cambiar de rol directamente
  navigationPath?: any[]; // Historial de ruta activa para las migas de pan globales
  onBreadcrumbClick?: (index: number) => void; // Manejador de clics en las migas de pan
  subdivisions?: SubdivisionOption[]; // Lista de subdivisiones o municipios del nodo activo
  onSelectSubdivision?: (id: string) => void; // Disparador para seleccionar una subdivisión
  // PROPIEDADES DEL GESTOR DE CICLO DE VIDA DE PROYECTOS (PROJECT LIFECYCLE MANAGEMENT)
  projectName?: string; // Nombre editable del proyecto activo
  isDirty?: boolean; // Indicador booleano de cambios sin guardar en el proyecto
  isSaving?: boolean; // Indicador booleano de guardado en proceso
  lastSaveStatus?: { destination: string; time: string } | null; // Información de la última operación de guardado
  onProjectNameChange?: (name: string) => void; // Manejador para actualizar el nombre del proyecto
  onNewProject?: () => void; // Disparador para inicializar un proyecto nuevo en blanco
  onOpenProject?: () => void; // Disparador para abrir un proyecto desde archivo local JSON
  onSaveProject?: () => void; // Disparador para guardar cambios (in-place sobreescribir o guardar como)
  onSaveAsProject?: () => void; // Disparador para exportar o Guardar Como nuevo archivo JSON
  onCloseProject?: () => void; // Disparador para cerrar el proyecto activo y limpiar lienzo
  onOpenDestinationsModal?: (initialTab?: 'save' | 'open_db' | 'open_drive' | 'open_disk' | 'conflict') => void; // Disparador para abrir el Centro de Persistencia
} // Fin de HeaderProps

// COMPONENTE HEADER: CABECERA PRINCIPAL CON NAVEGACIÓN, GESTIÓN DE PROYECTOS Y BARRA RBAC
export default function Header({ 
  isAdmin, // Destructura isAdmin de las props
  userRole = 'guest', // Destructura userRole con valor por defecto 'guest'
  currentUser, // Destructura currentUser de las props
  onOpenProfileModal, // Destructura onOpenProfileModal
  onLogin, // Destructura onLogin
  onLogout, // Destructura onLogout
  onSelectRole, // Destructura onSelectRole
  navigationPath = [], // Destructura navigationPath con arreglo vacío por defecto
  onBreadcrumbClick, // Destructura onBreadcrumbClick
  subdivisions = [], // Destructura subdivisions con arreglo vacío por defecto
  onSelectSubdivision, // Destructura onSelectSubdivision
  projectName = 'Proyecto Sin Título', // Destructura projectName con título por defecto
  isDirty = false, // Destructura isDirty con false por defecto
  isSaving = false, // Destructura isSaving con false por defecto
  lastSaveStatus = null, // Destructura lastSaveStatus
  onProjectNameChange, // Destructura onProjectNameChange
  onNewProject, // Destructura onNewProject
  onOpenProject, // Destructura onOpenProject
  onSaveProject, // Destructura onSaveProject
  onSaveAsProject, // Destructura onSaveAsProject
  onCloseProject, // Destructura onCloseProject
  onOpenDestinationsModal // Destructura onOpenDestinationsModal
}: HeaderProps) { // Firma del componente Header

  // ESTADO PARA GESTIONAR LA EXPORTACIÓN DE REPORTES (PDF O EXCEL)
  const [exporting, setExporting] = useState<string | null>(null); // Nombre del formato en proceso de exportación o null
  // ESTADO PARA MOSTRAR/OCULTAR EL MENÚ DESPLEGABLE DEL PERFIL DE USUARIO
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false); // Visibilidad del panel de perfil y login
  // ESTADO PARA MOSTRAR/OCULTAR EL MENÚ DESPLEGABLE DEL SELECTOR TERRITORIAL
  const [showSelectionMenu, setShowSelectionMenu] = useState<boolean>(false); // Visibilidad del panel de índice territorial
  // ESTADO PARA EL FILTRO DE BÚSQUEDA DENTRO DEL DESPLEGABLE TERRITORIAL
  const [subSearch, setSubSearch] = useState<string>(''); // Cadena ingresada por el usuario para filtrar
  // ESTADOS PARA CAMPOS DEL FORMULARIO DE INICIO DE SESIÓN MANUAL
  const [emailInput, setEmailInput] = useState<string>(''); // Estado del campo de correo electrónico
  const [passwordInput, setPasswordInput] = useState<string>(''); // Estado del campo de contraseña
  const [rememberMe, setRememberMe] = useState<boolean>(false); // Estado del checkbox de recordar sesión
  const [loginError, setLoginError] = useState<string | null>(null); // Estado para almacenar mensajes de error de acceso

  // ESTADO PARA EL MODAL DE CONFIRMACIÓN DE CIERRE CUANDO HAY CAMBIOS SIN GUARDAR
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState<boolean>(false); // Modal de seguridad al cerrar
  // ESTADO PARA LA NOTIFICACIÓN TOAST SUTIL DE "TRABAJO GUARDADO" (AUTO-DISMISS EN 3.5 SEGUNDOS)
  const [saveToast, setSaveToast] = useState<{ show: boolean; message: string; details?: string; timestamp?: string } | null>(null);

  // EFECTO REACTIVO: DISPARA EL TOAST SUTIL CUANDO SE REGISTRA UN GUARDADO EXITOSO
  React.useEffect(() => {
    if (lastSaveStatus) {
      setSaveToast({
        show: true,
        message: 'Trabajo guardado correctamente',
        details: lastSaveStatus.destination || 'Proyecto actualizado',
        timestamp: lastSaveStatus.time || new Date().toLocaleTimeString()
      });
      const timer = setTimeout(() => {
        setSaveToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [lastSaveStatus]);

  // ESCUCHA EVENTOS GLOBALES DE GUARDADO
  React.useEffect(() => {
    const handleSavedEvent = () => {
      setSaveToast({
        show: true,
        message: 'Trabajo guardado correctamente',
        details: 'Cambios sincronizados en el proyecto activo',
        timestamp: new Date().toLocaleTimeString()
      });
      const timer = setTimeout(() => {
        setSaveToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    };
    window.addEventListener('projectDataSaved', handleSavedEvent);
    return () => window.removeEventListener('projectDataSaved', handleSavedEvent);
  }, []);

  // MANEJADOR INTERNO DE CLIC EN BOTÓN GUARDAR
  const handleSaveClick = async () => {
    if (onSaveProject) {
      await onSaveProject();
      setSaveToast({
        show: true,
        message: 'Trabajo guardado correctamente',
        details: 'Cambios sincronizados en el proyecto activo',
        timestamp: new Date().toLocaleTimeString()
      });
      setTimeout(() => {
        setSaveToast(null);
      }, 3500);
    }
  };

  // MANEJADOR INTERNO DE CLIC EN BOTÓN CERRAR CON DETECCIÓN DE CAMBIOS SIN GUARDAR
  const handleCloseClick = () => {
    if (isDirty) {
      setIsCloseConfirmOpen(true); // Abre modal de confirmación
    } else {
      if (onCloseProject) onCloseProject(); // Cierra de inmediato
    }
  };

  // ACCIÓN DE GUARDAR Y CERRAR DESDE EL MODAL
  const handleConfirmSaveAndClose = async () => {
    setIsCloseConfirmOpen(false);
    if (onSaveProject) {
      await onSaveProject();
    }
    if (onCloseProject) {
      onCloseProject();
    }
  };

  // ACCIÓN DE DESCARTAR Y CERRAR SIN GUARDAR
  const handleConfirmDiscardAndClose = () => {
    setIsCloseConfirmOpen(false);
    if (onCloseProject) {
      onCloseProject();
    }
  };

  // NODO ACTIVO ACTUAL EXTRAÍDO DINÁMICAMENTE DEL ÚLTIMO ELEMENTO DE NAVIGATIONPATH
  const activeNode = navigationPath && navigationPath.length > 0 ? navigationPath[navigationPath.length - 1] : { id: 'root', name: 'Inicio' }; // Obtiene el nodo terminal
  
  // ESTADO PARA LA BÚSQUEDA ASISTIDA GLOBAL ESTILO GOOGLE
  const [assistedSearch, setAssistedSearch] = useState<string>(''); // Término para la búsqueda asistida global
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false); // Controla la visibilidad de sugerencias
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({ // Estado de acordeones colapsables
    paises: false, // Sección de países desplegada por defecto
    provincias: false, // Sección de provincias desplegada por defecto
    subdivisiones: false // Sección de subdivisiones locales colapsada por defecto
  }); // Fin del estado collapsedSections

  // CATÁLOGO COMPLETO GLOBAL DE PAÍSES PARA EL BUSCADOR ASISTIDO TIPO GOOGLE
  const globalCountriesCatalog = useMemo(() => [ // Arreglo memorizado de países
    { id: 'AR', name: 'Argentina (República Argentina)', flag: '🇦🇷', level: 'country', category: 'País / Nacional' },
    { id: 'BR', name: 'Brasil (República Federativa do Brasil)', flag: '🇧🇷', level: 'country', category: 'País / Internacional' },
    { id: 'CL', name: 'Chile (República de Chile)', flag: '🇨🇱', level: 'country', category: 'País / Internacional' },
    { id: 'UY', name: 'Uruguay (República Oriental del Uruguay)', flag: '🇺🇾', level: 'country', category: 'País / Internacional' },
    { id: 'CO', name: 'Colombia (República de Colombia)', flag: '🇨🇴', level: 'country', category: 'País / Internacional' },
    { id: 'PE', name: 'Perú (República del Perú)', flag: '🇵🇪', level: 'country', category: 'País / Internacional' },
    { id: 'MX', name: 'México (Estados Unidos Mexicanos)', flag: '🇲🇽', level: 'country', category: 'País / Internacional' },
    { id: 'ES', name: 'España (Reino de España)', flag: '🇪🇸', level: 'country', category: 'País / Internacional' },
    { id: 'US', name: 'Estados Unidos (United States of America)', flag: '🇺🇸', level: 'country', category: 'País / Internacional' }
  ], []); // Fin de globalCountriesCatalog

  // CATÁLOGO COMPLETO DE LAS 24 PROVINCIAS DE ARGENTINA ORDENADAS ALFABÉTICAMENTE A-Z
  const globalProvincesCatalog = useMemo(() => [ // Arreglo memorizado de las 24 provincias
    { id: 'AR-B', name: 'Buenos Aires', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-C', name: 'CABA (Ciudad Autónoma de Buenos Aires)', flag: '🇦🇷', category: 'Provincia / Capital' },
    { id: 'AR-K', name: 'Catamarca', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-H', name: 'Chaco', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-U', name: 'Chubut', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-X', name: 'Córdoba', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-W', name: 'Corrientes', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-E', name: 'Entre Ríos', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-P', name: 'Formosa', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-Y', name: 'Jujuy', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-L', name: 'La Pampa', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-F', name: 'La Rioja', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-M', name: 'Mendoza', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-N', name: 'Misiones', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-Q', name: 'Neuquén', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-R', name: 'Río Negro', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-A', name: 'Salta', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-J', name: 'San Juan', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-D', name: 'San Luis', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-Z', name: 'Santa Cruz', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-S', name: 'Santa Fe', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-G', name: 'Santiago del Estero', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-V', name: 'Tierra del Fuego', flag: '🇦🇷', category: 'Provincia Argentina' },
    { id: 'AR-T', name: 'Tucumán', flag: '🇦🇷', category: 'Provincia Argentina' }
  ].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })), []); // Orden alfabético estricto A-Z

  // FILTRADO DE RESULTADOS DE PAÍSES SEGÚN EL TEXTO INGRESADO
  const filteredCountries = useMemo(() => { // Filtra países según la consulta
    if (!subSearch && !assistedSearch) return globalCountriesCatalog; // Devuelve todos si no hay filtro
    const term = (subSearch || assistedSearch).toLowerCase().trim(); // Normaliza el término de búsqueda
    return globalCountriesCatalog.filter(c => // Filtra coincidencias
      c.name.toLowerCase().includes(term) || c.id.toLowerCase().includes(term) // Compara por nombre o ID
    ); // Fin de filter
  }, [subSearch, assistedSearch, globalCountriesCatalog]); // Dependencias del memo

  // FILTRADO DE RESULTADOS DE PROVINCIAS SEGÚN EL TEXTO INGRESADO
  const filteredProvinces = useMemo(() => { // Filtra provincias según la consulta
    if (!subSearch && !assistedSearch) return globalProvincesCatalog; // Devuelve todas si no hay filtro
    const term = (subSearch || assistedSearch).toLowerCase().trim(); // Normaliza el término
    return globalProvincesCatalog.filter(p => // Filtra coincidencias
      p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term) // Compara por nombre o ID
    ); // Fin de filter
  }, [subSearch, assistedSearch, globalProvincesCatalog]); // Dependencias del memo

  // ALTERNAR EL ESTADO COLAPSABLE DE UNA SECCIÓN DEL ACORDEÓN
  const toggleSubListSection = (sectionKey: string) => { // Función para abrir/cerrar acordeón
    setCollapsedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] })); // Invierte el estado booleano de la clave
  }; // Fin de toggleSubListSection

  // MANEJADOR DE EXPORTACIÓN DE REPORTES (PDF Y EXCEL)
  const handleExport = (type: 'PDF' | 'Excel') => { // Inicia la exportación
    setExporting(type); // Establece el formato en progreso
    setTimeout(() => { // Simula proceso asíncrono
      setExporting(null); // Resetea el estado
      alert(`Éxito: Reporte exportado a formato ${type} correctamente.`); // Muestra notificación de éxito
    }, 1500); // 1.5 segundos de retraso
  }; // Fin de handleExport

  // MANEJADOR DE INICIO DE SESIÓN MANUAL CON CREDENCIALES
  const handleManualLogin = (e: React.FormEvent) => { // Procesa el formulario de acceso
    e.preventDefault(); // Evita recarga por defecto
    if (!emailInput || !passwordInput) { // Valida campos incompletos
      setLoginError('Por favor completa todos los campos.'); // Muestra error
      return; // Detiene
    } // Fin de validación
    if (emailInput !== 'magritted12@gmail.com' || passwordInput !== 'omarMagritted!') { // Valida credenciales
      setLoginError('Credenciales incorrectas. Verifique el correo o contraseña de administrador.'); // Error
      return; // Detiene
    } // Fin de validación
    setLoginError(null); // Limpia errores
    if (onSelectRole) onSelectRole('admin'); // Asigna el rol de administrador
    onLogin(rememberMe); // Inicia sesión
    setShowProfileMenu(false); // Cierra el menú de perfil
  }; // Fin de handleManualLogin

  // MANEJADOR DE INICIO DE SESIÓN SIMULADO CON GOOGLE
  const handleGoogleLogin = () => { // Acceso rápido con Google
    setLoginError(null); // Limpia errores
    setEmailInput('magritted12@gmail.com'); // Asigna el correo de admin
    if (onSelectRole) onSelectRole('admin'); // Asigna rol admin
    onLogin(rememberMe); // Inicia sesión
    setShowProfileMenu(false); // Cierra menú
  }; // Fin de handleGoogleLogin

  // ETIQUETA AMIGABLE Y ESTILO VISUAL SEGÚN EL ROL RBAC ACTUAL
  const roleLabel = userRole === 'admin' ? 'SUPER ADMIN' : userRole === 'pro' ? 'USUARIO PRO' : 'INVITADO'; // Texto del rol
  const roleBadgeColor = userRole === 'admin' ? 'text-emerald-400 border-emerald-500/50' : userRole === 'pro' ? 'text-amber-400 border-amber-500/50' : 'text-slate-400 border-slate-800'; // Clases de color

  return ( // Renderizado del JSX del componente Header
    <header id="app-header" className="bg-slate-950/70 backdrop-blur-md border-b border-slate-800 py-3 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-50">
      
      {/* SECCIÓN 1: EMBLEMA PATRIO Y NOMBRE DE MARCA */}
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

      {/* SECCIÓN 2: BARRA DE GESTIÓN DEL CICLO DE VIDA DEL PROYECTO (PROJECT LIFECYCLE MANAGEMENT) */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
        
        {/* Campo editable para el Nombre del Proyecto e Indicador de Cambios sin Guardar (Dirty Badge) */}
        <div className="flex items-center space-x-2 bg-slate-950/80 border border-slate-800 focus-within:border-sky-500/80 rounded-xl px-2.5 py-1 transition-all">
          <FileText size={14} className="text-sky-400 shrink-0" />
          <div className="flex items-center space-x-1">
            <input
              type="text"
              value={projectName}
              onChange={(e) => onProjectNameChange && onProjectNameChange(e.target.value)}
              placeholder="Nombre del Proyecto..."
              className="bg-transparent text-xs font-black text-slate-100 outline-hidden w-32 md:w-44 placeholder:text-slate-500 tracking-wide"
              title="Haz clic para cambiar el nombre del proyecto activo en caliente"
            />
            {/* Indicador visual animado si existen cambios sin guardar en el proyecto (Punto rojo parpadeante) */}
            {isDirty && (
              <span 
                className="flex items-center justify-center w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.9)]" 
                title="Cambios sin guardar en el proyecto (*)"
              />
            )}
          </div>
        </div>

        {/* Grupo de Acciones Directas del Proyecto: Nuevo, Abrir, Guardar (In-Place), Guardar Como y Cerrar */}
        <div className="flex items-center space-x-1">
          {/* Botón 📄 Nuevo Proyecto */}
          <button
            type="button"
            onClick={onNewProject}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 border border-slate-700/80"
            title="Inicializar un lienzo limpio para un nuevo proyecto (📄)"
          >
            <FilePlus size={13} className="text-emerald-400" />
            <span className="hidden sm:inline">Nuevo</span>
          </button>

          {/* Botón 📂 Abrir Proyecto */}
          <button
            type="button"
            onClick={onOpenProject}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 border border-slate-700/80"
            title="Abrir un archivo .json de proyecto local desde tu computadora (📂)"
          >
            <FolderOpen size={13} className="text-amber-400" />
            <span className="hidden sm:inline">Abrir</span>
          </button>

          {/* Botón 💾 Guardar Proyecto (Sobreescritura directa In-Place en disco con feedback reactivo de cambios pendientes) */}
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSaving}
            className={`px-3 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center space-x-1.5 border relative ${
              isDirty 
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700/80'
            } ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
            title={
              isDirty 
                ? "Hay cambios sin guardar (*). Haz clic aquí para guardar los cambios en el proyecto (💾)" 
                : "Guardar proyecto (💾)"
            }
          >
            <Save size={13} className={isDirty ? 'text-amber-400 animate-pulse' : 'text-sky-400'} />
            <span className="hidden sm:inline">Guardar</span>
            {/* Indicador sutil de cambios pendientes que desaparece al guardar */}
            {isDirty && (
              <span 
                className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping ml-0.5" 
                title="Cambios pendientes sin guardar"
              />
            )}
          </button>

          {/* Botón 📥 Guardar Como... (Seleccionar nueva ubicación o descargar archivo nuevo) */}
          <button
            type="button"
            onClick={onSaveAsProject}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 border border-slate-700/80"
            title="Guardar como un nuevo archivo .json con otro nombre o en otra ubicación (📥)"
          >
            <Download size={13} className="text-purple-400" />
            <span className="hidden sm:inline">Guardar Como...</span>
          </button>

          {/* Botón ☁️ / 🗄️ Persistencia Multidestino: Base de Datos y Drive */}
          {onOpenDestinationsModal && (
            <button
              type="button"
              onClick={() => onOpenDestinationsModal('save')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-emerald-950/80 text-emerald-300 hover:text-emerald-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 border border-slate-700/80 hover:border-emerald-700/80"
              title="Centro de Persistencia: Guardar y sincronizar en Base de Datos (Cloud SQL), Drive y Disco (🗄️)"
            >
              <Cloud size={13} className="text-emerald-400" />
              <span className="hidden lg:inline">BD / Nube</span>
            </button>
          )}

          {/* Botón ❌ Cerrar Proyecto (Con detección de seguridad si hay cambios sin guardar) */}
          <button
            type="button"
            onClick={handleCloseClick}
            className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/80 text-rose-300 hover:text-rose-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 border border-slate-700/80 hover:border-rose-800/80"
            title="Cerrar el proyecto activo y desvincular el archivo de disco (❌)"
          >
            <XCircle size={13} className="text-rose-400" />
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN 3: SELECTOR DINÁMICO DE RUTA E ÍNDICE DE SELECCIÓN TERRITORIAL */}
      <div className="relative flex-1 max-w-md mx-2">
        <button
          onClick={() => setShowSelectionMenu(!showSelectionMenu)}
          className="w-full bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 rounded-xl py-1.5 px-3 flex items-center justify-between text-xs transition-all cursor-pointer shadow-inner group"
          title="Abrir Índice de Selección y Lista de Subdivisiones"
        >
          <div className="flex items-center space-x-2 overflow-hidden">
            <MapPin size={14} className="text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
            <div className="text-left truncate">
              <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block -mb-0.5">
                Ruta Activa & Selector
              </span>
              <span className="font-extrabold text-slate-200 truncate block">
                {navigationPath && navigationPath.length > 0 
                  ? navigationPath.map(n => n.name).join(' › ')
                  : 'Inicio › República Argentina'}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1 pl-2 border-l border-slate-800 shrink-0">
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-black border border-emerald-500/20">
              {subdivisions.length > 0 ? `${subdivisions.length} sub` : 'Índice'}
            </span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${showSelectionMenu ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* MENÚ DESPLEGABLE FLOTANTE: ÍNDICE DE SELECCIÓN Y SUBDIVISIONES */}
        {showSelectionMenu && (
          <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 text-slate-200 space-y-3 min-w-[320px]">
            {/* Encabezado del desplegable */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <Compass size={16} className="text-emerald-400" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-100">
                    Índice de Selección / Ruta
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Nodo Activo: <strong className="text-emerald-400">{activeNode.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSelectionMenu(false)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Eslabones de la Ruta Actual (Breadcrumb Trail en desplegable) */}
            {navigationPath && navigationPath.length > 0 && (
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">
                  Historial de Ruta:
                </span>
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  {navigationPath.map((node, idx) => {
                    const isLast = idx === navigationPath.length - 1;
                    return (
                      <React.Fragment key={`${node.id}-${idx}`}>
                        <button
                          onClick={() => {
                            if (onBreadcrumbClick) onBreadcrumbClick(idx);
                            setShowSelectionMenu(false);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                            isLast
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer'
                          }`}
                        >
                          {node.name}
                        </button>
                        {!isLast && <span className="text-slate-600 text-[9px]">›</span>}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BUSCADOR ASISTIDO TIPO GOOGLE Y SUB-LISTAS COLAPSABLES DEL ACORDEÓN */}
            <div className="space-y-3 pt-1">
              {/* Buscador Asistido estilo Google */}
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-emerald-400" />
                <input
                  type="text"
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  placeholder="🔍 Buscador asistido Google: escribe un país o provincia..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-xl py-1.5 pl-9 pr-8 text-xs text-slate-100 placeholder:text-slate-500 outline-hidden transition-all shadow-inner"
                />
                {subSearch && (
                  <button
                    onClick={() => setSubSearch('')}
                    className="absolute right-2.5 text-slate-500 hover:text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                
                {/* SUB-LISTA 1: PAÍSES Y NIVELES MACRO (ACORDEÓN PLEGABLE) */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSubListSection('paises')}
                    className="w-full bg-slate-900/80 hover:bg-slate-900 px-3 py-2 flex items-center justify-between text-left text-xs font-bold text-slate-200 transition-colors border-b border-slate-800 cursor-pointer"
                  >
                    <span className="flex items-center space-x-1.5 text-emerald-400">
                      <Globe size={13} />
                      <span className="uppercase text-[10px] tracking-wider font-extrabold text-slate-200">1. Países / Niveles Macro ({filteredCountries.length})</span>
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${collapsedSections.paises ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {!collapsedSections.paises && (
                    <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-950/60">
                      {filteredCountries.map((country) => (
                        <button
                          key={country.id}
                          onClick={() => {
                            if (onSelectSubdivision) onSelectSubdivision(country.id);
                            setShowSelectionMenu(false);
                          }}
                          className="p-2 bg-slate-900 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/50 rounded-lg text-left transition-all cursor-pointer flex items-center space-x-2 group"
                        >
                          <span className="text-sm">{country.flag}</span>
                          <div className="truncate">
                            <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-300 block truncate">
                              {country.name}
                            </span>
                            <span className="text-[9px] text-slate-500 block font-mono">{country.category}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* SUB-LISTA 2: PROVINCIAS DE ARGENTINA (24 EN ORDEN ALFABÉTICO A-Z) */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSubListSection('provincias')}
                    className="w-full bg-slate-900/80 hover:bg-slate-900 px-3 py-2 flex items-center justify-between text-left text-xs font-bold text-slate-200 transition-colors border-b border-slate-800 cursor-pointer"
                  >
                    <span className="flex items-center space-x-1.5 text-emerald-400">
                      <MapPin size={13} />
                      <span className="uppercase text-[10px] tracking-wider font-extrabold text-slate-200">2. Provincias de Argentina ({filteredProvinces.length})</span>
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${collapsedSections.provincias ? 'rotate-180' : ''}`} />
                  </button>

                  {!collapsedSections.provincias && (
                    <div className="p-2 grid grid-cols-2 gap-1.5 bg-slate-950/60">
                      {filteredProvinces.map((prov) => (
                        <button
                          key={prov.id}
                          onClick={() => {
                            if (onSelectSubdivision) onSelectSubdivision(prov.id);
                            setShowSelectionMenu(false);
                          }}
                          className="p-1.5 bg-slate-900 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/50 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between group"
                        >
                          <span className="text-[11px] font-bold text-slate-300 group-hover:text-emerald-300 truncate">
                            {prov.name}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono font-bold shrink-0 ml-1">
                            {prov.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* SUB-LISTA 3: SUBDIVISIONES LOCALES O MUNICIPIOS DEL NODO ACTIVO */}
                {subdivisions.length > 0 && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSubListSection('subdivisiones')}
                      className="w-full bg-slate-900/80 hover:bg-slate-900 px-3 py-2 flex items-center justify-between text-left text-xs font-bold text-slate-200 transition-colors border-b border-slate-800 cursor-pointer"
                    >
                      <span className="flex items-center space-x-1.5 text-emerald-400">
                        <Layers size={13} />
                        <span className="uppercase text-[10px] tracking-wider font-extrabold text-slate-200">3. Subdivisiones Locales ({subdivisions.length})</span>
                      </span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${collapsedSections.subdivisiones ? 'rotate-180' : ''}`} />
                    </button>

                    {!collapsedSections.subdivisiones && (
                      <div className="p-2 grid grid-cols-2 gap-1.5 bg-slate-950/60">
                        {subdivisions
                          .filter(sub => !subSearch || sub.name.toLowerCase().includes(subSearch.toLowerCase()) || sub.id.toLowerCase().includes(subSearch.toLowerCase()))
                          .map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => {
                                if (onSelectSubdivision) onSelectSubdivision(sub.id);
                                setShowSelectionMenu(false);
                              }}
                              className="p-2 bg-slate-900 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all cursor-pointer group flex items-center justify-between"
                            >
                              <span className="text-[11px] font-bold text-slate-300 group-hover:text-emerald-300 truncate">
                                {sub.name}
                              </span>
                              {sub.value !== undefined && (
                                <span className="text-[9px] font-mono text-slate-500 group-hover:text-emerald-400 font-bold shrink-0 ml-1">
                                  {sub.value}%
                                </span>
                              )}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN 4: BOTONERA DE EXPORTACIÓN Y PERFIL DE USUARIO RBAC */}
      <div className="flex items-center justify-end space-x-3 relative">
        
        {/* Exportar Reporte a PDF */}
        <button
          onClick={() => handleExport('PDF')}
          disabled={exporting !== null}
          className="flex items-center space-x-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold py-2 px-3.5 rounded transition-all cursor-pointer disabled:opacity-50"
        >
          <FileText size={14} className="text-red-400" />
          <span>{exporting === 'PDF' ? 'Generando...' : 'EXPORTAR PDF'}</span>
        </button>

        {/* Generar Reporte a Excel */}
        <button
          onClick={() => handleExport('Excel')}
          disabled={exporting !== null}
          className="flex items-center space-x-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-slate-100 font-bold py-2 px-3.5 rounded transition-all cursor-pointer disabled:opacity-50"
        >
          <FileText size={14} className="text-slate-100" />
          <span>{exporting === 'Excel' ? 'Generando...' : 'GENERAR EXCEL'}</span>
        </button>

        {/* Separador visual de línea vertical */}
        <div className="w-px h-6 bg-slate-800 mx-1" />

        {/* CONTROL DE PERFIL / INICIO DE SESIÓN Y ASIGNACIÓN DE ROL RBAC */}
        <div className="relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={`flex items-center space-x-2 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 border ${roleBadgeColor} rounded-full cursor-pointer transition-all relative`}
            title="Perfil de Usuario y Selección de Rol RBAC"
          >
            <div className="relative">
              <User size={15} className={userRole === 'admin' ? 'text-emerald-400' : userRole === 'pro' ? 'text-amber-400' : 'text-slate-400'} />
              <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                userRole === 'admin' ? 'bg-emerald-500 animate-pulse' : userRole === 'pro' ? 'bg-amber-500 animate-pulse' : 'bg-slate-500'
              }`} />
            </div>
            
            <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">
              {roleLabel}
            </span>
            <ChevronDown size={12} className="text-slate-500" />
          </button>

          {/* MENÚ DESPLEGABLE DE PERFIL Y CONTROL DE ACCESO RBAC */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 z-50 text-slate-200 space-y-4">
              <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
                <ShieldCheck size={20} className="text-emerald-400" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">Control de Acceso (RBAC)</h4>
                  <p className="text-[10px] text-slate-400">Selección de Permisos y Mi Perfil</p>
                </div>
              </div>

              {/* SECCIÓN DE DATOS PERSONALES DEL USUARIO AUTENTICADO */}
              {currentUser && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center space-x-3">
                    {/* Avatar o ícono del perfil */}
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-emerald-500/40 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                      {currentUser.avatarUrl ? (
                        <img referrerPolicy="no-referrer" src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <User size={20} className="text-emerald-400" />
                      )}
                    </div>

                    {/* Nombre y Cargo */}
                    <div className="flex-1 overflow-hidden">
                      <h5 className="text-xs font-black text-slate-100 truncate">
                        {currentUser.name} {currentUser.lastName || ''}
                      </h5>
                      <p className="text-[10px] text-sky-400 font-semibold truncate flex items-center space-x-1">
                        <Briefcase size={10} className="shrink-0" />
                        <span>{currentUser.position || 'Sin cargo especificado'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Organización y Email */}
                  <div className="text-[10px] text-slate-400 space-y-0.5 border-t border-slate-900 pt-2 font-mono">
                    {currentUser.organization && (
                      <p className="truncate flex items-center space-x-1 text-slate-300">
                        <Building size={10} className="text-amber-400 shrink-0" />
                        <span>{currentUser.organization}</span>
                      </p>
                    )}
                    <p className="truncate text-slate-500">{currentUser.email}</p>
                  </div>

                  {/* Botón Abrir Modal de Edición de Perfil */}
                  <button
                    onClick={() => {
                      if (onOpenProfileModal) onOpenProfileModal();
                      setShowProfileMenu(false);
                    }}
                    className="w-full py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <Edit size={12} />
                    <span>Editar Mi Perfil Personal</span>
                  </button>
                </div>
              )}

              {/* Selector Rápido de Rol RBAC para pruebas de la plataforma */}
              <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                  Simular / Asignar Rol Activo:
                </label>
                
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      if (onSelectRole) onSelectRole('guest');
                      onLogout();
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                      userRole === 'guest' 
                        ? 'bg-slate-800 text-slate-200 border-slate-600' 
                        : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    Guest
                  </button>

                  <button
                    onClick={() => {
                      if (onSelectRole) onSelectRole('pro');
                      onLogin(true);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                      userRole === 'pro' 
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' 
                        : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    ⭐ Pro
                  </button>

                  <button
                    onClick={() => {
                      if (onSelectRole) onSelectRole('admin');
                      onLogin(true);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                      userRole === 'admin' 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' 
                        : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    👑 Admin
                  </button>
                </div>
              </div>

              {/* Formulario de Inicio de Sesión si el rol actual es Guest */}
              {userRole === 'guest' && (
                <form onSubmit={handleManualLogin} className="space-y-3 pt-2 border-t border-slate-800">
                  {loginError && (
                    <p className="text-[10px] text-red-400 bg-red-500/5 p-2 rounded border border-red-500/20">
                      {loginError}
                    </p>
                  )}

                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Email de Acceso</label>
                    <div className="relative flex items-center">
                      <Mail size={12} className="absolute left-3 text-slate-500" />
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-200 outline-hidden transition-colors"
                        placeholder="magritted12@gmail.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Contraseña</label>
                    <div className="relative flex items-center">
                      <Lock size={12} className="absolute left-3 text-slate-500" />
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-200 outline-hidden transition-colors"
                        placeholder="••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <LogIn size={13} />
                    <span>Iniciar Sesión Admin</span>
                  </button>
                </form>
              )}

              {/* Botón de Cerrar Sesión si no es usuario Guest */}
              {userRole !== 'guest' && (
                <button
                  onClick={() => {
                    onLogout();
                    if (onSelectRole) onSelectRole('guest');
                    setShowProfileMenu(false);
                  }}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2"
                >
                  <LogOut size={13} />
                  <span>Cerrar Sesión</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN 5: BARRA GLOBAL FIJA DE MIGAS DE PAN (BREADCRUMBS) */}
      {navigationPath && navigationPath.length > 0 && (
        <nav id="global-breadcrumbs-bar" className="w-full bg-slate-900/90 border-t border-slate-800/80 pt-2 pb-0.5 px-2 flex items-center space-x-1.5 text-xs overflow-x-auto select-none">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center space-x-1 mr-1 shrink-0">
            <MapPin size={12} className="text-emerald-400" />
            <span>Navegación:</span>
          </span>
          {navigationPath.map((node, index) => {
            const isLast = index === navigationPath.length - 1;
            return (
              <React.Fragment key={`${node.id}-${index}`}>
                <button
                  onClick={() => onBreadcrumbClick && onBreadcrumbClick(index)}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isLast
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black shadow-xs'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-slate-800'
                  }`}
                  title={`Navegar directamente a ${node.name}`}
                >
                  <span>{node.name}</span>
                </button>
                {!isLast && <ChevronRight size={12} className="text-slate-600 font-bold shrink-0 mx-0.5" />}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* NOTIFICACIÓN TOAST FLOTANTE SUTIL: TRABAJO GUARDADO EXITOSAMENTE (AUTO-DISMISS EN 3.5s) */}
      {saveToast?.show && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-auto">
          <div className="bg-slate-900/95 text-slate-100 border border-emerald-500/50 rounded-2xl px-4 py-2.5 shadow-2xl shadow-emerald-950/70 flex items-center space-x-3 backdrop-blur-md">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-100 flex items-center gap-2">
                {saveToast.message}
                {saveToast.timestamp && (
                  <span className="text-[10px] font-normal text-emerald-400 font-mono">({saveToast.timestamp})</span>
                )}
              </p>
              <p className="text-[11px] text-slate-400">
                {saveToast.details || 'Todos los cambios fueron guardados y sincronizados correctamente.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSaveToast(null)}
              className="text-slate-500 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-all cursor-pointer ml-1"
              title="Cerrar notificación"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE SEGURIDAD: CAMBIOS SIN GUARDAR AL CERRAR */}
      {isCloseConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-black/80 space-y-4 text-slate-100">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-slate-100">
                  ¿Deseas guardar los cambios antes de cerrar?
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Tienes modificaciones sin guardar en el proyecto <span className="font-bold text-amber-300">"{projectName}"</span>. Si cierras ahora sin guardar, se perderán los cambios realizados.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleConfirmSaveAndClose}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-emerald-950/50 cursor-pointer"
              >
                <Save size={14} />
                <span>Guardar y Cerrar</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscardAndClose}
                className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Descartar y Salir</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCloseConfirmOpen(false)}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  ); // Fin del return de JSX
} // Fin de la función exportable Header
