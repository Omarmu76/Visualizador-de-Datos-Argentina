/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react'; // React y useState para manejo de interfaz y filtros
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  RotateCcw, 
  Search, 
  Shield, 
  ShieldCheck, 
  Crown, 
  Eye, 
  Mail, 
  Phone, 
  Building, 
  Briefcase, 
  CheckCircle2, 
  User
} from 'lucide-react'; // Íconos Lucide para la administración de usuarios
import { UserProfile, UserRole } from '../types'; // Importación de tipos de TypeScript
import UserProfileModal from './UserProfileModal'; // Modal reutilizable de edición de perfil

// Interfaz para definir las propiedades que recibe la vista de Gestión de Usuarios para Administradores
interface AdminUserManagementProps {
  allProfiles: Record<string, UserProfile>; // Diccionario con todos los usuarios registrados
  onSaveProfile: (updatedProfile: UserProfile) => void; // Función para guardar cambios en un perfil
  onDeleteProfile?: (userId: string) => void; // Función opcional para eliminar un perfil de usuario
  onResetProfiles: () => void; // Función para restablecer todos los usuarios a la configuración original
  currentUser: UserProfile; // Usuario con sesión activa en este momento
}

export default function AdminUserManagement({
  allProfiles, // Objeto con todos los perfiles de usuarios
  onSaveProfile, // Guardado de perfil
  onDeleteProfile, // Eliminación de perfil
  onResetProfiles, // Restablecimiento de fábrica
  currentUser // Usuario actual
}: AdminUserManagementProps) {
  // Estado para el término de búsqueda de usuarios
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Estado para filtrar usuarios según su rol RBAC ('ALL' | 'admin' | 'pro' | 'guest')
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Estado para controlar qué usuario se está editando en el modal
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);

  // Estado para controlar la apertura del modal de creación de nuevo usuario
  const [isCreatingNewUser, setIsCreatingNewUser] = useState<boolean>(false);

  // Estado para mensaje flotante de notificación
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Función auxiliar para mostrar mensajes flotantes temporales
  const showToast = (msg: string) => {
    setToastMessage(msg); // Establece el texto del mensaje
    setTimeout(() => {
      setToastMessage(null); // Borra el mensaje tras 3 segundos
    }, 3000); // Duración de 3000 ms
  };

  // Arreglo con la lista completa de perfiles
  const profilesList = Object.values(allProfiles);

  // Filtrado dinámico por término de búsqueda y por rol
  const filteredProfiles = profilesList.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.position && user.position.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.organization && user.organization.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // Cálculo de estadísticas rápidas de usuarios
  const totalCount = profilesList.length;
  const adminCount = profilesList.filter(u => u.role === 'admin').length;
  const proCount = profilesList.filter(u => u.role === 'pro').length;
  const guestCount = profilesList.filter(u => u.role === 'guest').length;

  // Manejador para la creación de un nuevo perfil de usuario desde cero
  const handleCreateNewUser = () => {
    const newUserId = `user-custom-${Date.now()}`; // Genera ID único basado en timestamp
    const newUser: UserProfile = {
      id: newUserId,
      name: 'Nuevo',
      lastName: 'Usuario',
      email: `usuario${Math.floor(Math.random() * 1000)}@argentinadata.gob.ar`,
      role: 'pro',
      position: 'Analista de Datos',
      organization: 'Ministerio de Innovación',
      phone: '+54 11 4000-0000',
      bio: 'Perfil creado por el Administrador General.'
    };
    onSaveProfile(newUser); // Guarda el nuevo usuario
    setEditingProfile(newUser); // Abre inmediatamente el modal para afinar los detalles
    showToast(`Se ha creado el usuario '${newUser.name}' exitosamente.`);
  };

  // Manejador del cambio de rol directo en la tarjeta
  const handleRoleChange = (user: UserProfile, newRole: UserRole) => {
    const updated = { ...user, role: newRole };
    onSaveProfile(updated);
    showToast(`Rol de '${user.name}' actualizado a ${newRole.toUpperCase()}.`);
  };

  return (
    <div id="admin-user-management-view" className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 shadow-2xl flex flex-col space-y-6">
      {/* Encabezado Principal del Panel de Control de Usuarios */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <Users className="text-emerald-400" size={24} />
            <h2 className="text-xl font-black text-slate-100 tracking-tight">
              Gestión de Usuarios y Perfiles Personales (Panel Admin)
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">
            Como Super Admin, puedes inspeccionar, editar los datos personales (Nombre, Apellido, Cargo, Organización, Teléfono) y modificar los niveles de acceso RBAC de todos los usuarios registrados.
          </p>
        </div>

        {/* Botonera de acciones globales */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleCreateNewUser}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
            title="Crear un nuevo perfil de usuario"
          >
            <UserPlus size={15} />
            <span>+ NUEVO USUARIO</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm('¿Deseas restablecer todos los perfiles de usuario a los valores originales predeterminados?')) {
                onResetProfiles();
                showToast('Perfiles restablecidos a los valores base predeterminados.');
              }
            }}
            className="flex items-center space-x-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold px-3 py-2.5 rounded-xl transition-all cursor-pointer"
            title="Restablecer perfiles de fábrica"
          >
            <RotateCcw size={14} />
            <span>REINICIAR</span>
          </button>
        </div>
      </div>

      {/* Toast Notificación flotante si está activo */}
      {toastMessage && (
        <div className="bg-emerald-950/90 border border-emerald-500 text-emerald-200 p-3 rounded-xl flex items-center space-x-2 text-xs font-bold shadow-lg animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Tarjetas de Métricas Métricas de Usuarios */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Métricas: Total Usuarios */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Usuarios</span>
          <span className="text-xl font-black text-slate-100">{totalCount}</span>
        </div>

        {/* Métricas: Super Admins */}
        <div className="bg-slate-950 p-4 rounded-xl border border-purple-900/40 flex flex-col space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 flex items-center space-x-1">
            <ShieldCheck size={12} />
            <span>Super Admins</span>
          </span>
          <span className="text-xl font-black text-purple-300">{adminCount}</span>
        </div>

        {/* Métricas: Creadores Pro */}
        <div className="bg-slate-950 p-4 rounded-xl border border-amber-900/40 flex flex-col space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1">
            <Crown size={12} />
            <span>Creadores PRO</span>
          </span>
          <span className="text-xl font-black text-amber-300">{proCount}</span>
        </div>

        {/* Métricas: Visitantes */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1">
            <Eye size={12} />
            <span>Visitantes</span>
          </span>
          <span className="text-xl font-black text-slate-300">{guestCount}</span>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros de Rol */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
        {/* Campo de Búsqueda por Nombre, Email u Organización */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, correo, cargo o repartición..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 outline-none transition-colors"
          />
        </div>

        {/* Botonera de Filtro por Rol */}
        <div className="flex items-center space-x-1 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-1 hidden md:inline">Filtrar:</span>
          {['ALL', 'admin', 'pro', 'guest'].map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer border ${
                roleFilter === role
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {role === 'ALL' ? 'Todos' : role === 'admin' ? 'Admin' : role === 'pro' ? 'PRO' : 'Guest'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Tarjetas de Usuarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProfiles.map((user) => {
          const isCurrentSessionUser = user.id === currentUser.id;

          // Colores de borde y medalla según el rol RBAC
          const roleBadgeColor = 
            user.role === 'admin' ? 'bg-purple-950 text-purple-300 border-purple-800' :
            user.role === 'pro' ? 'bg-amber-950 text-amber-300 border-amber-800' :
            'bg-slate-900 text-slate-400 border-slate-800';

          return (
            <div
              key={user.id}
              className={`bg-slate-950 p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 relative ${
                isCurrentSessionUser 
                  ? 'border-emerald-500/80 shadow-lg shadow-emerald-950/30' 
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Encabezado del perfil con Avatar, Nombre, Rol e Indicador 'Tú' */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  {/* Foto de Avatar o Ícono Genérico */}
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    {user.avatarUrl ? (
                      <img 
                        referrerPolicy="no-referrer" 
                        src={user.avatarUrl} 
                        alt={user.name} 
                        className="w-full h-full object-cover rounded-lg" 
                      />
                    ) : (
                      <User size={22} className="text-slate-400" />
                    )}
                  </div>

                  {/* Nombre Completo y Cargo */}
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <h3 className="text-sm font-black text-slate-100 tracking-tight">
                        {user.name} {user.lastName || ''}
                      </h3>
                      {isCurrentSessionUser && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          TÚ
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-bold text-slate-400 flex items-center space-x-1 mt-0.5">
                      <Briefcase size={12} className="text-sky-400 shrink-0" />
                      <span>{user.position || 'Sin cargo especificado'}</span>
                    </p>
                  </div>
                </div>

                {/* Insignia de Rol RBAC */}
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${roleBadgeColor}`}>
                  {user.role === 'admin' ? 'SUPER ADMIN' : user.role === 'pro' ? 'CREADOR PRO' : 'GUEST'}
                </span>
              </div>

              {/* Información detallada de contacto y organización */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                {/* Repartición / Organización */}
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <Building size={12} className="text-amber-400 shrink-0" />
                  <span className="truncate">{user.organization || 'Sin organización'}</span>
                </div>

                {/* Teléfono */}
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <Phone size={12} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{user.phone || 'Sin teléfono'}</span>
                </div>

                {/* Email (Credencial) */}
                <div className="flex items-center space-x-1.5 text-slate-400 sm:col-span-2 font-mono text-[10px]">
                  <Mail size={12} className="text-purple-400 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>

              {/* Biografía si está cargada */}
              {user.bio && (
                <p className="text-[11px] text-slate-400 italic line-clamp-2 bg-slate-900/30 p-2 rounded-lg border border-slate-800/40">
                  "{user.bio}"
                </p>
              )}

              {/* Pie de Tarjeta: Selector Rápido de Rol y Botón Editar Perfil */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-800">
                {/* Asignación directa de Rol */}
                <div className="flex items-center space-x-1">
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider mr-1">Rol:</span>
                  {(['guest', 'pro', 'admin'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => handleRoleChange(user, r)}
                      className={`px-2 py-1 rounded text-[9px] font-extrabold uppercase transition-all cursor-pointer border ${
                        user.role === r
                          ? 'bg-slate-800 text-slate-100 border-emerald-500/50 shadow-xs'
                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {r === 'admin' ? '👑 Admin' : r === 'pro' ? '⭐ Pro' : 'Guest'}
                    </button>
                  ))}
                </div>

                {/* Botón Abrir Editor Completo de Perfil */}
                <button
                  onClick={() => setEditingProfile(user)}
                  className="flex items-center justify-center space-x-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  title="Editar datos personales de este perfil"
                >
                  <Edit size={13} className="text-emerald-400" />
                  <span>EDITAR PERFIL</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Edición de Perfil de Usuario si hay uno activo */}
      {editingProfile && (
        <UserProfileModal
          isOpen={editingProfile !== null}
          onClose={() => setEditingProfile(null)}
          profile={editingProfile}
          isSelfEdit={editingProfile.id === currentUser.id}
          onSave={(updated) => {
            onSaveProfile(updated);
            showToast(`Perfil de '${updated.name}' guardado correctamente.`);
            setEditingProfile(null);
          }}
        />
      )}
    </div>
  );
}
