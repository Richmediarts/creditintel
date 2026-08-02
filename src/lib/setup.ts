import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'

export async function ensureAdminAccount(): Promise<void> {
  const db = getDb()
  const adminCount = (await db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin') as any).count

  if (adminCount === 0) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@creditintel.com'
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
    const adminName = process.env.ADMIN_NAME || 'Admin'

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail.toLowerCase().trim())
    if (!existing) {
      const hash = bcrypt.hashSync(adminPassword, 12)
      await db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
        adminName, adminEmail.toLowerCase().trim(), hash, 'admin'
      )
      console.log(`Admin account created: ${adminEmail}`)
    }
  }
}
