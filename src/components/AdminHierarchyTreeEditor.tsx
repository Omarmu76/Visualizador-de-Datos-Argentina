/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react'; // Importación de React y hooks para gestión de estado
import { 
  FolderTree, 
  ChevronRight, 
  ChevronDown, 
  GripVertical, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  RotateCcw, 
  MapPin, 
  CheckCircle2, 
  Move,
  Eye,
  EyeOff,
  PlusCircle,
  Globe
} from 'lucide-react'; // Íconos Lucide para la interfaz gráfica del árbol jerárquico y visibilidad
import { ProvinceData, MunicipalityData, NavNode, TreeNode } from '../types'; // Importación de tipos TypeScript
import { updateNodeVisibility, updateNodeParent, saveGeoNode, deleteGeoNode } from '../lib/dbService'; // Importación de funciones de persistencia real en BD (Cloud SQL / Drizzle)

// Interfaz para definir las propiedades (props) que recibe el Editor Jerárquico de Administración
interface AdminHierarchyTreeEditorProps {
  treeNodes?: TreeNode[]; // Lista de todos los nodos en el árbol dinámico
  onUpdateTreeNodes?: (nodes: TreeNode[]) => void; // Función para notificar y guardar cambios en el árbol
  allProvinces: Record<string, ProvinceData>; // Mapa completo de provincias de Argentina
  onUpdateProvince: (updatedProvince: ProvinceData) => void; // Función para guardar cambios en una provincia
  onLoadAllProvinces: (loaded: Record<string, ProvinceData>) => void; // Carga masiva de provincias
  onNavigateToNode: (node: NavNode) => void; // Función para viajar rápido al nodo en el mapa
}

// Estructura interna para el renderizado recursivo en árbol de la UI
interface TreeRenderNode extends TreeNode {
  children?: TreeRenderNode[]; // Lista recursiva de subnodos anidados
  originalObject?: ProvinceData | MunicipalityData; // Referencia al objeto de datos original
}

export default function AdminHierarchyTreeEditor({
  treeNodes: propsTreeNodes,
  onUpdateTreeNodes,
  allProvinces,
  onUpdateProvince,
  onLoadAllProvinces,
  onNavigateToNode
}: AdminHierarchyTreeEditorProps) {
  // Estado para controlar qué nodos del árbol están expandidos
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'root': true, // Nodo raíz expandido por defecto
    'world': true, // Nivel mundo expandido
    'continent': true, // Nivel continente expandido
    'country': true // Nivel país (Argentina) expandido
  });

  // Estado local para mantener los nodos del árbol sincronizados con localStorage o props
  const [treeState, setTreeState] = useState<TreeNode[]>(() => {
    if (propsTreeNodes && propsTreeNodes.length > 0) return propsTreeNodes;
    
    // Intenta leer el árbol guardado previamente en almacenamiento local
    const saved = localStorage.getItem('app_dynamic_tree_nodes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Error al parsear app_dynamic_tree_nodes:', e);
      }
    }

    // Estructura oficial predeterminada (Blindaje de Argentina e integración de 24 provincias)
    const provincesList = Object.values(allProvinces).filter(p => p.id !== 'WORLD_MAP' && p.id !== 'CONTINENT_MAP');
    
    const initialNodes: TreeNode[] = [
      { id: 'root', name: 'Plataforma Raíz (Inicio)', parentId: null, isVisible: true, type: 'root' },
      { id: 'world', name: 'Mundo (Vista Global)', parentId: 'root', isVisible: true, type: 'world' },
      { id: 'continent', name: 'América del Sur', parentId: 'world', isVisible: true, type: 'continent' },
      { id: 'country', name: 'República Argentina (24 Provincias)', parentId: 'continent', isVisible: true, type: 'country' }
    ];

    // Agrega las 24 provincias de Argentina como nodos pertenecientes al país 'country'
    provincesList.forEach(prov => {
      initialNodes.push({
        id: prov.id,
        name: prov.name,
        parentId: 'country',
        isVisible: true,
        type: 'provincia'
      });

      // Agrega municipios de la provincia como subnodos
      (prov.municipalities || []).forEach(muni => {
        initialNodes.push({
          id: muni.id,
          name: muni.name,
          parentId: prov.id,
          isVisible: true,
          type: 'subdivision',
          value: muni.value
        });
      });
    });

    return initialNodes;
  });

  // Efecto para sincronizar cuando cambien los props
  useEffect(() => {
    if (propsTreeNodes && propsTreeNodes.length > 0) {
      setTreeState(propsTreeNodes);
    }
  }, [propsTreeNodes]);

  // Función interna para actualizar el estado del árbol y notificar a App.tsx y localStorage
  const saveTreeNodes = (newNodes: TreeNode[]) => {
    setTreeState(newNodes);
    localStorage.setItem('app_dynamic_tree_nodes', JSON.stringify(newNodes));
    if (onUpdateTreeNodes) {
      onUpdateTreeNodes(newNodes);
    }
  };

  // Estado para el nodo en proceso de arrastre Drag & Drop
  const [draggedNode, setDraggedNode] = useState<{ id: string; name: string; type?: string; parentId: string | null } | null>(null);

  // Estado para resaltar el nodo objetivo sobre el que se sobrevuela al arrastrar
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);

  // Estado para notificación toast temporal
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estado para el modo de edición de nombre
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeName, setEditingNodeName] = useState<string>('');

  // Estado para la inserción flexible de nodos (Agregar sub-ruta o nodo raíz)
  const [addingChildToParentId, setAddingChildToParentId] = useState<string | null>(null);
  const [isAddingRoot, setIsAddingRoot] = useState<boolean>(false);
  const [newNodeName, setNewNodeName] = useState<string>('');
  const [newNodeType, setNewNodeType] = useState<string>('custom');

  // Función para mostrar notificación toast flotante
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Alterna la expansión de una rama del árbol
  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // PILAR A: Alterna la propiedad isVisible (Mostrar/Ocultar con ícono de Ojo)
  const handleToggleVisibility = async (nodeId: string) => {
    let nextVis = true; // Booleano para el nuevo estado de visibilidad
    const updated = treeState.map(n => { // Recorre y mapea el estado local
      if (n.id === nodeId) { // Halla el nodo objetivo
        nextVis = !n.isVisible; // Invierte el valor booleano
        showToast(`Visibilidad de '${n.name}' cambiada a: ${nextVis ? 'VISIBLE 👁️' : 'OCULTO 🙈'}`); // Muestra notificación toast
        return { ...n, isVisible: nextVis }; // Retorna nodo con isVisible actualizado
      }
      return n; // Retorna demás nodos intactos
    });
    saveTreeNodes(updated); // Actualiza estado en React y localStorage
    await updateNodeVisibility(nodeId, nextVis); // Ejecuta UPDATE real en la base de datos (Cloud SQL / Drizzle)
  };

  // Construye la estructura jerárquica recursiva a partir del arreglo plano treeState
  const buildTreeHierarchy = (): TreeRenderNode => {
    const mapNodes: Record<string, TreeRenderNode> = {};

    // 1. Inicializa copias con arreglos de hijos limpios
    treeState.forEach(node => {
      mapNodes[node.id] = { ...node, children: [] };
    });

    let rootNode: TreeRenderNode = mapNodes['root'] || {
      id: 'root',
      name: 'Plataforma Raíz (Inicio)',
      parentId: null,
      isVisible: true,
      type: 'root',
      children: []
    };

    // 2. Vincula cada hijo con su nodo padre
    treeState.forEach(node => {
      if (node.id === 'root') return;
      if (node.parentId && mapNodes[node.parentId]) {
        mapNodes[node.parentId].children!.push(mapNodes[node.id]);
      } else {
        // Si no tiene padre explícito o su padre no existe, lo ubica en la raíz
        if (rootNode.children && !rootNode.children.some(c => c.id === node.id)) {
          rootNode.children.push(mapNodes[node.id]);
        }
      }
    });

    return rootNode;
  };

  const fullTree = buildTreeHierarchy();

  // MANEJADORES DRAG & DROP NATIVOS
  const handleDragStart = (e: React.DragEvent, node: TreeNode) => {
    e.stopPropagation();
    setDraggedNode({ id: node.id, name: node.name, type: node.type, parentId: node.parentId });
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedNode && draggedNode.id !== targetNodeId) {
      setDragOverNodeId(targetNodeId);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverNodeId(null);
  };

  // MANEJADOR SOLTADO (Drop): Reorganización jerárquica y actualización de parentId
  const handleDrop = async (e: React.DragEvent, targetParentNode: TreeNode) => {
    e.preventDefault(); // Detiene el comportamiento de soltado predeterminado
    e.stopPropagation(); // Detiene la propagación del evento
    setDragOverNodeId(null); // Resetea el indicador visual

    if (!draggedNode) return; // Cancela si no hay nodo siendo arrastrado
    if (draggedNode.id === targetParentNode.id) { // Valida que no se intente re-parentar a sí mismo
      showToast('Un nodo no puede ser su propio padre.');
      setDraggedNode(null);
      return;
    }

    // Actualiza el parentId del nodo arrastrado en la base de datos de nodos
    const updated = treeState.map(n => {
      if (n.id === draggedNode.id) {
        return { ...n, parentId: targetParentNode.id };
      }
      return n;
    });

    saveTreeNodes(updated); // Actualiza estado local
    await updateNodeParent(draggedNode.id, targetParentNode.id); // Ejecuta UPDATE del parentId en base de datos real
    showToast(`¡Éxito! Se reasignó '${draggedNode.name}' bajo el nodo '${targetParentNode.name}'.`); // Notifica éxito
    setDraggedNode(null); // Limpia estado de arrastre
  };

  // FUNCIÓN PARA GUARDAR RENOMBRADO DE UN NODO
  const handleSaveEditName = async (nodeId: string) => {
    if (!editingNodeName.trim()) return; // Ignora si el nombre está vacío
    let targetNode: TreeNode | undefined; // Variable para almacenar el nodo modificado

    const updated = treeState.map(n => {
      if (n.id === nodeId) {
        targetNode = { ...n, name: editingNodeName.trim() }; // Actualiza el objeto nodo
        return targetNode;
      }
      return n;
    });

    // También actualiza en allProvinces si corresponde a una provincia
    if (allProvinces[nodeId]) {
      const updatedProv = { ...allProvinces[nodeId], name: editingNodeName.trim() };
      onUpdateProvince(updatedProv);
    }

    saveTreeNodes(updated); // Guarda en estado local
    if (targetNode) {
      await saveGeoNode(targetNode); // Ejecuta UPDATE en la base de datos backend
    }
    showToast(`Nodo renombrado a '${editingNodeName.trim()}' exitosamente.`); // Notifica al usuario
    setEditingNodeId(null); // Sale del modo de edición
    setEditingNodeName(''); // Limpia el campo de texto
  };

  // PILAR C: CREACIÓN DE NODO RAÍZ O SUB-RUTA
  const handleCreateNode = async (parentId: string | null) => {
    if (!newNodeName.trim()) return; // Cancela si el nombre está vacío

    const newId = `node_${Date.now()}`; // Genera ID único basado en timestamp
    const newNode: TreeNode = { // Construye el nuevo objeto TreeNode
      id: newId, // Asigna ID
      name: newNodeName.trim(), // Asigna Nombre
      parentId: parentId, // Asigna nodo padre
      isVisible: true, // Establece visibilidad inicial en TRUE
      type: newNodeType || 'custom' // Asigna tipo o nivel
    };

    const updated = [...treeState, newNode]; // Agrega el nuevo nodo al arreglo
    saveTreeNodes(updated); // Guarda estado local
    await saveGeoNode(newNode); // Ejecuta INSERT en la tabla geoNodes de la base de datos

    showToast(`Se creó '${newNodeName.trim()}' exitosamente ${parentId ? 'como sub-ruta' : 'como nodo raíz'}.`); // Notifica éxito
    setAddingChildToParentId(null); // Cierra formulario
    setIsAddingRoot(false); // Cierra formulario raíz
    setNewNodeName(''); // Resetea nombre
  };

  // ELIMINACIÓN DE UN NODO
  const handleDeleteNode = async (nodeId: string, nodeName: string) => {
    if (nodeId === 'root' || nodeId === 'world' || nodeId === 'country') { // Valida protección de nodos núcleo
      showToast('No se pueden eliminar los nodos raíz principales protegidos del sistema.');
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar el nodo '${nodeName}' y removerlo del árbol?`)) return; // Confirmación modal

    const updated = treeState.filter(n => n.id !== nodeId && n.parentId !== nodeId); // Elimina el nodo y sus subnodos
    saveTreeNodes(updated); // Guarda lista limpia
    await deleteGeoNode(nodeId); // Ejecuta DELETE en la base de datos real
    showToast(`Nodo '${nodeName}' eliminado exitosamente.`); // Notifica
  };

  // RESTABLECER ÁRBOL AL ESTADO BASE OFICIAL
  const handleResetTree = () => {
    if (window.confirm('¿Deseas restablecer la jerarquía catastral y de rutas a la estructura oficial predeterminada?')) {
      localStorage.removeItem('app_dynamic_tree_nodes');
      localStorage.removeItem('argentina_data_custom_provinces');
      window.location.reload();
    }
  };

  // COMPONENTE RECURSIVO PARA RENDERIZAR CADA RENGLÓN DEL ÁRBOL
  const renderTreeNode = (node: TreeRenderNode, depth: number = 0) => {
    const isExpanded = !!expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const isBeingDragged = draggedNode?.id === node.id;
    const isDragTarget = dragOverNodeId === node.id;

    // Colores e insignias según nivel
    const levelBadge = 
      node.type === 'root' ? 'bg-purple-950 text-purple-400 border-purple-800' :
      node.type === 'world' ? 'bg-blue-950 text-blue-400 border-blue-800' :
      node.type === 'continent' ? 'bg-sky-950 text-sky-400 border-sky-800' :
      node.type === 'country' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
      node.type === 'provincia' ? 'bg-amber-950 text-amber-400 border-amber-800' :
      'bg-slate-900 text-slate-400 border-slate-800';

    return (
      <div key={node.id} className="flex flex-col text-xs font-sans">
        {/* Renglón principal del nodo con soporte para Drag & Drop */}
        <div
          draggable={node.id !== 'root'}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node)}
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          className={`flex items-center justify-between p-2 my-0.5 rounded-lg border transition-all duration-200 select-none ${
            isBeingDragged ? 'opacity-40 border-dashed border-emerald-500 bg-emerald-950/20' :
            isDragTarget ? 'border-2 border-emerald-400 bg-emerald-900/40 shadow-lg scale-[1.01]' :
            !node.isVisible ? 'bg-slate-950/80 opacity-60 border-slate-900/80' :
            'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          {/* Lado izquierdo: Agarradera Drag, Expandir, Ojo Visibilidad, Insignia y Nombre */}
          <div className="flex items-center space-x-2 overflow-hidden flex-1 mr-2">
            {/* Agarradera de arrastre (Grip) */}
            {node.id !== 'root' && (
              <span className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors" title="Arrastrar para re-parentar">
                <GripVertical size={14} />
              </span>
            )}

            {/* Botón expandir/colapsar rama */}
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(node.id)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-5" />
            )}

            {/* PILAR A: BOTÓN DE VISIBILIDAD DE UN CLIC (OJO EYE / EYE-OFF) */}
            <button
              onClick={() => handleToggleVisibility(node.id)}
              className={`p-1 rounded transition-colors cursor-pointer ${
                node.isVisible 
                  ? 'text-emerald-400 hover:bg-emerald-950/80' 
                  : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
              }`}
              title={node.isVisible ? 'Visible para el Público (Clic para Ocultar)' : 'Oculto para el Público (Clic para Mostrar)'}
            >
              {node.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>

            {/* Insignia del tipo de nivel */}
            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${levelBadge}`}>
              {node.type ? node.type.toUpperCase() : 'NODO'}
            </span>

            {/* Insignia Oculto si isVisible === false */}
            {!node.isVisible && (
              <span className="text-[9px] font-bold bg-red-950/80 text-red-400 border border-red-800 px-1 rounded shrink-0">
                OCULTO
              </span>
            )}

            {/* Nombre del nodo o campo editable */}
            {editingNodeId === node.id ? (
              <div className="flex items-center space-x-1 flex-1">
                <input
                  type="text"
                  value={editingNodeName}
                  onChange={(e) => setEditingNodeName(e.target.value)}
                  className="bg-slate-950 border border-emerald-500 text-white text-xs px-2 py-1 rounded outline-none w-full"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEditName(node.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded cursor-pointer"
                  title="Guardar Nombre"
                >
                  <Save size={12} />
                </button>
              </div>
            ) : (
              <span className={`font-bold text-slate-200 truncate ${!node.isVisible ? 'line-through text-slate-500' : ''}`}>
                {node.name}
              </span>
            )}

            {/* Contador de subelementos contenidos */}
            {hasChildren && (
              <span className="text-[10px] text-slate-500 font-mono font-semibold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                {node.children?.length}
              </span>
            )}
          </div>

          {/* Lado derecho: Botones de acción (Ver en Mapa, Sub-Ruta, Editar, Eliminar) */}
          <div className="flex items-center space-x-1 shrink-0">
            {/* Botón Viaje Rápido al Mapa */}
            <button
              onClick={() => {
                onNavigateToNode({
                  id: node.id,
                  name: node.name,
                  type: node.type
                });
              }}
              className="flex items-center space-x-1 text-[10px] font-bold bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 px-2 py-1 rounded transition-all cursor-pointer"
              title="Ver y centrar en el mapa principal"
            >
              <MapPin size={11} className="text-emerald-400" />
              <span className="hidden sm:inline">VER EN MAPA</span>
            </button>

            {/* PILAR C: Botón Agregar Sub-Ruta (Hijo) */}
            <button
              onClick={() => {
                setAddingChildToParentId(node.id);
                setIsAddingRoot(false);
              }}
              className="p-1 text-sky-400 hover:bg-sky-950/60 rounded border border-transparent hover:border-sky-800 transition-colors cursor-pointer"
              title="Agregar nueva sub-ruta a este nodo"
            >
              <Plus size={13} />
            </button>

            {/* Botón Renombrar */}
            {editingNodeId !== node.id && (
              <button
                onClick={() => {
                  setEditingNodeId(node.id);
                  setEditingNodeName(node.name);
                }}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Editar Nombre"
              >
                <Edit size={13} />
              </button>
            )}

            {/* Botón Eliminar */}
            {node.id !== 'root' && node.id !== 'world' && node.id !== 'country' && (
              <button
                onClick={() => handleDeleteNode(node.id, node.name)}
                className="p-1 text-red-400 hover:bg-red-950/60 rounded transition-colors cursor-pointer"
                title="Eliminar Nodo"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* PILAR C: Formulario desplegable para agregar nueva Sub-Ruta */}
        {addingChildToParentId === node.id && (
          <div className="ml-8 my-2 p-3 bg-slate-900 border border-sky-500/40 rounded-lg flex flex-col space-y-2 animate-fade-in">
            <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center space-x-1">
              <PlusCircle size={12} />
              <span>Agregar Sub-Ruta bajo '{node.name}'</span>
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Nombre del nuevo nodo (ej: Comuna 1, Lote Norte)"
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white text-xs p-1.5 rounded flex-1 outline-none focus:border-sky-500"
                autoFocus
              />
              <select
                value={newNodeType}
                onChange={(e) => setNewNodeType(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs p-1.5 rounded outline-none"
              >
                <option value="custom">Personalizado</option>
                <option value="region">Región</option>
                <option value="country">País</option>
                <option value="provincia">Provincia</option>
                <option value="city">Ciudad / Municipio</option>
                <option value="neighborhood">Barrio / Comuna</option>
              </select>
              <button
                onClick={() => handleCreateNode(node.id)}
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer"
              >
                Crear Nodo
              </button>
              <button
                onClick={() => setAddingChildToParentId(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2 py-1.5 rounded cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Renderizado recursivo de subnodos si la rama está expandida */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {node.children!.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="admin-hierarchy-editor" className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col space-y-4">
      {/* Encabezado del Tree Builder y Panel de Administración */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <FolderTree className="text-emerald-400" size={20} />
            <h2 className="text-lg font-extrabold text-slate-100 tracking-tight">
              Tree Builder - Constructor Jerárquico de Rutas
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">
            Gestiona la Navegación en Árbol. Controla visibilidad con el botón de ojo (👁️/🙈), arrastra y suelta nodos para reasignar su jerarquía (Drag & Drop) y agrega nodos raíz o sub-rutas infinitas.
          </p>
        </div>

        {/* Botonera Superior: Agregar Nodo Raíz & Reiniciar */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => {
              setIsAddingRoot(true);
              setAddingChildToParentId(null);
            }}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer shadow-lg"
            title="Añadir un nuevo nodo de nivel raíz universal"
          >
            <PlusCircle size={14} />
            <span>➕ AÑADIR NODO RAÍZ</span>
          </button>

          <button
            onClick={handleResetTree}
            className="flex items-center space-x-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer"
            title="Restablecer árbol oficial predeterminado"
          >
            <RotateCcw size={13} />
            <span>REINICIAR</span>
          </button>
        </div>
      </div>

      {/* Formulario de creación para Nodo Raíz */}
      {isAddingRoot && (
        <div className="p-4 bg-slate-950 border border-emerald-500/50 rounded-xl flex flex-col space-y-2 animate-fade-in">
          <span className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center space-x-1">
            <Globe size={14} />
            <span>➕ Crear Nuevo Nodo Raíz Universal</span>
          </span>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Nombre del nodo raíz (ej: Nuevo Continente, Vía Láctea)"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs p-2 rounded flex-1 outline-none focus:border-emerald-500"
              autoFocus
            />
            <select
              value={newNodeType}
              onChange={(e) => setNewNodeType(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs p-2 rounded outline-none"
            >
              <option value="world">Mundo / Global</option>
              <option value="continent">Continente</option>
              <option value="region">Región Macro</option>
              <option value="custom">Personalizado</option>
            </select>
            <button
              onClick={() => handleCreateNode('root')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded cursor-pointer"
            >
              Crear Raíz
            </button>
            <button
              onClick={() => setIsAddingRoot(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 rounded cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Mensaje Flotante Toast */}
      {toastMessage && (
        <div className="bg-emerald-950/90 border border-emerald-500 text-emerald-200 p-3 rounded-lg flex items-center space-x-2 text-xs font-bold shadow-lg animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Panel de Instrucciones Rápidas de los 4 Pilares */}
      <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="flex items-center space-x-2">
          <Move size={14} className="text-amber-400" />
          <span><b>Instrucción Drag & Drop:</b> Sujeta un nodo con la agarradera y suéltalo sobre otro para re-parentar.</span>
        </span>
        <div className="flex items-center space-x-3 text-[10px]">
          <span className="flex items-center space-x-1 text-emerald-400">
            <Eye size={12} />
            <span>Pilar A: Ojo (Visibilidad)</span>
          </span>
          <span className="flex items-center space-x-1 text-sky-400">
            <FolderTree size={12} />
            <span>Jerarquía Dinámica Infinita</span>
          </span>
        </div>
      </div>

      {/* Renderizado de la estructura completa en Árbol */}
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-[600px] overflow-y-auto space-y-1">
        {renderTreeNode(fullTree, 0)}
      </div>
    </div>
  );
}

