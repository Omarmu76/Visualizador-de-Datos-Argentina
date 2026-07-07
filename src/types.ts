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
  id: string; // Identificador único de la subdivisión (ej. 'AR-B-01')
  name: string; // Nombre de la subdivisión territorial o municipio (ej. 'La Matanza')
  value: number; // Valor asociado a la métrica actualmente activa en el visor
  percentage: number; // Porcentaje de representación de esta subdivisión a nivel provincial
  d?: string;    // Ruta SVG personalizada para renderizar la forma geométrica (polígono) del territorio
  paused?: boolean; // Estado booleano para indicar si la subdivisión está inactiva o en pausa
  color?: string;   // Color personalizado pintado directamente desde la paleta interactiva de la aplicación
  visualStyles?: { // Objeto opcional para estilos de diseño avanzados compatibles con nuestro editor tipo Figma
    fillColor: string; // Color hexadecimal de relleno del polígono catastral
    strokeColor: string; // Color hexadecimal del contorno o límite geográfico
    strokeWidth: number; // Grosor del contorno físico en píxeles
    fontFamily: string; // Fuente de texto asignada para etiquetas informativas
    fontSize: number; // Tamaño físico del texto en píxeles
  }; // Fin de la declaración de estilos visuales
  customData?: Record<string, any>; // Estructura JSON flexible para almacenar metadatos catastrales e indicadores ilimitados (clave/valor)
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
