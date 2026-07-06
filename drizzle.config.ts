import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: process.env.SQL_DATABASE_URL
    ? { url: process.env.SQL_DATABASE_URL }
    : {
        host: process.env.SQL_HOST || '127.0.0.1',
        user: process.env.SQL_ADMIN_USER || 'postgres',
        password: process.env.SQL_ADMIN_PASSWORD || 'postgres',
        database: process.env.SQL_DB_NAME || 'postgres',
        ssl: process.env.SQL_HOST?.startsWith('/') ? false : undefined,
      },
});
