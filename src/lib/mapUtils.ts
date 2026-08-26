/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Interfaz que define los límites espaciales (Bounding Box) de un trazado o conjunto de trazados
export interface BBox {
  x: number; // Coordenada X mínima
  y: number; // Coordenada Y mínima
  width: number; // Ancho total
  height: number; // Alto total
}

// FUNCIÓN PARA CALCULAR EL BOUNDING BOX DE UN TRAZADO SVG 'd' (BLINDADA CONTRA RANGE ERROR Y RECURSIÓN)
export function getPathBBox(d: string): BBox {
  if (!d || typeof d !== 'string' || !d.trim()) { // Si la cadena está vacía o es inválida
    return { x: 260, y: -2, width: 440, height: 964 }; // Retorna caja por defecto de Argentina
  }
  const matches = d.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g); // Extrae todos los números incluidos exponenciales
  if (!matches || matches.length < 2) { // Si no hay suficientes coordenadas
    return { x: 260, y: -2, width: 440, height: 964 }; // Retorna caja por defecto
  }

  let minX = Infinity; // Coordenada X mínima
  let maxX = -Infinity; // Coordenada X máxima
  let minY = Infinity; // Coordenada Y mínima
  let maxY = -Infinity; // Coordenada Y máxima
  let count = 0; // Conteo de pares válidos procesados

  for (let i = 0; i < matches.length; i += 2) { // Itera en pares (x, y) de forma secuencial sin apilar en el call-stack
    if (i + 1 < matches.length) { // Verifica existencia del par
      const x = Number(matches[i]); // Coordenada X
      const y = Number(matches[i + 1]); // Coordenada Y
      if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) { // Verifica validez numérica finita
        if (x < minX) minX = x; // Actualiza mínimo X
        if (x > maxX) maxX = x; // Actualiza máximo X
        if (y < minY) minY = y; // Actualiza mínimo Y
        if (y > maxY) maxY = y; // Actualiza máximo Y
        count++; // Incrementa contador
      }
    }
  }

  if (count === 0 || minX === Infinity || minY === Infinity) { // Si no se pudieron recolectar coordenadas válidas
    return { x: 260, y: -2, width: 440, height: 964 }; // Retorna caja por defecto
  }

  return { // Retorna el Bounding Box calculado sin desbordar la pila
    x: minX, // X inicial
    y: minY, // Y inicial
    width: Math.max(1, maxX - minX), // Ancho garantizando al menos 1px
    height: Math.max(1, maxY - minY) // Alto garantizando al menos 1px
  };
}

// FUNCIÓN PARA CALCULAR EL BOUNDING BOX DE MÚLTIPLES TRAZADOS
export function getMultiplePathsBBox(
  paths: { d: string }[], // Lista de objetos con propiedad 'd'
  defaultBox: BBox = { x: 0, y: 0, width: 800, height: 800 } // Caja por defecto
): BBox {
  if (!paths || paths.length === 0) return defaultBox; // Si la lista está vacía, retorna defecto

  let minX = Infinity; // Inicializa mínimo X en infinito positivo
  let maxX = -Infinity; // Inicializa máximo X en infinito negativo
  let minY = Infinity; // Inicializa mínimo Y en infinito positivo
  let maxY = -Infinity; // Inicializa máximo Y en infinito negativo
  let count = 0; // Contador de puntos procesados

  for (const p of paths) { // Itera cada objeto de trazado
    if (!p.d || !p.d.trim()) continue; // Salta si no hay comando 'd'
    const matches = p.d.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g); // Extrae coordenadas
    if (!matches || matches.length < 2) continue; // Salta si no hay suficientes datos

    for (let i = 0; i < matches.length; i += 2) { // Procesa pares (x, y)
      if (i + 1 < matches.length) { // Si existe el par
        const x = Number(matches[i]); // Coordenada X
        const y = Number(matches[i + 1]); // Coordenada Y
        if (!isNaN(x) && !isNaN(y)) { // Si ambos son números válidos
          if (x < minX) minX = x; // Actualiza mínimo X
          if (x > maxX) maxX = x; // Actualiza máximo X
          if (y < minY) minY = y; // Actualiza mínimo Y
          if (y > maxY) maxY = y; // Actualiza máximo Y
          count++; // Incrementa contador
        }
      }
    }
  }

  if (count === 0 || minX === Infinity || minY === Infinity) { // Si no se recolectaron puntos válidos
    return defaultBox; // Retorna caja por defecto
  }

  const w = maxX - minX; // Ancho total
  const h = maxY - minY; // Alto total

  return { // Retorna el Bounding Box global unificado
    x: minX, // X mínimo
    y: minY, // Y mínimo
    width: w > 0 ? w : 100, // Ancho calculado
    height: h > 0 ? h : 100 // Alto calculado
  };
}

// TRANSFORMADOR ROBUSTO DE TRAZADOS SVG CON RECONOCIMIENTO DE COMANDOS (M, L, C, S, Q, T, A, H, V, Z)
export function transformSvgPath(
  d: string, // Cadena del trazado SVG
  transformCoord: (x: number, y: number) => [number, number], // Función transformadora de puntos (x, y)
  scaleRadius?: (r: number) => number // Función opcional para escalar radios de arcos elípticos (A)
): string {
  if (!d || !d.trim()) return d; // Si no hay datos, retorna intacto

  // Expresión regular que separa cada comando SVG con sus argumentos numéricos
  const commandRegex = /([a-df-z])([^a-df-z]*)/gi;
  let match: RegExpExecArray | null;
  const resultChunks: string[] = []; // Fragmentos reconstruidos

  while ((match = commandRegex.exec(d)) !== null) { // Itera sobre cada instrucción del SVG
    const cmd = match[1]; // Letra del comando (ej: M, L, C, Z)
    const argsStr = match[2]; // Argumentos numéricos asociados al comando
    const numMatches = argsStr.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g); // Extrae números
    
    if (!numMatches || numMatches.length === 0) { // Si el comando no tiene argumentos (ej: Z)
      resultChunks.push(cmd); // Conserva el comando tal cual
      continue;
    }

    const nums = numMatches.map(Number); // Convierte a flotantes
    const upperCmd = cmd.toUpperCase(); // Comando en mayúsculas para tipificación

    if (upperCmd === 'H') { // Comando de línea horizontal (solo afecta coordenada X)
      const newNums = nums.map(x => {
        const [nx] = transformCoord(x, 0); // Transforma solo X
        return Number(nx.toFixed(2)); // Retorna formateado con 2 decimales
      });
      resultChunks.push(`${cmd}${newNums.join(' ')}`);
    } else if (upperCmd === 'V') { // Comando de línea vertical (solo afecta coordenada Y)
      const newNums = nums.map(y => {
        const [, ny] = transformCoord(0, y); // Transforma solo Y
        return Number(ny.toFixed(2)); // Retorna formateado con 2 decimales
      });
      resultChunks.push(`${cmd}${newNums.join(' ')}`);
    } else if (upperCmd === 'A') { // Comando de arco elíptico (rx ry rot largeArc sweep x y)
      const newNums: number[] = [];
      for (let i = 0; i < nums.length; i += 7) { // Itera en grupos de 7 parámetros
        if (i + 6 < nums.length) {
          const rx = scaleRadius ? scaleRadius(nums[i]) : nums[i]; // Radio X escalado
          const ry = scaleRadius ? scaleRadius(nums[i + 1]) : nums[i + 1]; // Radio Y escalado
          const angle = nums[i + 2]; // Ángulo de rotación del eje X
          const largeArc = nums[i + 3]; // Bandera de arco mayor
          const sweep = nums[i + 4]; // Bandera de dirección
          const [nx, ny] = transformCoord(nums[i + 5], nums[i + 6]); // Coordenadas del punto final transformadas
          newNums.push(
            Number(rx.toFixed(2)),
            Number(ry.toFixed(2)),
            angle,
            largeArc,
            sweep,
            Number(nx.toFixed(2)),
            Number(ny.toFixed(2))
          );
        } else {
          for (let j = i; j < nums.length; j++) {
            newNums.push(nums[j]); // Preserva remanentes
          }
        }
      }
      resultChunks.push(`${cmd}${newNums.join(' ')}`);
    } else { // Comandos estándar de puntos pares (M, L, C, S, Q, T)
      const newNums: number[] = [];
      for (let i = 0; i < nums.length; i += 2) { // Itera en pares (x, y)
        if (i + 1 < nums.length) {
          const [nx, ny] = transformCoord(nums[i], nums[i + 1]); // Aplica la transformación
          newNums.push(Number(nx.toFixed(2)), Number(ny.toFixed(2))); // Agrega el par transformado
        } else {
          newNums.push(nums[i]); // Preserva número impar
        }
      }
      resultChunks.push(`${cmd}${newNums.join(' ')}`);
    }
  }

  return resultChunks.length > 0 ? resultChunks.join(' ') : d; // Retorna el trazado SVG reconstruido
}

// FUNCIÓN PARA RE-DESPLAZAR (MOVER / TRASLADAR) LAS COORDENADAS DE UN TRAZADO SVG 'd'
export function translatePathD(d: string, deltaX: number, deltaY: number): string {
  if (!d || !d.trim() || (deltaX === 0 && deltaY === 0)) return d; // Si no hay desplazamiento, retorna intacto
  return transformSvgPath(d, (x, y) => [x + deltaX, y + deltaY]); // Aplica traslación en X y Y
}

// FUNCIÓN PARA ESCALAR / REDIMENSIONAR UN TRAZADO SVG 'd' CON ANCLAJE EN UN PUNTO (anchorX, anchorY)
export function scalePathD(d: string, scaleX: number, scaleY: number, anchorX: number, anchorY: number): string {
  if (!d || !d.trim() || (scaleX === 1 && scaleY === 1)) return d; // Si la escala es 1x, retorna intacto
  const avgScale = (scaleX + scaleY) / 2; // Escala promedio para radios de arco
  return transformSvgPath(
    d,
    (x, y) => [anchorX + (x - anchorX) * scaleX, anchorY + (y - anchorY) * scaleY], // Escala respecto al anclaje
    (r) => r * avgScale // Escala de radio
  );
}

// FUNCIÓN PARA AJUSTAR / NORMALIZAR UN NUEVO MAPA DE RUTA AL TAMAÑO Y POSICIÓN DEL CONTORNO ORIGINAL
export function fitPathToBBox(sourceD: string, targetBBox: BBox): string {
  if (!sourceD || !sourceD.trim()) return sourceD; // Si no hay trazado fuente, retorna intacto
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

  // Aplica la transformación quirúrgica manteniendo la forma y medidas exactas
  return transformSvgPath(
    sourceD,
    (x, y) => [
      targetCenterX + (x - sourceCenterX) * scale, // Escala y centra en X objetivo
      targetCenterY + (y - sourceCenterY) * scale  // Escala y centra en Y objetivo
    ],
    (r) => r * scale // Escala los radios de arco en la misma proporción
  );
}


