/**
 * Utility helper para gestión segura de almacenamiento en el navegador
 * Incorpora IndexedDB, localStorage seguro y memoria de sesión en fallback
 * Previene completamente errores de QuotaExceededError cuando los datos vectoriales SVG o proyectos son pesados.
 */

// Memoria volátil de respaldo en tiempo de ejecución
const sessionMemoryMap = new Map<string, string>();

// Base de datos IndexedDB local para almacenar proyectos completos y datos pesados sin límite de 5MB
const IDB_DATABASE_NAME = 'ArgentinaFederalMapsDB';
const IDB_DATABASE_VERSION = 1;
const IDB_STORE_PROJECTS = 'projects';
const IDB_STORE_KEYVAL = 'keyval';

// Inicializa o abre la base de datos IndexedDB
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no está disponible en este entorno'));
      return;
    }

    const request = window.indexedDB.open(IDB_DATABASE_NAME, IDB_DATABASE_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db: IDBDatabase = event.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE_PROJECTS)) {
        db.createObjectStore(IDB_STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IDB_STORE_KEYVAL)) {
        db.createObjectStore(IDB_STORE_KEYVAL, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

// Guarda un valor en IndexedDB
export async function idbSetItem(key: string, value: any): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([IDB_STORE_KEYVAL], 'readwrite');
      const store = transaction.objectStore(IDB_STORE_KEYVAL);
      const request = store.put({ key, value });
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (err) {
    sessionMemoryMap.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    return false;
  }
}

// Lee un valor desde IndexedDB
export async function idbGetItem<T = any>(key: string): Promise<T | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([IDB_STORE_KEYVAL], 'readonly');
      const store = transaction.objectStore(IDB_STORE_KEYVAL);
      const request = store.get(key);
      request.onsuccess = (event: any) => {
        if (event.target.result) {
          resolve(event.target.result.value);
        } else {
          // Revisa fallback en memoria
          const mem = sessionMemoryMap.get(key);
          if (mem) {
            try { resolve(JSON.parse(mem)); } catch { resolve(mem as any); }
          } else {
            resolve(null);
          }
        }
      };
      request.onerror = () => {
        const mem = sessionMemoryMap.get(key);
        if (mem) {
          try { resolve(JSON.parse(mem)); } catch { resolve(mem as any); }
        } else {
          resolve(null);
        }
      };
    });
  } catch (err) {
    const mem = sessionMemoryMap.get(key);
    if (mem) {
      try { return JSON.parse(mem); } catch { return mem as any; }
    }
    return null;
  }
}

// Guarda un proyecto completo en IndexedDB (sin límite de tamaño)
export async function idbSaveProject(projectRecord: any): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([IDB_STORE_PROJECTS], 'readwrite');
      const store = transaction.objectStore(IDB_STORE_PROJECTS);
      const request = store.put(projectRecord);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[IDB] Fallo al guardar proyecto en IndexedDB:', err);
    return false;
  }
}

// Obtiene todos los proyectos almacenados en IndexedDB
export async function idbGetAllProjects(): Promise<any[]> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([IDB_STORE_PROJECTS], 'readonly');
      const store = transaction.objectStore(IDB_STORE_PROJECTS);
      const request = store.getAll();
      request.onsuccess = (event: any) => {
        resolve(event.target.result || []);
      };
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('[IDB] Fallo al obtener proyectos de IndexedDB:', err);
    return [];
  }
}

// Elimina un proyecto de IndexedDB
export async function idbDeleteProject(projectId: string): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([IDB_STORE_PROJECTS], 'readwrite');
      const store = transaction.objectStore(IDB_STORE_PROJECTS);
      const request = store.delete(projectId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
}

// Función para guardar un valor de forma segura en localStorage con fallback en memoria e IndexedDB
export function safeSetItem(key: string, value: string): boolean {
  // Almacena siempre en memoria de sesión instantánea
  sessionMemoryMap.set(key, value);

  try {
    // Si el valor es muy grande (> 1.5MB), se almacena en IndexedDB para no agotar la cuota de localStorage
    if (value.length > 1500000) {
      idbSetItem(key, value);
      return true;
    }

    // Intenta escribir la clave en el almacenamiento local del navegador
    localStorage.setItem(key, value);
    return true; // Retorna verdadero si se guardó correctamente
  } catch (error) {
    // Si excede la cuota de localStorage, guardamos en IndexedDB
    idbSetItem(key, value);
    return true;
  }
}

// Función para leer un valor de forma segura desde localStorage con fallback en memoria
export function safeGetItem(key: string): string | null {
  try {
    // Intenta obtener la clave desde localStorage
    const val = localStorage.getItem(key);
    if (val !== null) return val;
  } catch (error) {
    // En caso de restricción lee de memoria
  }

  // Fallback a memoria de sesión
  return sessionMemoryMap.get(key) || null;
}

// Función para eliminar un valor de forma segura de localStorage
export function safeRemoveItem(key: string): void {
  sessionMemoryMap.delete(key);
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // Ignora errores al remover
  }
}

