import { createOdooDatabase, odooDatabaseExists } from './odoo-db'

// Re-export for callers that use the old interface
export { odooDatabaseExists as tenantDatabaseExists }

export async function createTenantDatabase(
  dbName: string,
  adminPassword: string,
): Promise<void> {
  const result = await createOdooDatabase(dbName, adminPassword)
  if (!result.success) {
    throw new Error(result.error ?? 'Failed to create Odoo database.')
  }
}

// No-op: Odoo initialises its own schema on database creation.
export async function seedTenantDatabase(
  _dbName: string,
  _meta: { companyName: string; ownerEmail: string },
): Promise<void> {
  // Odoo self-seeds on creation — nothing to do here.
}
