import React, { useEffect, useState } from 'react'; // Importación de React, hooks de ciclo de vida (useEffect) y de estado (useState)

// Interfaz para definir las propiedades (Props) del componente de Ruta Protegida
interface ProtectedRouteProps {
  children: React.ReactNode; // Elementos hijos que serán renderizados si el usuario está autenticado como administrador
}

// Componente ProtectedRoute para asegurar que solo los administradores accedan a la configuración de calibración
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  // Estado para controlar si el usuario está actualmente autenticado
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true); // Se inicia en true por defecto para simular la sesión activa

  // Efecto para sincronizar o leer el estado de autenticación real del sistema
  useEffect(() => {
    // Intentamos recuperar la variable de sesión de administrador desde el localStorage local
    const adminSession = localStorage.getItem('argentina_admin_logged'); // Busca la marca de login 'argentina_admin_logged'
    
    // Si la marca existe y es 'true', confirmamos la autenticación
    if (adminSession === 'true') {
      setIsAuthenticated(true); // Actualiza el estado a verdadero para dar paso
    } else {
      // TODO: Aquí se puede conectar el observador oficial de Firebase Auth: onAuthStateChanged(auth, (user) => { ... })
      // Por defecto, dejamos habilitado para la simulación fluida en el entorno de previsualización
      setIsAuthenticated(true); // Mantenemos la simulación amigable
    }
  }, []); // El arreglo vacío indica que este efecto se ejecuta una sola vez al montar el componente

  // Si no está autenticado, redirige automáticamente o muestra un mensaje de restricción de acceso
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center"> {/* Contenedor centrado oscuro */}
        <div className="bg-slate-900 border border-red-500/30 p-8 rounded-2xl max-w-md shadow-2xl relative"> {/* Tarjeta con borde rojo de advertencia */}
          <span className="text-4xl block mb-3">⚠️</span> {/* Ícono de alerta */}
          <h2 className="text-xl font-serif text-red-400 font-bold mb-2">Acceso Restringido - Administrador</h2> {/* Título de acceso restringido */}
          <p className="text-xs text-slate-400 mb-6">
            Para modificar el alcance del mapa, calibrar coordenadas SVG, ajustar vértices de parcelas o editar estilos visuales, necesitas iniciar sesión.
          </p> {/* Descripción explicativa */}
          <button
            onClick={() => {
              // Simulación rápida de inicio de sesión administrativo para propósitos de prueba
              localStorage.setItem('argentina_admin_logged', 'true'); // Persiste la sesión simulada en localStorage
              setIsAuthenticated(true); // Cambia el estado para desbloquear la vista de inmediato
            }}
            className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            Iniciar Sesión como Administrador (Simulado)
          </button> {/* Botón de acción para el desarrollador */}
        </div>
      </div>
    );
  }

  // Si la autenticación es correcta, renderiza los componentes del panel de administración
  return <>{children}</>; // Retorna los elementos protegidos
}
