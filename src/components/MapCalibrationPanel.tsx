import React, { useState, useRef, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Move, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Download, 
  Upload, 
  Check, 
  Layers, 
  Info,
  Sliders,
  Image as ImageIcon,
  Maximize2,
  Trash2,
  Eraser,
  Copy,
  FileJson
} from 'lucide-react';
import { ProvinceData } from '../types';
import { provincePaths } from '../data/provincePaths';

interface ImportedPiece {
  id: string;
  name: string;
  d: string;
}

interface MapCalibrationPanelProps {
  selectedProvinceId?: string;
  onSelectProvinceId?: (id: string) => void;
  selectedProvince?: ProvinceData;
  onUpdateProvince?: (province: ProvinceData) => void;
  mapLevels?: { id: string; name: string }[];
  onUpdateMapLevels?: (levels: { id: string; name: string }[]) => void;
}

// ==========================================
// UTILIDADES GEOMÉTRICAS DE ALTA PRECISIÓN
// ==========================================

// Obtiene la caja contenedora (Bounding Box) de un Path SVG a partir de sus coordenadas numéricas
function getPathBBox(d: string) {
  const matches = d.match(/[-+]?[0-9]*\.?[0-9]+/g);
  if (!matches || matches.length < 2) {
    return { x: 260, y: -2, width: 440, height: 964 };
  }
  const numbers = matches.map(Number);
  const xCoords: number[] = [];
  const yCoords: number[] = [];
  
  // Como las rutas SVG M, L, C de nuestro mapa son absolutas, las coordenadas alternan en pares X, Y
  for (let i = 0; i < numbers.length; i += 2) {
    if (i + 1 < numbers.length) {
      xCoords.push(numbers[i]);
      yCoords.push(numbers[i+1]);
    }
  }
  
  if (xCoords.length === 0) {
    return { x: 260, y: -2, width: 440, height: 964 };
  }
  
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

// Obtiene la caja contenedora (Bounding Box) de un conjunto de paths
function getGroupBBox(paths: { d: string }[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  
  paths.forEach(p => {
    const bbox = getPathBBox(p.d);
    if (bbox.width > 0 && bbox.height > 0) {
      minX = Math.min(minX, bbox.x);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      minY = Math.min(minY, bbox.y);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    }
  });
  
  if (minX === Infinity) {
    return { x: 260, y: -2, width: 440, height: 964 };
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export interface PathNode {
  id: number;
  cmd: string;
  x: number;
  y: number;
}

// Parses SVG path into simple nodes
export function parsePathToNodes(d: string): PathNode[] {
  const tokens = d.match(/[a-df-z]|[+-]?(?:\d*\.\d+|\d+)/gi);
  if (!tokens) return [];
  
  const nodes: PathNode[] = [];
  let currentCmd = 'M';
  let i = 0;
  let idCounter = 0;
  
  while (i < tokens.length) {
    const token = tokens[i];
    if (/[a-df-z]/i.test(token)) {
      currentCmd = token;
      i++;
    } else {
      const upperCmd = currentCmd.toUpperCase();
      if (['M', 'L', 'C', 'S', 'Q', 'T'].includes(upperCmd)) {
        const xVal = Number(token);
        const yVal = i + 1 < tokens.length && !/[a-df-z]/i.test(tokens[i+1]) ? Number(tokens[i+1]) : null;
        
        if (yVal !== null) {
          nodes.push({
            id: idCounter++,
            cmd: currentCmd,
            x: xVal,
            y: yVal
          });
          i += 2;
        } else {
          i++;
        }
      } else if (upperCmd === 'H') {
        const xVal = Number(token);
        const lastY = nodes.length > 0 ? nodes[nodes.length - 1].y : 0;
        nodes.push({
          id: idCounter++,
          cmd: currentCmd,
          x: xVal,
          y: lastY
        });
        i++;
      } else if (upperCmd === 'V') {
        const yVal = Number(token);
        const lastX = nodes.length > 0 ? nodes[nodes.length - 1].x : 0;
        nodes.push({
          id: idCounter++,
          cmd: currentCmd,
          x: lastX,
          y: yVal
        });
        i++;
      } else {
        i++;
      }
    }
  }
  return nodes;
}

// Rebuilds path string from modified nodes
export function rebuildPathFromNodes(originalD: string, modifiedNodes: PathNode[]): string {
  const tokens = originalD.match(/[a-df-z]|[+-]?(?:\d*\.\d+|\d+)/gi);
  if (!tokens) return originalD;
  
  let result = '';
  let currentCmd = '';
  let i = 0;
  let nodeIdx = 0;
  
  while (i < tokens.length) {
    const token = tokens[i];
    if (/[a-df-z]/i.test(token)) {
      currentCmd = token;
      result += token + ' ';
      i++;
    } else {
      const upperCmd = currentCmd.toUpperCase();
      if (['M', 'L', 'C', 'S', 'Q', 'T'].includes(upperCmd)) {
        const xVal = Number(token);
        const yVal = i + 1 < tokens.length && !/[a-df-z]/i.test(tokens[i+1]) ? Number(tokens[i+1]) : null;
        
        if (yVal !== null) {
          const modNode = modifiedNodes[nodeIdx++];
          if (modNode) {
            result += `${modNode.x.toFixed(2)},${modNode.y.toFixed(2)} `;
          } else {
            result += `${xVal.toFixed(2)},${yVal.toFixed(2)} `;
          }
          i += 2;
        } else {
          result += `${token} `;
          i++;
        }
      } else if (upperCmd === 'H') {
        const modNode = modifiedNodes[nodeIdx++];
        if (modNode) {
          result += `${modNode.x.toFixed(2)} `;
        } else {
          result += `${token} `;
        }
        i++;
      } else if (upperCmd === 'V') {
        const modNode = modifiedNodes[nodeIdx++];
        if (modNode) {
          result += `${modNode.y.toFixed(2)} `;
        } else {
          result += `${token} `;
        }
        i++;
      } else {
        result += `${token} `;
        i++;
      }
    }
  }
  return result.trim();
}

// Transforma una cadena de ruta SVG aplicando un escalado y desplazamiento respecto a un origen
function transformPathD(
  d: string, 
  translateX: number, 
  translateY: number, 
  scaleX: number, 
  scaleY: number, 
  originX: number, 
  originY: number
): string {
  const tokens = d.match(/[a-df-z]|[+-]?(?:\d*\.\d+|\d+)/gi);
  if (!tokens) return d;
  
  let result = '';
  let currentCmd = '';
  let i = 0;
  
  while (i < tokens.length) {
    const token = tokens[i];
    if (/[a-df-z]/i.test(token)) {
      currentCmd = token;
      result += token;
      i++;
    } else {
      const upperCmd = currentCmd.toUpperCase();
      if (['M', 'L', 'C', 'S', 'Q', 'T'].includes(upperCmd)) {
        const xVal = Number(token);
        const yVal = i + 1 < tokens.length && !/[a-df-z]/i.test(tokens[i+1]) ? Number(tokens[i+1]) : null;
        
        if (yVal !== null) {
          const tx = (xVal - originX) * scaleX + originX + translateX;
          const ty = (yVal - originY) * scaleY + originY + translateY;
          result += `${tx.toFixed(2)},${ty.toFixed(2)} `;
          i += 2;
        } else {
          result += `${token} `;
          i++;
        }
      } else if (upperCmd === 'H') {
        const xVal = Number(token);
        const tx = (xVal - originX) * scaleX + originX + translateX;
        result += `${tx.toFixed(2)} `;
        i++;
      } else if (upperCmd === 'V') {
        const yVal = Number(token);
        const ty = (yVal - originY) * scaleY + originY + translateY;
        result += `${ty.toFixed(2)} `;
        i++;
      } else {
        result += `${token} `;
        i++;
      }
    }
  }
  return result.trim();
}

export default function MapCalibrationPanel({ 
  selectedProvinceId = 'AR-B', 
  onSelectProvinceId,
  selectedProvince,
  onUpdateProvince,
  mapLevels = [],
  onUpdateMapLevels
}: MapCalibrationPanelProps) {
  // Referencias de elementos del DOM
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // --- Estado de Imagen de Referencia (Fondo) ---
  const [imageUrl, setImageUrl] = useState<string>('https://images.unsplash.com/photo-1619551469171-8bda5a782a6f?q=80&w=600&auto=format&fit=crop');
  const [imgWidth, setImgWidth] = useState<number>(440);
  const [imgHeight, setImgHeight] = useState<number>(964);
  const [bgX, setBgX] = useState<number>(260); // Centrada inicialmente en la coordenada SVG base (260)
  const [bgY, setBgY] = useState<number>(-2);  // Centrada inicialmente en la coordenada SVG base (-2)
  const [aspectLocked, setAspectLocked] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<number>(440 / 964);

  // --- Capas de Imagen de Referencia Multi-nivel (Estilo Illustrator/Corel) ---
  interface BgLayer {
    id: string;
    name: string;
    url: string;
    x: number;
    y: number;
    w: number;
    h: number;
    opacity: number;
    filterMode: 'normal' | 'multiply' | 'screen' | 'invert' | 'contrast';
    visible: boolean;
  }

  const [bgLayers, setBgLayers] = useState<BgLayer[]>(() => {
    const saved = localStorage.getItem('argentina_calibrated_bg_layers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Error al restaurar capas de fondo:', e);
      }
    }
    return [
      {
        id: 'layer_base',
        name: 'Mapa Base de Referencia',
        url: 'https://images.unsplash.com/photo-1619551469171-8bda5a782a6f?q=80&w=600&auto=format&fit=crop',
        x: 260,
        y: -2,
        w: 440,
        h: 964,
        opacity: 60,
        filterMode: 'normal',
        visible: true
      }
    ];
  });
  const [selectedBgLayerId, setSelectedBgLayerId] = useState<string>('layer_base');

  // Guardar capas de fondo en localStorage
  useEffect(() => {
    localStorage.setItem('argentina_calibrated_bg_layers', JSON.stringify(bgLayers));
  }, [bgLayers]);

  // --- Manejadores de Capas de Fondo de Referencia (Illustrator/Corel Style) ---
  const handleAddLayer = (name: string, url: string) => {
    const newLayer: BgLayer = {
      id: `layer_${Date.now()}`,
      name: name || `Capa ${bgLayers.length + 1}`,
      url: url || 'https://images.unsplash.com/photo-1619551469171-8bda5a782a6f?q=80&w=600&auto=format&fit=crop',
      x: 260,
      y: -2,
      w: 440,
      h: 964,
      opacity: 60,
      filterMode: 'normal',
      visible: true
    };
    setBgLayers(prev => [...prev, newLayer]);
    setSelectedBgLayerId(newLayer.id);
    setImageUrl(newLayer.url);
    setBgX(newLayer.x);
    setBgY(newLayer.y);
    setImgWidth(newLayer.w);
    setImgHeight(newLayer.h);
    setFusionOpacity(newLayer.opacity);
    setImageFilterMode(newLayer.filterMode);
    showNotification(`Nueva capa "${newLayer.name}" agregada con éxito`, 'success');
  };

  const handleSelectLayer = (id: string) => {
    const layer = bgLayers.find(l => l.id === id);
    if (layer) {
      setSelectedBgLayerId(id);
      setImageUrl(layer.url);
      setBgX(layer.x);
      setBgY(layer.y);
      setImgWidth(layer.w);
      setImgHeight(layer.h);
      setFusionOpacity(layer.opacity);
      setImageFilterMode(layer.filterMode);
    }
  };

  const handleToggleLayerVisibility = (id: string) => {
    setBgLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const handleDeleteLayer = (id: string) => {
    if (bgLayers.length <= 1) {
      showNotification('No puedes eliminar la única capa de referencia que queda.', 'error');
      return;
    }
    const filtered = bgLayers.filter(l => l.id !== id);
    setBgLayers(filtered);
    if (selectedBgLayerId === id) {
      handleSelectLayer(filtered[0].id);
    }
    showNotification('Capa de referencia eliminada con éxito', 'success');
  };

  // --- Ámbito de Calibración / Destino de la Transformación ---
  const [transformTarget, setTransformTarget] = useState<'background' | 'vector_group' | 'vector_individual'>('background');

  // --- Transformaciones del Grupo de Vectores (Mapa Completo) ---
  const [groupX, setGroupX] = useState<number>(0);
  const [groupY, setGroupY] = useState<number>(0);
  const [groupScaleX, setGroupScaleX] = useState<number>(1);
  const [groupScaleY, setGroupScaleY] = useState<number>(1);

  // --- Transformaciones de Pieza Individual ---
  const [individualTransforms, setIndividualTransforms] = useState<Record<string, { x: number; y: number; scaleX: number; scaleY: number }>>({});

  // --- Estados de Arrastre y Redimensión Activos ---
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null); // 'tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'
  const dragStart = useRef({ x: 0, y: 0 });
  
  // Copia de seguridad de dimensiones y coordenadas iniciales para redimensionar fluidamente
  const resizeStart = useRef({
    mouseX: 0,
    mouseY: 0,
    boxX: 0,
    boxY: 0,
    boxW: 0,
    boxH: 0,
    aspectRatio: 1
  });

  // --- Visibilidad, Opacidad y Notificaciones ---
  const [visibilityMode, setVisibilityMode] = useState<'fusion' | 'image' | 'vector'>('fusion');
  const [fusionOpacity, setFusionOpacity] = useState<number>(60);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [imageFilterMode, setImageFilterMode] = useState<'normal' | 'multiply' | 'screen' | 'invert' | 'contrast'>('normal');
  const [canvasBgColor, setCanvasBgColor] = useState<string>('#020617');
  const [isProcessingSilhouette, setIsProcessingSilhouette] = useState<boolean>(false);

  // --- Datos de Trazados (Vectoriales) ---
  const [calibratedPaths, setCalibratedPaths] = useState<ImportedPiece[]>(() => {
    const saved = localStorage.getItem('argentina_calibrated_map_paths');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error al restaurar mapas de calibración:', e);
      }
    }
    return [...provincePaths];
  });

  const [importedPieces, setImportedPieces] = useState<ImportedPiece[]>([]);
  const [selectedImportedPieceIndex, setSelectedImportedPieceIndex] = useState<number>(-1);

  // --- Control de Nivel de Calibración (Provincias País vs Subdivisiones de Provincia Seleccionada) ---
  const [calibrationLevel, setCalibrationLevel] = useState<'provinces' | 'subdivisions'>('provinces');
  const [selectedSubdivisionId, setSelectedSubdivisionId] = useState<string>('');
  const [showSubdivisionsPreview, setShowSubdivisionsPreview] = useState<boolean>(true);

  // --- Modos de Visualización de Pantalla y Editor de Nodos/Vértices ---
  const [viewMode, setViewMode] = useState<'nation' | 'province' | 'subdivision'>('nation');
  const [isNodeEditing, setIsNodeEditing] = useState<boolean>(false);
  const [pathNodes, setPathNodes] = useState<PathNode[]>([]);
  const [draggingNodeId, setDraggingNodeId] = useState<number | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState<boolean>(false);

  const [isSimplifiedMode, setIsSimplifiedMode] = useState<boolean>(true);
  const [provinceImages, setProvinceImages] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('argentina_province_guide_images');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    if (selectedProvinceId) {
      const provImg = provinceImages[selectedProvinceId];
      if (provImg) {
        setImageUrl(provImg);
        setBgLayers(prev => prev.map(l => l.id === 'layer_base' ? { ...l, url: provImg } : l));
      } else {
        const defaultImg = 'https://images.unsplash.com/photo-1619551469171-8bda5a782a6f?q=80&w=600&auto=format&fit=crop';
        setImageUrl(defaultImg);
        setBgLayers(prev => prev.map(l => l.id === 'layer_base' ? { ...l, url: defaultImg } : l));
      }
    }
  }, [selectedProvinceId]);

  // Helper functions for active pieces and subdivisions (moved higher for scope resolution)
  const getSubdivisionPieces = (): ImportedPiece[] => {
    if (!selectedProvince) return [];
    return selectedProvince.municipalities.map((m, idx) => {
      let dPath = m.d || '';
      if (!dPath) {
        // Fallbacks para que tengan geometría base que calibrar
        if (idx === 0) dPath = 'M 60,60 L 100,50 L 110,90 L 70,100 Z';
        else if (idx === 1) dPath = 'M 100,50 L 140,60 L 130,110 L 110,90 Z';
        else if (idx === 2) dPath = 'M 70,100 L 110,90 L 100,150 L 60,140 Z';
        else if (idx === 3) dPath = 'M 110,90 L 130,110 L 140,150 L 100,150 Z';
        else if (idx === 4) dPath = 'M 60,140 L 100,150 L 90,180 L 50,170 Z';
        else if (idx === 5) dPath = 'M 100,150 L 140,150 L 130,185 L 90,180 Z';
        else dPath = 'M 140,60 L 170,80 L 160,120 L 130,110 Z';
      }
      return {
        id: m.id,
        name: m.name,
        d: dPath
      };
    });
  };

  const activePieces = React.useMemo<ImportedPiece[]>(() => {
    if (calibrationLevel === 'subdivisions') {
      return getSubdivisionPieces();
    }
    if (selectedProvinceId) {
      return calibratedPaths.filter(p => p.id === selectedProvinceId);
    }
    return calibratedPaths;
  }, [calibrationLevel, calibratedPaths, selectedProvince, selectedProvinceId]);

  const currentSelectedId = calibrationLevel === 'provinces' ? selectedProvinceId : selectedSubdivisionId;

  // --- Editor Manual de Path SVG ---
  const [manualPathD, setManualPathD] = useState<string>('');
  const [showManualPreview, setShowManualPreview] = useState<boolean>(true);

  // --- Estados de Cursor de Precisión y Advertencias de Sincronización ---
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
  const [showSaveWarningModal, setShowSaveWarningModal] = useState<boolean>(false);

  // --- Estados del Módulo de Autotrace de Imágenes ---
  const [traceThreshold, setTraceThreshold] = useState<number>(128);
  const [traceSmoothing, setTraceSmoothing] = useState<number>(2);
  const [traceMinArea, setTraceMinArea] = useState<number>(15);
  const [traceMaxResolution, setTraceMaxResolution] = useState<number>(500);
  const [traceTolerance, setTraceTolerance] = useState<number>(0.8);
  const [generatedNodesCount, setGeneratedNodesCount] = useState<number>(0);
  const [isTracingImage, setIsTracingImage] = useState<boolean>(false);
  const [generatedTracePath, setGeneratedTracePath] = useState<string>('');
  const [newPieceNameInput, setNewPieceNameInput] = useState<string>('');
  const [hideCurrentPaths, setHideCurrentPaths] = useState<boolean>(false);

  // --- Estados de Drag & Drop y Exportación de Código JSON ---
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [exportFormatKey, setExportFormatKey] = useState<'path' | 'd'>('path');
  const [customExportId, setCustomExportId] = useState<string>(currentSelectedId);
  const [customExportName, setCustomExportName] = useState<string>('');
  const [exportActiveTab, setExportActiveTab] = useState<'active_piece' | 'autotrace' | 'all_pieces'>('active_piece');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Sincronizar ID y Nombre de Exportación cuando cambia la pieza activa
  useEffect(() => {
    setCustomExportId(currentSelectedId);
    setCustomExportName(getPieceName(currentSelectedId));
  }, [currentSelectedId, calibratedPaths, selectedProvince]);

  // Sincronizar subdivisión seleccionada por defecto si cambia la provincia o nivel
  useEffect(() => {
    if (selectedProvince && selectedProvince.municipalities && selectedProvince.municipalities.length > 0) {
      setSelectedSubdivisionId(selectedProvince.municipalities[0].id);
    }
  }, [selectedProvince, calibrationLevel]);

  // Sincronizar el editor de texto con el d string de la pieza activa
  useEffect(() => {
    const activePiece = activePieces.find(p => p.id === currentSelectedId);
    if (activePiece) {
      setManualPathD(activePiece.d);
    } else {
      setManualPathD('');
    }
  }, [currentSelectedId, activePieces]);

  // Sincronizar los nodos de vértices interactivos al activar el editor de nodos o cambiar de pieza seleccionada
  useEffect(() => {
    if (isNodeEditing && currentSelectedId) {
      const activePiece = activePieces.find(p => p.id === currentSelectedId);
      if (activePiece) {
        setPathNodes(parsePathToNodes(activePiece.d));
      }
    } else {
      setPathNodes([]);
    }
  }, [isNodeEditing, currentSelectedId, activePieces]);

  // Auto-trazado cuando cambian los parámetros (debocado para evitar parpadeos)
  useEffect(() => {
    if (!imageUrl) return;
    const timer = setTimeout(() => {
      traceImageContours(true); // silent run
    }, 450);
    return () => clearTimeout(timer);
  }, [imageUrl, traceThreshold, traceSmoothing, traceMinArea, traceMaxResolution, traceTolerance]);

  // Sincronizar la capa de fondo seleccionada con los estados reactivos dinámicos
  useEffect(() => {
    setBgLayers(prev => prev.map(l => {
      if (l.id === selectedBgLayerId) {
        return {
          ...l,
          url: imageUrl,
          x: bgX,
          y: bgY,
          w: imgWidth,
          h: imgHeight,
          opacity: fusionOpacity,
          filterMode: imageFilterMode
        };
      }
      return l;
    }));
  }, [imageUrl, bgX, bgY, imgWidth, imgHeight, fusionOpacity, imageFilterMode, selectedBgLayerId]);

  // --- Sincronización de Bounding Boxes (Calculadas al vuelo de forma performante) ---
  const pieceBBox = React.useMemo(() => {
    const selectedPiece = activePieces.find(p => p.id === currentSelectedId);
    if (selectedPiece) {
      return getPathBBox(selectedPiece.d);
    }
    return { x: 260, y: -2, width: 440, height: 964 };
  }, [activePieces, currentSelectedId]);

  const groupBBox = React.useMemo(() => {
    return getGroupBBox(activePieces);
  }, [activePieces]);

  // --- Dimensiones e Hilos de Bounding Box Activo en pantalla ---
  const activeBox = React.useMemo(() => {
    if (transformTarget === 'background') {
      return { x: bgX, y: bgY, w: imgWidth, h: imgHeight };
    } else if (transformTarget === 'vector_group') {
      return {
        x: groupX + groupBBox.x,
        y: groupY + groupBBox.y,
        w: groupBBox.width * groupScaleX,
        h: groupBBox.height * groupScaleY
      };
    } else {
      const t = individualTransforms[currentSelectedId] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
      return {
        x: t.x + pieceBBox.x,
        y: t.y + pieceBBox.y,
        w: pieceBBox.width * t.scaleX,
        h: pieceBBox.height * t.scaleY
      };
    }
  }, [transformTarget, bgX, bgY, imgWidth, imgHeight, groupX, groupY, groupScaleX, groupScaleY, groupBBox, individualTransforms, currentSelectedId, pieceBBox]);

  // Obtener el viewBox dinámico del canvas en base al modo de visualización seleccionado (País vs Provincia aislada vs Municipio aislado)
  const getActiveViewBox = () => {
    const baseViewBox = { x: 260, y: -2, w: 440, h: 964 };
    
    if (viewMode === 'province' && selectedProvince) {
      const activePiece = calibratedPaths.find(p => p.id === selectedProvinceId);
      if (activePiece) {
        const bbox = getPathBBox(activePiece.d);
        const padding = 25; // padding alrededor de la provincia
        return {
          x: bbox.x - padding,
          y: bbox.y - padding,
          w: bbox.width + padding * 2,
          h: bbox.height + padding * 2
        };
      }
    } else if (viewMode === 'subdivision' && selectedProvince) {
      const subPiece = getSubdivisionPieces().find(p => p.id === selectedSubdivisionId);
      if (subPiece) {
        const bbox = getPathBBox(subPiece.d);
        const padding = 15; // padding alrededor del municipio/subdivisión
        return {
          x: bbox.x - padding,
          y: bbox.y - padding,
          w: bbox.width + padding * 2,
          h: bbox.height + padding * 2
        };
      }
    }
    
    return baseViewBox;
  };

  const getProvinceViewBoxString = () => {
    const activePiece = calibratedPaths.find(p => p.id === selectedProvinceId);
    if (activePiece) {
      const bbox = getPathBBox(activePiece.d);
      const padding = 15;
      return `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`;
    }
    return '260 -2 440 964';
  };

  const updateSelectedSubdivisionInPlace = (changes: Partial<any>) => {
    if (!selectedProvince || !onUpdateProvince || !selectedSubdivisionId) return;
    const updatedMunicipalities = selectedProvince.municipalities.map(m => {
      if (m.id === selectedSubdivisionId) {
        return { ...m, ...changes };
      }
      return m;
    });
    onUpdateProvince({
      ...selectedProvince,
      municipalities: updatedMunicipalities
    });
  };

  // Obtener la escala del SVG en relación con los pixeles físicos del contenedor
  const getSvgScale = () => {
    if (!workspaceRef.current) return 1;
    const rect = workspaceRef.current.getBoundingClientRect();
    const activeViewBox = getActiveViewBox();
    return activeViewBox.w / rect.width;
  };

  // Guardar cambios en el localStorage
  const savePathsLocally = (paths: ImportedPiece[]) => {
    setCalibratedPaths(paths);
    localStorage.setItem('argentina_calibrated_map_paths', JSON.stringify(paths));
    localStorage.setItem('argentina_paths_last_updated', String(Date.now()));
  };

  const showNotification = (text: string, type: 'success' | 'info' | 'error') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- Gestor del Candado Aspect Ratio y Redimensión Symmetrical desde el Centro ---
  const handleWidthChange = (val: number) => {
    const oldW = imgWidth;
    const newW = val;
    let newH = imgHeight;
    if (aspectLocked) {
      newH = Math.round(val / aspectRatio);
    }
    const deltaW = newW - oldW;
    const deltaH = newH - imgHeight;
    setBgX(prev => prev - deltaW / 2);
    setBgY(prev => prev - deltaH / 2);
    setImgWidth(newW);
    setImgHeight(newH);
  };

  const handleHeightChange = (val: number) => {
    const oldH = imgHeight;
    const newH = val;
    let newW = imgWidth;
    if (aspectLocked) {
      newW = Math.round(val * aspectRatio);
    }
    const deltaW = newW - imgWidth;
    const deltaH = newH - oldH;
    setBgX(prev => prev - deltaW / 2);
    setBgY(prev => prev - deltaH / 2);
    setImgWidth(newW);
    setImgHeight(newH);
  };

  const handleGroupWidthChange = (val: number) => {
    const currentW = groupBBox.width * groupScaleX;
    const newW = val;
    const deltaW = newW - currentW;
    const newScaleX = val / groupBBox.width;
    
    setGroupScaleX(newScaleX);
    setGroupX(prev => prev - deltaW / 2);

    if (aspectLocked) {
      const currentH = groupBBox.height * groupScaleY;
      const newScaleY = newScaleX;
      const newH = newScaleY * groupBBox.height;
      const deltaH = newH - currentH;
      setGroupScaleY(newScaleY);
      setGroupY(prev => prev - deltaH / 2);
    }
  };

  const handleGroupHeightChange = (val: number) => {
    const currentH = groupBBox.height * groupScaleY;
    const newH = val;
    const deltaH = newH - currentH;
    const newScaleY = val / groupBBox.height;
    
    setGroupScaleY(newScaleY);
    setGroupY(prev => prev - deltaH / 2);

    if (aspectLocked) {
      const currentW = groupBBox.width * groupScaleX;
      const newScaleX = newScaleY;
      const newW = newScaleX * groupBBox.width;
      const deltaW = newW - currentW;
      setGroupScaleX(newScaleX);
      setGroupX(prev => prev - deltaW / 2);
    }
  };

  const handlePieceWidthChange = (val: number) => {
    setIndividualTransforms(prev => {
      const t = prev[currentSelectedId] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
      const currentW = pieceBBox.width * t.scaleX;
      const newW = val;
      const deltaW = newW - currentW;
      const newScaleX = val / pieceBBox.width;

      let newScaleY = t.scaleY;
      let deltaH = 0;
      if (aspectLocked) {
        const currentH = pieceBBox.height * t.scaleY;
        newScaleY = newScaleX;
        const newH = newScaleY * pieceBBox.height;
        deltaH = newH - currentH;
      }

      return {
        ...prev,
        [currentSelectedId]: {
          x: t.x - deltaW / 2,
          y: t.y - deltaH / 2,
          scaleX: newScaleX,
          scaleY: newScaleY
        }
      };
    });
  };

  const handlePieceHeightChange = (val: number) => {
    setIndividualTransforms(prev => {
      const t = prev[currentSelectedId] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
      const currentH = pieceBBox.height * t.scaleY;
      const newH = val;
      const deltaH = newH - currentH;
      const newScaleY = val / pieceBBox.height;

      let newScaleX = t.scaleX;
      let deltaW = 0;
      if (aspectLocked) {
        const currentW = pieceBBox.width * t.scaleX;
        newScaleX = newScaleY;
        const newW = newScaleX * pieceBBox.width;
        deltaW = newW - currentW;
      }

      return {
        ...prev,
        [currentSelectedId]: {
          x: t.x - deltaW / 2,
          y: t.y - deltaH / 2,
          scaleX: newScaleX,
          scaleY: newScaleY
        }
      };
    });
  };

  const toggleAspectLock = () => {
    if (!aspectLocked) {
      setAspectRatio(imgWidth / imgHeight);
    }
    setAspectLocked(!aspectLocked);
  };

  const autoCropImageSilhouette = async (removeColor: 'white' | 'black') => {
    if (!imageUrl) {
      showNotification('Carga primero una imagen de fondo para poder recortar su silueta.', 'error');
      return;
    }

    setIsProcessingSilhouette(true);
    showNotification('Escaneando imagen y eliminando fondo...', 'info');

    try {
      const img = new Image();
      
      const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Error al cargar la imagen para escaneo. Si es una URL externa, puede tener restricciones CORS.'));
      });

      if (imageUrl.startsWith('http') && !imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
        img.crossOrigin = "anonymous";
        const separator = imageUrl.includes('?') ? '&' : '?';
        img.src = `${imageUrl}${separator}cors=${Date.now()}`;
      } else {
        img.src = imageUrl;
      }

      await loadPromise;

      const originalW = img.width;
      const originalH = img.height;

      if (originalW === 0 || originalH === 0) {
        throw new Error('La imagen tiene dimensiones de 0.');
      }

      // 1. Crear canvas offscreen para leer pixels
      const scanCanvas = document.createElement('canvas');
      scanCanvas.width = originalW;
      scanCanvas.height = originalH;
      const scanCtx = scanCanvas.getContext('2d');
      if (!scanCtx) {
        throw new Error('No se pudo inicializar el contexto 2D del Canvas.');
      }

      scanCtx.drawImage(img, 0, 0);
      const imgData = scanCtx.getImageData(0, 0, originalW, originalH);
      const data = imgData.data;

      // Límites de detección
      let minX = originalW;
      let maxX = 0;
      let minY = originalH;
      let maxY = 0;

      // Buscar pixeles que no sean parte del fondo
      // Si removeColor === 'white', el fondo es blanco (R > 230 && G > 230 && B > 230)
      // Si removeColor === 'black', el fondo es negro/oscuro (R < 40 && G < 40 && B < 40)
      // Además, cualquier pixel con opacidad alpha < 15 se considera fondo.
      for (let y = 0; y < originalH; y++) {
        for (let x = 0; x < originalW; x++) {
          const idx = (y * originalW + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          let isBackground = false;
          if (a < 15) {
            isBackground = true;
          } else if (removeColor === 'white') {
            // Fondo blanco o muy claro
            if (r > 225 && g > 225 && b > 225) {
              isBackground = true;
            }
          } else if (removeColor === 'black') {
            // Fondo negro o muy oscuro
            if (r < 35 && g < 35 && b < 35) {
              isBackground = true;
            }
          }

          if (!isBackground) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Validar si encontramos algo
      if (maxX < minX || maxY < minY) {
        showNotification('No se detectó silueta de dibujo no-fondo. Verifica si seleccionaste el color de fondo correcto.', 'error');
        setIsProcessingSilhouette(false);
        return;
      }

      // Añadir un pequeño margen de 2px para no cortar líneas de borde al ras
      minX = Math.max(0, minX - 2);
      minY = Math.max(0, minY - 2);
      maxX = Math.min(originalW - 1, maxX + 2);
      maxY = Math.min(originalH - 1, maxY + 2);

      const croppedW = maxX - minX + 1;
      const croppedH = maxY - minY + 1;

      // 2. Crear un canvas para la imagen recortada con fondo transparente
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = croppedW;
      cropCanvas.height = croppedH;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) {
        throw new Error('No se pudo inicializar el Canvas de recorte.');
      }

      // Obtener el fragmento recortado
      const croppedData = scanCtx.getImageData(minX, minY, croppedW, croppedH);
      const cData = croppedData.data;

      // Limpiar el fondo en la imagen recortada haciéndola real PNG transparente
      for (let i = 0; i < cData.length; i += 4) {
        const r = cData[i];
        const g = cData[i + 1];
        const b = cData[i + 2];
        const a = cData[i + 3];

        if (a < 15) {
          cData[i + 3] = 0;
        } else if (removeColor === 'white') {
          if (r > 225 && g > 225 && b > 225) {
            cData[i + 3] = 0;
          }
        } else if (removeColor === 'black') {
          if (r < 35 && g < 35 && b < 35) {
            cData[i + 3] = 0;
          }
        }
      }

      cropCtx.putImageData(croppedData, 0, 0);

      // 3. Convertir a dataURL PNG con transparencia
      const croppedDataUrl = cropCanvas.toDataURL("image/png");

      // 4. Calcular el escalado actual del SVG
      const scaleX = imgWidth / originalW;
      const scaleY = imgHeight / originalH;

      // Nuevos valores para que la silueta no se mueva del lugar físico donde estaba
      const newBgX = bgX + minX * scaleX;
      const newBgY = bgY + minY * scaleY;
      const newImgW = croppedW * scaleX;
      const newImgH = croppedH * scaleY;

      // 5. Aplicar cambios
      setBgX(newBgX);
      setBgY(newBgY);
      setImgWidth(newImgW);
      setImgHeight(newImgH);
      setAspectRatio(newImgW / newImgH);
      setImageUrl(croppedDataUrl);
      
      // Forzar que el target de transformación sea 'background' para ver los manejadores ajustados al instante
      setTransformTarget('background');

      showNotification(`[✓] ¡Fondo ${removeColor === 'white' ? 'blanco' : 'negro'} eliminado! Silueta ajustada a ${Math.round(newImgW)}x${Math.round(newImgH)}px`, 'success');
    } catch (err: any) {
      console.error(err);
      showNotification(`No se pudo procesar la silueta: ${err.message}`, 'error');
    } finally {
      setIsProcessingSilhouette(false);
    }
  };

  // --- Gestor del Arrastre con Mano (Mover Elemento Seleccionado) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    const isTargetHandle = (e.target as HTMLElement).closest('#bounding-box-group');
    if (isTargetHandle) return; // Permitir que los handles manejen su propio redimensionado

    setIsDragging(true);
    
    let currentX = 0;
    let currentY = 0;
    
    if (transformTarget === 'background') {
      currentX = bgX;
      currentY = bgY;
    } else if (transformTarget === 'vector_group') {
      currentX = groupX;
      currentY = groupY;
    } else {
      const t = individualTransforms[currentSelectedId] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
      currentX = t.x;
      currentY = t.y;
    }

    const scale = getSvgScale();
    dragStart.current = {
      x: e.clientX - (currentX / scale),
      y: e.clientY - (currentY / scale)
    };
  };

  // --- Arrastre y Redimensión Global (con soporte fuera del Canvas) ---
  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const scale = getSvgScale();
      const newX = (e.clientX - dragStart.current.x) * scale;
      const newY = (e.clientY - dragStart.current.y) * scale;

      if (transformTarget === 'background') {
        setBgX(newX);
        setBgY(newY);
      } else if (transformTarget === 'vector_group') {
        setGroupX(newX);
        setGroupY(newY);
      } else {
        setIndividualTransforms(prev => {
          const t = prev[currentSelectedId] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
          return {
            ...prev,
            [currentSelectedId]: { ...t, x: newX, y: newY }
          };
        });
      }
      return;
    }

    if (!isResizing || !resizeHandle) return;

    const scale = getSvgScale();
    const deltaX = (e.clientX - resizeStart.current.mouseX) * scale;
    const deltaY = (e.clientY - resizeStart.current.mouseY) * scale;

    const centerX = resizeStart.current.boxX + resizeStart.current.boxW / 2;
    const centerY = resizeStart.current.boxY + resizeStart.current.boxH / 2;

    let newW = resizeStart.current.boxW;
    let newH = resizeStart.current.boxH;

    // Calcular cambio simétrico desde el centro en base al handle seleccionado
    if (['mr', 'tr', 'br'].includes(resizeHandle)) {
      newW = Math.max(10, resizeStart.current.boxW + 2 * deltaX);
    }
    if (['ml', 'tl', 'bl'].includes(resizeHandle)) {
      newW = Math.max(10, resizeStart.current.boxW - 2 * deltaX);
    }
    if (['bc', 'bl', 'br'].includes(resizeHandle)) {
      newH = Math.max(10, resizeStart.current.boxH + 2 * deltaY);
    }
    if (['tc', 'tl', 'tr'].includes(resizeHandle)) {
      newH = Math.max(10, resizeStart.current.boxH - 2 * deltaY);
    }

    const lockRatio = aspectLocked || e.shiftKey;
    const ratio = resizeStart.current.aspectRatio;

    // Aplicar candado de relación de aspecto
    if (lockRatio) {
      if (['mr', 'ml'].includes(resizeHandle)) {
        newH = newW / ratio;
      } else if (['tc', 'bc'].includes(resizeHandle)) {
        newW = newH * ratio;
      } else {
        const scaleW = newW / resizeStart.current.boxW;
        const scaleH = newH / resizeStart.current.boxH;
        const finalScale = (scaleW + scaleH) / 2;

        newW = resizeStart.current.boxW * finalScale;
        newH = resizeStart.current.boxH * finalScale;
      }
    }

    // Al redimensionar desde el centro, la posición X e Y se calcula para mantener el centro estático
    const newX = centerX - newW / 2;
    const newY = centerY - newH / 2;

    // Actualizar estados del elemento objetivo
    if (transformTarget === 'background') {
      setBgX(newX);
      setBgY(newY);
      setImgWidth(newW);
      setImgHeight(newH);
    } else if (transformTarget === 'vector_group') {
      setGroupX(newX - groupBBox.x);
      setGroupY(newY - groupBBox.y);
      setGroupScaleX(newW / groupBBox.width);
      setGroupScaleY(newH / groupBBox.height);
    } else {
      setIndividualTransforms(prev => {
        const t = prev[currentSelectedId] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
        return {
          ...prev,
          [currentSelectedId]: {
            x: newX - pieceBBox.x,
            y: newY - pieceBBox.y,
            scaleX: newW / pieceBBox.width,
            scaleY: newH / pieceBBox.height
          }
        };
      });
    }
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (isDraggingNode && draggingNodeId !== null) {
        const svgEl = document.getElementById('calibration-svg') as any;
        if (svgEl) {
          const activeViewBox = getActiveViewBox();
          const rect = svgEl.getBoundingClientRect();
          const svgX = activeViewBox.x + ((e.clientX - rect.left) / rect.width) * activeViewBox.w;
          const svgY = activeViewBox.y + ((e.clientY - rect.top) / rect.height) * activeViewBox.h;
          
          setPathNodes(prev => {
            const next = prev.map(node => {
              if (node.id === draggingNodeId) {
                return { ...node, x: svgX, y: svgY };
              }
              return node;
            });
            
            const activePiece = activePieces.find(p => p.id === currentSelectedId);
            if (activePiece) {
              const newD = rebuildPathFromNodes(activePiece.d, next);
              setManualPathD(newD);
              
              if (calibrationLevel === 'provinces') {
                setCalibratedPaths(paths => paths.map(p => p.id === selectedProvinceId ? { ...p, d: newD } : p));
              } else if (selectedProvince && onUpdateProvince) {
                const updatedMunicipalities = selectedProvince.municipalities.map(m => {
                  if (m.id === selectedSubdivisionId) {
                    return { ...m, d: newD };
                  }
                  return m;
                });
                onUpdateProvince({ ...selectedProvince, municipalities: updatedMunicipalities });
              }
            }
            return next;
          });
        }
        return;
      }
      handleGlobalMouseMove(e);
    };

    const handleUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
      setIsDraggingNode(false);
      setDraggingNodeId(null);
    };

    if (isDragging || isResizing || isDraggingNode) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [
    isDragging, 
    isResizing, 
    isDraggingNode, 
    draggingNodeId, 
    transformTarget, 
    currentSelectedId, 
    pieceBBox, 
    groupBBox, 
    bgX, 
    bgY, 
    imgWidth, 
    imgHeight, 
    groupX, 
    groupY, 
    groupScaleX, 
    groupScaleY, 
    individualTransforms,
    calibrationLevel,
    selectedProvince,
    activePieces
  ]);

  // --- Gestor de Evento de Mouse Down en los Manillares ---
  const handleHandleMouseDown = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);

    resizeStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: activeBox.x,
      boxY: activeBox.y,
      boxW: activeBox.w,
      boxH: activeBox.h,
      aspectRatio: activeBox.w / activeBox.h
    };
  };

  // --- Controladores por Teclado e Inputs Numéricos ---
  const handleNumericInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    val: number,
    setter: (newVal: number) => void
  ) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const direction = e.key === 'ArrowUp' ? 1 : -1;
      setter(val + direction * step);
    }
  };

  // --- Carga Dinámica de Archivos (Fondo o Trazados) ---
  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageUrl(event.target.result as string);
        
        // Crear elemento de imagen temporal para auto-detectar resolución real
        const tempImg = new Image();
        tempImg.onload = () => {
          const w = tempImg.width || 440;
          const h = tempImg.height || 964;
          setImgWidth(w);
          setImgHeight(h);
          setAspectRatio(w / h);
          showNotification(`Imagen cargada con éxito (${w}x${h}px).`, 'success');
        };
        tempImg.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        let piecesList: ImportedPiece[] = [];
        if (Array.isArray(parsed)) {
          piecesList = parsed.map(item => ({
            id: item?.id || '',
            name: item?.name || '',
            d: item?.d || item?.path || ''
          })).filter(item => item.id && item.d);
        } else if (parsed.provinces && Array.isArray(parsed.provinces)) {
          piecesList = parsed.provinces.map((item: any) => ({
            id: item?.id || '',
            name: item?.name || '',
            d: item?.d || item?.path || ''
          })).filter((item: any) => item.id && item.d);
        }

        if (piecesList.length > 0) {
          setImportedPieces(piecesList);
          setSelectedImportedPieceIndex(0);
          showNotification(`Se importaron con éxito ${piecesList.length} trazados vectoriales.`, 'success');
        } else {
          showNotification('Formato JSON no soportado. Debe ser un array con objetos {id, name, d}.', 'error');
        }
      } catch (err: any) {
        showNotification(`Error al parsear el JSON: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  // --- Inyección e Reemplazo de Pieza Importada ---
  const handleInjectedReplacement = () => {
    if (selectedImportedPieceIndex < 0 || !importedPieces[selectedImportedPieceIndex]) {
      showNotification('Selecciona primero una pieza importada para inyectar.', 'error');
      return;
    }

    const importedSource = importedPieces[selectedImportedPieceIndex];
    
    if (calibrationLevel === 'provinces') {
      const updated = calibratedPaths.map(piece => {
        if (piece.id === selectedProvinceId) {
          return {
            ...piece,
            d: importedSource.d
          };
        }
        return piece;
      });

      savePathsLocally(updated);
      showNotification(`[✓] ¡Trazado inyectado con éxito para: ${getPieceName(selectedProvinceId)}!`, 'success');
    } else {
      if (selectedProvince && onUpdateProvince) {
        const updatedMunicipalities = selectedProvince.municipalities.map(m => {
          if (m.id === selectedSubdivisionId) {
            return {
              ...m,
              d: importedSource.d
            };
          }
          return m;
        });
        onUpdateProvince({
          ...selectedProvince,
          municipalities: updatedMunicipalities
        });
        showNotification(`[✓] ¡Trazado inyectado con éxito para subdivisión: ${getPieceName(selectedSubdivisionId)}!`, 'success');
      }
    }
  };

  // --- Inyección Combinada de Todos los Caminos del JSON ---
  const handleCombineAndInjectAll = () => {
    if (importedPieces.length === 0) {
      showNotification('No hay piezas importadas cargadas.', 'error');
      return;
    }

    const confirmCombine = window.confirm(
      `¿Deseas combinar los ${importedPieces.length} trazados importados en un único trazado SVG compuesto y reemplazar la pieza actual seleccionada?`
    );
    if (!confirmCombine) return;

    // Concatenar todos los strings d separados por un espacio
    const combinedD = importedPieces.map(piece => piece.d.trim()).join(' ');

    if (calibrationLevel === 'provinces') {
      const updated = calibratedPaths.map(piece => {
        if (piece.id === selectedProvinceId) {
          return {
            ...piece,
            d: combinedD
          };
        }
        return piece;
      });

      savePathsLocally(updated);
      setManualPathD(combinedD);
      showNotification(`[✓] ¡Se combinaron e inyectaron ${importedPieces.length} contornos en la pieza: ${getPieceName(selectedProvinceId)}!`, 'success');
    } else {
      if (selectedProvince && onUpdateProvince) {
        const updatedMunicipalities = selectedProvince.municipalities.map(m => {
          if (m.id === selectedSubdivisionId) {
            return {
              ...m,
              d: combinedD
            };
          }
          return m;
        });
        onUpdateProvince({
          ...selectedProvince,
          municipalities: updatedMunicipalities
        });
        setManualPathD(combinedD);
        showNotification(`[✓] ¡Se combinaron e inyectaron ${importedPieces.length} contornos en la subdivisión: ${getPieceName(selectedSubdivisionId)}!`, 'success');
      }
    }
  };

  // --- Inyección para reemplazar todas las subdivisiones de la provincia activa ---
  const handleReplaceSubdivisionsWithJson = () => {
    if (importedPieces.length === 0) {
      showNotification('No hay piezas importadas cargadas.', 'error');
      return;
    }

    if (calibrationLevel !== 'subdivisions' || !selectedProvince || !onUpdateProvince) {
      showNotification('Debes estar en el nivel de calibración de Sub-Municipios y tener una provincia seleccionada.', 'error');
      return;
    }

    const confirmReplace = window.confirm(
      `¿Deseas reemplazar por completo todas las subdivisiones actuales de la provincia "${selectedProvince.name}" por las ${importedPieces.length} subdivisiones importadas del JSON?`
    );
    if (!confirmReplace) return;

    // Crear la nueva lista de municipalidades a partir del JSON
    const newMunicipalities = importedPieces.map((piece, idx) => ({
      id: piece.id || `subdiv-${idx}`,
      name: piece.name || `Subdivisión ${idx + 1}`,
      d: piece.d,
      value: Math.floor(Math.random() * 80) + 15 // Valor aleatorio por defecto
    }));

    onUpdateProvince({
      ...selectedProvince,
      municipalities: newMunicipalities
    });

    if (newMunicipalities.length > 0) {
      setSelectedSubdivisionId(newMunicipalities[0].id);
    } else {
      setSelectedSubdivisionId('');
    }

    showNotification(`[✓] Se reemplazaron todas las subdivisiones de "${selectedProvince.name}" con ${newMunicipalities.length} elementos del JSON.`, 'success');
  };

  // --- Función para eliminar la pieza o subdivisión seleccionada del mapa ---
  const deleteSelectedPiece = () => {
    if (!currentSelectedId) {
      showNotification('No hay ninguna pieza seleccionada para eliminar.', 'error');
      return;
    }

    const targetName = getPieceName(currentSelectedId);
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar permanentemente la pieza "${targetName}" del mapa? Se eliminará su trazado SVG.`
    );
    if (!confirmDelete) return;

    if (calibrationLevel === 'provinces') {
      const updated = calibratedPaths.filter(p => p.id !== selectedProvinceId);
      savePathsLocally(updated);
      
      // Seleccionar otra provincia si queda alguna
      if (updated.length > 0) {
        if (onSelectProvinceId) onSelectProvinceId(updated[0].id);
      } else {
        if (onSelectProvinceId) onSelectProvinceId('');
      }
      showNotification(`Pieza de mapa "${targetName}" eliminada con éxito del mapa base.`, 'success');
    } else {
      if (!selectedProvince || !onUpdateProvince) return;
      const updatedMunicipalities = selectedProvince.municipalities.filter(m => m.id !== selectedSubdivisionId);
      onUpdateProvince({
        ...selectedProvince,
        municipalities: updatedMunicipalities
      });

      // Seleccionar otra subdivisión si queda alguna
      if (updatedMunicipalities.length > 0) {
        setSelectedSubdivisionId(updatedMunicipalities[0].id);
      } else {
        setSelectedSubdivisionId('');
      }
      showNotification(`Subdivisión "${targetName}" eliminada con éxito de la provincia activa.`, 'success');
    }
  };

  // --- Función para vaciar o limpiar el trazado SVG de la pieza activa seleccionada ---
  const clearSelectedPiecePath = () => {
    if (!currentSelectedId) {
      showNotification('No hay ninguna pieza seleccionada para limpiar.', 'error');
      return;
    }

    const targetName = getPieceName(currentSelectedId);
    const confirmClear = window.confirm(
      `¿Estás seguro de que deseas vaciar el trazado SVG de "${targetName}"? Quedará invisible en el lienzo, lo que te permitirá calcar una nueva forma desde cero con una imagen de fondo.`
    );
    if (!confirmClear) return;

    if (calibrationLevel === 'provinces') {
      const updated = calibratedPaths.map(piece => {
        if (piece.id === selectedProvinceId) {
          return { ...piece, d: '' };
        }
        return piece;
      });
      savePathsLocally(updated);
      setManualPathD('');
      showNotification(`Trazado SVG de "${targetName}" vaciado con éxito.`, 'success');
    } else {
      if (!selectedProvince || !onUpdateProvince) return;
      const updatedMunicipalities = selectedProvince.municipalities.map(m => {
        if (m.id === selectedSubdivisionId) {
          return { ...m, d: '' };
        }
        return m;
      });
      onUpdateProvince({
        ...selectedProvince,
        municipalities: updatedMunicipalities
      });
      setManualPathD('');
      showNotification(`Trazado SVG de la subdivisión "${targetName}" vaciado con éxito.`, 'success');
    }
  };

  // --- Algoritmo Ramer-Douglas-Peucker (RDP) para simplificación inteligente ---
  interface RDPPoint {
    x: number;
    y: number;
  }

  const getSqSegDist = (p: RDPPoint, p1: RDPPoint, p2: RDPPoint): number => {
    let x = p1.x;
    let y = p1.y;
    let dx = p2.x - x;
    let dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2.x;
        y = p2.y;
      } else if (t > 0) {
        x += dx * t;
      }
    }

    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
  };

  const simplifyDPStep = (
    points: RDPPoint[],
    first: number,
    last: number,
    sqTolerance: number,
    simplified: RDPPoint[]
  ) => {
    let maxSqDist = sqTolerance;
    let index = -1;

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (index > -1) {
      if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
      simplified.push(points[index]);
      if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
    }
  };

  const simplifyRDP = (points: RDPPoint[], tolerance: number): RDPPoint[] => {
    if (points.length <= 2) return points;
    const sqTolerance = tolerance * tolerance;
    const simplified: RDPPoint[] = [points[0]];
    simplifyDPStep(points, 0, points.length - 1, sqTolerance, simplified);
    simplified.push(points[points.length - 1]);
    return simplified;
  };

  // --- MOTOR ASÍNCRONO DE AUTOTRAZADO Y VECTORIZACIÓN LOCAL ---
  const traceImageContours = async (silent: boolean = false) => {
    if (!imageUrl) {
      if (!silent) showNotification('Carga primero una imagen de fondo de referencia para poder vectorizarla.', 'error');
      return;
    }
    setIsTracingImage(true);
    setGeneratedTracePath('');
    setGeneratedNodesCount(0);
    if (!silent) {
      showNotification('Iniciando calco inteligente y vectorización de bordes por umbral...', 'info');
    }
 
    try {
      const img = new Image();
      
      const loadPromise = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('No se pudo cargar la imagen de referencia. Si procede de un dominio externo, verifique políticas CORS.'));
      });

      if (imageUrl.startsWith('http') && !imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
        img.crossOrigin = "anonymous";
        const separator = imageUrl.includes('?') ? '&' : '?';
        img.src = `${imageUrl}${separator}cors=${Date.now()}`;
      } else {
        img.src = imageUrl;
      }
 
      await loadPromise;
 
      const originalW = img.width;
      const originalH = img.height;
 
      if (originalW === 0 || originalH === 0) {
        throw new Error('La imagen de fondo contiene dimensiones nulas o vacías.');
      }

      // Redimensionamiento dinámico/proporcional para optimizar memoria, procesamiento y evitar colapsos
      let w = originalW;
      let h = originalH;
      if (originalW > traceMaxResolution || originalH > traceMaxResolution) {
        if (originalW >= originalH) {
          w = traceMaxResolution;
          h = Math.round((originalH * traceMaxResolution) / originalW);
        } else {
          h = traceMaxResolution;
          w = Math.round((originalW * traceMaxResolution) / originalH);
        }
      }
 
      // Inicializar Canvas temporal para procesamiento de píxeles con la resolución optimizada
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo obtener el contexto 2D para escanear píxeles.');
 
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const pixels = imgData.data;
 
      // Crear buffer binario sólido / vacío (1 / 0)
      const solid = new Uint8Array(w * h);
      
      // Detección automática de transparencia para modular el umbralizador
      let hasAlpha = false;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] < 240) {
          hasAlpha = true;
          break;
        }
      }
 
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const a = pixels[idx + 3];
 
          let isSolid = false;
          if (hasAlpha) {
            isSolid = a >= traceThreshold;
          } else {
            // Imagen opaca: determinamos solidez mediante luminosidad promedio (silueta oscura sobre fondo claro)
            const brightness = (r + g + b) / 3;
            isSolid = brightness < traceThreshold;
          }
          solid[y * w + x] = isSolid ? 1 : 0;
        }
      }
 
      // Direcciones del Moore-Neighborhood (Sentido horario)
      const dirs = [
        { dx: 0, dy: -1 },  // N
        { dx: 1, dy: -1 },  // NE
        { dx: 1, dy: 0 },   // E
        { dx: 1, dy: 1 },   // SE
        { dx: 0, dy: 1 },   // S
        { dx: -1, dy: 1 },  // SW
        { dx: -1, dy: 0 },  // W
        { dx: -1, dy: -1 }  // NW
      ];
 
      const visited = new Uint8Array(w * h);
      const paths: string[] = [];
      let totalNodes = 0;
 
      const isPixelSolid = (px: number, py: number) => {
        if (px < 0 || px >= w || py < 0 || py >= h) return false;
        return solid[py * w + px] === 1;
      };
 
      const scaleW = imgWidth || 440;
      const scaleH = imgHeight || 964;
 
      // Transformar coordenadas locales de la imagen pixel al viewBox calibrado del mapa
      const toSvgCoords = (px: number, py: number) => {
        const sx = bgX + (px / w) * scaleW;
        const sy = bgY + (py / h) * scaleH;
        return { x: Number(sx.toFixed(2)), y: Number(sy.toFixed(2)) };
      };
 
      // Buscar contornos cerrados mediante Moore-Neighbor
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (solid[y * w + x] === 1 && visited[y * w + x] === 0) {
            // Verificar si es un punto frontera (borde)
            let isEdge = false;
            for (let d = 0; d < 8; d++) {
              if (!isPixelSolid(x + dirs[d].dx, y + dirs[d].dy)) {
                isEdge = true;
                break;
              }
            }
 
            if (isEdge) {
              const contourPoints: { x: number; y: number }[] = [];
              let cx = x;
              let cy = y;
 
              let prevX = x - 1;
              let prevY = y;
 
              let backtrackCount = 0;
              const maxSteps = w * h * 2;
 
              do {
                contourPoints.push({ x: cx, y: cy });
                visited[cy * w + cx] = 1;
 
                // Determinar dirección inicial respecto al píxel previo
                let dirIndex = 0;
                const dx = prevX - cx;
                const dy = prevY - cy;
                for (let d = 0; d < 8; d++) {
                  if (dirs[d].dx === dx && dirs[d].dy === dy) {
                    dirIndex = d;
                    break;
                  }
                }
 
                // Explorar vecinos en sentido horario
                let foundNext = false;
                for (let i = 0; i < 8; i++) {
                  const checkIndex = (dirIndex + i) % 8;
                  const nx = cx + dirs[checkIndex].dx;
                  const ny = cy + dirs[checkIndex].dy;
 
                  if (isPixelSolid(nx, ny)) {
                    prevX = cx + dirs[(checkIndex + 7) % 8].dx;
                    prevY = cy + dirs[(checkIndex + 7) % 8].dy;
                    cx = nx;
                    cy = ny;
                    foundNext = true;
                    break;
                  }
                }
 
                if (!foundNext) break;
                backtrackCount++;
              } while ((cx !== x || cy !== y) && backtrackCount < maxSteps);
 
              // Filtrar islas o motas menores al área mínima requerida
              if (contourPoints.length >= traceMinArea) {
                const stepSimplified: { x: number; y: number }[] = [];
                for (let i = 0; i < contourPoints.length; i += traceSmoothing) {
                  stepSimplified.push(contourPoints[i]);
                }
 
                if (stepSimplified.length > 2) {
                  stepSimplified.push(stepSimplified[0]); // Cerrar contorno para RDP
                  
                  // Aplicar algoritmo de simplificación RDP para optimizar rendimiento del renderizado
                  const rdpSimplified = simplifyRDP(stepSimplified, traceTolerance);

                  if (rdpSimplified.length > 2) {
                    const svgPoints = rdpSimplified.map(pt => toSvgCoords(pt.x, pt.y));
                    let pathStr = `M ${svgPoints[0].x},${svgPoints[0].y}`;
                    for (let i = 1; i < svgPoints.length; i++) {
                      pathStr += ` L ${svgPoints[i].x},${svgPoints[i].y}`;
                    }
                    pathStr += ' Z';
                    paths.push(pathStr);
                    totalNodes += rdpSimplified.length;
                  }
                }
              }
            }
          }
        }
      }
 
      if (paths.length === 0) {
        if (!silent) showNotification('No se detectaron contornos. Ajuste el Umbral o reduzca el Área Mínima de escaneo.', 'error');
      } else {
        const fullPath = paths.join(' ');
        setGeneratedTracePath(fullPath);
        setManualPathD(fullPath); // Sincronizar con el editor manual
        setGeneratedNodesCount(totalNodes);
        if (!silent) showNotification(`[✓] ¡Imagen vectorizada con éxito! ${paths.length} contornos extraídos con un total de ${totalNodes} nodos.`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      if (!silent) showNotification(`Ocurrió un error al procesar el autotrazado: ${err.message}`, 'error');
    } finally {
      setIsTracingImage(false);
    }
  };

  const handleCreateNewPiece = (customName: string) => {
    if (!generatedTracePath) {
      showNotification('Debes vectorizar una imagen primero para poder crear una nueva pieza.', 'error');
      return;
    }

    const name = customName.trim() || `Nueva Región Vectorizada #${Math.round(Math.random() * 100)}`;
    const newId = 'custom_' + Math.random().toString(36).substr(2, 9);

    if (calibrationLevel === 'provinces') {
      const newPiece: ImportedPiece = {
        id: newId,
        name,
        d: generatedTracePath
      };
      const updated = [...calibratedPaths, newPiece];
      savePathsLocally(updated);
      showNotification(`[✓] ¡Se creó la nueva provincia/región "${name}" en el mapa base!`, 'success');
    } else {
      if (!selectedProvince || !onUpdateProvince) return;
      const newMuni = {
        id: 'muni_custom_' + Math.random().toString(36).substr(2, 9),
        name,
        d: generatedTracePath,
        value: 0,
        percentage: 0
      };
      const updatedMunicipalities = [...selectedProvince.municipalities, newMuni];
      onUpdateProvince({
        ...selectedProvince,
        municipalities: updatedMunicipalities
      });
      showNotification(`[✓] ¡Se creó la nueva subdivisión municipal "${name}" en la provincia activa!`, 'success');
    }
    setNewPieceNameInput('');
  };

  // --- GUARDADO / CONSOLIDACIÓN DEFINITIVA (Baking de Coordenadas) ---
  const executeBakeAndSave = () => {
    const baked = activePieces.map(p => {
      const bbox = getPathBBox(p.d);
      let pathD = p.d;

      // 1. Aplicar transformaciones individuales relativas a su Bounding Box original
      const t = individualTransforms[p.id] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
      if (t.x !== 0 || t.y !== 0 || t.scaleX !== 1 || t.scaleY !== 1) {
        pathD = transformPathD(pathD, t.x, t.y, t.scaleX, t.scaleY, bbox.x, bbox.y);
      }

      // 2. Aplicar transformaciones globales (de grupo) relativas al Bounding Box del mapa completo
      if (groupX !== 0 || groupY !== 0 || groupScaleX !== 1 || groupScaleY !== 1) {
        pathD = transformPathD(pathD, groupX, groupY, groupScaleX, groupScaleY, groupBBox.x, groupBBox.y);
      }

      return {
        ...p,
        d: pathD
      };
    });

    if (calibrationLevel === 'provinces') {
      savePathsLocally(baked);
      showNotification('¡Calibración horneada y guardada con éxito en los trazados del mapa!', 'success');
    } else {
      if (selectedProvince && onUpdateProvince) {
        const updatedMunicipalities = selectedProvince.municipalities.map(m => {
          const bakedMuni = baked.find(b => b.id === m.id);
          if (bakedMuni) {
            return {
              ...m,
              d: bakedMuni.d
            };
          }
          return m;
        });
        onUpdateProvince({
          ...selectedProvince,
          municipalities: updatedMunicipalities
        });
        showNotification(`¡Calibración horneada y guardada con éxito en las subdivisiones de ${selectedProvince.name}!`, 'success');
      }
    }

    // Limpiar offsets de transformación actuales
    setGroupX(0);
    setGroupY(0);
    setGroupScaleX(1);
    setGroupScaleY(1);
    setIndividualTransforms({});
  };

  const handleBakeAndSave = () => {
    setShowSaveWarningModal(true);
  };

  const resetAlignment = () => {
    setBgX(260);
    setBgY(-2);
    setImgWidth(440);
    setImgHeight(964);
    setAspectRatio(440 / 964);
    setAspectLocked(true);
    setGroupX(0);
    setGroupY(0);
    setGroupScaleX(1);
    setGroupScaleY(1);
    setIndividualTransforms({});
    showNotification('Alineación restablecida a valores base.', 'info');
  };

  const exportCalibratedJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(calibratedPaths, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "mapa_maestro_calibrado.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification('JSON Maestro exportado con éxito.', 'success');
  };

  const getPieceName = (id: string) => {
    return calibratedPaths.find(p => p.id === id)?.name || id;
  };

  // --- Helpers de Exportación de Código Vectorial (Generador) ---
  const getExportedCode = () => {
    const key = exportFormatKey; // 'path' or 'd'
    
    if (exportActiveTab === 'active_piece') {
      const activePiece = activePieces.find(p => p.id === currentSelectedId);
      if (!activePiece) return '// Selecciona una pieza para ver su código';
      const obj = {
        id: customExportId || activePiece.id,
        name: customExportName || activePiece.name,
        [key]: activePiece.d
      };
      return JSON.stringify(obj, null, 2);
    }
    
    if (exportActiveTab === 'autotrace') {
      if (!generatedTracePath) return '// No hay ningún autotrazado generado aún';
      const obj = {
        id: customExportId || 'autotrace-custom',
        name: customExportName || 'Contorno Auto-trazado',
        [key]: generatedTracePath
      };
      return JSON.stringify(obj, null, 2);
    }
    
    // all_pieces
    const piecesList = activePieces.map(p => ({
      id: p.id,
      name: p.name,
      [key]: p.d
    }));
    return JSON.stringify(piecesList, null, 2);
  };

  const handleCopyCode = () => {
    const code = getExportedCode();
    navigator.clipboard.writeText(code)
      .then(() => {
        setIsCopied(true);
        showNotification('¡Código JSON copiado al portapapeles con éxito!', 'success');
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch((err) => {
        console.error('Error copying to clipboard', err);
        showNotification('No se pudo copiar de forma automática. Selecciona el texto del recuadro manualmente.', 'error');
      });
  };

  // --- Controladores de Drag & Drop ---
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/') || file.name.endsWith('.svg')) {
      showNotification(`Imagen/SVG detectado: "${file.name}". Cargando como fondo...`, 'info');
      processImageFile(file);
    } else if (file.name.endsWith('.json')) {
      showNotification(`JSON detectado: "${file.name}". Procesando trazados vectoriales...`, 'info');
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          
          let piecesList: ImportedPiece[] = [];
          if (Array.isArray(parsed)) {
            piecesList = parsed.map(item => ({
              id: item?.id || '',
              name: item?.name || '',
              d: item?.d || item?.path || ''
            })).filter(item => item.id && item.d);
          } else if (parsed.provinces && Array.isArray(parsed.provinces)) {
            piecesList = parsed.provinces.map((item: any) => ({
              id: item?.id || '',
              name: item?.name || '',
              d: item?.d || item?.path || ''
            })).filter((item: any) => item.id && item.d);
          }

          if (piecesList.length > 0) {
            setImportedPieces(piecesList);
            setSelectedImportedPieceIndex(0);
            showNotification(`[✓] Se importaron ${piecesList.length} trazados desde JSON con éxito. Selecciona una opción para inyectarlos.`, 'success');
          } else {
            showNotification('El archivo JSON no contiene trazados vectoriales válidos en formato id/name/d (o path).', 'error');
          }
        } catch (err: any) {
          console.error(err);
          showNotification(`Error al decodificar JSON: ${err.message}`, 'error');
        }
      };
      reader.readAsText(file);
    } else {
      showNotification('Formato de archivo no soportado. Arrastra una imagen de referencia o un archivo JSON de trazados.', 'error');
    }
  };

  const getBgOpacity = () => {
    if (visibilityMode === 'image') return 1;
    if (visibilityMode === 'vector') return 0;
    return fusionOpacity / 100;
  };

  const getSvgOpacity = () => {
    if (visibilityMode === 'image') return 0;
    return 1;
  };

  const handleAddMunicipality = () => {
    if (!selectedProvince) {
      showNotification('Selecciona primero una provincia.', 'error');
      return;
    }
    const name = prompt('Introduce el nombre del nuevo municipio/subdivisión:', 'Nuevo Municipio');
    if (!name) return;
    
    const id = `${selectedProvince.id}-MUNI-${Date.now().toString().slice(-4)}`;
    
    // Obtener un bounding box razonable de la provincia para centrar el nuevo municipio ahí
    const activePiece = calibratedPaths.find(p => p.id === selectedProvinceId);
    let d = 'M 320,320 L 370,320 L 370,370 L 320,370 Z'; // Fallback
    if (activePiece) {
      const bbox = getPathBBox(activePiece.d);
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;
      d = `M ${cx - 20},${cy - 20} L ${cx + 20},${cy - 20} L ${cx + 20},${cy + 20} L ${cx - 20},${cy + 20} Z`;
    }
    
    const newMuni = {
      id,
      name,
      value: 0,
      percentage: 0,
      d,
      paused: false
    };
    
    const updatedProvince = {
      ...selectedProvince,
      municipalities: [...(selectedProvince.municipalities || []), newMuni]
    };
    
    if (onUpdateProvince) {
      onUpdateProvince(updatedProvince);
    }
    
    setSelectedSubdivisionId(id);
    setCalibrationLevel('subdivisions');
    setTransformTarget('vector_individual');
    setViewMode('province');
    showNotification(`[✓] Municipio "${name}" creado. ¡Usa el editor de path o vértices para posicionarlo!`, 'success');
  };

  const handleDeleteMunicipality = (muniId: string) => {
    if (!selectedProvince || !onUpdateProvince) return;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el municipio "${getPieceName(muniId)}"?`)) return;
    
    const updatedMunicipalities = selectedProvince.municipalities.filter(m => m.id !== muniId);
    onUpdateProvince({
      ...selectedProvince,
      municipalities: updatedMunicipalities
    });
    
    if (selectedSubdivisionId === muniId) {
      setSelectedSubdivisionId(updatedMunicipalities[0]?.id || '');
    }
    showNotification('Municipio eliminado con éxito.', 'success');
  };

  const [lvlName, setLvlName] = useState('');
  const [lvlId, setLvlId] = useState('');

  // --- Gestor Administrativo de Niveles de Mapas (Mundo > Continente > País > Provincia > Ciudad > Barrio, etc.) ---
  const renderMapLevelsManager = () => {
    const handleAddLevel = () => {
      if (!lvlName.trim() || !lvlId.trim()) {
        showNotification('Por favor, ingresa el nombre y el ID para el nuevo nivel.', 'error');
        return;
      }
      const cleanedId = lvlId.trim().toLowerCase().replace(/\s+/g, '_');
      if (mapLevels.some(l => l.id === cleanedId)) {
        showNotification('Ya existe un nivel de mapa con ese ID de calibración.', 'error');
        return;
      }
      const updated = [...mapLevels, { id: cleanedId, name: lvlName.trim() }];
      if (onUpdateMapLevels) {
        onUpdateMapLevels(updated);
      }
      setLvlName('');
      setLvlId('');
      showNotification(`Nivel "${lvlName}" agregado con éxito.`, 'success');
    };

    const handleDeleteLevel = (id: string) => {
      if (['world', 'continent', 'country', 'province', 'city', 'neighborhood'].includes(id)) {
        showNotification('No puedes eliminar los niveles esenciales definidos por el sistema.', 'error');
        return;
      }
      const updated = mapLevels.filter(l => l.id !== id);
      if (onUpdateMapLevels) {
        onUpdateMapLevels(updated);
      }
      showNotification('Nivel de mapa eliminado correctamente.', 'success');
    };

    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3 pt-3 border-t-2 border-dashed border-slate-800">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
          <span>⚙️ Gestor de Alcances / Jerarquías</span>
          <span className="text-emerald-400">ADMIN</span>
        </h4>
        <p className="text-[9px] text-slate-500 leading-normal">
          Administra los alcances del mapa interactivo (Mundo &gt; Continente &gt; Nación &gt; Provincia &gt; Ciudad &gt; Barrio). Agrega niveles personalizados para expandir la jerarquía.
        </p>

        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
          {mapLevels.map((lvl) => {
            const isSystem = ['world', 'continent', 'country', 'province', 'city', 'neighborhood'].includes(lvl.id);
            return (
              <div key={lvl.id} className="flex items-center justify-between bg-slate-900/50 p-1.5 rounded border border-slate-850 text-[10px]">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <span className="text-slate-400 font-bold">{lvl.name}</span>
                  <span className="text-slate-600 font-mono text-[8px]">({lvl.id})</span>
                </div>
                {!isSystem ? (
                  <button
                    onClick={() => handleDeleteLevel(lvl.id)}
                    className="text-slate-500 hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                    title="Eliminar nivel"
                  >
                    <Trash2 size={10} />
                  </button>
                ) : (
                  <span className="text-[7px] text-slate-600 bg-slate-950 px-1.5 py-0.2 rounded font-bold uppercase">Sistema</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="text"
            value={lvlName}
            onChange={(e) => {
              setLvlName(e.target.value);
              if (!lvlId) {
                setLvlId(e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_"));
              }
            }}
            placeholder="Nombre (ej: Calles)"
            className="bg-slate-900 border border-slate-800 rounded p-1.5 text-[10px] text-slate-200 outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            value={lvlId}
            onChange={(e) => setLvlId(e.target.value)}
            placeholder="ID (ej: streets)"
            className="bg-slate-900 border border-slate-800 rounded p-1.5 text-[10px] text-slate-200 outline-none focus:border-emerald-500"
          />
        </div>

        <button
          onClick={handleAddLevel}
          className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-850 hover:border-slate-700 rounded text-[9px] font-bold uppercase cursor-pointer transition-colors"
        >
          + Agregar Nivel Personalizado
        </button>
      </div>
    );
  };

  const renderSimplifiedSidebar = () => {
    if (selectedProvince) {
      return (
        <div className="space-y-4">
          {/* Tarjeta de la provincia activa Simplificada */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              📍 Provincia: <strong className="text-emerald-400 font-extrabold">{selectedProvince.name}</strong>
            </span>
            <button 
              onClick={() => {
                if (onSelectProvinceId) onSelectProvinceId('');
                showNotification('Selección limpiada', 'info');
              }}
              className="text-[9px] text-slate-500 hover:text-slate-300 font-bold uppercase cursor-pointer"
            >
              Cambiar
            </button>
          </div>

          {/* SECCIÓN 3: MUNICIPIOS / SUBDIVISIONES & TRAZADOS */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                🧩 3. Municipios y Trazado de Formas
              </h3>
              <button
                onClick={handleAddMunicipality}
                className="text-[9px] bg-emerald-600 hover:bg-emerald-500 text-white font-black px-2 py-1 rounded border border-emerald-500 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>➕</span>
                <span>Agregar Municipio</span>
              </button>
            </div>

            {/* Condicional si hay municipios */}
            {selectedProvince.municipalities && selectedProvince.municipalities.length > 0 ? (
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Municipio / Subdivisión Activa:
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedSubdivisionId}
                      onChange={(e) => {
                        setSelectedSubdivisionId(e.target.value);
                        setCalibrationLevel('subdivisions');
                        setTransformTarget('vector_individual');
                        showNotification(`Municipio activo: ${getPieceName(e.target.value)}`, 'info');
                      }}
                      className="flex-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded p-2 outline-none font-medium focus:border-emerald-500 cursor-pointer"
                    >
                      {selectedProvince.municipalities.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.paused ? '(Pausado)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDeleteMunicipality(selectedSubdivisionId)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded border border-slate-800 transition-all cursor-pointer"
                      title="Eliminar este municipio"
                      disabled={!selectedSubdivisionId}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 p-3 rounded-lg border border-dashed border-slate-800 text-center space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-black block">Esta provincia no tiene subdivisiones aún</span>
                <p className="text-[9px] text-slate-500 leading-normal">
                  Haz clic en "Agregar Municipio" arriba para crear la primera división municipal y poder dibujarla/trazarla de forma interactiva.
                </p>
              </div>
            )}

            {/* Editor manual de Path SVG */}
            <div className="space-y-2 pt-2 border-t border-slate-850/60">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-bold uppercase text-[9px]">✍️ Coordenadas SVG Path de la Pieza</span>
                <label className="flex items-center space-x-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showManualPreview}
                    onChange={(e) => setShowManualPreview(e.target.checked)}
                    className="w-3 h-3 rounded border-slate-800 text-emerald-500 bg-slate-900 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[8px] text-slate-500 uppercase font-bold">Ver Trazado Naranja</span>
                </label>
              </div>

              <textarea
                value={manualPathD}
                onChange={(e) => setManualPathD(e.target.value)}
                className="w-full h-24 bg-slate-900 border border-slate-800 text-slate-300 rounded p-2 text-[10px] font-mono leading-relaxed focus:outline-none focus:border-emerald-500 resize-none font-mono"
                placeholder="Inserta coordenadas de camino d SVG (Ej: M 10,10 L 50,10...)"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (calibrationLevel === 'provinces') {
                      const updated = calibratedPaths.map(piece => {
                        if (piece.id === selectedProvinceId) {
                          return { ...piece, d: manualPathD };
                        }
                        return piece;
                      });
                      savePathsLocally(updated);
                      showNotification(`[✓] Trazado manual guardado para: ${getPieceName(selectedProvinceId)}!`, 'success');
                    } else {
                      if (selectedProvince && onUpdateProvince) {
                        const updatedMunicipalities = selectedProvince.municipalities.map(m => {
                          if (m.id === selectedSubdivisionId) {
                            return { ...m, d: manualPathD };
                          }
                          return m;
                        });
                        onUpdateProvince({
                          ...selectedProvince,
                          municipalities: updatedMunicipalities
                        });
                        showNotification(`[✓] Trazado manual guardado para subdivisión: ${getPieceName(selectedSubdivisionId)}!`, 'success');
                      }
                    }
                  }}
                  disabled={!manualPathD}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-1.5 px-3 rounded text-[10px] transition-colors cursor-pointer text-center disabled:opacity-50"
                >
                  Guardar Coordenadas (Path)
                </button>
                
                <button
                  onClick={() => {
                    setIsNodeEditing(!isNodeEditing);
                    showNotification(isNodeEditing ? 'Editor de nodos desactivado' : 'Editor de nodos activado en el CANVAS', 'success');
                  }}
                  className={`px-3 py-1.5 rounded border text-[10px] font-black uppercase transition-all cursor-pointer ${
                    isNodeEditing
                      ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                  title="Activa el ajuste directo arrastrando vértices interactivos en el lienzo"
                >
                  {isNodeEditing ? '📍 Cerrar Vértices' : '📍 Ajustar Vértices'}
                </button>
              </div>
            </div>
          </div>

          {/* BOTÓN CONSOLIDAR GUARDADO */}
          <button
            onClick={handleBakeAndSave}
            className="w-full bg-emerald-600 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-950/20 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-lg"
          >
            <Check size={16} />
            <span>GUARDAR CAMBIOS DE CALIBRACIÓN</span>
          </button>

          {/* Gestor de niveles y jerarquías dinámicas de mapas */}
          {renderMapLevelsManager()}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mx-auto text-emerald-400">
            <Info size={24} />
          </div>
          <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider">
            Ninguna Provincia Seleccionada
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Haz clic en cualquier provincia o isla en el lienzo interactivo de la izquierda para configurar su calibración individual, calzar su imagen de fondo, o crear/editar sus subdivisiones municipales de forma directa.
          </p>
        </div>

        {/* Selector rápido de provincias en el sidebar */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
            Lista de Provincias ({calibratedPaths.length})
          </span>
          <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
            {calibratedPaths.map(p => {
              const isActive = selectedProvinceId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (onSelectProvinceId) {
                      onSelectProvinceId(p.id);
                      showNotification(`Provincia seleccionada: ${p.name}`, 'info');
                    }
                  }}
                  className={`p-2 rounded text-[10px] font-bold text-left border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
                      : 'bg-slate-900/40 border-slate-850/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  🗺️ {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Configuración global si no hay provincia seleccionada */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
            Configuración Global del Fondo
          </span>
          <p className="text-[10px] text-slate-400 leading-normal">
            También puedes inyectar una imagen de referencia para todo el mapa nacional. Utiliza los controles avanzados para inyectar trazados masivos en formato JSON.
          </p>
          <button
            onClick={() => {
              setIsSimplifiedMode(false);
              showNotification('Accediendo al panel de herramientas de calibración avanzada', 'info');
            }}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded font-bold text-xs cursor-pointer"
          >
            Ir a Herramientas Avanzadas JSON
          </button>
        </div>

        {/* Gestor de niveles y jerarquías dinámicas de mapas */}
        {renderMapLevelsManager()}
      </div>
    );
  };

  return (
    <div 
      id="calibration-panel" 
      className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col font-sans relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Overlay Visual de Drag & Drop */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm border-4 border-dashed border-emerald-500 rounded-xl flex flex-col items-center justify-center p-8 text-center pointer-events-none animate-in fade-in duration-200">
          <div className="p-4 bg-emerald-900/40 rounded-full text-emerald-400 mb-4 animate-bounce">
            <Upload size={48} />
          </div>
          <h2 className="text-xl font-extrabold text-white uppercase tracking-wider">¡Suelta tu archivo aquí!</h2>
          <p className="text-xs text-emerald-300 mt-2 max-w-sm leading-relaxed">
            Puedes arrastrar imágenes (.png, .jpg, .svg) para cargarlas como fondo de referencia, o archivos .json para inyectar trazados vectoriales en el mapa.
          </p>
        </div>
      )}

      {/* Banner de Cabecera */}
      <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="text-emerald-400" size={18} />
            <h2 className="text-xs font-black uppercase tracking-widest text-emerald-400">
              Panel del Administrador
            </h2>
          </div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight mt-1">
            Canvas de Calibración e Interactividad Vectorial
          </h1>
          <p className="text-xs text-slate-400">
            Ajusta, arrastra y escala capas SVG mediante manejadores interactivos con sincronización en espejo.
          </p>
        </div>
        <button
          onClick={exportCalibratedJson}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 px-4 py-2 rounded text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
        >
          <Download size={14} className="text-emerald-400" />
          <span>EXPORTAR MAPA MAESTRO</span>
        </button>
      </div>

      {/* Notificaciones */}
      {notification && (
        <div className={`p-3 px-6 text-xs text-center font-semibold tracking-wide transition-all ${
          notification.type === 'success' ? 'bg-emerald-950 text-emerald-400 border-b border-emerald-800' :
          notification.type === 'error' ? 'bg-red-950 text-red-400 border-b border-red-800' :
          'bg-slate-950 text-slate-400 border-b border-slate-800'
        }`}>
          {notification.text}
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        
        {/* COLUMNA CANVAS EDITORIAL (7 columnas) */}
        <div className="lg:col-span-7 p-6 bg-slate-950/40 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-850">
          
          {/* BARRA SUPERIOR DE SELECCIÓN DE PANTALLA / MODOS DE TRABAJO */}
          {/* Se eliminaron los botones horizontales de navegación superior (PAÍS - NACIÓN, ISOLAR PROVINCIA, AJUSTAR MUNICIPIO) que el usuario tachó con cruces rojas */}
          {/* Conservamos la estructura del contenedor para no alterar el layout y permitir controles del editor de nodos */}
          <div className="w-full bg-slate-950 p-1.5 rounded-lg border border-slate-850 flex flex-wrap gap-1.5 items-center justify-end mb-4 shadow-inner">
            <div className="flex items-center space-x-1.5">
              {viewMode !== 'nation' && (
                <button
                  onClick={() => {
                    setIsNodeEditing(!isNodeEditing);
                    showNotification(isNodeEditing ? 'Editor de nodos desactivado' : 'Editor de nodos activado en el CANVAS', 'success');
                  }}
                  className={`px-2 py-1 rounded border text-[8px] font-black uppercase transition-all ${
                    isNodeEditing
                      ? 'bg-indigo-950 border-indigo-500 text-indigo-400'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
                  }`}
                  title="Permite editar directamente la forma estirando los vértices del trazado SVG interactivo en el lienzo"
                >
                  {isNodeEditing ? '📍 VÉRTICES: SÍ' : '📍 VÉRTICES: NO'}
                </button>
              )}
            </div>
          </div>

          <div className="w-full flex items-center justify-between mb-3 text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center">
              <Info size={12} className="mr-1 text-slate-400" />
              {viewMode === 'nation' ? 'Lienzo Nacional Completo' : viewMode === 'province' ? `Lienzo Principal: Provincia ${getPieceName(selectedProvinceId)}` : `Lienzo Detallado: Subdivisión ${getPieceName(selectedSubdivisionId)}`}
            </span>
            <span className="text-[10px] font-mono">
              viewBox: {viewMode === 'nation' ? '260 -2 440 964' : `${getActiveViewBox().x.toFixed(0)} ${getActiveViewBox().y.toFixed(0)} ${getActiveViewBox().w.toFixed(0)} ${getActiveViewBox().h.toFixed(0)}`}
            </span>
          </div>

          {/* CUERPO DEL AREA DE LIENZOS - LIENZO ÚNICO Y LIMPIO SIN DUPLICADOS */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div 
              ref={workspaceRef}
              id="sandwich-workspace"
              className="relative w-full max-w-[440px] aspect-[440/964] rounded-lg border border-slate-850 overflow-hidden shadow-2xl select-none"
              onMouseDown={handleMouseDown}
              style={{ 
                cursor: isResizing 
                  ? (resizeHandle === 'tl' || resizeHandle === 'br' ? 'nwse-resize' : resizeHandle === 'tr' || resizeHandle === 'bl' ? 'nesw-resize' : resizeHandle === 'tc' || resizeHandle === 'bc' ? 'ns-resize' : 'ew-resize')
                  : hoveredHandle
                    ? hoveredHandle
                    : isDragging 
                      ? 'grabbing' 
                      : 'grab', 
                backgroundColor: canvasBgColor 
              }}
            >
              <svg
                id="calibration-svg"
                viewBox={viewMode === 'nation' ? "260 -2 440 964" : `${getActiveViewBox().x} ${getActiveViewBox().y} ${getActiveViewBox().w} ${getActiveViewBox().h}`}
                className="absolute inset-0 w-full h-full pointer-events-none select-none"
              >
                {/* Capa de Imagen de Fondo */}
                {visibilityMode !== 'vector' && bgLayers.map((layer) => {
                  if (!layer.visible) return null;
                  const isSelected = layer.id === selectedBgLayerId;
                  const url = isSelected ? imageUrl : layer.url;
                  if (!url) return null;
                  
                  const x = isSelected ? bgX : layer.x;
                  const y = isSelected ? bgY : layer.y;
                  const w = isSelected ? imgWidth : layer.w;
                  const h = isSelected ? imgHeight : layer.h;
                  const opacity = isSelected ? getBgOpacity() : (layer.opacity / 100);
                  const filterMode = isSelected ? imageFilterMode : layer.filterMode;
                  
                  return (
                    <image
                      key={layer.id}
                      href={url || undefined}
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      opacity={opacity}
                      className="transition-opacity duration-150 pointer-events-none"
                      style={{
                        mixBlendMode: filterMode === 'multiply' ? 'multiply' : filterMode === 'screen' ? 'screen' : 'normal',
                        filter: filterMode === 'invert' ? 'invert(1)' : filterMode === 'contrast' ? 'contrast(200%) brightness(110%)' : 'none'
                      }}
                    />
                  );
                })}

                {/* Trazado Guía de Silueta */}
                {visibilityMode !== 'image' && !hideCurrentPaths && (!imageUrl || imageUrl.includes('unsplash.com/photo-1619551469171-8bda5a782a6f')) && (
                  <g opacity={0.15}>
                    {activePieces.map(p => (
                      <path
                        key={`guide-${p.id}`}
                        d={p.d}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                      />
                    ))}
                  </g>
                )}

                {/* Superposición de Vista Previa de Subdivisiones */}
                {showSubdivisionsPreview && !hideCurrentPaths && calibrationLevel === 'provinces' && selectedProvince && selectedProvince.municipalities && (
                  <g id="province-subdivisions-preview-group" opacity={0.75}>
                    {selectedProvince.municipalities.map((muni) => {
                      if (muni.paused) return null;
                      const dPath = muni.d || '';
                      if (!dPath) return null;
                      return (
                        <path
                          key={`sub-prev-${muni.id}`}
                          d={dPath}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth={1.2}
                          strokeDasharray="3 1.5"
                          className="pointer-events-none opacity-80"
                        />
                      );
                    })}
                  </g>
                )}

                {/* Capa de Trazados Vectoriales Dinámicos */}
                {visibilityMode !== 'image' && !hideCurrentPaths && (
                  <g 
                    id="group-transform-wrapper"
                    transform={`translate(${groupX + groupBBox.x}, ${groupY + groupBBox.y}) scale(${groupScaleX}, ${groupScaleY}) translate(${-groupBBox.x}, ${-groupBBox.y})`}
                  >
                    {activePieces.map((piece) => {
                      const isSelected = currentSelectedId === piece.id;
                      const bbox = getPathBBox(piece.d);
                      const t = individualTransforms[piece.id] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
                      const pTransform = `translate(${t.x + bbox.x}, ${t.y + bbox.y}) scale(${t.scaleX}, ${t.scaleY}) translate(${-bbox.x}, ${-bbox.y})`;

                      return (
                        <path
                          key={piece.id}
                          d={piece.d}
                          transform={pTransform}
                          fill={isSelected ? 'rgba(16, 185, 129, 0.22)' : 'rgba(30, 41, 59, 0.15)'}
                          stroke={isSelected ? '#10b981' : 'rgba(148, 163, 184, 0.45)'}
                          strokeWidth={isSelected ? 4 : 2}
                          className="transition-all duration-150 pointer-events-auto cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (calibrationLevel === 'provinces') {
                              if (onSelectProvinceId) {
                                onSelectProvinceId(piece.id);
                                showNotification(`Provincia seleccionada: ${piece.name}`, 'info');
                              }
                            } else {
                              setSelectedSubdivisionId(piece.id);
                              showNotification(`Subdivisión seleccionada: ${piece.name}`, 'info');
                            }
                          }}
                          style={{
                            filter: isSelected ? 'drop-shadow(0px 0px 8px #10b981)' : 'none'
                          }}
                        />
                      );
                    })}
                  </g>
                )}

                {/* Capa de Vista Previa Manual */}
                {showManualPreview && manualPathD && (
                  <path
                    d={manualPathD}
                    fill="rgba(249, 115, 22, 0.3)"
                    stroke="#f97316"
                    strokeWidth={3}
                    className="pointer-events-none animate-pulse"
                    style={{ filter: 'drop-shadow(0px 0px 10px #f97316)' }}
                  />
                )}

                {/* Capa de Vista Previa del Autotrace */}
                {generatedTracePath && (
                  <path
                    d={generatedTracePath}
                    fill="rgba(16, 185, 129, 0.25)"
                    stroke="#10b981"
                    strokeWidth={3.5}
                    className="pointer-events-none animate-pulse"
                    style={{ filter: 'drop-shadow(0px 0px 12px #10b981)' }}
                  />
                )}

                {/* CAPA DE BOUNDING BOX INTERACTIVO */}
                {!hideCurrentPaths && (
                  <g id="bounding-box-group">
                    <rect
                      x={activeBox.x}
                      y={activeBox.y}
                      width={activeBox.w}
                      height={activeBox.h}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      className="pointer-events-none"
                    />
                    <text
                      x={activeBox.x + 4}
                      y={activeBox.y - 6}
                      fill="#10b981"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      className="pointer-events-none select-none"
                    >
                      {transformTarget === 'background' ? 'Fondo' : transformTarget === 'vector_group' ? 'Mapa Grupal' : `Pieza: ${getPieceName(currentSelectedId)}`}
                    </text>
                    {[
                      { name: 'tl', cx: activeBox.x, cy: activeBox.y, cursor: 'nwse-resize' },
                      { name: 'tc', cx: activeBox.x + activeBox.w/2, cy: activeBox.y, cursor: 'ns-resize' },
                      { name: 'tr', cx: activeBox.x + activeBox.w, cy: activeBox.y, cursor: 'nesw-resize' },
                      { name: 'ml', cx: activeBox.x, cy: activeBox.y + activeBox.h/2, cursor: 'ew-resize' },
                      { name: 'mr', cx: activeBox.x + activeBox.w, cy: activeBox.y + activeBox.h/2, cursor: 'ew-resize' },
                      { name: 'bl', cx: activeBox.x, cy: activeBox.y + activeBox.h, cursor: 'nesw-resize' },
                      { name: 'bc', cx: activeBox.x + activeBox.w/2, cy: activeBox.y + activeBox.h, cursor: 'ns-resize' },
                      { name: 'br', cx: activeBox.x + activeBox.w, cy: activeBox.y + activeBox.h, cursor: 'nwse-resize' },
                    ].map(h => (
                      <rect
                        key={h.name}
                        x={h.cx - 5}
                        y={h.cy - 5}
                        width={10}
                        height={10}
                        fill="#1e3a8a"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        className="pointer-events-auto transition-transform hover:scale-125"
                        style={{ cursor: h.cursor }}
                        onMouseEnter={() => setHoveredHandle(h.cursor)}
                        onMouseLeave={() => setHoveredHandle(null)}
                        onMouseDown={(e) => handleHandleMouseDown(h.name, e)}
                      />
                    ))}
                  </g>
                )}

                {/* CAPA DE VÉRTICES / NODOS INTERACTIVOS (Direct Node Editing) */}
                {isNodeEditing && pathNodes.map(node => (
                  <circle
                    key={`node-circle-big-${node.id}`}
                    cx={node.x}
                    cy={node.y}
                    r={2.5}
                    fill={draggingNodeId === node.id ? '#f59e0b' : '#10b981'}
                    stroke="#ffffff"
                    strokeWidth={0.6}
                    className="pointer-events-auto cursor-pointer hover:scale-150 transition-transform"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsDraggingNode(true);
                      setDraggingNodeId(node.id);
                    }}
                    style={{ pointerEvents: 'auto' }}
                    title={`Nodo ${node.id} (${node.cmd}): x=${node.x.toFixed(1)}, y=${node.y.toFixed(1)}`}
                  />
                ))}
              </svg>

              {/* Brújula guía indicadora */}
              <div className="absolute bottom-3 right-3 z-20 bg-slate-900/95 text-slate-400 p-2 text-[9px] font-bold rounded border border-slate-800 uppercase tracking-widest pointer-events-none">
                Modo: {visibilityMode}
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 mt-4 text-center leading-relaxed">
            💡 {viewMode === 'nation' ? (
              <span><strong>Gestos:</strong> Arrastra en zonas libres para desplazar todo el lienzo. Usa los tiradores del cuadro verde para escalar.</span>
            ) : (
              <span><strong>Alineación Directa:</strong> Selecciona "Mover Fondo" en los controles y arrastra sobre el lienzo para calzar tu imagen de guía exactamente con el trazado vectorial.</span>
            )}
          </p>
        </div>

        {/* COLUMNA PANEL DE AJUSTES Y CONTROLES (5 columnas) */}
        <div className="lg:col-span-5 p-6 flex flex-col space-y-6 bg-slate-900/40">
          
          {/* Se eliminó la tarjeta visual de BANNER DE TOGGLE DE MODO (Workspace Simplificado/Avanzado) tachada por el usuario */}
          {/* Por defecto, mantenemos el Sidebar Simplificado y Enfocado para una experiencia limpia */}
          {isSimplifiedMode ? (
            renderSimplifiedSidebar()
          ) : (
            <>
              {/* SECCIÓN 1: Fusión y Capas */}
              <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center">
              <Sliders size={14} className="mr-1.5 text-emerald-400" />
              1. Visibilidad, Capas y Jerarquía
            </h3>

            {/* Selector de Nivel de Calibración (Provincias vs Subdivisiones) */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Nivel de Trabajo Vectorial
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCalibrationLevel('provinces')}
                  className={`py-2 px-2 rounded text-[11px] font-bold transition-all cursor-pointer border flex items-center justify-center space-x-1 ${
                    calibrationLevel === 'provinces'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-emerald-950/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>🗺️ Provincias País</span>
                </button>
                <button
                  onClick={() => {
                    if (!selectedProvince) {
                      showNotification('Selecciona primero una provincia en el mapa principal para trabajar sus subdivisiones.', 'error');
                      return;
                    }
                    setCalibrationLevel('subdivisions');
                    setTransformTarget('vector_individual');
                  }}
                  className={`py-2 px-2 rounded text-[11px] font-bold transition-all cursor-pointer border flex items-center justify-center space-x-1 ${
                    calibrationLevel === 'subdivisions'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-emerald-950/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title={selectedProvince ? `Calibrar subdivisiones de ${selectedProvince.name}` : 'Requiere provincia seleccionada'}
                >
                  <span>📍 Subdivs: {selectedProvince?.name ? selectedProvince.name.substring(0, 8) + '...' : 'Provincia'}</span>
                </button>
              </div>

              {/* Selector de Pieza de Subdivisión Activa */}
              {calibrationLevel === 'subdivisions' && selectedProvince && (
                <div className="pt-2 space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Subdivisión Activa para Calibrar:
                  </label>
                  <select
                    value={selectedSubdivisionId}
                    onChange={(e) => {
                      setSelectedSubdivisionId(e.target.value);
                      showNotification(`Subdivisión activa: ${getPieceName(e.target.value)}`, 'info');
                    }}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded p-2 outline-none font-medium focus:border-emerald-500"
                  >
                    {selectedProvince.municipalities.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.paused ? '(Pausado)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Vista Previa / Superposición de Subdivisiones de la Provincia Seleccionada */}
            {selectedProvince && selectedProvince.municipalities && calibrationLevel === 'provinces' && (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex items-center justify-between">
                <div className="flex flex-col space-y-0.5">
                  <span className="text-[11px] font-bold text-slate-300">
                    🔍 Superponer Subdivisiones de {selectedProvince.name}
                  </span>
                  <span className="text-[9px] text-slate-500">
                    Límites municipales guía para calinear
                  </span>
                </div>
                <button
                  onClick={() => setShowSubdivisionsPreview(!showSubdivisionsPreview)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                    showSubdivisionsPreview
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  {showSubdivisionsPreview ? 'ACTIVADO' : 'DESACTIVADO'}
                </button>
              </div>
            )}

            {/* GESTOR DE CAPAS DE FONDO (Illustrator Style) */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1 text-emerald-400 uppercase tracking-wider text-[10px]">
                  📂 Capas de Referencia ({bgLayers.length})
                </span>
                <button
                  onClick={() => {
                    const url = prompt('Introduce la URL de la imagen para la nueva capa:', 'https://images.unsplash.com/photo-1619551469171-8bda5a782a6f?q=80&w=600&auto=format&fit=crop');
                    if (url) {
                      const name = prompt('Nombre de la capa:', `Capa de Referencia ${bgLayers.length + 1}`);
                      handleAddLayer(name || '', url);
                    }
                  }}
                  className="text-[9px] bg-slate-900 hover:bg-slate-850 text-emerald-400 hover:text-emerald-300 font-bold px-2 py-1 rounded border border-slate-800 transition-colors cursor-pointer"
                >
                  + Nueva Capa
                </button>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {bgLayers.map((layer) => {
                  const isActive = layer.id === selectedBgLayerId;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => handleSelectLayer(layer.id)}
                      className={`flex items-center justify-between p-2 rounded transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-emerald-950/40 border-emerald-500/50'
                          : 'bg-slate-900/40 border-slate-900/60 hover:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        {/* Botón de visibilidad */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLayerVisibility(layer.id);
                          }}
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            layer.visible ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-400'
                          }`}
                          title={layer.visible ? 'Ocultar Capa' : 'Mostrar Capa'}
                        >
                          {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>

                        {/* Input para renombrar capa */}
                        <input
                          type="text"
                          value={layer.name}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setBgLayers(prev => prev.map(l => l.id === layer.id ? { ...l, name: newName } : l));
                          }}
                          className={`bg-transparent border-none text-[11px] font-medium outline-none p-0 focus:ring-0 focus:border-none min-w-0 flex-1 ${
                            isActive ? 'text-emerald-400 font-bold' : 'text-slate-300'
                          }`}
                        />
                      </div>

                      <div className="flex items-center space-x-2 ml-2">
                        {/* Badge de activo */}
                        {isActive && (
                          <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded uppercase font-bold">Activa</span>
                        )}
                        {/* Eliminar capa */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLayer(layer.id);
                          }}
                          className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                          title="Eliminar Capa"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'image', label: 'Sólo Guía' },
                { key: 'vector', label: 'Sólo Trazados' },
                { key: 'fusion', label: 'Modo Fusión' }
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => setVisibilityMode(m.key as any)}
                  className={`py-2 px-3 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                    visibilityMode === m.key 
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {visibilityMode === 'fusion' && (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Opacidad de la Imagen</span>
                  <span className="font-bold text-emerald-400">{fusionOpacity}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={fusionOpacity}
                  onChange={(e) => setFusionOpacity(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {/* Filtros de la Imagen de Fondo (Chroma/Silueta) */}
            {visibilityMode !== 'vector' && (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold flex items-center gap-1 text-emerald-400">
                    ✨ Quitar Fondo / Silueta (Visual)
                  </span>
                  <span className="text-[9px] text-slate-500">Transparencia</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: 'normal', label: 'Original', desc: 'Fondo normal' },
                    { key: 'multiply', label: 'Quitar Fondo Blanco', desc: 'Funde blanco a transparente' },
                    { key: 'screen', label: 'Quitar Fondo Negro', desc: 'Funde negro a transparente' },
                    { key: 'invert', label: 'Invertir Colores', desc: 'Líneas blancas/negras' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setImageFilterMode(f.key as any)}
                      className={`p-2 rounded text-[10px] font-bold border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        imageFilterMode === f.key 
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-sm shadow-emerald-900/20' 
                          : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-300'
                      }`}
                      title={f.desc}
                    >
                      <span className="font-extrabold">{f.label}</span>
                      <span className="text-[8px] text-slate-500 font-normal leading-tight">{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recorte Inteligente de Silueta y Bounding Box (Permanente) */}
            {visibilityMode !== 'vector' && imageUrl && (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold flex items-center gap-1 text-sky-400">
                    ✂️ Borrar Fondo y Recortar Silueta
                  </span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase text-sky-500">Auto-Snap</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Elimina los márgenes del fondo y ajusta los manejadores verdes exactamente al ras de las líneas del dibujo.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={isProcessingSilhouette}
                    onClick={() => autoCropImageSilhouette('white')}
                    className="p-2 rounded text-[10px] font-bold border bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-200 transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 disabled:opacity-50"
                  >
                    <span className="text-emerald-400 text-xs">⚪</span>
                    <span className="font-extrabold">Escanear y Cortar (Blanco)</span>
                  </button>
                  <button
                    disabled={isProcessingSilhouette}
                    onClick={() => autoCropImageSilhouette('black')}
                    className="p-2 rounded text-[10px] font-bold border bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-200 transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 disabled:opacity-50"
                  >
                    <span className="text-slate-950 text-xs">⚫</span>
                    <span className="font-extrabold">Escanear y Cortar (Negro)</span>
                  </button>
                </div>
                {isProcessingSilhouette && (
                  <div className="text-[9px] text-emerald-400 font-bold animate-pulse text-center pt-1">
                    ⏳ Analizando píxeles... Ajustando manejadores al dibujo...
                  </div>
                )}
              </div>
            )}

            {/* Selector del Color del Canvas para Contraste */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold flex items-center gap-1 text-amber-400">
                  🎨 Color de Fondo del Canvas
                </span>
                <span className="text-[9px] text-slate-500">Contraste de líneas</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: 'Negro Profundo', value: '#020617' },
                  { name: 'Gris Oscuro', value: '#1e293b' },
                  { name: 'Azul Noche', value: '#0f172a' },
                  { name: 'Blanco Puro', value: '#ffffff' },
                  { name: 'Gris Claro', value: '#f1f5f9' },
                  { name: 'Crema', value: '#fdf6e2' },
                  { name: 'Celeste Suave', value: '#e0f2fe' },
                ].map(c => (
                  <button
                    key={c.value}
                    onClick={() => setCanvasBgColor(c.value)}
                    className={`w-6 h-6 rounded-full border transition-all cursor-pointer relative ${
                      canvasBgColor === c.value 
                        ? 'border-emerald-400 ring-2 ring-emerald-500/40 scale-110 shadow-md' 
                        : 'border-slate-800 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    {canvasBgColor === c.value && (
                      <span 
                        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                        style={{ color: ['#ffffff', '#f1f5f9', '#fdf6e2', '#e0f2fe'].includes(c.value) ? '#020617' : '#ffffff' }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                ))}

                {/* Custom Color ColorPicker Input */}
                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-slate-800 hover:scale-105 transition-all">
                  <input
                    type="color"
                    value={canvasBgColor}
                    onChange={(e) => setCanvasBgColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Color personalizado"
                  />
                  <div 
                    className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 cursor-pointer font-extrabold"
                    style={{ backgroundColor: canvasBgColor }}
                  >
                    🎨
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Ámbito de Calibración */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center">
              <Layers size={14} className="mr-1.5 text-emerald-400" />
              2. Ámbito de Calibración
            </h3>
            
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-850">
              {[
                { key: 'background', label: 'Imagen Fondo' },
                { key: 'vector_group', label: 'Mapa Global' },
                { key: 'vector_individual', label: 'Pieza Unica' }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTransformTarget(t.key as any)}
                  className={`py-1.5 px-2 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    transformTarget === t.key 
                      ? 'bg-emerald-950 border border-emerald-800 text-emerald-400' 
                      : 'border border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            
            <div className="text-[10px] text-slate-500 leading-normal px-1">
              {transformTarget === 'background' && '🎯 Modificando imagen guía de fondo.'}
              {transformTarget === 'vector_group' && '🎯 Modificando el mapa vectorial completo al unísono.'}
              {transformTarget === 'vector_individual' && `🎯 Modificando únicamente la pieza activa: ${getPieceName(currentSelectedId)}.`}
            </div>
          </div>

          {/* SECCIÓN 3: Entradas de Control Numérico por Teclado */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center">
                <Maximize2 size={14} className="mr-1.5 text-emerald-400" />
                3. Valores de Transformación Activos
              </h3>
              <button
                onClick={toggleAspectLock}
                className={`p-1 px-2 rounded border text-[9px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer ${
                  aspectLocked 
                    ? 'bg-emerald-950 border-emerald-800 text-emerald-400' 
                    : 'bg-slate-950 border-slate-850 text-slate-500'
                }`}
                title="Bloquear Proporciones"
              >
                {aspectLocked ? <Lock size={10} /> : <Unlock size={10} />}
                <span>{aspectLocked ? 'PROPORCIONAL' : 'LIBRE'}</span>
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 space-y-4">
              {/* Coordenadas X e Y */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase block">Posición X (SVG px)</label>
                  <input
                    type="number"
                    value={Math.round(activeBox.x)}
                    onKeyDown={(e) => {
                      const setter = (val: number) => {
                        if (transformTarget === 'background') setBgX(val);
                        else if (transformTarget === 'vector_group') setGroupX(val - groupBBox.x);
                        else {
                          setIndividualTransforms(prev => {
                            const t = prev[currentSelectedId] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
                            return { ...prev, [currentSelectedId]: { ...t, x: val - pieceBBox.x } };
                          });
                        }
                      };
                      handleNumericInputKeyDown(e, activeBox.x, setter);
                    }}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (transformTarget === 'background') setBgX(val);
                      else if (transformTarget === 'vector_group') setGroupX(val - groupBBox.x);
                      else {
                        setIndividualTransforms(prev => {
                          const t = prev[currentSelectedId] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
                          return { ...prev, [currentSelectedId]: { ...t, x: val - pieceBBox.x } };
                        });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded p-1.5 text-xs text-center font-mono focus:outline-none focus:border-emerald-500/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase block">Posición Y (SVG px)</label>
                  <input
                    type="number"
                    value={Math.round(activeBox.y)}
                    onKeyDown={(e) => {
                      const setter = (val: number) => {
                        if (transformTarget === 'background') setBgY(val);
                        else if (transformTarget === 'vector_group') setGroupY(val - groupBBox.y);
                        else {
                          setIndividualTransforms(prev => {
                            const t = prev[currentSelectedId] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
                            return { ...prev, [currentSelectedId]: { ...t, y: val - pieceBBox.y } };
                          });
                        }
                      };
                      handleNumericInputKeyDown(e, activeBox.y, setter);
                    }}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (transformTarget === 'background') setBgY(val);
                      else if (transformTarget === 'vector_group') setGroupY(val - groupBBox.y);
                      else {
                        setIndividualTransforms(prev => {
                          const t = prev[currentSelectedId] || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
                          return { ...prev, [currentSelectedId]: { ...t, y: val - pieceBBox.y } };
                        });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded p-1.5 text-xs text-center font-mono focus:outline-none focus:border-emerald-500/40"
                  />
                </div>
              </div>

              {/* Ancho y Alto con Candado Intermedio */}
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase block">Ancho (SVG px)</label>
                  <input
                    type="number"
                    value={Math.round(activeBox.w)}
                    onKeyDown={(e) => {
                      const setter = (val: number) => {
                        if (transformTarget === 'background') handleWidthChange(val);
                        else if (transformTarget === 'vector_group') handleGroupWidthChange(val);
                        else handlePieceWidthChange(val);
                      };
                      handleNumericInputKeyDown(e, activeBox.w, setter);
                    }}
                    onChange={(e) => {
                      const val = Math.max(5, Number(e.target.value));
                      if (transformTarget === 'background') handleWidthChange(val);
                      else if (transformTarget === 'vector_group') handleGroupWidthChange(val);
                      else handlePieceWidthChange(val);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded p-1.5 text-xs text-center font-mono focus:outline-none focus:border-emerald-500/40"
                  />
                </div>

                <div className="flex flex-col items-center justify-center pb-1">
                  <button
                    onClick={toggleAspectLock}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      aspectLocked 
                        ? 'bg-emerald-950 border-emerald-800/80 text-emerald-400 shadow-md shadow-emerald-950/45 scale-110' 
                        : 'bg-slate-900 border-slate-850 text-slate-500 hover:text-slate-300'
                    }`}
                    title={aspectLocked ? 'Desbloquear proporciones' : 'Bloquear proporciones (Mantener aspecto)'}
                  >
                    {aspectLocked ? <Lock size={12} className="animate-pulse" /> : <Unlock size={12} />}
                  </button>
                </div>

                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase block">Alto (SVG px)</label>
                  <input
                    type="number"
                    value={Math.round(activeBox.h)}
                    onKeyDown={(e) => {
                      const setter = (val: number) => {
                        if (transformTarget === 'background') handleHeightChange(val);
                        else if (transformTarget === 'vector_group') handleGroupHeightChange(val);
                        else handlePieceHeightChange(val);
                      };
                      handleNumericInputKeyDown(e, activeBox.h, setter);
                    }}
                    onChange={(e) => {
                      const val = Math.max(5, Number(e.target.value));
                      if (transformTarget === 'background') handleHeightChange(val);
                      else if (transformTarget === 'vector_group') handleGroupHeightChange(val);
                      else handlePieceHeightChange(val);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded p-1.5 text-xs text-center font-mono focus:outline-none focus:border-emerald-500/40"
                  />
                </div>
              </div>

              {/* Botones de Utilidad */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={resetAlignment}
                    className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-slate-200 p-2 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center space-x-1"
                    title="Restablece la escala, rotación y posición de la pieza o grupo seleccionado"
                  >
                    <RefreshCw size={12} />
                    <span>Restablecer</span>
                  </button>
                  <button
                    onClick={clearSelectedPiecePath}
                    className="flex-1 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-950/65 hover:border-amber-600/50 text-amber-400 hover:text-amber-300 p-2 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center space-x-1"
                    title="Vacía el trazado SVG de la pieza actual seleccionada para que quede invisible y puedas calcar una nueva forma desde cero"
                  >
                    <Eraser size={12} />
                    <span>Vaciar Trazado SVG</span>
                  </button>
                </div>
                <button
                  onClick={deleteSelectedPiece}
                  className="w-full bg-red-950/40 hover:bg-red-900/50 border border-red-900/60 hover:border-red-500/50 text-red-400 p-2 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                  title="Elimina de forma permanente la pieza seleccionada del mapa"
                >
                  <Trash2 size={12} />
                  <span>Eliminar Pieza del Mapa Base</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: Gestor de Recursos y Guardado */}
          <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-850">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center">
              <Upload size={14} className="mr-1.5 text-emerald-400" />
              4. Importar y Persistir Ajustes
            </h3>

            {/* Cargar imagen guía de fondo dinámicamente */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase block">Cargar Imagen de Referencia de Fondo</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-850 text-slate-300 rounded p-2 text-xs focus:outline-none focus:border-emerald-500/50 font-mono text-ellipsis overflow-hidden"
                  placeholder="Pegar URL de imagen..."
                />
                <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded cursor-pointer transition-colors flex items-center gap-1">
                  <Upload size={14} />
                  <span>Subir</span>
                  <input
                    type="file"
                    accept="image/*,.svg"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
              {imageUrl && (
                <button
                  onClick={() => {
                    setImageUrl('');
                    setGeneratedTracePath('');
                    setGeneratedNodesCount(0);
                    showNotification('Imagen de fondo eliminada con éxito.', 'info');
                  }}
                  className="w-full bg-red-950/45 hover:bg-red-900/50 border border-red-900/60 text-red-400 font-bold py-1.5 px-3 rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 mt-1"
                >
                  <Trash2 size={12} />
                  <span>🗑️ Eliminar Imagen de Fondo</span>
                </button>
              )}
            </div>

            {/* Cargar JSON Vectorial */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase block">Inyección de Caminos desde JSON</label>
              <div className="relative border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950 p-4 rounded-lg text-center cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleJsonUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload size={16} className="mx-auto text-slate-500 mb-1" />
                <span className="text-[10px] text-slate-400 block font-bold">Subir archivo .json de Trazados</span>
                <span className="text-[9px] text-slate-500 block">Formato: array de objetos {"{id, name, d}"}</span>
              </div>
            </div>

            {/* Selector de Trazado Importado */}
            {importedPieces.length > 0 && (
              <div className="space-y-2.5 p-3 bg-slate-950 rounded-lg border border-slate-850">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Opción A: Inyectar Pieza Individual</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedImportedPieceIndex}
                      onChange={(e) => setSelectedImportedPieceIndex(Number(e.target.value))}
                      className="flex-1 bg-slate-900 border border-slate-800 text-slate-200 rounded p-1.5 text-xs focus:outline-none focus:border-emerald-500/50"
                    >
                      {importedPieces.map((piece, idx) => (
                        <option key={idx} value={idx}>
                          {piece.name || `Pieza ${idx}`} ({piece.id})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleInjectedReplacement}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded text-xs transition-colors cursor-pointer"
                      title="Reemplaza la pieza seleccionada actualmente con esta pieza individual del JSON"
                    >
                      Inyectar
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-900 pt-2.5 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Opción B: Inyectar Fusión Combinada (Súper Útil)</label>
                  <button
                    onClick={handleCombineAndInjectAll}
                    className="w-full bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 hover:border-emerald-500/50 text-emerald-400 font-bold py-1.5 px-3 rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                    title="Combina todos los paths de este JSON en un único path compuesto (M...Z M...Z) y reemplaza la pieza de mapa seleccionada (ideal para las Malvinas)"
                  >
                    <span>🔗 Combinar e Inyectar todos los paths ({importedPieces.length})</span>
                  </button>
                  <span className="text-[8px] text-slate-500 block leading-relaxed">Útil para islas o multi-polígonos. Une todos los caminos en el string de trazado de la pieza seleccionada actual.</span>
                </div>

                {calibrationLevel === 'subdivisions' && (
                  <div className="border-t border-slate-900 pt-2.5 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block">Opción C: Reemplazar Todas las Subdivisiones</label>
                    <button
                      onClick={handleReplaceSubdivisionsWithJson}
                      className="w-full bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/60 hover:border-blue-500/50 text-blue-400 font-bold py-1.5 px-3 rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                      title="Reemplaza la lista completa de municipios/subdivisiones de la provincia activa por los paths individuales de este JSON"
                    >
                      <span>🔄 Reemplazar todas las subdivisiones ({importedPieces.length})</span>
                    </button>
                    <span className="text-[8px] text-slate-500 block leading-relaxed">Convierte cada objeto del JSON en un municipio individual dentro de la provincia activa.</span>
                  </div>
                )}
              </div>
            )}

            {/* Editor de Path SVG (Coordenadas Manuales) - Solicitado por el usuario */}
            <div className="space-y-2 p-3 bg-slate-950 rounded-lg border border-slate-850">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                  ✍️ Editor de Path SVG (Manual)
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Previsualizar</span>
                  <input
                    type="checkbox"
                    checked={showManualPreview}
                    onChange={(e) => setShowManualPreview(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-800 text-emerald-500 bg-slate-900 cursor-pointer focus:ring-0 focus:ring-offset-0"
                    title="Muestra el trazado manual en naranja vibrante en el canvas izquierdo"
                  />
                </label>
              </div>
              <textarea
                value={manualPathD}
                onChange={(e) => setManualPathD(e.target.value)}
                className="w-full h-24 bg-slate-900 border border-slate-800 text-slate-300 rounded p-2 text-[10px] font-mono leading-relaxed focus:outline-none focus:border-emerald-500 resize-none"
                placeholder="Inserta coordenadas de camino d SVG (Ej: M 10,10 L 50,10...)"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (calibrationLevel === 'provinces') {
                      const updated = calibratedPaths.map(piece => {
                        if (piece.id === selectedProvinceId) {
                          return {
                            ...piece,
                            d: manualPathD
                          };
                        }
                        return piece;
                      });
                      savePathsLocally(updated);
                      showNotification(`[✓] Path manual inyectado con éxito para: ${getPieceName(selectedProvinceId)}!`, 'success');
                    } else {
                      if (selectedProvince && onUpdateProvince) {
                        const updatedMunicipalities = selectedProvince.municipalities.map(m => {
                          if (m.id === selectedSubdivisionId) {
                            return {
                              ...m,
                              d: manualPathD
                            };
                          }
                          return m;
                        });
                        onUpdateProvince({
                          ...selectedProvince,
                          municipalities: updatedMunicipalities
                        });
                        showNotification(`[✓] Path manual inyectado con éxito para subdivisión: ${getPieceName(selectedSubdivisionId)}!`, 'success');
                      }
                    }
                  }}
                  disabled={!manualPathD}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-2 rounded text-[10px] transition-colors cursor-pointer text-center disabled:opacity-50"
                >
                  Inyectar en {calibrationLevel === 'provinces' ? 'Provincia' : 'Subdivisión'}
                </button>
                <button
                  onClick={() => {
                    const activePiece = activePieces.find(p => p.id === currentSelectedId);
                    if (activePiece) {
                      setManualPathD(activePiece.d);
                      showNotification('Restablecido al trazado actual de la pieza.', 'info');
                    }
                  }}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-400 py-1 px-2.5 rounded border border-slate-800 text-[10px] font-medium transition-colors cursor-pointer"
                >
                  Reiniciar
                </button>
              </div>
            </div>

            {/* MÓDULO DE VECTORIZACIÓN Y AUTOTRAZADO AUTOMÁTICO */}
            <div className="space-y-3.5 p-4 bg-slate-950 rounded-xl border border-slate-850 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-emerald-400">🔮</span> VECTORIZACIÓN ASISTIDA (AUTOTRACE)
                </span>
                <span className="text-[8px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded-full font-black tracking-widest font-mono uppercase">LOCAL ENGINE</span>
              </div>

              <p className="text-[10px] text-slate-400 leading-normal">
                Genera contornos y trazados de curvas cerradas vectoriales (Paths SVG) directamente desde la imagen de fondo cargada. Ideal para calcar mapas con precisión pixel-perfect.
              </p>

              {/* Botón rápido de visibilidad de trazados actuales */}
              <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded border border-slate-800/65">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-300">👁️ Ocultar Trazados de Base</span>
                  <span className="text-[8px] text-slate-500">Oculta los vectores grises para ver la imagen con nitidez</span>
                </div>
                <button
                  onClick={() => setHideCurrentPaths(!hideCurrentPaths)}
                  className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                    hideCurrentPaths
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                      : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {hideCurrentPaths ? 'OCULTO' : 'VISIBLE'}
                </button>
              </div>

              {/* Parámetros de Calibración de Autotrace */}
              <div className="space-y-3 pt-1">
                {/* Umbral de Opacidad */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400 uppercase">Umbral de Detección</span>
                    <span className="text-emerald-400 font-mono">{traceThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="254"
                    value={traceThreshold}
                    onChange={(e) => setTraceThreshold(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                  />
                  <span className="text-[8px] text-slate-500 block">Mayor valor detecta solo pixeles de máxima densidad u opacidad.</span>
                </div>

                {/* Optimización: Resolución Máxima de Escaneo */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400 uppercase">Resolución Máxima de Escaneo</span>
                    <span className="text-emerald-400 font-mono">{traceMaxResolution}px</span>
                  </div>
                  <input
                    type="range"
                    min="150"
                    max="1200"
                    step="50"
                    value={traceMaxResolution}
                    onChange={(e) => setTraceMaxResolution(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                  />
                  <span className="text-[8px] text-slate-500 block">Redimensiona internamente la imagen para evitar cuelgues de memoria. Menor resolución = ultra-rápido y liviano.</span>
                </div>

                {/* Optimización: Tolerancia de Simplificación RDP */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400 uppercase">Simplificación Inteligente (RDP)</span>
                    <span className="text-emerald-400 font-mono">Tol. {traceTolerance.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="4.0"
                    step="0.1"
                    value={traceTolerance}
                    onChange={(e) => setTraceTolerance(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                  />
                  <span className="text-[8px] text-slate-500 block">Algoritmo Ramer-Douglas-Peucker. Reduce nodos en tramos planos sin deformar la forma.</span>
                </div>

                {/* Suavizado / Simplificación */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400 uppercase">Paso de Filtro Rígido</span>
                    <span className="text-emerald-400 font-mono">Paso {traceSmoothing}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={traceSmoothing}
                    onChange={(e) => setTraceSmoothing(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                  />
                  <span className="text-[8px] text-slate-500 block">Filtra nodos saltándose pixeles fijos. Combínalo con RDP.</span>
                </div>

                {/* Área Mínima de Detección */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400 uppercase">Área Mínima de Isla</span>
                    <span className="text-emerald-400 font-mono">{traceMinArea} px</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="80"
                    value={traceMinArea}
                    onChange={(e) => setTraceMinArea(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                  />
                  <span className="text-[8px] text-slate-500 block">Descarta ruido o islas pequeñas que estén por debajo de este tamaño.</span>
                </div>
              </div>

              {/* Botón de Autotrazado */}
              <button
                disabled={isTracingImage || !imageUrl}
                onClick={() => traceImageContours(false)}
                className="w-full mt-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-emerald-600/30 text-emerald-400 font-black py-2.5 px-3 rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isTracingImage ? (
                  <>
                    <span className="animate-spin text-xs">⏳</span>
                    <span>Procesando Contornos...</span>
                  </>
                ) : (
                  <>
                    <span>🔮 Calcar e Inteligir Silueta</span>
                  </>
                )}
              </button>

              {/* Panel de Decisiones Post-Vectorización & Control de Calidad */}
              {generatedTracePath && (
                <div className="mt-4 p-3.5 bg-slate-900 border border-emerald-500/40 rounded-xl space-y-3.5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="text-[10px] text-emerald-400 font-black tracking-wider uppercase flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1">📊 CONTROL DE CALIDAD VECTORIAL</span>
                    <button 
                      onClick={() => {
                        setGeneratedTracePath('');
                        setHideCurrentPaths(false);
                      }}
                      className="text-slate-500 hover:text-red-400 font-bold font-mono text-[10px] cursor-pointer"
                      title="Descartar trazado"
                    >
                      [CERRAR]
                    </button>
                  </div>

                  <div className="text-[10px] text-slate-300 space-y-2">
                    <p className="leading-relaxed">
                      ¿El nuevo trazado vectorizado (en <span className="text-emerald-400 font-bold text-[11px] animate-pulse">verde brillante</span>) ofrece mejor detalle y precisión que la silueta anterior?
                    </p>

                    <div className="bg-slate-950 border border-slate-850/60 rounded p-2 text-center">
                      <span className="text-[9px] text-slate-500 font-bold uppercase block">Complejidad del Trazado SVG</span>
                      <span className="text-sm font-black font-mono text-emerald-400">{generatedNodesCount}</span>
                      <span className="text-[8px] text-slate-400 block mt-0.5 font-medium">nodos generados en total (¡Listo para un renderizado ultra-rápido!)</span>
                    </div>
                    
                    {/* Botón rápido de alternancia para comparar */}
                    <button
                      onClick={() => setHideCurrentPaths(!hideCurrentPaths)}
                      className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 text-[9px] font-black py-1.5 px-2 rounded text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider cursor-pointer text-center flex items-center justify-center gap-1.5"
                    >
                      {hideCurrentPaths ? '👁️ MOSTRAR TRAZADO ORIGINAL (GRIS)' : '👁️ OCULTAR TRAZADO ORIGINAL (GRIS)'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {/* Opción A: Conservar Mejorado y Eliminar Anterior */}
                    <button
                      onClick={() => {
                        const targetName = getPieceName(currentSelectedId);
                        if (calibrationLevel === 'provinces') {
                          const updated = calibratedPaths.map(piece => {
                            if (piece.id === selectedProvinceId) {
                              return {
                                ...piece,
                                d: generatedTracePath
                              };
                            }
                            return piece;
                          });
                          savePathsLocally(updated);
                        } else {
                          if (selectedProvince && onUpdateProvince) {
                            const updatedMunicipalities = selectedProvince.municipalities.map(m => {
                              if (m.id === selectedSubdivisionId) {
                                return {
                                  ...m,
                                  d: generatedTracePath
                                };
                              }
                              return m;
                            });
                            onUpdateProvince({
                              ...selectedProvince,
                              municipalities: updatedMunicipalities
                            });
                          }
                        }
                        // Cerrar y limpiar
                        setGeneratedTracePath('');
                        setHideCurrentPaths(false);
                        showNotification(`[✓] ¡Trazado de "${targetName}" mejorado con éxito! Se reemplazó el original.`, 'success');
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] active:scale-[0.99] text-white font-black py-2.5 px-3 rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center shadow-md shadow-emerald-950/50 flex items-center justify-center gap-1"
                    >
                      <span>✓ Sí, conservar mejorado y eliminar anterior</span>
                    </button>

                    {/* Opción B: Descartar nuevo */}
                    <button
                      onClick={() => {
                        setGeneratedTracePath('');
                        setHideCurrentPaths(false);
                        showNotification('Trazado generado descartado. Se conservó el trazado base original sin modificaciones.', 'info');
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-300 font-bold py-2 px-3 rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer text-center"
                    >
                      ✗ No, descartar y conservar original
                    </button>
                  </div>

                  {/* Opción C: Crear nueva capa/objeto independiente */}
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">O bien, guardar como una pieza independiente:</span>
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Nombre de la nueva pieza independiente..."
                        value={newPieceNameInput}
                        onChange={(e) => setNewPieceNameInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 text-slate-300 rounded p-2 text-[10px] focus:outline-none focus:border-emerald-500/45"
                      />
                      <button
                        onClick={() => {
                          handleCreateNewPiece(newPieceNameInput);
                          setGeneratedTracePath('');
                          setHideCurrentPaths(false);
                        }}
                        className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-1.5 px-3 rounded text-[9px] uppercase tracking-wider transition-colors cursor-pointer text-center"
                      >
                        Crear como Nueva Pieza Coexistente
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* SECCIÓN 5: Exportador de Código Vectorial (Generador) */}
          <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-850">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center">
              <FileJson size={14} className="mr-1.5 text-sky-400" />
              5. Exportador de Código Vectorial (Generador)
            </h3>

            <p className="text-[10px] text-slate-400 leading-normal">
              Extrae el código JSON formateado de tus trazados para incorporarlos a la base de datos o arreglos de código de la aplicación.
            </p>

            {/* Selector de Pestañas para el Exportador */}
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setExportActiveTab('active_piece')}
                className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  exportActiveTab === 'active_piece'
                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pieza Activa
              </button>
              <button
                type="button"
                onClick={() => setExportActiveTab('autotrace')}
                className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  exportActiveTab === 'autotrace'
                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Autotrazado
              </button>
              <button
                type="button"
                onClick={() => setExportActiveTab('all_pieces')}
                className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  exportActiveTab === 'all_pieces'
                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas las Piezas
              </button>
            </div>

            {/* Configuración de Metadatos (ID y Nombre) */}
            {(exportActiveTab === 'active_piece' || exportActiveTab === 'autotrace') && (
              <div className="grid grid-cols-2 gap-2 p-2 bg-slate-900/40 rounded-lg border border-slate-850/60">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-500 uppercase block">ID Personalizado</label>
                  <input
                    type="text"
                    value={customExportId}
                    onChange={(e) => setCustomExportId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] font-mono focus:outline-none focus:border-sky-500/40 text-slate-300"
                    placeholder="id-de-exportacion"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-500 uppercase block">Nombre Personalizado</label>
                  <input
                    type="text"
                    value={customExportName}
                    onChange={(e) => setCustomExportName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] focus:outline-none focus:border-sky-500/40 text-slate-300"
                    placeholder="Nombre descriptivo"
                  />
                </div>
              </div>
            )}

            {/* Selector de Nombre de Propiedad ('path' o 'd') */}
            <div className="flex items-center justify-between p-2 bg-slate-900/40 rounded-lg border border-slate-850/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Propiedad de Coordenada SVG</span>
              <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={() => setExportFormatKey('path')}
                  className={`py-0.5 px-2 rounded text-[9px] font-mono transition-all cursor-pointer ${
                    exportFormatKey === 'path'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Exporta como { path: '...' }"
                >
                  "path"
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormatKey('d')}
                  className={`py-0.5 px-2 rounded text-[9px] font-mono transition-all cursor-pointer ${
                    exportFormatKey === 'd'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Exporta como { d: '...' }"
                >
                  "d"
                </button>
              </div>
            </div>

            {/* Recuadro de Código */}
            <div className="relative group">
              <textarea
                readOnly
                value={getExportedCode()}
                className="w-full h-36 bg-slate-950 border border-slate-850 text-sky-300/90 rounded-lg p-2.5 text-[9px] font-mono leading-relaxed focus:outline-none focus:border-sky-500/40 resize-none overflow-y-auto block select-all"
              />
              <button
                type="button"
                onClick={handleCopyCode}
                className="absolute top-2 right-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-sky-500/30 text-slate-300 hover:text-white p-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
                title="Copiar código JSON"
              >
                {isCopied ? (
                  <>
                    <Check size={11} className="text-emerald-400 animate-pulse" />
                    <span className="text-[8px] text-emerald-400 font-bold uppercase">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} className="text-slate-400 group-hover:text-sky-400" />
                    <span className="text-[8px] font-bold uppercase">Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Botón Consolidar y Guardar Cambios de Calibración */}
          <button
            onClick={handleBakeAndSave}
            className="w-full bg-emerald-600 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-950/20 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <Check size={16} />
            <span>GUARDAR CAMBIOS DE CALIBRACIÓN</span>
          </button>

            </>
          )}

        </div>
      </div>

      {/* Modal de Advertencia de Sincronización Federal */}
      {showSaveWarningModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm pointer-events-auto">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
                <Info size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                  ⚠️ ADVERTENCIA DE SINCRONIZACIÓN FEDERAL
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-mono">
                  Propagación de Coordenadas Geográficas
                </p>
              </div>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Estás a punto de consolidar y guardar cambios de calibración geométrica. Ten en cuenta que esta modificación afectará en tiempo real a todos los niveles de visualización del sistema:
              <br /><br />
              🌍 <strong className="text-emerald-400 font-bold">Mundo (Continentes)</strong>
              <br />
              🇦🇷 <strong className="text-emerald-400 font-bold">Nación (Mapa Completo de Argentina)</strong>
              <br />
              📍 <strong className="text-emerald-400 font-bold">Provincia Seleccionada (Zonificación Interna)</strong>
              <br /><br />
              Cualquier alteración en este nivel se propagará en cascada para mantener la cohesión matemática del visor nacional. ¿Deseas continuar?
            </p>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowSaveWarningModal(false);
                }}
                className="flex-1 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 py-2.5 px-4 rounded text-xs font-bold border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowSaveWarningModal(false);
                  executeBakeAndSave();
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-4 rounded text-xs font-bold transition-colors cursor-pointer text-center"
              >
                Sí, Propagar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
