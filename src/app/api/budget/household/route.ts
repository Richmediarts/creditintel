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
    const { owner_email } = await request.json()
    const db = getDb()
    const owner = (await db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).get(String(owner_email || '').trim().toLowerCase())) as { id: number } | undefined
    if (!owner) {
      return NextResponse.json({ error: 'No household found for that email' }, { status: 404 })
    }
    const household = await getOrCreateHousehold(owner.id)
    await getDb().prepare('UPDATE users SET household_id = ? WHERE id = ?').run(household.id, auth.userId)
    return NextResponse.json({ success: true, household_id: household.id })
  } catch (error) {
    console.error('household join POST', error)
    return NextResponse.json({ error: 'Failed to join household' }, { status: 500 })
  }
}
