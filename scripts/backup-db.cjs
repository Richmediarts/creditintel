const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const dbPath = path.join(__dirname, '..', 'data', 'credit-dashboard.db')
const backupsDir = path.join(__dirname, '..', 'data', 'backups')

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true })
}

const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '')
const backupPath = path.join(backupsDir, `credit-dashboard-${stamp}.db`)

async function main() {
  const db = new Database(dbPath, { readonly: true })
  await db.backup(backupPath)
  db.close()

  console.log(`Backup created: ${backupPath} (${fs.statSync(backupPath).size} bytes)`)

  const backups = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.db')).sort()
  if (backups.length > 30) {
    const toRemove = backups.slice(0, backups.length - 30)
    for (const f of toRemove) {
      fs.unlinkSync(path.join(backupsDir, f))
      console.log(`Pruned old backup: ${f}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
