import React from 'react'; // Importación de la librería principal React
import { Navigate, Outlet } from 'react-router-dom'; // Importación de componentes de navegación de React Router
import { UserRole } from '../types'; // Importación del tipo UserRole para control de acceso basado en roles (RBAC)

// Interfaz para definir las propiedades (Props) del componente de Ruta Protegida
interface ProtectedRouteProps { // Propiedades aceptadas por el componente
  children?: React.ReactNode; // Elementos hijos que serán renderizados opcionalmente
  isAdmin?: boolean; // Compatibilidad con bandera booleana de administrador
  userRole?: UserRole | string; // Rol actual del usuario ('guest' | 'pro' | 'admin' o 'USER' | 'ADMIN' | 'SUPER_ADMIN')
  requiredRole?: 'pro' | 'admin' | 'SUPER_ADMIN' | 'ADMIN' | 'USER'; // Rol individual mínimo requerido
  allowedRoles?: string[]; // Lista explícita de roles autorizados para ingresar a la ruta
}

// Componente ProtectedRoute para asegurar que solo usuarios autenticados con los roles adecuados accedan
export default function ProtectedRoute({ // Exportación del componente principal
  children, // Contenido hijo explícito
  isAdmin = false, // Valor predeterminado para el flag de admin
  userRole, // Rol de la sesión actual
  requiredRole, // Rol requerido
  allowedRoles // Arreglo de roles permitidos
}: ProtectedRouteProps) { // Firma de la función
  
  // Normalización del rol activo actual del usuario a formato en mayúsculas o estándar
  const rawRole = userRole || (isAdmin ? 'ADMIN' : 'GUEST'); // Obtiene el valor crudo del rol o infiere según isAdmin
  const normalizedUserRole = String(rawRole).toUpperCase(); // Convierte el rol a mayúsculas para comparación uniforme

  // Mapeo de compatibilidad entre nombres de roles ('guest' -> 'USER', 'pro' -> 'ADMIN', 'admin' -> 'SUPER_ADMIN' / 'ADMIN')
  const mappedRole = normalizedUserRole === 'GUEST' ? 'USER' 
    : normalizedUserRole === 'PRO' ? 'ADMIN' 
    : normalizedUserRole === 'ADMIN' ? 'SUPER_ADMIN' 
    : normalizedUserRole; // Asigna el rol mapeado estandarizado

  // Determinación de la autorización de acceso
  let hasPermission = false; // Variable para almacenar si el usuario tiene permiso de ingreso

  if (allowedRoles && allowedRoles.length > 0) { // Si se proveyó una lista explícita de allowedRoles
    // Comprueba si el rol mapeado o el rol normalizado coincide con alguno de la lista permitida
    hasPermission = allowedRoles.map(r => r.toUpperCase()).includes(normalizedUserRole) ||
                    allowedRoles.map(r => r.toUpperCase()).includes(mappedRole); // Evalúa coincidencia en allowedRoles
  } else if (requiredRole) { // Si se especificó requiredRole
    const normalizedRequired = requiredRole.toUpperCase(); // Normaliza el rol requerido a mayúsculas
    if (normalizedRequired === 'PRO') { // Si se requiere nivel PRO
      hasPermission = normalizedUserRole === 'PRO' || normalizedUserRole === 'ADMIN' || normalizedUserRole === 'SUPER_ADMIN'; // Permite PRO, ADMIN y SUPER_ADMIN
    } else if (normalizedRequired === 'ADMIN' || normalizedRequired === 'SUPER_ADMIN') { // Si se requiere nivel ADMIN o SUPER_ADMIN
      hasPermission = normalizedUserRole === 'ADMIN' || normalizedUserRole === 'SUPER_ADMIN'; // Permite ADMIN y SUPER_ADMIN
    } else { // Para otros roles requeridos
      hasPermission = normalizedUserRole === normalizedRequired || mappedRole === normalizedRequired; // Evalúa igualdad directa
    }
  } else { // Si no se especificaron restricciones explícitas
    hasPermission = normalizedUserRole === 'ADMIN' || normalizedUserRole === 'SUPER_ADMIN' || normalizedUserRole === 'PRO'; // Permite acceso si es usuario registrado/admin
  }

  // Si el usuario no cumple los requisitos de rol, redirige o muestra pantalla de acceso denegado
  if (!hasPermission) { // Si no posee autorización
    return ( // Renderiza la tarjeta de advertencia RBAC
      <div className="min-h-[60vh] bg-slate-950 flex flex-col items-center justify-center p-6 text-center"> {/* Contenedor centrado */}
        <div className="bg-slate-900 border border-amber-500/30 p-8 rounded-2xl max-w-md shadow-2xl relative"> {/* Tarjeta de advertencia */}
          {/* Resplandor decorativo de fondo */}
          <div className="absolute inset-0 bg-amber-500/5 rounded-2xl blur-xl -z-10" />
          
          <span className="text-4xl block mb-3 animate-bounce">🔒</span> {/* Ícono animado de candado */}
          <h2 className="text-xl font-sans text-amber-400 font-bold mb-2 uppercase tracking-wide">
            Acceso Restringido ({allowedRoles ? allowedRoles.join(' / ') : requiredRole || 'ADMIN'})
          </h2> {/* Título dinámico mostrando los roles requeridos */}
          
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Esta sección requiere permisos privilegiados ({allowedRoles ? allowedRoles.join(', ') : requiredRole || 'ADMIN'}). Permite editar espacios de trabajo, personalizar capas vectoriales y gestionar la jerarquía del mapa.
          </p> {/* Explicación del nivel de acceso */}
          
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left space-y-2 mb-4"> {/* Panel de rol actual */}
            <h3 className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Tu Rol Actual</h3> {/* Encabezado de estado */}
            <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
              👤 {normalizedUserRole} ({mappedRole})
            </p> {/* Muestra el rol actual detectado */}
            <p className="text-[10px] text-slate-500 leading-normal">
              Puedes cambiar tu nivel de usuario o iniciar sesión desde el menú de perfil en el encabezado.
            </p> {/* Instrucciones para cambiar de perfil */}
          </div>
        </div>
      </div>
    ); // Fin de renderizado de tarjeta
  }

  // Si la validación de rol es exitosa, renderiza los elementos hijos o el componente de Outlet de React Router
  return children ? <>{children}</> : <Outlet />; // Retorna children si existen o la salida Outlet
} // Fin del componente ProtectedRoute

// Exportación nombrada para compatibilidad con imports de { ProtectedRoute }
export { ProtectedRoute };



