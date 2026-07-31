/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react'; // Importación de React y hooks para manejo de estado del formulario
import { 
  User, 
  Briefcase, 
  Building, 
  Phone, 
  Mail, 
  Image, 
  FileText, 
  Save, 
  X, 
  CheckCircle2, 
  Lock, 
  ShieldCheck,
  Sparkles
} from 'lucide-react'; // Importación de íconos de la librería Lucide
import { UserProfile } from '../types'; // Importación de la interfaz UserProfile desde los tipos compartidos

// Interfaz que define las propiedades que recibe el modal de perfil de usuario
interface UserProfileModalProps {
  isOpen: boolean; // Estado booleano que determina si el modal está visible en pantalla
  onClose: () => void; // Función callback para cerrar el modal sin guardar
  profile: UserProfile; // Objeto con los datos del perfil de usuario actual
  onSave: (updatedProfile: UserProfile) => void; // Función callback para enviar el perfil actualizado al estado global
  isSelfEdit?: boolean; // Booleano para indicar si el usuario está editando su propio perfil
}

export default function UserProfileModal({
  isOpen, // Estado de visibilidad
  onClose, // Disparador de cierre
  profile, // Datos del perfil recibido por props
  onSave, // Disparador de guardado
  isSelfEdit = true // Por defecto se asume que es auto-edición de perfil
}: UserProfileModalProps) {
  // Estado local para los campos del formulario editable
  const [formData, setFormData] = useState<UserProfile>({ ...profile }); // Copia local del perfil para edición
  const [toastMessage, setToastMessage] = useState<string | null>(null); // Estado para notificaciones de confirmación

  // Efecto que actualiza el estado del formulario cada vez que cambia el perfil recibido
  useEffect(() => {
    setFormData({ ...profile }); // Sincroniza la copia local con las props
  }, [profile]); // Dependencia del perfil enviado

  // Si el modal está cerrado, no se renderiza nada en la interfaz
  if (!isOpen) return null; // Retorno nulo para ocultar el modal

  // Manejador del cambio de texto en los campos del formulario
  const handleChange = (field: keyof UserProfile, value: string) => {
    setFormData(prev => ({
      ...prev, // Mantiene los campos anteriores
      [field]: value // Actualiza únicamente el campo modificado
    })); // Fin de actualización
  }; // Fin de handleChange

  // Manejador del envío del formulario y guardado de datos
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Previene la recarga por defecto de la página
    onSave(formData); // Invoca la función de guardado pasada por props
    setToastMessage('¡Perfil de usuario actualizado exitosamente!'); // Muestra notificación de éxito
    setTimeout(() => {
      setToastMessage(null); // Oculta la notificación
      onClose(); // Cierra el modal de edición
    }, 1200); // Espera 1.2 segundos
  }; // Fin de handleSubmit

  return (
    // Envoltura de fondo oscuro transparente con desenfoque de cristal
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      {/* Tarjeta modal principal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative overflow-hidden text-slate-100 my-8">
        {/* Adorno de fondo brillante tipo resplandor */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Encabezado del modal */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center space-x-3">
            {/* Contenedor del ícono o foto del perfil */}
            <div className="w-12 h-12 rounded-xl bg-slate-950 border border-emerald-500/40 p-1 flex items-center justify-center relative overflow-hidden shadow-md">
              {formData.avatarUrl ? (
                <img 
                  referrerPolicy="no-referrer" 
                  src={formData.avatarUrl} 
                  alt={formData.name} 
                  className="w-full h-full object-cover rounded-lg" 
                />
              ) : (
                <User size={24} className="text-emerald-400" />
              )}
            </div>

            {/* Título y subtítulo descriptivo */}
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-slate-100 tracking-tight">
                  {isSelfEdit ? 'Editar Mi Perfil Personal' : `Editar Perfil: ${profile.name}`}
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {formData.role === 'admin' ? 'SUPER ADMIN' : formData.role === 'pro' ? 'CREADOR PRO' : 'GUEST'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Personaliza tus datos de contacto, cargo y organización pública en la plataforma.
              </p>
            </div>
          </div>

          {/* Botón de cierre en la esquina superior derecha */}
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all cursor-pointer"
            title="Cerrar ventana"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notificación flotante de confirmación si existe */}
        {toastMessage && (
          <div className="mb-4 bg-emerald-950/90 border border-emerald-500 text-emerald-200 p-3 rounded-xl flex items-center space-x-2 text-xs font-bold shadow-lg animate-fade-in">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Formulario de edición de datos personales */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fila 1: Nombre y Apellido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Campo: Nombre */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                <User size={12} className="text-emerald-400" />
                <span>Nombre *</span>
              </label>
              <input 
                type="text" 
                required 
                value={formData.name || ''} 
                onChange={(e) => handleChange('name', e.target.value)} 
                placeholder="Ej. Omar" 
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none transition-colors" 
              />
            </div>

            {/* Campo: Apellido */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                <User size={12} className="text-emerald-400" />
                <span>Apellido</span>
              </label>
              <input 
                type="text" 
                value={formData.lastName || ''} 
                onChange={(e) => handleChange('lastName', e.target.value)} 
                placeholder="Ej. Magritte" 
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none transition-colors" 
              />
            </div>
          </div>

          {/* Fila 2: Cargo / Puesto y Organización */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Campo: Cargo o Puesto */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                <Briefcase size={12} className="text-sky-400" />
                <span>Cargo / Puesto / Título</span>
              </label>
              <input 
                type="text" 
                value={formData.position || ''} 
                onChange={(e) => handleChange('position', e.target.value)} 
                placeholder="Ej. Director de Catastro y GIS" 
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none transition-colors" 
              />
            </div>

            {/* Campo: Organización o Repartición */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                <Building size={12} className="text-amber-400" />
                <span>Organización / Repartición</span>
              </label>
              <input 
                type="text" 
                value={formData.organization || ''} 
                onChange={(e) => handleChange('organization', e.target.value)} 
                placeholder="Ej. Ministerio de Economía y Datos" 
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none transition-colors" 
              />
            </div>
          </div>

          {/* Fila 3: Correo Electrónico y Teléfono */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Campo: Correo Electrónico (Identificador de Cuenta) */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <Mail size={12} className="text-purple-400" />
                  <span>Email de Acceso (Cuenta)</span>
                </span>
                <span className="text-[9px] text-slate-500 font-mono flex items-center space-x-0.5">
                  <Lock size={10} />
                  <span>Credencial Protegida</span>
                </span>
              </label>
              <input 
                type="email" 
                value={formData.email || ''} 
                onChange={(e) => handleChange('email', e.target.value)} 
                placeholder="magritted12@gmail.com" 
                className="w-full bg-slate-950/80 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-emerald-500" 
              />
            </div>

            {/* Campo: Teléfono de Contacto */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                <Phone size={12} className="text-emerald-400" />
                <span>Teléfono de Contacto</span>
              </label>
              <input 
                type="text" 
                value={formData.phone || ''} 
                onChange={(e) => handleChange('phone', e.target.value)} 
                placeholder="Ej. +54 11 5555-0199" 
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none transition-colors" 
              />
            </div>
          </div>

          {/* Campo: URL de Avatar / Foto de Perfil */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1">
              <Image size={12} className="text-sky-400" />
              <span>URL de Avatar o Foto de Perfil</span>
            </label>
            <input 
              type="url" 
              value={formData.avatarUrl || ''} 
              onChange={(e) => handleChange('avatarUrl', e.target.value)} 
              placeholder="https://ejemplo.com/mi-foto-perfil.jpg" 
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none transition-colors font-mono" 
            />
          </div>

          {/* Campo: Biografía / Descripción del Usuario */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1">
              <FileText size={12} className="text-amber-400" />
              <span>Biografía / Notas de Función</span>
            </label>
            <textarea 
              rows={3} 
              value={formData.bio || ''} 
              onChange={(e) => handleChange('bio', e.target.value)} 
              placeholder="Escribe una breve descripción de tus responsabilidades y perfil profesional..." 
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-slate-100 outline-none transition-colors resize-none" 
            />
          </div>

          {/* Pie de modal con botones de acción (Cancelar y Guardar Cambios) */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg flex items-center space-x-1.5"
            >
              <Save size={14} />
              <span>Guardar Perfil</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
