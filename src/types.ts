/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Tipo TypeScript para definir los niveles de métricas socioeconómicas activas en los gráficos
export type MetricType = 'pobreza' | 'desempleo' | 'gini' | 'conectividad';

// Interfaz para la distribución por sectores económicos
export interface SectorDistribution {
  name: string; // Nombre del sector económico (ej. 'Servicios', 'Industria')
  value: number; // Porcentaje de participación en la economía
  color: string; // Color hexadecimal asociado para renderizar gráficos
}

// Interfaz básica para datos de gráficos de barras
export interface BarChartData {
  label: string; // Etiqueta descriptiva de la barra
  value: number; // Valor numérico representado
}

// Interfaz para las subdivisiones territoriales, municipios o capas vectoriales
export interface MunicipalityData {
  id: string; // Identificador único de la subdivisión (ej. 'AR-B-01')
  name: string; // Nombre de la subdivisión territorial o municipio (ej. 'La Matanza')
  value: number; // Valor asociado a la métrica actualmente activa en el visor
  percentage: number; // Porcentaje de representación de esta subdivisión a nivel provincial
  d?: string;    // Ruta SVG personalizada para renderizar la forma geométrica (polígono) del territorio
  paused?: boolean; // Estado booleano para indicar si la subdivisión está inactiva o en pausa
  color?: string;   // Color personalizado pintado directamente desde la paleta interactiva de la aplicación
  layer?: string;   // Identificador o nombre de la capa a la que pertenece la entidad (ej: 'Ríos', 'Lagos', 'Países')
  visualStyles?: { // Objeto opcional para estilos de diseño avanzados
    fillColor?: string; // Color hexadecimal de relleno del polígono
    strokeColor?: string; // Color hexadecimal del contorno o límite geográfico
    strokeWidth?: number; // Grosor del contorno físico en píxeles
    fontFamily?: string; // Fuente de texto asignada para etiquetas informativas
    fontSize?: number; // Tamaño físico del texto en píxeles
  }; // Fin de la declaración de estilos visuales
  customData?: Record<string, any>; // Estructura JSON flexible para almacenar metadatos catastrales e indicadores ilimitados
}

// Interfaz para las provincias o entidades territoriales de nivel superior
export interface ProvinceData {
  id: string; // Código ISO de la provincia (ej. "AR-B", "AR-X")
  name: string; // Nombre oficial de la provincia
  abbreviation: string; // Abreviatura amigable de la provincia
  economicProfile: { // Indicadores del perfil económico provincial
    gini: number; // Coeficiente de Gini
    pib: string; // Producto Interno Bruto expresado en texto
    averageSalary: string; // Salario promedio estimado
    sectors: SectorDistribution[]; // Lista de distribución de sectores económicos
  };
  socialEmployment: { // Indicadores de empleo y desarrollo social
    pobreza: number; // Porcentaje de pobreza
    desempleo: number; // Porcentaje de desempleo
    informalEmployment: number; // Porcentaje de empleo informal
    youthInformality: number; // Porcentaje de informalidad juvenil
  };
  incomeStructure: { // Estructura de ingresos y brecha de género
    minimumSalary: BarChartData[]; // Comparativa de salarios mínimos
    genderGap: BarChartData[]; // Brecha salarial por género
  };
  connectivity: { // Indicadores de acceso a conectividad e internet
    internetAccess: BarChartData[]; // Accesos a internet fijo y móvil
    mobileLines: BarChartData[]; // Penetración de redes 4G/5G
  };
  budgetSpending: { // Distribución del presupuesto y gasto público
    socialSpending: SectorDistribution[]; // Gasto social por rubros
    educationInvestment: BarChartData[]; // Inversión en educación como % del presupuesto
  };
  mobilityServices: { // Indicadores de movilidad y servicios públicos
    roadNetwork: string; // Descripción de la red vial
    waterAccess: number; // Cobertura de agua potable
    publicTransportLines: number; // Cantidad de líneas de transporte público
  };
  municipalities: MunicipalityData[]; // Lista de municipios o departamentos que componen la provincia
  d?: string; // Trazado o silueta SVG opcional de la provincia o entidad macro
  mapTransform?: { scale: number; panX: number; panY: number }; // Transformación de escala y traslación calibrada
}

// Interfaz para representar la jerarquía territorial o conceptual de navegación
export interface RegionNode {
  level: 'mundo' | 'continente' | 'pais' | 'provincia' | 'ciudad' | 'barrio' | 'manzana' | 'calle' | string; // Nivel jerárquico
  id: string; // Identificador único del nodo en la jerarquía (ej: 'AR', 'BUE', 'COMUNA-1')
  name: string; // Nombre descriptivo del nodo (ej: 'Argentina', 'Buenos Aires')
}

// Interfaz para representar un nodo en la Navegación Dinámica en Árbol y el Tree Builder
export interface TreeNode {
  id: string; // Identificador único del nodo en la jerarquía (ej: 'root', 'world', 'americas', 'ARGENTINA', 'AR-B')
  name: string; // Nombre descriptivo del nodo (ej: 'Mundo', 'América del Sur', 'Argentina', 'Buenos Aires')
  parentId: string | null; // ID del nodo padre directo (null para nodos raíz universales como 'root' o 'world')
  isVisible: boolean; // Estado de visibilidad (Pilar A: Control de Mostrar/Ocultar para usuarios y vistas públicas)
  type?: 'root' | 'world' | 'continent' | 'country' | 'provincia' | 'city' | 'subdivision' | 'custom' | string; // Categoría o nivel jerárquico
  svgPath?: string; // Trazado SVG vectorial opcional asignado a este nodo
  value?: number; // Valor cuantitativo o métrica asociada para renderizado en listas e índices
  ownerId?: string; // ID del propietario o creador ('system' o ID de usuario Pro/Admin para SaaS Pilar B)
  children?: TreeNode[]; // Estructura opcional de hijos anidados para representación recursiva en árbol
  customData?: Record<string, any>; // Estructura de metadatos o indicadores catastrales extendidos
}

// Interfaz para el nodo de navegación en rutas dinámicas universales (Motor Universal de Visualización Vectorial)
export interface NavNode {
  id: string; // Identificador único del nodo en el árbol jerárquico (ej: 'root', 'cuerpo_humano', 'sistema_nervioso')
  name: string; // Nombre descriptivo del nodo (ej: 'Inicio', 'Cuerpo Humano', 'Sistema Nervioso', 'Argentina')
  type?: string; // Categoria o tipo opcional del nodo (ej: 'root', 'mundo', 'sistema', 'organo', 'pais', etc.)
  isVisible?: boolean; // Estado opcional de visibilidad del nodo
  parentId?: string | null; // ID del nodo padre opcional
}

// ============================================================================
// MÓDULO RBAC Y SÚPER CANVAS EDITOR (NUEVAS INTERFACES EXTENDIDAS)
// ============================================================================

// Nivel de acceso del usuario según el sistema de permisos RBAC
export type UserRole = 'guest' | 'pro' | 'admin'; // 1. Visitante público, 2. Usuario de Pago Pro, 3. Super Admin

// Perfil de usuario para el control de acceso, propiedad de mapas y datos personales
export interface UserProfile {
  id: string; // ID único del usuario en el sistema
  name: string; // Nombre amigable o primer nombre del usuario
  lastName?: string; // Apellido del usuario
  email: string; // Correo electrónico del usuario
  role: UserRole; // Rol asignado al usuario (guest, pro, admin)
  position?: string; // Cargo, puesto o función profesional del usuario (ej: 'Super Admin Catastro')
  organization?: string; // Organización, ministerio o repartición a la que pertenece
  phone?: string; // Número de teléfono de contacto
  avatarUrl?: string; // URL opcional de la foto o imagen de perfil
  bio?: string; // Biografía, descripción o notas personales del usuario
  ownedMapIds?: string[]; // Lista de IDs de mapas de los cuales este usuario es propietario (ownerId)
}

// Elemento o trazo vectorial dentro del Súper Canvas Editor
export interface VectorPathItem {
  id: string; // ID único del vector (ej: 'BR-SP', 'BRA')
  name: string; // Nombre amigable asignado al polígono (ej: 'São Paulo', 'Brasil')
  d: string; // Cadena de coordenadas geométricas SVG (path d)
  category?: string; // Nivel o tipo de territorio ('pais', 'provincia', 'municipio', 'cuerpo_humano', etc.)
  ownerId?: string; // ID del creador/propietario ('system' para mapas globales, o ID del usuario Pro)
  parentId?: string; // ID del nodo o territorio padre ('WORLD', 'BRA', etc.)
  groupId?: string; // ID del grupo al que pertenece este trazo si está agrupado
  groupName?: string; // Nombre amigable del grupo al que pertenece
  isGroup?: boolean; // Indica si esta entidad representa un contenedor de grupo
  isCombined?: boolean; // Indica si esta entidad es el resultado de combinar/unir múltiples geometrías
  referenceMapId?: string; // Mapa de referencia padre para la auto-acomodación
  isApproved?: boolean; // Indica si el Super Admin ha aprobado este mapa para publicación global
  fill?: string; // Color de relleno directo
  stroke?: string; // Color de contorno directo
  strokeWidth?: number; // Grosor de contorno directo
  visualStyles?: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  };
  transform?: { scale: number; translateX: number; translateY: number }; // Transformaciones individuales del trazo
  customData?: Record<string, any>; // Metadatos libres adicionales adjuntos al polígono
}

// Entidad de Mapa Vectorial Completo para la jerarquía infinita multidimensional
export interface VectorMapEntity {
  id: string; // ID único de la entidad de mapa (ej: 'map-brasil-provincias')
  title: string; // Título descriptivo del mapa (ej: 'Provincias de Brasil')
  level: string; // Nivel jerárquico ('mundo', 'continente', 'pais', 'provincia', 'municipio', 'sistema', etc.)
  parentId?: string; // ID del mapa o entidad padre para la estructura jerárquica
  referencePathId?: string; // ID del trazado vectorial de referencia en el nivel superior (ej: 'BRA' dentro de 'WORLD')
  ownerId: string; // ID del creador/propietario del mapa ('system' o ID de usuario Pro)
  isApproved: boolean; // Indica si el mapa ha sido validado y aprobado por el Super Admin
  paths: VectorPathItem[]; // Arreglo de trazados vectoriales SVG contenidos en el mapa
  transform: { // Transformación espacial global aplicada a este mapa
    scale: number; // Factor de escala general
    translateX: number; // Traslación en el eje X
    translateY: number; // Traslación en el eje Y
    aspectRatioLocked?: boolean; // Estado del candado de proporción de escala 🔒
  };
  createdAt?: string; // Marca de tiempo ISO de creación del mapa
  updatedAt?: string; // Marca de tiempo ISO de última edición del mapa
}

// ============================================================================
// MÓDULO DE CONFIGURACIÓN DINÁMICA DE PALETAS Y DASHBOARD BUILDER (MODO COROPLETA / CARTOGRÁFICO)
// ============================================================================

// Tipo de modo de visualización de colores en el mapa vectorial
export type MapVisualizationMode = 'cartographic' | 'choropleth' | 'custom'; // 1. Estilo institucional base, 2. Escala de calor estadística por datos, 3. Colores manuales elegidos por pieza

// Interfaz para la configuración de la paleta de colores del mapa vectorial
export interface PaletteConfig {
  mode: MapVisualizationMode; // Modo de color activo ('cartographic', 'choropleth', 'custom')
  baseColor: string; // Color base para territorios sin datos o en modo institucional (ej: '#0f1a30')
  minColor: string; // Color hexadecimal asignado al valor mínimo en la escala coropleta (ej: '#064e3b' o '#e0f2fe')
  maxColor: string; // Color hexadecimal asignado al valor máximo en la escala coropleta (ej: '#10b981' o '#f43f5e')
  selectedColor: string; // Color destacado al hacer clic sobre una pieza/territorio (ej: '#10b981')
  hoverColor: string; // Color translúcido de resaltado al pasar el puntero sobre una pieza (ej: '#34d399')
  strokeColor: string; // Color del contorno geográfico por defecto (ej: '#334155')
  strokeWidth: number; // Grosor por defecto del contorno en píxeles (ej: 1.2)
}

// Interfaz para definir la configuración individual de un elemento de gráfico en el Dashboard Builder
export interface DashboardConfigItem {
  id: string; // Identificador único de la métrica o módulo visual (ej: 'kpi-poblacion', 'bar-pobreza')
  dataKey: string; // Clave de la propiedad en customData/stats (ej: 'poblacion', 'pobreza', 'desempleo', 'gini')
  label: string; // Etiqueta descriptiva y legible para el usuario (ej: 'Tasa de Pobreza (%)', 'Habitantes Total')
  chartType: 'kpi' | 'bar' | 'pie' | 'line' | 'area'; // Tipo de componente gráfico a renderizar
  color?: string; // Color primario personalizado para este módulo gráfico (ej: '#10b981')
}

// Interfaz contenedora completa para la configuración global del Dashboard del Administrador
export interface DashboardConfig {
  activeDataKey: string; // Clave de datos actualmente activa para colorear el mapa coropleta (ej: 'pobreza')
  palette: PaletteConfig; // Configuración de colores del mapa
  items: DashboardConfigItem[]; // Lista ordenada de módulos/gráficos configurados por el Administrador
}

// Interfaz para representar un nodo o polígono dentro de un mapa vectorial (ej: Países del mundo, provincias, municipios)
export interface MapPathNode {
  id: string; // Código ISO Alpha-3 en mayúsculas (ej. "ARG", "BRA", "USA", "ESP")
  name: string; // Nombre oficial del país o entidad territorial en Español
  d: string; // Trazado SVG o cadena de coordenadas geométricas (placeholder "" o path SVG)
  parentId?: string | null; // Identificador del nivel superior ("MUNDO" o código de continente)
  category?: string; // Categoría jerárquica ("País", "Continente", "Provincia", "Municipio")
  stats?: Record<string, any>; // Estadísticas o indicadores opcionales
  customData?: Record<string, any>; // Metadatos adicionales libres
}

// ============================================================================
// EXPLORADOR UNIVERSAL DE ARCHIVOS Y PROYECTOS (ESTILO GOOGLE DRIVE DARK MODE)
// ============================================================================

export type UniversalFileType = 'folder' | 'file' | 'image' | 'pdf' | 'json' | 'map' | 'spreadsheet';
export type UniversalFileSource = 'drive' | 'local' | 'db';

export interface UniversalFileItem {
  id: string;
  name: string;
  type: UniversalFileType;
  source: UniversalFileSource;
  size?: number | string;
  updatedAt?: string;
  thumbnailUrl?: string;
  svgThumbnailPreview?: string;
  description?: string;
  webViewLink?: string;
  originalPayload?: any;
  isCurrentActive?: boolean;
  subdivisionCount?: number;
}

export interface BreadcrumbPathItem {
  id: string;
  name: string;
  icon?: any;
}




