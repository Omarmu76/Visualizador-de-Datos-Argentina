// src/utils/mapRecovery.ts
// Módulo de Recuperación y Blindaje de Integridad Geográfica para el Mapa de la República Argentina
// Restaura con precisión histórica las geometrías de Tierra del Fuego (AR-V), Islas Malvinas (AR-MLV) y las 24 provincias.

import { provincePaths } from '../data/provincePaths';
import { safeGetItem, safeSetItem } from '../lib/storage';
import { mockProvincesData } from '../data/mockData';

// Geometría canónica histórica original de Tierra del Fuego (AR-V) extraída de provincePaths.ts
export const CANONICAL_TIERRA_DEL_FUEGO_D = provincePaths.find(p => p.id === 'AR-V')?.d || 'M382.67,952.21L380.8,951.39L378.76,951.06L377.37,951.46L376.85,952.13L372.87,952.55L371.54,951.78L370.23,949.98L370.31,940.82L370.32,932.87L370.37,920.29L370.42,914.44L370.48,902.25L370.49,893.67L370.56,876.17L370.6,870.95L371.63,872.24L372.66,874.19L374.27,876.81L375.16,877.94L376.87,879.72L377.84,881.49L378.5,883.57L379.23,887.47L378.59,886.97L378.05,884.27L377.76,883.74L376.97,883.39L375.56,884.09L372.24,888.2L371.83,889.17L371.72,890.45L372.24,891.96L373.24,893.22L374.71,894.26L376.17,894.57L377.93,894.55L379.19,894.06L380.2,894.03L380.83,894.69L382.23,897.83L382.68,900.43L383.19,902.71L383.95,904.43L384.78,905.87L388.42,909.6L393.19,914.11L393.18,916.04L393.67,917.34L398.14,921.44L400.16,923.01L406.13,927.31L408.84,928.88L409.41,929.08L411.31,930.26L412.87,931.55L415.42,935.31L415.85,935.78L420.85,939.41L422.58,940.51L426.83,942.58L432.08,945.02L434.3,945.56L435.01,945.61L440.37,944.72L442.51,944.2L444.95,944.14L446.26,944.48L446.67,944.86L444.52,950.94L442.76,954.3L442.07,955.28L441.5,955.38L440.95,954.74L439.11,954.31L436.55,955.43L434.28,955.19L433.6,954.3L432.94,954.06L430.53,953.89L429.27,954.17L428.91,954.92L427.65,956.3L425.59,957.27L423.79,957.59L420.17,957.36L419.45,957.69L418.11,960L415.8,959.73L413.59,958.96L412.36,957.44L411.53,956.69L409.9,955.73L405.75,954.55L402.57,954.15L395.31,953.36L390.38,953.73L384.12,952.74ZM370.22,950.6L370.76,951.4L371.33,952.74L371.89,953.5L370.87,953.9L370.2,953.65ZM456.77,954.49L456.97,953.04L456.23,952.22L455.19,952.05L455.41,950.67L456.45,949.55L457,949.47L458.52,950.4L460.32,949.79L463.33,948.45L464.22,947.68L467.93,948.25L471.1,947.85L473.36,947.17L475.49,947.4L475.68,947.71L474.48,949.83L472.6,950.88L472.13,950.07L471.36,949.61L468.64,951.14L465.97,951.98L465.8,950.65L464.47,949.99L462.36,951.93L461,952.22L458.99,953L457.62,954.27Z';

// Geometría canónica histórica original de Islas Malvinas (AR-MLV) extraída de provincePaths.ts
export const CANONICAL_MALVINAS_D = provincePaths.find(p => p.id === 'AR-MLV')?.d || 'M 597.694 842.519 L 597.430 842.290 L 597.316 841.937 L 596.623 842.319 L 596.447 842.324 L 596.207 842.213 L 595.981 841.871 L 595.768 841.892 L 595.596 841.932 L 595.562 841.850 L 595.655 841.660 L 595.948 841.559 L 596.143 841.371 L 596.104 841.241 L 595.654 841.054 L 595.580 840.709 L 595.471 840.635 L 595.079 841.351 L 595.105 842.076 L 595.015 842.182 L 595.051 842.287 L 595.082 842.575 L 594.959 842.732 L 594.790 843.173 L 595.206 843.521 L 595.304 843.730 L 595.248 844.038 L 595.002 844.340 L 594.722 844.452 L 594.013 844.325 L 593.395 844.348 L 592.700 844.244 L 592.032 844.270 L 591.498 844.369 L 590.750 844.597 L 590.086 844.913 L 589.963 844.706 L 590.145 844.387 L 590.598 843.993 L 591.189 843.707 L 591.743 843.194 L 591.892 842.926 L 591.890 842.781 L 591.802 842.789 L 591.446 843.138 L 590.934 843.445 L 591.080 843.015 L 590.924 843.102 L 590.244 843.626 L 590.095 843.627 L 590.098 843.156 L 589.996 843.188 L 589.847 843.336 L 589.512 843.525 L 589.284 843.764 L 588.825 843.855 L 588.687 844.231 L 588.380 844.454 L 588.072 844.288 L 587.618 844.306 L 588.110 844.903 L 588.218 845.220 L 588.339 845.039 L 588.547 845.093 L 588.679 845.759 L 588.662 846.209 L 588.694 846.279 L 588.862 846.190 L 588.861 846.421 L 588.741 846.856 L 588.742 847.232 L 588.723 847.294 L 588.625 847.945 L 588.774 848.283 L 588.850 848.288 L 588.975 848.143 L 588.979 848.058 L 589.112 847.258 L 589.140 846.916 L 589.276 846.019 L 589.337 845.262 L 589.469 844.946 L 589.672 844.952 L 589.750 845.090 L 589.499 845.489 L 589.527 846.250 L 589.387 847.220 L 589.331 848.037 L 589.313 848.100 L 589.171 848.816 L 588.987 849.002 L 588.753 849.072 L 588.433 849.538 L 588.233 850.054 L 587.934 850.360 L 587.454 851.119 L 587.026 851.655 L 586.967 852.073 L 586.645 852.272 L 586.496 852.310 L 586.109 852.491 L 585.967 852.467 L 585.819 852.142 L 585.658 852.302 L 585.528 852.277 L 585.304 852.067 L 585.335 851.749 L 585.236 851.274 L 585.024 851.063 L 584.850 851.224 L 585.058 851.654 L 585.110 851.915 L 585.007 852.276 L 585.132 852.374 L 585.338 852.403 L 585.497 852.595 L 585.669 852.664 L 585.810 852.930 L 585.611 853.214 L 585.110 853.285 L 584.840 853.127 L 584.672 852.973 L 584.367 853.098 L 584.206 852.894 L 584.388 852.430 L 584.376 851.934 L 584.276 851.701 L 584.188 851.587 L 583.932 851.562 L 583.700 851.656 L 583.627 851.687 L 583.142 851.912 L 582.781 852.102 L 582.431 852.413 L 582.382 852.562 L 582.539 852.730 L 582.791 852.841 L 583.062 852.877 L 583.053 853.047 L 582.861 853.282 L 582.615 853.365 L 582.198 853.257 L 581.959 852.904 L 582.029 852.206 L 581.973 852.030 L 581.763 852.206 L 581.567 852.660 L 580.760 851.957 L 580.030 851.125 L 579.782 850.796 L 579.723 850.329 L 579.769 850.022 L 579.749 849.951 L 579.603 850.013 L 579.403 850.430 L 579.090 850.604 L 578.708 850.589 L 578.630 850.693 L 578.329 850.732 L 578.306 850.879 L 578.341 850.985 L 578.527 851.065 L 578.871 851.083 L 579.007 851.040 Z M 599.555 847.372 L 599.642 847.167 L 599.809 847.001 L 599.866 846.764 L 599.771 846.313 L 599.859 846.120 L 600.096 846.007 L 600.317 846.163 L 600.426 846.332 L 600.790 846.228 L 600.838 846.405 L 600.641 846.732 L 600.502 847.211 L 600.550 847.290 L 600.615 847.306 L 600.774 847.275 L 600.977 846.996 L 601.124 847.161 L 601.059 847.339 L 600.929 847.500 L 600.926 847.670 L 600.777 847.785 L 600.839 847.875 L 601.337 847.840 L 601.709 847.698 L 601.775 847.727 L 601.798 847.809 L 601.774 848.104 L 601.873 848.287 L 601.942 848.339 L 602.051 848.010 L 602.255 847.937 L 602.478 847.910 L 602.537 847.782 L 602.458 847.657 L 602.097 847.397 L 602.253 847.244 L 602.620 847.164 L 602.685 846.889 L 602.638 846.627 L 602.720 846.581 L 603.144 846.846 L 603.118 847.031 L 603.422 847.530 L 603.766 847.184 L 603.921 847.409 L 604.248 847.406 L 604.341 847.540 L 604.267 847.938 L 604.484 847.961 L 604.629 847.919 L 604.744 848.124 L 604.648 848.354 L 604.490 848.398 L 604.306 848.335 L 604.323 848.564 L 604.429 848.794 L 604.640 848.963 L 604.646 849.108 L 604.564 849.252 L 604.633 849.389 L 604.597 849.503 L 604.135 849.340 L 603.963 849.373 L 603.823 849.548 L 603.738 849.667 L 603.459 849.944 L 603.419 850.119 L 603.555 850.103 L 603.888 849.856 L 604.116 849.768 L 604.359 849.799 L 604.887 850.562 L 604.811 850.754 L 604.728 850.885 L 604.884 839.024 L 604.843 851.479 L 604.924 852.004 L 604.889 852.215 L 604.978 852.314 L 605.140 852.306 L 605.279 852.022 L 605.300 851.509 L 605.182 851.086 L 605.254 850.968 L 605.444 851.066 L 605.694 851.534 L 605.640 851.796 L 605.974 852.132 L 606.199 852.786 L 606.253 852.816 L 606.375 852.497 L 606.604 852.518 L 606.635 852.369 L 606.459 851.989 L 606.476 851.926 L 606.682 851.962 L 607.318 852.103 L 607.458 852.111 L 607.530 851.992 L 607.352 851.880 L 606.604 851.753 L 606.514 851.642 L 606.622 851.410 L 606.572 851.318 L 606.273 851.245 L 606.237 851.067 L 606.457 850.919 L 606.126 850.801 L 605.849 850.798 L 605.655 850.664 L 605.535 850.423 L 605.599 850.136 L 605.440 849.985 L 605.091 849.820 L 605.000 849.697 L 605.110 849.478 L 605.335 849.377 L 605.289 849.115 L 605.295 849.066 L 605.453 849.120 L 605.600 848.993 L 605.707 849.041 L 605.958 849.326 L 606.618 849.660 L 607.011 849.964 L 607.341 850.082 L 607.688 850.137 L 608.001 850.026 L 608.274 850.187 L 608.370 850.151 L 608.360 850.080 L 608.101 849.832 L 607.667 849.690 L 607.327 849.306 L 607.020 849.173 L 607.030 849.062 L 607.317 848.942 L 607.259 848.889 L 606.059 848.560 L 605.650 848.415 L 605.629 848.260 L 605.775 848.218 L 606.030 848.053 L 606.082 847.974 L 606.028 847.847 L 605.853 847.759 L 605.453 847.685 L 605.354 847.503 L 605.209 847.448 L 605.106 847.339 L 605.426 847.190 L 605.513 846.985 L 605.721 846.851 L 606.119 846.912 L 606.363 846.858 L 606.548 846.446 L 606.741 846.289 L 606.856 846.020 L 606.754 845.911 L 606.408 845.953 L 605.705 846.245 L 605.149 846.324 L 604.681 846.296 L 604.449 846.154 L 604.466 845.994 L 604.427 845.792 L 604.280 845.822 L 604.238 845.888 L 603.988 845.991 L 603.723 845.986 L 603.575 845.907 L 603.525 845.718 L 603.951 844.937 L 604.111 844.140 L 604.035 843.943 L 603.797 843.850 L 603.652 843.891 L 603.504 844.396 L 603.155 844.511 L 602.889 845.078 L 602.842 845.387 L 602.723 845.535 L 602.543 845.605 L 602.406 845.609 L 602.130 845.327 L 601.917 845.522 L 601.691 845.525 L 601.480 845.344 L 601.206 845.461 L 601.059 845.394 L 601.027 845.337 L 601.054 845.066 L 601.198 844.818 L 601.048 844.630 L 600.990 844.564 L 601.101 844.356 L 601.337 844.243 L 601.480 843.885 L 601.432 843.806 L 600.925 843.866 L 600.905 843.711 L 601.011 843.564 L 601.537 843.356 L 601.731 843.308 L 602.037 843.053 L 602.596 843.107 L 602.579 842.976 L 602.357 842.808 L 602.457 842.613 L 602.787 842.355 L 602.915 842.279 L 602.901 841.879 L 603.199 841.467 L 603.436 841.365 L 603.552 841.388 L 603.805 841.017 L 604.007 840.834 L 604.037 840.587 L 603.999 840.386 L 604.130 840.139 L 604.324 839.799 L 604.211 839.606 L 604.434 839.494 L 604.551 839.431 L 604.599 839.219 L 604.486 838.928 L 604.501 838.854 L 605.018 838.876 L 605.149 838.824 L 605.299 838.636 L 605.870 838.688 L 606.021 838.499 L 606.275 838.529 L 607.036 838.789 L 607.169 838.663 L 608.121 838.559 L 608.393 838.538 L 608.773 838.284 L 608.944 838.251 L 609.363 838.479 L 609.452 838.492 L 609.481 838.428 L 609.643 838.323 L 609.971 838.246 L 610.220 838.240 L 610.841 838.382 L 611.092 838.010 L 611.290 837.901 L 612.175 837.681 L 612.349 838.134 L 612.710 838.211 L 612.792 837.982 L 613.143 837.889 L 613.982 837.797 L 614.329 837.863 L 614.486 837.442 L 614.626 837.461 L 614.929 837.386 L 615.066 837.564 L 615.366 837.465 L 615.558 837.222 L 615.666 837.184 L 616.088 837.435 L 617.033 837.937 L 617.354 838.456 L 617.394 838.657 L 617.379 838.732 L 617.469 838.940 L 617.751 839.354 L 618.224 839.696 L 618.683 839.844 L 618.577 840.077 L 618.665 840.358 L 618.418 840.656 L 618.201 841.183 L 618.313 841.363 L 618.403 841.473 L 618.656 841.575 L 619.002 841.629 L 619.109 841.956 L 619.273 842.239 L 619.393 842.382 L 619.277 842.908 L 619.511 843.243 L 619.977 843.622 L 620.289 843.789 L 620.747 843.828 L 621.190 844.039 L 621.642 844.492 L 621.883 844.778 L 622.367 845.008 L 622.445 845.120 L 622.416 845.184 L 622.216 845.186 L 621.984 845.057 L 621.734 845.065 L 621.422 845.263 L 620.535 844.938 L 619.355 844.674 L 618.702 844.404 L 618.378 844.238 L 617.529 844.272 L 617.401 844.349 L 617.457 844.390 L 617.779 844.545 L 618.031 844.732 L 618.888 845.025 L 619.490 845.025 L 619.490 845.025 L 619.490 845.025 Z M 600.947 802.992 L 600.730 803.050 L 600.391 802.792 L 600.526 802.537 L 600.703 802.447 L 600.834 802.506 L 600.953 802.688 L 601.274 802.899 L 601.374 803.023 L 601.326 803.161 Z';

// Función para comprobar si un path SVG corresponde a la forma de Malvinas
export function isPathMatchingMalvinas(dString: string): boolean {
  if (!dString) return false;
  // Detección por coordenadas características del archipiélago malvinense (rango x: 575-625, y: 800-855)
  return dString.includes('597.694') || dString.includes('842.519') || (dString.includes('599.555') && dString.includes('847.372'));
}

// Función para comprobar si un path SVG corresponde a la forma de Tierra del Fuego
export function isPathMatchingTierraDelFuego(dString: string): boolean {
  if (!dString) return false;
  // Detección por coordenadas de la isla grande de Tierra del Fuego (ej: M382.67,952.21 o M370.22,950.6)
  return dString.includes('382.67,952.21') || dString.includes('370.22,950.6') || dString.includes('456.77,954.49');
}

/**
 * AUTO-REPARACIÓN INTELIGENTE DE ARGENTINA (AUTO REPAIR ENGINE)
 * Inspecciona el almacenamiento local y corrige automáticamente cualquier corrupción o sobreescritura
 * de Tierra del Fuego (AR-V) y restaura Islas Malvinas (AR-MLV) en su posición exacta e independiente.
 */
export function autoRepairArgentinaMap(): {
  repairedTierraDelFuego: boolean;
  repairedMalvinas: boolean;
  repairedTotalProvinces: number;
} {
  let repairedTierraDelFuego = false;
  let repairedMalvinas = false;
  let repairedTotalProvinces = 0;

  try {
    // 1. Lectura del almacenamiento calibrado
    const rawCalibrated = safeGetItem('argentina_calibrated_map_paths');
    let currentCalibrated: Array<{ id: string; name?: string; d: string }> = [];
    if (rawCalibrated) {
      try {
        const parsed = JSON.parse(rawCalibrated);
        if (Array.isArray(parsed)) currentCalibrated = parsed;
      } catch (e) {
        console.error('Error al parsear argentina_calibrated_map_paths:', e);
      }
    }

    if (currentCalibrated.length === 0) {
      currentCalibrated = provincePaths.map(p => ({ id: p.id, name: p.name, d: p.d }));
    }

    // 2. Inspeccionar Tierra del Fuego (AR-V)
    const tdfIndex = currentCalibrated.findIndex(p => p.id === 'AR-V' || (p.name && p.name.toLowerCase().includes('tierra del fuego')));
    if (tdfIndex !== -1) {
      const currentTdfD = currentCalibrated[tdfIndex].d || '';
      // Si la geometría de Tierra del Fuego contiene el trazo de Malvinas o no contiene la isla grande original:
      if (isPathMatchingMalvinas(currentTdfD) || !isPathMatchingTierraDelFuego(currentTdfD) || currentTdfD.trim().length < 50) {
        currentCalibrated[tdfIndex].d = CANONICAL_TIERRA_DEL_FUEGO_D;
        currentCalibrated[tdfIndex].name = 'Tierra del Fuego';
        currentCalibrated[tdfIndex].id = 'AR-V';
        repairedTierraDelFuego = true;
      }
    } else {
      // Si no existe, lo inyecta completo
      currentCalibrated.push({
        id: 'AR-V',
        name: 'Tierra del Fuego',
        d: CANONICAL_TIERRA_DEL_FUEGO_D
      });
      repairedTierraDelFuego = true;
    }

    // 3. Inspeccionar Islas Malvinas (AR-MLV)
    const mlvIndex = currentCalibrated.findIndex(p => p.id === 'AR-MLV' || (p.name && p.name.toLowerCase().includes('malvin')));
    if (mlvIndex !== -1) {
      const currentMlvD = currentCalibrated[mlvIndex].d || '';
      if (!isPathMatchingMalvinas(currentMlvD) || currentMlvD.trim().length < 50) {
        currentCalibrated[mlvIndex].d = CANONICAL_MALVINAS_D;
        currentCalibrated[mlvIndex].name = 'Islas Malvinas';
        currentCalibrated[mlvIndex].id = 'AR-MLV';
        repairedMalvinas = true;
      }
    } else {
      // Inyecta Malvinas como territorio soberano e independiente en el mapa
      currentCalibrated.push({
        id: 'AR-MLV',
        name: 'Islas Malvinas',
        d: CANONICAL_MALVINAS_D
      });
      repairedMalvinas = true;
    }

    // 4. Asegurar que las 24 provincias existan y tengan geometrías válidas
    provincePaths.forEach(baseP => {
      const idx = currentCalibrated.findIndex(c => c.id === baseP.id);
      if (idx === -1) {
        currentCalibrated.push({ id: baseP.id, name: baseP.name, d: baseP.d });
        repairedTotalProvinces++;
      } else if (!currentCalibrated[idx].d || currentCalibrated[idx].d.trim().length < 20) {
        currentCalibrated[idx].d = baseP.d;
        repairedTotalProvinces++;
      }
    });

    // 5. Persistir si hubo alguna reparación
    if (repairedTierraDelFuego || repairedMalvinas || repairedTotalProvinces > 0) {
      safeSetItem('argentina_calibrated_map_paths', JSON.stringify(currentCalibrated));
      const nowStr = Date.now().toString();
      safeSetItem('argentina_paths_last_updated', nowStr);

      // Limpiar y restaurar entidad específica de canvas de Tierra del Fuego si fue sobreescrita
      const savedTdfCanvas = safeGetItem('argentina_advanced_canvas_map_AR-V');
      if (savedTdfCanvas) {
        try {
          const parsed = JSON.parse(savedTdfCanvas);
          if (parsed && Array.isArray(parsed.paths)) {
            const hasMalvinasInside = parsed.paths.some((p: any) => isPathMatchingMalvinas(p.d) || (p.name && p.name.toLowerCase().includes('malvin')));
            if (hasMalvinasInside) {
              const cleanTdfEntity = {
                id: 'AR-V',
                title: 'Tierra del Fuego',
                name: 'Tierra del Fuego',
                level: 'province',
                paths: (mockProvincesData['AR-V']?.municipalities || [
                  { id: 'tdf_ushuaia', name: 'Ushuaia', value: 34, percentage: 48, d: CANONICAL_TIERRA_DEL_FUEGO_D },
                  { id: 'tdf_riogrande', name: 'Río Grande', value: 38, percentage: 42, d: CANONICAL_TIERRA_DEL_FUEGO_D },
                  { id: 'tdf_tolhuin', name: 'Tolhuin', value: 30, percentage: 10, d: CANONICAL_TIERRA_DEL_FUEGO_D }
                ]).map((m: any) => ({
                  id: m.id,
                  name: m.name,
                  d: m.d || CANONICAL_TIERRA_DEL_FUEGO_D,
                  category: 'Tierra del Fuego',
                  visualStyles: { fillColor: '#10b981', strokeColor: '#0f172a', strokeWidth: 1.2 },
                  customData: { valor: m.value, porcentaje: m.percentage }
                })),
                updatedAt: new Date().toISOString()
              };
              safeSetItem('argentina_advanced_canvas_map_AR-V', JSON.stringify(cleanTdfEntity));
            }
          }
        } catch (e) {}
      }

      // Notificar a toda la aplicación
      window.dispatchEvent(new CustomEvent('argentina_paths_updated'));
    }
  } catch (err) {
    console.error('Error durante autoRepairArgentinaMap:', err);
  }

  return {
    repairedTierraDelFuego,
    repairedMalvinas,
    repairedTotalProvinces
  };
}

/**
 * Restablece exclusivamente Tierra del Fuego al estado original de fábrica
 */
export function restoreTierraDelFuegoToOriginal(): boolean {
  try {
    const rawCalibrated = safeGetItem('argentina_calibrated_map_paths');
    let currentCalibrated: Array<{ id: string; name?: string; d: string }> = [];
    if (rawCalibrated) {
      try {
        currentCalibrated = JSON.parse(rawCalibrated);
      } catch (e) {}
    }
    if (currentCalibrated.length === 0) {
      currentCalibrated = provincePaths.map(p => ({ id: p.id, name: p.name, d: p.d }));
    }

    const tdfIdx = currentCalibrated.findIndex(p => p.id === 'AR-V' || (p.name && p.name.toLowerCase().includes('tierra del fuego')));
    if (tdfIdx !== -1) {
      currentCalibrated[tdfIdx].d = CANONICAL_TIERRA_DEL_FUEGO_D;
      currentCalibrated[tdfIdx].name = 'Tierra del Fuego';
      currentCalibrated[tdfIdx].id = 'AR-V';
    } else {
      currentCalibrated.push({ id: 'AR-V', name: 'Tierra del Fuego', d: CANONICAL_TIERRA_DEL_FUEGO_D });
    }

    safeSetItem('argentina_calibrated_map_paths', JSON.stringify(currentCalibrated));
    const nowStr = Date.now().toString();
    safeSetItem('argentina_paths_last_updated', nowStr);

    // Actualiza la entidad canvas de AR-V
    const cleanTdfEntity = {
      id: 'AR-V',
      title: 'Tierra del Fuego',
      name: 'Tierra del Fuego',
      level: 'province',
      paths: [
        { id: 'tdf_isla_grande', name: 'Isla Grande de Tierra del Fuego', d: CANONICAL_TIERRA_DEL_FUEGO_D, category: 'Tierra del Fuego', visualStyles: { fillColor: '#10b981', strokeColor: '#0f172a', strokeWidth: 1.2 } }
      ],
      updatedAt: new Date().toISOString()
    };
    safeSetItem('argentina_advanced_canvas_map_AR-V', JSON.stringify(cleanTdfEntity));

    window.dispatchEvent(new CustomEvent('argentina_paths_updated'));
    return true;
  } catch (e) {
    console.error('Error al restaurar Tierra del Fuego:', e);
    return false;
  }
}

/**
 * Restablece exclusivamente Islas Malvinas al estado original de fábrica con su posición canónica
 */
export function restoreMalvinasToOriginal(): boolean {
  try {
    const rawCalibrated = safeGetItem('argentina_calibrated_map_paths');
    let currentCalibrated: Array<{ id: string; name?: string; d: string }> = [];
    if (rawCalibrated) {
      try {
        currentCalibrated = JSON.parse(rawCalibrated);
      } catch (e) {}
    }
    if (currentCalibrated.length === 0) {
      currentCalibrated = provincePaths.map(p => ({ id: p.id, name: p.name, d: p.d }));
    }

    const mlvIdx = currentCalibrated.findIndex(p => p.id === 'AR-MLV' || (p.name && p.name.toLowerCase().includes('malvin')));
    if (mlvIdx !== -1) {
      currentCalibrated[mlvIdx].d = CANONICAL_MALVINAS_D;
      currentCalibrated[mlvIdx].name = 'Islas Malvinas';
      currentCalibrated[mlvIdx].id = 'AR-MLV';
    } else {
      currentCalibrated.push({ id: 'AR-MLV', name: 'Islas Malvinas', d: CANONICAL_MALVINAS_D });
    }

    safeSetItem('argentina_calibrated_map_paths', JSON.stringify(currentCalibrated));
    const nowStr = Date.now().toString();
    safeSetItem('argentina_paths_last_updated', nowStr);

    // Actualiza la entidad canvas de AR-MLV
    const cleanMlvEntity = {
      id: 'AR-MLV',
      title: 'Islas Malvinas',
      name: 'Islas Malvinas',
      level: 'province',
      paths: [
        { id: 'mlv_archipelago', name: 'Archipiélago de Malvinas', d: CANONICAL_MALVINAS_D, category: 'Islas Malvinas', visualStyles: { fillColor: '#0284c7', strokeColor: '#0f172a', strokeWidth: 1.2 } }
      ],
      updatedAt: new Date().toISOString()
    };
    safeSetItem('argentina_advanced_canvas_map_AR-MLV', JSON.stringify(cleanMlvEntity));

    window.dispatchEvent(new CustomEvent('argentina_paths_updated'));
    return true;
  } catch (e) {
    console.error('Error al restaurar Islas Malvinas:', e);
    return false;
  }
}

/**
 * Restaura el mapa completo de Argentina con sus 24 provincias y territorios históricos desde provincePaths.ts
 */
export function restoreFullArgentinaMap(): boolean {
  try {
    const freshPaths = provincePaths.map(p => ({
      id: p.id,
      name: p.name,
      d: p.d
    }));
    safeSetItem('argentina_calibrated_map_paths', JSON.stringify(freshPaths));
    const nowStr = Date.now().toString();
    safeSetItem('argentina_paths_last_updated', nowStr);
    window.dispatchEvent(new CustomEvent('argentina_paths_updated'));
    return true;
  } catch (e) {
    console.error('Error al restaurar el mapa completo de Argentina:', e);
    return false;
  }
}
