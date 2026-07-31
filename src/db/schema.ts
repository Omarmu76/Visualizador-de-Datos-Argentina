import { relations } from 'drizzle-orm'; // Importación de la función de relaciones de Drizzle ORM para establecer vínculos entre tablas
import { pgTable, text, timestamp, jsonb, varchar, pgEnum } from 'drizzle-orm/pg-core'; // Importación de tipos de columnas, constructores de tablas y enums desde Drizzle ORM para PostgreSQL

// ==========================================
// ENUMERACIÓN DE ROLES DE USUARIO (RBAC)
// ==========================================
export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'ADMIN', 'USER']); // Define las opciones de roles en el sistema para control de acceso basado en roles

// ==========================================
// TABLA DE USUARIOS (Sincronizada con Firebase Auth y Sistema de Roles)
// ==========================================
export const users = pgTable('users', { // Define la estructura física de la tabla de usuarios registrados en el sistema
  id: text('id').primaryKey(), // Identificador único principal del usuario (representa el UID proveniente de Firebase Auth)
  email: text('email').notNull(), // Dirección de correo electrónico asociada a la cuenta del usuario, campo de texto obligatorio
  role: userRoleEnum('role').default('USER').notNull(), // Asigna el rol del usuario ('SUPER_ADMIN', 'ADMIN', 'USER') con 'USER' por defecto para nuevos registros
  createdAt: timestamp('created_at').defaultNow().notNull(), // Fecha y hora de creación automática de la cuenta del usuario, no nula
}); // Fin del esquema de la tabla de usuarios registrados

// ==========================================
// TABLA DE ESPACIOS DE TRABAJO (Workspaces para aislamiento Multi-Tenant)
// ==========================================
export const workspaces = pgTable('workspaces', { // Registra los espacios de trabajo independientes administrados por usuarios ADMIN o SUPER_ADMIN
  id: text('id').primaryKey(), // Identificador clave primaria única del espacio de trabajo
  name: text('name').notNull(), // Nombre descriptivo del espacio de trabajo o empresa (ej. "Catastro Municipal", "Sectores Inmobiliarios")
  description: text('description'), // Descripción opcional detallando el propósito del espacio de trabajo
  ownerId: text('owner_id') // Identificador del usuario propietario y creador del espacio de trabajo
    .notNull() // Obligatorio para vincular cada espacio a su dueño
    .references(() => users.id, { onDelete: 'cascade' }), // Llave foránea enlazada a la tabla users con eliminación en cascada
  isPublic: text('is_public').default('false').notNull(), // Flag de privacidad para permitir visualización pública o privada
  createdAt: timestamp('created_at').defaultNow().notNull(), // Fecha y hora de creación automática del espacio de trabajo
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // Marca de tiempo con la fecha de última modificación realizada
}); // Fin del esquema de la tabla de espacios de trabajo

// ==========================================
// TABLA DE NODOS GEOGRÁFICOS Y RUTAS DINÁMICAS (Jerarquía Infinita)
// ==========================================
export const geoNodes = pgTable('geo_nodes', { // Define la tabla de nodos vectoriales para jerarquías dinámicas y personalizadas
  id: varchar('id', { length: 255 }).primaryKey(), // Identificador clave primaria único del nodo geográfico
  workspaceId: text('workspace_id') // Asocia el nodo geográfico al espacio de trabajo privado o público correspondiente
    .notNull() // Campo obligatorio para mantener el aislamiento Multi-Tenant estricto
    .references(() => workspaces.id, { onDelete: 'cascade' }), // Referencia a la tabla workspaces con borrado en cascada
  parentId: varchar('parent_id', { length: 255 }) // Referencia autorreferencial al nodo padre para construir migas de pan dinámicas
    .references((): any => geoNodes.id, { onDelete: 'cascade' }), // Llave foránea que apunta a la misma tabla geoNodes
  level: varchar('level', { length: 100 }).notNull(), // Etiqueta descriptiva del nivel o capa (ej. "Nivel 1", "Chacra", "Lote", "Océano")
  name: varchar('name', { length: 255 }).notNull(), // Nombre descriptivo único del nodo o elemento geográfico
  svgPath: text('svg_path'), // Cadena vectorial de comandos SVG (d="...") que dibuja la geometría del polígono
  visualStyles: jsonb('visual_styles'), // Objeto JSONB estructurado para colores de relleno, bordes y fuentes personalizadas
  customData: jsonb('custom_data'), // Objeto JSONB flexible para almacenar indicadores, métricas y datos estadísticos adicionales
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // Marca de tiempo del último cambio grabado en este nodo geográfico
}); // Fin del esquema de la tabla de nodos geográficos dinámicos

// ==========================================
// TABLA DE PERSONALIZACIÓN DE PROVINCIAS (Mapeo de datos federados existente)
// ==========================================
export const provinceCustomizations = pgTable('province_customizations', { // Registra personalizaciones de provincias hechas por usuarios
  id: text('id').primaryKey(), // Clave principal única de control compuesta por el id del usuario y de la provincia
  userId: text('user_id') // Identificador del usuario que generó y es dueño de los cambios
    .notNull() // Este campo es strictly obligatorio para asegurar la auditoría de cambios
    .references(() => users.id, { onDelete: 'cascade' }), // Llave foránea enlazada a la tabla de usuarios con eliminación en cascada automática
  provinceId: text('province_id').notNull(), // Código identificativo de la provincia o territorio alterado (ej. 'AR-B')
  customData: jsonb('custom_data').notNull(), // Contenedor JSON general que resguarda todas las métricas personalizadas de la provincia
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // Marca de tiempo para registrar la última modificación guardada
}); // Fin del esquema de personalización de provincias

// ==========================================
// TABLA JERÁRQUICA: TERRITORIES (SIG & Catastro Global - Argentina y Provincias)
// ==========================================
export const territories = pgTable('territories', { // Define la tabla maestra para soportar el mapa jerárquico de Argentina y Provincias
  id: varchar('id', { length: 255 }).primaryKey(), // Identificador de clave principal único para el territorio con límite máximo de 255 caracteres
  parentId: varchar('parent_id', { length: 255 }), // Identificador del territorio padre (relación jerárquica auto-referencial de árbol)
  level: varchar('level', { length: 50 }).notNull(), // Nivel administrativo o geográfico del territorio ('world' | 'continent' | 'country' | 'province' | 'city' | 'neighborhood', etc.)
  name: varchar('name', { length: 255 }).notNull(), // Nombre descriptivo y amigable del territorio (ej. "Misiones", "La Matanza"), longitud máxima 255, obligatorio
  svgPath: text('svg_path'), // Cadena de texto extendida que contiene el path vectorial SVG (instrucciones d="...") para graficar el polígono
  visualStyles: jsonb('visual_styles'), // Objeto JSONB estructurado que contiene los estilos visuales en caliente (colores, fuentes, bordes)
  customData: jsonb('custom_data'), // Objeto JSONB libre que resguarda métricas dinámicas (valores activos, porcentajes, etc.)
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // Marca de tiempo del último cambio o calibración realizado sobre el territorio
}); // Fin del esquema de la tabla jerárquica de territorios

// ==========================================
// DEFINICIÓN DE RELACIONES (Drizzle ORM Relations)
// ==========================================

// Relaciones para la tabla de Usuarios
export const usersRelations = relations(users, ({ many }) => ({ // Establece las relaciones directas desde la tabla users
  workspaces: many(workspaces), // Un usuario puede poseer y administrar múltiples espacios de trabajo (workspaces)
  provinceCustomizations: many(provinceCustomizations), // Un usuario puede tener múltiples personalizaciones de provincias
})); // Fin de la definición de relaciones para usuarios

// Relaciones para la tabla de Espacios de Trabajo (Workspaces)
export const workspacesRelations = relations(workspaces, ({ one, many }) => ({ // Establece las relaciones para la tabla workspaces
  owner: one(users, { // Cada espacio de trabajo pertenece a un único usuario propietario
    fields: [workspaces.ownerId], // Campo de clave foránea local en la tabla workspaces
    references: [users.id], // Campo de referencia de destino en la tabla users
  }), // Fin de la relación con el propietario
  geoNodes: many(geoNodes), // Un espacio de trabajo puede agrupar múltiples nodos geográficos vectoriales
})); // Fin de la definición de relaciones para espacios de trabajo

// Relaciones para la tabla de Nodos Geográficos (geoNodes)
export const geoNodesRelations = relations(geoNodes, ({ one, many }) => ({ // Establece las relaciones para los nodos geográficos
  workspace: one(workspaces, { // Cada nodo geográfico pertenece obligatoriamente a un espacio de trabajo específico
    fields: [geoNodes.workspaceId], // Campo de clave foránea local en la tabla geoNodes
    references: [workspaces.id], // Campo de referencia en la tabla workspaces
  }), // Fin de la relación con el espacio de trabajo
  parent: one(geoNodes, { // Un nodo geográfico puede tener un único nodo padre directo en la jerarquía dinámica
    fields: [geoNodes.parentId], // Campo de referencia al nodo padre dentro de la misma tabla
    references: [geoNodes.id], // Referencia de destino al id de la misma tabla geoNodes
    relationName: 'geoNodeHierarchy', // Nombre asignado a la relación jerárquica autorreferencial
  }), // Fin de la relación con el nodo padre
  children: many(geoNodes, { // Un nodo geográfico puede tener múltiples nodos hijos dentro de la jerarquía
    relationName: 'geoNodeHierarchy', // Mismo nombre de relación autorreferencial para vincular padres con hijos
  }), // Fin de la relación con los nodos hijos
})); // Fin de la definición de relaciones para nodos geográficos

// Relaciones para la tabla de Personalización de Provincias
export const provinceCustomizationsRelations = relations(provinceCustomizations, ({ one }) => ({ // Relación de personalizaciones
  user: one(users, { // Cada registro de personalización pertenece a un usuario específico
    fields: [provinceCustomizations.userId], // Campo de clave foránea userId
    references: [users.id], // Referencia al ID del usuario
  }), // Fin de la relación con usuario
})); // Fin de la definición de relaciones de personalización de provincias

// Relaciones autorreferenciales para la tabla de Territorios (Argentina / Provincias)
export const territoriesRelations = relations(territories, ({ one, many }) => ({ // Relaciones para la jerarquía territorial existente
  parent: one(territories, { // Cada territorio puede tener un territorio padre
    fields: [territories.parentId], // Campo parentId
    references: [territories.id], // ID del territorio padre
    relationName: 'territoryHierarchy', // Nombre de relación de árbol territorial
  }), // Fin de la relación padre
  children: many(territories, { // Cada territorio puede contener múltiples territorios hijos
    relationName: 'territoryHierarchy', // Mismo nombre de relación para hijos
  }), // Fin de la relación hijos
})); // Fin de la definición de relaciones para territorios



