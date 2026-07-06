import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const provinceCustomizations = pgTable('province_customizations', {
  id: text('id').primaryKey(), // format: userId_provinceId
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provinceId: text('province_id').notNull(),
  customData: jsonb('custom_data').notNull(), // Stores the ProvinceData object
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
