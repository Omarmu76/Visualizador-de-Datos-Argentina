/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProvinceData } from '../types';

export const provincesList = [
  { id: 'AR-B', name: 'Buenos Aires', abbreviation: 'BS AS' },
  { id: 'AR-C', name: 'CABA', abbreviation: 'CABA' },
  { id: 'AR-K', name: 'Catamarca', abbreviation: 'CAT' },
  { id: 'AR-H', name: 'Chaco', abbreviation: 'CHQ' },
  { id: 'AR-U', name: 'Chubut', abbreviation: 'CHB' },
  { id: 'AR-X', name: 'Córdoba', abbreviation: 'CDB' },
  { id: 'AR-W', name: 'Corrientes', abbreviation: 'CRR' },
  { id: 'AR-E', name: 'Entre Ríos', abbreviation: 'E RIOS' },
  { id: 'AR-P', name: 'Formosa', abbreviation: 'FOR' },
  { id: 'AR-Y', name: 'Jujuy', abbreviation: 'JUJ' },
  { id: 'AR-L', name: 'La Pampa', abbreviation: 'PAMPA' },
  { id: 'AR-F', name: 'La Rioja', abbreviation: 'RIOJA' },
  { id: 'AR-M', name: 'Mendoza', abbreviation: 'MND' },
  { id: 'AR-N', name: 'Misiones', abbreviation: 'MIS' },
  { id: 'AR-Q', name: 'Neuquén', abbreviation: 'NEU' },
  { id: 'AR-R', name: 'Río Negro', abbreviation: 'R NEGRO' },
  { id: 'AR-A', name: 'Salta', abbreviation: 'SALTA' },
  { id: 'AR-J', name: 'San Juan', abbreviation: 'S JUAN' },
  { id: 'AR-D', name: 'San Luis', abbreviation: 'S LUIS' },
  { id: 'AR-Z', name: 'Santa Cruz', abbreviation: 'S CRUZ' },
  { id: 'AR-S', name: 'Santa Fe', abbreviation: 'S FE' },
  { id: 'AR-G', name: 'Santiago del Estero', abbreviation: 'S EST' },
  { id: 'AR-V', name: 'Tierra del Fuego', abbreviation: 'T FUEGO' },
  { id: 'AR-T', name: 'Tucumán', abbreviation: 'TUC' },
  { id: 'AR-MLV', name: 'Islas Malvinas', abbreviation: 'MALVINAS' }
];

// Helper to generate generic mock data for baseline provinces
const createBaselineProvince = (id: string, name: string, abbreviation: string): ProvinceData => {
  // Hash function for repeatable pseudo-random values based on province ID
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const scale = (hash % 10) / 10; // 0.0 to 0.9

  const pobreza = Math.round(25 + scale * 25); // 25% to 48%
  const desempleo = Math.round(6 + scale * 8); // 6% to 14%
  const informalEmployment = Math.round(35 + scale * 20); // 35% to 55%
  const youthInformality = Math.round(15 + scale * 15); // 15% to 30%
  const gini = Number((0.38 + scale * 0.1).toFixed(2)); // 0.38 to 0.48
  const pib = `$${(4.2 + scale * 8).toFixed(2)}M bm`;

  return {
    id,
    name,
    abbreviation,
    economicProfile: {
      gini: Number((gini * 100).toFixed(2)),
      pib,
      averageSalary: `$${Math.round(15000 + scale * 12000).toLocaleString('es-AR')}`,
      sectors: [
        { name: 'Servicios', value: Math.round(35 + scale * 10), color: '#3b82f6' },
        { name: 'Industria', value: Math.round(25 - scale * 5), color: '#ef4444' },
        { name: 'Agro', value: Math.round(20 + scale * 10), color: '#10b981' },
        { name: 'Comercio', value: Math.round(20 - scale * 5), color: '#f59e0b' }
      ]
    },
    socialEmployment: {
      pobreza,
      desempleo,
      informalEmployment,
      youthInformality
    },
    incomeStructure: {
      minimumSalary: [
        { label: '2020', value: Math.round(1200 + scale * 400) },
        { label: '2021', value: Math.round(1500 + scale * 500) },
        { label: '2022', value: Math.round(2000 + scale * 600) }
      ],
      genderGap: [
        { label: 'Mujeres', value: Math.round(350 + scale * 100) },
        { label: 'Varones', value: Math.round(480 + scale * 120) }
      ]
    },
    connectivity: {
      internetAccess: [
        { label: '2020', value: Math.round(60 + scale * 25) },
        { label: '2021', value: Math.round(68 + scale * 22) },
        { label: '2022', value: Math.round(75 + scale * 20) }
      ],
      mobileLines: [
        { label: '2020', value: Math.round(100 + scale * 50) },
        { label: '2021', value: Math.round(110 + scale * 55) },
        { label: '2022', value: Math.round(120 + scale * 60) }
      ]
    },
    budgetSpending: {
      socialSpending: [
        { name: 'Salud', value: Math.round(30 + scale * 10), color: '#10b981' },
        { name: 'Educación', value: Math.round(45 - scale * 5), color: '#f59e0b' },
        { name: 'Seguridad', value: Math.round(25 - scale * 5), color: '#ef4444' }
      ],
      educationInvestment: [
        { label: '2018', value: Math.round(400 + scale * 150) },
        { label: '2020', value: Math.round(480 + scale * 180) },
        { label: '2021', value: Math.round(520 + scale * 200) },
        { label: '2022', value: Math.round(610 + scale * 240) }
      ]
    },
    mobilityServices: {
      roadNetwork: `${Math.round(4 + scale * 10)} mil km`,
      waterAccess: Number((65 + scale * 25).toFixed(1)),
      publicTransportLines: Math.round(120 + scale * 300)
    },
    municipalities: [
      { id: 'm1', name: 'Región Norte', value: pobreza - 5, percentage: 12 },
      { id: 'm2', name: 'Región Sur', value: pobreza + 6, percentage: 15 },
      { id: 'm3', name: 'Región Este', value: pobreza - 2, percentage: 8 },
      { id: 'm4', name: 'Región Oeste', value: pobreza + 1, percentage: 11 },
      { id: 'm5', name: 'Región Centro', value: pobreza - 4, percentage: 9 }
    ]
  };
};

export const mockProvincesData: Record<string, ProvinceData> = {
  // 1. Buenos Aires
  'AR-B': {
    id: 'AR-B',
    name: 'Buenos Aires',
    abbreviation: 'BS AS',
    economicProfile: {
      gini: 63.61,
      pib: '$18.65M bm',
      averageSalary: '$24.370',
      sectors: [
        { name: 'Servicios', value: 45, color: '#3b82f6' },
        { name: 'Industria', value: 30, color: '#ef4444' },
        { name: 'Comercio', value: 15, color: '#f59e0b' },
        { name: 'Agro', value: 10, color: '#10b981' }
      ]
    },
    socialEmployment: {
      pobreza: 20.0,
      desempleo: 13.9,
      informalEmployment: 47.0,
      youthInformality: 17.0
    },
    incomeStructure: {
      minimumSalary: [
        { label: '2020', value: 1500 },
        { label: '2021', value: 1580 },
        { label: '2022', value: 1620 }
      ],
      genderGap: [
        { label: 'Brecha', value: 400 },
        { label: 'Género', value: 620 }
      ]
    },
    connectivity: {
      internetAccess: [
        { label: '2020', value: 85 },
        { label: '2021', value: 88 },
        { label: '2022', value: 92 }
      ],
      mobileLines: [
        { label: '2020', value: 80 },
        { label: '2021', value: 160 },
        { label: '2022', value: 140 }
      ]
    },
    budgetSpending: {
      socialSpending: [
        { name: 'Salud', value: 35, color: '#10b981' },
        { name: 'Educación', value: 40, color: '#f59e0b' },
        { name: 'Seguridad', value: 25, color: '#ef4444' }
      ],
      educationInvestment: [
        { label: '2018', value: 380 },
        { label: '2020', value: 450 },
        { label: '2021', value: 520 },
        { label: '2022', value: 720 }
      ]
    },
    mobilityServices: {
      roadNetwork: '18 mil',
      waterAccess: 42.8,
      publicTransportLines: 593
    },
    municipalities: [
      { id: 'ba1', name: 'La Matanza', value: 28.5, percentage: 32 },
      { id: 'ba2', name: 'General Pueyrredón', value: 18.2, percentage: 22 },
      { id: 'ba3', name: 'La Plata', value: 15.4, percentage: 18 },
      { id: 'ba4', name: 'Bahía Blanca', value: 12.1, percentage: 15 },
      { id: 'ba5', name: 'Tigre', value: 16.5, percentage: 19 },
      { id: 'ba6', name: 'Lomas de Zamora', value: 24.3, percentage: 26 },
      { id: 'ba7', name: 'Quilmes', value: 23.1, percentage: 25 },
      { id: 'ba8', name: 'Pilar', value: 19.8, percentage: 21 },
      { id: 'ba9', name: 'Mar del Plata', value: 18.9, percentage: 23 },
      { id: 'ba10', name: 'Vicente López', value: 7.2, percentage: 8 }
    ]
  },

  // 2. Córdoba
  'AR-X': {
    id: 'AR-X',
    name: 'Córdoba',
    abbreviation: 'CDB',
    economicProfile: {
      gini: 42.15,
      pib: '$14.12M bm',
      averageSalary: '$21.850',
      sectors: [
        { name: 'Agro', value: 35, color: '#10b981' },
        { name: 'Servicios', value: 35, color: '#3b82f6' },
        { name: 'Industria', value: 20, color: '#ef4444' },
        { name: 'Comercio', value: 10, color: '#f59e0b' }
      ]
    },
    socialEmployment: {
      pobreza: 35.2,
      desempleo: 10.4,
      informalEmployment: 41.2,
      youthInformality: 22.5
    },
    incomeStructure: {
      minimumSalary: [
        { label: '2020', value: 1350 },
        { label: '2021', value: 1420 },
        { label: '2022', value: 1510 }
      ],
      genderGap: [
        { label: 'Brecha', value: 360 },
        { label: 'Género', value: 510 }
      ]
    },
    connectivity: {
      internetAccess: [
        { label: '2020', value: 78 },
        { label: '2021', value: 81 },
        { label: '2022', value: 86 }
      ],
      mobileLines: [
        { label: '2020', value: 90 },
        { label: '2021', value: 130 },
        { label: '2022', value: 125 }
      ]
    },
    budgetSpending: {
      socialSpending: [
        { name: 'Salud', value: 28, color: '#10b981' },
        { name: 'Educación', value: 48, color: '#f59e0b' },
        { name: 'Seguridad', value: 24, color: '#ef4444' }
      ],
      educationInvestment: [
        { label: '2018', value: 320 },
        { label: '2020', value: 390 },
        { label: '2021', value: 440 },
        { label: '2022', value: 580 }
      ]
    },
    mobilityServices: {
      roadNetwork: '14 mil',
      waterAccess: 68.5,
      publicTransportLines: 312
    },
    municipalities: [
      { id: 'cb1', name: 'Capital', value: 33.1, percentage: 35 },
      { id: 'cb2', name: 'Río Cuarto', value: 29.5, percentage: 31 },
      { id: 'cb3', name: 'Villa María', value: 25.2, percentage: 27 },
      { id: 'cb4', name: 'Carlos Paz', value: 22.4, percentage: 24 },
      { id: 'cb5', name: 'San Francisco', value: 26.8, percentage: 29 }
    ]
  },

  // 3. Misiones
  'AR-N': {
    id: 'AR-N',
    name: 'Misiones',
    abbreviation: 'MIS',
    economicProfile: {
      gini: 46.8,
      pib: '$6.21M bm',
      averageSalary: '$17.150',
      sectors: [
        { name: 'Agro', value: 45, color: '#10b981' },
        { name: 'Turismo', value: 25, color: '#ec4899' },
        { name: 'Servicios', value: 20, color: '#3b82f6' },
        { name: 'Industria', value: 10, color: '#ef4444' }
      ]
    },
    socialEmployment: {
      pobreza: 44.1,
      desempleo: 6.8,
      informalEmployment: 54.3,
      youthInformality: 34.1
    },
    incomeStructure: {
      minimumSalary: [
        { label: '2020', value: 1100 },
        { label: '2021', value: 1180 },
        { label: '2022', value: 1250 }
      ],
      genderGap: [
        { label: 'Brecha', value: 290 },
        { label: 'Género', value: 420 }
      ]
    },
    connectivity: {
      internetAccess: [
        { label: '2020', value: 58 },
        { label: '2021', value: 64 },
        { label: '2022', value: 71 }
      ],
      mobileLines: [
        { label: '2020', value: 110 },
        { label: '2021', value: 120 },
        { label: '2022', value: 135 }
      ]
    },
    budgetSpending: {
      socialSpending: [
        { name: 'Salud', value: 30, color: '#10b981' },
        { name: 'Educación', value: 42, color: '#f59e0b' },
        { name: 'Seguridad', value: 28, color: '#ef4444' }
      ],
      educationInvestment: [
        { label: '2018', value: 210 },
        { label: '2020', value: 260 },
        { label: '2021', value: 310 },
        { label: '2022', value: 420 }
      ]
    },
    mobilityServices: {
      roadNetwork: '6.5 mil',
      waterAccess: 74.2,
      publicTransportLines: 154
    },
    municipalities: [
      { id: 'ms1', name: 'Posadas', value: 38.4, percentage: 41 },
      { id: 'ms2', name: 'Oberá', value: 45.1, percentage: 48 },
      { id: 'ms3', name: 'Eldorado', value: 46.8, percentage: 50 },
      { id: 'ms4', name: 'Puerto Iguazú', value: 42.2, percentage: 45 },
      { id: 'ms5', name: 'Apóstoles', value: 48.0, percentage: 51 }
    ]
  }
};

// Populate the remaining 21 provinces dynamically so clicking any of them works perfectly!
provincesList.forEach((prov) => {
  if (!mockProvincesData[prov.id]) {
    mockProvincesData[prov.id] = createBaselineProvince(prov.id, prov.name, prov.abbreviation);
  }
});
