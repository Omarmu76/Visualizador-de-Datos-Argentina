// ============================================================================
// MODAL UNIVERSAL DE PERSISTENCIA MULTIDESTINO Y GESTOR DE VERSIONES
// ============================================================================
// Permite al usuario:
// 1. Guardar y sincronizar in-place sin duplicados en Base de Datos, Drive y Disco
// 2. Guardar Como... (crear copias independientes con nombres personalizados)
// 3. Abrir proyectos desde cualquier espacio: Base de Datos (Cloud SQL), Google Drive o Disco Local
// 4. Detectar y resolver conflictos de versiones con comparativa detallada (fechas, tamaño, métricas)
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react'; // React y hooks
import { 
  fetchProjectsFromDatabase, 
  deleteProjectFromDatabase, 
  fetchProjectsFromGoogleDrive,
  fetchProjectContentFromGoogleDrive,
  deleteProjectFromGoogleDrive,
  detectProjectVersionConflict,
  VersionConflictReport,
  SavedProjectRecord,
  DriveProjectRecord,
  downloadJsonBlob
} from '../lib/projectService.ts'; // Métodos del servicio de proyectos
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'; // Auth para Google Drive
import { auth } from '../lib/firebase.ts'; // Instancia de Firebase Auth
import {
  Save,
  Download,
  FolderOpen,
  Database,
  Cloud,
  HardDrive,
  RefreshCw,
  Trash2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  FilePlus,
  X,
  Layers,
  Lock,
  LogIn,
  FileText
} from 'lucide-react'; // Íconos UI de lucide-react
import { UniversalFileViewer, UniversalFileItem, BreadcrumbPathItem } from './UniversalFileViewer.tsx'; // Componente universal con Grid Dark Theme tipo Drive


export type ModalTab = 'save' | 'open_db' | 'open_drive' | 'open_disk' | 'conflict';

interface ProjectDestinationsModalProps { // Propiedades del modal
  isOpen: boolean; // Estado de visibilidad
  initialTab?: ModalTab; // Pestaña inicial al abrir
  onClose: () => void; // Función de cierre
  projectName: string; // Nombre del proyecto activo
  onRenameProject: (newName: string) => void; // Renombrar proyecto
  onSaveInPlace: () => Promise<void>; // Guardado in-place general
  onSaveAsNewCopy: (newName: string) => Promise<void>; // Guardar como nueva copia
  onSaveToDatabase: (description: string) => Promise<boolean>; // Guardar en BD
  onSaveToDrive: () => Promise<boolean>; // Guardar en Drive
  onSaveToDisk: (forceSaveAs?: boolean) => Promise<boolean>; // Guardar en Disco
  onLoadProject: (record: SavedProjectRecord) => void; // Cargar proyecto seleccionado de BD
  onLoadFromGoogleDrive?: (fileId: string) => Promise<void>; // Cargar proyecto desde Drive
  onLoadFromDisk?: () => void; // Cargar proyecto desde Disco
  isDirty: boolean; // Cambios pendientes en memoria
  lastSaveStatus: { destination: string; time: string } | null; // Último guardado
  currentProjectId: string | null; // ID activo en BD
  currentDriveFileId?: string | null; // ID activo en Google Drive
  currentPayload?: any; // Datos actuales en memoria para comparar versiones
}

export const ProjectDestinationsModal: React.FC<ProjectDestinationsModalProps> = ({
  isOpen,
  initialTab = 'save',
  onClose,
  projectName,
  onRenameProject,
  onSaveInPlace,
  onSaveAsNewCopy,
  onSaveToDatabase,
  onSaveToDrive,
  onSaveToDisk,
  onLoadProject,
  onLoadFromGoogleDrive,
  onLoadFromDisk,
  isDirty,
  lastSaveStatus,
  currentProjectId,
  currentDriveFileId,
  currentPayload
}) => {
  // Pestaña activa dentro del modal
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  // Lista de proyectos recuperados de la BD
  const [savedDbProjects, setSavedDbProjects] = useState<SavedProjectRecord[]>([]);
  // Lista de proyectos recuperados de Google Drive
  const [savedDriveProjects, setSavedDriveProjects] = useState<DriveProjectRecord[]>([]);
  // Filtro de búsqueda de proyectos
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Indicador de carga de lista BD
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  // Indicador de carga de lista Drive
  const [isLoadingDrive, setIsLoadingDrive] = useState<boolean>(false);
  // Token de Google Workspace detectado
  const [hasGoogleAuth, setHasGoogleAuth] = useState<boolean>(false);
  // Nombre editable local
  const [editName, setEditName] = useState<string>(projectName);
  // Descripción opcional para la BD
  const [dbDescription, setDbDescription] = useState<string>('');
  // Estado de procesamiento en curso
  const [isBusy, setIsBusy] = useState<boolean>(false);
  // Mensaje de estado o éxito
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Estado del reporte de conflicto de versiones si se detecta discrepancia
  const [conflictReport, setConflictReport] = useState<{
    report: VersionConflictReport;
    targetPayload: any;
    targetRecord?: SavedProjectRecord;
    driveFileId?: string;
  } | null>(null);

  // Sincroniza el estado inicial al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setEditName(projectName);
      setActiveTab(initialTab);
      setStatusMessage(null);
      setConflictReport(null);
      checkGoogleToken();
      loadDbProjectsList();
    }
  }, [isOpen, projectName, initialTab]);

  // Verifica si hay token de Google Workspace disponible
  const checkGoogleToken = () => {
    const token = localStorage.getItem('gdrive_access_token') || 
                  sessionStorage.getItem('gdrive_access_token') || 
                  (window as any).__GOOGLE_WORKSPACE_ACCESS_TOKEN__;
    const isAuthed = Boolean(token);
    setHasGoogleAuth(isAuthed);
    if (isAuthed) {
      loadDriveProjectsList();
    }
  };

  // Inicia sesión rápida con Google para conectar Google Drive
  const handleGoogleConnect = async (): Promise<boolean> => {
    setIsBusy(true);
    setStatusMessage({ text: 'Abriendo autenticación segura de Google Workspace...', type: 'info' });
    try {
      const provider = new GoogleAuthProvider();
      // Scopes requeridos para guardar, leer y gestionar archivos en Google Drive
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');
      provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
      provider.addScope('https://www.googleapis.com/auth/userinfo.email');
      provider.setCustomParameters({
        prompt: 'consent select_account' // Asegura refresco de credenciales y selección de cuenta
      });
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (token) {
        localStorage.setItem('gdrive_access_token', token);
        sessionStorage.setItem('gdrive_access_token', token);
        (window as any).__GOOGLE_WORKSPACE_ACCESS_TOKEN__ = token;
        setHasGoogleAuth(true);
        setStatusMessage({ text: '✓ Conexión exitosa con Google Workspace / Drive.', type: 'success' });
        await loadDriveProjectsList();
        return true;
      } else {
        throw new Error('No se pudo obtener el token de acceso OAuth de Google.');
      }
    } catch (e: any) {
      console.error('Error al conectar Google:', e);
      // Limpia tokens inválidos en caso de error
      localStorage.removeItem('gdrive_access_token');
      sessionStorage.removeItem('gdrive_access_token');
      (window as any).__GOOGLE_WORKSPACE_ACCESS_TOKEN__ = null;
      setHasGoogleAuth(false);
      setStatusMessage({ 
        text: `Error de autenticación Google: ${e.message}. Verifique permitir pop-ups en el navegador.`, 
        type: 'error' 
      });
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  // Carga la lista de proyectos desde la Base de Datos Cloud SQL
  const loadDbProjectsList = async () => {
    setIsLoadingDb(true);
    try {
      const list = await fetchProjectsFromDatabase();
      setSavedDbProjects(list);
    } catch (e) {
      console.error('Error al listar proyectos de BD:', e);
    } finally {
      setIsLoadingDb(false);
    }
  };

  // Carga la lista de archivos JSON desde Google Drive
  const loadDriveProjectsList = async () => {
    setIsLoadingDrive(true);
    try {
      const list = await fetchProjectsFromGoogleDrive();
      setSavedDriveProjects(list);
    } catch (e: any) {
      console.warn('Error al listar proyectos de Drive:', e.message);
      if (e.message?.includes('401') || e.message?.includes('UNAUTHENTICATED') || e.message?.includes('Invalid Credentials')) {
        localStorage.removeItem('gdrive_access_token');
        sessionStorage.removeItem('gdrive_access_token');
        (window as any).__GOOGLE_WORKSPACE_ACCESS_TOKEN__ = null;
        setHasGoogleAuth(false);
      }
    } finally {
      setIsLoadingDrive(false);
    }
  };

  if (!isOpen) return null;

  // Manejador: Actualizar In-Place (Sobreescribir trabajo actual)
  const handleExecuteSaveInPlace = async () => {
    setIsBusy(true);
    setStatusMessage({ text: 'Actualizando trabajo actual in-place...', type: 'info' });
    try {
      if (editName !== projectName) {
        onRenameProject(editName);
      }
      await onSaveInPlace();
      setStatusMessage({ text: '✓ Trabajo actualizado exitosamente sin generar archivos duplicados.', type: 'success' });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e: any) {
      setStatusMessage({ text: `Error: ${e.message}`, type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  // Manejador: Guardar Como Nueva Copia
  const handleExecuteSaveAs = async () => {
    if (!editName.trim()) {
      alert('Por favor ingrese un nombre para la nueva copia.');
      return;
    }
    setIsBusy(true);
    setStatusMessage({ text: 'Creando y guardando nueva copia...', type: 'info' });
    try {
      await onSaveAsNewCopy(editName);
      setStatusMessage({ text: `✓ Nueva versión "${editName}" guardada correctamente.`, type: 'success' });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e: any) {
      setStatusMessage({ text: `Error: ${e.message}`, type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  // Manejador: Guardar en Base de Datos
  const handleExecuteSaveDb = async () => {
    setIsBusy(true);
    setStatusMessage({ text: 'Guardando en Base de Datos (Cloud SQL)...', type: 'info' });
    try {
      if (editName !== projectName) {
        onRenameProject(editName);
      }
      const ok = await onSaveToDatabase(dbDescription);
      if (ok) {
        setStatusMessage({ text: '✓ Guardado exitoso en Base de Datos Cloud SQL.', type: 'success' });
        await loadDbProjectsList();
      }
    } catch (e: any) {
      setStatusMessage({ text: `Error en BD: ${e.message}`, type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  // Manejador: Guardar en Google Drive
  const handleExecuteSaveDrive = async () => {
    if (!hasGoogleAuth) {
      const connected = await handleGoogleConnect();
      if (!connected) return;
    }
    setIsBusy(true);
    setStatusMessage({ text: 'Sincronizando con Google Drive...', type: 'info' });
    try {
      if (editName !== projectName) {
        onRenameProject(editName);
      }
      const ok = await onSaveToDrive();
      if (ok) {
        setStatusMessage({ text: '✓ Sincronizado exitosamente con Google Drive.', type: 'success' });
        await loadDriveProjectsList();
      }
    } catch (e: any) {
      // Si fue error de credenciales expiradas (401), intentamos re-autenticar inmediatamente y reintentar
      if (e.message?.includes('401') || e.message?.includes('UNAUTHENTICATED') || e.message?.includes('Invalid Credentials')) {
        setStatusMessage({ text: 'Credenciales de Google expiradas. Re-autenticando...', type: 'info' });
        const reconnected = await handleGoogleConnect();
        if (reconnected) {
          try {
            setIsBusy(true);
            const retryOk = await onSaveToDrive();
            if (retryOk) {
              setStatusMessage({ text: '✓ Sincronizado exitosamente con Google Drive tras renovar credenciales.', type: 'success' });
              await loadDriveProjectsList();
              return;
            }
          } catch (retryErr: any) {
            setStatusMessage({ text: `Error en Drive al reintentar: ${retryErr.message}`, type: 'error' });
          }
        }
      } else {
        setStatusMessage({ text: `Error en Drive: ${e.message}`, type: 'error' });
      }
    } finally {
      setIsBusy(false);
    }
  };

  // Manejador: Guardar en Disco Local
  const handleExecuteSaveDisk = async (forceNew: boolean = false) => {
    setIsBusy(true);
    setStatusMessage({ text: forceNew ? 'Abriendo selector de guardado...' : 'Guardando en archivo local...', type: 'info' });
    try {
      if (editName !== projectName) {
        onRenameProject(editName);
      }
      const ok = await onSaveToDisk(forceNew);
      if (ok) {
        setStatusMessage({ text: '✓ Guardado exitoso en Disco Local.', type: 'success' });
      }
    } catch (e: any) {
      setStatusMessage({ text: `Error en Disco: ${e.message}`, type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  // Manejador Inteligente para Abrir desde BD con Chequeo de Conflictos
  const handleSelectOpenDbProject = (record: SavedProjectRecord) => {
    if (isDirty && currentPayload) {
      const conflict = detectProjectVersionConflict(currentPayload, record.payload, 'Base de Datos (Cloud SQL)');
      if (conflict.hasConflict) {
        setConflictReport({
          report: conflict,
          targetPayload: record.payload,
          targetRecord: record
        });
        setActiveTab('conflict');
        return;
      }
    }
    onLoadProject(record);
    onClose();
  };

  // Manejador Inteligente para Abrir desde Drive con Chequeo de Conflictos
  const handleSelectOpenDriveProject = async (file: DriveProjectRecord) => {
    if (!onLoadFromGoogleDrive) return;
    setIsBusy(true);
    try {
      const { payload } = await fetchProjectContentFromGoogleDrive(file.id);
      if (isDirty && currentPayload) {
        const conflict = detectProjectVersionConflict(currentPayload, payload, 'Google Drive');
        if (conflict.hasConflict) {
          setConflictReport({
            report: conflict,
            targetPayload: payload,
            driveFileId: file.id
          });
          setActiveTab('conflict');
          return;
        }
      }
      await onLoadFromGoogleDrive(file.id);
      onClose();
    } catch (e: any) {
      setStatusMessage({ text: `Error al abrir desde Drive: ${e.message}`, type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  // Manejador de Resolución de Conflicto: Cargar Remoto (Sobreescribir Local)
  const handleResolveLoadRemote = () => {
    if (!conflictReport) return;
    if (conflictReport.targetRecord) {
      onLoadProject(conflictReport.targetRecord);
    } else if (conflictReport.driveFileId && onLoadFromGoogleDrive) {
      onLoadFromGoogleDrive(conflictReport.driveFileId);
    }
    onClose();
  };

  // Manejador de Resolución de Conflicto: Conservar Local (Sobreescribir Remoto)
  const handleResolveKeepLocal = async () => {
    if (!conflictReport) return;
    setIsBusy(true);
    try {
      if (conflictReport.targetRecord) {
        await onSaveToDatabase('Actualizado forzado desde versión local');
      } else if (conflictReport.driveFileId) {
        await onSaveToDrive();
      }
      setStatusMessage({ text: '✓ Se conservó la versión local y se sincronizó en la nube.', type: 'success' });
      setTimeout(() => onClose(), 1000);
    } catch (e: any) {
      setStatusMessage({ text: `Error: ${e.message}`, type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  // Manejador de Resolución de Conflicto: Guardar Ambas (Nueva Copia con Fecha)
  const handleResolveSaveBoth = async () => {
    if (!conflictReport) return;
    const dateSuffix = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const newName = `${projectName} (Copia ${dateSuffix})`;
    setIsBusy(true);
    try {
      await onSaveAsNewCopy(newName);
      setStatusMessage({ text: `✓ Copia local guardada como "${newName}".`, type: 'success' });
      setTimeout(() => onClose(), 1200);
    } catch (e: any) {
      setStatusMessage({ text: `Error: ${e.message}`, type: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  // Manejador: Eliminar proyecto de BD
  const handleDeleteFromDb = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Seguro que deseas eliminar el proyecto "${name}" de la Base de Datos?`)) return;
    const ok = await deleteProjectFromDatabase(id);
    if (ok) {
      setSavedDbProjects(prev => prev.filter(p => p.id !== id));
      setStatusMessage({ text: `Proyecto "${name}" eliminado de la Base de Datos.`, type: 'info' });
    }
  };

  // Manejador: Eliminar archivo de Google Drive
  const handleDeleteFromDrive = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Seguro que deseas eliminar "${name}" de tu Google Drive?`)) return;
    const ok = await deleteProjectFromGoogleDrive(id);
    if (ok) {
      setSavedDriveProjects(prev => prev.filter(p => p.id !== id));
      setStatusMessage({ text: `Archivo "${name}" eliminado de Google Drive.`, type: 'info' });
    }
  };

  // Manejador: Descargar copia JSON
  const handleDownloadCopy = (data: any, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filename = `${name.replace(/[\\/:*?"<>|]/g, '_')}.json`;
    downloadJsonBlob(JSON.stringify(data, null, 2), filename);
  };

  // Proyectos filtrados por búsqueda
  const filteredDbProjects = savedDbProjects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDriveProjects = savedDriveProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* CABECERA PRINCIPAL DEL MODAL */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Cloud size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                  Centro de Persistencia y Gestión de Proyectos
                </h2>
                {isDirty && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>CAMBIOS SIN GUARDAR</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Guarda in-place sin duplicados, sincroniza con BD / Google Drive y abre desde cualquier destino
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* BARRA DE PESTAÑAS UNIVERSAL */}
        <div className="flex flex-wrap border-b border-slate-800 bg-slate-950/50 px-4 pt-2 gap-1 overflow-x-auto">
          {/* Pestaña Guardar */}
          <button
            onClick={() => setActiveTab('save')}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'save'
                ? 'border-sky-400 text-sky-300 bg-slate-900/50 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Save size={13} className="text-sky-400" />
            <span>💾 Guardar / Sincronizar</span>
          </button>

          {/* Pestaña Base de Datos */}
          <button
            onClick={() => setActiveTab('open_db')}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'open_db'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/50 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database size={13} className="text-emerald-400" />
            <span>🗄️ Base de Datos ({savedDbProjects.length})</span>
          </button>

          {/* Pestaña Google Drive */}
          <button
            onClick={() => setActiveTab('open_drive')}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'open_drive'
                ? 'border-amber-400 text-amber-300 bg-slate-900/50 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud size={13} className="text-amber-400" />
            <span>☁️ Google Drive {hasGoogleAuth ? `(${savedDriveProjects.length})` : ''}</span>
          </button>

          {/* Pestaña Disco Local */}
          <button
            onClick={() => setActiveTab('open_disk')}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'open_disk'
                ? 'border-purple-400 text-purple-300 bg-slate-900/50 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive size={13} className="text-purple-400" />
            <span>💻 Disco Local (.json)</span>
          </button>

          {/* Pestaña Conflicto (solo si existe reporte activo) */}
          {conflictReport && (
            <button
              onClick={() => setActiveTab('conflict')}
              className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center space-x-1.5 shrink-0 animate-pulse ${
                activeTab === 'conflict'
                  ? 'border-rose-500 text-rose-300 bg-rose-950/30 rounded-t-lg'
                  : 'border-transparent text-rose-400 hover:text-rose-300'
              }`}
            >
              <AlertTriangle size={13} className="text-rose-400" />
              <span>⚖️ Resolver Versiones</span>
            </button>
          )}
        </div>

        {/* MENSAJE DE ESTADO DINÁMICO */}
        {statusMessage && (
          <div className={`mx-5 mt-3 p-3 rounded-xl text-xs font-medium flex items-center justify-between animate-fade-in border ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              : 'bg-sky-950/60 border-sky-500/40 text-sky-300'
          }`}>
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-200">
              <X size={13} />
            </button>
          </div>
        )}

        {/* CUERPO DEL CONTENIDO SEGÚN PESTAÑA */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          
          {/* ========================================================================= */}
          {/* 1. PESTAÑA: GUARDAR / SINCRONIZAR PROYECTO                                */}
          {/* ========================================================================= */}
          {activeTab === 'save' && (
            <div className="space-y-4">
              
              {/* Campo Editable de Nombre del Proyecto */}
              <div className="bg-slate-950/70 p-4 border border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Nombre del Proyecto:
                </label>
                <div className="flex items-center space-x-2">
                  <FileText size={15} className="text-sky-400 shrink-0" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Escribe el nombre del proyecto..."
                    className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-lg px-3 py-2 text-sm font-bold text-slate-100 placeholder:text-slate-500 outline-none transition"
                  />
                </div>
                {lastSaveStatus && (
                  <p className="text-[11px] text-slate-400 pt-1 flex items-center space-x-1.5">
                    <span className="text-emerald-400">●</span>
                    <span>Último guardado en <strong>{lastSaveStatus.destination}</strong> ({lastSaveStatus.time})</span>
                  </p>
                )}
              </div>

              {/* ACCIÓN PRINCIPAL RECOMENDADA: GUARDAR IN-PLACE (SIN DUPLICADOS) */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Save size={16} className="text-emerald-400" />
                    <h3 className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                      Guardar In-Place (Sobreescribir trabajo actual)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 max-w-lg">
                    Actualiza directamente en la Base de Datos, Google Drive y/o archivo de disco vinculado sin crear copias repetitivas ni llenar tu almacenamiento con "Mapa (1)", "Mapa (2)".
                  </p>
                </div>
                <button
                  onClick={handleExecuteSaveInPlace}
                  disabled={isBusy}
                  className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs transition uppercase tracking-wider shadow-md shadow-emerald-950 cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5 shrink-0"
                >
                  <Save size={14} />
                  <span>Guardar Ahora</span>
                </button>
              </div>

              {/* DESTINOS DIRECTOS DE PERSISTENCIA */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Destinos de Persistencia Específicos:
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Destino 1: Base de Datos Cloud SQL */}
                  <div className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 text-emerald-400">
                        <Database size={15} />
                        <h5 className="text-xs font-bold text-slate-200">Base de Datos</h5>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        PostgreSQL Cloud SQL backend persistente.
                      </p>
                      {currentProjectId && (
                        <span className="text-[9px] font-mono text-emerald-400/80 block truncate">
                          ID: {currentProjectId}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleExecuteSaveDb}
                      disabled={isBusy}
                      className="w-full bg-slate-850 hover:bg-emerald-950/60 text-emerald-300 hover:text-emerald-200 font-bold py-1.5 px-3 rounded-lg text-xs transition cursor-pointer border border-slate-700 hover:border-emerald-600 flex items-center justify-center space-x-1"
                    >
                      <Database size={12} />
                      <span>Guardar en BD</span>
                    </button>
                  </div>

                  {/* Destino 2: Google Drive */}
                  <div className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 text-amber-400">
                        <Cloud size={15} />
                        <h5 className="text-xs font-bold text-slate-200">Google Drive</h5>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Sincronización en la nube con Workspace.
                      </p>
                      {currentDriveFileId && (
                        <span className="text-[9px] font-mono text-amber-400/80 block truncate">
                          Drive ID: {currentDriveFileId}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleExecuteSaveDrive}
                      disabled={isBusy}
                      className="w-full bg-slate-850 hover:bg-amber-950/60 text-amber-300 hover:text-amber-200 font-bold py-1.5 px-3 rounded-lg text-xs transition cursor-pointer border border-slate-700 hover:border-amber-600 flex items-center justify-center space-x-1"
                    >
                      <Cloud size={12} />
                      <span>{hasGoogleAuth ? 'Guardar en Drive' : 'Conectar Drive'}</span>
                    </button>
                  </div>

                  {/* Destino 3: Disco Local Físico */}
                  <div className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 text-purple-400">
                        <HardDrive size={15} />
                        <h5 className="text-xs font-bold text-slate-200">Disco Local</h5>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Archivo físico .json en tu computadora.
                      </p>
                    </div>
                    <button
                      onClick={() => handleExecuteSaveDisk(false)}
                      disabled={isBusy}
                      className="w-full bg-slate-850 hover:bg-purple-950/60 text-purple-300 hover:text-purple-200 font-bold py-1.5 px-3 rounded-lg text-xs transition cursor-pointer border border-slate-700 hover:border-purple-600 flex items-center justify-center space-x-1"
                    >
                      <HardDrive size={12} />
                      <span>Guardar en Disco</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* OPCIÓN GUARDAR COMO (NUEVA COPIA INDEPENDIENTE) */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <Download size={14} className="text-slate-400" />
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Guardar Como... (Bifurcar / Crear Nueva Copia)
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400">
                    Crea un nuevo proyecto independiente con otro nombre y transfiere el lienzo a esa nueva versión.
                  </p>
                </div>
                <button
                  onClick={handleExecuteSaveAs}
                  disabled={isBusy}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-lg text-xs transition border border-slate-700 cursor-pointer shrink-0 flex items-center space-x-1.5"
                >
                  <Download size={13} className="text-purple-400" />
                  <span>Guardar Como...</span>
                </button>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. PESTAÑA: BASE DE DATOS (CLOUD SQL)                                     */}
          {/* ========================================================================= */}
          {activeTab === 'open_db' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <Database size={15} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                      Explorador de Base de Datos Cloud SQL
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Proyectos persistidos de forma segura en almacenamiento de nube y local
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={loadDbProjectsList}
                  disabled={isLoadingDb}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 flex items-center space-x-1.5 cursor-pointer transition"
                  title="Recargar lista de BD"
                >
                  <RefreshCw size={12} className={isLoadingDb ? 'animate-spin' : ''} />
                  <span>Refrescar</span>
                </button>
              </div>

              {/* Componente Universal de Archivos en formato Grid Dark Mode */}
              <UniversalFileViewer
                items={savedDbProjects.map((rec) => ({
                  id: rec.id,
                  name: rec.name,
                  type: 'map',
                  source: 'db',
                  description: rec.description || `Nivel: ${rec.activeLevel || 'Nacional'}`,
                  updatedAt: rec.updatedAt,
                  isCurrentActive: rec.id === currentProjectId,
                  originalPayload: rec.payload,
                  svgThumbnailPreview: rec.payload?.provinces?.[0]?.d || undefined
                }))}
                onSelectItem={(item) => {
                  const found = savedDbProjects.find((p) => p.id === item.id);
                  if (found) handleSelectOpenDbProject(found);
                }}
                onDeleteItem={(item, e) => {
                  handleDeleteFromDb(item.id, item.name, e);
                }}
                onDownloadItem={(item, e) => {
                  const found = savedDbProjects.find((p) => p.id === item.id);
                  if (found) handleDownloadCopy(found.payload, found.name, e);
                }}
                breadcrumbs={[
                  { id: 'root', name: 'Inicio' },
                  { id: 'db', name: 'Base de Datos (Cloud SQL)' }
                ]}
                isLoading={isLoadingDb}
                emptyMessage="No hay proyectos guardados en la Base de Datos todavía."
                searchPlaceholder="Buscar proyectos en Base de Datos..."
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. PESTAÑA: GOOGLE DRIVE                                                  */}
          {/* ========================================================================= */}
          {activeTab === 'open_drive' && (
            <div className="space-y-4">
              {!hasGoogleAuth ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl space-y-3 bg-slate-950/40">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                    <Cloud size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">
                      Conecta tu cuenta de Google Workspace
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      Para explorar y abrir archivos de mapa en formato cuadrícula directamente desde tu unidad de Google Drive.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleConnect}
                    disabled={isBusy}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer flex items-center space-x-2 mx-auto shadow-lg shadow-amber-950/50"
                  >
                    <LogIn size={14} />
                    <span>Conectar Google Drive</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <Cloud size={15} />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                          Mi Unidad Google Drive
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Archivos JSON de mapas sincronizados en tu nube de Google
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={loadDriveProjectsList}
                      disabled={isLoadingDrive}
                      className="bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 flex items-center space-x-1.5 cursor-pointer transition"
                    >
                      <RefreshCw size={12} className={isLoadingDrive ? 'animate-spin' : ''} />
                      <span>Refrescar</span>
                    </button>
                  </div>

                  {/* Componente Universal de Archivos en formato Grid Dark Mode para Google Drive */}
                  <UniversalFileViewer
                    items={savedDriveProjects.map((file) => ({
                      id: file.id,
                      name: file.name,
                      type: 'json',
                      source: 'drive',
                      size: file.size ? Number(file.size) : undefined,
                      updatedAt: file.modifiedTime,
                      thumbnailUrl: file.thumbnailLink || undefined,
                      webViewLink: file.webViewLink || undefined,
                      isCurrentActive: file.id === currentDriveFileId
                    }))}
                    onSelectItem={(item) => {
                      const found = savedDriveProjects.find((f) => f.id === item.id);
                      if (found) handleSelectOpenDriveProject(found);
                    }}
                    onDeleteItem={(item, e) => {
                      handleDeleteFromDrive(item.id, item.name, e);
                    }}
                    breadcrumbs={[
                      { id: 'root', name: 'Inicio' },
                      { id: 'drive', name: 'Mi Unidad Google Drive' }
                    ]}
                    isLoading={isLoadingDrive}
                    emptyMessage="No se encontraron proyectos .json en tu Google Drive."
                    searchPlaceholder="Buscar archivos en Google Drive..."
                  />
                </>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. PESTAÑA: DISCO LOCAL (JSON)                                            */}
          {/* ========================================================================= */}
          {activeTab === 'open_disk' && (
            <div className="space-y-4">
              <div className="p-8 text-center border-2 border-dashed border-slate-800 hover:border-purple-500/50 bg-slate-950/40 rounded-2xl space-y-4 transition">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto">
                  <HardDrive size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-200">
                    Abrir Archivo de Mapa desde tu Computadora
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Selecciona cualquier archivo <code>.json</code> exportado previamente para restaurar el lienzo, los datos y las métricas.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (onLoadFromDisk) {
                      onLoadFromDisk();
                      onClose();
                    }
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black px-5 py-2.5 rounded-xl text-xs transition uppercase tracking-wider shadow-lg shadow-purple-950 cursor-pointer flex items-center space-x-2 mx-auto"
                >
                  <FolderOpen size={14} />
                  <span>Examinar Archivos en PC (.json)</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. PESTAÑA: COMPARADOR DE VERSIONES / RESOLUCIÓN DE CONFLICTOS           */}
          {/* ========================================================================= */}
          {activeTab === 'conflict' && conflictReport && (
            <div className="space-y-4">
              
              <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-rose-400">
                  <AlertTriangle size={18} />
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    Detección de Versiones y Modificaciones
                  </h4>
                </div>
                <p className="text-xs text-slate-300">
                  {conflictReport.report.differenceDescription}
                </p>
              </div>

              {/* Comparativa Visual Lado a Lado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Lado 1: Versión Local en Memoria */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      📌 Versión en Pantalla (Memoria)
                    </span>
                    {conflictReport.report.newerSource === 'local' && (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black px-2 py-0.5 rounded-full">
                        MÁS RECIENTE
                      </span>
                    )}
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-slate-100">
                      {conflictReport.report.localSummary.name}
                    </h5>
                    <p className="text-xs text-slate-400 mt-1">
                      Última modificación: <strong>{conflictReport.report.localSummary.lastModified}</strong>
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    <div>Provincias configuradas: <strong className="text-slate-200">{conflictReport.report.localSummary.provincesCount}</strong></div>
                    <div>Nivel territorial: <strong className="text-slate-200">{conflictReport.report.localSummary.activeLevel}</strong></div>
                    <div>Nodos vectoriales: <strong className="text-slate-200">{conflictReport.report.localSummary.nodesCount}</strong></div>
                  </div>
                </div>

                {/* Lado 2: Versión Remota (BD o Drive) */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      ☁️ Versión Remota ({conflictReport.report.remoteSummary.source})
                    </span>
                    {conflictReport.report.newerSource === 'remote' && (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black px-2 py-0.5 rounded-full">
                        MÁS RECIENTE
                      </span>
                    )}
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-slate-100">
                      {conflictReport.report.remoteSummary.name}
                    </h5>
                    <p className="text-xs text-slate-400 mt-1">
                      Última modificación: <strong>{conflictReport.report.remoteSummary.lastModified}</strong>
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    <div>Provincias configuradas: <strong className="text-slate-200">{conflictReport.report.remoteSummary.provincesCount}</strong></div>
                    <div>Nivel territorial: <strong className="text-slate-200">{conflictReport.report.remoteSummary.activeLevel}</strong></div>
                    <div>Nodos vectoriales: <strong className="text-slate-200">{conflictReport.report.remoteSummary.nodesCount}</strong></div>
                  </div>
                </div>

              </div>

              {/* Botones de Acción de Resolución de Conflicto */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Elige cómo deseas proceder:
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={handleResolveLoadRemote}
                    disabled={isBusy}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold p-2.5 rounded-xl text-xs transition cursor-pointer flex flex-col items-center justify-center text-center space-y-1"
                  >
                    <span>⬇️ Cargar Versión Remota</span>
                    <span className="text-[10px] text-sky-200 font-normal">Reemplaza el trabajo en pantalla</span>
                  </button>

                  <button
                    onClick={handleResolveKeepLocal}
                    disabled={isBusy}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black p-2.5 rounded-xl text-xs transition cursor-pointer flex flex-col items-center justify-center text-center space-y-1"
                  >
                    <span>⬆️ Conservar Versión Local</span>
                    <span className="text-[10px] text-emerald-950 font-normal">Sobreescribe la nube con tu pantalla</span>
                  </button>

                  <button
                    onClick={handleResolveSaveBoth}
                    disabled={isBusy}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold p-2.5 rounded-xl text-xs transition border border-slate-700 cursor-pointer flex flex-col items-center justify-center text-center space-y-1"
                  >
                    <span>📑 Guardar Ambas (Nueva Copia)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Conserva las dos con fecha</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* PIE DEL MODAL */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-500 text-[11px] font-mono">
            <span>BD ID: {currentProjectId || 'Sin ID en BD'}</span>
            {currentDriveFileId && (
              <>
                <span>•</span>
                <span>Drive ID: {currentDriveFileId.slice(0, 10)}...</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-1.5 rounded-lg text-xs transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
