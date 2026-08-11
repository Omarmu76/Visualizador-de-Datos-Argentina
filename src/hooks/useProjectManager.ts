// IMPORTACIÓN DE HOOKS DE REACT PARA MANEJO DE ESTADOS Y EFECTOS
import { useState, useCallback, useEffect } from 'react'; // Importa useState para variables reactivas, useCallback para funciones optimizadas y useEffect para efectos secundarios

// INTERFAZ DE ESTRUCTURA DEL PAYLOAD DEL PROYECTO PARA SERIALIZACIÓN Y PERSISTENCIA DE DATOS
export interface ProjectDataPayload {
  version: string; // Versión del esquema de datos del proyecto (ej. "1.0.0")
  projectName: string; // Nombre amigable del proyecto asignado por el usuario
  lastModified: string; // Marca de tiempo ISO de la última modificación
  timestamp?: string; // Marca de tiempo ISO de creación o guardado
  id?: string | null; // Identificador único opcional del proyecto
  activeMapLevel?: string; // Nivel de mapa activo ('world' | 'continent' | 'country' | 'province')
  selectedProvinceId?: string | null; // ID de la provincia o territorio seleccionado
  selectedMetric?: string; // Métrica de análisis activa (pobreza, desempleo, etc.)
  navPath?: any[]; // Historial de navegaciones en el árbol de nodos
  provincesData?: any; // Objeto con datos de provincias y métricas vectoriales
  appTreeNodes?: any[]; // Estructura de nodos geográficos de la base de datos
  paths?: any[]; // Arreglo genérico de trazados vectoriales o elementos del proyecto
  metadata?: any; // Metadatos adicionales flexibles
}

// FUNCIÓN AUXILIAR PARA DESCARGAR DATOS EN UN ARCHIVO .JSON MEDIANTE UN BLOB (COMPATIBLE CON IFRAMES)
const downloadBlob = (data: any, filename: string) => { // Recibe el objeto o string de datos y el nombre del archivo sugerido
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2); // Convierte a cadena JSON formateada con 2 espacios de sangría
  const blob = new Blob([jsonString], { type: 'application/json' }); // Crea un objeto Blob en memoria de tipo JSON
  const url = URL.createObjectURL(blob); // Genera una URL pública temporal para activar la descarga
  const a = document.createElement('a'); // Crea un elemento ancla HTML no visible en el documento
  a.href = url; // Asigna la URL temporal como enlace de destino
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`; // Asegura la extensión .json en el nombre del archivo
  document.body.appendChild(a); // Agrega temporalmente el ancla al DOM
  a.click(); // Dispara la descarga simulando un clic del usuario
  document.body.removeChild(a); // Remueve el elemento del DOM tras ejecutar la descarga
  URL.revokeObjectURL(url); // Libera inmediatamente la memoria asociada a la URL temporal
}; // Fin de la función auxiliar downloadBlob

// DECLARACIÓN E IMPLEMENTACIÓN DEL HOOK PERSONALIZADO useProjectManager CON SOPORTE IN-PLACE OVERWRITE Y BD
export const useProjectManager = (
  // PARÁMETRO CON EL ESTADO ACTUAL COMPLETO DEL PROYECTO A SERIALIZAR (PUEDE SER OBJETO, ARREGLO O CADENA)
  currentData: any,
  // CALLBACK PARA INYECTAR Y RESTAURAR LOS DATOS CARGADOS EN LA APLICACIÓN
  onLoadData: (data: any) => void,
  // CALLBACK OPCIONAL PARA SINCRONIZAR LA BASE DE DATOS O LISTA DE PROYECTOS EN EL DASHBOARD DE LA APP
  onSaveToDatabase?: (project: { id?: string; name: string; payload: any }) => void,
  // IDENTIFICADOR OPCIONAL DEL PROYECTO EN LA BASE DE DATOS
  currentProjectId?: string | null
) => {
  // ESTADO PARA ALMACENAR Y GESTIONAR EL NOMBRE EDITABLE DEL PROYECTO
  const [projectName, setProjectName] = useState<string>('Proyecto Sin Título'); // Nombre predeterminado del proyecto
  // ESTADO PARA ALMACENAR EL ID ÚNICO DEL PROYECTO EN LA BASE DE DATOS DE LA APP
  const [projectId, setProjectId] = useState<string | null>(currentProjectId || null); // ID único del proyecto o null si es nuevo
  // ESTADO BOOLEANO QUE INDICA SI EXISTEN CAMBIOS SIN GUARDAR (DIRTY STATE)
  const [isDirty, setIsDirty] = useState<boolean>(false); // Comienza en false al inicializarse
  // ESTADO PARA ALMACENAR LA REFERENCIA AL ARCHIVO DE LA FILE SYSTEM ACCESS API (FileSystemFileHandle)
  const [fileHandle, setFileHandle] = useState<any | null>(null); // Puntero al archivo local en disco

  // EFECTO DE SEGURIDAD PARA PREVENIR EL CIERRE O REFRESCO ACCIDENTAL DE PESTAÑA SI HAY CAMBIOS PENDIENTES
  useEffect(() => { // Hook useEffect para registrar la escucha del evento beforeunload
    // MANEJADOR DEL EVENTO DE NAVEGADOR BEFOREUNLOAD
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { // Escucha el evento de salida de la página
      // VERIFICA SI EXISTEN CAMBIOS PENDIENTES DE GUARDAR EN EL ESTADO
      if (isDirty) { // Si hay cambios sin guardar
        // CANCELA LA ACCIÓN POR DEFECTO DEL NAVEGADOR PARA MOSTRAR LA ADVERTENCIA
        e.preventDefault(); // Cancela la salida directa
        // ESTABLECE LA CADENA DE RETORNO ESTÁNDAR EXIGIDA POR NAVEGADORES MODERNOS
        e.returnValue = ''; // Muestra el diálogo estándar de seguridad
      } // Fin de la condición de isDirty
    }; // Fin del manejador handleBeforeUnload
    // SUSCRIBE EL EVENTO BEFOREUNLOAD A LA VENTANA GLOBAL
    window.addEventListener('beforeunload', handleBeforeUnload); // Suscribe el listener
    // LIMPIA Y REMUEVE EL LISTENER AL DESMONTAR EL COMPONENTE O CAMBIAR ISDIRTY
    return () => window.removeEventListener('beforeunload', handleBeforeUnload); // Limpieza de memoria
  }, [isDirty]); // Dependencia del efecto en el estado isDirty

  // CONSTRUYE EL OBJETO COMPLETO Y SERIALIZABLE DEL PROYECTO
  const getProjectPayload = useCallback((): ProjectDataPayload => { // Función memoizada para obtener el payload
    const now = new Date().toISOString(); // Obtiene la fecha y hora actual en formato ISO 8601
    if (typeof currentData === 'object' && currentData !== null && !Array.isArray(currentData)) { // Si currentData ya es un objeto de estado completo
      return {
        version: currentData.version || '1.0.0', // Mantiene la versión existente o asigna 1.0.0
        projectName: projectName || 'Proyecto Sin Título', // Inyecta el nombre actual del proyecto
        lastModified: now, // Actualiza la fecha de modificación
        timestamp: currentData.timestamp || now, // Preserva la fecha original o asigna la actual
        id: projectId, // Incluye el ID único del proyecto
        ...currentData // Copia el resto de las propiedades del proyecto
      };
    } // Fin del bloque objeto
    // Si currentData es un arreglo de elementos o rutas vectoriales
    return {
      version: '1.0.0', // Versión 1.0.0 por defecto
      projectName: projectName || 'Proyecto Sin Título', // Nombre del proyecto
      lastModified: now, // Fecha de modificación
      timestamp: now, // Fecha de guardado
      id: projectId, // Identificador del proyecto
      paths: Array.isArray(currentData) ? currentData : [] // Almacena el arreglo de elementos
    };
  }, [projectName, projectId, currentData]); // Dependencias del callback

  // FUNCIÓN PARA VERIFICAR Y SOLICITAR PERMISOS DE LECTURA/ESCRITURA EN UN FILEHANDLE EXISTENTE
  const verifyPermission = async (handle: any, readWrite: boolean): Promise<boolean> => { // Función asíncrona de comprobación de permisos
    const options: any = {}; // Objeto de opciones de permiso
    if (readWrite) { // Si requiere permisos de lectura y escritura
      options.mode = 'readwrite'; // Establece el modo a 'readwrite'
    } // Fin del condicional
    try {
      // Consulta si el permiso ya fue otorgado previamente en esta sesión
      if ((await handle.queryPermission(options)) === 'granted') { // Si la consulta retorna 'granted'
        return true; // Retorna verdadero (permiso concedido)
      } // Fin de consulta
      // Si no ha sido concedido, solicita explícitamente el permiso al usuario mediante diálogo nativo
      if ((await handle.requestPermission(options)) === 'granted') { // Si la solicitud retorna 'granted'
        return true; // Retorna verdadero (permiso otorgado)
      } // Fin de solicitud
    } catch (err) { // Captura posibles errores de permisos o políticas de seguridad
      console.warn('Error al verificar permisos del archivo de disco:', err); // Imprime advertencia en consola
    } // Fin de try-catch
    return false; // Retorna falso si los permisos fueron denegados
  }; // Fin de verifyPermission

  // 1. MANEJADOR PARA CREAR UN NUEVO PROYECTO EN LIENZO LIMPIO
  const handleNew = () => { // Inicializa proyecto en blanco
    // VALIDA SI HAY CAMBIOS PENDIENTES Y PIDE CONFIRMACIÓN EXPLÍCITA AL USUARIO
    if (isDirty && !window.confirm('Tienes cambios sin guardar en el proyecto actual. ¿Deseas descartarlos y crear un proyecto nuevo?')) {
      return; // Si el usuario cancela, detiene la ejecución
    } // Fin de validación
    // RESTABLECE EL NOMBRE DEL PROYECTO AL VALOR PREPOBLADO
    setProjectName('Proyecto Sin Título'); // Nombre por defecto
    // DESCONECTA EL IDENTIFICADOR DEL PROYECTO
    setProjectId(null); // Limpia projectId
    // DESCONECTA EL FILEHANDLE DEL ARCHIVO LOCAL
    setFileHandle(null); // Limpia la referencia al archivo de disco
    // MARCA EL ESTADO DE CAMBIOS PENDIENTES COMO FALSO
    setIsDirty(false); // Marca el proyecto como no modificado
    // EJECUTA LA LIMPIEZA O RESTABLECIMIENTO DE DATOS EN LA APLICACIÓN
    onLoadData([]); // Notifica a la app para limpiar el lienzo
  }; // Fin de handleNew

  // 2. MANEJADOR PARA ABRIR UN PROYECTO DESDE DISCO LOCAL (SHOWOPENFILEPICKER CON FALLBACK)
  const handleOpen = async () => { // Abre selector nativo de archivos
    // MUESTRA ADVERTENCIA DE SEGURIDAD SI HAY CAMBIOS SIN GUARDAR
    if (isDirty && !window.confirm('Tienes cambios sin guardar en el proyecto activo. ¿Deseas descartarlos para abrir otro proyecto?')) {
      return; // Si el usuario cancela, interrumpe la apertura
    } // Fin de comprobación

    // INTENTO 1: USAR FILE SYSTEM ACCESS API NATIVA (SHOWOPENFILEPICKER)
    if ('showOpenFilePicker' in window) { // Verifica si el navegador soporta File System Access API
      try { // Intenta ejecutar la apertura nativa
        // INVOCA EL SELECTOR NATIVO DE ARCHIVOS DEL NAVEGADOR
        const [handle] = await (window as any).showOpenFilePicker({ // Llama a showOpenFilePicker
          // FILTRA PARA PERMITIR ÚNICAMENTE ARCHIVOS JSON DE PROYECTO
          types: [{ description: 'Archivo de Proyecto JSON (*.json)', accept: { 'application/json': ['.json'] } }], // Filtro JSON
          multiple: false // Permite seleccionar solo un archivo a la vez
        }); // Recibe la tupla con el FileSystemFileHandle
        // OBTIENE EL OBJETO FILE CORRESPONDIENTE AL HANDLE
        const file = await handle.getFile(); // Pide el archivo físico
        // LEE EL CONTENIDO COMPLETO DEL ARCHIVO EN TEXTO
        const content = await file.text(); // Convierte el contenido a texto
        // PARSEA EL CONTENIDO A ESTRUCTURA JAVASCRIPT
        const data = JSON.parse(content); // Convierte la cadena JSON en objeto

        // EXTRAE LOS ELEMENTOS O DATOS DEL PROYECTO
        const loadedData = Array.isArray(data) ? data : (data.paths || data); // Extrae la carga útil
        onLoadData(data); // Inyecta la estructura completa al estado de la aplicación

        // GUARDA LA VINCULACIÓN DIRECTA AL ARCHIVO DE DISCO EN EL ESTADO (FILEHANDLE)
        setFileHandle(handle); // Establece la referencia FileSystemFileHandle para sobreescrituras in-place

        // ESTABLECE EL ID DEL PROYECTO SI VIENE EN EL PAYLOAD O GENERA UNO
        if (data && data.id) { // Si el JSON trae un ID
          setProjectId(data.id); // Asigna el ID del proyecto
        } else { // Si no viene ID
          setProjectId(`proj_${Date.now()}`); // Genera un ID basado en timestamp
        } // Fin de ID

        // DERIVA Y ACTUALIZA EL NOMBRE DEL PROYECTO
        const cleanName = file.name.replace(/\.json$/i, ''); // Limpia la extensión .json
        setProjectName(data?.projectName || cleanName); // Usa el nombre guardado en JSON o el nombre del archivo

        // RESTABLECE EL ESTADO DE MODIFICACIÓN A GUARDADO
        setIsDirty(false); // Marca como no modificado (limpio)
        return; // Finaliza con éxito la apertura
      } catch (err: any) { // Captura cancelaciones o restricciones de iframe
        if (err.name === 'AbortError') return; // Si el usuario canceló explícitamente, sale en silencio
        console.warn('showOpenFilePicker no está disponible en este entorno iframe o falló. Usando selector fallback:', err); // Log
      } // Fin de try-catch
    } // Fin del chequeo de showOpenFilePicker

    // INTENTO 2 (FALLBACK GARANTIZADO): SELECTOR CON <input type="file"> NATIVO
    const input = document.createElement('input'); // Crea un elemento input dinámicamente
    input.type = 'file'; // Establece el tipo a archivo
    input.accept = '.json,application/json'; // Filtra extensiones .json
    input.onchange = async (e: any) => { // Registra el manejador de selección de archivo
      const file = e.target.files?.[0]; // Toma el primer archivo seleccionado
      if (!file) return; // Si no hay archivo, se detiene
      try { // Intenta la lectura y parseo
        const text = await file.text(); // Lee el texto completo
        const data = JSON.parse(text); // Convierte a objeto JSON
        onLoadData(data); // Inyecta los datos a la app
        setFileHandle(null); // Limpia el fileHandle ya que input file no permite sobreescritura nativa directa
        const cleanName = file.name.replace(/\.json$/i, ''); // Deriva el nombre del archivo
        setProjectName(data?.projectName || cleanName); // Actualiza el nombre del proyecto
        setProjectId(data?.id || `proj_${Date.now()}`); // Actualiza o asigna ID
        setIsDirty(false); // Marca como no modificado
      } catch (err) { // Captura fallos de lectura o JSON corrupto
        console.error('Error al leer o parsear el archivo JSON:', err); // Log de error
        alert('El archivo seleccionado no contiene un formato JSON válido.'); // Alerta visual
      } // Fin de try-catch fallback
    }; // Fin de onchange
    input.click(); // Invoca el cuadro de selección de archivos del sistema
  }; // Fin de handleOpen

  // 3. MANEJADOR PARA GUARDAR COMO (SAVE AS) CON SELECTOR DE ARCHIVO O DESCARGA BLOB
  const handleSaveAs = async () => { // Función para guardar en un nuevo archivo
    // OBTIENE EL PAYLOAD COMPLETO ACTUALIZADO DEL PROYECTO
    const payload = getProjectPayload(); // Obtiene el objeto estructurado
    // ASEGURA QUE EL PROYECTO TENGA UN ID ASIGNADO
    const activeProjectId = projectId || `proj_${Date.now()}`; // Usa el ID activo o crea uno nuevo
    payload.id = activeProjectId; // Inyecta el ID en el payload
    setProjectId(activeProjectId); // Guarda el ID en el estado

    // INTENTO 1: USAR SHOWSAVEFILEPICKER PARA ELEGIR UBICACIÓN Y CREAR EL ARCHIVO NATIVO
    if ('showSaveFilePicker' in window) { // Si el navegador soporta showSaveFilePicker
      try { // Intenta la creación interactiva
        // ABRE EL DIÁLOGO NATIVO DE GUARDAR COMO
        const handle = await (window as any).showSaveFilePicker({ // Invoca showSaveFilePicker
          suggestedName: `${projectName.toLowerCase().replace(/\s+/g, '_')}_proyecto.json`, // Nombre sugerido limpio
          types: [{ description: 'Archivo de Proyecto JSON (*.json)', accept: { 'application/json': ['.json'] } }] // Filtro
        }); // Obtiene la nueva referencia FileSystemFileHandle
        
        // CREA UN STREAM DE ESCRITURA MODIFICABLE
        const writable = await handle.createWritable(); // Pide el stream de escritura
        // ESCRITA LA ESTRUCTURA DE DATOS SERIALIZADA EN DISCO
        await writable.write(JSON.stringify(payload, null, 2)); // Escribe la cadena JSON formateada
        // CIERRA Y CONFIRMA LA ESCRITURA EN DISCO
        await writable.close(); // Confirma el guardado físico en el archivo

        // ESTABLECE LA NUEVA REFERENCIA DE ARCHIVO COMO LA ACTIVA PARA FUTUROS GUARDADOS SILENCIOSOS
        setFileHandle(handle); // Guarda la referencia en el estado
        // EXTRAE Y ACTUALIZA EL NOMBRE DEL PROYECTO SEGÚN EL ARCHIVO CREADO
        const cleanName = handle.name.replace(/\.json$/i, ''); // Limpia la extensión
        setProjectName(cleanName); // Asigna el nuevo nombre
        payload.projectName = cleanName; // Actualiza el payload

        // MARCA EL PROYECTO COMO TOTALMENTE GUARDADO (DIRTY = FALSE)
        setIsDirty(false); // Restablece el indicador de cambios no guardados

        // RESPALDO SECUNDARIO EN LOCALSTORAGE PARA SEGURIDAD DUAL
        try { localStorage.setItem('argentina_project_backup', JSON.stringify(payload)); } catch (e) {} // Respaldar

        // SINCRONIZA SIMULTÁNEAMENTE CON LA BASE DE DATOS Y DASHBOARD DE LA APP SI EXISTE CALLBACK
        if (onSaveToDatabase) { // Si se proporcionó la función de sincronización
          onSaveToDatabase({ id: activeProjectId, name: cleanName, payload }); // Notifica al Dashboard
        } // Fin de sincronización

        return; // Finaliza con éxito
      } catch (err: any) { // Captura si el usuario cancela o si el iframe bloquea showSaveFilePicker
        if (err.name === 'AbortError') return; // Si fue una cancelación voluntaria, interrumpe sin error
        console.warn('showSaveFilePicker bloqueado por iframe sandbox o falló. Usando descarga por Blob:', err); // Log
      } // Fin de try-catch
    } // Fin del chequeo de showSaveFilePicker

    // INTENTO 2 (FALLBACK GARANTIZADO PARA IFRAMES): DESCARGA DE ARCHIVO MEDIANTE BLOB
    downloadBlob(payload, `${projectName.toLowerCase().replace(/\s+/g, '_')}_proyecto.json`); // Ejecuta la descarga directa
    setIsDirty(false); // Marca el proyecto como guardado

    // RESPALDO EN LOCALSTORAGE
    try { localStorage.setItem('argentina_project_backup', JSON.stringify(payload)); } catch (e) {} // Respaldar

    // SINCRONIZA CON EL DASHBOARD Y LA BD DE LA APLICACIÓN
    if (onSaveToDatabase) { // Si existe el callback
      onSaveToDatabase({ id: activeProjectId, name: projectName, payload }); // Sincroniza los datos
    } // Fin de sincronización
  }; // Fin de handleSaveAs

  // 4. MANEJADOR PARA GUARDAR (SAVE IN-PLACE OVERWRITE) SILENCIOSAMENTE EN EL ARCHIVO EXISTENTE
  const handleSave = async () => { // Función de guardado directo sobre el archivo de disco
    // SI NO EXISTE UN ARCHIVO VINCULADO PREVIAMENTE EN DISCO (FILEHANDLE ES NULL), EJECUTA GUARDAR COMO
    if (!fileHandle) { // Si no hay referencia al archivo en disco
      await handleSaveAs(); // Redirige a la rutina de Guardar Como
      return; // Finaliza la ejecución
    } // Fin de verificación de fileHandle

    try {
      // VERIFICA Y SOLICITA PERMISOS DE ESCRITURA SOBRE EL ARCHIVO EXISTENTE EN DISCO
      const hasPermission = await verifyPermission(fileHandle, true); // Comprueba el modo readwrite
      if (!hasPermission) { // Si los permisos fueron denegados por el usuario
        console.warn('Permisos de escritura denegados sobre el archivo. Ejecutando Guardar Como...'); // Log
        await handleSaveAs(); // Fallback a Guardar Como para elegir nuevo destino
        return; // Finaliza
      } // Fin de verificación de permisos

      // OBTIENE EL PAYLOAD ACTUALIZADO DEL PROYECTO
      const payload = getProjectPayload(); // Prepara los datos actualizados
      payload.id = projectId || payload.id || `proj_${Date.now()}`; // Asegura un ID válido

      // CREA EL STREAM DE ESCRITURA Y SOBREESCRIBE EL MISMO ARCHIVO EN DISCO SILENCIOSAMENTE (SIN DIÁLOGOS DE SELECCIÓN)
      const writable = await fileHandle.createWritable(); // Abre stream de escritura in-place
      await writable.write(JSON.stringify(payload, null, 2)); // Escribe el JSON sobreescribiendo el contenido previo
      await writable.close(); // Cierra el stream y confirma los cambios físicamente en el disco local

      // RESTABLECE EL INDICADOR DE CAMBIOS NO GUARDADOS A FALSE (GUARDADO COMPLETO)
      setIsDirty(false); // El proyecto ahora está sincronizado con el disco

      // RESPALDO SECUNDARIO EN LOCALSTORAGE
      try { localStorage.setItem('argentina_project_backup', JSON.stringify(payload)); } catch (e) {} // Respaldar

      // SINCRONIZA SIMULTÁNEAMENTE CON LA LISTA DE PROYECTOS / DASHBOARD DE LA APLICACIÓN
      if (onSaveToDatabase) { // Si el callback de base de datos está disponible
        onSaveToDatabase({ id: payload.id, name: projectName, payload }); // Actualiza la tarjeta en tiempo real
      } // Fin de sincronización
    } catch (err) { // Si ocurre cualquier error en la sobreescritura (archivo movido, borrado o bloqueado)
      console.error('Error al sobrescribir directamente el archivo en disco. Redirigiendo a Guardar Como...', err); // Log
      await handleSaveAs(); // Ejecuta Guardar Como como mecanismo de resguardo (fallback)
    } // Fin de try-catch
  }; // Fin de handleSave

  // 5. MANEJADOR PARA CERRAR EL PROYECTO ACTIVO Y VOLVER AL ESTADO INICIAL
  const handleClose = () => { // Función para cerrar el proyecto
    // VERIFICA CAMBIOS PENDIENTES DE GUARDAR Y SOLICITA CONFIRMACIÓN DE ADVERTENCIA
    if (isDirty && !window.confirm('Tienes cambios sin guardar en el proyecto actual. ¿Seguro que deseas cerrarlo y volver al inicio?')) {
      return; // Si el usuario cancela, detiene la operación
    } // Fin de verificación de isDirty
    // RESTABLECE EL NOMBRE DEL PROYECTO AL VALOR INICIAL
    setProjectName('Proyecto Sin Título'); // Restablece el título
    // DESCONECTA EL IDENTIFICADOR DEL PROYECTO
    setProjectId(null); // Limpia projectId
    // DESCONECTA LA REFERENCIA AL ARCHIVO DE DISCO
    setFileHandle(null); // Limpia la referencia fileHandle
    // RESTABLECE EL ESTADO DE MODIFICACIÓN A FALSE
    setIsDirty(false); // Limpia el estado dirty
    // NOTIFICA A LA APLICACIÓN PARA RESTABLECER EL LIENZO O ESTADO POR DEFECTO
    onLoadData([]); // Carga un lienzo en blanco
  }; // Fin de handleClose

  // RETORNO DE TODOS LOS ESTADOS, REFERENCIAS Y MANEJADORES DEL HOOK PARA SU USO EN LA APLICACIÓN
  return {
    projectName, // Nombre actual editable del proyecto
    setProjectName, // Función para actualizar el nombre del proyecto
    projectId, // Identificador único del proyecto en la base de datos o estado
    setProjectId, // Función para actualizar el identificador del proyecto
    isDirty, // Indicador booleano de modificaciones pendientes de guardar
    setIsDirty, // Función para marcar o desmarcar el estado dirty
    fileHandle, // Referencia activa al archivo FileSystemFileHandle de disco
    handleNew, // Manejador para crear un nuevo proyecto limpio
    handleOpen, // Manejador para abrir un proyecto desde archivo local JSON
    handleSave, // Manejador para guardar in-place sobre el archivo activo sin diálogos
    handleSaveAs, // Manejador para exportar o Guardar Como en un nuevo archivo
    handleClose // Manejador para cerrar el proyecto activo y limpiar el lienzo
  }; // Fin del objeto retornado por useProjectManager
}; // Fin de export const useProjectManager
