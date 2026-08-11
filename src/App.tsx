/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react'; // Importación de React y hooks de estado, efectos y memorización
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'; // Importación de componentes y hooks del enrutador React Router
import Header from './components/Header'; // Componente de encabezado principal con selección de roles
import Sidebar from './components/Sidebar'; // Componente de barra lateral de herramientas rápidas
import InteractiveMap from './components/InteractiveMap'; // Componente del mapa vectorial SVG interactivo
import HomeDashboard from './components/HomeDashboard'; // Componente del portal/lobby inicial de bienvenida y dashboard de proyectos
import DataPanel from './components/DataPanel'; // Componente del panel de métricas e indicadores públicos
import WorkspaceHub from './components/WorkspaceHub'; // Componente del centro de gestión y carga de datos provinciales
import MapCalibrationPanel from './components/MapCalibrationPanel'; // Componente para la calibración y ajuste de nodos vectoriales
import AdvancedCanvasEditor from './components/AdvancedCanvasEditor'; // Componente del Súper Editor de Espacios Vectoriales
import ProtectedRoute from './components/ProtectedRoute'; // Componente envoltura de seguridad RBAC para protección de rutas
import PropertyEditor, { EditableTerritory } from './components/PropertyEditor'; // Componente inspector visual estilo Figma
import AdminHierarchyTreeEditor from './components/AdminHierarchyTreeEditor'; // Componente del organizador y árbol jerárquico Drag and Drop
import AdminUserManagement from './components/AdminUserManagement'; // Componente de gestión de usuarios y perfiles para administradores
import AdminHelpGuide from './components/AdminHelpGuide'; // Componente de la Guía de Ayuda, Convenciones y Tutorial de Uso
import UserProfileModal from './components/UserProfileModal'; // Componente modal para edición de perfil personal
import { mockProvincesData } from './data/mockData'; // Diccionario con los datos geográficos e indicadores iniciales de Argentina
import { provincePaths } from './data/provincePaths'; // Moldes nativos vectoriales de las 24 provincias de la República Argentina
import { MetricType, ProvinceData, RegionNode, NavNode, UserRole, UserProfile, TreeNode } from './types'; // Tipos e interfaces de TypeScript
import { safeSetItem, safeGetItem, safeRemoveItem } from './lib/storage'; // Funciones auxiliares para almacenamiento local seguro
import { fetchAllGeoNodes } from './lib/dbService'; // Importa la consulta a la base de datos real (Cloud SQL / Drizzle)
import { useProjectManager } from './hooks/useProjectManager'; // Hook de ciclo de vida de proyectos y File System Access API
import { getPathBBox, fitPathToBBox } from './lib/mapUtils'; // Utilidades geométricas vectoriales para cálculo de bounding box y escalado espacial exacto

// Objeto con la configuración inicial y predeterminada de perfiles de usuario por defecto
const DEFAULT_USER_PROFILES: Record<string, UserProfile> = {
  'user-admin-001': { // Perfil del Super Administrador
    id: 'user-admin-001', // ID único de admin
    name: 'Omar', // Nombre del administrador
    lastName: 'Magritte', // Apellido del administrador
    email: 'magritted12@gmail.com', // Correo institucional
    role: 'admin', // Rol RBAC Super Admin
    position: 'Super Admin Catastro', // Cargo profesional
    organization: 'Plataforma Federal Argentina Data', // Repartición
    phone: '+54 11 5555-0199', // Teléfono de contacto
    avatarUrl: '', // URL de avatar opcional
    bio: 'Administrador General de la Plataforma Federal de Datos y Cartografía Vectorial.' // Biografía descriptiva
  },
  'user-pro-101': { // Perfil del Usuario Creador Pro
    id: 'user-pro-101', // ID único de usuario Pro
    name: 'Carlos', // Nombre del creador pro
    lastName: 'Gómez', // Apellido
    email: 'creador@mapas.pro', // Correo
    role: 'pro', // Rol RBAC Creador PRO
    position: 'Analista de Sistemas GIS', // Cargo profesional
    organization: 'Instituto Cartográfico Pro', // Organización
    phone: '+54 11 4444-0222', // Teléfono de contacto
    avatarUrl: '', // URL de avatar
    bio: 'Especialista en desarrollo y calibración de capas vectoriales para provincias y municipios.' // Biografía
  },
  'user-guest-999': { // Perfil del Visitante Público
    id: 'user-guest-999', // ID único de invitado
    name: 'Visitante', // Nombre de invitado
    lastName: 'Invitado', // Apellido
    email: 'invitado@argentinadata.gob.ar', // Correo
    role: 'guest', // Rol RBAC Guest
    position: 'Consultor Ciudadano', // Cargo
    organization: 'Consulta Pública', // Organización
    phone: '', // Teléfono libre
    avatarUrl: '', // URL de avatar
    bio: 'Usuario en modo lectura para exploración pública de mapas federales.' // Biografía
  }
};

// Objeto de configuración predeterminado con los indicadores mundiales para el nivel mapa mundial
const defaultWorldMapData: ProvinceData = { // Definición de datos por defecto del nivel mundo
  id: 'WORLD_MAP', // Identificador único para la vista mundial
  name: 'Mapa Mundial', // Nombre descriptivo desplegado
  abbreviation: 'MUNDO', // Sigla identificatoria
  economicProfile: { // Indicadores del perfil económico global
    gini: 38.5, // Índice de Gini promedio mundial
    pib: 'USD 96T', // Producto Interno Bruto bruto global
    averageSalary: 'USD 1,200', // Salario promedio estimado
    sectors: [ // Distribución porcentual por sectores de la economía
      { name: 'Servicios', value: 65, color: '#10b981' }, // Sector servicios
      { name: 'Industria', value: 25, color: '#3b82f6' }, // Sector industrial
      { name: 'Agro', value: 10, color: '#f59e0b' } // Sector agropecuario
    ] // Fin del arreglo de sectores
  }, // Fin del perfil económico
  socialEmployment: { pobreza: 21.5, desempleo: 6.2, informalEmployment: 35.0, youthInformality: 48.0 }, // Métricas sociales e informales
  incomeStructure: { // Estructura salarial e indicadores de brecha
    minimumSalary: [{ label: 'Promedio', value: 850 }, { label: 'Mínimo', value: 350 }], // Salarios mínimos comparados
    genderGap: [{ label: 'Hombres', value: 100 }, { label: 'Mujeres', value: 82 }] // Brecha de ingresos por género
  }, // Fin de estructura de ingresos
  connectivity: { // Métricas de conectividad y redes
    internetAccess: [{ label: 'Fijo', value: 68 }, { label: 'Móvil', value: 85 }, { label: 'Global', value: 66 }], // Accesos
    mobileLines: [{ label: '4G', value: 75 }, { label: '5G', value: 25 }] // Cobertura de red móvil
  }, // Fin de conectividad
  budgetSpending: { // Distribución del gasto público y social
    socialSpending: [ // Gasto social dividido por áreas
      { name: 'Salud', value: 40, color: '#10b981' }, // Inversión en salud
      { name: 'Educación', value: 45, color: '#3b82f6' }, // Inversión en educación
      { name: 'Otros', value: 15, color: '#f59e0b' } // Otros gastos
    ], // Fin de gasto social
    educationInvestment: [{ label: 'Promedio', value: 4.5 }] // Inversión en educación respecto al PIB
  }, // Fin de presupuesto
  mobilityServices: { roadNetwork: 'Red Vial Global', waterAccess: 88, publicTransportLines: 1250 }, // Servicios públicos de transporte y agua
  municipalities: [ // Colección de países de la Tierra para la vista de nivel Mundo
    { id: 'country', name: 'República Argentina', value: 41.7, percentage: 10, color: '#10b981' },
    { id: 'BR', name: 'Brasil', value: 24.3, percentage: 48, color: '#059669' },
    { id: 'CL', name: 'Chile', value: 10.8, percentage: 8, color: '#3b82f6' },
    { id: 'UY', name: 'Uruguay', value: 9.9, percentage: 4, color: '#0284c7' },
    { id: 'CO', name: 'Colombia', value: 36.6, percentage: 12, color: '#f59e0b' },
    { id: 'PE', name: 'Perú', value: 27.5, percentage: 11, color: '#eab308' },
    { id: 'MX', name: 'México', value: 36.3, percentage: 18, color: '#ec4899' },
    { id: 'ES', name: 'España', value: 20.4, percentage: 5, color: '#8b5cf6' },
    { id: 'US', name: 'Estados Unidos', value: 11.5, percentage: 35, color: '#6366f1' }
  ] // Fin de la lista de países para el nivel Mundo
}; // Fin de defaultWorldMapData

// Objeto de configuración predeterminado con los indicadores continentales para el nivel América del Sur
const defaultContinentMapData: ProvinceData = { // Definición de datos por defecto del nivel continental
  id: 'CONTINENT_MAP', // Identificador clave para América del Sur
  name: 'América del Sur', // Nombre descriptivo continental
  abbreviation: 'S.AMERICA', // Sigla identificatoria
  economicProfile: { // Indicadores del perfil económico regional
    gini: 46.2, // Índice de Gini regional
    pib: 'USD 3.8T', // Producto Interno Bruto continental
    averageSalary: 'USD 450', // Salario promedio continental
    sectors: [ // Distribución porcentual por sectores
      { name: 'Servicios', value: 55, color: '#10b981' }, // Sector servicios
      { name: 'Industria', value: 20, color: '#3b82f6' }, // Sector industrial
      { name: 'Agro / Minería', value: 25, color: '#f59e0b' } // Sector primario y minero
    ] // Fin del arreglo de sectores
  }, // Fin de perfil económico
  socialEmployment: { pobreza: 31.8, desempleo: 8.1, informalEmployment: 52.0, youthInformality: 65.0 }, // Métricas sociales
  incomeStructure: { // Estructura de ingresos continental
    minimumSalary: [{ label: 'Promedio', value: 380 }, { label: 'Mínimo', value: 220 }], // Comparativa salarial
    genderGap: [{ label: 'Hombres', value: 100 }, { label: 'Mujeres', value: 76 }] // Brecha de ingresos
  }, // Fin de estructura de ingresos
  connectivity: { // Métricas de conectividad continental
    internetAccess: [{ label: 'Fijo', value: 52 }, { label: 'Móvil', value: 78 }, { label: 'Global', value: 54 }], // Cobertura de internet
    mobileLines: [{ label: '4G', value: 85 }, { label: '5G', value: 15 }] // Tecnología de red móvil
  }, // Fin de conectividad
  budgetSpending: { // Gastos presupuestarios continentales
    socialSpending: [ // Detalle del gasto público
      { name: 'Salud', value: 35, color: '#10b981' }, // Salud
      { name: 'Educación', value: 40, color: '#3b82f6' }, // Educación
      { name: 'Otros', value: 15, color: '#f59e0b' } // Gastos varios
    ], // Fin de gasto social
    educationInvestment: [{ label: 'Promedio', value: 3.8 }] // Inversión educativa porcentual
  }, // Fin de presupuesto
  mobilityServices: { roadNetwork: 'Vía Panamericana', waterAccess: 76, publicTransportLines: 480 }, // Infraestructura básica
  municipalities: [ // Colección de países de América del Sur
    { id: 'country', name: 'República Argentina', value: 41.7, percentage: 22, color: '#10b981' },
    { id: 'BR', name: 'Brasil', value: 24.3, percentage: 48, color: '#059669' },
    { id: 'CL', name: 'Chile', value: 10.8, percentage: 8, color: '#3b82f6' },
    { id: 'UY', name: 'Uruguay', value: 9.9, percentage: 4, color: '#0284c7' },
    { id: 'CO', name: 'Colombia', value: 36.6, percentage: 12, color: '#f59e0b' },
    { id: 'PE', name: 'Perú', value: 27.5, percentage: 11, color: '#eab308' },
    { id: 'PY', name: 'Paraguay', value: 24.7, percentage: 5, color: '#14b8a6' },
    { id: 'BO', name: 'Bolivia', value: 36.4, percentage: 6, color: '#84cc16' }
  ] // Fin de la lista de países para América del Sur
}; // Fin de defaultContinentMapData

// Objeto de configuración predeterminado con los indicadores nacionales macro para la República Argentina
const defaultCountryMapData: ProvinceData = { // Definición de datos por defecto a nivel país
  id: 'COUNTRY_MAP', // Identificador clave para el nivel República Argentina
  name: 'República Argentina', // Nombre oficial del país
  abbreviation: 'ARGENTINA', // Sigla o abreviatura del país
  economicProfile: { // Indicadores del perfil económico nacional
    gini: 42.8, // Índice de Gini nacional
    pib: 'USD 640B', // Producto Interno Bruto nacional
    averageSalary: '$220.000', // Salario promedio mensual estimado
    sectors: [ // Distribución por sectores económicos
      { name: 'Servicios', value: 58, color: '#10b981' }, // Sector servicios
      { name: 'Agro / Minería', value: 22, color: '#f59e0b' }, // Sector primario
      { name: 'Industria', value: 20, color: '#3b82f6' } // Sector secundario
    ] // Fin de sectores
  }, // Fin de perfil económico
  socialEmployment: { pobreza: 52.9, desempleo: 7.6, informalEmployment: 43.5, youthInformality: 59.0 }, // Indicadores sociales
  incomeStructure: { // Estructura de ingresos
    minimumSalary: [{ label: 'Promedio', value: 280000 }, { label: 'Mínimo', value: 234315 }], // Salario mínimo
    genderGap: [{ label: 'Hombres', value: 100 }, { label: 'Mujeres', value: 74 }] // Brecha salarial
  }, // Fin de estructura de ingresos
  connectivity: { // Redes y conectividad
    internetAccess: [{ label: 'Fijo', value: 78 }, { label: 'Móvil', value: 91 }, { label: 'Nacional', value: 85 }], // Accesos internet
    mobileLines: [{ label: '4G', value: 88 }, { label: '5G', value: 12 }] // Cobertura móvil
  }, // Fin de conectividad
  budgetSpending: { // Presupuesto y gasto público
    socialSpending: [ // Gasto en áreas clave
      { name: 'Salud', value: 32, color: '#10b981' }, // Salud
      { name: 'Educación', value: 38, color: '#3b82f6' }, // Educación
      { name: 'Seguridad / Otros', value: 30, color: '#f59e0b' } // Seguridad y administración
    ], // Fin de gasto social
    educationInvestment: [{ label: 'Nacional', value: 4.8 }] // Inversión educativa
  }, // Fin de presupuesto
  mobilityServices: { roadNetwork: 'Red Federal 40 mil km', waterAccess: 84.5, publicTransportLines: 1850 }, // Infraestructura básica
  municipalities: Object.values(mockProvincesData).map(p => ({ // Convierte las 24 provincias en las subdivisiones del nivel país
    id: p.id, // ID de la provincia
    name: p.name, // Nombre de la provincia
    value: p.socialEmployment?.pobreza || 40, // Métrica de pobreza provincial
    percentage: Math.round(p.socialEmployment?.pobreza || 40), // Porcentaje
    d: provincePaths.find(pp => pp.id === p.id)?.d || '' // Geometría SVG nativa de la provincia
  })) // Fin de la asignación de municipios
}; // Fin de defaultCountryMapData

// COMPONENTE CONTENEDOR RAÍZ DE LA APLICACIÓN CON ENRUTADOR PRINCIPAL
export default function App() { // Provee el enrutador BrowserRouter en la raíz
  return ( // Renderiza el árbol principal envuelto en el BrowserRouter
    <BrowserRouter> {/* Envoltorio del enrutador de producción React Router */}
      <AppContent /> {/* Renderiza el componente de contenido con estado y rutas */}
    </BrowserRouter> // Fin de BrowserRouter
  ); // Fin del retorno del componente App
} // Fin de la función App

// COMPONENTE PRINCIPAL DE CONTENIDO Y MANEJO DE RUTAS
function AppContent() { // Componente que maneja el estado global y las rutas del tablero
  const navigate = useNavigate(); // Hook para ejecutar navegaciones programáticas de URL
  const location = useLocation(); // Hook para obtener la ubicación y ruta actual activa

  // Estado para almacenar el árbol de nodos dinámicos recuperado desde la base de datos real (Cloud SQL / Drizzle)
  const [appTreeNodes, setAppTreeNodes] = useState<TreeNode[]>([]);

  // HOOK DE INICIALIZACIÓN (Task 3): Carga el árbol de nodos directamente de la base de datos al iniciar la app
  useEffect(() => {
    async function initTreeFromDatabase() { // Función asíncrona interna para cargar el árbol
      try {
        const nodesFromDb = await fetchAllGeoNodes(); // SELECT a la tabla geoNodes / backend
        if (nodesFromDb && nodesFromDb.length > 0) { // Si se retornaron nodos válidos
          setAppTreeNodes(nodesFromDb); // Actualiza el estado global con el árbol de la BD
        }
      } catch (err) {
        console.error('Error al inicializar el árbol de nodos desde la base de datos:', err); // Log de error
      }
    }
    initTreeFromDatabase(); // Ejecuta la carga inicial
  }, []); // Array de dependencias vacío para ejecutar una única vez al montar el componente

  // Estado que administra el rol RBAC del usuario activo ('guest' | 'pro' | 'admin')
  const [userRole, setUserRole] = useState<UserRole>(() => { // Inicialización diferida del estado
    const savedRole = safeGetItem('argentina_user_role') as UserRole; // Recupera el rol guardado en almacenamiento local
    if (savedRole && (savedRole === 'guest' || savedRole === 'pro' || savedRole === 'admin')) { // Valida si el rol recuperado es válido
      return savedRole; // Retorna el rol previamente guardado
    } // Fin de validación de rol
    const savedLocalAdmin = safeGetItem('argentina_admin_logged'); // Verifica compatibilidad con el formato anterior
    const savedSessionAdmin = sessionStorage.getItem('argentina_admin_logged'); // Verifica sesión activa en sessionStorage
    if (savedLocalAdmin === 'true' || savedSessionAdmin === 'true') { // Si existe indicador de admin
      return 'admin'; // Asigna rol de admin
    } // Fin de comprobación
    return 'guest'; // Por defecto asigna el rol de visitante
  }); // Fin del hook useState de userRole

  // Estado booleano derivado que determina si el usuario cuenta con nivel de administración activo
  const isAdmin = userRole === 'admin'; // Evaluador booleano de privilegio de administrador

  // Estado para la gestión y persistencia de la colección completa de perfiles de usuario
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>(() => { // Inicializador de estado
    const saved = safeGetItem('argentina_user_profiles'); // Carga perfiles desde el almacenamiento local
    if (saved) { // Si existen perfiles previamente guardados
      try { // Intenta decodificar el string JSON
        return JSON.parse(saved); // Retorna los perfiles guardados
      } catch (e) { // En caso de fallo de parsing
        console.error('Error al recuperar perfiles de usuario desde localStorage:', e); // Registra el error
      } // Fin de capturador
    } // Fin de condicional
    return DEFAULT_USER_PROFILES; // Retorna los perfiles iniciales por defecto si no hay nada guardado
  }); // Fin de useState de userProfiles

  // Estado booleano para controlar la visibilidad del modal de edición de perfil de usuario personal
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false); // Estado inicial cerrado

  // Identificador del usuario activo correspondiente al rol RBAC seleccionado
  const activeUserId = userRole === 'admin' ? 'user-admin-001' : userRole === 'pro' ? 'user-pro-101' : 'user-guest-999'; // Mapeo de ID
  
  // Perfil del usuario autenticado dinámico desde el estado persistente userProfiles
  const currentUser: UserProfile = userProfiles[activeUserId] || { // Obtiene el perfil activo o un fallback
    id: activeUserId, // ID del usuario
    name: userRole === 'admin' ? 'Omar' : userRole === 'pro' ? 'Carlos' : 'Visitante', // Nombre
    lastName: userRole === 'admin' ? 'Magritte' : userRole === 'pro' ? 'Gómez' : 'Invitado', // Apellido
    email: userRole === 'admin' ? 'magritted12@gmail.com' : userRole === 'pro' ? 'creador@mapas.pro' : 'invitado@argentinadata.gob.ar', // Email
    role: userRole // Rol RBAC
  }; // Fin de objeto currentUser

  // Función para guardar o actualizar la información de un perfil de usuario en el estado y en localStorage
  const handleSaveProfile = (updatedProfile: UserProfile) => { // Función con parámetro de perfil actualizado
    setUserProfiles(prev => { // Función actualizadora de estado
      const nextProfiles = { ...prev, [updatedProfile.id]: updatedProfile }; // Fusiona el perfil actualizado
      safeSetItem('argentina_user_profiles', JSON.stringify(nextProfiles)); // Persiste en el almacenamiento local
      return nextProfiles; // Devuelve el nuevo mapa de perfiles
    }); // Fin de setUserProfiles
  }; // Fin de handleSaveProfile

  // ESTADO PARA EL ANCHO DEL PANEL IZQUIERDO (PORCENTAJE EN SPLITTER REDIMENSIONABLE)
  const [leftPanelWidthPercent, setLeftPanelWidthPercent] = useState<number>(() => {
    const savedWidth = safeGetItem('argentina_left_panel_width'); // Recupera el ancho guardado si existe
    return savedWidth ? Math.min(Math.max(Number(savedWidth), 18), 82) : 42; // Ancho por defecto 42%
  });

  // ESTADO BOOLEANO QUE INDICA SI EL USUARIO ESTÁ ARRASTRANDO LA LÍNEA REDIMENSIONABLE CENTRAL
  const [isResizingPanels, setIsResizingPanels] = useState<boolean>(false);

  // EFECTO PARA ESCUCHAR EL MOVIMIENTO Y LIBERACIÓN DEL MOUSE/TOQUE AL REDIMENSIONAR LOS PANELES
  useEffect(() => {
    // Manejador del movimiento del puntero cuando se está arrastrando la barra divisoria
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizingPanels) return; // Si no está activo el modo de arrastre, ignora el movimiento
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX; // Obtiene la coordenada horizontal X
      const newWidthPercent = (clientX / window.innerWidth) * 100; // Calcula el porcentaje respecto al ancho total
      const clampedWidth = Math.min(Math.max(newWidthPercent, 18), 82); // Delimita el rango de redimensionamiento entre 18% y 82%
      setLeftPanelWidthPercent(clampedWidth); // Actualiza el estado con el nuevo porcentaje
      safeSetItem('argentina_left_panel_width', String(clampedWidth)); // Persiste el ancho en localStorage
    };

    // Manejador de la finalización del evento de arrastre (al soltar el botón del mouse)
    const handlePointerUp = () => {
      if (isResizingPanels) {
        setIsResizingPanels(false); // Desactiva el estado de arrastre
      }
    };

    if (isResizingPanels) {
      window.addEventListener('mousemove', handlePointerMove); // Añade listener global de movimiento
      window.addEventListener('mouseup', handlePointerUp); // Añade listener global de soltar mouse
      window.addEventListener('touchmove', handlePointerMove); // Listener táctil
      window.addEventListener('touchend', handlePointerUp); // Listener fin táctil
    }

    return () => { // Limpieza de listeners al desmontar o cambiar estado
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isResizingPanels]);

  // Función para restablecer todos los perfiles de usuario a los valores iniciales predeterminados
  const handleResetProfiles = () => { // Función de restablecimiento
    setUserProfiles(DEFAULT_USER_PROFILES); // Restablece los perfiles por defecto
    safeSetItem('argentina_user_profiles', JSON.stringify(DEFAULT_USER_PROFILES)); // Guarda en localStorage
  }; // Fin de handleResetProfiles

  // Función para modificar y alternar el rol RBAC del usuario directamente
  const handleSelectRole = (newRole: UserRole) => { // Función manejadora para la selección de rol
    setUserRole(newRole); // Actualiza el estado local de rol
    safeSetItem('argentina_user_role', newRole); // Persiste el rol seleccionado en almacenamiento seguro
    if (newRole === 'admin') { // Si se eligió el rol admin
      safeSetItem('argentina_admin_logged', 'true'); // Marca el indicador de admin guardado
    } else { // Si se eligió otro rol
      safeRemoveItem('argentina_admin_logged'); // Elimina el indicador de admin de localStorage
      sessionStorage.removeItem('argentina_admin_logged'); // Elimina el indicador de admin de sessionStorage
    } // Fin del bloque condicional
  }; // Fin de handleSelectRole

  // Base de datos de provincias (inicializa desde almacenamiento seguro o utiliza los datos iniciales de Argentina)
  const [provincesData, setProvincesData] = useState<Record<string, ProvinceData>>(() => { // Inicialización de provincesData
    const saved = safeGetItem('argentina_data_custom_provinces'); // Carga la memoria persistida del navegador
    let data = { ...mockProvincesData }; // Clona los datos base de Argentina
    if (saved) { // Si existen datos guardados previa
      try { // Manejo de excepciones
        const parsed = JSON.parse(saved); // Parsea los datos guardados en JSON
        if (parsed && typeof parsed === 'object') {
          data = { ...data, ...parsed };
        }
      } catch (e) { // Captura posibles errores sintácticos de parseo
        console.error("Error al cargar datos guardados de localStorage:", e); // Imprime el error en la consola
      } // Fin de try-catch
    } // Fin de condicional saved

    // Comprueba si existe una versión del mapa Mundial guardado específicamente en la clave argentina_advanced_canvas_map_WORLD_MAP
    const savedWorldCanvas = safeGetItem('argentina_advanced_canvas_map_WORLD_MAP');
    if (savedWorldCanvas) {
      try {
        const parsedCanvas = JSON.parse(savedWorldCanvas);
        if (parsedCanvas && Array.isArray(parsedCanvas.paths) && parsedCanvas.paths.length > 0) {
          const worldMunis = parsedCanvas.paths.map((p: any) => ({
            id: p.id,
            name: p.name,
            value: p.customData?.valor || p.customData?.value || 30,
            percentage: p.customData?.porcentaje || p.customData?.percentage || 10,
            d: p.d,
            color: p.customData?.fill || p.visualStyles?.fillColor || p.fill || '#10b981'
          }));
          data['WORLD_MAP'] = {
            ...(data['WORLD_MAP'] || defaultWorldMapData),
            municipalities: worldMunis
          };
        }
      } catch (err) {
        console.error("Error al restaurar WORLD_MAP guardado en canvas:", err);
      }
    }
    
    // Inyección automatizada de las Islas Malvinas (AR-MLV) en alta definición si no están personalizadas
    if (data['AR-MLV'] && (!data['AR-MLV'].municipalities || data['AR-MLV'].municipalities.length === 5)) { // Comprueba Malvinas
      try { // Manejo de excepciones
        const mlvFullD = 'M 597.694 842.519 L 597.430 842.290 L 597.316 841.937 L 596.623 842.319 L 596.447 842.324 L 596.207 842.213 L 595.981 841.871 L 595.768 841.892 L 595.596 841.932 L 595.562 841.850 L 595.655 841.660 L 595.948 841.559 L 596.143 841.371 L 596.104 841.241 L 595.654 841.054 L 595.580 840.709 L 595.471 840.635 L 595.079 841.351 L 595.105 842.076 L 595.015 842.182 L 595.051 842.287 L 595.082 842.575 L 594.959 842.732 L 594.790 843.173 L 595.206 843.521 L 595.304 843.730 L 595.248 844.038 L 595.002 844.340 L 594.722 844.452 L 594.013 844.325 L 593.395 844.348 L 592.700 844.244 L 592.032 844.270 L 591.498 844.369 L 590.750 844.597 L 590.086 844.913 L 599.963 844.706 L 590.145 844.387 L 590.598 843.993 L 591.189 843.707 L 591.743 843.194 L 591.892 842.926 L 591.890 842.781 L 591.802 842.789 L 591.446 843.138 L 590.934 843.445 L 591.080 843.015 L 590.924 843.102 L 590.244 843.626 L 590.095 843.627 L 590.098 843.156 L 589.996 843.188 L 589.847 843.336 L 589.512 843.525 L 589.284 843.764 L 588.825 843.855 L 588.687 844.231 L 588.380 844.454 L 588.072 844.288 L 587.618 844.306 L 588.110 844.903 L 588.218 845.220 L 588.339 845.039 L 588.547 845.093 L 588.679 845.759 L 588.662 846.209 L 588.694 846.279 L 588.862 846.190 L 588.861 846.421 L 588.741 846.856 L 588.742 847.232 L 588.723 847.294 L 588.625 847.945 L 588.774 848.283 L 588.850 848.288 L 588.975 848.143 L 588.979 848.058 L 589.112 847.258 L 589.140 846.916 L 589.276 846.019 L 589.337 845.262 L 589.469 844.946 L 589.672 844.952 L 589.750 845.090 L 589.499 845.489 L 589.527 846.250 L 589.387 847.220 L 589.331 848.037 L 589.313 848.100 L 589.171 848.816 L 588.987 849.002 L 588.753 849.072 L 588.433 849.538 L 588.233 850.054 L 587.934 850.360 L 587.454 851.119 L 587.026 851.655 L 586.967 852.073 L 586.645 852.272 L 586.496 852.310 L 586.109 852.491 L 585.967 852.467 L 585.819 852.142 L 585.658 852.302 L 585.528 852.277 L 585.304 852.067 L 585.335 851.749 L 585.236 851.274 L 585.024 851.063 L 584.850 851.224 L 585.058 851.654 L 585.110 851.915 L 585.007 852.276 L 585.132 852.374 L 585.338 852.403 L 585.497 852.595 L 585.669 852.664 L 585.810 852.930 L 585.611 853.214 L 585.110 853.285 L 584.840 853.127 L 584.672 852.973 L 584.367 853.098 L 584.206 852.894 L 584.388 852.430 L 584.376 851.934 L 584.276 851.701 L 584.188 851.587 L 583.932 851.562 L 583.700 851.656 L 583.627 851.687 L 583.142 851.912 L 582.781 852.102 L 582.431 852.413 L 582.382 852.562 L 582.539 852.730 L 582.791 852.841 L 583.062 852.877 L 583.053 853.047 L 582.861 853.282 L 582.615 853.365 L 582.198 853.257 L 581.959 852.904 L 582.029 852.206 L 581.973 852.030 L 581.763 852.206 L 581.567 852.660 L 580.760 851.957 L 580.030 851.125 L 579.782 850.796 L 579.723 850.329 L 579.769 850.022 L 579.749 849.951 L 579.603 850.013 L 579.403 850.430 L 579.090 850.604 L 578.708 850.589 L 578.630 850.693 L 578.329 850.732 L 578.306 850.879 L 578.341 850.985 L 578.527 851.065 L 578.871 851.083 L 579.007 851.040 Z M 599.555 847.372 L 599.642 847.167 L 599.809 847.001 L 599.866 846.764 L 599.771 846.313 L 599.859 846.120 L 600.096 846.007 L 600.317 846.163 L 600.426 846.332 L 600.790 846.228 L 600.838 846.405 L 600.641 846.732 L 600.502 847.211 L 600.550 847.290 L 600.615 847.306 L 600.774 847.275 L 600.977 846.996 L 601.124 847.161 L 601.059 847.339 L 600.929 847.500 L 600.926 847.670 L 600.777 847.785 L 600.839 847.875 L 601.337 847.840 L 601.709 847.698 L 601.775 847.727 L 601.798 847.809 L 601.774 848.104 L 601.873 848.287 L 601.942 848.339 L 602.051 848.010 L 602.255 847.937 L 602.478 847.910 L 602.537 847.782 L 602.458 847.657 L 602.097 847.397 L 602.253 847.244 L 602.620 847.164 L 602.685 846.889 L 602.638 846.627 L 602.720 846.581 L 603.144 846.846 L 603.118 847.031 L 603.422 847.530 L 603.766 847.184 L 603.921 847.409 L 604.248 847.406 L 604.341 847.540 L 604.267 847.938 L 604.484 847.961 L 604.629 847.919 L 604.744 848.124 L 604.648 848.354 L 604.490 848.398 L 604.306 848.335 L 604.323 848.564 L 604.429 848.794 L 604.640 848.963 L 604.646 849.108 L 604.564 849.252 L 604.633 849.389 L 604.597 849.503 L 604.135 849.340 L 603.963 849.373 L 603.823 849.548 L 603.738 849.667 L 603.459 849.944 L 603.419 850.119 L 603.555 850.103 L 603.888 849.856 L 604.116 849.768 L 604.359 849.799 L 604.887 850.562 L 604.811 850.754 L 604.728 850.885 L 604.884 839.024 L 604.843 851.479 L 604.924 852.004 L 604.889 852.215 L 604.978 852.314 L 605.140 852.306 L 605.279 852.022 L 605.300 851.509 L 605.182 851.086 L 605.254 850.968 L 605.444 851.066 L 605.694 851.534 L 605.640 851.796 L 605.974 852.132 L 606.199 852.786 L 606.253 852.816 L 606.375 852.497 L 606.604 852.518 L 606.35 852.369 L 606.459 851.989 L 606.476 851.926 L 606.682 851.962 L 607.318 852.103 L 607.458 852.111 L 607.530 851.992 L 607.352 851.880 L 606.604 851.753 L 606.514 851.642 L 606.222 851.410 L 606.572 851.318 L 606.273 851.245 L 606.237 851.067 L 606.457 850.919 L 606.126 850.801 L 605.849 850.798 L 605.655 850.664 L 605.629 850.664 Z M 600.947 802.992 L 600.730 803.050 L 600.391 802.792 L 600.526 802.537 L 600.703 802.447 L 600.834 802.506 L 600.953 802.688 L 601.274 802.899 L 601.374 803.023 L 601.326 803.161 Z'; // Trazados vectoriales
        const parts = mlvFullD.split(/(?=M)/).map(p => p.trim()).filter(p => p.length > 0); // Separa los polígonos por comando M
        
        const malvinasPobreza = data['AR-MLV'].socialEmployment?.pobreza || 32.0; // Obtiene o infiere pobreza
        data['AR-MLV'].municipalities = [ // Inyecta las tres islas principales
          { id: 'mlv_west', name: 'Gran Malvina (Isla Oeste)', value: Math.round(malvinasPobreza - 3), percentage: 38, d: parts[0] }, // Isla Oeste
          { id: 'mlv_east', name: 'Isla Soledad (Isla Este)', value: Math.round(malvinasPobreza + 4), percentage: 55, d: parts[1] }, // Isla Este
          { id: 'mlv_islets', name: 'Pequeños Islotes y Arrecifes', value: Math.round(malvinasPobreza - 12), percentage: 7, d: parts[2] } // Islotes
        ]; // Fin de asignación de municipios
        data['AR-MLV'].mapTransform = { scale: 2.2, panX: -1218, panY: -1715 }; // Posición y zoom centrado
      } catch (err) { // Manejo de errores
        console.error("Error al inyectar Islas Malvinas por defecto:", err); // Notifica el fallo en consola
      } // Fin de try-catch
    } // Fin de inyección de Malvinas
    return data; // Retorna la estructura cargada o por defecto
  }); // Fin del hook useState de provincesData

  // FUNCIÓN PARA RESTAURAR UN PROYECTO DESDE UN OBJETO JSON CARGADO
  const loadProjectFromJSON = (projectData: any) => { // Inyecta la estructura cargada al estado de la app
    if (!projectData || typeof projectData !== 'object') { // Validación de estructura básica
      alert('Error: El archivo seleccionado no contiene un formato de proyecto válido.'); // Alerta de error
      return; // Interrumpe la ejecución
    } // Fin de validación

    if (projectData.activeMapLevel) setActiveMapLevel(projectData.activeMapLevel); // Restaura el nivel de mapa
    if (projectData.selectedProvinceId !== undefined) setSelectedProvinceId(projectData.selectedProvinceId); // Restaura la provincia activa
    if (projectData.selectedMetric) setSelectedMetric(projectData.selectedMetric); // Restaura la métrica activa
    if (projectData.navPath && Array.isArray(projectData.navPath)) setNavPath(projectData.navPath); // Restaura la ruta de navegación
    if (projectData.provincesData && typeof projectData.provincesData === 'object') { // Restaura provincias
      setProvincesData(prev => ({ ...prev, ...projectData.provincesData })); // Fusiona los datos provinciales
    } // Fin de provincesData
    if (projectData.appTreeNodes && Array.isArray(projectData.appTreeNodes)) { // Restaura árbol de nodos
      setAppTreeNodes(projectData.appTreeNodes); // Actualiza el árbol de la BD
    } // Fin de appTreeNodes
  }; // Fin de loadProjectFromJSON

  // Estado para la provincia seleccionada (null por defecto cuando estamos en un nodo padre como Argentina)
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null); // Estado para la provincia seleccionada (null por defecto)
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('pobreza'); // Estado para la métrica activa (pobreza, desempleo, etc.)
  const [activeMapLevel, setActiveMapLevel] = useState<string>('country'); // Estado para el nivel de mapa activo ('world' | 'continent' | 'country' | 'province')

  // Estado de historial de ruta dinámico universal para la navegación jerárquica ilimitada (Motor Vectorial)
  const [navPath, setNavPath] = useState<NavNode[]>([ // Inicializador con el nodo raíz Inicio
    { id: 'root', name: 'Inicio', type: 'root' } // Nodo raíz universal por defecto
  ]); // Fin del estado navPath

  // Estado para gestionar la lista de niveles jerárquicos configurables
  const [mapLevels, setMapLevels] = useState<{ id: string; name: string }[]>(() => { // Inicializador diferido
    const saved = safeGetItem('argentina_map_levels'); // Intenta leer niveles guardados previamente
    if (saved) { // Si existen datos
      try { // Manejo de excepciones
        return JSON.parse(saved); // Devuelve la lista parseada
      } catch (e) {} // Captura errores de parseo
    } // Fin de verificación de nivel guardado
    return [ // Niveles jerárquicos predeterminados
      { id: 'world', name: 'Mundo' }, // Nivel Mundial
      { id: 'continent', name: 'Continente' }, // Nivel Continental
      { id: 'country', name: 'País (Nación)' }, // Nivel País
      { id: 'province', name: 'Provincia' }, // Nivel Provincia
      { id: 'city', name: 'Ciudad (Municipio)' }, // Nivel Municipio
      { id: 'neighborhood', name: 'Barrios' } // Nivel Barrio
    ]; // Fin de la lista predeterminada
  }); // Fin del hook useState mapLevels

  // Manejador para actualizar la lista de niveles de mapa y conservarla en almacenamiento
  const handleUpdateMapLevels = (newLevels: { id: string; name: string }[]) => { // Función para guardar niveles
    setMapLevels(newLevels); // Actualiza el estado
    safeSetItem('argentina_map_levels', JSON.stringify(newLevels)); // Persiste de forma segura
  }; // Fin de handleUpdateMapLevels

  // Estado de la subdivisión municipal o barrial activa seleccionada por el usuario
  const [selectedSubdivisionId, setSelectedSubdivisionId] = useState<string | null>(() => { // Inicializador diferido
    return safeGetItem('argentina_selected_subdivision_id') || null; // Lee la subdivisión o devuelve null
  }); // Fin de useState selectedSubdivisionId

  // REGLA DE ORO 1: Separación estricta de Estado
  // selectedNodeId representa la 'Región que estoy mirando' (Micro Vista) en el DataPanel.
  // Es independiente de 'currentLevelId' y 'navPath' ('Lugar donde estoy parado').
  const selectedNodeId = selectedSubdivisionId; // Alias semántico para la región inspeccionada

  // REGLA DE ORO 2 - Clic Simple: Actualiza únicamente 'selectedNodeId' para inspeccionar datos
  const handleSelectNode = (id: string | null) => { // Manejador de selección de región/nodo
    setSelectedSubdivisionId(id); // Actualiza la región seleccionada para inspección
    if (id) { // Si el ID existe
      safeSetItem('argentina_selected_subdivision_id', id); // Guarda la selección activa
    } else { // Si la selección es nula
      safeRemoveItem('argentina_selected_subdivision_id'); // Remueve la clave de selección
    } // Fin del bloque condicional
  }; // Fin de handleSelectNode

  // REGLA DE ORO 2 - Doble Clic (Drill-Down): Profundiza en un nodo agregándolo a navPath y resetea la selección
  const handleDrillDown = (node: NavNode) => { // Recibe el nodo al que se le hace doble clic
    MapsToNode(node); // Modifica navPath y currentLevelId para hacer zoom/navegar al nodo
    handleSelectNode(null); // Limpia la selección para mostrar la Vista Macro del nuevo nivel
  }; // Fin de handleDrillDown

  // Función para seleccionar o deseleccionar una subdivisión geográfica (retrocompatibilidad)
  const handleSelectSubdivision = (id: string | null) => { // Manejador de subdivisión
    handleSelectNode(id); // Reenvía la llamada a handleSelectNode
  }; // Fin de handleSelectSubdivision

  // INTEGRACIÓN DEL HOOK PERSONALIZADO useProjectManager PARA GESTIÓN DE ARCHIVOS Y DESTELLOS DE SEGURIDAD
  const {
    projectName,
    setProjectName,
    isDirty,
    setIsDirty,
    handleNew: handleNewProject,
    handleOpen: handleOpenProject,
    handleSave: handleSaveProject,
    handleSaveAs: handleSaveAsProject,
    handleClose: handleCloseProject
  } = useProjectManager(
    {
      projectName: 'Proyecto Sin Título',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      activeMapLevel,
      selectedProvinceId,
      selectedMetric,
      navPath,
      provincesData,
      appTreeNodes
    },
    (loadedData: any) => {
      if (Array.isArray(loadedData) && loadedData.length === 0) { // Si es un reset a lienzo limpio
        setProvincesData({ ...mockProvincesData }); // Restablece los datos a los valores iniciales de Argentina
        setActiveMapLevel('country'); // Cambia la vista al nivel país
        setSelectedProvinceId(null); // Limpia la selección de provincia
        setSelectedMetric('pobreza'); // Restablece la métrica a pobreza
        setNavPath([{ id: 'root', name: 'Inicio', type: 'root' }]); // Restablece la ruta raíz
        setSelectedSubdivisionId(null); // Limpia la subdivisión activa
      } else {
        loadProjectFromJSON(loadedData); // Carga la estructura JSON importada
      }
    }
  );

  // MANEJADOR PARA CAMBIAR EL NOMBRE DEL PROYECTO EN CALIENTE
  const handleProjectNameChange = (newName: string) => { // Recibe el nuevo texto del título del proyecto
    setProjectName(newName); // Actualiza el estado del nombre
    setIsDirty(true); // Marca el estado como modificado
  }; // Fin de handleProjectNameChange

  // Cálculo derivado del ID de la entidad territorial activa según el nivel del mapa
  const activeProvinceId = 
    activeMapLevel === 'world' ? 'WORLD_MAP' :
    activeMapLevel === 'continent' ? 'CONTINENT_MAP' :
    selectedProvinceId; // Retorna el ID correspondiente al nivel o null si no hay provincia seleccionada

  // Carga de la provincia o entidad territorial activa leyendo del último elemento de navPath
  const selectedProvince: ProvinceData = useMemo(() => { // Memoriza los datos del territorio activo de forma atómica
    const lastNavNode = navPath && navPath.length > 0 ? navPath[navPath.length - 1] : null; // Toma el último nodo activo del array navPath
    if (!lastNavNode || lastNavNode.id === 'root') { // Si no hay nodo o la navegación está en el inicio raíz
      return provincesData['COUNTRY_MAP'] || defaultCountryMapData; // Retorna datos macro de la República Argentina por defecto
    } // Fin de verificación de nodo raíz
    const lastId = lastNavNode.id.toLowerCase(); // Normaliza el identificador a minúsculas
    if (lastId === 'world' || lastId === 'mundo') { // Si el nodo terminal es el Nivel Mundo
      return provincesData['WORLD_MAP'] || defaultWorldMapData; // Retorna datos e indicadores del mapa mundial
    } // Fin de verificación del nivel Mundo
    if (lastId === 'continent' || lastId === 'continente') { // Si el nodo terminal es el Nivel Continente
      return provincesData['CONTINENT_MAP'] || defaultContinentMapData; // Retorna datos e indicadores del mapa continental
    } // Fin de verificación del nivel Continente
    if (lastId === 'country' || lastId === 'argentina' || lastId === 'pais') { // Si el nodo terminal es el Nivel País Argentina
      if (selectedProvinceId && selectedProvinceId !== 'COUNTRY_MAP' && (provincesData[selectedProvinceId] || mockProvincesData[selectedProvinceId])) {
        return provincesData[selectedProvinceId] || mockProvincesData[selectedProvinceId];
      }
      return provincesData['COUNTRY_MAP'] || defaultCountryMapData; // Retorna los datos macro de la República Argentina
    } // Fin de verificación del nivel País

    // Recupera la estructura base de datos correspondiente al nodo terminal activo
    let baseProv: ProvinceData; // Variable contenedora de datos base
    if (provincesData[lastNavNode.id] || mockProvincesData[lastNavNode.id]) { // Verifica si el nodo existe en el registro
      baseProv = provincesData[lastNavNode.id] || mockProvincesData[lastNavNode.id]; // Asigna la provincia registrada
    } else if (selectedProvinceId && (provincesData[selectedProvinceId] || mockProvincesData[selectedProvinceId])) { // Verifica selección
      baseProv = provincesData[selectedProvinceId] || mockProvincesData[selectedProvinceId]; // Asigna provincia por ID
    } else { // Si es un nodo territorial personalizado o genérico
      baseProv = { // Crea el objeto base con metadatos heredados del sistema
        id: lastNavNode.id, // ID del nodo terminal activo
        name: lastNavNode.name, // Nombre de la entidad territorial
        abbreviation: lastNavNode.id.toUpperCase(), // Abreviatura generada en mayúsculas
        economicProfile: defaultCountryMapData.economicProfile, // Perfil económico heredado
        socialEmployment: defaultCountryMapData.socialEmployment, // Indicadores sociales heredados
        incomeStructure: defaultCountryMapData.incomeStructure, // Estructura de ingresos heredada
        connectivity: defaultCountryMapData.connectivity, // Conectividad heredada
        budgetSpending: defaultCountryMapData.budgetSpending, // Presupuesto heredado
        mobilityServices: defaultCountryMapData.mobilityServices, // Servicios heredados
        municipalities: [] // Colección vacía por defecto
      }; // Fin del objeto de respaldo
    } // Fin del bloque condicional de resolución base

    // BÚSQUEDA DE HIJOS DIRECTOS (parentId === lastNavNode.id) EN EL ÁRBOL DINÁMICO DE BASE DE DATOS (appTreeNodes)
    const activeParentId = lastNavNode.id; // Asigna el identificador del nodo activo como padre objetivo
    const dynamicChildren = appTreeNodes.filter(n => // Filtra los subnodos cuyo parentId sea idéntico al nodo activo
      (n.parentId === activeParentId || (activeParentId === 'root' && (!n.parentId || n.parentId === 'root'))) && // Comprueba relación padre
      n.isVisible !== false // Aplica filtro estricto de visibilidad pública
    ); // Fin de filtrado de hijos

    // Si existen subnodos registrados para esta región, los convierte en sus subdivisiones/municipios
    if (dynamicChildren && dynamicChildren.length > 0) { // Si hay elementos hijos válidos
      const dynamicMunicipalities = dynamicChildren.map(n => ({ // Mapea los nodos al formato de municipios
        id: n.id, // Identificador único
        name: n.name, // Nombre de la subdivisión
        value: n.value ?? 30, // Valor cuantitativo
        percentage: n.percentage ?? 10, // Porcentaje territorial
        d: n.d || n.svgData || (n.paths && n.paths[0] ? n.paths[0].d : ''), // Comandos vectoriales SVG
        color: '#10b981' // Color primario por defecto
      })); // Fin del mapeo
      return { // Retorna el objeto unificado con las subdivisiones dinámicas
        ...baseProv, // Copia las propiedades base de la provincia
        id: lastNavNode.id, // Garantiza el ID del nodo terminal activo
        name: lastNavNode.name, // Garantiza el nombre del nodo terminal activo
        municipalities: dynamicMunicipalities // Asigna las subdivisiones dinámicas encontradas
      }; // Fin del retorno unificado
    } // Fin del condicional de subnodos dinámicos

    // ELIMINACIÓN TOTAL DEL FALLBACK AL MAPA DEL PADRE: Retorna estrictamente el objeto del nodo activo con sus subdivisiones
    return { // Retorna el objeto territorial del nodo activo de forma aislada
      ...baseProv, // Copia los datos base
      id: lastNavNode.id, // Mantiene el ID del nodo activo
      name: lastNavNode.name, // Mantiene el nombre del nodo activo
      municipalities: baseProv.municipalities || [] // Retorna únicamente sus subdivisiones (si no tiene, pasa array vacío para Lienzo en Blanco)
    }; // Fin del objeto territorial estricto sin fallback
  }, [navPath, selectedProvinceId, provincesData, appTreeNodes]); // Dependencias del memorizador


  // FUNCIÓN UNIVERSAL DE NAVEGACIÓN JERÁRQUICA INTELIGENTE: REEMPLAZA HERMANOS Y AUTO-RECONSTRUYE RUTA COMPLETA
  const MapsToNode = (node: NavNode) => { // Función principal de enrutamiento jerárquico
    const nodeId = node.id ? node.id.toLowerCase() : ''; // Normaliza el identificador a minúsculas
    const nodeType = node.type ? node.type.toLowerCase() : ''; // Normaliza el tipo a minúsculas

    // 1. RECONSTRUCCIÓN AUTO-JERÁRQUICA LIMPIA: Determina la cadena de ancestros exacta desde la raíz 'root' hasta el nodo seleccionado
    let cleanPath: NavNode[] = [ // Inicializa el camino limpio siempre con el nodo raíz
      { id: 'root', name: 'Inicio', type: 'root' } // Nodo raíz de la plataforma
    ]; // Fin de inicialización de cleanPath

    // Caso A: Si el objetivo es el nodo Raíz
    if (nodeId === 'root' || nodeType === 'root') { // Evalúa si es la raíz
      // cleanPath ya tiene sólo el nodo raíz
    } 
    // Caso B: Si el objetivo es el nivel Mundo
    else if (nodeId === 'world' || nodeId === 'mundo' || nodeType === 'world' || nodeType === 'macro_level' && nodeId === 'world') { // Evalúa si es el mapa mundial
      cleanPath.push({ id: 'world', name: 'Mundo', type: 'world' }); // Agrega el nodo Mundo
    } 
    // Caso C: Si el objetivo es el nivel Continente
    else if (nodeId === 'continent' || nodeId === 'continente' || nodeId === 'america_del_sur' || nodeType === 'continent') { // Evalúa si es continente
      cleanPath.push({ id: 'world', name: 'Mundo', type: 'world' }); // Auto-agrega Mundo
      cleanPath.push({ id: 'continent', name: 'América del Sur', type: 'continent' }); // Agrega Continente
    } 
    // Caso D1: Si el objetivo es la categoría Cartografía general -> Lleva a nivel Mundo para elegir país
    else if (nodeId === 'cartografia' || nodeType === 'categoria_cartografia') {
      cleanPath.push({ id: 'world', name: 'Mundo', type: 'world' }); // Lleva al nivel Mundo global para seleccionar país
    }
    // Caso D2: Si el objetivo es específicamente el nivel País (República Argentina / País)
    else if (nodeId === 'country' || nodeId === 'pais' || nodeId === 'argentina' || nodeId === 'world_ar' || nodeId === 'cont_ar' || nodeType === 'country') {
      cleanPath.push({ id: 'world', name: 'Mundo', type: 'world' }); // Auto-agrega Mundo
      cleanPath.push({ id: 'continent', name: 'América del Sur', type: 'continent' }); // Auto-agrega Continente
      cleanPath.push({ id: 'country', name: 'Argentina', type: 'country' }); // Agrega País Argentina
    } 
    // Caso E: Si el objetivo es una Provincia (Ej: Buenos Aires 'AR-B', Misiones 'AR-N', Córdoba 'AR-X')
    else if (provincesData[node.id] || mockProvincesData[node.id] || node.id.startsWith('AR-') || nodeType === 'provincia' || nodeType === 'province' || nodeType === 'drill_down_provincia') {
      const provData = provincesData[node.id] || mockProvincesData[node.id]; // Recupera datos de la provincia
      const provId = provData ? provData.id : node.id; // Asigna ID de provincia
      const provName = provData ? provData.name : node.name; // Asigna nombre oficial de la provincia

      cleanPath.push({ id: 'world', name: 'Mundo', type: 'world' }); // Auto-construcción: Mundo
      cleanPath.push({ id: 'continent', name: 'América del Sur', type: 'continent' }); // Auto-construcción: América del Sur
      cleanPath.push({ id: 'country', name: 'Argentina', type: 'country' }); // Auto-construcción: Argentina
      cleanPath.push({ id: provId, name: provName, type: 'provincia' }); // Agrega la Provincia (¡Sustituye automáticamente cualquier otra provincia previa!)
    } 
    // Caso F: Si el objetivo es un Municipio o Subdivisión
    else if (nodeType === 'subdivision' || nodeType === 'city' || nodeType === 'municipio') {
      // Localiza la provincia propietaria de este municipio en la base de datos
      const ownerProv = (Object.values(provincesData) as ProvinceData[]).find(p => p.municipalities?.some(m => m.id === node.id)) || 
                        (Object.values(mockProvincesData) as ProvinceData[]).find(p => p.municipalities?.some(m => m.id === node.id)) ||
                        provincesData[selectedProvinceId] || mockProvincesData[selectedProvinceId]; // Infiere la provincia

      cleanPath.push({ id: 'world', name: 'Mundo', type: 'world' }); // Auto-construcción: Mundo
      cleanPath.push({ id: 'continent', name: 'América del Sur', type: 'continent' }); // Auto-construcción: América del Sur
      cleanPath.push({ id: 'country', name: 'Argentina', type: 'country' }); // Auto-construcción: Argentina
      if (ownerProv) { // Si se identificó la provincia contenedora
        cleanPath.push({ id: ownerProv.id, name: ownerProv.name, type: 'provincia' }); // Auto-construcción: Provincia
      } // Fin de condicional ownerProv
      cleanPath.push({ id: node.id, name: node.name, type: 'subdivision' }); // Agrega el Municipio
    } 
    // Caso G: Otros nodos universales (Salud, Anatomía, Capas personalizadas)
    else {
      cleanPath.push({ id: 'world', name: 'Mundo', type: 'world' }); // Auto-construcción: Mundo
      cleanPath.push({ id: node.id, name: node.name, type: node.type || 'generic' }); // Agrega el nodo genérico
    } // Fin del bloque condicional de reconstrucción de árbol

    // 2. ACTUALIZACIÓN DEL ESTADO UNIVERSAL NAVPATH CON LA RUTA RECONSTRUIDA SIN HERMANOS REPETIDOS
    setNavPath(cleanPath); // Establece la ruta reconstruida limpia de forma atómica

    // 3. SINCRONIZACIÓN DE LOS ESTADOS DEL MOTOR DE MAPAS
    const targetLast = cleanPath[cleanPath.length - 1]; // Toma el nodo terminal objetivo
    const lastId = targetLast.id.toLowerCase(); // Identificador del objetivo final
    const lastType = targetLast.type ? targetLast.type.toLowerCase() : ''; // Tipo del objetivo final

    if (lastId === 'root') { // Si estamos en raíz
      setActiveMapLevel('country'); // Nivel país
      setSelectedProvinceId(null); // Deselecciona la provincia para mostrar nivel raíz
      handleSelectSubdivision(null); // Limpia subdivisión
    } else if (lastId === 'world') { // Si estamos en Mundo
      setActiveMapLevel('world'); // Establece vista mundo
      setSelectedProvinceId(null); // Deselecciona la provincia
      handleSelectSubdivision(null); // Limpia subdivisión
    } else if (lastId === 'continent') { // Si estamos en Continente
      setActiveMapLevel('continent'); // Establece vista continente
      setSelectedProvinceId(null); // Deselecciona la provincia
      handleSelectSubdivision(null); // Limpia subdivisión
    } else if (lastId === 'country' || lastId === 'argentina' || lastId === 'pais') { // Si estamos en Argentina
      setActiveMapLevel('country'); // Establece vista país
      setSelectedProvinceId(null); // ¡Cero selección interna! Al estar en Argentina no hay provincia resaltada por defecto
      handleSelectSubdivision(null); // Limpia subdivisión
    } else if (lastType === 'provincia') { // Si estamos en una Provincia o Sub-región activa
      setActiveMapLevel('province'); // Establece el nivel 'province' para buscar sus subdivisiones locales (no el mapa nacional completo)
      setSelectedProvinceId(targetLast.id); // Asigna el identificador de la provincia activa
      safeSetItem('argentina_selected_province_id', targetLast.id); // Guarda la selección activa en el almacenamiento
      handleSelectSubdivision(null); // Limpia cualquier subdivisión seleccionada previamente
    } else if (lastType === 'subdivision') { // Si estamos en un Municipio o Subdivisión
      setActiveMapLevel('province'); // Nivel provincia para ver la subdivisión municipal en su contexto local
      if (cleanPath.length >= 2) { // Si existe la provincia anterior en la cadena de navegación
        const provParent = cleanPath[cleanPath.length - 2]; // Obtiene el nodo de la provincia contenedora
        if (provParent && provParent.type === 'provincia') { // Valida que sea de tipo provincia
          setSelectedProvinceId(provParent.id); // Selecciona la provincia contenedora
        } // Fin de validación del padre
      } // Fin de comprobación de ancestro
      handleSelectSubdivision(targetLast.id); // Asigna la subdivisión seleccionada
    } else { // Si es un nodo de región intermedia u otro tipo genérico personalizado
      setActiveMapLevel('province'); // Establece el nivel de mapa en 'province' para intentar renderizar sus sub-polígonos locales
      setSelectedProvinceId(targetLast.id); // Asigna el ID del nodo personalizado
      handleSelectSubdivision(null); // Limpia la subdivisión
    } // Fin de sincronización de nivel de mapa
  }; // Fin de MapsToNode

  // FUNCIÓN PARA RETROCEDER EN EL HISTORIAL NAVPATH Y REAJUSTAR EL MOTOR DEL MAPA
  const goBackToNode = (index: number) => { // Recorta el historial hasta la posición del clic
    setNavPath(prev => { // Actualización de estado
      const sliced = prev.slice(0, index + 1); // Corta el array hasta el índice especificado
      const targetNode = prev[index]; // Obtiene el nodo objetivo al que se retrocede
      if (targetNode) { // Si existe el nodo objetivo
        const targetId = targetNode.id ? targetNode.id.toLowerCase() : ''; // Normaliza la ID
        const targetType = targetNode.type ? targetNode.type.toLowerCase() : ''; // Normaliza el tipo
        
        if (targetId === 'root') { // Si retrocedió al inicio raíz
          setActiveMapLevel('country'); // Restablece mapa al nivel país
          setSelectedProvinceId(null); // Sin provincia seleccionada
          handleSelectSubdivision(null); // Limpia la subdivisión
        } else if (targetId === 'world' || targetId === 'mundo') { // Si retrocedió a Mundo
          setActiveMapLevel('world'); // Cambia la vista al mapa mundial
          setSelectedProvinceId(null); // Sin provincia seleccionada
          handleSelectSubdivision(null); // Deselecciona subdivisión
        } else if (targetId === 'continent' || targetId === 'continente') { // Si retrocedió a Continente
          setActiveMapLevel('continent'); // Cambia a vista continental
          setSelectedProvinceId(null); // Sin provincia seleccionada
          handleSelectSubdivision(null); // Deselecciona subdivisión
        } else if (targetId === 'cartografia' || targetId === 'country' || targetId === 'pais' || targetId === 'argentina') { // Si retrocedió a Cartografía o Argentina
          setActiveMapLevel('country'); // Cambia al nivel de país
          setSelectedProvinceId(null); // ¡Deselecciona la provincia! Muestra datos macro de Argentina
          handleSelectSubdivision(null); // Deselecciona subdivisión
        } else if (provincesData[targetNode.id] || mockProvincesData[targetNode.id] || targetType === 'provincia') { // Si retrocedió a una provincia o región
          setActiveMapLevel('province'); // Mantiene el nivel de mapa en 'province' para no saltar al mapa nacional completo
          setSelectedProvinceId(targetNode.id); // Reestablece la provincia activa
          handleSelectSubdivision(null); // Limpia subdivisión
        } else if (targetType === 'subdivision') { // Si retrocedió a un municipio
          setActiveMapLevel('province'); // Cambia al nivel de provincia
          handleSelectSubdivision(targetNode.id); // Selecciona el municipio
        } else { // Si retrocedió a un nodo genérico o región
          setActiveMapLevel('province'); // Establece nivel 'province' para la región activa
          setSelectedProvinceId(targetNode.id); // Asigna el nodo objetivo
          handleSelectSubdivision(null); // Limpia subdivisión
        } // Fin del condicional de nivel
      } // Fin de verificación de targetNode
      return sliced; // Devuelve el array de ruta recortado
    }); // Fin de setNavPath
  }; // Fin de goBackToNode

  // Estado que mantiene el historial de navegación para las migas de pan (Breadcrumbs)
  const [navigationPath, setNavigationPath] = useState<RegionNode[]>([ // Inicializa la ruta raíz
    { level: 'mundo', id: 'world', name: 'Mundo' } // Nodo raíz Mundo
  ]); // Fin de useState navigationPath

  // Efecto que sincroniza dinámicamente las migas de pan tradicionales según el nivel activo y la provincia seleccionada
  useEffect(() => { // Hook useEffect para actualizar las migas de pan
    const path: RegionNode[] = [{ level: 'mundo', id: 'world', name: 'Mundo' }]; // Inicia siempre en Mundo

    if (activeMapLevel !== 'world') { // Si estamos en nivel superior a Mundo
      path.push({ level: 'continente', id: 'continent', name: 'América del Sur' }); // Agrega Continente
    } // Fin de verificación de Continente

    if (activeMapLevel === 'country' || activeMapLevel === 'province' || activeMapLevel === 'city' || activeMapLevel === 'neighborhood') { // Si estamos en Argentina
      path.push({ level: 'pais', id: 'country', name: 'Argentina' }); // Agrega Argentina
    } // Fin de verificación de País

    if ((activeMapLevel === 'world' || activeMapLevel === 'continent') && selectedSubdivisionId) { // Si se seleccionó un país en mapa mundial/continental
      const sub = selectedProvince.municipalities?.find(m => m.id === selectedSubdivisionId); // Busca el país o territorio seleccionado
      if (sub) { // Si se encontró
        path.push({ level: 'pais', id: sub.id, name: sub.name }); // Agrega el país seleccionado
      } // Fin de condicional sub
    } // Fin de verificación de país seleccionado

    if (activeMapLevel === 'country' || activeMapLevel === 'province' || activeMapLevel === 'city' || activeMapLevel === 'neighborhood') { // Si se está en nivel de provincia o inferior
      const prov = provincesData[selectedProvinceId] || mockProvincesData[selectedProvinceId]; // Busca los datos de la provincia activa
      if (prov && prov.id !== 'WORLD_MAP' && prov.id !== 'CONTINENT_MAP') { // Verifica que no sea el mapa global
        path.push({ level: 'provincia', id: prov.id, name: prov.name }); // Agrega la provincia a la ruta
      } // Fin de condicional prov
    } // Fin de verificación de provincia

    if ((activeMapLevel === 'province' || activeMapLevel === 'city' || activeMapLevel === 'neighborhood') && selectedSubdivisionId) { // Si hay municipio seleccionado
      const sub = selectedProvince.municipalities?.find(m => m.id === selectedSubdivisionId); // Busca el municipio
      if (sub) { // Si existe el municipio
        path.push({ level: 'ciudad', id: sub.id, name: sub.name }); // Agrega la ciudad o municipio
      } // Fin de condicional sub
    } // Fin de verificación de municipio

    setNavigationPath(path); // Actualiza el estado del camino de migas de pan regional
  }, [activeMapLevel, selectedProvinceId, selectedSubdivisionId, selectedProvince, provincesData]); // Dependencias del efecto

  // Manejador para retroceder o saltar al nivel correspondiente al hacer clic en un enlace de las migas de pan
  const handleBreadcrumbClick = (index: number) => { // Función manejadora para Breadcrumbs
    const node = navigationPath[index]; // Obtiene el nodo de navegación seleccionado
    if (!node) return; // Si no existe el nodo cancela

    if (node.level === 'mundo') { // Si el clic fue en Mundo
      setActiveMapLevel('world'); // Cambia al nivel mundial
      handleSelectSubdivision(null); // Limpia la subdivisión activa
    } else if (node.level === 'continente') { // Si el clic fue en Continente
      setActiveMapLevel('continent'); // Cambia al nivel continental
      handleSelectSubdivision(null); // Limpia la subdivisión activa
    } else if (node.level === 'pais') { // Si el clic fue en País
      if (node.id === 'country' || node.id === 'world_ar' || node.id === 'cont_ar') { // Si es Argentina
        setActiveMapLevel('country'); // Cambia al nivel de país
        handleSelectSubdivision(null); // Limpia la subdivisión
      } else { // Si es otro país
        handleSelectSubdivision(node.id); // Selecciona el país
      } // Fin del condicional
    } else if (node.level === 'provincia') { // Si el clic fue en Provincia
      setActiveMapLevel('country'); // Muestra la vista de país
      setSelectedProvinceId(node.id); // Selecciona la provincia especificada
      handleSelectSubdivision(null); // Limpia el municipio
    } else if (node.level === 'ciudad') { // Si el clic fue en Ciudad
      setActiveMapLevel('province'); // Cambia al nivel de provincia
      handleSelectSubdivision(node.id); // Selecciona la ciudad o municipio
    } // Fin del bloque de navegación
  }; // Fin de handleBreadcrumbClick

  // Auto-navegación descendente directa cuando el usuario hace clic en Argentina dentro del mapa Mundial o Continental
  useEffect(() => { // Hook useEffect para salto automático
    if (selectedSubdivisionId === 'world_ar' || selectedSubdivisionId === 'cont_ar') { // Si seleccionó Argentina
      setActiveMapLevel('country'); // Salta directamente a la vista de país
      handleSelectSubdivision(null); // Resetea la subdivisión activa
    } // Fin del condicional
  }, [selectedSubdivisionId]); // Escucha cambios en selectedSubdivisionId

  // Función manejadora para cambiar el nivel del mapa activo
  const handleMapLevelChange = (level: string) => { // Cambia el nivel
    setActiveMapLevel(level); // Actualiza el estado
  }; // Fin de handleMapLevelChange

  // Guardado en caliente protegido contra errores de cuota de almacenamiento
  const handleUpdateProvince = (updatedProvince: ProvinceData) => { // Actualiza los datos de una provincia
    setProvincesData(prev => { // Actualiza el diccionario de provincias en memoria
      const next = { ...prev, [updatedProvince.id]: updatedProvince }; // Integra la provincia modificada
      safeSetItem('argentina_data_custom_provinces', JSON.stringify(next)); // Intenta guardar de forma segura de manera persistente
      if (updatedProvince.id) { // Si existe la clave de la provincia
        safeSetItem(`argentina_advanced_canvas_map_${updatedProvince.id}`, JSON.stringify({ // Guarda en localStorage específico
          id: updatedProvince.id, // ID de la provincia
          name: updatedProvince.name, // Nombre de la provincia
          level: updatedProvince.id === 'WORLD_MAP' ? 'world' : updatedProvince.id === 'CONTINENT_MAP' ? 'continent' : 'province', // Nivel jerárquico
          paths: (updatedProvince.municipalities || []).map(m => ({ // Mapea los municipios/sub-partes
            id: m.id, // ID del municipio
            name: m.name, // Nombre del municipio
            d: m.d || '', // Trazado SVG 'd'
            customData: { valor: m.value, porcentaje: m.percentage, fill: m.color }, // Metadatos personalizados
            visualStyles: { fillColor: m.color || '#10b981', strokeColor: '#0f172a', strokeWidth: 1.5 } // Estilos de render
          })),
          transform: updatedProvince.mapTransform || { scale: 1, panX: 0, panY: 0 } // Transformaciones de matriz
        }));
      }

      // PROPAGACIÓN AUTOMÁTICA INTELIGENTE: Si la provincia actualizada es una subdivisión (ej: Islas Malvinas, Córdoba, Santa Cruz, etc.) y no es el mapa macro nacional o mundial
      if (updatedProvince.id && updatedProvince.id !== 'COUNTRY_MAP' && updatedProvince.id !== 'WORLD_MAP' && updatedProvince.id !== 'CONTINENT_MAP') {
        const countryMap = next['COUNTRY_MAP']; // Obtiene la referencia al mapa principal de Argentina
        if (countryMap && Array.isArray(countryMap.municipalities)) { // Si existe la lista de municipios en el mapa macro
          const targetSubId = updatedProvince.id.toLowerCase().replace(/^ar-/, ''); // Normaliza el ID a minúsculas sin prefijo
          const subIndex = countryMap.municipalities.findIndex(m => {
            const mId = m.id.toLowerCase().replace(/^ar-/, ''); // Normaliza el ID del mapa macro
            const mName = (m.name || '').toLowerCase(); // Normaliza nombre del mapa macro
            const uName = (updatedProvince.name || '').toLowerCase(); // Normaliza nombre de la provincia actualizada
            return mId === targetSubId || m.id.toLowerCase() === updatedProvince.id.toLowerCase() || (mName && uName && (mName === uName || mName.includes(uName) || uName.includes(mName)));
          }); // Busca la subdivisión en el mapa macro

          if (subIndex !== -1) { // Si la subdivisión existe dentro del mapa macro de Argentina
            const origRefD = countryMap.municipalities[subIndex].d || provincePaths.find(p => p.id === updatedProvince.id || p.id.toLowerCase() === targetSubId)?.d || ''; // Busca la geometría original de referencia
            const targetBBox = getPathBBox(origRefD); // Calcula el Bounding Box original en el mapa de Argentina
            const unifiedD = (updatedProvince.municipalities || []).map(m => (m.d || '').trim()).filter(Boolean).join(' '); // Une los trazados vectoriales en una única figura unificada

            if (unifiedD) { // Si se obtuvo una geometría válida
              let fittedD = unifiedD; // Inicializa con la geometría sin escalar
              if (targetBBox && targetBBox.width > 1 && targetBBox.height > 1) { // Si las dimensiones originales son válidas
                fittedD = fitPathToBBox(unifiedD, targetBBox); // Escala y posiciona quirúrgicamente al tamaño original en el mapa de Argentina
              }

              const updatedCountryMunicipalities = [...countryMap.municipalities]; // Clona el arreglo de municipios
              const targetSubItem = updatedCountryMunicipalities[subIndex]; // Referencia previa
              const subId = targetSubItem.id || updatedProvince.id; // ID único de la subdivisión

              updatedCountryMunicipalities[subIndex] = { // Actualiza quirúrgicamente la subdivisión seleccionada
                ...targetSubItem, // Mantiene metadatos existentes
                d: fittedD || targetSubItem.d, // Asigna la nueva silueta unificada auto-escalada
                name: updatedProvince.name || targetSubItem.name, // Mantiene o actualiza el nombre
                customData: {
                  ...(targetSubItem.customData || {}),
                  subItems: updatedProvince.municipalities // Guarda los trazados/múnicipios detallados
                }
              };
              next['COUNTRY_MAP'] = { // Actualiza la entrada COUNTRY_MAP en el diccionario en memoria
                ...countryMap, // Copia los datos previos del mapa macro
                municipalities: updatedCountryMunicipalities // Inyecta la lista con la subdivisión perfeccionada
              };

              // Sincroniza la lista de rutas calibradas en localStorage para consumo del componente InteractiveMap
              const rawCal = safeGetItem('argentina_calibrated_map_paths'); // Lee las rutas calibradas actuales
              let calList: { id: string; d: string }[] = []; // Inicializa la lista
              if (rawCal) { // Si existen datos previos
                try { calList = JSON.parse(rawCal); } catch (e) {} // Parsea los datos de forma segura
              }
              if (!Array.isArray(calList) || calList.length === 0) { // Si estaba vacía
                calList = provincePaths.map(p => ({ id: p.id, d: p.d })); // Carga la lista nativa de provincias
              }
              const calIdx = calList.findIndex(item => item.id === subId || item.id.toLowerCase() === targetSubId); // Busca el índice
              if (calIdx !== -1) { // Si existe
                calList[calIdx].d = fittedD; // Actualiza la geometría
              } else { // Si es nueva
                calList.push({ id: subId, d: fittedD }); // Inserta la nueva geometría
              }
              safeSetItem('argentina_calibrated_map_paths', JSON.stringify(calList)); // Guarda la lista calibrada
              safeSetItem('argentina_paths_last_updated', Date.now().toString()); // Marca de tiempo para forzar re-render

              safeSetItem(`argentina_advanced_canvas_map_COUNTRY_MAP`, JSON.stringify({ // Sincroniza la clave de almacenamiento del mapa de Argentina
                ...next['COUNTRY_MAP'],
                paths: updatedCountryMunicipalities.map(m => ({
                  id: m.id,
                  name: m.name,
                  d: m.d || '',
                  customData: { valor: m.value, porcentaje: m.percentage, fill: m.color, subItems: m.customData?.subItems },
                  visualStyles: { fillColor: m.color || '#10b981', strokeColor: '#0f172a', strokeWidth: 1.5 }
                }))
              }));

              window.dispatchEvent(new Event('storage')); // Dispara evento de almacenamiento local para re-renderizado
              window.dispatchEvent(new CustomEvent('mapDataUpdated', { detail: { provinceId: subId, d: fittedD } })); // Dispara evento personalizado
            }
          }
        }
      }

      return next; // Retorna el diccionario actualizado
    }); // Fin de setProvincesData
  }; // Fin de handleUpdateProvince

  // Carga masiva de la colección completa de provincias
  const handleLoadAllProvinces = (loaded: Record<string, ProvinceData>) => { // Carga masiva
    setProvincesData(loaded); // Sobrescribe el diccionario en el estado
    safeSetItem('argentina_data_custom_provinces', JSON.stringify(loaded)); // Guarda el diccionario completo de forma segura
  }; // Fin de handleLoadAllProvinces

  // Conversión de la parcela o subdivisión seleccionada al formato de entidad editable para el PropertyEditor
  const selectedSubdivision = selectedProvince.municipalities?.find(m => m.id === selectedSubdivisionId); // Busca el objeto seleccionado
  const editableTerritory: EditableTerritory | null = selectedSubdivision ? { // Transforma la subdivisión en territorio editable
    id: selectedSubdivision.id, // ID único
    name: selectedSubdivision.name, // Nombre de la división
    level: activeMapLevel === 'country' ? 'province' : activeMapLevel === 'world' ? 'country' : 'city', // Nivel jerárquico
    svgPath: selectedSubdivision.d, // Comandos vectoriales SVG
    visualStyles: { // Estilos de renderizado visual garantizados
      fillColor: selectedSubdivision.visualStyles?.fillColor || selectedSubdivision.color || '#10b981', // Color de relleno
      strokeColor: selectedSubdivision.visualStyles?.strokeColor || '#0f172a', // Color de contorno
      strokeWidth: selectedSubdivision.visualStyles?.strokeWidth ?? 1.5, // Grosor de trazo
      fontFamily: selectedSubdivision.visualStyles?.fontFamily || 'Inter', // Fuente tipográfica
      fontSize: selectedSubdivision.visualStyles?.fontSize ?? 10 // Tamaño de letra
    }, // Fin de visualStyles
    customData: selectedSubdivision.customData || { // Metadatos personalizados
      valor_activo: selectedSubdivision.value, // Valor cuantitativo
      porcentaje: selectedSubdivision.percentage // Porcentaje
    } // Fin de customData
  } : null; // Si no hay subdivisión seleccionada asigna null

  // Guardado de modificaciones de estilos visuales provenientes del componente PropertyEditor
  const handleSaveTerritoryStyles = (updated: EditableTerritory) => { // Función para guardar estilos editados
    if (!selectedSubdivisionId) return; // Si no hay subdivisión seleccionada interrumpe

    const updatedMunicipalities = (selectedProvince.municipalities || []).map(m => { // Mapea los municipios de la provincia
      if (m.id === selectedSubdivisionId) { // Si es el municipio en edición
        return { // Retorna el municipio actualizado
          ...m, // Conserva las propiedades existentes
          name: updated.name, // Sincroniza el nuevo nombre
          color: updated.visualStyles.fillColor, // Sincroniza el color plano de fondo
          visualStyles: updated.visualStyles, // Actualiza los estilos visuales completos
          customData: updated.customData, // Actualiza los metadatos personalizados
          value: updated.customData.valor_activo !== undefined ? Number(updated.customData.valor_activo) : m.value, // Sincroniza valor
          percentage: updated.customData.porcentaje !== undefined ? Number(updated.customData.porcentaje) : m.percentage // Sincroniza porcentaje
        }; // Fin del objeto retornado
      } // Fin de la condición de coincidencia
      return m; // Retorna el municipio sin cambios si no coincide
    }); // Fin del mapeo

    const updatedProvince: ProvinceData = { // Crea el objeto de provincia actualizado
      ...selectedProvince, // Hereda las propiedades de la provincia
      municipalities: updatedMunicipalities // Actualiza la lista de municipios
    }; // Fin del objeto updatedProvince

    handleUpdateProvince(updatedProvince); // Dispara la actualización global de la provincia
  }; // Fin de handleSaveTerritoryStyles

  // Cálculo de las subdivisiones disponibles en el nodo activo actual para el desplegable del Header (Filtro Público isVisible === true)
  const currentSubdivisions = useMemo(() => {
    // 1. Identifica el ID del nodo activo actual en la ruta dinámica navPath
    const activeParentId = navPath && navPath.length > 0 ? navPath[navPath.length - 1].id : 'root';

    // Obtiene conjunto de IDs de nodos explícitamente ocultos por el administrador (isVisible === false)
    const hiddenNodeIds = new Set(appTreeNodes.filter(n => n.isVisible === false).map(n => n.id));

    // 2. Busca subnodos dinámicos registrados en appTreeNodes que pertenezcan al nodo activo y sean estrictamente VISIBLES
    const visibleDynamicChildren = appTreeNodes.filter(n => {
      const isChild = n.parentId === activeParentId || (activeParentId === 'root' && (!n.parentId || n.parentId === 'root'));
      return isChild && n.isVisible !== false; // Filtro público estricto
    });

    if (visibleDynamicChildren.length > 0) { // Si existen subnodos dinámicos visibles
      return visibleDynamicChildren.map(n => ({ // Retorna la lista mapeada
        id: n.id,
        name: n.name,
        value: n.value
      }));
    }

    // 3. Fallback a datos base aplicando también el filtro público de visibilidad
    if (activeMapLevel === 'world') {
      return (defaultWorldMapData.municipalities || [])
        .filter(m => !hiddenNodeIds.has(m.id)) // Oculta si el nodo fue marcado con ojo cerrado
        .map(m => ({ id: m.id, name: m.name, value: m.value }));
    }
    if (activeMapLevel === 'continent') {
      return (defaultContinentMapData.municipalities || [])
        .filter(m => !hiddenNodeIds.has(m.id)) // Oculta si el nodo fue marcado con ojo cerrado
        .map(m => ({ id: m.id, name: m.name, value: m.value }));
    }
    if (activeMapLevel === 'country' && !selectedProvinceId) {
      // Estamos en el nodo Argentina: listamos las 24 provincias que NO estén ocultas
      return Object.values(mockProvincesData)
        .filter(p => !hiddenNodeIds.has(p.id)) // Filtro de visibilidad pública
        .map(p => ({
          id: p.id,
          name: p.name,
          value: p.socialEmployment?.pobreza
        }));
    }
    if (selectedProvince && selectedProvince.municipalities) {
      return selectedProvince.municipalities
        .filter(m => !hiddenNodeIds.has(m.id)) // Filtro de visibilidad pública
        .map(m => ({
          id: m.id,
          name: m.name,
          value: m.value
        }));
    }
    return [];
  }, [activeMapLevel, selectedProvinceId, selectedProvince, navPath, appTreeNodes]);

  // Manejador al seleccionar una subdivisión o país desde el buscador asistido del Header
  const handleHeaderSelectSubdivision = (subId: string) => {
    if (!subId) return; // Si el identificador recibido está vacío, se descarta

    // 1. SI SE SELECCIONA EL NIVEL PAÍS ARGENTINA (AR, COUNTRY_MAP)
    if (subId === 'AR' || subId === 'COUNTRY_MAP' || subId.toLowerCase() === 'argentina') {
      setActiveMapLevel('country'); // Cambia el nivel activo a País
      setSelectedProvinceId('COUNTRY_MAP'); // Asigna el nivel macro nacional
      safeSetItem('argentina_selected_province_id', 'COUNTRY_MAP'); // Persiste en el almacenamiento local
      MapsToNode({ id: 'country', name: 'República Argentina', type: 'pais' }); // Avanza la miga de pan al país
      return; // Finaliza la ejecución
    }

    // 2. SI SE SELECCIONA UNA DE LAS PROVINCIAS ARGENTINAS (EJ: AR-B, AR-N, AR-M, BUE, MIS, ETC.)
    const foundProv = mockProvincesData[subId] || provincesData[subId]; // Busca coincidencia en el catálogo de provincias
    if (foundProv) { // Si existe la provincia en el registro
      setSelectedProvinceId(foundProv.id); // Establece el ID de la provincia activa
      safeSetItem('argentina_selected_province_id', foundProv.id); // Guarda la preferencia en localStorage
      setActiveMapLevel('country'); // Mantiene el contexto de país
      MapsToNode({ id: foundProv.id, name: foundProv.name, type: 'provincia' }); // Navega directamente al nodo de la provincia
      return; // Finaliza la ejecución
    }

    // 3. SI SE SELECCIONA OTRO PAÍS O SUBDIVISIONES GENERALES DE OTROS NIVELES
    handleSelectSubdivision(subId); // Delega al manejador de selección de subdivisión
  }; // Fin de handleHeaderSelectSubdivision

  return ( // Renderiza la interfaz de usuario completa
    <div id="dashboard-app" className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      {/* Encabezado con barra de control de perfiles y roles RBAC e integración de ciclo de vida de proyectos */}
      <Header 
        isAdmin={isAdmin} // Pasa el indicador de administración
        userRole={userRole} // Pasa el rol de usuario actual
        currentUser={currentUser} // Pasa el perfil de usuario activo con sus datos personales
        onOpenProfileModal={() => setIsProfileModalOpen(true)} // Pasa la función para abrir el modal de edición de perfil
        navigationPath={navPath.length > 0 ? navPath : navigationPath} // Pasa el camino de migas de pan dinámico universal navPath
        onBreadcrumbClick={handleBreadcrumbClick} // Pasa el manejador de clic en migas de pan
        subdivisions={currentSubdivisions} // Pasa las subdivisiones activas del nodo actual
        onSelectSubdivision={handleHeaderSelectSubdivision} // Pasa el manejador de selección desde el desplegable del Header
        projectName={projectName} // Pasa el nombre del proyecto activo
        isDirty={isDirty} // Pasa el estado booleano de cambios sin guardar
        onProjectNameChange={handleProjectNameChange} // Pasa el manejador para renombrar el proyecto
        onNewProject={handleNewProject} // Pasa el manejador para crear nuevo proyecto
        onOpenProject={handleOpenProject} // Pasa el manejador para abrir proyecto JSON
        onSaveProject={handleSaveProject} // Pasa el manejador para guardar el proyecto activo
        onSaveAsProject={handleSaveAsProject} // Pasa el manejador para Guardar Como
        onCloseProject={handleCloseProject} // Pasa el manejador para cerrar el proyecto y restablecer el lienzo
        onLogin={(remember: boolean) => { // Manejador de inicio de sesión
          handleSelectRole('admin'); // Inicia sesión asignando rol de admin
        }}
        onLogout={() => { // Manejador de cierre de sesión
          handleSelectRole('guest'); // Cambia a rol de visitante al cerrar sesión
          navigate('/'); // Redirige a la vista principal
        }}
        onSelectRole={handleSelectRole} // Pasa la función para alternar roles
      />

      {/* Cuerpo principal en distribución fluida con soporte para redimensionamiento proporcional de paneles */}
      <div className={`flex-1 flex flex-col lg:flex-row overflow-hidden ${isResizingPanels ? 'select-none cursor-col-resize' : ''}`}>
        {navPath.length === 1 && location.pathname === '/' ? (
          /* Lobby Principal de Bienvenida cuando el historial de navegación está en el nivel raíz (length === 1) */
          <main className="flex-1 overflow-y-auto w-full">
            <HomeDashboard 
              userRole={userRole} 
              currentUser={currentUser} 
              onNavigateToNode={MapsToNode} 
              onSelectRole={handleSelectRole}
            />
          </main>
        ) : (
          /* Vista del Mapa Interactivo e Indicadores cuando se avanza en la navegación jerárquica */
          <>
            {/* Panel Izquierdo: Mapa SVG vectorial interactivo con ancho dinámico redimensionable */}
            <main
              className="w-full p-4 xl:p-6 overflow-y-auto border-b lg:border-b-0 border-slate-800 flex flex-col space-y-4 shrink-0 transition-all duration-75"
              style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${leftPanelWidthPercent}%` : '100%' }}
            >
              <InteractiveMap
                selectedProvince={selectedProvince} // Pasa los datos de la provincia activa
                onSelectProvince={(prov) => { // Manejador de selección de provincia
                  setSelectedProvinceId(prov.id); // Establece el ID de la provincia seleccionada
                  safeSetItem('argentina_selected_province_id', prov.id); // Guarda de forma segura en almacenamiento local
                }}
                onUpdateProvince={handleUpdateProvince} // Pasa la función de actualización de provincia
                selectedMetric={selectedMetric} // Pasa la métrica activa
                onChangeMetric={setSelectedMetric} // Pasa la función para cambiar la métrica
                activeMapLevel={activeMapLevel} // Pasa el nivel de mapa activo
                setActiveMapLevel={handleMapLevelChange} // Pasa la función para modificar el nivel
                mapLevels={mapLevels} // Pasa la lista de niveles jerárquicos disponibles
                selectedSubdivisionId={selectedSubdivisionId} // Pasa el ID de subdivisión seleccionado
                setSelectedSubdivisionId={handleSelectSubdivision} // Pasa la función para seleccionar subdivisión
                navigationPath={navigationPath} // Pasa el camino de migas de pan
                onBreadcrumbClick={handleBreadcrumbClick} // Pasa el manejador de clic en migas de pan
                navPath={navPath} // Pasa el historial de navegación dinámico universal
                goBackToNode={goBackToNode} // Pasa el manejador para retroceder en nodos dinámicos
                onNavigateToNode={MapsToNode} // Pasa la función para avanzar hacia un nuevo nodo dinámico
              />
            </main>

            {/* DIVISOR Y REDIMENSIONADOR PROPORCIONAL DE PANELES (LÍNEA ROJA CENTRAL ARRASTRABLE) */}
            <div
              onMouseDown={() => setIsResizingPanels(true)}
              onTouchStart={() => setIsResizingPanels(true)}
              className="hidden lg:flex w-3 hover:w-3.5 bg-slate-900/90 hover:bg-slate-900 border-x border-slate-800/80 cursor-col-resize items-center justify-center shrink-0 z-30 transition-all group relative select-none"
              title="Arrastrar hacia los lados para redimensionar proporcionalmente ambos paneles"
            >
              {/* Línea roja indicadora central marcada por el usuario para indicar zona de arrastre */}
              <div className={`w-1 rounded-full transition-all duration-200 ${
                isResizingPanels
                  ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.95)] h-full'
                  : 'bg-red-500/85 group-hover:bg-red-500 group-hover:shadow-[0_0_8px_rgba(239,68,68,0.8)] h-28'
              }`} />
              {/* Etiqueta flotante con icono de arrastre */}
              <div className="absolute bg-slate-950 border border-slate-700 text-slate-400 group-hover:text-red-400 p-0.5 rounded text-[8px] font-mono shadow-xl opacity-70 group-hover:opacity-100 transition-opacity">
                ↔
              </div>
            </div>

            {/* Panel Derecho: Navegación por pestañas y visualizadores con ancho adaptativo */}
            <section
              className="flex-1 p-4 xl:p-6 overflow-y-auto bg-slate-950 flex flex-col space-y-5 min-w-0"
              style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${100 - leftPanelWidthPercent}%` : '100%' }}
            >
          {/* Pestañas superiores de navegación ligadas al enrutador React Router */}
          <div className="flex flex-wrap border-b border-slate-800 gap-1 pb-1">
            <button
              onClick={() => navigate('/')} // Navega a la ruta pública raíz
              className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
                location.pathname === '/' // Evalúa si la ruta actual es la raíz
                  ? 'border-emerald-500 text-emerald-400 font-black' // Estilo activo
                  : 'border-transparent text-slate-500 hover:text-slate-300' // Estilo inactivo
              }`}
            >
              📈 Estadísticas Publicas
            </button>

            {/* Pestaña para usuarios Pro o Admin: Editor Vectorial */}
            {(userRole === 'pro' || userRole === 'admin') && ( // Comprueba si el rol es PRO o ADMIN
              <button
                onClick={() => navigate('/editor')} // Navega al editor vectorial de pago
                className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 flex items-center space-x-1 ${
                  location.pathname === '/editor' // Evalúa si estamos en la ruta de editor
                    ? 'border-amber-500 text-amber-400 font-black' // Estilo activo
                    : 'border-transparent text-amber-500/70 hover:text-amber-300' // Estilo inactivo
                }`}
              >
                <span>🎨 Editor Vectorial</span> {/* Etiqueta del botón */}
                <span className="text-[8px] bg-amber-950 text-amber-400 font-black px-1 rounded">PRO</span> {/* Insignia PRO */}
              </button>
            )}
            
            {/* Pestañas administrativas exclusivas para usuarios con rol de administración */}
            {isAdmin && ( // Verifica si es administrador
              <>
                <button
                  onClick={() => navigate('/admin/usuarios')} // Navega a la gestión de usuarios y perfiles
                  className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 flex items-center space-x-1 ${
                    location.pathname === '/admin/usuarios' // Evalúa la ruta activa de usuarios
                      ? 'border-emerald-500 text-emerald-400 font-black' // Estilo activo
                      : 'border-transparent text-slate-500 hover:text-slate-300' // Estilo inactivo
                  }`}
                >
                  <span>👥 Gestión de Usuarios</span> {/* Etiqueta de la pestaña de usuarios */}
                </button>
                <button
                  onClick={() => navigate('/admin/jerarquia')} // Navega al organizador del árbol jerárquico Drag and Drop
                  className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 flex items-center space-x-1 ${
                    location.pathname === '/admin/jerarquia' // Evalúa si la ruta activa es jerarquía
                      ? 'border-emerald-500 text-emerald-400 font-black' // Estilo activo
                      : 'border-transparent text-slate-500 hover:text-slate-300' // Estilo inactivo
                  }`}
                >
                  <span>🌳 Árbol Jerárquico</span> {/* Etiqueta del organizador jerárquico */}
                </button>
                <button
                  onClick={() => navigate('/admin')} // Navega a la gestión de workspace
                  className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
                    location.pathname === '/admin' // Evalúa la ruta actual
                      ? 'border-emerald-500 text-emerald-400 font-black' // Estilo activo
                      : 'border-transparent text-slate-500 hover:text-slate-300' // Estilo inactivo
                  }`}
                >
                  💼 Workspace Admin
                </button>
                <button
                  onClick={() => navigate('/admin/calibracion')} // Navega al calibrador de nodos SVG
                  className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
                    location.pathname === '/admin/calibracion' // Evalúa la ruta de calibración
                      ? 'border-emerald-500 text-emerald-400 font-black' // Estilo activo
                      : 'border-transparent text-slate-500 hover:text-slate-300' // Estilo inactivo
                  }`}
                >
                  🛠️ Calibrador SVG
                </button>
                <button
                  onClick={() => navigate('/admin/editor')} // Navega al súper editor de administración
                  className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 flex items-center space-x-1 ${
                    location.pathname === '/admin/editor' // Evalúa la ruta del súper editor
                      ? 'border-sky-500 text-sky-400 font-black' // Estilo activo
                      : 'border-transparent text-sky-500/70 hover:text-sky-300' // Estilo inactivo
                  }`}
                >
                  <span>👑 Súper Editor</span> {/* Etiqueta del súper editor */}
                </button>
              </>
            )}
          </div>

          {/* Configuración del Enrutamiento con React Router y Protección RBAC */}
          <Routes>
            {/* Ruta Principal Pública: Panel Estadístico y Métricas */}
            <Route path="/" element={ // Define la ruta raíz
              <div className="space-y-6"> {/* Contenedor con espaciado vertical */}
                <DataPanel 
                  province={selectedProvince} // Pasa los datos de la provincia activa
                  selectedSubdivisionId={selectedSubdivisionId} // Pasa la subdivisión seleccionada
                  onSelectSubdivision={handleSelectSubdivision} // Pasa el manejador de selección
                  navigationPath={navigationPath} // Pasa las migas de pan
                  onBreadcrumbClick={handleBreadcrumbClick} // Pasa el manejador de clics en migas
                  navPath={navPath} // Pasa el historial de navegación dinámico universal
                  goBackToNode={goBackToNode} // Pasa la función para retroceder en las migas dinámicas
                />
                
                {/* Muestra el centro de gestión de datos WorkspaceHub si el usuario es administrador */}
                {isAdmin && ( // Evaluación de administración
                  <div className="border-t border-slate-900 pt-6"> {/* Contenedor con borde superior */}
                    <WorkspaceHub
                      selectedProvince={selectedProvince} // Pasa la provincia activa
                      onUpdateProvince={handleUpdateProvince} // Pasa la función de actualización
                      allProvinces={provincesData} // Pasa la colección completa de provincias
                      onLoadAllProvinces={handleLoadAllProvinces} // Pasa la función de carga masiva
                    />
                  </div>
                )}
              </div>
            } />

            {/* Ruta Protegida: Súper Editor de Espacios Vectoriales para Usuario de Pago (PRO) */}
            <Route path="/editor" element={ // Ruta para usuarios PRO
              <ProtectedRoute userRole={userRole} allowedRoles={['PRO', 'ADMIN', 'SUPER_ADMIN']}> {/* Envoltura de seguridad RBAC */}
                <div className="space-y-6"> {/* Contenedor */}
                  <AdvancedCanvasEditor 
                    currentUser={currentUser} // Pasa el perfil de usuario activo
                    selectedProvince={selectedProvince} // Pasa la provincia seleccionada
                    onUpdateProvince={handleUpdateProvince} // Pasa la función de actualización
                    allProvinces={provincesData} // Pasa la colección de provincias
                    selectedSubdivisionId={selectedSubdivisionId} // Pasa el ID de la subdivisión activa
                    onSelectSubdivision={handleSelectSubdivision} // Pasa el manejador para sincronización bidireccional
                    navPath={navPath} // Pasa el historial de navegación dinámico
                    onSaveMapEntity={(entity) => { // Manejador de guardado de mapa
                      console.log("Mapa guardado exitosamente por Usuario Pro:", entity); // Notifica el guardado
                    }}
                  />
                </div>
              </ProtectedRoute>
            } />

            {/* Ruta Protegida: Organizador y Árbol Jerárquico Drag and Drop */}
            <Route path="/admin/jerarquia" element={ // Ruta del árbol jerárquico
              <ProtectedRoute userRole={userRole} allowedRoles={['ADMIN', 'SUPER_ADMIN']}> {/* Envoltura de seguridad RBAC */}
                <div className="space-y-6"> {/* Contenedor */}
                  <AdminHierarchyTreeEditor 
                    treeNodes={appTreeNodes} // Pasa la lista de todos los nodos del árbol dinámico recuperados de la base de datos
                    onUpdateTreeNodes={(newNodes) => setAppTreeNodes(newNodes)} // Sincroniza las mutaciones de nodos con el estado global de App
                    allProvinces={provincesData} // Pasa el mapa completo de provincias
                    onUpdateProvince={handleUpdateProvince} // Pasa la función de actualización de datos
                    onLoadAllProvinces={handleLoadAllProvinces} // Pasa la función de carga masiva
                    onNavigateToNode={MapsToNode} // Pasa el enrutador para viajar rápido al mapa
                  />
                </div>
              </ProtectedRoute>
            } />

            {/* Ruta Protegida: Workspace de Administración + Inspector de Propiedades */}
            <Route path="/admin" element={ // Ruta de administración principal
              <ProtectedRoute userRole={userRole} allowedRoles={['ADMIN', 'SUPER_ADMIN']}> {/* Envoltura para ADMIN y SUPER_ADMIN */}
                <div className="space-y-6"> {/* Contenedor */}
                  {editableTerritory && ( // Muestra el PropertyEditor si existe una entidad seleccionada
                    <PropertyEditor 
                      territory={editableTerritory} // Pasa los datos de la entidad seleccionada
                      onSave={handleSaveTerritoryStyles} // Pasa la función de guardado de estilos
                      onClose={() => handleSelectSubdivision(null)} // Pasa la función para deseleccionar
                    />
                  )}
                  
                  <div className="bg-slate-900/40 p-4 border border-slate-800 rounded-xl"> {/* Tarjeta explicativa */}
                    <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span>Workspace Administrativo</span>
                    </h2>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Selecciona cualquier polígono o subdivisión territorial sobre el mapa para abrir el **Inspector Visual estilo Figma**. Permite ajustar rellenos, bordes, tipografías y metadatos en tiempo real.
                    </p>
                  </div>

                  <WorkspaceHub
                    selectedProvince={selectedProvince} // Pasa la provincia activa
                    onUpdateProvince={handleUpdateProvince} // Pasa la función de actualización
                    allProvinces={provincesData} // Pasa la colección completa de provincias
                    onLoadAllProvinces={handleLoadAllProvinces} // Pasa la función de carga masiva
                  />
                </div>
              </ProtectedRoute>
            } />

            {/* Ruta Protegida: Calibración y Ajuste de Nodos SVG */}
            <Route path="/admin/calibracion" element={ // Ruta de calibración
              <ProtectedRoute userRole={userRole} allowedRoles={['ADMIN', 'SUPER_ADMIN']}> {/* Envoltura de protección */}
                <div className="space-y-6"> {/* Contenedor */}
                  {editableTerritory && ( // Muestra el inspector visual si hay elemento seleccionado
                    <PropertyEditor 
                      territory={editableTerritory} // Pasa la entidad territorial
                      onSave={handleSaveTerritoryStyles} // Pasa la función para guardar estilos
                      onClose={() => handleSelectSubdivision(null)} // Pasa la función de cierre
                    />
                  )}
                  
                  <MapCalibrationPanel 
                    selectedProvinceId={activeProvinceId} // Pasa el ID activo
                    onSelectProvinceId={(id) => { // Manejador de selección de provincia o nivel
                      if (id === 'WORLD_MAP') { // Si es mapa mundial
                        handleMapLevelChange('world'); // Cambia a mundo
                      } else if (id === 'CONTINENT_MAP') { // Si es mapa continental
                        handleMapLevelChange('continent'); // Cambia a continente
                      } else { // Si es una provincia argentina
                        setSelectedProvinceId(id); // Establece el ID de la provincia
                        safeSetItem('argentina_selected_province_id', id); // Guarda en almacenamiento seguro
                      } // Fin del condicional
                    }}
                    selectedProvince={selectedProvince} // Pasa los datos de la provincia
                    onUpdateProvince={handleUpdateProvince} // Pasa la función para actualizar
                    mapLevels={mapLevels} // Pasa la lista de niveles
                    onUpdateMapLevels={handleUpdateMapLevels} // Pasa el manejador de actualización de niveles
                    navPath={navPath} // Pasa el historial de navegación dinámico universal
                    selectedSubdivisionId={selectedSubdivisionId} // Pasa el ID de la subdivisión o polígono activo
                    onSelectSubdivision={handleSelectSubdivision} // Pasa el manejador para sincronizar la selección
                  />
                </div>
              </ProtectedRoute>
            } />

            {/* Ruta Protegida: Gestión de Usuarios y Perfiles Personales para Super Admin */}
            <Route path="/admin/usuarios" element={ // Ruta de gestión de usuarios
              <ProtectedRoute userRole={userRole} allowedRoles={['ADMIN', 'SUPER_ADMIN']}> {/* Envoltura de seguridad RBAC */}
                <AdminUserManagement 
                  allProfiles={userProfiles} // Pasa el diccionario con todos los usuarios
                  onSaveProfile={handleSaveProfile} // Pasa el manejador de guardado
                  onResetProfiles={handleResetProfiles} // Pasa la función de restablecimiento
                  currentUser={currentUser} // Pasa el usuario activo
                />
              </ProtectedRoute>
            } />

            {/* Ruta Protegida: Súper Editor para Super Admin con Permisos Totales */}
            <Route path="/admin/editor" element={ // Ruta del súper editor
              <ProtectedRoute userRole={userRole} allowedRoles={['ADMIN', 'SUPER_ADMIN']}> {/* Envoltura RBAC */}
                <div className="space-y-6"> {/* Contenedor */}
                  <AdvancedCanvasEditor 
                    currentUser={currentUser} // Pasa el perfil activo del usuario
                    selectedProvince={selectedProvince} // Pasa la provincia seleccionada
                    onUpdateProvince={handleUpdateProvince} // Pasa la función de actualización
                    allProvinces={provincesData} // Pasa todas las provincias
                    selectedSubdivisionId={selectedSubdivisionId} // Pasa el ID de la subdivisión activa
                    onSelectSubdivision={handleSelectSubdivision} // Pasa el manejador para sincronizar selección
                    navPath={navPath} // Pasa el historial de navegación dinámico
                    onSaveMapEntity={(entity) => { // Manejador de guardado
                      console.log("Mapa guardado por Super Admin:", entity); // Notifica el guardado
                    }}
                  />
                </div>
              </ProtectedRoute>
            } />

            {/* Ruta Abierta/Protegida: Guía de Ayuda, Convenciones y Tutorial de Uso */}
            <Route path="/admin/ayuda" element={ // Ruta pública y administrativa para la guía de uso
              <AdminHelpGuide /> // Renderiza el componente de tutorial paso a paso con maquetas y flechas
            } />

            {/* Redirección por defecto a la ruta raíz pública para cualquier URL no encontrada */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </section>
          </>
        )}

        {/* Barra lateral de herramientas de acceso rápido */}
        <Sidebar />
      </div>

      {/* Pie de página con información del sistema */}
      <footer className="bg-slate-950 border-t border-slate-900 py-3.5 px-6 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest">
        <span>© 2026 Plataforma de Indicadores Federales - Catastro Jerárquico</span>
        <div className="flex items-center space-x-4 mt-1 sm:mt-0">
          <span>Actualización: Tiempo Real (UTC)</span>
          <span className="flex items-center">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
            Sistemas Conectados
          </span>
        </div>
      </footer>

      {/* Modal global flotante para edición del perfil personal del usuario activo */}
      <UserProfileModal 
        isOpen={isProfileModalOpen} // Estado de visibilidad del modal
        onClose={() => setIsProfileModalOpen(false)} // Disparador para cerrar el modal
        profile={currentUser} // Pasa los datos del perfil activo
        isSelfEdit={true} // Indica que es auto-edición
        onSave={(updated) => { // Manejador de guardado
          handleSaveProfile(updated); // Persiste los cambios del perfil
          setIsProfileModalOpen(false); // Cierra el modal
        }} // Fin de onSave
      />
    </div>
  ); // Fin del retorno JSX de AppContent
} // Fin del componente AppContent

