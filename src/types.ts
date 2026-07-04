/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MetricType = 'pobreza' | 'desempleo' | 'gini' | 'conectividad';

export interface SectorDistribution {
  name: string;
  value: number;
  color: string;
}

export interface BarChartData {
  label: string;
  value: number;
}

export interface MunicipalityData {
  id: string;
  name: string;
  value: number; // Value of the currently active metric
  percentage: number;
  d?: string;    // Ruta SVG personalizada para renderizar la subdivisión
  paused?: boolean; // Estado de pausa/desactivación de la subdivisión
  color?: string;   // Color personalizado pintado desde la paleta interactiva
}

export interface ProvinceData {
  id: string; // ISO code, e.g. "AR-B", "AR-X"
  name: string;
  abbreviation: string;
  economicProfile: {
    gini: number;
    pib: string;
    averageSalary: string;
    sectors: SectorDistribution[];
  };
  socialEmployment: {
    pobreza: number;
    desempleo: number;
    informalEmployment: number;
    youthInformality: number;
  };
  incomeStructure: {
    minimumSalary: BarChartData[];
    genderGap: BarChartData[];
  };
  connectivity: {
    internetAccess: BarChartData[];
    mobileLines: BarChartData[];
  };
  budgetSpending: {
    socialSpending: SectorDistribution[];
    educationInvestment: BarChartData[];
  };
  mobilityServices: {
    roadNetwork: string;
    waterAccess: number;
    publicTransportLines: number;
  };
  municipalities: MunicipalityData[];
  mapTransform?: { scale: number; panX: number; panY: number };
}
