/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// DEFINICIÓN VECTORIAL COMPLETA DEL MAPA MUNDI (MUNDO / WORLD_MAP)
// Contiene la cartografía poligonal de todos los continentes y naciones principales del planeta.
// Diseñado para escala estándar 1000x520 con proyección cartográfica balanceada.

export interface WorldCountryVector {
  id: string;
  name: string;
  category: 'América del Sur' | 'América del Norte' | 'Europa' | 'Asia' | 'África' | 'Oceanía' | 'Antártida';
  d: string;
  value: number; // Índice socioeconómico de ejemplo
  percentage: number;
  color: string;
}

export const defaultWorldVectorMap: WorldCountryVector[] = [
  // ============================================================================
  // AMÉRICA DEL SUR
  // ============================================================================
  {
    id: 'country',
    name: 'República Argentina',
    category: 'América del Sur',
    d: 'M 295 340 L 305 342 L 310 355 L 305 375 L 300 400 L 295 425 L 290 440 L 285 450 L 280 435 L 285 405 L 290 375 L 292 355 Z M 305 445 L 308 444 L 309 448 L 306 449 Z M 312 446 L 315 445 L 316 448 L 313 449 Z',
    value: 41.7,
    percentage: 12,
    color: '#10b981'
  },
  {
    id: 'BR',
    name: 'Brasil',
    category: 'América del Sur',
    d: 'M 290 270 L 320 265 L 350 275 L 375 295 L 365 330 L 335 345 L 310 355 L 305 342 L 295 340 L 290 320 L 285 295 Z',
    value: 24.3,
    percentage: 45,
    color: '#059669'
  },
  {
    id: 'CL',
    name: 'Chile',
    category: 'América del Sur',
    d: 'M 285 340 L 292 342 L 288 380 L 282 420 L 278 445 L 274 445 L 278 415 L 282 375 Z',
    value: 10.8,
    percentage: 8,
    color: '#3b82f6'
  },
  {
    id: 'UY',
    name: 'Uruguay',
    category: 'América del Sur',
    d: 'M 315 355 L 325 358 L 320 370 L 310 368 Z',
    value: 9.9,
    percentage: 4,
    color: '#0284c7'
  },
  {
    id: 'PY',
    name: 'Paraguay',
    category: 'América del Sur',
    d: 'M 300 320 L 315 320 L 315 340 L 300 340 Z',
    value: 24.0,
    percentage: 6,
    color: '#0d9488'
  },
  {
    id: 'BO',
    name: 'Bolivia',
    category: 'América del Sur',
    d: 'M 285 305 L 305 300 L 310 325 L 295 335 L 285 320 Z',
    value: 36.0,
    percentage: 9,
    color: '#eab308'
  },
  {
    id: 'PE',
    name: 'Perú',
    category: 'América del Sur',
    d: 'M 260 280 L 285 275 L 290 300 L 275 320 L 260 300 Z',
    value: 27.5,
    percentage: 11,
    color: '#f59e0b'
  },
  {
    id: 'CO',
    name: 'Colombia',
    category: 'América del Sur',
    d: 'M 255 240 L 275 240 L 285 260 L 270 275 L 255 260 Z',
    value: 36.6,
    percentage: 12,
    color: '#f97316'
  },
  {
    id: 'VE',
    name: 'Venezuela',
    category: 'América del Sur',
    d: 'M 275 235 L 305 238 L 310 255 L 285 260 L 275 245 Z',
    value: 50.0,
    percentage: 10,
    color: '#ef4444'
  },
  {
    id: 'EC',
    name: 'Ecuador',
    category: 'América del Sur',
    d: 'M 250 265 L 265 265 L 260 280 L 250 275 Z',
    value: 25.0,
    percentage: 5,
    color: '#84cc16'
  },
  {
    id: 'GY_SR_GF',
    name: 'Guyanas y Surinam',
    category: 'América del Sur',
    d: 'M 305 240 L 330 245 L 325 260 L 305 255 Z',
    value: 28.0,
    percentage: 3,
    color: '#06b6d4'
  },

  // ============================================================================
  // AMÉRICA DEL NORTE Y CENTRAL
  // ============================================================================
  {
    id: 'US',
    name: 'Estados Unidos',
    category: 'América del Norte',
    d: 'M 140 135 L 250 135 L 255 170 L 235 190 L 195 195 L 160 185 L 135 155 Z M 80 80 L 125 75 L 115 110 L 75 105 Z',
    value: 11.5,
    percentage: 35,
    color: '#6366f1'
  },
  {
    id: 'CA',
    name: 'Canadá',
    category: 'América del Norte',
    d: 'M 120 70 L 260 65 L 250 135 L 140 135 L 120 100 Z M 210 40 L 245 45 L 235 65 L 205 60 Z',
    value: 9.8,
    percentage: 28,
    color: '#8b5cf6'
  },
  {
    id: 'MX',
    name: 'México',
    category: 'América del Norte',
    d: 'M 160 185 L 195 195 L 225 210 L 230 230 L 200 230 L 175 205 Z',
    value: 36.3,
    percentage: 18,
    color: '#ec4899'
  },
  {
    id: 'CENTRAL_AMERICA',
    name: 'América Central y Caribe',
    category: 'América del Norte',
    d: 'M 225 225 L 255 240 L 245 250 L 220 235 Z M 240 215 L 260 215 L 275 225 L 250 225 Z',
    value: 32.0,
    percentage: 9,
    color: '#d946ef'
  },
  {
    id: 'GL',
    name: 'Groenlandia',
    category: 'América del Norte',
    d: 'M 290 35 L 360 30 L 340 85 L 285 70 Z',
    value: 8.5,
    percentage: 2,
    color: '#94a3b8'
  },

  // ============================================================================
  // EUROPA
  // ============================================================================
  {
    id: 'ES',
    name: 'España y Portugal',
    category: 'Europa',
    d: 'M 440 170 L 465 170 L 460 195 L 435 195 Z',
    value: 20.4,
    percentage: 10,
    color: '#8b5cf6'
  },
  {
    id: 'FR',
    name: 'Francia',
    category: 'Europa',
    d: 'M 465 150 L 490 150 L 485 175 L 460 175 Z',
    value: 14.5,
    percentage: 14,
    color: '#3b82f6'
  },
  {
    id: 'DE',
    name: 'Alemania y Centroeuropa',
    category: 'Europa',
    d: 'M 490 135 L 520 135 L 515 165 L 485 165 Z',
    value: 13.2,
    percentage: 18,
    color: '#06b6d4'
  },
  {
    id: 'GB_IE',
    name: 'Reino Unido e Irlanda',
    category: 'Europa',
    d: 'M 450 120 L 470 120 L 465 145 L 445 145 Z',
    value: 16.0,
    percentage: 12,
    color: '#0284c7'
  },
  {
    id: 'IT',
    name: 'Italia y Mediterráneo',
    category: 'Europa',
    d: 'M 485 168 L 505 165 L 515 195 L 495 195 Z',
    value: 19.0,
    percentage: 11,
    color: '#10b981'
  },
  {
    id: 'NORDIC',
    name: 'Países Nórdicos (Suecia, Noruega, Finlandia)',
    category: 'Europa',
    d: 'M 485 75 L 535 70 L 525 125 L 480 125 Z',
    value: 8.0,
    percentage: 15,
    color: '#14b8a6'
  },
  {
    id: 'EAST_EU',
    name: 'Europa del Este y Balcanes',
    category: 'Europa',
    d: 'M 520 130 L 565 130 L 555 175 L 510 175 Z',
    value: 22.0,
    percentage: 14,
    color: '#a855f7'
  },

  // ============================================================================
  // ÁFRICA
  // ============================================================================
  {
    id: 'NORTH_AFRICA',
    name: 'Norte de África (Marruecos, Argelia, Egipto)',
    category: 'África',
    d: 'M 435 200 L 545 200 L 535 240 L 430 240 Z',
    value: 26.0,
    percentage: 18,
    color: '#f59e0b'
  },
  {
    id: 'WEST_AFRICA',
    name: 'África Occidental y Sahel',
    category: 'África',
    d: 'M 420 240 L 480 240 L 475 285 L 435 285 L 415 260 Z',
    value: 42.0,
    percentage: 22,
    color: '#ea580c'
  },
  {
    id: 'CENTRAL_AFRICA',
    name: 'África Central (Congo, Camerún, Gabón)',
    category: 'África',
    d: 'M 480 245 L 525 245 L 520 310 L 475 305 Z',
    value: 48.0,
    percentage: 16,
    color: '#d97706'
  },
  {
    id: 'EAST_AFRICA',
    name: 'África Oriental y Cuerno de África',
    category: 'África',
    d: 'M 525 225 L 565 245 L 550 315 L 515 300 Z',
    value: 39.0,
    percentage: 19,
    color: '#f97316'
  },
  {
    id: 'SOUTH_AFRICA',
    name: 'Sudáfrica y Cono Sur Africano',
    category: 'África',
    d: 'M 480 310 L 535 315 L 520 380 L 485 375 Z M 545 320 L 560 325 L 550 365 L 535 355 Z',
    value: 33.0,
    percentage: 20,
    color: '#ca8a04'
  },

  // ============================================================================
  // ASIA Y MEDIO ORIENTE
  // ============================================================================
  {
    id: 'RU',
    name: 'Rusia y Norte de Asia',
    category: 'Asia',
    d: 'M 535 65 L 850 65 L 820 135 L 565 130 Z',
    value: 13.0,
    percentage: 30,
    color: '#6366f1'
  },
  {
    id: 'MIDDLE_EAST',
    name: 'Medio Oriente y Península Arábiga',
    category: 'Asia',
    d: 'M 545 180 L 605 180 L 595 240 L 545 220 Z',
    value: 17.5,
    percentage: 15,
    color: '#eab308'
  },
  {
    id: 'CENTRAL_ASIA',
    name: 'Asia Central (Kazajistán, Uzbekistán)',
    category: 'Asia',
    d: 'M 570 130 L 660 130 L 650 175 L 565 175 Z',
    value: 19.0,
    percentage: 11,
    color: '#06b6d4'
  },
  {
    id: 'IN',
    name: 'India y Asia del Sur',
    category: 'Asia',
    d: 'M 645 185 L 705 185 L 685 260 L 655 235 Z',
    value: 21.9,
    percentage: 26,
    color: '#f97316'
  },
  {
    id: 'CN',
    name: 'China y Asia Oriental',
    category: 'Asia',
    d: 'M 665 135 L 795 135 L 785 210 L 695 210 L 655 175 Z',
    value: 14.2,
    percentage: 42,
    color: '#ef4444'
  },
  {
    id: 'JP_KR',
    name: 'Japón y Corea',
    category: 'Asia',
    d: 'M 805 145 L 835 145 L 825 195 L 795 195 Z',
    value: 12.0,
    percentage: 18,
    color: '#ec4899'
  },
  {
    id: 'SOUTHEAST_ASIA',
    name: 'Sudeste Asiático e Indonesia',
    category: 'Asia',
    d: 'M 710 215 L 775 215 L 760 260 L 700 250 Z M 715 270 L 800 270 L 790 300 L 710 290 Z',
    value: 25.0,
    percentage: 24,
    color: '#10b981'
  },

  // ============================================================================
  // OCEANÍA
  // ============================================================================
  {
    id: 'AU',
    name: 'Australia',
    category: 'Oceanía',
    d: 'M 770 330 L 870 330 L 855 410 L 760 395 Z M 835 420 L 850 420 L 845 435 L 830 435 Z',
    value: 13.0,
    percentage: 20,
    color: '#0284c7'
  },
  {
    id: 'NZ_PACIFIC',
    name: 'Nueva Zelanda e Islas del Pacífico',
    category: 'Oceanía',
    d: 'M 885 400 L 910 400 L 900 445 L 875 440 Z M 820 300 L 890 300 L 880 325 L 810 320 Z',
    value: 12.5,
    percentage: 8,
    color: '#06b6d4'
  },

  // ============================================================================
  // ANTÁRTIDA
  // ============================================================================
  {
    id: 'AQ',
    name: 'Antártida',
    category: 'Antártida',
    d: 'M 100 490 L 900 490 L 880 515 L 120 515 Z',
    value: 0.0,
    percentage: 1,
    color: '#64748b'
  }
];

// FUNCIÓN GENERADORA DEL OBJETO VECTORIAL COMPLETO DE MUNDO
export const getCleanWorldMapEntity = () => {
  return {
    id: 'WORLD_MAP',
    name: 'Mapa Mundial',
    level: 'mundo',
    updatedAt: new Date().toISOString(),
    paths: defaultWorldVectorMap.map(c => ({
      id: c.id,
      name: c.name,
      d: c.d,
      category: c.category,
      visualStyles: {
        fillColor: c.color,
        strokeColor: '#0f172a',
        strokeWidth: 1.2
      },
      customData: {
        valor: c.value,
        porcentaje: c.percentage,
        fill: c.color,
        region: c.category
      }
    }))
  };
};

// FUNCIÓN PARA RESTAURAR Y REPARAR EL MAPA MUNDIAL EN ALMACENAMIENTO
export const repairAndRestoreWorldMap = () => {
  const cleanEntity = getCleanWorldMapEntity();
  const serialized = JSON.stringify(cleanEntity);

  try {
    sessionStorage.removeItem('argentina_direct_associate_source');
    localStorage.setItem('argentina_advanced_canvas_map_WORLD_MAP', serialized);
    localStorage.setItem('argentina_advanced_canvas_map_world', serialized);
    localStorage.setItem('argentina_advanced_canvas_map_mundo', serialized);
  } catch (e) {
    console.error('Error al restaurar World Map en localStorage:', e);
  }

  return cleanEntity;
};
