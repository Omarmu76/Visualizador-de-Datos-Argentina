/**
 * Utility helper para gestión segura de localStorage en el navegador
 * Previene errores de QuotaExceededError cuando los datos vectoriales SVG son muy pesados.
 */

// Función para guardar un valor de forma segura en localStorage
export function safeSetItem(key: string, value: string): boolean {
  try {
    // Intenta escribir la clave en el almacenamiento local del navegador
    localStorage.setItem(key, value);
    return true; // Retorna verdadero si se guardó correctamente
  } catch (error) {
    // Captura excepciones de tipo QuotaExceededError o permisos restringidos
    console.warn(`[SafeStorage] No se pudo guardar la clave "${key}" en localStorage (Cuota superada o almacenamiento restringido). Se mantendrán los datos activos en la memoria de la sesión.`, error);
    return false; // Retorna falso para indicar que no se pudo persistir
  }
}

// Función para leer un valor de forma segura desde localStorage
export function safeGetItem(key: string): string | null {
  try {
    // Intenta obtener la clave desde localStorage
    return localStorage.getItem(key);
  } catch (error) {
    // Captura posibles errores de lectura en entornos restringidos
    console.warn(`[SafeStorage] Error al leer la clave "${key}" desde localStorage:`, error);
    return null; // Retorna nulo si ocurre un fallo
  }
}

// Función para eliminar un valor de forma segura de localStorage
export function safeRemoveItem(key: string): void {
  try {
    // Intenta remover la clave especificada
    localStorage.removeItem(key);
  } catch (error) {
    // Captura fallos al eliminar la clave
    console.warn(`[SafeStorage] Error al eliminar la clave "${key}" de localStorage:`, error);
  }
}
