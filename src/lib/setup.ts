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

export async function ensureExampleAccount(): Promise<void> {
  const db = getDb()
  const exampleEmail = process.env.EXAMPLE_USER_EMAIL || 'example@retteewealth.me'
  const examplePassword = process.env.EXAMPLE_USER_PASSWORD || 'example123'
  const exampleName = process.env.EXAMPLE_USER_NAME || 'Example'
  const admin = await db.prepare('SELECT id FROM users WHERE role = ? ORDER BY id ASC LIMIT 1').get('admin')

  const existing = await db.prepare('SELECT id, is_example, mirror_user_id FROM users WHERE email = ?').get(exampleEmail.toLowerCase().trim())
  if (existing) {
    if (admin && (existing.mirror_user_id || null) !== admin.id) {
      await db.prepare('UPDATE users SET is_example = 1, mirror_user_id = ? WHERE id = ?').run(admin.id, existing.id)
    }
    return
  }

  if (!admin) return
  const hash = bcrypt.hashSync(examplePassword, 12)
  await db.prepare(`
    INSERT INTO users (name, email, password_hash, role, address, is_example, mirror_user_id)
    VALUES (?, ?, ?, 'member', ?, 1, ?)
  `).run(
    exampleName, exampleEmail.toLowerCase().trim(), hash, 'Set up with Example User',
    admin.id
  )
  console.log(`Example account created: ${exampleEmail}`)
}
