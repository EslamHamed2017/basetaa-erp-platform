import { Pool, PoolClient } from 'pg'

// Admin connection pool — used to CREATE/DROP databases
function getAdminPool(): Pool {
  return new Pool({
    host: process.env.TENANT_DB_HOST ?? 'localhost',
    port: parseInt(process.env.TENANT_DB_PORT ?? '5432'),
    user: process.env.TENANT_DB_ADMIN_USER ?? 'postgres',
    password: process.env.TENANT_DB_ADMIN_PASSWORD,
    database: 'postgres', // Connect to postgres DB for admin operations
    max: 3,
  })
}

// Get a connection pool for a specific tenant database
export function getTenantPool(dbName: string): Pool {
  return new Pool({
    host: process.env.TENANT_DB_HOST ?? 'localhost',
    port: parseInt(process.env.TENANT_DB_PORT ?? '5432'),
    user: process.env.TENANT_DB_USER ?? 'postgres',
    password: process.env.TENANT_DB_PASSWORD,
    database: dbName,
    max: 5,
  })
}

// Create a new PostgreSQL database for a tenant
export async function createTenantDatabase(dbName: string): Promise<void> {
  const pool = getAdminPool()
  let client: PoolClient | null = null
  try {
    client = await pool.connect()
    // Sanitize dbName — only allow alphanumeric and underscores
    if (!/^[a-z0-9_]+$/.test(dbName)) {
      throw new Error(`Invalid database name: ${dbName}`)
    }
    await client.query(`CREATE DATABASE "${dbName}"`)
  } finally {
    client?.release()
    await pool.end()
  }
}

// Seed the tenant database with a minimal workspace schema
// In the foundation version this creates a basic structure.
// Future: replace with Odoo DB initialization.
export async function seedTenantDatabase(dbName: string, tenantMeta: {
  companyName: string
  ownerEmail: string
}): Promise<void> {
  const pool = getTenantPool(dbName)
  let client: PoolClient | null = null
  try {
    client = await pool.connect()
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    await client.query(`
      INSERT INTO workspace_meta (key, value) VALUES
        ('company_name', $1),
        ('owner_email',  $2),
        ('initialized_at', NOW()::TEXT)
      ON CONFLICT (key) DO NOTHING;
    `, [tenantMeta.companyName, tenantMeta.ownerEmail])
  } finally {
    client?.release()
    await pool.end()
  }
}

// Check if a tenant database exists
export async function tenantDatabaseExists(dbName: string): Promise<boolean> {
  const pool = getAdminPool()
  let client: PoolClient | null = null
  try {
    client = await pool.connect()
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    )
    return result.rowCount !== null && result.rowCount > 0
  } finally {
    client?.release()
    await pool.end()
  }
}
