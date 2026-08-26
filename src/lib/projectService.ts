// ============================================================================
// SERVICIO UNIVERSAL DE GESTIÓN Y PERSISTENCIA DE PROYECTOS
// ============================================================================
// Proporciona soporte integral para guardar, actualizar in-place y abrir proyectos en:
// 1. Base de Datos (Cloud SQL / Backend API)
// 2. Google Drive / Unidades en la Nube
// 3. Disco Local Físico / Virtual (File System Access API con sobreescritura directa)
// ============================================================================

import { ProvinceData } from '../types.ts'; // Importa la definición de tipos de datos provinciales
import { idbSaveProject, idbGetAllProjects, idbDeleteProject } from './storage.ts'; // Métodos de almacenamiento seguro IndexedDB

// Helper para normalizar el nombre del proyecto garantizando siempre un string primitivo limpio
export function normalizeProjectName(projectName: any, fallback: string = 'Proyecto de Mapa'): string {
  if (typeof projectName === 'string') {
    const trimmed = projectName.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (projectName && typeof projectName === 'object') {
    if (typeof projectName.name === 'string' && projectName.name.trim()) {
      return projectName.name.trim();
    }
    if (typeof projectName.projectName === 'string' && projectName.projectName.trim()) {
      return projectName.projectName.trim();
    }
    if (projectName.target && typeof projectName.target.value === 'string' && projectName.target.value.trim()) {
      return projectName.target.value.trim();
    }
  }
  return fallback;
}

// Interfaz para la definición de los datos completos del proyecto de mapa
export interface ProjectPayload { // Estructura JSON serializable del proyecto
  version: string; // Versión del esquema del proyecto (ej: "2.1.0")
  timestamp: string; // Marca de tiempo ISO del guardado
  name: string; // Nombre amigable del proyecto
  activeLevel: string; // Nivel territorial activo ('world' | 'continent' | 'country' | 'province')
  selectedProvinceId: string | null; // ID de la provincia seleccionada
  selectedSubdivisionId: string | null; // ID de la subdivisión seleccionada
  provincesData: Record<string, ProvinceData>; // Diccionario completo de provincias y territorios
  navPath?: Array<{ id: string; name: string; type?: string; level?: string }>; // Historial de navegación jerárquica
  appTreeNodes?: any[]; // Nodos del árbol jerárquico personalizado
  metadata?: Record<string, any>; // Metadatos adicionales (autor, etiquetas, notas)
}

// Interfaz de un registro de proyecto guardado en Base de Datos
export interface SavedProjectRecord { // Estructura de proyecto en BD
  id: string; // Identificador único del proyecto
  name: string; // Nombre del proyecto
  description?: string; // Descripción del proyecto
  category?: string; // Categoría del proyecto
  activeLevel?: string; // Nivel activo
  payload: ProjectPayload; // Carga útil con los datos
  isPublic?: boolean; // Visibilidad
  createdAt: string; // Fecha de creación
  updatedAt: string; // Fecha de última actualización
}

// ============================================================================
// 1. PERSISTENCIA EN BASE DE DATOS (Cloud SQL & API REST + IndexedDB)
// ============================================================================

// Guarda o actualiza in-place un proyecto en la base de datos backend y en IndexedDB local
export async function saveProjectToDatabase( // Función para guardar en BD
  projectId: string | null, // ID del proyecto (si existe actualiza in-place con PUT, si no crea con POST)
  projectName: any, // Nombre del proyecto (acepta string u objeto y lo normaliza)
  payload: ProjectPayload, // Datos completos del proyecto
  description: string = '', // Descripción opcional
  category: string = 'cartografia' // Categoría
): Promise<{ success: boolean; id: string; name: string; updatedAt: string }> { // Retorna resultado
  const cleanName = normalizeProjectName(projectName, 'Proyecto de Mapa'); // Limpia y normaliza el nombre
  const idToUse = projectId || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`; // Genera ID si es nuevo
  const timestamp = new Date().toISOString();

  // Asegura que el payload tenga el nombre limpio
  payload.name = cleanName;

  const recordToStore: SavedProjectRecord = {
    id: idToUse,
    name: cleanName,
    description,
    category,
    activeLevel: payload.activeLevel || 'country',
    payload,
    isPublic: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  // 1. Guardar en IndexedDB local permanente (sin límite de tamaño)
  try {
    await idbSaveProject(recordToStore);
  } catch (e) {
    console.warn('[Storage] Advertencia al persistir en IndexedDB:', e);
  }

  // 2. Guardar un índice ligero en localStorage (sólo metadatos, sin saturar la cuota de 5MB)
  try {
    const localIndexKey = 'indexed_local_projects';
    const existingIndexStr = localStorage.getItem(localIndexKey);
    let existingIndex: any[] = existingIndexStr ? JSON.parse(existingIndexStr) : [];
    
    // Guardamos una versión ligera para el listado rápido
    const lightRecord = {
      id: idToUse,
      name: cleanName,
      description,
      category,
      activeLevel: payload.activeLevel || 'country',
      isPublic: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const existingIdx = existingIndex.findIndex(p => p.id === idToUse);
    if (existingIdx >= 0) {
      existingIndex[existingIdx] = lightRecord;
    } else {
      existingIndex.unshift(lightRecord);
    }
    localStorage.setItem(localIndexKey, JSON.stringify(existingIndex.slice(0, 30)));
  } catch (e) {
    // Si localStorage está restringido, no bloquea la app gracias a IndexedDB
  }

  // 3. Intentar guardar en backend / Cloud SQL
  try {
    if (projectId) {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          description,
          category,
          activeLevel: payload.activeLevel || 'country',
          payload,
          isPublic: true
        })
      });

      if (!response.ok) {
        console.warn(`Aviso de servidor al actualizar en BD (HTTP ${response.status}). El proyecto se guardó en almacenamiento local seguro.`);
      } else {
        const data = await response.json();
        return { success: true, id: projectId, name: cleanName, updatedAt: data.updatedAt || timestamp };
      }
    } else {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: idToUse,
          name: cleanName,
          description,
          category,
          activeLevel: payload.activeLevel || 'country',
          payload,
          isPublic: true
        })
      });

      if (!response.ok) {
        console.warn(`Aviso de servidor al crear en BD (HTTP ${response.status}). El proyecto se guardó en almacenamiento local seguro.`);
      } else {
        const data = await response.json();
        return { success: true, id: data.id || idToUse, name: cleanName, updatedAt: data.updatedAt || timestamp };
      }
    }

    return { success: true, id: idToUse, name: cleanName, updatedAt: timestamp };
  } catch (error: any) {
    console.warn('Servidor no disponible, usando respaldo persistente local en IndexedDB:', error);
    return { success: true, id: idToUse, name: cleanName, updatedAt: timestamp };
  }
}

// Obtiene todos los proyectos guardados en la base de datos (y combina con IndexedDB)
export async function fetchProjectsFromDatabase(): Promise<SavedProjectRecord[]> {
  const combinedMap = new Map<string, SavedProjectRecord>();

  // 1. Cargar proyectos locales desde IndexedDB
  try {
    const idbProjects = await idbGetAllProjects();
    if (Array.isArray(idbProjects)) {
      idbProjects.forEach(p => {
        if (p && p.id) combinedMap.set(p.id, p);
      });
    }
  } catch (e) {
    console.warn('[IDB] Error al leer proyectos locales:', e);
  }

  // 2. Cargar desde la API de backend / Cloud SQL
  try {
    const response = await fetch('/api/projects');
    if (response.ok) {
      const serverList = await response.json();
      if (Array.isArray(serverList)) {
        serverList.forEach(p => {
          if (p && p.id) combinedMap.set(p.id, p);
        });
      }
    }
  } catch (error) {
    console.warn('Error al conectar con la API de proyectos, sirviendo proyectos de IndexedDB:', error);
  }

  return Array.from(combinedMap.values());
}

// Obtiene un proyecto específico por su ID desde la base de datos o IndexedDB
export async function fetchProjectById(id: string): Promise<SavedProjectRecord | null> {
  // Primero intenta desde backend
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {}

  // Fallback a IndexedDB
  try {
    const all = await idbGetAllProjects();
    const found = all.find(p => p.id === id);
    if (found) return found;
  } catch (e) {}

  return null;
}

// Elimina un proyecto de la base de datos e IndexedDB
export async function deleteProjectFromDatabase(id: string): Promise<boolean> {
  // Elimina de IndexedDB
  try {
    await idbDeleteProject(id);
  } catch (e) {}

  // Elimina de lista en localStorage
  try {
    const localIndexKey = 'indexed_local_projects';
    const existingIndexStr = localStorage.getItem(localIndexKey);
    if (existingIndexStr) {
      const existingIndex: any[] = JSON.parse(existingIndexStr);
      const filtered = existingIndex.filter(p => p.id !== id);
      localStorage.setItem(localIndexKey, JSON.stringify(filtered));
    }
  } catch (e) {}

  // Elimina en backend
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    return true; // Éxito local
  }
}

// ============================================================================
// 2. PERSISTENCIA EN GOOGLE DRIVE (Actualización in-place con API v3)
// ============================================================================

// Guarda o actualiza in-place un proyecto en Google Drive
export async function saveProjectToGoogleDrive( // Función para guardar en Drive
  projectName: any, // Nombre del archivo en Drive
  payload: ProjectPayload, // Datos del proyecto
  existingDriveFileId: string | null = null // ID del archivo si ya existe en Drive para sobreescritura
): Promise<{ success: boolean; driveFileId: string; webViewLink?: string }> { // Retorna resultado
  // Busca el token de OAuth en localStorage, sessionStorage o memoria global
  const token = localStorage.getItem('gdrive_access_token') || 
                sessionStorage.getItem('gdrive_access_token') || 
                (window as any).__GOOGLE_WORKSPACE_ACCESS_TOKEN__ || ''; // Extrae token disponible

  if (!token) { // Si no hay token de Google
    throw new Error('No se encontró sesión activa de Google Workspace. Por favor, conecte su cuenta de Google en la pestaña de Google Drive.'); // Lanza mensaje claro
  }

  const safeName = normalizeProjectName(projectName, 'Proyecto de Mapa');
  const cleanName = safeName.endsWith('.json') ? safeName : `${safeName}.json`; // Asegura extensión .json
  const fileContent = JSON.stringify(payload, null, 2); // Serializa el JSON formateado

  try { // Bloque try
    if (existingDriveFileId) { // Si el archivo ya existía en Drive, actualizamos IN-PLACE su contenido
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingDriveFileId}?uploadType=media`; // URL de actualización de contenido
      const updateResponse = await fetch(uploadUrl, { // Petición PATCH
        method: 'PATCH', // Método PATCH para sobreescribir el contenido existente
        headers: { // Encabezados
          'Authorization': `Bearer ${token}`, // Token Bearer
          'Content-Type': 'application/json' // Tipo de contenido
        },
        body: fileContent // Nuevo contenido del archivo
      });

      if (!updateResponse.ok) { // Si falló la actualización directa
        const errText = await updateResponse.text();
        throw new Error(`Error al actualizar archivo en Google Drive (HTTP ${updateResponse.status}): ${errText}`); // Lanza error
      }

      // Actualizamos también el nombre por si el usuario lo renombró y solicitamos enlace
      let webViewLink: string | undefined;
      try {
        const metaResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${existingDriveFileId}?fields=id,name,webViewLink`, { // Petición PATCH metadata
          method: 'PATCH', // Método PATCH
          headers: { // Encabezados
            'Authorization': `Bearer ${token}`, // Token de autorización
            'Content-Type': 'application/json' // Encabezado JSON
          },
          body: JSON.stringify({ name: cleanName }) // Nombre nuevo
        });
        if (metaResponse.ok) {
          const metaJson = await metaResponse.json();
          webViewLink = metaJson.webViewLink;
        }
      } catch (e) {
        console.warn('Advertencia al actualizar metadatos en Drive:', e);
      }

      return { success: true, driveFileId: existingDriveFileId, webViewLink }; // Retorna éxito con el mismo ID
    } else { // Si es un nuevo archivo en Drive
      const metadata = { // Metadatos del nuevo archivo
        name: cleanName, // Nombre del archivo
        mimeType: 'application/json', // Tipo MIME
        description: 'Proyecto de Mapa e Indicadores Federales' // Descripción
      };

      // Construye cuerpo multipart para crear el archivo y su contenido en una sola llamada
      const boundary = '-------314159265358979323846'; // Delimitador multipart
      const delimiter = `\r\n--${boundary}\r\n`; // Delimitador de bloque
      const closeDelimiter = `\r\n--${boundary}--`; // Delimitador de cierre

      const multipartRequestBody = // Cuerpo de la petición multipart
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        closeDelimiter;

      const createResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', { // Petición POST multipart
        method: 'POST', // Método POST
        headers: { // Encabezados
          'Authorization': `Bearer ${token}`, // Token
          'Content-Type': `multipart/related; boundary=${boundary}` // Encabezado multipart
        },
        body: multipartRequestBody // Cuerpo multipart
      });

      if (!createResponse.ok) { // Si falló la creación
        const errText = await createResponse.text(); // Lee error
        throw new Error(`Error al crear archivo en Google Drive (HTTP ${createResponse.status}): ${errText}`); // Lanza excepción
      }

      const result = await createResponse.json(); // Parsea respuesta JSON
      return { // Retorna resultado
        success: true, // Éxito
        driveFileId: result.id, // ID asignado por Google Drive
        webViewLink: result.webViewLink // Enlace de visualización
      };
    }
  } catch (err: any) { // Error
    console.error('Error en servicio de Google Drive:', err); // Log
    throw err; // Propaga error
  }
}

// Interfaz para la representación de un archivo de proyecto en Google Drive
export interface DriveProjectRecord {
  id: string; // ID del archivo en Google Drive
  name: string; // Nombre del archivo (ej: "Mapa_Economico.json")
  modifiedTime: string; // Fecha y hora de última modificación en Drive
  size?: string; // Tamaño en bytes
  description?: string; // Descripción opcional
  webViewLink?: string; // Enlace directo a Google Drive en la web
}

// Obtiene la lista de proyectos en formato JSON guardados en la unidad de Google Drive
export async function fetchProjectsFromGoogleDrive(customToken?: string): Promise<DriveProjectRecord[]> {
  const token = customToken || 
                localStorage.getItem('gdrive_access_token') || 
                sessionStorage.getItem('gdrive_access_token') || 
                (window as any).__GOOGLE_WORKSPACE_ACCESS_TOKEN__ || '';

  if (!token) {
    throw new Error('No hay sesión de Google Workspace activa.');
  }

  try {
    // Consulta los archivos JSON en Drive ordenados por fecha de modificación descendente
    const q = encodeURIComponent("mimeType = 'application/json' or name contains '.json'");
    const fields = encodeURIComponent('files(id, name, modifiedTime, size, description, webViewLink)');
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=50`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}: Error al consultar Google Drive`);
    }

    const data = await response.json();
    return Array.isArray(data.files) ? data.files : [];
  } catch (err: any) {
    console.error('Error al listar archivos de Google Drive:', err);
    throw err;
  }
}

// Descarga el contenido completo de un archivo JSON de proyecto desde Google Drive
export async function fetchProjectContentFromGoogleDrive(
  fileId: string, 
  customToken?: string
): Promise<{ payload: ProjectPayload; filename: string; modifiedTime: string }> {
  const token = customToken || 
                localStorage.getItem('gdrive_access_token') || 
                sessionStorage.getItem('gdrive_access_token') || 
                (window as any).__GOOGLE_WORKSPACE_ACCESS_TOKEN__ || '';

  if (!token) {
    throw new Error('No hay sesión de Google Workspace activa.');
  }

  try {
    // 1. Obtiene los metadatos del archivo (nombre y fecha)
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,modifiedTime`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const meta = metaRes.ok ? await metaRes.json() : { name: 'Proyecto de Drive', modifiedTime: new Date().toISOString() };

    // 2. Descarga el contenido directo del archivo JSON
    const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!contentRes.ok) {
      throw new Error(`HTTP ${contentRes.status}: Error al descargar contenido de Google Drive`);
    }

    const payload = await contentRes.json();
    return {
      payload,
      filename: meta.name || 'Proyecto.json',
      modifiedTime: meta.modifiedTime || new Date().toISOString()
    };
  } catch (err: any) {
    console.error('Error al descargar proyecto de Google Drive:', err);
    throw err;
  }
}

// Elimina un archivo de Google Drive
export async function deleteProjectFromGoogleDrive(fileId: string, customToken?: string): Promise<boolean> {
  const token = customToken || 
                localStorage.getItem('gdrive_access_token') || 
                sessionStorage.getItem('gdrive_access_token') || 
                (window as any).__GOOGLE_WORKSPACE_ACCESS_TOKEN__ || '';

  if (!token) return false;

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.ok || res.status === 204;
  } catch (e) {
    console.error('Error al eliminar archivo de Drive:', e);
    return false;
  }
}

// ============================================================================
// 2.1. DETECTOR Y COMPARADOR DE VERSIONES / CONFLICTOS
// ============================================================================

export interface VersionSummary {
  source: string; // Origen (ej: "Memoria Local", "Base de Datos", "Google Drive", "Archivo en Disco")
  name: string; // Nombre del proyecto
  lastModified: string; // Fecha ISO o legible
  version: string; // Versión del esquema
  activeLevel?: string; // Nivel territorial activo
  provincesCount: number; // Cantidad de provincias/subdivisiones registradas
  nodesCount: number; // Cantidad de nodos en el árbol
  timestampDate: Date; // Fecha como objeto Date
}

export interface VersionConflictReport {
  hasConflict: boolean; // Indica si hay discrepancia temporal o de contenido
  localSummary: VersionSummary; // Resumen de la versión local actual
  remoteSummary: VersionSummary; // Resumen de la versión remota o de archivo
  newerSource: 'local' | 'remote' | 'same'; // Cuál es más reciente
  differenceDescription: string; // Descripción amigable de las diferencias
}

// Compara los datos del proyecto local vs los datos remotos/entrantes para detectar conflictos
export function detectProjectVersionConflict(
  localData: any,
  remoteData: any,
  remoteSourceName: string = 'Base de Datos'
): VersionConflictReport {
  const parseTime = (data: any): Date => {
    const raw = data?.metadata?.lastModified || data?.lastModified || data?.timestamp || data?.updatedAt;
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  };

  const localTime = parseTime(localData);
  const remoteTime = parseTime(remoteData);

  const localProvCount = localData?.provincesData ? Object.keys(localData.provincesData).length : 0;
  const remoteProvCount = remoteData?.provincesData ? Object.keys(remoteData.provincesData).length : 0;

  const localNodesCount = Array.isArray(localData?.appTreeNodes) ? localData.appTreeNodes.length : 0;
  const remoteNodesCount = Array.isArray(remoteData?.appTreeNodes) ? remoteData.appTreeNodes.length : 0;

  const localSummary: VersionSummary = {
    source: 'Trabajo Actual (Memoria / Navegador)',
    name: localData?.name || localData?.projectName || 'Proyecto Activo',
    lastModified: localTime.toLocaleString(),
    version: localData?.version || '2.1.0',
    activeLevel: localData?.activeLevel || localData?.activeMapLevel || 'Nacional',
    provincesCount: localProvCount,
    nodesCount: localNodesCount,
    timestampDate: localTime
  };

  const remoteSummary: VersionSummary = {
    source: remoteSourceName,
    name: remoteData?.name || remoteData?.projectName || 'Proyecto Remoto',
    lastModified: remoteTime.toLocaleString(),
    version: remoteData?.version || '2.1.0',
    activeLevel: remoteData?.activeLevel || remoteData?.activeMapLevel || 'Nacional',
    provincesCount: remoteProvCount,
    nodesCount: remoteNodesCount,
    timestampDate: remoteTime
  };

  const timeDiffMs = Math.abs(localTime.getTime() - remoteTime.getTime());
  // Si hay más de 3 segundos de diferencia y contenido distinto
  const hasConflict = timeDiffMs > 3000 || localProvCount !== remoteProvCount || localNodesCount !== remoteNodesCount;

  let newerSource: 'local' | 'remote' | 'same' = 'same';
  if (localTime.getTime() > remoteTime.getTime() + 1000) {
    newerSource = 'local';
  } else if (remoteTime.getTime() > localTime.getTime() + 1000) {
    newerSource = 'remote';
  }

  let differenceDescription = 'Ambas versiones coinciden en marca de tiempo.';
  if (newerSource === 'local') {
    differenceDescription = `La versión local es más reciente (${localSummary.lastModified}) que la versión en ${remoteSourceName} (${remoteSummary.lastModified}).`;
  } else if (newerSource === 'remote') {
    differenceDescription = `La versión en ${remoteSourceName} es más reciente (${remoteSummary.lastModified}) que la versión local (${localSummary.lastModified}).`;
  } else if (hasConflict) {
    differenceDescription = `Existen diferencias en el contenido (Provincias: ${localProvCount} local vs ${remoteProvCount} remoto).`;
  }

  return {
    hasConflict,
    localSummary,
    remoteSummary,
    newerSource,
    differenceDescription
  };
}

// ============================================================================
// 3. PERSISTENCIA EN DISCO LOCAL / FÍSICO (File System Access API & Sobreescritura)
// ============================================================================

// Guarda o actualiza in-place en Disco Local físico
export async function saveProjectToLocalDisk( // Función para guardar en disco
  projectName: any, // Nombre del proyecto
  payload: ProjectPayload, // Datos del proyecto
  existingFileHandle: any = null, // Handle de archivo existente para sobreescritura directa
  forceSaveAs: boolean = false // Si es true, siempre abre el diálogo de selector de archivo
): Promise<{ success: boolean; fileHandle?: any; filename: string }> { // Retorna resultado
  const safeName = normalizeProjectName(projectName, 'Proyecto');
  const fileContent = JSON.stringify(payload, null, 2); // Convierte a cadena JSON formateada
  const defaultFilename = `${safeName.replace(/[\\/:*?"<>|]/g, '_')}.json`; // Nombre seguro

  // 1. Si tenemos un fileHandle existente y NO es "Guardar Como", sobreescribimos DIRECTAMENTE sin diálogos
  if (existingFileHandle && !forceSaveAs && typeof existingFileHandle.createWritable === 'function') { // Si hay handle válido
    try { // Intenta sobreescribir el archivo
      // Verificar permisos si el navegador lo soporta antes de escribir
      if (typeof existingFileHandle.queryPermission === 'function') {
        const perm = await existingFileHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          if (typeof existingFileHandle.requestPermission === 'function') {
            const reqPerm = await existingFileHandle.requestPermission({ mode: 'readwrite' });
            if (reqPerm !== 'granted') {
              throw new Error('Permiso de escritura en disco denegado por el usuario');
            }
          }
        }
      }

      const writable = await existingFileHandle.createWritable(); // Abre stream de escritura
      await writable.write(fileContent); // Escribe los datos completos en el mismo archivo
      await writable.close(); // Cierra el archivo guardado
      return { success: true, fileHandle: existingFileHandle, filename: existingFileHandle.name || defaultFilename }; // Éxito sin duplicados
    } catch (err: any) { // Si el permiso expiró o fue revocado
      if (err.message?.includes('denegado') || err.name === 'AbortError') {
        throw err;
      }
      console.warn('No se pudo escribir en el FileHandle existente, solicitando selector:', err); // Advertencia
    }
  }

  // 2. Si el navegador soporta File System Access API y se requiere un nuevo archivo o Guardar Como
  if (typeof (window as any).showSaveFilePicker === 'function') { // Si la API nativa está disponible
    try { // Intenta abrir el diálogo nativo del sistema operativo
      const fileHandle = await (window as any).showSaveFilePicker({ // Abre selector nativo de guardado
        suggestedName: defaultFilename, // Nombre sugerido
        types: [ // Tipos de archivo permitidos
          {
            description: 'Archivos de Proyecto de Mapa (*.json)', // Descripción del tipo
            accept: { 'application/json': ['.json'] } // Extensión .json
          }
        ]
      }); // Fin de showSaveFilePicker

      const writable = await fileHandle.createWritable(); // Crea el flujo de escritura en el archivo elegido
      await writable.write(fileContent); // Escribe los datos
      await writable.close(); // Cierra el archivo

      return { success: true, fileHandle, filename: fileHandle.name || defaultFilename }; // Retorna el nuevo fileHandle para futuros "Guardar"
    } catch (err: any) { // Si el usuario canceló el selector o hubo restricción de iframe
      if (err.name === 'AbortError') { // Si el usuario canceló el diálogo
        throw new Error('Guardado cancelado por el usuario'); // Cancela limpiamente
      }
      console.warn('File System Access API restringida en este contexto, usando fallback de descarga:', err); // Log
    }
  }

  // 3. Fallback para entornos web estándar / iframes con descarga directa controlada
  // Solo se usa cuando explícitamente se solicita guardar en disco y no hay API nativa
  downloadJsonBlob(fileContent, defaultFilename); // Descarga el archivo JSON
  return { success: true, filename: defaultFilename }; // Retorna confirmación
}

// Utilidad auxiliar para descargar un archivo JSON en el navegador
export function downloadJsonBlob(content: string, filename: string) { // Función de descarga directa
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' }); // Crea el Blob con codificación UTF-8
  const url = URL.createObjectURL(blob); // Genera la URL temporal
  const link = document.createElement('a'); // Crea el elemento ancla
  link.href = url; // Asigna la URL del Blob
  link.download = filename; // Asigna el nombre de archivo
  document.body.appendChild(link); // Inserta en el DOM
  link.click(); // Dispara la descarga
  document.body.removeChild(link); // Remueve el elemento del DOM
  URL.revokeObjectURL(url); // Libera la URL de memoria
}
