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
