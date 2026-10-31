import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  getOrCreateHousehold, getHouseholdMembers, updateHousehold, resolveBudgetUserId,
  setShareLevel, getMemberContributions, addMemberContribution,
} from '@/lib/household-db'

function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('credit-dashboard-token')?.value
  if (!token) return null
  return verifyToken(token)
}

/** GET — my household: members, settings, contributions. */
export async function GET(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    const household = await getOrCreateHousehold(auth.userId)
    const members = await getHouseholdMembers(household.id)
    const budgetUserId = await resolveBudgetUserId(auth.userId)
    const contributions = await getMemberContributions(budgetUserId)
    return NextResponse.json({
      household,
      members,
      contributions,
      isOwner: household.created_by === auth.userId,
    })
  } catch (error) {
    console.error('household GET', error)
    return NextResponse.json({ error: 'Failed to load household' }, { status: 500 })
  }
}

/**
 * PATCH — household settings (owner/admin), my privacy level, or a
 * contribution added by a member who does not want to connect accounts.
 */
export async function PATCH(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    const data = await request.json()
    if (data.create_invite) {
      const household = await getOrCreateHousehold(auth.userId)
      if (household.created_by !== auth.userId || auth.isExample) {
        return NextResponse.json({ error: 'Only the household owner can invite a spouse.' }, { status: 403 })
      }
      const code = randomBytes(24).toString('hex')
      const hash = createHash('sha256').update(code).digest('hex')
      await getDb().prepare("UPDATE budget_households SET invite_hash = ?, invite_expires_at = NOW() + INTERVAL '24 hours' WHERE id = ? AND created_by = ?").run(hash, household.id, auth.userId)
      return NextResponse.json({ invite_code: code })
    }

    if (data.share_level) {
      await setShareLevel(auth.userId, data.share_level)
    }
    if (data.contribution !== undefined) {
      const budgetUserId = await resolveBudgetUserId(auth.userId)
      await addMemberContribution(budgetUserId, Number(data.contribution), data.contribution_notes || '')
    }
    if (
      data.name !== undefined ||
      data.unconfirmed_reserve !== undefined ||
      data.cushion_target !== undefined ||
      data.split_mode !== undefined
    ) {
      const household = await getOrCreateHousehold(auth.userId)
      if (household.created_by === auth.userId) {
        await updateHousehold(auth.userId, data)
      } else {
        return NextResponse.json({ error: 'Only the household owner can change shared settings' }, { status: 403 })
      }
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('household PATCH', error)
    return NextResponse.json({ error: 'Failed to update household' }, { status: 500 })
  }
}

/**
 * POST — join a household as the second spouse. The joining member keeps
 * their own login; the household budget owner's data becomes the shared plan.
 */
export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    const { invite_code } = await request.json()
    const code = String(invite_code || '').trim()
    if (!/^[a-f0-9]{48}$/.test(code)) {
      return NextResponse.json({ error: 'Ask the household owner for a valid invitation code.' }, { status: 400 })
    }
    const hash = createHash('sha256').update(code).digest('hex')
    // Single SQL statement consumes the invitation atomically, then links the member.
    const joined = await getDb().prepare(`
      WITH accepted AS (
        UPDATE budget_households SET invite_hash = NULL, invite_expires_at = NULL
        WHERE invite_hash = ? AND invite_expires_at > NOW() AND created_by <> ?
        RETURNING id
      )
      UPDATE users SET household_id = accepted.id FROM accepted
      WHERE users.id = ? RETURNING accepted.id AS household_id
    `).get(hash, auth.userId, auth.userId) as { household_id: number } | undefined
    if (!joined) return NextResponse.json({ error: 'The invitation is invalid or expired. Ask the owner for a new one.' }, { status: 400 })
    return NextResponse.json({ success: true, household_id: joined.household_id })
  } catch (error) {
    console.error('household join POST', error)
    return NextResponse.json({ error: 'Failed to join household' }, { status: 500 })
  }
}
