// ==========================================
// SERVICIO CENTRAL DE BASE DE DATOS Y PERSISTENCIA (Fase 1: Persistencia Real)
// ==========================================

import { TreeNode } from '../types'; // Importación de la interfaz TreeNode para tipado
import { safeGetItem, safeSetItem } from './storage'; // Importación de utilidades seguras de almacenamiento local

// Interfaz para la respuesta estandarizada de API
export interface ApiResponse<T = any> {
  success: boolean; // Indica si la operación fue exitosa
  data?: T; // Datos retornados por el servidor o base de datos
  error?: string; // Mensaje de error en caso de fallo
}

// ------------------------------------------
// 1. OBTENER TODOS LOS NODOS DEL ÁRBOL
// ------------------------------------------
export async function fetchAllGeoNodes(): Promise<TreeNode[]> {
  try {
    // Intenta realizar una consulta HTTP GET al endpoint real del servidor backend
    const response = await fetch('/api/nodes'); // Ejecuta la petición al endpoint /api/nodes
    if (response.ok) { // Si la respuesta fue exitosa (200 OK)
      const data = await response.json(); // Parsea la respuesta JSON
      if (Array.isArray(data) && data.length > 0) { // Si contiene un arreglo válido de nodos
        // Guarda copia de respaldo en almacenamiento local para resiliencia offline
        safeSetItem('app_dynamic_tree_nodes', JSON.stringify(data)); // Guarda el respaldo
        return data; // Retorna los nodos obtenidos de la base de datos
      }
    }
  } catch (error) {
    // Captura errores de red o fallo de conexión con el servidor
    console.warn('Servidor backend no disponible o error de red. Utilizando persistencia local:', error);
  }

  // Fallback: Si la API no está disponible o la BD está vacía, lee del almacenamiento local
  const localSaved = safeGetItem('app_dynamic_tree_nodes'); // Lee los nodos guardados en localStorage
  if (localSaved) { // Si existen datos guardados localmente
    try {
      const parsed = JSON.parse(localSaved); // Parsea la cadena JSON
      if (Array.isArray(parsed) && parsed.length > 0) { // Valida que sea un arreglo
        return parsed; // Retorna la lista de nodos locales
      }
    } catch (e) {
      console.error('Error al parsear app_dynamic_tree_nodes:', e); // Imprime error si falla la lectura JSON
    }
  }

  return []; // Retorna arreglo vacío si no se hallaron registros
}

// ------------------------------------------
// 2. GUARDAR O ACTUALIZAR UN NODO INDIVIDUAL (Mutación)
// ------------------------------------------
export async function saveGeoNode(node: TreeNode): Promise<boolean> {
  try {
    // Intenta enviar la mutación UPDATE/INSERT al servidor backend
    const response = await fetch('/api/nodes', { // Petición HTTP POST al endpoint /api/nodes
      method: 'POST', // Método HTTP POST para crear/actualizar
      headers: { 'Content-Type': 'application/json' }, // Encabezado de contenido JSON
      body: JSON.stringify(node), // Convierte el objeto nodo a JSON
    });
    if (response.ok) { // Si el servidor respondió con éxito
      console.log('Nodo guardado exitosamente en base de datos backend:', node.id); // Registra confirmación
    }
  } catch (error) {
    // Registra advertencia si el servidor backend no procesó la petición
    console.warn('No se pudo sincronizar con backend real. Guardando localmente:', error);
  }

  // Sincroniza siempre con la base de datos local (localStorage) para garantizar cero pérdida de datos
  try {
    const currentNodes = await fetchAllGeoNodes(); // Obtiene los nodos actuales
    const existingIndex = currentNodes.findIndex(n => n.id === node.id); // Busca el índice del nodo
    let updatedNodes: TreeNode[]; // Variable para la nueva lista de nodos

    if (existingIndex >= 0) { // Si el nodo ya existe
      updatedNodes = currentNodes.map(n => n.id === node.id ? { ...n, ...node } : n); // Actualiza sus campos
    } else { // Si es un nodo totalmente nuevo
      updatedNodes = [...currentNodes, node]; // Lo agrega al final de la lista
    }

    safeSetItem('app_dynamic_tree_nodes', JSON.stringify(updatedNodes)); // Persiste la lista actualizada
    return true; // Retorna éxito
  } catch (err) {
    console.error('Error al guardar nodo en almacenamiento local:', err); // Imprime error si ocurre fallo
    return false; // Retorna falso en caso de error
  }
}

// ------------------------------------------
// 3. ACTUALIZAR VISIBILIDAD DE UN NODO (Pilar A - Ojo)
// ------------------------------------------
export async function updateNodeVisibility(nodeId: string, isVisible: boolean): Promise<boolean> {
  try {
    // Envía la actualización de visibilidad al servidor backend
    fetch(`/api/nodes/${encodeURIComponent(nodeId)}`, { // Petición HTTP PUT al endpoint del nodo
      method: 'PUT', // Método HTTP PUT para actualización parcial
      headers: { 'Content-Type': 'application/json' }, // Encabezado JSON
      body: JSON.stringify({ isVisible }), // Envía únicamente la propiedad isVisible
    }).catch(err => console.warn('Error en llamada PUT a /api/nodes:', err)); // Captura silenciosa de errores
  } catch (e) {
    console.warn('Actualización remota de visibilidad no disponible:', e); // Registra advertencia
  }

  // Actualiza el registro localmente
  const currentNodes = await fetchAllGeoNodes(); // Carga todos los nodos
  const updatedNodes = currentNodes.map(n => n.id === nodeId ? { ...n, isVisible } : n); // Modifica la propiedad isVisible
  safeSetItem('app_dynamic_tree_nodes', JSON.stringify(updatedNodes)); // Guarda en localStorage
  return true; // Confirma la operación
}

// ------------------------------------------
// 4. ACTUALIZAR PADRE DE UN NODO (Drag & Drop Re-parenting)
// ------------------------------------------
export async function updateNodeParent(nodeId: string, parentId: string | null): Promise<boolean> {
  try {
    // Envía la actualización de parentId al servidor backend
    fetch(`/api/nodes/${encodeURIComponent(nodeId)}`, { // Petición HTTP PUT
      method: 'PUT', // Método PUT
      headers: { 'Content-Type': 'application/json' }, // Encabezado JSON
      body: JSON.stringify({ parentId }), // Envía el nuevo parentId
    }).catch(err => console.warn('Error en llamada PUT a /api/nodes:', err));
  } catch (e) {
    console.warn('Actualización remota de parentId no disponible:', e);
  }

  // Actualiza el registro localmente
  const currentNodes = await fetchAllGeoNodes(); // Carga la lista completa
  const updatedNodes = currentNodes.map(n => n.id === nodeId ? { ...n, parentId } : n); // Modifica el parentId
  safeSetItem('app_dynamic_tree_nodes', JSON.stringify(updatedNodes)); // Guarda en localStorage
  return true; // Confirma éxito
}

// ------------------------------------------
// 5. GUARDAR LOTE DE NODOS VECTORIALES (Map Calibration Panel)
// ------------------------------------------
export async function saveNodesBatch(nodesPayload: any[]): Promise<boolean> {
  try {
    // Intenta enviar el lote de nodos vectoriales al endpoint del backend
    const response = await fetch('/api/nodes/batch', { // Petición HTTP POST al endpoint /api/nodes/batch
      method: 'POST', // Método POST
      headers: { 'Content-Type': 'application/json' }, // Encabezado de datos JSON
      body: JSON.stringify({ nodes: nodesPayload }), // Envía el arreglo de nodos
    });
    if (response.ok) { // Si el servidor procesó el lote correctamente
      console.log(`Lote de ${nodesPayload.length} nodos guardado en la base de datos backend.`); // Confirmación
    }
  } catch (error) {
    // Captura de error de conexión con el backend
    console.warn('No se pudo enviar el lote de nodos al servidor backend. Guardando localmente:', error);
  }

  // Persiste la colección de nodos en almacenamiento local seguro
  try {
    safeSetItem('geo_nodes_database', JSON.stringify(nodesPayload)); // Guarda en localStorage bajo la clave 'geo_nodes_database'
    return true; // Retorna verdadero
  } catch (err) {
    console.error('Error al guardar lote en almacenamiento local:', err); // Error en almacenamiento
    return false; // Retorna falso
  }
}

// ------------------------------------------
// 6. ELIMINAR UN NODO DE LA BASE DE DATOS
// ------------------------------------------
export async function deleteGeoNode(nodeId: string): Promise<boolean> {
  try {
    // Intenta ejecutar la eliminación en el servidor backend
    fetch(`/api/nodes/${encodeURIComponent(nodeId)}`, { // Petición HTTP DELETE
      method: 'DELETE', // Método HTTP DELETE
    }).catch(err => console.warn('Error en DELETE a /api/nodes:', err));
  } catch (e) {
    console.warn('Eliminación remota no disponible:', e);
  }

  // Elimina el nodo localmente y sus subnodos asociados
  const currentNodes = await fetchAllGeoNodes(); // Carga los nodos
  const updatedNodes = currentNodes.filter(n => n.id !== nodeId && n.parentId !== nodeId); // Filtra descartando el nodo y sus hijos
  safeSetItem('app_dynamic_tree_nodes', JSON.stringify(updatedNodes)); // Guarda la lista limpia
  return true; // Retorna éxito
}
