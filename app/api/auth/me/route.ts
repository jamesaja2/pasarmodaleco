import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        teamName: user.teamName,
        schoolOrigin: user.schoolOrigin,
        currentBalance: user.currentBalance,
        startingBalance: user.startingBalance,
        broker: user.broker
          ? {
              id: user.broker.id,
              code: user.broker.brokerCode,
              name: user.broker.brokerName,
              feePercentage: user.broker.feePercentage,
            }
          : null,
        lastLogin: user.lastLogin,
        requiresBrokerSelection: !user.brokerId,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
