import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let poolInstance: pg.Pool | null = null;

export function getDb() {
  if (!dbInstance) {
    const connectionString = process.env.SQL_DATABASE_URL;
    const host = process.env.SQL_HOST;
    const user = process.env.SQL_USER;
    const password = process.env.SQL_PASSWORD;
    const database = process.env.SQL_DB_NAME;

    if (connectionString) {
      poolInstance = new pg.Pool({
        connectionString,
        max: 5,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000,
        ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
          ? false
          : { rejectUnauthorized: false }
      });
    } else if (host && user && password && database) {
      poolInstance = new pg.Pool({
        host,
        user,
        password,
        database,
        max: 5,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000,
        // Unix sockets do not support/require SSL. If host is a path, disable SSL.
        ssl: host.startsWith('/') ? false : { rejectUnauthorized: false }
      });
    } else {
      throw new Error('Database configuration missing. Set either SQL_DATABASE_URL or individual SQL_* environment variables.');
    }

    // Previene excepciones no capturadas cuando el servidor Cloud SQL suspende o corta conexiones inactivas
    poolInstance.on('error', (err) => {
      console.warn('[Cloud SQL] Aviso de cliente inactivo en el pool (reconexión automática):', err.message);
    });

    dbInstance = drizzle(poolInstance, { schema });
  }
  return dbInstance;
}

export function closePool() {
  if (poolInstance) {
    poolInstance.end();
    poolInstance = null;
    dbInstance = null;
  }
}

