import { pgTable, text, timestamp, jsonb, varchar } from 'drizzle-orm/pg-core'; // Importación de tipos de columnas y constructores de tablas desde Drizzle ORM para PostgreSQL

// ==========================================
// TABLA DE USUARIOS (Sincronizada con Firebase Auth)
// ==========================================
export const users = pgTable('users', { // Define la estructura física de la tabla de usuarios registrados en el sistema
  id: text('id').primaryKey(), // Identificador único principal del usuario (representa el UID proveniente de Firebase Auth)
  email: text('email').notNull(), // Dirección de correo electrónico asociada a la cuenta del usuario, campo de texto obligatorio
  createdAt: timestamp('created_at').defaultNow().notNull(), // Fecha y hora de creación automática de la cuenta del usuario, no nula
}); // Fin del esquema de la tabla de usuarios registrados

// ==========================================
// TABLA DE PERSONALIZACIÓN DE PROVINCIAS (Mapeo de datos federados)
// ==========================================
export const provinceCustomizations = pgTable('province_customizations', { // Registra personalizaciones de provincias hechas por usuarios
  id: text('id').primaryKey(), // Clave principal única de control compuesta por el id del usuario y de la provincia
  userId: text('user_id') // Identificador del usuario que generó y es dueño de los cambios
    .notNull() // Este campo es estrictamente obligatorio para asegurar la auditoría de cambios
    .references(() => users.id, { onDelete: 'cascade' }), // Llave foránea enlazada a la tabla de usuarios con eliminación en cascada automática
  provinceId: text('province_id').notNull(), // Código identificativo de la provincia o territorio alterado (ej. 'AR-B')
  customData: jsonb('custom_data').notNull(), // Contenedor JSON general que resguarda todas las métricas personalizadas de la provincia
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // Marca de tiempo para registrar la última modificación guardada
}); // Fin del esquema de personalización de provincias

// ==========================================
// TABLA JERÁRQUICA: TERRITORIES (SIG & Catastro Global)
// ==========================================
export const territories = pgTable('territories', { // Define la tabla maestra para soportar el mapa jerárquico desde el Mundo hasta la Parcela
  id: varchar('id', { length: 255 }).primaryKey(), // Identificador de clave principal único para el territorio con límite máximo de 255 caracteres
  parentId: varchar('parent_id', { length: 255 }), // Identificador del territorio padre (relación jerárquica auto-referencial de árbol)
  level: varchar('level', { length: 50 }).notNull(), // Nivel administrativo o geográfico del territorio ('world' | 'continent' | 'country' | 'province' | 'city' | 'neighborhood', etc.)
  name: varchar('name', { length: 255 }).notNull(), // Nombre descriptivo y amigable del territorio (ej. "Misiones", "La Matanza"), longitud máxima 255, obligatorio
  svgPath: text('svg_path'), // Cadena de texto extendida que contiene el path vectorial SVG (instrucciones d="...") para graficar el polígono
  visualStyles: jsonb('visual_styles'), // Objeto JSONB estructurado que contiene los estilos visuales en caliente (colores, fuentes, bordes)
  customData: jsonb('custom_data'), // Objeto JSONB libre que resguarda métricas dinámicas (valores activos, porcentajes, etc.)
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // Marca de tiempo del último cambio o calibración realizado sobre el territorio
}); // Fin del esquema de la tabla jerárquica de territorios


