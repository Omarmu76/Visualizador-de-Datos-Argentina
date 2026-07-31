import React, { useState, ChangeEvent, useEffect, useMemo } from 'react'; // Importación de React y hooks de estado, efectos y memorización
import { 
  Upload, // Icono para la acción de cargar archivos
  Download, // Icono para la descarga y exportación de JSON
  Save, // Icono para guardar datos dentro de la aplicación
  Trash2, // Icono para eliminar metadatos o propiedades
  Layers, // Icono para indicar las capas territoriales
  Search, // Icono para la barra de búsqueda en listas
  CheckCircle2, // Icono para confirmaciones y notificaciones tipo toast
  MapPin, // Icono para marcadores de mapa y territorio
  Maximize2 // Icono para la acción de auto-ajuste y centrado del mapa
} from 'lucide-react'; // Biblioteca lucide-react para la interfaz de usuario
import { ProvinceData, NavNode } from '../types'; // Importa la interfaz con el modelo de datos de provincias y nodos universales
import { getMultiplePathsBBox } from '../lib/mapUtils'; // Helper que calcula la caja de límites (Bounding Box) de trazados vectoriales
import { safeSetItem } from '../lib/storage'; // Importa el Helper de almacenamiento local seguro

// Estructura estandarizada actualizada para soportar capas y estilos visuales
export interface SVGPathData {
  id: string; // Identificador único del elemento vectorial
  name: string; // Nombre descriptivo del trazo o territorio
  d: string; // Cadena de coordenadas y comandos geométricos SVG (path d)
  fill?: string; // Color de relleno personalizado
  stroke?: string; // Color de línea o borde divisorio
  strokeWidth?: number; // Grosor del contorno físico
  layerId?: string; // Nombre o identificador de la capa a la que pertenece (ej: "Ríos", "Mundo")
  properties?: Record<string, any>; // Diccionario libre de propiedades e indicadores
}

// Propiedades recibidas por el componente MapCalibrationPanel
interface MapCalibrationPanelProps {
  selectedProvinceId?: string; // Identificador opcional de la provincia activa
  onSelectProvinceId?: (id: string) => void; // Callback para seleccionar una provincia
  selectedProvince?: ProvinceData; // Datos de la provincia seleccionada actualmente
  onUpdateProvince?: (province: ProvinceData) => void; // Callback para actualizar el estado global de la provincia
  mapLevels?: { id: string; name: string }[]; // Niveles jerárquicos de mapas configurados
  onUpdateMapLevels?: (levels: { id: string; name: string }[]) => void; // Callback para modificar los niveles de mapas
  navPath?: NavNode[]; // Arreglo del historial de navegación dinámico universal (Motor Vectorial)
}

// FUNCIÓN SANITIZADORA PARA CONVERTIR EXPORTACIONES JS/TS O TEXTO CON COMENTARIOS A JSON PURO
const sanitizeJsonString = (rawContent: string): string => {
  if (!rawContent) return ''; // Retorna cadena vacía si no hay contenido
  let cleaned = rawContent.trim(); // Elimina espacios iniciales y finales

  // 1. Elimina comentarios multilinea /* ... */ y de una sola linea // ...
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ''); // Remueve bloques /* */
  cleaned = cleaned.replace(/\/\/.*/g, ''); // Remueve líneas //

  // 2. Remueve asignaciones iniciales de JS (ej: const data =, let data =, var data =, export default)
  cleaned = cleaned.replace(/^(?:export\s+default\s+|const\s+[\w$]+\s*=\s*|var\s+[\w$]+\s*=\s*|let\s+[\w$]+\s*=\s*|module\.exports\s*=\s*)/i, '');

  // 3. Remueve punto y coma final e instrucciones export default finales
  cleaned = cleaned.replace(/(?:;\s*export\s+default\s+[\w$]+;?|;\s*module\.exports\s*=\s*[\w$]+;?|;?\s*)$/i, '');

  cleaned = cleaned.trim(); // Limpia espacios sobrantes

  // 4. Extrae la estructura JSON principal desde el primer { o [ hasta el último } o ]
  const firstBrace = cleaned.search(/[\{\[]/); // Busca el primer { o [
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']')); // Busca el último } o ]

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) { // Si halló delimitadores válidos
    cleaned = cleaned.substring(firstBrace, lastBrace + 1); // Extrae la porción JSON pura
  }

  return cleaned; // Retorna la cadena limpia lista para JSON.parse
};

// Componente principal para el calibrador geográfico integrador
export default function MapCalibrationPanel({
  selectedProvinceId, // ID de provincia recibido
  onSelectProvinceId, // Callback de cambio de provincia recibido
  selectedProvince, // Objeto provincia recibido
  onUpdateProvince, // Callback de actualización recibido
  navPath, // Historial de navegación dinámico universal para identificar el parentId
}: MapCalibrationPanelProps) { // Firma de componente funcional React
  const [paths, setPaths] = useState<SVGPathData[]>([]); // Estado con la lista de trazados vectoriales en lienzo
  const [selectedId, setSelectedId] = useState<string | null>(null); // Estado para rastrear el elemento vectorial seleccionado
  const [hoveredId, setHoveredId] = useState<string | null>(null); // Estado para rastrear el elemento sobre el que flota el puntero

  // Determinación del nodo padre activo desde el historial de navegación universal navPath
  const activeParentNode = useMemo(() => { // Memoriza el nodo activo
    if (navPath && navPath.length > 0) { // Si existe el arreglo navPath con elementos
      return navPath[navPath.length - 1]; // Retorna el último nodo en el historial de ruta (Padre activo)
    } // Fin del condicional navPath
    return { id: selectedProvinceId || selectedProvince?.id || 'root', name: selectedProvince?.name || 'Inicio' }; // Fallback a provincia o inicio
  }, [navPath, selectedProvinceId, selectedProvince]); // Dependencias del memorizador

  const activeParentId = activeParentNode.id; // Identificador string del nodo padre activo

  // Función asíncrona para simular la inserción CRUD de nodos vectoriales en la base de datos (tabla geoNodes)
  const saveNodesToDatabase = async (nodes: any[]) => { // Función de simulación de guardado en BD
    try { // Inicio del bloque try para captura de excepciones
      console.log("Guardando en BD (geoNodes):", nodes); // Imprime el payload completo preparado para la tabla geoNodes
      
      // Persistencia en almacenamiento local seguro para preservar los nodos sin pérdida de datos
      safeSetItem('geo_nodes_database', JSON.stringify(nodes)); // Guarda la cadena JSON en localStorage
      
      // Notificación flotante del estado de guardado
      showNotify(`[✓] ${nodes.length} nodos guardados en BD bajo el padre "${activeParentNode.name}" (${activeParentId})`); // Muestra toast
      
      // Alerta informativa solicitada
      alert(`¡Guardado con éxito!\n\nSe han preparado y guardado ${nodes.length} nodos vectoriales para la tabla geoNodes.\n\nNodo Padre (parentId): "${activeParentNode.name}" (ID: ${activeParentId})`); // Muestra alerta modal
    } catch (error) { // Captura de errores
      console.error("Error al guardar nodos en la base de datos:", error); // Imprime error en consola
      alert("Ocurrió un error al intentar guardar los nodos en la base de datos."); // Muestra alerta de error
    } // Fin de try-catch
  }; // Fin de saveNodesToDatabase

  // Controles de calibración y traslación en tiempo real
  const [scale, setScale] = useState<number>(1); // Estado para la escala global del mapa (zoom)
  const [translateX, setTranslateX] = useState<number>(0); // Estado para el desplazamiento horizontal X
  const [translateY, setTranslateY] = useState<number>(0); // Estado para el desplazamiento vertical Y

  const [searchTerm, setSearchTerm] = useState<string>(''); // Estado con la palabra clave para filtrar la lista
  const [newPropKey, setNewPropKey] = useState<string>(''); // Estado para la clave de una nueva variable personalizada
  const [newPropValue, setNewPropValue] = useState<string>(''); // Estado para el valor de una nueva variable personalizada
  const [notification, setNotification] = useState<string | null>(null); // Estado para el texto de notificación flotante (Toast)

  // ESTADO DE BARRA DE PROGRESO % Y MONITOR DE TRABADO PARA SUBIDA DE ARCHIVOS
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false); // Activa el overlay de progreso
  const [fileProgress, setFileProgress] = useState<number>(0); // Porcentaje de carga (0-100)
  const [fileProgressText, setFileProgressText] = useState<string>(''); // Mensaje explicativo
  const [isStalled, setIsStalled] = useState<boolean>(false); // Bandera de advertencia si la carga se traba
  const activeTimeoutsRef = React.useRef<NodeJS.Timeout[]>([]); // Referencia a la lista de temporizadores para cancelación limpia

  // Cancela la carga activa y reestablece los estados sin romper el contenido
  const cancelProcessing = () => {
    activeTimeoutsRef.current.forEach(clearTimeout);
    activeTimeoutsRef.current = [];
    setIsProcessingFile(false);
    setIsStalled(false);
    setFileProgress(0);
    showNotify("[🛑] Carga cancelada. No se aplicaron modificaciones al mapa.");
  };

  // Reinicia el contador de progreso
  const resetProcessing = () => {
    activeTimeoutsRef.current.forEach(clearTimeout);
    activeTimeoutsRef.current = [];
    setIsStalled(false);
    setFileProgress(5);
    setFileProgressText("Reiniciando lectura y normalización del archivo...");
  };

  // Otorga más tiempo de espera
  const extendWaitProcessing = () => {
    setIsStalled(false);
    showNotify("[⏳] Tiempo de espera extendido. Procesando nodos vectoriales...");
  };

  // Muestra un mensaje flotante de notificación temporal por 3 segundos
  const showNotify = (msg: string) => { // Función contenedora para mostrar alertas
    setNotification(msg); // Establece el mensaje de texto en el estado
    setTimeout(() => setNotification(null), 3000); // Programa la ocultación tras 3000ms
  }; // Fin de la función showNotify

  // Cálculo memorizado de la caja de límites (Bounding Box) de todos los trazados vectoriales
  const pathsBBox = useMemo(() => { // Hook useMemo para optimizar cálculos geométricos
    return getMultiplePathsBBox(paths); // Invoca la función helper de mapas
  }, [paths]); // Se recalcula únicamente si cambia el arreglo de trazados 'paths'

  // Cálculo memorizado del atributo viewBox para que el mapa SVG encaje de manera proporcional
  const svgViewBox = useMemo(() => { // Hook useMemo para la caja de vista SVG
    if (paths.length === 0) return "0 0 800 800"; // Vista por defecto si el lienzo está vacío
    const padX = Math.max(20, pathsBBox.width * 0.05); // Margen de seguridad horizontal del 5%
    const padY = Math.max(20, pathsBBox.height * 0.05); // Margen de seguridad vertical del 5%
    return `${pathsBBox.x - padX} ${pathsBBox.y - padY} ${pathsBBox.width + padX * 2} ${pathsBBox.height + padY * 2}`; // Retorna el viewBox
  }, [pathsBBox, paths.length]); // Dependencias del memorizador de viewBox

  // Unidad de grosor de trazo adaptativa según el tamaño real del mapa
  const strokeWidthUnit = useMemo(() => { // Hook useMemo para calcular la escala visual de bordes
    if (paths.length === 0) return 1; // Grosor por defecto
    return Math.max(0.3, Math.min(pathsBBox.width, pathsBBox.height) / 350); // Calcula proporción de línea
  }, [pathsBBox, paths.length]); // Dependencias del grosor adaptativo de trazo

  // Efecto para sincronizar los elementos de la provincia seleccionada al cargar el componente
  useEffect(() => { // Hook useEffect para escuchar cambios en selectedProvince
    if (selectedProvince && selectedProvince.municipalities) { // Si la provincia contiene subdivisiones
      const initialPaths: SVGPathData[] = selectedProvince.municipalities // Mapea los municipios
        .filter((muni) => muni.d && muni.d.trim().length > 0) // Considera solo aquellos que tienen trazados geométricos válidos
        .map((muni) => ({ // Mapea cada subdivisión
          id: muni.id, // ID del municipio o región
          name: muni.name, // Nombre de la jurisdicción
          d: muni.d!, // Coordenadas de la ruta SVG
          fill: muni.visualStyles?.fillColor || muni.color, // Color de relleno asignado
          stroke: muni.visualStyles?.strokeColor, // Color de borde asignado
          strokeWidth: muni.visualStyles?.strokeWidth, // Grosor de línea asignado
          layerId: muni.layer || 'Mundo', // Capa a la que pertenece
          properties: { // Metadatos e indicadores asociados
            valor: muni.value, // Valor numérico de la variable
            porcentaje: muni.percentage, // Porcentaje territorial
            ...(muni.customData || {}) // Mezcla con metadatos personalizados si existen
          }
        })); // Fin del mapeo de initialPaths
      setPaths(initialPaths); // Carga la lista inicial de elementos vectoriales
      if (initialPaths.length > 0) setSelectedId(initialPaths[0].id); // Selecciona automáticamente la primera pieza
      else setSelectedId(null); // Desmarca si la lista está vacía
    }
  }, [selectedProvince?.id]); // Escucha cambios en el ID de la provincia seleccionada

  // 1. Procesamiento Recursivo e Ingesta del archivo JSON con Sanitización JS/TS, Barra de Progreso % y Monitor de Trabado
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => { // Función para procesar la subida de un archivo
    const file = e.target.files?.[0]; // Obtiene el archivo subido por el usuario
    if (!file) return; // Si no hay archivo interrumpe la función

    // Limpia temporizadores previos
    activeTimeoutsRef.current.forEach(clearTimeout);
    activeTimeoutsRef.current = [];

    setIsProcessingFile(true); // Activa el overlay de progreso
    setIsStalled(false); // Resetea el monitor de estancamiento
    setFileProgress(15); // Progreso inicial 15%
    setFileProgressText("Iniciando lectura y decodificación de archivo vectorial...");

    // Activa monitor de estancamiento tras 3.8s de inactividad o proceso extenso
    const stallTimer = setTimeout(() => {
      setIsStalled(true); // Muestra panel de advertencia si se demorase el proceso
    }, 3800);
    activeTimeoutsRef.current.push(stallTimer);

    const reader = new FileReader(); // Crea el lector de archivos FileReader
    reader.onload = (event) => { // Handler que se activa al terminar de leer el archivo
      const t1 = setTimeout(() => {
        setFileProgress(45); // Avance 45%
        setFileProgressText("Sanitizando código JS/TS y extrayendo estructuras GeoJSON / Capas...");

        try { // Manejo de excepciones
          const rawText = event.target?.result as string || ''; // Contenido crudo
          const cleanedText = sanitizeJsonString(rawText); // Limpieza inteligente de comentarios y wrappers export default / const
          const json = JSON.parse(cleanedText || rawText); // Convierte la cadena sanitizada en un objeto JSON

          // FUNCIÓN RECURSIVA: Escarba el JSON buscando todos los elementos que tengan una propiedad "d" (trazados)
          // No importa si están escondidos dentro de layers, groups, features o arrays anidados.
          const extractPaths = (node: any, currentLayerName?: string): any[] => { // Función recursiva contenedora
            let extracted: any[] = []; // Arreglo acumulador para almacenar trazados
            if (Array.isArray(node)) { // Si el nodo es un arreglo
              node.forEach(item => { extracted = extracted.concat(extractPaths(item, currentLayerName)); }); // Llama recursivamente a cada elemento
            } else if (typeof node === 'object' && node !== null) { // Si el nodo es un objeto
              const layerName = node.layer || node.layerId || node.name || node.id || currentLayerName; // Determina el nombre de la capa activa
              
              // Si el objeto tiene un trazado matemático "d", lo atrapamos
              if (node.d) { // Verifica si el objeto contiene la clave d
                 extracted.push({ ...node, inheritedLayer: layerName !== node.id ? layerName : 'General' }); // Lo agrega al acumulador
              } else if (node.type === 'Feature' && node.properties) { // Si es una Feature GeoJSON
                if (node.geometry && node.geometry.coordinates) { // Si tiene geometría GeoJSON
                  // Extrae propiedades
                  extracted.push({
                    id: node.id || node.properties.id || `geo-${Date.now()}-${Math.random()}`, // Asigna ID
                    name: node.properties.name || node.properties.NAME || node.properties.nombre || 'GeoElemento', // Asigna Nombre
                    d: node.d || '', // Trazo
                    fill: node.properties.fill || node.properties.fillColor, // Relleno
                    stroke: node.properties.stroke || node.properties.strokeColor, // Borde
                    inheritedLayer: layerName || 'GeoJSON', // Capa
                    properties: node.properties // Propiedades
                  });
                }
              }
              
              // Buscar en posibles sub-categorías comunes generadas por exportadores vectoriales
              if (node.paths) extracted = extracted.concat(extractPaths(node.paths, layerName)); // Busca dentro del arreglo .paths
              if (node.features) extracted = extracted.concat(extractPaths(node.features, layerName)); // Busca dentro del arreglo .features
              if (node.layers) extracted = extracted.concat(extractPaths(node.layers, layerName)); // Busca dentro del arreglo .layers
              if (node.groups) extracted = extracted.concat(extractPaths(node.groups, layerName)); // Busca dentro del arreglo .groups
              if (node.children) extracted = extracted.concat(extractPaths(node.children, layerName)); // Busca dentro del arreglo .children
            }
            return extracted; // Devuelve la lista acumulada de trazados
          }; // Fin de la función recursiva extractPaths

          const rawPaths = extractPaths(json); // Inicia la extracción recursiva pasando el JSON leído

          const t2 = setTimeout(() => {
            setFileProgress(80); // Avance 80%
            setFileProgressText("Estandarizando polígonos, colores y calibración de capas...");

            if (rawPaths.length > 0) { // Si se hallaron elementos vectoriales válidos
              const validatedPaths: SVGPathData[] = rawPaths.map((item: any, index: number) => ({ // Mapea al formato SVGPathData
                id: String(item.id || `vector-path-${index}-${Date.now()}`), // ID estandarizada
                name: String(item.name || `Trazado ${index + 1}`), // Nombre estandarizado
                d: String(item.d || ''), // Cadena d de comandos SVG
                // Capturamos los colores originales exportados!
                fill: item.fill || item.visualStyles?.fillColor || item.fillColor, // Asigna el color de relleno original
                stroke: item.stroke || item.visualStyles?.strokeColor || item.strokeColor, // Asigna el color de contorno original
                strokeWidth: item.strokeWidth || item.visualStyles?.strokeWidth, // Asigna el grosor original de trazo
                layerId: item.inheritedLayer || item.layer || item.layerId || 'Mundo', // Asigna la capa o nivel
                properties: item.properties || item.customData || {} // Asigna metadatos libres
              })).filter(p => p.d && p.d.trim().length > 0); // Filtra únicamente aquellos con trazados válidos

              setPaths(validatedPaths); // Actualiza la lista de trazados en el estado
              if (validatedPaths.length > 0) setSelectedId(validatedPaths[0].id); // Selecciona el primer elemento de la lista

              const initialScale = json.transform?.scale || 1; // Lee la escala calibrada del JSON o asigna 1 por defecto
              const initialTx = json.transform?.translateX || 0; // Lee la traslación X del JSON o asigna 0 por defecto
              const initialTy = json.transform?.translateY || 0; // Lee la traslación Y del JSON o asigna 0 por defecto

              setScale(initialScale); // Establece el estado de escala
              setTranslateX(initialTx); // Establece el estado de traslación X
              setTranslateY(initialTy); // Establece el estado de traslación Y

              if (selectedProvince && onUpdateProvince) { // Si hay una provincia en edición
                const updatedMunicipalities = validatedPaths.map((p) => ({ // Convierte la lista a formato MunicipalityData
                  id: p.id, // Asigna ID
                  name: p.name, // Asigna Nombre
                  d: p.d, // Asigna Trazo
                  value: p.properties?.valor !== undefined ? Number(p.properties.valor) : 50, // Asigna Valor numérico
                  percentage: p.properties?.porcentaje !== undefined ? Number(p.properties.porcentaje) : 10, // Asigna Porcentaje
                  layer: p.layerId, // Asigna la Capa
                  visualStyles: { // Preserva los estilos visuales de relleno y contornos
                    fillColor: p.fill, // Color de relleno
                    strokeColor: p.stroke, // Color de borde
                    strokeWidth: p.strokeWidth // Grosor de línea
                  },
                  customData: p.properties // Inyecta propiedades libres
                })); // Fin del mapeo de municipios
                onUpdateProvince({ // Actualiza la provincia en el estado global de la aplicación
                  ...selectedProvince, // Retiene los datos anteriores de la provincia
                  municipalities: updatedMunicipalities, // Sobrescribe la lista de municipios/capas
                  mapTransform: { scale: initialScale, panX: initialTx, panY: initialTy } // Actualiza la posición y calibración
                }); // Fin del dispatch onUpdateProvince
              } // Fin del bloque condicional de provincia

              setFileProgress(100); // 100% Completado
              setFileProgressText("¡Mapa importado y desplegado con éxito!");
              setIsStalled(false); // Desactiva la alerta

              const t3 = setTimeout(() => {
                setIsProcessingFile(false); // Oculta el overlay
                showNotify(`[✓] Se importaron ${validatedPaths.length} trazados incluyendo capas. Acomodados en pantalla.`); // Notifica al usuario
              }, 400);
              activeTimeoutsRef.current.push(t3);

            } else { // Si no se encontraron trazados en la lectura
              setIsProcessingFile(false);
              setIsStalled(false);
              alert("Estructura inválida. No se detectaron trazados (propiedad 'd') en el archivo JSON."); // Muestra alerta
            } // Fin de verificación de trazados
          }, 200);
          activeTimeoutsRef.current.push(t2);

        } catch (error) { // Captura posibles errores de parseo JSON
          setIsProcessingFile(false);
          setIsStalled(false);
          alert("Error al parsear el JSON. Verificá que el archivo no contenga errores sintácticos."); // Notifica el error de parseo
        } // Fin de try-catch
      }, 150);
      activeTimeoutsRef.current.push(t1);
    }; // Fin del manejador de FileReader
    reader.readAsText(file); // Lee el contenido del archivo como texto
    if (e.target) e.target.value = ''; // Resetea el valor del input de archivo para permitir cargas repetidas del mismo archivo
  }; // Fin de handleFileUpload

  // Modifica los campos directos o las propiedades del elemento vectorial seleccionado
  const updateSelectedPath = (field: string, value: any) => { // Función modificadora de trazados
    if (!selectedId) return; // Si no hay elemento seleccionado, no realiza nada
    setPaths(prev => prev.map(p => { // Recorre la lista previa de trazados
      if (p.id === selectedId) { // Compara la ID para hallar el elemento activo
        if (field === 'name') return { ...p, name: value }; // Modifica el nombre del elemento
        if (field === 'fill') return { ...p, fill: value }; // Modifica el color de relleno
        if (field === 'stroke') return { ...p, stroke: value }; // Modifica el color de borde
        if (field === 'layerId') return { ...p, layerId: value }; // Modifica la capa asignada
        return { ...p, properties: { ...(p.properties || {}), [field]: value } }; // Añade o modifica una propiedad personalizada
      }
      return p; // Devuelve los demás elementos intactos
    })); // Fin de setPaths
  }; // Fin de updateSelectedPath

  // Agrega una nueva propiedad clave y valor a la matriz de metadatos del elemento activo
  const handleAddProperty = (e: React.FormEvent) => { // Manejador del formulario de añadir métrica
    e.preventDefault(); // Previene el comportamiento nativo de envío del formulario
    if (!selectedId || !newPropKey.trim()) return; // Cancela si no hay selección o si la clave está vacía
    updateSelectedPath(newPropKey.trim(), newPropValue); // Actualiza la propiedad en el elemento
    setNewPropKey(''); // Resetea el campo de la clave
    setNewPropValue(''); // Resetea el campo del valor
  }; // Fin de handleAddProperty

  // Elimina una clave de propiedad específica del elemento seleccionado
  const handleRemoveProperty = (key: string) => { // Función para borrar una propiedad
    if (!selectedId) return; // Si no hay selección cancela
    setPaths(prev => prev.map(p => { // Recorre los trazados
      if (p.id === selectedId) { // Localiza el elemento activo
        const updatedProps = { ...(p.properties || {}) }; // Copia las propiedades actuales
        delete updatedProps[key]; // Elimina la clave especificada
        return { ...p, properties: updatedProps }; // Retorna el trazado con el conjunto de propiedades actualizado
      }
      return p; // Retorna los demás trazados sin cambios
    })); // Fin de setPaths
  }; // Fin de handleRemoveProperty

  // 5. Guardar en la aplicación y en la base de datos (geoNodes) respetando la jerarquía actual navPath
  const handleSaveToApp = async () => { // Función asíncrona para guardar y sincronizar
    if (paths.length === 0) { // Verifica si hay elementos vectoriales en el lienzo
      showNotify("[⚠️] No hay trazados vectoriales en el lienzo para guardar."); // Notifica si está vacío
      return; // Detiene la ejecución
    } // Fin de la comprobación de trazados

    // Identifica el parentId leyendo el último elemento del array navPath (nodo padre activo)
    const parentId = activeParentId; // Identificador del padre (ej: "world", "root")

    // Transforma y mapea los polígonos/paths del canvas al formato exacto de la tabla geoNodes
    const geoNodesPayload = paths.map((p) => ({ // Mapea cada trazado vectorial
      id: p.id, // Identificador único del nodo vectorial (UUID o ID generado)
      name: p.name || `Nodo Vectorial ${p.id}`, // Nombre asignado en el panel
      type: p.layerId || 'region', // Categoría o tipo de nodo (ej: "Mundo", "Ríos", "Sistemas")
      parentId: parentId, // Identificador del nodo padre en la jerarquía activa (parentId)
      workspaceId: 'ws_default', // Identificador del espacio de trabajo
      svgPath: p.d, // String con el trazado vectorial d="..."
      visualStyles: { // Estilos visuales de la pieza
        fillColor: p.fill || '#0f1a30', // Color de relleno
        strokeColor: p.stroke || '#334155', // Color de borde
        strokeWidth: p.strokeWidth || 1 // Grosor del contorno
      }, // Fin de visualStyles
      metadata: p.properties || {}, // Propiedades e indicadores estadísticos asociados
      updatedAt: new Date().toISOString() // Marca de tiempo de la actualización
    })); // Fin del mapeo geoNodesPayload

    // Invocación a la función de guardado en base de datos (geoNodes)
    await saveNodesToDatabase(geoNodesPayload); // Ejecuta la función asíncrona saveNodesToDatabase

    // Mantiene la actualización en la aplicación local y estado global de la provincia si existe
    if (selectedProvince && onUpdateProvince) { // Si hay una provincia definida
      const updatedMunicipalities = paths.map(p => ({ // Convierte los trazados del lienzo a MunicipalityData
        id: p.id, // ID único
        name: p.name, // Nombre de la pieza
        d: p.d, // Comandos vectoriales
        value: p.properties?.valor !== undefined ? Number(p.properties.valor) : 50, // Valor cuantitativo
        percentage: p.properties?.porcentaje !== undefined ? Number(p.properties.percentage) : 10, // Porcentaje
        layer: p.layerId, // Capa territorial asignada
        visualStyles: { // Estilos visuales exactos
          fillColor: p.fill, // Color de relleno
          strokeColor: p.stroke, // Color de contorno
          strokeWidth: p.strokeWidth // Grosor de contorno
        },
        customData: p.properties // Colección completa de propiedades e indicadores
      })); // Fin del mapeo

      onUpdateProvince({ // Inyecta los cambios en el estado global
        ...selectedProvince, // Mantiene atributos principales de la provincia
        municipalities: updatedMunicipalities, // Actualiza la colección de municipios/capas
        mapTransform: { scale, panX: translateX, panY: translateY } // Guarda la calibración espacial
      }); // Fin del dispatch onUpdateProvince
    } // Fin del condicional de provincia
  }; // Fin de handleSaveToApp

  // Exporta el paquete vectorial completo calibrado a un archivo JSON estándar descargable
  const handleExportJson = () => { // Función para exportar JSON
    if (paths.length === 0) return; // Cancela si no hay trazados en el lienzo

    const outputData = { // Crea el paquete estructurado de exportación
      generator: "Visualizador de Datos Arg - Canvas Integrador", // Firma del generador
      exportDate: new Date().toISOString(), // Marca de tiempo ISO
      transform: { scale, translateX, translateY }, // Parámetros de calibración espacial
      paths: paths // Colección completa de trazados vectoriales con sus estilos y capas
    }; // Fin de la estructura outputData

    const blob = new Blob([JSON.stringify(outputData, null, 2)], { type: 'application/json' }); // Genera el Blob de datos JSON
    const url = URL.createObjectURL(blob); // Genera la URL temporal del Blob
    const link = document.createElement('a'); // Crea un elemento 'a' para descarga
    link.href = url; // Asigna la URL al enlace
    link.download = `mapa_datos_calibrado_${Date.now()}.json`; // Asigna el nombre de archivo con timestamp
    link.click(); // Ejecuta la descarga automática
    URL.revokeObjectURL(url); // Cancela y libera la memoria de la URL temporal
    showNotify('[✓] Archivo mapa_datos_calibrado.json exportado.'); // Notifica el éxito de la exportación
  }; // Fin de handleExportJson

  const selectedPath = paths.find(p => p.id === selectedId); // Busca el objeto del elemento actualmente seleccionado
  const filteredPaths = paths.filter(p => // Filtra los trazados vectoriales según el término ingresado en la búsqueda
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || // Filtro por coincidencia de Nombre
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) || // Filtro por coincidencia de ID
    (p.layerId && p.layerId.toLowerCase().includes(searchTerm.toLowerCase())) // Filtro por coincidencia de Capa
  ); // Fin de filteredPaths

  return ( // Renderizado del JSX del componente
    <div className="flex flex-col h-screen bg-[#080d19] text-slate-100 font-sans">
      {/* Toast Flotante de Notificación */}
      {notification && ( // Si existe un mensaje de notificación activo lo renderiza
        <div className="absolute top-20 right-6 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-300 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {/* Icono de confirmación */}
          <span>{notification}</span> {/* Texto del mensaje */}
        </div>
      )}

      {/* Encabezado Superior de Herramientas y Acciones */}
      <header className="bg-[#0b1325] border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg border border-emerald-500/20">
            <Layers className="w-5 h-5" /> {/* Icono descriptivo de capas */}
          </div>
          <div>
            <h1 className="text-md font-bold tracking-wide flex items-center gap-2">
              Calibrador Geográfico Integrador
              {selectedProvince && ( // Muestra la insignia si hay una provincia seleccionada
                <span className="text-xs text-emerald-400 font-normal bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {/* Icono de pin de ubicación */}
                  {selectedProvince.name} {/* Nombre de la provincia activa */}
                </span>
              )}
              {/* Insignia indicadora del Nodo Padre activo en la jerarquía (parentId) */}
              <span className="text-xs text-blue-400 font-normal bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                Padre: {activeParentNode.name} ({activeParentId})
              </span>
            </h1>
            <p className="text-xs text-slate-400">Acomodá capas estructuradas y asociá variables a cualquier elemento</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Botón Personalizado para la Carga de Archivos JSON */}
          <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg border border-slate-700 cursor-pointer transition-colors text-sm font-medium shadow-sm">
            <Upload className="w-4 h-4 text-slate-400" /> {/* Icono de subir */}
            <span>Cargar Mapa Multicapa JSON</span> {/* Etiqueta del botón */}
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" /> {/* Input de archivo oculto */}
          </label>

          {/* Botón para Guardar en Base de Datos geoNodes con parentId */}
          <button
            onClick={handleSaveToApp} // Manejador para guardar en la base de datos y aplicación
            disabled={paths.length === 0} // Deshabilita si no hay trazados cargados
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20 border border-blue-500 cursor-pointer"
          >
            <Save className="w-4 h-4" /> {/* Icono de guardar */}
            <span>Guardar en BD (Padre: {activeParentNode.name})</span> {/* Texto del botón con el nodo padre dinámico */}
          </button>

          {/* Botón para Exportar la Calibración como JSON */}
          <button
            onClick={handleExportJson} // Manejador para exportar
            disabled={paths.length === 0} // Deshabilita si el lienzo está vacío
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-900/20 border border-emerald-700"
          >
            <Download className="w-4 h-4" /> {/* Icono de descarga */}
            <span>Exportar Calibrado</span> {/* Texto del botón */}
          </button>
        </div>
      </header>

      {/* Espacio de Trabajo Principal */}
      <div className="flex flex-1 overflow-hidden">
        {/* PANEL IZQUIERDO: LIENZO Y VISTA DE MAPA VECTORIAL */}
        <div className="flex-1 bg-[#090f1c] relative overflow-hidden flex flex-col">
          {/* Caja Flotante de Controles de Acomodación y Zoom */}
          <div className="absolute top-4 left-4 z-10 bg-[#0b1325]/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 w-72 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Controles de Acomodación</span>
              <button 
                onClick={() => { // Resetea la calibración y encaja la vista
                  setScale(1); // Resetea la escala a 1
                  setTranslateX(0); // Resetea el desplazamiento X a 0
                  setTranslateY(0); // Resetea el desplazamiento Y a 0
                  showNotify('[✓] Vista centrada.'); // Muestra mensaje de confirmación
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium hover:underline cursor-pointer"
                title="Ajustar y centrar la vista al mapa"
              >
                <Maximize2 className="w-3 h-3" /> {/* Icono de auto-fit */}
                <span>Auto-Fit</span> {/* Etiqueta de centrado */}
              </button>
            </div>

            {/* Slider de Control de Escala / Zoom */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Escala ({scale.toFixed(2)}x)</span>
                <button onClick={() => setScale(1)} className="text-emerald-400 hover:underline text-[10px]">Reset</button>
              </div>
              <input
                type="range" min="0.1" max="5" step="0.05"
                value={scale} onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Slider de Control de Traslación Horizontal X */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Desplazamiento X ({translateX}px)</span>
                <button onClick={() => setTranslateX(0)} className="text-emerald-400 hover:underline text-[10px]">Reset</button>
              </div>
              <input
                type="range" min="-600" max="600" step="5"
                value={translateX} onChange={(e) => setTranslateX(parseInt(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Slider de Control de Traslación Vertical Y */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Desplazamiento Y ({translateY}px)</span>
                <button onClick={() => setTranslateY(0)} className="text-emerald-400 hover:underline text-[10px]">Reset</button>
              </div>
              <input
                type="range" min="-600" max="600" step="5"
                value={translateY} onChange={(e) => setTranslateY(parseInt(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Área del Lienzo SVG Interactivo */}
          <div className="flex-1 flex items-center justify-center p-8 relative">
            {/* Fondo Cuadriculado Técnico de Diseño */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>

            {/* OVERLAY Y MEDIDOR CIRCULAR DE PROGRESO DE CARGA Y NORMALIZACIÓN DE CAPAS % */}
            {isProcessingFile && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xl flex flex-col items-center justify-center p-6 z-30 pointer-events-auto">
                <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full space-y-5 text-center relative overflow-hidden">
                  
                  {/* CÍRCULO / ANILLO DE PROGRESO CON PORCENTAJE % DESTACADO */}
                  <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {/* Círculo de fondo */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-slate-800"
                        fill="transparent"
                      />
                      {/* Círculo de progreso dinámico */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * fileProgress) / 100}
                        strokeLinecap="round"
                        className="text-emerald-400 transition-all duration-300 ease-out"
                        fill="transparent"
                      />
                    </svg>
                    {/* Porcentaje numérico centrado dentro del anillo */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-black text-white font-mono tracking-tighter">
                        {fileProgress}%
                      </span>
                      <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold">
                        Cargando
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center justify-center gap-2">
                      <Layers size={16} className="animate-spin text-emerald-400" />
                      Procesador Multicapa Vectorial
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-mono leading-relaxed px-2">
                      {fileProgressText}
                    </p>
                  </div>
                  
                  {/* BARRA DE PROGRESO HORIZONTAL */}
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full bg-slate-950 rounded-full h-3.5 overflow-hidden border border-slate-800 p-0.5 shadow-inner">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-300 shadow-md"
                        style={{ width: `${fileProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono text-emerald-400 font-bold px-1">
                      <span>ESTADO DE PROCESAMIENTO</span>
                      <span>{fileProgress}% COMPLETADO</span>
                    </div>
                  </div>

                  {/* ADVERTENCIA Y PANEL DE ACCIÓN SI SE TRABA O DEMORA MÁS DE LO HABITUAL */}
                  {isStalled && (
                    <div className="bg-amber-950/60 border border-amber-500/40 rounded-2xl p-3 text-left space-y-2.5 animate-fadeIn">
                      <div className="flex items-start gap-2">
                        <span className="text-amber-400 text-sm">⚠️</span>
                        <div>
                          <p className="text-xs font-bold text-amber-200">
                            ¿La lectura del archivo multicapa parece haberse demorado?
                          </p>
                          <p className="text-[11px] text-amber-300/80 mt-0.5">
                            Archivos grandes con miles de polígonos requieren más tiempo. Podés elegir qué hacer:
                          </p>
                        </div>
                      </div>

                      {/* Botones de acción para Suspender, Resetear o Esperar */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={cancelProcessing}
                          className="bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-[10px] font-bold py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1"
                          title="Suspender la carga y mantener el estado previo"
                        >
                          🛑 Suspender
                        </button>
                        <button
                          onClick={resetProcessing}
                          className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[10px] font-bold py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1"
                          title="Reiniciar el proceso de carga"
                        >
                          🔄 Resetear
                        </button>
                        <button
                          onClick={extendWaitProcessing}
                          className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 text-[10px] font-bold py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1"
                          title="Continuar esperando la lectura"
                        >
                          ⏳ Esperar
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {paths.length === 0 ? ( // Muestra la tarjeta informativa si no hay trazados cargados
              <div className="text-center max-w-sm border border-dashed border-slate-800 p-8 rounded-2xl bg-[#0b1325]/40 backdrop-blur-sm">
                <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" /> {/* Icono de capas */}
                <p className="text-sm font-medium text-slate-400">Ningún mapa importado</p> {/* Título */}
                <p className="text-xs text-slate-500 mt-1">Subí tu JSON multi-capa para visualizar países, ríos, zonas y separaciones.</p> {/* Descripción */}
              </div>
            ) : ( // Si hay trazados cargados renderiza el SVG interactivo
              <svg
                viewBox={svgViewBox} // Asigna el viewBox adaptativo memorizado
                className="w-full h-auto max-h-[75vh] border border-slate-800 rounded-xl bg-[#060a12] shadow-2xl transition-all select-none"
              >
                {/* Grupo contenedor con las transformaciones de escala y traslación aplicadas */}
                <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
                  {paths.map((path) => { // Recorre el arreglo de trazados vectoriales
                    const isSelected = path.id === selectedId; // Verifica si el elemento está seleccionado
                    const isHovered = path.id === hoveredId; // Verifica si el puntero está sobre el elemento

                    // LÓGICA DE DIBUJADO QUE RESPETA EL DISEÑO Y BORDES ORIGINALES
                    // Si el elemento contiene color de relleno propio lo utiliza, de lo contrario asigna el tono oscuro por defecto
                    let fillRender = path.fill || "#0f1a30"; // Color de relleno predeterminado
                    if (isSelected) fillRender = "#10b981"; // Resaltado de selección verde esmeralda
                    else if (isHovered && !path.fill) fillRender = "#10b98133"; // Resaltado de hover translúcido

                    // Fuerza siempre a que el elemento tenga borde visible para evitar la fusión en bloques sólidos
                    const strokeRender = isSelected ? "#34d399" : (path.stroke || "#334155"); // Color del trazo o contorno
                    const strokeWRender = isSelected ? strokeWidthUnit * 2.5 : (path.strokeWidth || strokeWidthUnit); // Grosor de línea

                    return ( // Retorna el elemento path SVG
                      <path
                        key={path.id} // Clave única React
                        d={path.d} // Trazo SVG
                        fill={fillRender} // Color de relleno determinado
                        stroke={strokeRender} // Color de contorno determinado
                        strokeWidth={strokeWRender} // Grosor de línea
                        strokeLinejoin="round" // Esquinas suavizadas
                        strokeLinecap="round" // Puntas de trazado suavizadas
                        className="cursor-pointer transition-colors duration-150 ease-in-out" // Estilos e interacciones CSS
                        onMouseEnter={() => setHoveredId(path.id)} // Manejador de entrada de puntero
                        onMouseLeave={() => setHoveredId(null)} // Manejador de salida de puntero
                        onClick={() => setSelectedId(path.id)} // Manejador de selección por clic
                      />
                    ); // Fin del path SVG
                  })}
                </g> {/* Fin del grupo con transformaciones */}
              </svg>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: INSPECTOR DE CAPAS, IDENTIDADES Y PROPIEDADES */}
        <div className="w-96 bg-[#0b1325] border-l border-slate-800 flex flex-col overflow-y-auto">
          {/* Sección de Lista de Trazados y Buscador */}
          <div className="p-4 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase block mb-2">
              Lista de Piezas Geográficas ({paths.length})
            </span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" /> {/* Icono de búsqueda */}
              <input
                type="text"
                placeholder="Buscar por nombre o capa (ej. rios)..." // Placeholder descriptivo
                value={searchTerm} // Estado del término de búsqueda
                onChange={(e) => setSearchTerm(e.target.value)} // Evento de cambio de búsqueda
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Listado Desplazable de Elementos Encontrados */}
            <div className="max-h-40 overflow-y-auto mt-2 border border-slate-800 bg-slate-900/40 rounded-lg text-xs">
              {filteredPaths.map(p => ( // Recorre los elementos filtrados
                <button
                  key={p.id} // Clave única de botón
                  onClick={() => setSelectedId(p.id)} // Evento para seleccionar el elemento
                  className={`w-full text-left px-3 py-2 border-b border-slate-800/60 flex justify-between items-center transition-colors ${
                    p.id === selectedId 
                      ? 'bg-emerald-500/10 text-emerald-400 font-semibold' // Estilos cuando está seleccionado
                      : 'hover:bg-slate-800/50 text-slate-300' // Estilos estándar
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="truncate max-w-[160px]">{p.name}</span> {/* Nombre del elemento */}
                    {p.layerId && <span className="text-[9px] text-slate-500 uppercase">Capa: {p.layerId}</span>} {/* Etiqueta de la capa */}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono truncate max-w-[80px]">{p.id}</span> {/* ID del trazo */}
                </button>
              ))}
              {filteredPaths.length === 0 && paths.length > 0 && ( // Si no hay coincidencias en la búsqueda
                <div className="p-3 text-slate-500 text-center">Sin resultados coincidentes.</div>
              )}
            </div>
          </div>

          {/* Editor de Propiedades del Trazado Seleccionado */}
          <div className="p-4 flex-1 flex flex-col gap-4">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">
              Identidad y Datos Asociados
            </span>

            {selectedPath ? ( // Si hay un trazo seleccionado
              <div className="flex flex-col gap-4 flex-1">
                {/* ID del Elemento Vectorial */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">ID Vectorial Geográfico</label>
                  <input
                    type="text"
                    value={selectedPath.id} // ID no modificable
                    disabled // Campo deshabilitado
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Nombre Visible Modificable */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nombre Humano / Jurisdicción</label>
                  <input
                    type="text"
                    value={selectedPath.name} // Valor actual del nombre
                    onChange={(e) => updateSelectedPath('name', e.target.value)} // Evento de modificación de nombre
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Cambiá este nombre al real (Ej: "Río Paraná", "Francia", "Islas Malvinas")
                  </p>
                </div>

                {/* Edición de Capa Territorial */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Capa o Categoría Territorial</label>
                  <input
                    type="text"
                    value={selectedPath.layerId || ''} // Valor actual de la capa
                    onChange={(e) => updateSelectedPath('layerId', e.target.value)} // Evento para cambiar de capa
                    placeholder="Ej: Rios, Lagos, Paises..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                {/* Tabla de Matriz de Propiedades Personalizadas */}
                <div className="border border-slate-800 rounded-xl bg-slate-900/60 p-3 flex flex-col gap-3">
                  <span className="text-xs font-medium text-slate-300 block">
                    Matriz de Variables e Indicadores
                  </span>

                  {/* Lista de Variables Inyectadas */}
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {Object.entries(selectedPath.properties || {}).map(([key, val]) => ( // Recorre las entradas de properties
                      <div key={key} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
                        <div className="flex flex-col">
                          <span className="font-mono text-emerald-400 font-medium">{key}</span> {/* Clave de la propiedad */}
                          <span className="text-slate-300 truncate max-w-[160px]">{String(val)}</span> {/* Valor de la propiedad */}
                        </div>
                        <button
                          onClick={() => handleRemoveProperty(key)} // Evento para eliminar esta propiedad
                          className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 transition-colors"
                          title="Eliminar variable"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {/* Icono de papelera */}
                        </button>
                      </div>
                    ))}
                    {Object.keys(selectedPath.properties || {}).length === 0 && ( // Si no existen propiedades
                      <p className="text-[11px] text-slate-500 text-center py-2 italic">
                        Sin variables cargadas en esta pieza.
                      </p>
                    )}
                  </div>

                  {/* Formulario Rápido para Añadir Métrica o Propiedad */}
                  <form onSubmit={handleAddProperty} className="flex gap-1.5 border-t border-slate-800/80 pt-2.5 mt-1">
                    <input
                      type="text"
                      placeholder="Métrica (ej: caudal)" // Campo de clave
                      value={newPropKey} // Estado de la nueva clave
                      onChange={(e) => setNewPropKey(e.target.value)} // Cambio de la nueva clave
                      className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Valor (ej: 1200)" // Campo de valor
                      value={newPropValue} // Estado del nuevo valor
                      onChange={(e) => setNewPropValue(e.target.value)} // Cambio del nuevo valor
                      className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-200"
                    />
                    <button
                      type="submit" // Botón de envío
                      className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white rounded-lg p-1 px-2 text-xs transition-colors"
                    >
                      + {/* Signo más */}
                    </button>
                  </form>
                </div>
              </div>
            ) : ( // Si no hay ningún elemento seleccionado
              <div className="flex-1 flex items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-xl bg-slate-900/20 text-slate-500 text-xs italic">
                Seleccioná una porción del mapa o de la lista para editar sus identidades y datos estadísticos.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ); // Fin de renderizado JSX
} // Fin del componente MapCalibrationPanel
