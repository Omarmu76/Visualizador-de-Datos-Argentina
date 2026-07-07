/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react'; // React base
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'; // Enrutador React Router
import Header from './components/Header'; // Encabezado
import Sidebar from './components/Sidebar'; // Barra de acciones
import InteractiveMap from './components/InteractiveMap'; // Mapa SVG interactivo
import DataPanel from './components/DataPanel'; // Panel de métricas públicas
import WorkspaceHub from './components/WorkspaceHub'; // Centro de datos provincial
import MapCalibrationPanel from './components/MapCalibrationPanel'; // Calibrador de nodos
import ProtectedRoute from './components/ProtectedRoute'; // Envoltura de seguridad
import PropertyEditor, { EditableTerritory } from './components/PropertyEditor'; // Inspector Figma
import { mockProvincesData } from './data/mockData'; // Datos iniciales de Argentina
import { MetricType, ProvinceData } from './types'; // Tipos de TypeScript

const defaultWorldMapData: ProvinceData = { // Indicadores mundiales por defecto
  id: 'WORLD_MAP',
  name: 'Mapa Mundial',
  abbreviation: 'MUNDO',
  economicProfile: {
    gini: 38.5,
    pib: 'USD 96T',
    averageSalary: 'USD 1,200',
    sectors: [
      { name: 'Servicios', value: 65, color: '#10b981' },
      { name: 'Industria', value: 25, color: '#3b82f6' },
      { name: 'Agro', value: 10, color: '#f59e0b' }
    ]
  },
  socialEmployment: { pobreza: 21.5, desempleo: 6.2, informalEmployment: 35.0, youthInformality: 48.0 },
  incomeStructure: {
    minimumSalary: [{ label: 'Promedio', value: 850 }, { label: 'Mínimo', value: 350 }],
    genderGap: [{ label: 'Hombres', value: 100 }, { label: 'Mujeres', value: 82 }]
  },
  connectivity: {
    internetAccess: [{ label: 'Fijo', value: 68 }, { label: 'Móvil', value: 85 }, { label: 'Global', value: 66 }],
    mobileLines: [{ label: '4G', value: 75 }, { label: '5G', value: 25 }]
  },
  budgetSpending: {
    socialSpending: [
      { name: 'Salud', value: 40, color: '#10b981' },
      { name: 'Educación', value: 45, color: '#3b82f6' },
      { name: 'Otros', value: 15, color: '#f59e0b' }
    ],
    educationInvestment: [{ label: 'Promedio', value: 4.5 }]
  },
  mobilityServices: { roadNetwork: 'Red Vial Global', waterAccess: 88, publicTransportLines: 1250 },
  municipalities: [
    { id: 'world_ar', name: 'Argentina (Mundo)', value: 42, percentage: 15, d: 'M 350,380 c -10,-10 -5,-25 -12,-35 c -15,-20 15,-40 25,-10 c 5,15 -3,35 -13,45 z' },
    { id: 'world_br', name: 'Brasil', value: 28, percentage: 32, d: 'M 400,340 c 15,-15 40,-5 50,15 c -10,25 -35,20 -50,-15 z' },
    { id: 'world_us', name: 'Estados Unidos', value: 11, percentage: 38, d: 'M 250,220 c 25,-15 50,5 60,25 c -20,20 -45,10 -60,-25 z' },
    { id: 'world_eu', name: 'Unión Europea', value: 20, percentage: 15, d: 'M 580,210 c 20,0 20,30 0,30 c -20,0 -20,-30 0,-30 z' }
  ]
};

const defaultContinentMapData: ProvinceData = { // Indicadores regionales por defecto
  id: 'CONTINENT_MAP',
  name: 'América del Sur',
  abbreviation: 'S.AMERICA',
  economicProfile: {
    gini: 46.2,
    pib: 'USD 3.8T',
    averageSalary: 'USD 450',
    sectors: [
      { name: 'Servicios', value: 55, color: '#10b981' },
      { name: 'Industria', value: 20, color: '#3b82f6' },
      { name: 'Agro / Minería', value: 25, color: '#f59e0b' }
    ]
  },
  socialEmployment: { pobreza: 31.8, desempleo: 8.1, informalEmployment: 52.0, youthInformality: 65.0 },
  incomeStructure: {
    minimumSalary: [{ label: 'Promedio', value: 380 }, { label: 'Mínimo', value: 220 }],
    genderGap: [{ label: 'Hombres', value: 100 }, { label: 'Mujeres', value: 76 }]
  },
  connectivity: {
    internetAccess: [{ label: 'Fijo', value: 52 }, { label: 'Móvil', value: 78 }, { label: 'Global', value: 54 }],
    mobileLines: [{ label: '4G', value: 85 }, { label: '5G', value: 15 }]
  },
  budgetSpending: {
    socialSpending: [
      { name: 'Salud', value: 35, color: '#10b981' },
      { name: 'Educación', value: 40, color: '#3b82f6' },
      { name: 'Otros', value: 25, color: '#f59e0b' }
    ],
    educationInvestment: [{ label: 'Promedio', value: 3.8 }]
  },
  mobilityServices: { roadNetwork: 'Vía Panamericana', waterAccess: 76, publicTransportLines: 480 },
  municipalities: [
    { id: 'cont_ar', name: 'Argentina (S.A.)', value: 42, percentage: 32, d: 'M 350,600 c -10,-20 -20,-40 -25,-60 c 15,-15 35,10 45,30 c -10,15 -15,20 -20,30 z' },
    { id: 'cont_br', name: 'Brasil (S.A.)', value: 28, percentage: 48, d: 'M 450,450 c 25,-20 50,0 60,30 c -20,30 -50,10 -60,-30 z' },
    { id: 'cont_cl', name: 'Chile (S.A.)', value: 10, percentage: 12, d: 'M 320,650 c -5,-30 -10,-60 -15,-90 c 5,5 10,30 15,90 z' },
    { id: 'cont_uy', name: 'Uruguay (S.A.)', value: 9, percentage: 8, d: 'M 400,580 c 5,5 10,5 12,0 c -2,-5 -10,-5 -12,0 z' }
  ]
};

// COMPONENTE CONTENEDOR DE LA APLICACIÓN
export default function App() { // Provee el BrowserRouter en el nivel superior de montaje
  return (
    <BrowserRouter> {/* Envoltura del enrutador de producción */}
      <AppContent /> {/* Ejecuta el cuerpo con el enrutamiento y estado consolidado */}
    </BrowserRouter>
  ); // Fin del retorno de App
} // Fin de App

// COMPONENTE DE CONTENIDO Y ENRUTAMIENTO DINÁMICO
function AppContent() { // Contiene toda la lógica del tablero
  const navigate = useNavigate(); // Navegador programático
  const location = useLocation(); // Ubicación actual del navegador

  // Base de datos de provincias (inicializa de localStorage o usa el mockData base)
  const [provincesData, setProvincesData] = useState<Record<string, ProvinceData>>(() => {
    const saved = localStorage.getItem('argentina_data_custom_provinces'); // Carga desde caché del navegador
    let data = { ...mockProvincesData }; // Clona el diccionario original por seguridad
    if (saved) {
      try {
        data = JSON.parse(saved); // Parsea los datos si el JSON es válido
      } catch (e) {
        console.error("Error al cargar datos guardados de localStorage:", e); // Captura fallos de des-serialización
      }
    }
    
    // Inyectar subdivisión realista de alta definición en las Islas Malvinas (AR-MLV) por defecto si no se ha personalizado
    if (data['AR-MLV'] && (!data['AR-MLV'].municipalities || data['AR-MLV'].municipalities.length === 5)) {
      try {
        const mlvFullD = 'M 597.694 842.519 L 597.430 842.290 L 597.316 841.937 L 596.623 842.319 L 596.447 842.324 L 596.207 842.213 L 595.981 841.871 L 595.768 841.892 L 595.596 841.932 L 595.562 841.850 L 595.655 841.660 L 595.948 841.559 L 596.143 841.371 L 596.104 841.241 L 595.654 841.054 L 595.580 840.709 L 595.471 840.635 L 595.079 841.351 L 595.105 842.076 L 595.015 842.182 L 595.051 842.287 L 595.082 842.575 L 594.959 842.732 L 594.790 843.173 L 595.206 843.521 L 595.304 843.730 L 595.248 844.038 L 595.002 844.340 L 594.722 844.452 L 594.013 844.325 L 593.395 844.348 L 592.700 844.244 L 592.032 844.270 L 591.498 844.369 L 590.750 844.597 L 590.086 844.913 L 589.963 844.706 L 590.145 844.387 L 590.598 843.993 L 591.189 843.707 L 591.743 843.194 L 591.892 842.926 L 591.890 842.781 L 591.802 842.789 L 591.446 843.138 L 590.934 843.445 L 591.080 843.015 L 590.924 843.102 L 590.244 843.626 L 590.095 843.627 L 590.098 843.156 L 589.996 843.188 L 589.847 843.336 L 589.512 843.525 L 589.284 843.764 L 588.825 843.855 L 588.687 844.231 L 588.380 844.454 L 588.072 844.288 L 587.618 844.306 L 588.110 844.903 L 588.218 845.220 L 588.339 845.039 L 588.547 845.093 L 588.679 845.759 L 588.662 846.209 L 588.694 846.279 L 588.862 846.190 L 588.861 846.421 L 588.741 846.856 L 588.742 847.232 L 588.723 847.294 L 588.625 847.945 L 588.774 848.283 L 588.850 848.288 L 588.975 848.143 L 588.979 848.058 L 589.112 847.258 L 589.140 846.916 L 589.276 846.019 L 589.337 845.262 L 589.469 844.946 L 589.672 844.952 L 589.750 845.090 L 589.499 845.489 L 589.527 846.250 L 589.387 847.220 L 589.331 848.037 L 589.313 848.100 L 589.171 848.816 L 588.987 849.002 L 588.753 849.072 L 588.433 849.538 L 588.233 850.054 L 587.934 850.360 L 587.454 851.119 L 587.026 851.655 L 586.967 852.073 L 586.645 852.272 L 586.496 852.310 L 586.109 852.491 L 585.967 852.467 L 585.819 852.142 L 585.658 852.302 L 585.528 852.277 L 585.304 852.067 L 585.335 851.749 L 585.236 851.274 L 585.024 851.063 L 584.850 851.224 L 585.058 851.654 L 585.110 851.915 L 585.007 852.276 L 585.132 852.374 L 585.338 852.403 L 585.497 852.595 L 585.669 852.664 L 585.810 852.930 L 585.611 853.214 L 585.110 853.285 L 584.840 853.127 L 584.672 852.973 L 584.367 853.098 L 584.206 852.894 L 584.388 852.430 L 584.376 851.934 L 584.276 851.701 L 584.188 851.587 L 583.932 851.562 L 583.700 851.656 L 583.627 851.687 L 583.142 851.912 L 582.781 852.102 L 582.431 852.413 L 582.382 852.562 L 582.539 852.730 L 582.791 852.841 L 583.062 852.877 L 583.053 853.047 L 582.861 853.282 L 582.615 853.365 L 582.198 853.257 L 581.959 852.904 L 582.029 852.206 L 581.973 852.030 L 581.763 852.206 L 581.567 852.660 L 580.760 851.957 L 580.030 851.125 L 579.782 850.796 L 579.723 850.329 L 579.769 850.022 L 579.749 849.951 L 579.603 850.013 L 579.403 850.430 L 579.090 850.604 L 578.708 850.589 L 578.630 850.693 L 578.329 850.732 L 578.306 850.879 L 578.341 850.985 L 578.527 851.065 L 578.871 851.083 L 579.007 851.040 Z M 599.555 847.372 L 599.642 847.167 L 599.809 847.001 L 599.866 846.764 L 599.771 846.313 L 599.859 846.120 L 600.096 846.007 L 600.317 846.163 L 600.426 846.332 L 600.790 846.228 L 600.838 846.405 L 600.641 846.732 L 600.502 847.211 L 600.550 847.290 L 600.615 847.306 L 600.774 847.275 L 600.977 846.996 L 601.124 847.161 L 601.059 847.339 L 600.929 847.500 L 600.926 847.670 L 600.777 847.785 L 600.839 847.875 L 601.337 847.840 L 601.709 847.698 L 601.775 847.727 L 601.798 847.809 L 601.774 848.104 L 601.873 848.287 L 601.942 848.339 L 602.051 848.010 L 602.255 847.937 L 602.478 847.910 L 602.537 847.782 L 602.458 847.657 L 602.097 847.397 L 602.253 847.244 L 602.620 847.164 L 602.685 846.889 L 602.638 846.627 L 602.720 846.581 L 603.144 846.846 L 603.118 847.031 L 603.422 847.530 L 603.766 847.184 L 603.921 847.409 L 604.248 847.406 L 604.341 847.540 L 604.267 847.938 L 604.484 847.961 L 604.629 847.919 L 604.744 848.124 L 604.648 848.354 L 604.490 848.398 L 604.306 848.335 L 604.323 848.564 L 604.429 848.794 L 604.640 848.963 L 604.646 849.108 L 604.564 849.252 L 604.633 849.389 L 604.597 849.503 L 604.135 849.340 L 603.963 849.373 L 603.823 849.548 L 603.738 849.667 L 603.459 849.944 L 603.419 850.119 L 603.555 850.103 L 603.888 849.856 L 604.116 849.768 L 604.359 849.799 L 604.887 850.562 L 604.811 850.754 L 604.728 850.885 L 604.884 839.024 L 604.843 851.479 L 604.924 852.004 L 604.889 852.215 L 604.978 852.314 L 605.140 852.306 L 605.279 852.022 L 605.300 851.509 L 605.182 851.086 L 605.254 850.968 L 605.444 851.066 L 605.694 851.534 L 605.640 851.796 L 605.974 852.132 L 606.199 852.786 L 606.253 852.816 L 606.375 852.497 L 606.604 852.518 L 606.635 852.369 L 606.459 851.989 L 606.476 851.926 L 606.682 851.962 L 607.318 852.103 L 607.458 852.111 L 607.530 851.992 L 607.352 851.880 L 606.604 851.753 L 606.514 851.642 L 606.222 851.410 L 606.572 851.318 L 606.273 851.245 L 606.237 851.067 L 606.457 850.919 L 606.126 850.801 L 605.849 850.798 L 605.655 850.664 L 605.629 850.664 Z M 600.947 802.992 L 600.730 803.050 L 600.391 802.792 L 600.526 802.537 L 600.703 802.447 L 600.834 802.506 L 600.953 802.688 L 601.274 802.899 L 601.374 803.023 L 601.326 803.161 Z';
        const parts = mlvFullD.split(/(?=M)/).map(p => p.trim()).filter(p => p.length > 0);
        
        const malvinasPobreza = data['AR-MLV'].socialEmployment?.pobreza || 32.0;
        data['AR-MLV'].municipalities = [
          { id: 'mlv_west', name: 'Gran Malvina (Isla Oeste)', value: Math.round(malvinasPobreza - 3), percentage: 38, d: parts[0] },
          { id: 'mlv_east', name: 'Isla Soledad (Isla Este)', value: Math.round(malvinasPobreza + 4), percentage: 55, d: parts[1] },
          { id: 'mlv_islets', name: 'Pequeños Islotes y Arrecifes', value: Math.round(malvinasPobreza - 12), percentage: 7, d: parts[2] }
        ];
        data['AR-MLV'].mapTransform = { scale: 2.2, panX: -1218, panY: -1715 };
      } catch (err) {
        console.error("Error al inyectar Islas Malvinas por defecto:", err);
      }
    }
    return data;
  });

  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('AR-B'); // Provincia por defecto
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('pobreza'); // Métrica activa
  const [activeMapLevel, setActiveMapLevel] = useState<string>('country'); // Nivel inicial

  // Niveles jerárquicos
  const [mapLevels, setMapLevels] = useState<{ id: string; name: string }[]>(() => {
    const saved = localStorage.getItem('argentina_map_levels');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { id: 'world', name: 'Mundo' },
      { id: 'continent', name: 'Continente' },
      { id: 'country', name: 'País (Nación)' },
      { id: 'province', name: 'Provincia' },
      { id: 'city', name: 'Ciudad (Municipio)' },
      { id: 'neighborhood', name: 'Barrios' }
    ];
  });

  const handleUpdateMapLevels = (newLevels: { id: string; name: string }[]) => {
    setMapLevels(newLevels);
    localStorage.setItem('argentina_map_levels', JSON.stringify(newLevels));
  };

  // Subdivisión municipal o barrial activa seleccionada
  const [selectedSubdivisionId, setSelectedSubdivisionId] = useState<string | null>(() => {
    return localStorage.getItem('argentina_selected_subdivision_id') || null;
  });

  const handleSelectSubdivision = (id: string | null) => {
    setSelectedSubdivisionId(id);
    if (id) {
      localStorage.setItem('argentina_selected_subdivision_id', id);
    } else {
      localStorage.removeItem('argentina_selected_subdivision_id');
    }
  };

  const activeProvinceId = 
    activeMapLevel === 'world' ? 'WORLD_MAP' :
    activeMapLevel === 'continent' ? 'CONTINENT_MAP' :
    selectedProvinceId;

  // Carga de provincia activa
  const selectedProvince = 
    activeProvinceId === 'WORLD_MAP' ? (provincesData['WORLD_MAP'] || defaultWorldMapData) :
    activeProvinceId === 'CONTINENT_MAP' ? (provincesData['CONTINENT_MAP'] || defaultContinentMapData) :
    (provincesData[selectedProvinceId] || mockProvincesData[selectedProvinceId] || mockProvincesData['AR-B']);

  const handleMapLevelChange = (level: string) => {
    setActiveMapLevel(level);
  };

  // Guardado en caliente
  const handleUpdateProvince = (updatedProvince: ProvinceData) => {
    setProvincesData(prev => {
      const next = { ...prev, [updatedProvince.id]: updatedProvince };
      localStorage.setItem('argentina_data_custom_provinces', JSON.stringify(next));
      return next;
    });
  };

  const handleLoadAllProvinces = (loaded: Record<string, ProvinceData>) => {
    setProvincesData(loaded);
    localStorage.setItem('argentina_data_custom_provinces', JSON.stringify(loaded));
  };

  // CONVERSIÓN DE LA PARCELA SELECCIONADA PARA EL PROPERTYEDITOR
  const selectedSubdivision = selectedProvince.municipalities?.find(m => m.id === selectedSubdivisionId);
  const editableTerritory: EditableTerritory | null = selectedSubdivision ? {
    id: selectedSubdivision.id,
    name: selectedSubdivision.name,
    level: activeMapLevel === 'country' ? 'province' : activeMapLevel === 'world' ? 'country' : 'city',
    svgPath: selectedSubdivision.d,
    visualStyles: selectedSubdivision.visualStyles || {
      fillColor: selectedSubdivision.color || '#10b981',
      strokeColor: '#0f172a',
      strokeWidth: 1.5,
      fontFamily: 'Inter',
      fontSize: 10
    },
    customData: selectedSubdivision.customData || {
      valor_activo: selectedSubdivision.value,
      porcentaje: selectedSubdivision.percentage
    }
  } : null;

  // GUARDAR ESTILOS DESDE EL PROPERTYEDITOR
  const handleSaveTerritoryStyles = (updated: EditableTerritory) => {
    if (!selectedSubdivisionId) return;

    const updatedMunicipalities = selectedProvince.municipalities.map(m => {
      if (m.id === selectedSubdivisionId) {
        return {
          ...m,
          name: updated.name,
          color: updated.visualStyles.fillColor, // Sincroniza color plano de fondo
          visualStyles: updated.visualStyles,
          customData: updated.customData,
          value: updated.customData.valor_activo !== undefined ? Number(updated.customData.valor_activo) : m.value,
          percentage: updated.customData.porcentaje !== undefined ? Number(updated.customData.porcentaje) : m.percentage
        };
      }
      return m;
    });

    const updatedProvince: ProvinceData = {
      ...selectedProvince,
      municipalities: updatedMunicipalities
    };

    handleUpdateProvince(updatedProvince);
  };

  return (
    <div id="dashboard-app" className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      {/* Encabezado */}
      <Header />

      {/* Cuerpo en rejilla fluida */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Panel Izquierdo: Mapa SVG e Interacciones */}
        <main className="w-full lg:w-[42%] p-4 xl:p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col space-y-4">
          <InteractiveMap
            selectedProvince={selectedProvince}
            onSelectProvince={(prov) => {
              setSelectedProvinceId(prov.id);
              localStorage.setItem('argentina_selected_province_id', prov.id);
            }}
            onUpdateProvince={handleUpdateProvince}
            selectedMetric={selectedMetric}
            onChangeMetric={setSelectedMetric}
            activeMapLevel={activeMapLevel}
            setActiveMapLevel={handleMapLevelChange}
            mapLevels={mapLevels}
            selectedSubdivisionId={selectedSubdivisionId}
            setSelectedSubdivisionId={handleSelectSubdivision}
          />
        </main>

        {/* Panel Derecho con Rutas Dinámicas */}
        <section className="flex-1 p-4 xl:p-6 overflow-y-auto bg-slate-950 flex flex-col space-y-5">
          {/* Barra superior de pestañas ligada al enrutamiento */}
          <div className="flex border-b border-slate-800 space-x-2">
            <button
              onClick={() => navigate('/')} // Navegación a inicio público
              className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
                location.pathname === '/'
                  ? 'border-emerald-500 text-emerald-400 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              📈 Estadísticas Públicas
            </button>
            <button
              onClick={() => navigate('/admin')} // Navegación a administración general
              className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
                location.pathname === '/admin'
                  ? 'border-emerald-500 text-emerald-400 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              💼 Workspace Administrativo
            </button>
            <button
              onClick={() => navigate('/admin/calibracion')} // Navegación a calibrador
              className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
                location.pathname === '/admin/calibracion'
                  ? 'border-emerald-500 text-emerald-400 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              🛠️ Calibrador de Mapas (Admin)
            </button>
          </div>

          {/* Rutas de la Aplicación */}
          <Routes>
            {/* Ruta Principal: Panel Estadístico Público */}
            <Route path="/" element={
              <div className="space-y-6">
                <DataPanel 
                  province={selectedProvince} 
                  selectedSubdivisionId={selectedSubdivisionId}
                  onSelectSubdivision={handleSelectSubdivision}
                />
                <div className="border-t border-slate-900 pt-6">
                  <WorkspaceHub
                    selectedProvince={selectedProvince}
                    onUpdateProvince={handleUpdateProvince}
                    allProvinces={provincesData}
                    onLoadAllProvinces={handleLoadAllProvinces}
                  />
                </div>
              </div>
            } />

            {/* Ruta Protegida: Workspace de Administración + PropertyEditor */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <div className="space-y-6">
                  {editableTerritory && (
                    <PropertyEditor 
                      territory={editableTerritory}
                      onSave={handleSaveTerritoryStyles}
                      onClose={() => handleSelectSubdivision(null)}
                    />
                  )}
                  
                  <div className="bg-slate-900/40 p-4 border border-slate-800 rounded-xl">
                    <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span>Workspace Administrativo</span>
                    </h2>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Haz clic sobre cualquier área en el mapa interactivo para desplegar el **Inspector Visual**. Permite calibrar rellenos, contornos, fuentes tipográficas y metadatos flexibles en caliente.
                    </p>
                  </div>

                  <WorkspaceHub
                    selectedProvince={selectedProvince}
                    onUpdateProvince={handleUpdateProvince}
                    allProvinces={provincesData}
                    onLoadAllProvinces={handleLoadAllProvinces}
                  />
                </div>
              </ProtectedRoute>
            } />

            {/* Ruta Protegida: Calibración y Nodos + PropertyEditor */}
            <Route path="/admin/calibracion" element={
              <ProtectedRoute>
                <div className="space-y-6">
                  {editableTerritory && (
                    <PropertyEditor 
                      territory={editableTerritory}
                      onSave={handleSaveTerritoryStyles}
                      onClose={() => handleSelectSubdivision(null)}
                    />
                  )}
                  
                  <MapCalibrationPanel 
                    selectedProvinceId={activeProvinceId}
                    onSelectProvinceId={(id) => {
                      if (id === 'WORLD_MAP') {
                        handleMapLevelChange('world');
                      } else if (id === 'CONTINENT_MAP') {
                        handleMapLevelChange('continent');
                      } else {
                        setSelectedProvinceId(id);
                        localStorage.setItem('argentina_selected_province_id', id);
                      }
                    }}
                    selectedProvince={selectedProvince}
                    onUpdateProvince={handleUpdateProvince}
                    mapLevels={mapLevels}
                    onUpdateMapLevels={handleUpdateMapLevels}
                  />
                </div>
              </ProtectedRoute>
            } />

            {/* Redirección */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </section>

        {/* Acciones rápidas */}
        <Sidebar />
      </div>

      {/* Sello de Marca */}
      <footer className="bg-slate-950 border-t border-slate-900 py-3.5 px-6 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest">
        <span>© 2026 Plataforma de Indicadores Federales - Catastro Jerárquico</span>
        <div className="flex items-center space-x-4 mt-1 sm:mt-0">
          <span>Actualización: Tiempo Real (UTC)</span>
          <span className="flex items-center">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
            Sistemas Conectados
          </span>
        </div>
      </footer>
    </div>
  );
}

