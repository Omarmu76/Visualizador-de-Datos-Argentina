export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getPathBBox(d: string): BBox {
  if (!d || !d.trim()) {
    return { x: 260, y: -2, width: 440, height: 964 };
  }
  const matches = d.match(/[-+]?[0-9]*\.?[0-9]+/g);
  if (!matches || matches.length < 2) {
    return { x: 260, y: -2, width: 440, height: 964 };
  }
  const numbers = matches.map(Number);
  const xCoords: number[] = [];
  const yCoords: number[] = [];

  for (let i = 0; i < numbers.length; i += 2) {
    if (i + 1 < numbers.length) {
      if (!isNaN(numbers[i]) && !isNaN(numbers[i + 1])) {
        xCoords.push(numbers[i]);
        yCoords.push(numbers[i + 1]);
      }
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
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

export function getMultiplePathsBBox(
  paths: { d: string }[],
  defaultBox: BBox = { x: 0, y: 0, width: 800, height: 800 }
): BBox {
  if (!paths || paths.length === 0) return defaultBox;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let count = 0;

  for (const p of paths) {
    if (!p.d || !p.d.trim()) continue;
    const matches = p.d.match(/[-+]?[0-9]*\.?[0-9]+/g);
    if (!matches || matches.length < 2) continue;

    for (let i = 0; i < matches.length; i += 2) {
      if (i + 1 < matches.length) {
        const x = Number(matches[i]);
        const y = Number(matches[i + 1]);
        if (!isNaN(x) && !isNaN(y)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          count++;
        }
      }
    }
  }

  if (count === 0 || minX === Infinity || minY === Infinity) {
    return defaultBox;
  }

  const w = maxX - minX;
  const h = maxY - minY;

  return {
    x: minX,
    y: minY,
    width: w > 0 ? w : 100,
    height: h > 0 ? h : 100
  };
}

// FUNCIÓN PARA RE-DESPLAZAR (MOVER / TRASLADAR) LAS COORDENADAS DE UN TRAZADO SVG 'd'
export function translatePathD(d: string, deltaX: number, deltaY: number): string {
  if (!d || !d.trim() || (deltaX === 0 && deltaY === 0)) return d; // Si no hay trazado o el desplazamiento es nulo, retorna intacto
  let isX = true; // Flag para alternar entre coordenadas X y Y
  return d.replace(/[-+]?[0-9]*\.?[0-9]+/g, (match) => { // Busca cada número dentro de las instrucciones del SVG
    const num = parseFloat(match); // Convierte el texto numérico a número flotante
    if (isNaN(num)) return match; // Si no es un número válido, lo conserva
    if (isX) { // Si corresponde a la coordenada X
      isX = false; // Alterna la bandera para la siguiente iteración
      return Number((num + deltaX).toFixed(2)).toString(); // Desplaza en X con precisión de 2 decimales
    } else { // Si corresponde a la coordenada Y
      isX = true; // Alterna la bandera para la siguiente iteración
      return Number((num + deltaY).toFixed(2)).toString(); // Desplaza en Y con precisión de 2 decimales
    }
  });
}

// FUNCIÓN PARA ESCALAR / REDIMENSIONAR UN TRAZADO SVG 'd' CON ANCLAJE EN UN PUNTO (anchorX, anchorY)
export function scalePathD(d: string, scaleX: number, scaleY: number, anchorX: number, anchorY: number): string {
  if (!d || !d.trim() || (scaleX === 1 && scaleY === 1)) return d; // Si no hay trazado o el factor de escala es 1x, retorna intacto
  let isX = true; // Flag para alternar entre coordenadas X y Y
  return d.replace(/[-+]?[0-9]*\.?[0-9]+/g, (match) => { // Analiza y reemplaza quirúrgicamente cada punto numérico
    const num = parseFloat(match); // Convierte a flotante
    if (isNaN(num)) return match; // Mantiene texto invalido
    if (isX) { // Procesa X
      isX = false; // Cambia a Y
      const newX = anchorX + (num - anchorX) * scaleX; // Escala la distancia respecto al punto de anclaje X
      return Number(newX.toFixed(2)).toString(); // Retorna la nueva coordenada X
    } else { // Procesa Y
      isX = true; // Cambia a X
      const newY = anchorY + (num - anchorY) * scaleY; // Escala la distancia respecto al punto de anclaje Y
      return Number(newY.toFixed(2)).toString(); // Retorna la nueva coordenada Y
    }
  });
}

// FUNCIÓN PARA AJUSTAR / NORMALIZE UN NUEVO MAPA DE RUTA AL TAMAÑO Y POSICIÓN DEL CONTORNO ORIGINAL
export function fitPathToBBox(sourceD: string, targetBBox: BBox): string {
  if (!sourceD || !sourceD.trim()) return sourceD; // Retorna si no hay trazado fuente
  const sourceBBox = getPathBBox(sourceD); // Obtiene los límites del trazado fuente
  if (sourceBBox.width <= 1 || sourceBBox.height <= 1) return sourceD; // Si la caja fuente es inválida, no altera
  if (targetBBox.width <= 1 || targetBBox.height <= 1) return sourceD; // Si la caja destino es inválida, no altera

  // Calcula factores de escala requeridos para encajar en el contorno objetivo
  const scaleX = targetBBox.width / sourceBBox.width; // Factor horizontal
  const scaleY = targetBBox.height / sourceBBox.height; // Factor vertical
  const scale = Math.min(scaleX, scaleY); // Utiliza el mínimo para mantener la proporción de aspecto original sin deformar

  // Calcula centroides de ambas cajas espaciales
  const sourceCenterX = sourceBBox.x + sourceBBox.width / 2; // Centro X fuente
  const sourceCenterY = sourceBBox.y + sourceBBox.height / 2; // Centro Y fuente
  const targetCenterX = targetBBox.x + targetBBox.width / 2; // Centro X destino
  const targetCenterY = targetBBox.y + targetBBox.height / 2; // Centro Y destino

  let isX = true; // Flag para alternar entre coordenadas X y Y
  return sourceD.replace(/[-+]?[0-9]*\.?[0-9]+/g, (match) => { // Transforma quirúrgicamente cada par de puntos (x, y)
    const num = parseFloat(match); // Convierte a flotante
    if (isNaN(num)) return match; // Previene fallos en cadenas no numéricas
    if (isX) { // Procesa X
      isX = false; // Cambia a Y
      const newX = targetCenterX + (num - sourceCenterX) * scale; // Escala y desplaza al centro X objetivo
      return Number(newX.toFixed(2)).toString(); // Retorna X ajustado
    } else { // Procesa Y
      isX = true; // Cambia a X
      const newY = targetCenterY + (num - sourceCenterY) * scale; // Escala y desplaza al centro Y objetivo
      return Number(newY.toFixed(2)).toString(); // Retorna Y ajustado
    }
  });
}

