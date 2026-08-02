export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { initSchema } = await import('@/lib/db')
    await initSchema()
  } catch (e) {
    console.error('Failed to initialize Postgres schema:', e)
  }

  try {
    const { ensureAdminAccount } = await import('@/lib/setup')
    await ensureAdminAccount()
  } catch (e) {
    console.error('Failed to ensure admin account:', e)
  }
}
