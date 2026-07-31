/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react'; // React base
import { FileText, Download, User, CheckCircle2, Shield, ShieldAlert, ShieldCheck, LogOut, LogIn, Mail, Lock, ChevronDown, Star, MapPin, ChevronRight, Edit, Briefcase, Building, Search, Compass, Layers, Globe } from 'lucide-react'; // Íconos Lucide
import { UserRole, RegionNode, UserProfile } from '../types'; // Importación de tipos de TypeScript

// Interfaz para las opciones de subdivisiones en el menú desplegable de la cabecera
export interface SubdivisionOption {
  id: string; // Identificador único de la subdivisión (ej. AR-M)
  name: string; // Nombre amigable (ej. Misiones)
  value?: number; // Valor numérico opcional o porcentaje
}

// Interfaz que describe las propiedades requeridas por el Header
interface HeaderProps {
  isAdmin: boolean; // Indica si el rol de administrador está activo en el sistema
  userRole?: UserRole; // Rol RBAC activo ('guest' | 'pro' | 'admin')
  currentUser?: UserProfile; // Objeto de perfil completo del usuario activo
  onOpenProfileModal?: () => void; // Disparador para abrir el modal de edición de perfil personal
  onLogin: (remember: boolean) => void; // Disparador para iniciar sesión con opción de persistencia
  onLogout: () => void; // Disparador para cerrar la sesión actual
  onSelectRole?: (role: UserRole) => void; // Disparador para cambiar de rol RBAC directamente
  navigationPath?: any[]; // Historial de ruta para las migas de pan globales (MUNDO > CONTINENTE > PAÍS...)
  onBreadcrumbClick?: (index: number) => void; // Manejador de clics en la navegación de migas de pan
  subdivisions?: SubdivisionOption[]; // Lista de subdivisiones o regiones del nodo activo
  onSelectSubdivision?: (id: string) => void; // Disparador para seleccionar una subdivisión del menú
}

export default function Header({ 
  isAdmin, 
  userRole = 'guest', 
  currentUser,
  onOpenProfileModal,
  onLogin, 
  onLogout, 
  onSelectRole,
  navigationPath = [],
  onBreadcrumbClick,
  subdivisions = [],
  onSelectSubdivision
}: HeaderProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false); // Controla el estado abierto/cerrado del panel de perfil
  const [showSelectionMenu, setShowSelectionMenu] = useState<boolean>(false); // Controla el estado del desplegable "Índice de Selección / Ruta"
  const [subSearch, setSubSearch] = useState<string>(''); // Búsqueda de subdivisiones en el desplegable
  const [emailInput, setEmailInput] = useState<string>(''); // Dejado vacío por defecto
  const [passwordInput, setPasswordInput] = useState<string>(''); // Dejado vacío por defecto
  const [rememberMe, setRememberMe] = useState<boolean>(false); // Controla la opción de "Mantener sesión activa"
  const [loginError, setLoginError] = useState<string | null>(null); // Estado para controlar y mostrar errores de login

  // Nodo activo actual extraído dinámicamente del último elemento del array navigationPath
  const activeNode = navigationPath && navigationPath.length > 0 ? navigationPath[navigationPath.length - 1] : { id: 'root', name: 'Inicio' };
  
  // Filtrado dinámico de subdivisiones según la búsqueda
  const filteredSubdivisions = subdivisions.filter(sub => 
    sub.name.toLowerCase().includes(subSearch.toLowerCase()) || 
    sub.id.toLowerCase().includes(subSearch.toLowerCase())
  );

  // Simulación de exportación de reportes locales
  const handleExport = (type: 'PDF' | 'Excel') => {
    setExporting(type);
    setTimeout(() => {
      setExporting(null);
      alert(`Éxito: Reporte exportado a formato ${type} correctamente.`);
    }, 1500);
  };

  // Maneja la validación de inicio de sesión manual para el administrador
  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault(); // Evita la recarga por defecto del navegador en el formulario
    
    // Validamos que los campos no estén vacíos en la interfaz
    if (!emailInput || !passwordInput) {
      setLoginError('Por favor completa todos los campos.'); // Error ante campos incompletos
      return;
    }

    // Validamos que el correo y la contraseña coincidan exactamente con las credenciales requeridas
    if (emailInput !== 'magritted12@gmail.com' || passwordInput !== 'omarMagritted!') {
      setLoginError('Credenciales incorrectas. Verifique el correo o contraseña de administrador.'); // Error de credenciales inválidas
      return;
    }

    // Si las credenciales son correctas, limpiamos errores e iniciamos sesión como Admin
    setLoginError(null);
    if (onSelectRole) onSelectRole('admin');
    onLogin(rememberMe);
    setShowProfileMenu(false);
  };

  // Simulación de Google Sign-In con feedback visual
  const handleGoogleLogin = () => {
    setLoginError(null);
    const mockEmail = 'magritted12@gmail.com';
    setEmailInput(mockEmail);
    if (onSelectRole) onSelectRole('admin');
    onLogin(rememberMe);
    setShowProfileMenu(false);
  };

  // Determina la etiqueta amigable del rol actual
  const roleLabel = userRole === 'admin' ? 'SUPER ADMIN' : userRole === 'pro' ? 'USUARIO PRO' : 'INVITADO';
  const roleBadgeColor = userRole === 'admin' ? 'text-emerald-400 border-emerald-500/50' : userRole === 'pro' ? 'text-amber-400 border-amber-500/50' : 'text-slate-400 border-slate-800';

  return (
    <header id="app-header" className="bg-slate-950/70 backdrop-blur-md border-b border-slate-800 py-3 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-50">
      {/* Emblema patrio y Metadatos de Marca */}
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

      {/* Selector Dinámico de Ruta e Índice de Selección Territorial */}
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
            {/* Header del desplegable */}
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
                className="text-slate-500 hover:text-slate-300 text-xs font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Eslabones de la Ruta Actual */}
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

            {/* Buscador de Subdivisiones */}
            {subdivisions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center space-x-1">
                    <Layers size={10} className="text-emerald-400" />
                    <span>Subdivisiones Disponibles ({subdivisions.length}):</span>
                  </span>
                </div>

                <div className="relative flex items-center">
                  <Search size={12} className="absolute left-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={subSearch}
                    onChange={(e) => setSubSearch(e.target.value)}
                    placeholder="Buscar provincia o municipio..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-1 pl-7 pr-3 text-[11px] text-slate-200 outline-hidden transition-colors"
                  />
                </div>

                {/* Lista de Subdivisiones en Grid Scrolleable */}
                <div className="max-h-56 overflow-y-auto pr-1 grid grid-cols-2 gap-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                  {filteredSubdivisions.length > 0 ? (
                    filteredSubdivisions.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          if (onSelectSubdivision) onSelectSubdivision(sub.id);
                          setShowSelectionMenu(false);
                        }}
                        className="p-2 bg-slate-950 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all cursor-pointer group flex items-center justify-between"
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
                    ))
                  ) : (
                    <div className="col-span-2 py-4 text-center text-xs text-slate-500">
                      No se encontraron subdivisiones.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botonera de Operaciones y Perfil de Usuario */}
      <div className="flex items-center justify-end space-x-3 relative">
        
        {/* Exportar a PDF */}
        <button
          onClick={() => handleExport('PDF')}
          disabled={exporting !== null}
          className="flex items-center space-x-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold py-2 px-3.5 rounded transition-all cursor-pointer disabled:opacity-50"
        >
          <FileText size={14} className="text-red-400" />
          <span>{exporting === 'PDF' ? 'Generando...' : 'EXPORTAR PDF'}</span>
        </button>

        {/* Generar archivo Excel */}
        <button
          onClick={() => handleExport('Excel')}
          disabled={exporting !== null}
          className="flex items-center space-x-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-slate-100 font-bold py-2 px-3.5 rounded transition-all cursor-pointer disabled:opacity-50"
        >
          <FileText size={14} className="text-slate-100" />
          <span>{exporting === 'Excel' ? 'Generando...' : 'GENERAR EXCEL'}</span>
        </button>

        {/* Separador visual elegante */}
        <div className="w-px h-6 bg-slate-800 mx-1" />

        {/* CONTROL DE PERFIL / INICIO DE SESIÓN Y ROL RBAC */}
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

          {/* MENÚ DESPLEGABLE / SELECTOR DE ROLES RBAC Y PERFIL PERSONAL */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 z-50 text-slate-200 space-y-4">
              <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
                <ShieldCheck size={20} className="text-emerald-400" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">Control de Acceso (RBAC)</h4>
                  <p className="text-[10px] text-slate-400">Selección de Permisos y Mi Perfil</p>
                </div>
              </div>

              {/* SECCIÓN DE DATOS PERSONALES DEL USUARIO ACTIVO Y BOTÓN EDITAR */}
              {currentUser && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center space-x-3">
                    {/* Avatar o Ícono del Usuario */}
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

              {/* Selector Rápido de Rol RBAC */}
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

              {/* Formulario de Login si se quiere acceder con credenciales */}
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

      {/* BARRA GLOBAL FIJA DE MIGAS DE PAN (BREADCRUMBS): MUNDO > CONTINENTE > PAÍS > PROVINCIA > MUNICIPIO */}
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
    </header>
  );
}


