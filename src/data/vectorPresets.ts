/**
 * @file vectorPresets.ts
 * @description Biblioteca de trazados y siluetas predefinidas para agregar nuevos elementos,
 * territorios faltantes (como Islas Malvinas, Sector Antártico), partes anatómicas del cuerpo humano
 * y figuras geométricas al mapa vectorial sin reemplazar el contenido existente.
 */

// Interfaz para definir un elemento predefinido listo para ser agregado al mapa
export interface PresetVectorElement {
  id: string; // Identificador único sugerido (ej: 'AR-MLV', 'HUMAN-ARM-L')
  name: string; // Nombre visible oficial (ej: 'Islas Malvinas', 'Brazo Izquierdo')
  category: 'territorio' | 'anatomia' | 'geometrico' | 'simbolo'; // Categoría temática
  description: string; // Descripción breve para el usuario
  d: string; // Coordenadas del trazado vectorial SVG (string 'd')
  defaultFill?: string; // Color sugerido de relleno
  defaultStroke?: string; // Color sugerido de contorno
  defaultStrokeWidth?: number; // Grosor de contorno sugerido
  suggestedWidth?: number; // Ancho visual orientativo
  suggestedHeight?: number; // Alto visual orientativo
  tags?: string[]; // Etiquetas de búsqueda rápida
}

// 1. PRESETS DE TERRITORIOS OFICIALES Y REGIONES GEOGRÁFICAS
export const TERRITORY_PRESETS: PresetVectorElement[] = [
  {
    id: 'AR-MLV',
    name: 'Islas Malvinas',
    category: 'territorio',
    description: 'Archipiélago de las Islas Malvinas con costas detalladas y coordenadas alineadas al territorio nacional.',
    d: 'M 597.694 842.519 L 597.430 842.290 L 597.316 841.937 L 596.623 842.319 L 596.447 842.324 L 596.207 842.213 L 595.981 841.871 L 595.768 841.892 L 595.596 841.932 L 595.562 841.850 L 595.655 841.660 L 595.948 841.559 L 596.143 841.371 L 596.104 841.241 L 595.654 841.054 L 595.580 840.709 L 595.471 840.635 L 595.079 841.351 L 595.105 842.076 L 595.015 842.182 L 595.051 842.287 L 595.082 842.575 L 594.959 842.732 L 594.790 843.173 L 595.206 843.521 L 595.304 843.730 L 595.248 844.038 L 595.002 844.340 L 594.722 844.452 L 594.013 844.325 L 593.395 844.348 L 592.700 844.244 L 592.032 844.270 L 591.498 844.369 L 590.750 844.597 L 590.086 844.913 L 589.963 844.706 L 590.145 844.387 L 590.598 843.993 L 591.189 843.707 L 591.743 843.194 L 591.892 842.926 L 591.890 842.781 L 591.802 842.789 L 591.446 843.138 L 590.934 843.445 L 591.080 843.015 L 590.924 843.102 L 590.244 843.626 L 590.095 843.627 L 590.098 843.156 L 589.996 843.188 L 589.847 843.336 L 589.512 843.525 L 589.284 843.764 L 588.825 843.855 L 588.687 844.231 L 588.380 844.454 L 588.072 844.288 L 587.618 844.306 L 588.110 844.903 L 588.218 845.220 L 588.339 845.039 L 588.547 845.093 L 588.679 845.759 L 588.662 846.209 L 588.694 846.279 L 588.862 846.190 L 588.861 846.421 L 588.741 846.856 L 588.742 847.232 L 588.723 847.294 L 588.625 847.945 L 588.774 848.283 L 588.850 848.288 L 588.975 848.143 L 588.979 848.058 L 589.112 847.258 L 589.140 846.916 L 589.276 846.019 L 589.337 845.262 L 589.469 844.946 L 589.672 844.952 L 589.750 845.090 L 589.499 845.489 L 589.527 846.250 L 589.387 847.220 L 589.331 848.037 L 589.313 848.100 L 589.171 848.816 L 588.987 849.002 L 588.753 849.072 L 588.433 849.538 L 588.233 850.054 L 587.934 850.360 L 587.454 851.119 L 587.026 851.655 L 586.967 852.073 L 586.645 852.272 L 586.496 852.310 L 586.109 852.491 L 585.967 852.467 L 585.819 852.142 L 585.658 852.302 L 585.528 852.277 L 585.304 852.067 L 585.335 851.749 L 585.236 851.274 L 585.024 851.063 L 584.850 851.224 L 585.058 851.654 L 585.110 851.915 L 585.007 852.276 L 585.132 852.374 L 585.338 852.403 L 585.497 852.595 L 585.669 852.664 L 585.810 852.930 L 585.611 853.214 L 585.110 853.285 L 584.840 853.127 L 584.672 852.973 L 584.367 853.098 L 584.206 852.894 L 584.388 852.430 L 584.376 851.934 L 584.276 851.701 L 584.188 851.587 L 583.932 851.562 L 583.700 851.656 L 583.627 851.687 L 583.142 851.912 L 582.781 852.102 L 582.431 852.413 L 582.382 852.562 L 582.539 852.730 L 582.791 852.841 L 583.062 852.877 L 583.053 853.047 L 582.861 853.282 L 582.615 853.365 L 582.198 853.257 L 581.959 852.904 L 582.029 852.206 L 581.973 852.030 L 581.763 852.206 L 581.567 852.660 L 580.760 851.957 L 580.030 851.125 L 579.782 850.796 L 579.723 850.329 L 579.769 850.022 L 579.749 849.951 L 579.603 850.013 L 579.403 850.430 L 579.090 850.604 L 578.708 850.589 L 578.630 850.693 L 578.329 850.732 L 578.306 850.879 L 578.341 850.985 L 578.527 851.065 L 578.871 851.083 L 579.007 851.040 Z M 599.555 847.372 L 599.642 847.167 L 599.809 847.001 L 599.866 846.764 L 599.771 846.313 L 599.859 846.120 L 600.096 846.007 L 600.317 846.163 L 600.426 846.332 L 600.790 846.228 L 600.838 846.405 L 600.641 846.732 L 600.502 847.211 L 600.550 847.290 L 600.615 847.306 L 600.774 847.275 L 600.977 846.996 L 601.124 847.161 L 601.059 847.339 L 600.929 847.500 L 600.926 847.670 L 600.777 847.785 L 600.839 847.875 L 601.337 847.840 L 601.709 847.698 L 601.775 847.727 L 601.798 847.809 L 601.774 848.104 L 601.873 848.287 L 601.942 848.339 L 602.051 848.010 L 602.255 847.937 L 602.478 847.910 L 602.537 847.782 L 602.458 847.657 L 602.097 847.397 L 602.253 847.244 L 602.620 847.164 L 602.685 846.889 L 602.638 846.627 L 602.720 846.581 L 603.144 846.846 L 603.118 847.031 L 603.422 847.530 L 603.766 847.184 L 603.921 847.409 L 604.248 847.406 L 604.341 847.540 L 604.267 847.938 L 604.484 847.961 L 604.629 847.919 L 604.744 848.124 L 604.648 848.354 L 604.490 848.398 L 604.306 848.335 L 604.323 848.564 L 604.429 848.794 L 604.640 848.963 L 604.646 849.108 L 604.564 849.252 L 604.633 849.389 L 604.597 849.503 L 604.135 849.340 L 603.963 849.373 L 603.823 849.548 L 603.738 849.667 L 603.459 849.944 L 603.419 850.119 L 603.555 850.103 L 603.888 849.856 L 604.116 849.768 L 604.359 849.799 L 604.887 850.562 L 604.811 850.754 L 604.728 850.885 L 604.884 839.024 L 604.843 851.479 L 604.924 852.004 L 604.889 852.215 L 604.978 852.314 L 605.140 852.306 L 605.279 852.022 L 605.300 851.509 L 605.182 851.086 L 605.254 850.968 L 605.444 851.066 L 605.694 851.534 L 605.640 851.796 L 605.974 852.132 L 606.199 852.786 L 606.253 852.816 L 606.375 852.497 L 606.604 852.518 L 606.635 852.369 L 606.459 851.989 L 606.476 851.926 L 606.682 851.962 L 607.318 852.103 L 607.458 852.111 L 607.530 851.992 L 607.352 851.880 L 606.604 851.753 L 606.514 851.642 L 606.622 851.410 L 606.572 851.318 L 606.273 851.245 L 606.237 851.067 L 606.457 850.919 L 606.126 850.801 L 605.849 850.798 L 605.655 850.664 L 605.535 850.423 L 605.599 850.136 L 605.440 849.985 L 605.091 849.820 L 605.000 849.697 L 605.110 849.478 L 605.335 849.377 L 605.289 849.115 L 605.295 849.066 L 605.453 849.120 L 605.600 848.993 L 605.707 849.041 L 605.958 849.326 L 606.618 849.660 L 607.011 849.964 L 607.341 850.082 L 607.688 850.137 L 608.001 850.026 L 608.274 850.187 L 608.370 850.151 L 608.360 850.080 L 608.101 849.832 L 607.667 849.690 L 607.327 849.306 L 607.020 849.173 L 607.030 849.062 L 607.317 848.942 L 607.259 848.889 L 606.059 848.560 L 605.650 848.415 L 605.629 848.260 L 605.775 848.218 L 606.030 848.053 L 606.082 847.974 L 606.028 847.847 L 605.853 847.759 L 605.453 847.685 L 605.354 847.503 L 605.209 847.448 L 605.106 847.339 L 605.426 847.190 L 605.513 846.985 L 605.721 846.851 L 606.119 846.912 L 606.363 846.858 L 606.548 846.446 L 606.741 846.289 L 606.856 846.020 L 606.754 845.911 L 606.408 845.953 L 605.705 846.245 L 605.149 846.324 L 604.681 846.296 L 604.449 846.154 L 604.466 845.994 L 604.427 845.792 L 604.280 845.822 L 604.238 845.888 L 603.988 845.991 L 603.723 845.986 L 603.575 845.907 L 603.525 845.718 L 603.951 844.937 L 604.111 844.140 L 604.035 843.943 L 603.797 843.850 L 603.652 843.891 L 603.504 844.396 L 603.155 844.511 L 602.889 845.078 L 602.842 845.387 L 602.723 845.535 L 602.543 845.605 L 602.406 845.609 L 602.130 845.327 L 601.917 845.522 L 601.691 845.525 L 601.480 845.344 L 601.206 845.461 L 601.059 845.394 L 601.027 845.337 L 601.054 845.066 L 601.198 844.818 L 601.048 844.630 L 600.990 844.564 L 601.101 844.356 L 601.337 844.243 L 601.480 843.885 L 601.432 843.806 L 600.925 843.866 L 600.905 843.711 L 601.011 843.564 L 601.537 843.356 L 601.731 843.308 L 602.037 843.053 L 602.596 843.107 L 602.579 842.976 L 602.357 842.808 L 602.457 842.613 L 602.787 842.355 L 602.915 842.279 L 602.901 841.879 L 603.199 841.467 L 603.436 841.365 L 603.552 841.388 L 603.805 841.017 L 604.007 840.834 L 604.037 840.587 L 603.999 840.386 L 604.130 840.139 L 604.324 839.799 L 604.211 839.606 L 604.434 839.494 L 604.551 839.431 L 604.599 839.219 L 604.486 838.928 L 604.501 838.854 L 605.018 838.876 L 605.149 838.824 L 605.299 838.636 L 605.870 838.688 L 606.021 838.499 L 606.275 838.529 L 607.036 838.789 L 607.169 838.663 L 608.121 838.559 L 608.393 838.538 L 608.773 838.284 L 608.944 838.251 L 609.363 838.479 L 609.452 838.492 L 609.481 838.428 L 609.643 838.323 L 609.971 838.246 L 610.220 838.240 L 610.841 838.382 L 611.092 838.010 L 611.290 837.901 L 612.175 837.681 L 612.349 838.134 L 612.710 838.211 L 612.792 837.982 L 613.143 837.889 L 613.982 837.797 L 614.329 837.863 L 614.486 837.442 L 614.626 837.461 L 614.929 837.386 L 615.066 837.564 L 615.366 837.465 L 615.558 837.222 L 615.666 837.184 L 616.088 837.435 L 617.033 837.937 L 617.354 838.456 L 617.394 838.657 L 617.379 838.732 L 617.469 838.940 L 617.751 839.354 L 618.224 839.696 L 618.683 839.844 L 618.577 840.077 L 618.665 840.358 L 618.418 840.656 L 618.201 841.183 L 618.313 841.363 L 618.403 841.473 L 618.656 841.575 L 619.002 841.629 L 619.109 841.956 L 619.273 842.239 L 619.393 842.382 L 619.277 842.908 L 619.511 843.243 L 619.977 843.622 L 620.289 843.789 L 620.747 843.828 L 621.190 844.039 L 621.642 844.492 L 621.883 844.778 L 622.367 845.008 L 622.445 845.120 L 622.416 845.184 L 622.216 845.186 L 621.984 845.057 L 621.734 845.065 L 621.422 845.263 L 620.535 844.938 L 619.355 844.674 L 618.702 844.404 L 618.378 844.238 L 617.529 844.272 L 617.401 844.349 L 617.457 844.390 L 617.779 844.545 L 618.031 844.732 L 618.888 845.025 L 619.490 845.025 L 619.490 845.025 L 619.490 845.025 Z M 600.947 802.992 L 600.730 803.050 L 600.391 802.792 L 600.526 802.537 L 600.703 802.447 L 600.834 802.506 L 600.953 802.688 L 601.274 802.899 L 601.374 803.023 L 601.326 803.161 Z',
    defaultFill: '#10b981',
    defaultStroke: '#0f172a',
    defaultStrokeWidth: 1.0,
    tags: ['malvinas', 'islas', 'argentina', 'atlantico', 'patagonia', 'territorio']
  },
  {
    id: 'AR-ANT',
    name: 'Sector Antártico Argentino',
    category: 'territorio',
    description: 'Cuña territorial del Sector Antártico Argentino comprendida entre los meridianos 25°O y 74°O y el paralelo 60°S.',
    d: 'M 480 880 L 640 880 L 590 980 L 530 980 Z',
    defaultFill: '#38bdf8',
    defaultStroke: '#0284c7',
    defaultStrokeWidth: 1.2,
    tags: ['antartida', 'polo sur', 'nieve', 'hielo', 'continente blanco']
  },
  {
    id: 'AR-C',
    name: 'CABA (Ciudad Autónoma de Bs As)',
    category: 'territorio',
    description: 'Ciudad Autónoma de Buenos Aires delimitada sobre la costa del Río de la Plata y General Paz.',
    d: 'M595.25,320.02L594.87,320.37L592.64,321.46L591.16,320.58L591.16,319.38L591.88,317.81L592.55,317.53L593.47,318.4L594.73,318.77Z',
    defaultFill: '#f59e0b',
    defaultStroke: '#b45309',
    defaultStrokeWidth: 1.0,
    tags: ['caba', 'capital', 'buenos aires', 'federal', 'ciudad']
  },
  {
    id: 'AR-GEO',
    name: 'Islas Georgias del Sur',
    category: 'territorio',
    description: 'Archipiélago de las Islas Georgias del Sur en el Atlántico Sur.',
    d: 'M 645 860 C 650 858, 658 862, 662 865 C 665 868, 660 873, 655 872 C 648 870, 642 864, 645 860 Z',
    defaultFill: '#14b8a6',
    defaultStroke: '#0f766e',
    defaultStrokeWidth: 1.0,
    tags: ['georgias', 'islas', 'atlantico sur', 'antartico']
  }
];

// 2. PRESETS ANATÓMICOS Y DEL CUERPO HUMANO (MIEMBROS, ÓRGANOS, SISTEMAS)
export const ANATOMY_PRESETS: PresetVectorElement[] = [
  {
    id: 'HUMAN-ARM-R',
    name: 'Brazo Derecho',
    category: 'anatomia',
    description: 'Miembro superior derecho completo (hombro, brazo, antebrazo y mano).',
    d: 'M 280 220 C 310 240, 330 280, 340 330 C 345 360, 335 390, 320 420 C 315 415, 305 380, 300 340 C 295 300, 275 250, 280 220 Z',
    defaultFill: '#f43f5e',
    defaultStroke: '#9f1239',
    defaultStrokeWidth: 1.2,
    tags: ['brazo', 'derecho', 'miembro', 'superior', 'musculo', 'cuerpo humano']
  },
  {
    id: 'HUMAN-ARM-L',
    name: 'Brazo Izquierdo',
    category: 'anatomia',
    description: 'Miembro superior izquierdo completo (hombro, brazo, antebrazo y mano).',
    d: 'M 220 220 C 190 240, 170 280, 160 330 C 155 360, 165 390, 180 420 C 185 415, 195 380, 200 340 C 205 300, 225 250, 220 220 Z',
    defaultFill: '#f43f5e',
    defaultStroke: '#9f1239',
    defaultStrokeWidth: 1.2,
    tags: ['brazo', 'izquierdo', 'miembro', 'superior', 'musculo', 'cuerpo humano']
  },
  {
    id: 'HUMAN-LEG-R',
    name: 'Pierna Derecha',
    category: 'anatomia',
    description: 'Miembro inferior derecho (muslo, rodilla, pantorrilla y pie).',
    d: 'M 265 420 C 275 460, 280 520, 285 580 C 290 620, 275 660, 260 680 C 250 670, 255 610, 250 550 C 248 500, 245 440, 265 420 Z',
    defaultFill: '#e11d48',
    defaultStroke: '#881337',
    defaultStrokeWidth: 1.2,
    tags: ['pierna', 'derecha', 'miembro', 'inferior', 'muslo', 'pie']
  },
  {
    id: 'HUMAN-LEG-L',
    name: 'Pierna Izquierda',
    category: 'anatomia',
    description: 'Miembro inferior izquierdo (muslo, rodilla, pantorrilla y pie).',
    d: 'M 235 420 C 225 460, 220 520, 215 580 C 210 620, 225 660, 240 680 C 250 670, 245 610, 250 550 C 252 500, 255 440, 235 420 Z',
    defaultFill: '#e11d48',
    defaultStroke: '#881337',
    defaultStrokeWidth: 1.2,
    tags: ['pierna', 'izquierda', 'miembro', 'inferior', 'muslo', 'pie']
  },
  {
    id: 'HUMAN-TORSO',
    name: 'Torso / Tórax',
    category: 'anatomia',
    description: 'Tronco y caja torácica central del cuerpo humano.',
    d: 'M 220 220 C 240 215, 260 215, 280 220 C 285 270, 280 350, 265 420 C 250 425, 250 425, 235 420 C 220 350, 215 270, 220 220 Z',
    defaultFill: '#fb7185',
    defaultStroke: '#be123c',
    defaultStrokeWidth: 1.2,
    tags: ['torso', 'torax', 'tronco', 'pecho', 'abdomen']
  },
  {
    id: 'HUMAN-HEAD',
    name: 'Cabeza / Cráneo',
    category: 'anatomia',
    description: 'Cabeza humana simétrica con cuello y contorno craneal.',
    d: 'M 250 120 C 275 120, 285 140, 285 165 C 285 190, 270 210, 250 215 C 230 210, 215 190, 215 165 C 215 140, 225 120, 250 120 Z',
    defaultFill: '#fda4af',
    defaultStroke: '#9f1239',
    defaultStrokeWidth: 1.2,
    tags: ['cabeza', 'craneo', 'cara', 'cerebro']
  },
  {
    id: 'ORGAN-HEART',
    name: 'Órgano Corazón',
    category: 'anatomia',
    description: 'Órgano vital cardiovascular estilizado con aurículas y ventrículos.',
    d: 'M 250 260 C 235 230, 195 240, 205 280 C 215 320, 250 350, 250 350 C 250 350, 285 320, 295 280 C 305 240, 265 230, 250 260 Z',
    defaultFill: '#dc2626',
    defaultStroke: '#7f1d1d',
    defaultStrokeWidth: 1.2,
    tags: ['corazon', 'organo', 'cardiovascular', 'sangre', 'pecho']
  },
  {
    id: 'ORGAN-LUNGS',
    name: 'Órgano Pulmones',
    category: 'anatomia',
    description: 'Par de pulmones izquierdo y derecho con bronquios principales.',
    d: 'M 245 250 C 220 250, 200 280, 205 330 C 210 360, 235 370, 245 350 C 246 320, 246 280, 245 250 Z M 255 250 C 280 250, 300 280, 295 330 C 290 360, 265 370, 255 350 C 254 320, 254 280, 255 250 Z',
    defaultFill: '#60a5fa',
    defaultStroke: '#1e40af',
    defaultStrokeWidth: 1.2,
    tags: ['pulmones', 'respiratorio', 'organo', 'aire']
  },
  {
    id: 'ORGAN-BRAIN',
    name: 'Órgano Cerebro',
    category: 'anatomia',
    description: 'Cerebro con hemisferios y circunvoluciones corticales.',
    d: 'M 250 140 C 230 135, 210 150, 215 170 C 210 185, 225 200, 245 198 C 248 200, 252 200, 255 198 C 275 200, 290 185, 285 170 C 290 150, 270 135, 250 140 Z',
    defaultFill: '#c084fc',
    defaultStroke: '#6b21a8',
    defaultStrokeWidth: 1.2,
    tags: ['cerebro', 'neurologico', 'mente', 'pensamiento', 'craneo']
  }
];

// 3. PRESETS GEOMÉTRICOS Y SILUETAS PERSONALIZABLES
export const GEOMETRIC_PRESETS: PresetVectorElement[] = [
  {
    id: 'SHAPE-HEXAGON',
    name: 'Polígono Hexagonal',
    category: 'geometrico',
    description: 'Polígono regular de 6 lados ideal para zonificaciones y cuadrículas.',
    d: 'M 250 200 L 290 225 L 290 275 L 250 300 L 210 275 L 210 225 Z',
    defaultFill: '#10b981',
    defaultStroke: '#047857',
    defaultStrokeWidth: 1.0,
    tags: ['hexagono', 'poligono', 'geometria', 'zona']
  },
  {
    id: 'SHAPE-CIRCLE',
    name: 'Círculo / Zona de Radio',
    category: 'geometrico',
    description: 'Área circular para delimitar radios de cobertura o puntos de interés.',
    d: 'M 250 200 A 50 50 0 1 0 250 300 A 50 50 0 1 0 250 200 Z',
    defaultFill: '#38bdf8',
    defaultStroke: '#0284c7',
    defaultStrokeWidth: 1.0,
    tags: ['circulo', 'radio', 'area', 'cobertura', 'buffer']
  },
  {
    id: 'SHAPE-RECTANGLE',
    name: 'Rectángulo Catastral',
    category: 'geometrico',
    description: 'Parcela o cuadrante rectangular para demarcaciones precisas.',
    d: 'M 200 220 L 300 220 L 300 280 L 200 280 Z',
    defaultFill: '#f59e0b',
    defaultStroke: '#b45309',
    defaultStrokeWidth: 1.0,
    tags: ['rectangulo', 'parcela', 'lote', 'catastro', 'cuadrante']
  },
  {
    id: 'SHAPE-STAR',
    name: 'Estrella / Marcador de Capital',
    category: 'simbolo',
    description: 'Estrella de 5 puntas para identificar capitales, hitos o sedes principales.',
    d: 'M 250 210 L 262 238 L 292 240 L 268 258 L 276 288 L 250 270 L 224 288 L 232 258 L 208 240 L 238 238 Z',
    defaultFill: '#fbbf24',
    defaultStroke: '#d97706',
    defaultStrokeWidth: 1.2,
    tags: ['estrella', 'capital', 'hito', 'marcador', 'punto']
  }
];

// Arreglo unificado con todos los elementos disponibles para búsqueda rápida
export const ALL_PRESETS: PresetVectorElement[] = [
  ...TERRITORY_PRESETS,
  ...ANATOMY_PRESETS,
  ...GEOMETRIC_PRESETS
];
