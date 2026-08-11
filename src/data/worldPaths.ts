/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Importación de la interfaz de tipo MapPathNode para garantizar tipado estricto de TypeScript
import { MapPathNode } from '../types';

// Arreglo completo con la lista estandarizada de todos los países del mundo según normas ISO Alpha-3
export const worldPaths: MapPathNode[] = [
  // ============================================================================
  // AMÉRICA DEL SUR (AMERICA-SUD)
  // ============================================================================
  { id: 'ARG', name: 'Argentina', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // República Argentina
  { id: 'BOL', name: 'Bolivia', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // Estado Plurinacional de Bolivia
  { id: 'BRA', name: 'Brasil', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // República Federativa del Brasil
  { id: 'CHL', name: 'Chile', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // República de Chile
  { id: 'COL', name: 'Colombia', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // República de Colombia
  { id: 'ECU', name: 'Ecuador', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // República del Ecuador
  { id: 'GUY', name: 'Guyana', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // República Cooperativa de Guyana
  { id: 'PRY', name: 'Paraguay', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // República del Paraguay
  { id: 'PER', name: 'Perú', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // República del Perú
  { id: 'SUR', name: 'Surinam', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // República de Surinam
  { id: 'URY', name: 'Uruguay', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // República Oriental del Uruguay
  { id: 'VEN', name: 'Venezuela', parentId: 'AMERICA-SUD', category: 'País', d: '' }, // República Bolivariana de Venezuela

  // ============================================================================
  // AMÉRICA DEL NORTE Y CENTRAL (AMERICA-NORTE)
  // ============================================================================
  { id: 'CAN', name: 'Canadá', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // Canadá
  { id: 'USA', name: 'Estados Unidos', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // Estados Unidos de América
  { id: 'MEX', name: 'México', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // Estados Unidos Mexicanos
  { id: 'BLZ', name: 'Belice', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // Belice
  { id: 'CRI', name: 'Costa Rica', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // República de Costa Rica
  { id: 'SLV', name: 'El Salvador', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // República de El Salvador
  { id: 'GTM', name: 'Guatemala', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // República de Guatemala
  { id: 'HND', name: 'Honduras', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // República de Honduras
  { id: 'NIC', name: 'Nicaragua', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // República de Nicaragua
  { id: 'PAN', name: 'Panamá', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // República de Panamá
  { id: 'CUB', name: 'Cuba', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // República de Cuba
  { id: 'DOM', name: 'República Dominicana', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // República Dominicana
  { id: 'HTI', name: 'Haití', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // República de Haití
  { id: 'JAM', name: 'Jamaica', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // Jamaica
  { id: 'BHS', name: 'Bahamas', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // Mancomunidad de las Bahamas
  { id: 'BRB', name: 'Barbados', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // Barbados
  { id: 'TTO', name: 'Trinidad y Tobago', parentId: 'AMERICA-NORTE', category: 'País', d: '' }, // República de Trinidad y Tobago

  // ============================================================================
  // EUROPA (EUROPA)
  // ============================================================================
  { id: 'ALB', name: 'Albania', parentId: 'EUROPA', category: 'País', d: '' }, // República de Albania
  { id: 'DEU', name: 'Alemania', parentId: 'EUROPA', category: 'País', d: '' }, // República Federal de Alemania
  { id: 'AND', name: 'Andorra', parentId: 'EUROPA', category: 'País', d: '' }, // Principado de Andorra
  { id: 'AUT', name: 'Austria', parentId: 'EUROPA', category: 'País', d: '' }, // República de Austria
  { id: 'BEL', name: 'Bélgica', parentId: 'EUROPA', category: 'País', d: '' }, // Reino de Bélgica
  { id: 'BLR', name: 'Bielorrusia', parentId: 'EUROPA', category: 'País', d: '' }, // República de Bielorrusia
  { id: 'BIH', name: 'Bosnia y Herzegovina', parentId: 'EUROPA', category: 'País', d: '' }, // Bosnia y Herzegovina
  { id: 'BGR', name: 'Bulgaria', parentId: 'EUROPA', category: 'País', d: '' }, // República de Bulgaria
  { id: 'CYP', name: 'Chipre', parentId: 'EUROPA', category: 'País', d: '' }, // República de Chipre
  { id: 'HRV', name: 'Croacia', parentId: 'EUROPA', category: 'País', d: '' }, // República de Croacia
  { id: 'DNK', name: 'Dinamarca', parentId: 'EUROPA', category: 'País', d: '' }, // Reino de Dinamarca
  { id: 'SVK', name: 'Eslovaquia', parentId: 'EUROPA', category: 'País', d: '' }, // República Eslovaca
  { id: 'SVN', name: 'Eslovenia', parentId: 'EUROPA', category: 'País', d: '' }, // República de Eslovenia
  { id: 'ESP', name: 'España', parentId: 'EUROPA', category: 'País', d: '' }, // Reino de España
  { id: 'EST', name: 'Estonia', parentId: 'EUROPA', category: 'País', d: '' }, // República de Estonia
  { id: 'FIN', name: 'Finlandia', parentId: 'EUROPA', category: 'País', d: '' }, // República de Finlandia
  { id: 'FRA', name: 'Francia', parentId: 'EUROPA', category: 'País', d: '' }, // República Francesa
  { id: 'GRC', name: 'Grecia', parentId: 'EUROPA', category: 'País', d: '' }, // República Helénica
  { id: 'HUN', name: 'Hungría', parentId: 'EUROPA', category: 'País', d: '' }, // Hungría
  { id: 'IRL', name: 'Irlanda', parentId: 'EUROPA', category: 'País', d: '' }, // República de Irlanda
  { id: 'ISL', name: 'Islandia', parentId: 'EUROPA', category: 'País', d: '' }, // Islandia
  { id: 'ITA', name: 'Italia', parentId: 'EUROPA', category: 'País', d: '' }, // República Italiana
  { id: 'LVA', name: 'Letonia', parentId: 'EUROPA', category: 'País', d: '' }, // República de Letonia
  { id: 'LIE', name: 'Liechtenstein', parentId: 'EUROPA', category: 'País', d: '' }, // Principado de Liechtenstein
  { id: 'LTU', name: 'Lituania', parentId: 'EUROPA', category: 'País', d: '' }, // República de Lituania
  { id: 'LUX', name: 'Luxemburgo', parentId: 'EUROPA', category: 'País', d: '' }, // Gran Ducado de Luxemburgo
  { id: 'MKD', name: 'Macedonia del Norte', parentId: 'EUROPA', category: 'País', d: '' }, // República de Macedonia del Norte
  { id: 'MLT', name: 'Malta', parentId: 'EUROPA', category: 'País', d: '' }, // República de Malta
  { id: 'MDA', name: 'Moldavia', parentId: 'EUROPA', category: 'País', d: '' }, // República de Moldavia
  { id: 'MCO', name: 'Mónaco', parentId: 'EUROPA', category: 'País', d: '' }, // Principado de Mónaco
  { id: 'MNE', name: 'Montenegro', parentId: 'EUROPA', category: 'País', d: '' }, // Montenegro
  { id: 'NOR', name: 'Noruega', parentId: 'EUROPA', category: 'País', d: '' }, // Reino de Noruega
  { id: 'NLD', name: 'Países Bajos', parentId: 'EUROPA', category: 'País', d: '' }, // Reino de los Países Bajos
  { id: 'POL', name: 'Polonia', parentId: 'EUROPA', category: 'País', d: '' }, // República de Polonia
  { id: 'PRT', name: 'Portugal', parentId: 'EUROPA', category: 'País', d: '' }, // República Portuguesa
  { id: 'GBR', name: 'Reino Unido', parentId: 'EUROPA', category: 'País', d: '' }, // Reino Unido de Gran Bretaña e Irlanda del Norte
  { id: 'CZE', name: 'República Checa', parentId: 'EUROPA', category: 'País', d: '' }, // República Checa
  { id: 'ROU', name: 'Rumania', parentId: 'EUROPA', category: 'País', d: '' }, // Rumania
  { id: 'RUS', name: 'Rusia', parentId: 'EUROPA', category: 'País', d: '' }, // Federación de Rusia
  { id: 'SMR', name: 'San Marino', parentId: 'EUROPA', category: 'País', d: '' }, // Serenísima República de San Marino
  { id: 'SRB', name: 'Serbia', parentId: 'EUROPA', category: 'País', d: '' }, // República de Serbia
  { id: 'SWE', name: 'Suecia', parentId: 'EUROPA', category: 'País', d: '' }, // Reino de Suecia
  { id: 'CHE', name: 'Suiza', parentId: 'EUROPA', category: 'País', d: '' }, // Confederación Suiza
  { id: 'UKR', name: 'Ucrania', parentId: 'EUROPA', category: 'País', d: '' }, // Ucrania
  { id: 'VAT', name: 'Ciudad del Vaticano', parentId: 'EUROPA', category: 'País', d: '' }, // Estado de la Ciudad del Vaticano

  // ============================================================================
  // ASIA (ASIA)
  // ============================================================================
  { id: 'AFG', name: 'Afganistán', parentId: 'ASIA', category: 'País', d: '' }, // Afganistán
  { id: 'SAU', name: 'Arabia Saudita', parentId: 'ASIA', category: 'País', d: '' }, // Reino de Arabia Saudita
  { id: 'ARM', name: 'Armenia', parentId: 'ASIA', category: 'País', d: '' }, // República de Armenia
  { id: 'AZE', name: 'Azerbaiyán', parentId: 'ASIA', category: 'País', d: '' }, // República de Azerbaiyán
  { id: 'BGD', name: 'Bangladés', parentId: 'ASIA', category: 'País', d: '' }, // República Popular de Bangladés
  { id: 'BHR', name: 'Baréin', parentId: 'ASIA', category: 'País', d: '' }, // Reino de Baréin
  { id: 'MMR', name: 'Birmania / Myanmar', parentId: 'ASIA', category: 'País', d: '' }, // República de la Unión de Myanmar
  { id: 'KHM', name: 'Camboya', parentId: 'ASIA', category: 'País', d: '' }, // Reino de Camboya
  { id: 'QAT', name: 'Catar', parentId: 'ASIA', category: 'País', d: '' }, // Estado de Catar
  { id: 'CHN', name: 'China', parentId: 'ASIA', category: 'País', d: '' }, // República Popular China
  { id: 'PRK', name: 'Corea del Norte', parentId: 'ASIA', category: 'País', d: '' }, // República Popular Democrática de Corea
  { id: 'KOR', name: 'Corea del Sur', parentId: 'ASIA', category: 'País', d: '' }, // República de Corea
  { id: 'ARE', name: 'Emiratos Árabes Unidos', parentId: 'ASIA', category: 'País', d: '' }, // Emiratos Árabes Unidos
  { id: 'PHL', name: 'Filipinas', parentId: 'ASIA', category: 'País', d: '' }, // República de Filipinas
  { id: 'GEO', name: 'Georgia', parentId: 'ASIA', category: 'País', d: '' }, // Georgia
  { id: 'IND', name: 'India', parentId: 'ASIA', category: 'País', d: '' }, // República de la India
  { id: 'IDN', name: 'Indonesia', parentId: 'ASIA', category: 'País', d: '' }, // República de Indonesia
  { id: 'IRQ', name: 'Irak', parentId: 'ASIA', category: 'País', d: '' }, // República de Irak
  { id: 'IRN', name: 'Irán', parentId: 'ASIA', category: 'País', d: '' }, // República Islámica de Irán
  { id: 'ISR', name: 'Israel', parentId: 'ASIA', category: 'País', d: '' }, // Estado de Israel
  { id: 'JPN', name: 'Japón', parentId: 'ASIA', category: 'País', d: '' }, // Japón
  { id: 'JOR', name: 'Jordania', parentId: 'ASIA', category: 'País', d: '' }, // Reino Hachemita de Jordania
  { id: 'KAZ', name: 'Kazajistán', parentId: 'ASIA', category: 'País', d: '' }, // República de Kazajistán
  { id: 'KGZ', name: 'Kirguistán', parentId: 'ASIA', category: 'País', d: '' }, // República Kirguisa
  { id: 'KWT', name: 'Kuwait', parentId: 'ASIA', category: 'País', d: '' }, // Estado de Kuwait
  { id: 'LAO', name: 'Laos', parentId: 'ASIA', category: 'País', d: '' }, // República Democrática Popular Laos
  { id: 'LBN', name: 'Líbano', parentId: 'ASIA', category: 'País', d: '' }, // República Libanesa
  { id: 'MYS', name: 'Malasia', parentId: 'ASIA', category: 'País', d: '' }, // Malasia
  { id: 'MDV', name: 'Maldivas', parentId: 'ASIA', category: 'País', d: '' }, // República de Maldivas
  { id: 'MNG', name: 'Mongolia', parentId: 'ASIA', category: 'País', d: '' }, // Mongolia
  { id: 'NPL', name: 'Nepal', parentId: 'ASIA', category: 'País', d: '' }, // República Federal Democrática de Nepal
  { id: 'OMN', name: 'Omán', parentId: 'ASIA', category: 'País', d: '' }, // Sultanato de Omán
  { id: 'PAK', name: 'Pakistán', parentId: 'ASIA', category: 'País', d: '' }, // República Islámica de Pakistán
  { id: 'SGP', name: 'Singapur', parentId: 'ASIA', category: 'País', d: '' }, // República de Singapur
  { id: 'SYR', name: 'Siria', parentId: 'ASIA', category: 'País', d: '' }, // República Árabe Siria
  { id: 'LKA', name: 'Sri Lanka', parentId: 'ASIA', category: 'País', d: '' }, // República Democrática Socialista de Sri Lanka
  { id: 'THA', name: 'Tailandia', parentId: 'ASIA', category: 'País', d: '' }, // Reino de Tailandia
  { id: 'TWN', name: 'Taiwán', parentId: 'ASIA', category: 'País', d: '' }, // República de China (Taiwán)
  { id: 'TJK', name: 'Tayikistán', parentId: 'ASIA', category: 'País', d: '' }, // República de Tayikistán
  { id: 'TLS', name: 'Timor Oriental', parentId: 'ASIA', category: 'País', d: '' }, // República Democrática de Timor Oriental
  { id: 'TUR', name: 'Turquía', parentId: 'ASIA', category: 'País', d: '' }, // República de Turquía
  { id: 'TKM', name: 'Turkmenistán', parentId: 'ASIA', category: 'País', d: '' }, // Turkmenistán
  { id: 'UZB', name: 'Uzbekistán', parentId: 'ASIA', category: 'País', d: '' }, // República de Uzbekistán
  { id: 'VNM', name: 'Vietnam', parentId: 'ASIA', category: 'País', d: '' }, // República Socialista de Vietnam
  { id: 'YEM', name: 'Yemen', parentId: 'ASIA', category: 'País', d: '' }, // República de Yemen

  // ============================================================================
  // ÁFRICA (AFRICA)
  // ============================================================================
  { id: 'AGO', name: 'Angola', parentId: 'AFRICA', category: 'País', d: '' }, // República de Angola
  { id: 'DZA', name: 'Argelia', parentId: 'AFRICA', category: 'País', d: '' }, // República Argelina Democrática y Popular
  { id: 'BEN', name: 'Benín', parentId: 'AFRICA', category: 'País', d: '' }, // República de Benín
  { id: 'BWA', name: 'Botsuana', parentId: 'AFRICA', category: 'País', d: '' }, // República de Botsuana
  { id: 'BFA', name: 'Burkina Faso', parentId: 'AFRICA', category: 'País', d: '' }, // Burkina Faso
  { id: 'BDI', name: 'Burundi', parentId: 'AFRICA', category: 'País', d: '' }, // República de Burundi
  { id: 'CMR', name: 'Camerún', parentId: 'AFRICA', category: 'País', d: '' }, // República de Camerún
  { id: 'CPV', name: 'Cabo Verde', parentId: 'AFRICA', category: 'País', d: '' }, // República de Cabo Verde
  { id: 'TCD', name: 'Chad', parentId: 'AFRICA', category: 'País', d: '' }, // República del Chad
  { id: 'COG', name: 'Congo', parentId: 'AFRICA', category: 'País', d: '' }, // República del Congo
  { id: 'COD', name: 'Congo (RD)', parentId: 'AFRICA', category: 'País', d: '' }, // República Democrática del Congo
  { id: 'CIV', name: 'Costa de Marfil', parentId: 'AFRICA', category: 'País', d: '' }, // República de Costa de Marfil
  { id: 'EGY', name: 'Egipto', parentId: 'AFRICA', category: 'País', d: '' }, // República Árabe de Egipto
  { id: 'ERI', name: 'Eritrea', parentId: 'AFRICA', category: 'País', d: '' }, // Estado de Eritrea
  { id: 'ETH', name: 'Etiopía', parentId: 'AFRICA', category: 'País', d: '' }, // República Democrática Federal de Etiopía
  { id: 'GAB', name: 'Gabón', parentId: 'AFRICA', category: 'País', d: '' }, // República Gabonesa
  { id: 'GHA', name: 'Ghana', parentId: 'AFRICA', category: 'País', d: '' }, // República de Ghana
  { id: 'GIN', name: 'Guinea', parentId: 'AFRICA', category: 'País', d: '' }, // República de Guinea
  { id: 'KEN', name: 'Kenia', parentId: 'AFRICA', category: 'País', d: '' }, // República de Kenia
  { id: 'LBR', name: 'Liberia', parentId: 'AFRICA', category: 'País', d: '' }, // República de Liberia
  { id: 'LBY', name: 'Libia', parentId: 'AFRICA', category: 'País', d: '' }, // Estado de Libia
  { id: 'MDG', name: 'Madagascar', parentId: 'AFRICA', category: 'País', d: '' }, // República de Madagascar
  { id: 'MLI', name: 'Malí', parentId: 'AFRICA', category: 'País', d: '' }, // República de Malí
  { id: 'MAR', name: 'Marruecos', parentId: 'AFRICA', category: 'País', d: '' }, // Reino de Marruecos
  { id: 'MOZ', name: 'Mozambique', parentId: 'AFRICA', category: 'País', d: '' }, // República de Mozambique
  { id: 'NAM', name: 'Namibia', parentId: 'AFRICA', category: 'País', d: '' }, // República de Namibia
  { id: 'NER', name: 'Níger', parentId: 'AFRICA', category: 'País', d: '' }, // República del Níger
  { id: 'NGA', name: 'Nigeria', parentId: 'AFRICA', category: 'País', d: '' }, // República Federal de Nigeria
  { id: 'RWA', name: 'Ruanda', parentId: 'AFRICA', category: 'País', d: '' }, // República de Ruanda
  { id: 'SEN', name: 'Senegal', parentId: 'AFRICA', category: 'País', d: '' }, // República del Senegal
  { id: 'ZAF', name: 'Sudáfrica', parentId: 'AFRICA', category: 'País', d: '' }, // República de Sudáfrica
  { id: 'SDN', name: 'Sudán', parentId: 'AFRICA', category: 'País', d: '' }, // República del Sudán
  { id: 'TZA', name: 'Tanzania', parentId: 'AFRICA', category: 'País', d: '' }, // República Unida de Tanzania
  { id: 'TUN', name: 'Túnez', parentId: 'AFRICA', category: 'País', d: '' }, // República Tunecina
  { id: 'UGA', name: 'Uganda', parentId: 'AFRICA', category: 'País', d: '' }, // República de Uganda
  { id: 'ZMB', name: 'Zambia', parentId: 'AFRICA', category: 'País', d: '' }, // República de Zambia
  { id: 'ZWE', name: 'Zimbabue', parentId: 'AFRICA', category: 'País', d: '' }, // República de Zimbabue

  // ============================================================================
  // OCEANÍA (OCEANIA)
  // ============================================================================
  { id: 'AUS', name: 'Australia', parentId: 'OCEANIA', category: 'País', d: '' }, // Mancomunidad de Australia
  { id: 'FJI', name: 'Fiyi', parentId: 'OCEANIA', category: 'País', d: '' }, // República de Fiyi
  { id: 'NZL', name: 'Nueva Zelanda', parentId: 'OCEANIA', category: 'País', d: '' }, // Nueva Zelanda
  { id: 'PNG', name: 'Papúa Nueva Guinea', parentId: 'OCEANIA', category: 'País', d: '' }, // Independiente Estado de Papúa Nueva Guinea
  { id: 'SLB', name: 'Islas Salomón', parentId: 'OCEANIA', category: 'País', d: '' }, // Islas Salomón
  { id: 'WSM', name: 'Samoa', parentId: 'OCEANIA', category: 'País', d: '' }, // Estado Independiente de Samoa
  { id: 'TON', name: 'Tonga', parentId: 'OCEANIA', category: 'País', d: '' }, // Reino de Tonga
  { id: 'VUT', name: 'Vanuatu', parentId: 'OCEANIA', category: 'País', d: '' }  // República de Vanuatu
];
