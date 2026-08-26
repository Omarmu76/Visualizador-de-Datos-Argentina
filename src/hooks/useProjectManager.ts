// ============================================================================
// HOOK PERSONALIZADO: GESTOR UNIVERSAL DE CICLO DE VIDA DE PROYECTOS
// ============================================================================
// Administra el ciclo completo de proyectos con soporte de persistencia unificada:
// 1. Base de Datos (Cloud SQL / Backend REST API)
// 2. Google Drive / Hosting en la Nube
// 3. Disco Local / Físico (File System Access API in-place y exportación)
// ============================================================================

import { useState, useCallback, useEffect } from 'react'; // Hooks de React
import { 
  saveProjectToDatabase, 
  saveProjectToGoogleDrive, 
  saveProjectToLocalDisk,
  fetchProjectsFromDatabase,
  fetchProjectById,
  deleteProjectFromDatabase,
  ProjectPayload,
  SavedProjectRecord
} from '../lib/projectService.ts'; // Importa los servicios unificados de guardado y BD

// Interfaz para la definición de la carga útil del proyecto
export interface ProjectDataPayload {
  version: string; // Versión del esquema del proyecto (ej. "2.1.0")
  projectName: string; // Nombre amigable del proyecto
  lastModified: string; // Fecha y hora ISO de última modificación
  timestamp?: string; // Fecha de creación
  id?: string | null; // ID del proyecto en BD
  activeMapLevel?: string; // Nivel de mapa activo
  selectedProvinceId?: string | null; // ID de provincia seleccionada
  selectedSubdivisionId?: string | null; // ID de subdivisión seleccionada
  selectedMetric?: string; // Métrica activa
  navPath?: any[]; // Historial de navegación
  provincesData?: any; // Datos de provincias y municipios
  appTreeNodes?: any[]; // Nodos jerárquicos
  paths?: any[]; // Trazados vectoriales
  metadata?: any; // Metadatos extra
}

// Hook principal useProjectManager
export const useProjectManager = (
  currentData: any, // Datos actuales del mapa y proyecto
  onLoadData: (data: any) => void, // Callback para restaurar datos en la app
  onSaveToDatabase?: (project: { id?: string; name: string; payload: any }) => void, // Callback opcional
  currentProjectId?: string | null // ID inicial del proyecto en BD si existe
) => {
  // ESTADO: Nombre amigable y editable del proyecto
  const [projectName, setProjectNameState] = useState<string>('Proyecto Sin Título');
  
  // Setter seguro que acepta strings, eventos o valores nulos sin romper el estado
  const setProjectName = useCallback((val: any) => {
    let clean = 'Proyecto Sin Título';
    if (typeof val === 'string') {
      clean = val;
    } else if (val && typeof val === 'object') {
      if (typeof val.target?.value === 'string') {
        clean = val.target.value;
      } else if (typeof val.name === 'string') {
        clean = val.name;
      } else if (typeof val.projectName === 'string') {
        clean = val.projectName;
      }
    }
    setProjectNameState(clean);
  }, []);
  // ESTADO: Identificador único en la base de datos backend
  const [projectId, setProjectId] = useState<string | null>(currentProjectId || null);
  // ESTADO: Identificador único en Google Drive si ya fue guardado en la nube
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  // ESTADO: Referencia FileSystemFileHandle de la API de disco local
  const [fileHandle, setFileHandle] = useState<any | null>(null);
  // ESTADO: Indicador de cambios pendientes sin guardar (Dirty State)
  const [isDirty, setIsDirty] = useState<boolean>(false);
  // ESTADO: Estado de guardado en proceso
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // ESTADO: Mensaje de retroalimentación de la última operación de guardado
  const [lastSaveStatus, setLastSaveStatus] = useState<{ destination: string; time: string } | null>(null);

  // EFECTO: Previene cierre involuntario de pestaña si hay cambios sin guardar
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // CONSTRUCCIÓN DEL OBJETO PAYLOAD DEL PROYECTO
  const getProjectPayload = useCallback((): ProjectPayload => {
    const now = new Date().toISOString();
    const cleanName = (typeof projectName === 'string' && projectName.trim()) ? projectName.trim() : 'Proyecto Sin Título';
    
    if (typeof currentData === 'object' && currentData !== null && !Array.isArray(currentData)) {
      return {
        version: currentData.version || '2.1.0',
        timestamp: currentData.timestamp || now,
        name: cleanName,
        activeLevel: currentData.activeMapLevel || 'country',
        selectedProvinceId: currentData.selectedProvinceId || null,
        selectedSubdivisionId: currentData.selectedSubdivisionId || null,
        provincesData: currentData.provincesData || {},
        navPath: currentData.navPath || [],
        appTreeNodes: currentData.appTreeNodes || [],
        metadata: {
          lastModified: now,
          selectedMetric: currentData.selectedMetric || 'pobreza',
          projectId: projectId,
          driveFileId: driveFileId
        }
      };
    }
    return {
      version: '2.1.0',
      timestamp: now,
      name: cleanName,
      activeLevel: 'country',
      selectedProvinceId: null,
      selectedSubdivisionId: null,
      provincesData: {},
      metadata: { lastModified: now, projectId: projectId }
    };
  }, [projectName, projectId, driveFileId, currentData]);

  // 1. NUEVO PROYECTO: Limpia el estado y desconecta los vínculos previos
  const handleNew = () => {
    if (isDirty && !window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos e iniciar un proyecto nuevo en blanco?')) {
      return;
    }
    setProjectName('Proyecto Sin Título');
    setProjectId(null);
    setDriveFileId(null);
    setFileHandle(null);
    setIsDirty(false);
    setLastSaveStatus(null);
    onLoadData({
      projectName: 'Proyecto Sin Título',
      provincesData: {},
      navPath: [{ id: 'root', name: 'Inicio' }]
    });
  };

  // 2. GUARDADO EN BASE DE DATOS (Cloud SQL / REST API)
  const handleSaveToDatabase = async (description: string = ''): Promise<boolean> => {
    setIsSaving(true);
    try {
      const payload = getProjectPayload();
      const result = await saveProjectToDatabase(projectId, projectName, payload, description);
      if (result.success) {
        setProjectId(result.id);
        setIsDirty(false);
        setLastSaveStatus({ destination: 'Base de Datos (Cloud SQL)', time: new Date().toLocaleTimeString() });
        if (onSaveToDatabase) {
          onSaveToDatabase({ id: result.id, name: projectName, payload });
        }
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error al guardar en BD:', err);
      alert(`No se pudo guardar en la base de datos: ${err.message || 'Error de conexión'}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // 3. GUARDADO EN GOOGLE DRIVE (Actualización in-place o nuevo archivo)
  const handleSaveToDrive = async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const payload = getProjectPayload();
      const result = await saveProjectToGoogleDrive(projectName, payload, driveFileId);
      if (result.success) {
        setDriveFileId(result.driveFileId);
        setIsDirty(false);
        setLastSaveStatus({ destination: 'Google Drive', time: new Date().toLocaleTimeString() });
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error al guardar en Google Drive:', err);
      throw err; // Propaga el error para que el modal lo muestre en su banner de estado
    } finally {
      setIsSaving(false);
    }
  };

  // 4. GUARDADO EN DISCO LOCAL (File System Access API / Sobreescritura in-place directa)
  const handleSaveToDisk = async (forceSaveAs: boolean = false): Promise<boolean> => {
    setIsSaving(true);
    try {
      const payload = getProjectPayload();
      // Si no es "Guardar Como", pasa el fileHandle existente para sobreescritura silenciosa
      const result = await saveProjectToLocalDisk(projectName, payload, fileHandle, forceSaveAs);
      if (result.success) {
        if (result.fileHandle) {
          setFileHandle(result.fileHandle); // Almacena/actualiza la referencia activa en el estado
        }
        setIsDirty(false);
        setLastSaveStatus({ destination: `Disco Local (${result.filename})`, time: new Date().toLocaleTimeString() });
        return true;
      }
      return false;
    } catch (err: any) {
      if (err.message !== 'Guardado cancelado por el usuario') {
        console.error('Error al guardar en disco local:', err);
        throw err;
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // 5. GUARDAR IN-PLACE (SOBREESCRIBIR EL TRABAJO ACTUAL SIN CREAR COPIAS REPETITIVAS)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = getProjectPayload();
      let savedSomewhere = false;

      // A. Si ya está vinculado a un archivo local con FileHandle -> sobreescribe in-place en disco
      if (fileHandle && typeof fileHandle.createWritable === 'function') {
        try {
          const diskRes = await saveProjectToLocalDisk(projectName, payload, fileHandle, false);
          if (diskRes.success) {
            savedSomewhere = true;
            if (diskRes.fileHandle) setFileHandle(diskRes.fileHandle);
          }
        } catch (e: any) {
          console.warn('Fallo al escribir en handle de disco existente:', e);
        }
      }

      // B. Si está vinculado a Google Drive -> actualiza in-place en Drive
      if (driveFileId) {
        try {
          const driveRes = await saveProjectToGoogleDrive(projectName, payload, driveFileId);
          if (driveRes.success) {
            savedSomewhere = true;
            setDriveFileId(driveRes.driveFileId);
          }
        } catch (e: any) {
          console.warn('Fallo al actualizar en Google Drive:', e);
        }
      }

      // C. Guarda/actualiza SIEMPRE in-place en la Base de Datos (Cloud SQL / backend)
      try {
        const dbResult = await saveProjectToDatabase(projectId, projectName, payload);
        if (dbResult.success) {
          setProjectId(dbResult.id);
          savedSomewhere = true;
        }
      } catch (e) {
        console.warn('Advertencia al guardar en BD backend:', e);
      }

      // D. Si es la primera vez que se guarda y no tiene ni handle ni ID previo en ningún lado:
      if (!savedSomewhere && !projectId && !fileHandle && !driveFileId) {
        const dbResult = await saveProjectToDatabase(null, projectName, payload);
        setProjectId(dbResult.id);
        savedSomewhere = true;
      }

      // Respaldo de seguridad en localStorage
      try {
        localStorage.setItem('argentina_project_backup', JSON.stringify(payload));
        if (projectId) {
          localStorage.setItem('argentina_last_saved_project_id', projectId);
        }
      } catch (e) {}

      setIsDirty(false);
      setLastSaveStatus({ destination: 'Trabajo Actualizado (In-Place)', time: new Date().toLocaleTimeString() });

      if (onSaveToDatabase && projectId) {
        onSaveToDatabase({ id: projectId, name: projectName, payload });
      }
      return true;
    } catch (err: any) {
      console.error('Error en Guardar trabajo actual:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // 6. GUARDAR COMO (CREA NUEVO ARCHIVO/REGISTRO Y CAMBIA EL PROYECTO ACTIVO A ESA COPIA)
  const handleSaveAs = async (newSuggestedName?: string) => {
    const targetName = newSuggestedName || projectName || 'Nuevo Proyecto';
    const payload = getProjectPayload();
    payload.name = targetName;

    // Crea nuevo ID para la nueva versión
    const newProjectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    payload.id = newProjectId;

    // 1. Guarda en BD como nuevo registro
    try {
      await saveProjectToDatabase(newProjectId, targetName, payload);
      setProjectId(newProjectId);
    } catch (e) {}

    // 2. Abre selector de disco para guardar el nuevo archivo físico
    try {
      const diskResult = await saveProjectToLocalDisk(targetName, payload, null, true);
      if (diskResult.fileHandle) {
        setFileHandle(diskResult.fileHandle);
      }
    } catch (e) {}

    setProjectName(targetName);
    setDriveFileId(null); // Desvincula del archivo previo de Drive
    setIsDirty(false);
    setLastSaveStatus({ destination: 'Nueva Copia Guardada', time: new Date().toLocaleTimeString() });
  };

  // 7. ABRIR PROYECTO DESDE DISCO LOCAL (JSON)
  const handleOpen = async () => {
    if (isDirty && !window.confirm('Tienes cambios sin guardar en el proyecto actual. ¿Deseas descartarlos para abrir otro archivo?')) {
      return;
    }

    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'Archivo de Proyecto JSON (*.json)', accept: { 'application/json': ['.json'] } }],
          multiple: false
        });
        const file = await handle.getFile();
        const content = await file.text();
        const data = JSON.parse(content);

        onLoadData(data);
        setFileHandle(handle);
        const cleanName = file.name.replace(/\.json$/i, '');
        setProjectName(data?.name || data?.projectName || cleanName);
        setProjectId(data?.id || data?.metadata?.projectId || null);
        setDriveFileId(data?.metadata?.driveFileId || null);
        setIsDirty(false);
        setLastSaveStatus({ destination: `Abierto: ${file.name}`, time: new Date().toLocaleTimeString() });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('showOpenFilePicker no disponible en iframe. Usando fallback de input file:', err);
      }
    }

    // Fallback con <input type="file">
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        onLoadData(data);
        setFileHandle(null);
        const cleanName = file.name.replace(/\.json$/i, '');
        setProjectName(data?.name || data?.projectName || cleanName);
        setProjectId(data?.id || data?.metadata?.projectId || null);
        setDriveFileId(data?.metadata?.driveFileId || null);
        setIsDirty(false);
        setLastSaveStatus({ destination: `Abierto: ${file.name}`, time: new Date().toLocaleTimeString() });
      } catch (err) {
        console.error('Error al leer archivo JSON:', err);
        alert('El archivo seleccionado no es un JSON de proyecto válido.');
      }
    };
    input.click();
  };

  // 8. CARGAR PROYECTO DIRECTAMENTE DESDE LA BASE DE DATOS
  const handleLoadFromDatabase = async (selectedRecord: SavedProjectRecord) => {
    if (isDirty && !window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos para cargar este proyecto de la BD?')) {
      return;
    }
    const payload = selectedRecord.payload;
    onLoadData(payload);
    setProjectId(selectedRecord.id);
    setProjectName(selectedRecord.name);
    setFileHandle(null);
    setDriveFileId(null);
    setIsDirty(false);
    setLastSaveStatus({ destination: `BD: ${selectedRecord.name}`, time: new Date().toLocaleTimeString() });
  };

  // 8.1 CARGAR PROYECTO DIRECTAMENTE DESDE GOOGLE DRIVE
  const handleLoadFromGoogleDrive = async (fileId: string) => {
    if (isDirty && !window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos para abrir este proyecto de Google Drive?')) {
      return;
    }
    try {
      const { fetchProjectContentFromGoogleDrive } = await import('../lib/projectService.ts');
      const { payload, filename, modifiedTime } = await fetchProjectContentFromGoogleDrive(fileId);
      onLoadData(payload);
      setDriveFileId(fileId);
      const cleanName = (payload?.name || (payload as any)?.projectName || filename || 'Proyecto de Drive').replace(/\.json$/i, '');
      setProjectName(cleanName);
      setProjectId(payload?.metadata?.projectId || (payload as any)?.id || null);
      setFileHandle(null);
      setIsDirty(false);
      setLastSaveStatus({ destination: `Google Drive: ${cleanName}`, time: new Date(modifiedTime).toLocaleTimeString() });
    } catch (e: any) {
      console.error('Error al cargar proyecto desde Drive:', e);
      alert(`Error al abrir archivo de Google Drive: ${e.message}`);
    }
  };

  // 9. CERRAR PROYECTO
  const handleClose = () => {
    if (isDirty && !window.confirm('Tienes cambios sin guardar. ¿Seguro que deseas cerrar el proyecto?')) {
      return;
    }
    setProjectName('Proyecto Sin Título');
    setProjectId(null);
    setDriveFileId(null);
    setFileHandle(null);
    setIsDirty(false);
    setLastSaveStatus(null);
    onLoadData({
      projectName: 'Proyecto Sin Título',
      provincesData: {},
      navPath: [{ id: 'root', name: 'Inicio' }]
    });
  };

  return {
    projectName,
    setProjectName,
    projectId,
    setProjectId,
    driveFileId,
    setDriveFileId,
    fileHandle,
    isDirty,
    setIsDirty,
    isSaving,
    lastSaveStatus,
    getProjectPayload,
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleClose,
    handleSaveToDatabase,
    handleSaveToDrive,
    handleSaveToDisk,
    handleLoadFromDatabase,
    handleLoadFromGoogleDrive
  };
};
