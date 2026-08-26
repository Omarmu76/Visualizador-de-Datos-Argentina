/**
 * @file svgPathTransform.ts
 * @description Utilidades profesionales para cálculo de límites (Bounding Box),
 * auto-ajuste de viewBox, transformaciones geométricas (escalar, rotar, voltear, desplazar)
 * y manipulación de coordenadas de trazados vectoriales SVG ('d').
 */

export interface PathBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  pointCount: number;
  viewBox: string;
}

/**
 * Calcula con precisión milimétrica los límites (Bounding Box), dimensiones reales,
 * centro geométrico y viewBox auto-centrado de cualquier trazado SVG ('d').
 */
export function calculateSvgPathBounds(d: string, paddingRatio = 0.12): PathBounds {
  if (!d || typeof d !== 'string' || !d.trim()) {
    return {
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
      width: 100,
      height: 100,
      centerX: 50,
      centerY: 50,
      pointCount: 0,
      viewBox: '-10 -10 120 120'
    };
  }

  // Tokeniza comandos y argumentos
  const commandRegex = /([a-df-z])([^a-df-z]*)/gi;
  let match: RegExpExecArray | null;

  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let pointCount = 0;

  const updateBounds = (x: number, y: number) => {
    if (!isNaN(x) && isFinite(x)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    if (!isNaN(y) && isFinite(y)) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    pointCount++;
  };

  while ((match = commandRegex.exec(d)) !== null) {
    const cmd = match[1];
    const argsStr = match[2].trim();
    const numbers = argsStr.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g)?.map(Number) || [];
    const isRelative = cmd === cmd.toLowerCase();
    const type = cmd.toUpperCase();

    if (type === 'M' || type === 'L' || type === 'T') {
      for (let i = 0; i < numbers.length; i += 2) {
        if (i + 1 < numbers.length) {
          curX = isRelative ? curX + numbers[i] : numbers[i];
          curY = isRelative ? curY + numbers[i + 1] : numbers[i + 1];
          updateBounds(curX, curY);
          if (type === 'M' && i === 0) {
            startX = curX;
            startY = curY;
          }
        }
      }
    } else if (type === 'H') {
      for (let i = 0; i < numbers.length; i++) {
        curX = isRelative ? curX + numbers[i] : numbers[i];
        updateBounds(curX, curY);
      }
    } else if (type === 'V') {
      for (let i = 0; i < numbers.length; i++) {
        curY = isRelative ? curY + numbers[i] : numbers[i];
        updateBounds(curX, curY);
      }
    } else if (type === 'C') {
      for (let i = 0; i < numbers.length; i += 6) {
        if (i + 5 < numbers.length) {
          const cp1x = isRelative ? curX + numbers[i] : numbers[i];
          const cp1y = isRelative ? curY + numbers[i + 1] : numbers[i + 1];
          const cp2x = isRelative ? curX + numbers[i + 2] : numbers[i + 2];
          const cp2y = isRelative ? curY + numbers[i + 3] : numbers[i + 3];
          curX = isRelative ? curX + numbers[i + 4] : numbers[i + 4];
          curY = isRelative ? curY + numbers[i + 5] : numbers[i + 5];
          updateBounds(cp1x, cp1y);
          updateBounds(cp2x, cp2y);
          updateBounds(curX, curY);
        }
      }
    } else if (type === 'S' || type === 'Q') {
      for (let i = 0; i < numbers.length; i += 4) {
        if (i + 3 < numbers.length) {
          const cpx = isRelative ? curX + numbers[i] : numbers[i];
          const cpy = isRelative ? curY + numbers[i + 1] : numbers[i + 1];
          curX = isRelative ? curX + numbers[i + 2] : numbers[i + 2];
          curY = isRelative ? curY + numbers[i + 3] : numbers[i + 3];
          updateBounds(cpx, cpy);
          updateBounds(curX, curY);
        }
      }
    } else if (type === 'A') {
      for (let i = 0; i < numbers.length; i += 7) {
        if (i + 6 < numbers.length) {
          curX = isRelative ? curX + numbers[i + 5] : numbers[i + 5];
          curY = isRelative ? curY + numbers[i + 6] : numbers[i + 6];
          updateBounds(curX, curY);
        }
      }
    } else if (type === 'Z') {
      curX = startX;
      curY = startY;
      updateBounds(curX, curY);
    }
  }

  // Fallback en caso de que la regex de comandos no haya capturado coordenadas
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    const allNums = d.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g)?.map(Number) || [];
    if (allNums.length >= 2) {
      for (let i = 0; i < allNums.length; i += 2) {
        const x = allNums[i];
        const y = allNums[i + 1] ?? allNums[i];
        updateBounds(x, y);
      }
    }
  }

  // Si aún no hay valores finitos válidos
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    minX = 0;
    minY = 0;
    maxX = 100;
    maxY = 100;
  }

  if (minX === maxX) {
    minX -= 10;
    maxX += 10;
  }
  if (minY === maxY) {
    minY -= 10;
    maxY += 10;
  }

  const rawWidth = Math.max(1, maxX - minX);
  const rawHeight = Math.max(1, maxY - minY);
  const padX = Math.max(rawWidth * paddingRatio, 4);
  const padY = Math.max(rawHeight * paddingRatio, 4);

  const finalMinX = minX - padX;
  const finalMinY = minY - padY;
  const finalWidth = rawWidth + 2 * padX;
  const finalHeight = rawHeight + 2 * padY;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.round(rawWidth * 10) / 10,
    height: Math.round(rawHeight * 10) / 10,
    centerX: minX + rawWidth / 2,
    centerY: minY + rawHeight / 2,
    pointCount: Math.max(pointCount, 1),
    viewBox: `${finalMinX.toFixed(2)} ${finalMinY.toFixed(2)} ${finalWidth.toFixed(2)} ${finalHeight.toFixed(2)}`
  };
}

/**
 * Transforma geométricamente un trazado SVG ('d') aplicando transformaciones matemáticas directas
 * sobre sus puntos (escalar, rotar, voltear horizontal/vertical, desplazar).
 */
export function transformSvgPathD(
  d: string,
  options: {
    scale?: number; // Factor multiplicador de tamaño (ej: 1.2 para +20%, 0.8 para -20%)
    rotateDeg?: number; // Grados de rotación sobre su centro geométrico (ej: 90, 180, -90)
    flipX?: boolean; // Invertir horizontalmente (espejo X)
    flipY?: boolean; // Invertir verticalmente (espejo Y)
    offsetX?: number; // Desplazamiento X en unidades
    offsetY?: number; // Desplazamiento Y en unidades
  }
): string {
  if (!d || typeof d !== 'string' || !d.trim()) return d;

  const { scale = 1, rotateDeg = 0, flipX = false, flipY = false, offsetX = 0, offsetY = 0 } = options;

  // Si no hay transformaciones que aplicar, devuelve el original
  if (scale === 1 && rotateDeg === 0 && !flipX && !flipY && offsetX === 0 && offsetY === 0) {
    return d;
  }

  // 1. Obtiene el centro geométrico actual para transformar sobre dicho centro
  const bounds = calculateSvgPathBounds(d, 0);
  const cx = bounds.centerX;
  const cy = bounds.centerY;

  const rad = (rotateDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Función transformadora de un punto (x, y)
  const transformPoint = (x: number, y: number): [number, number] => {
    // 1. Centrar respecto al origen
    let dx = x - cx;
    let dy = y - cy;

    // 2. Aplicar Volteo (Flip)
    if (flipX) dx = -dx;
    if (flipY) dy = -dy;

    // 3. Aplicar Escala
    dx *= scale;
    dy *= scale;

    // 4. Aplicar Rotación
    let rx = dx;
    let ry = dy;
    if (rotateDeg !== 0) {
      rx = dx * cos - dy * sin;
      ry = dx * sin + dy * cos;
    }

    // 5. Re-posicionar en centro + offset
    const finalX = rx + cx + offsetX;
    const finalY = ry + cy + offsetY;

    // Redondear a 3 decimales para mantener legibilidad y eficiencia
    return [Math.round(finalX * 1000) / 1000, Math.round(finalY * 1000) / 1000];
  };

  // Parsea y reconstruye los comandos con los puntos transformados
  const commandRegex = /([a-df-z])([^a-df-z]*)/gi;
  let match: RegExpExecArray | null;
  const newSegments: string[] = [];

  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;

  while ((match = commandRegex.exec(d)) !== null) {
    const cmd = match[1];
    const argsStr = match[2].trim();
    const numbers = argsStr.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g)?.map(Number) || [];
    const isRelative = cmd === cmd.toLowerCase();
    const type = cmd.toUpperCase();

    if (type === 'M' || type === 'L' || type === 'T') {
      const parts: string[] = [];
      for (let i = 0; i < numbers.length; i += 2) {
        if (i + 1 < numbers.length) {
          curX = isRelative ? curX + numbers[i] : numbers[i];
          curY = isRelative ? curY + numbers[i + 1] : numbers[i + 1];
          const [tx, ty] = transformPoint(curX, curY);
          parts.push(`${tx} ${ty}`);
          if (type === 'M' && i === 0) {
            startX = curX;
            startY = curY;
          }
        }
      }
      newSegments.push(`${type} ${parts.join(' ')}`);
    } else if (type === 'H') {
      const parts: string[] = [];
      for (let i = 0; i < numbers.length; i++) {
        curX = isRelative ? curX + numbers[i] : numbers[i];
        const [tx, ty] = transformPoint(curX, curY);
        // H transforma a L porque la rotación puede cambiar la orientación
        parts.push(`${tx} ${ty}`);
      }
      newSegments.push(`L ${parts.join(' ')}`);
    } else if (type === 'V') {
      const parts: string[] = [];
      for (let i = 0; i < numbers.length; i++) {
        curY = isRelative ? curY + numbers[i] : numbers[i];
        const [tx, ty] = transformPoint(curX, curY);
        // V transforma a L
        parts.push(`${tx} ${ty}`);
      }
      newSegments.push(`L ${parts.join(' ')}`);
    } else if (type === 'C') {
      const parts: string[] = [];
      for (let i = 0; i < numbers.length; i += 6) {
        if (i + 5 < numbers.length) {
          const cp1x = isRelative ? curX + numbers[i] : numbers[i];
          const cp1y = isRelative ? curY + numbers[i + 1] : numbers[i + 1];
          const cp2x = isRelative ? curX + numbers[i + 2] : numbers[i + 2];
          const cp2y = isRelative ? curY + numbers[i + 3] : numbers[i + 3];
          curX = isRelative ? curX + numbers[i + 4] : numbers[i + 4];
          curY = isRelative ? curY + numbers[i + 5] : numbers[i + 5];

          const [t1x, t1y] = transformPoint(cp1x, cp1y);
          const [t2x, t2y] = transformPoint(cp2x, cp2y);
          const [tx, ty] = transformPoint(curX, curY);

          parts.push(`${t1x} ${t1y} ${t2x} ${t2y} ${tx} ${ty}`);
        }
      }
      newSegments.push(`C ${parts.join(' ')}`);
    } else if (type === 'S' || type === 'Q') {
      const parts: string[] = [];
      for (let i = 0; i < numbers.length; i += 4) {
        if (i + 3 < numbers.length) {
          const cpx = isRelative ? curX + numbers[i] : numbers[i];
          const cpy = isRelative ? curY + numbers[i + 1] : numbers[i + 1];
          curX = isRelative ? curX + numbers[i + 2] : numbers[i + 2];
          curY = isRelative ? curY + numbers[i + 3] : numbers[i + 3];

          const [tcpx, tcpy] = transformPoint(cpx, cpy);
          const [tx, ty] = transformPoint(curX, curY);

          parts.push(`${tcpx} ${tcpy} ${tx} ${ty}`);
        }
      }
      newSegments.push(`${type} ${parts.join(' ')}`);
    } else if (type === 'A') {
      const parts: string[] = [];
      for (let i = 0; i < numbers.length; i += 7) {
        if (i + 6 < numbers.length) {
          const rx = numbers[i] * scale;
          const ry = numbers[i + 1] * scale;
          const xAxisRotation = (numbers[i + 2] + rotateDeg) % 360;
          const largeArcFlag = numbers[i + 3];
          const sweepFlag = flipX !== flipY ? (numbers[i + 4] === 1 ? 0 : 1) : numbers[i + 4];
          curX = isRelative ? curX + numbers[i + 5] : numbers[i + 5];
          curY = isRelative ? curY + numbers[i + 6] : numbers[i + 6];

          const [tx, ty] = transformPoint(curX, curY);

          parts.push(`${Math.round(rx * 100) / 100} ${Math.round(ry * 100) / 100} ${xAxisRotation} ${largeArcFlag} ${sweepFlag} ${tx} ${ty}`);
        }
      }
      newSegments.push(`A ${parts.join(' ')}`);
    } else if (type === 'Z') {
      curX = startX;
      curY = startY;
      newSegments.push('Z');
    }
  }

  return newSegments.join(' ');
}

/**
 * Normaliza las coordenadas de un SVG path 'd' para centrarlo exactamente en (targetCenterX, targetCenterY).
 */
export function centerSvgPathTo(d: string, targetCenterX = 400, targetCenterY = 500): string {
  if (!d) return d;
  const bounds = calculateSvgPathBounds(d, 0);
  const offsetX = targetCenterX - bounds.centerX;
  const offsetY = targetCenterY - bounds.centerY;
  return transformSvgPathD(d, { offsetX, offsetY });
}

/**
 * Extrae de forma inteligente el contenido 'd' desde cualquier código SVG o HTML o texto suelto.
 */
export function extractPathDataFromText(input: string): { d: string; name?: string } | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  // 1. Si es un JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].d) {
        return { d: parsed[0].d, name: parsed[0].name };
      } else if (parsed.d) {
        return { d: parsed.d, name: parsed.name };
      }
    } catch {
      // no es json válido
    }
  }

  // 2. Si es una etiqueta <path> o código <svg>
  const pathMatch = trimmed.match(/<path[^>]*d=["']([^"']+)["']/i);
  if (pathMatch && pathMatch[1]) {
    const idMatch = trimmed.match(/id=["']([^"']+)["']/i);
    return { d: pathMatch[1], name: idMatch ? idMatch[1] : undefined };
  }

  // 3. Si es un trazado directo que empieza con M o m
  if (/^[Mm]\s*[-+0-9]/.test(trimmed) || trimmed.includes('L') || trimmed.includes('C') || trimmed.includes('Z')) {
    return { d: trimmed };
  }

  return null;
}
