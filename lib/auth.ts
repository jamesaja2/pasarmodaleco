import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { prisma } from './prisma'
import { enforceSecurity } from './security'

const TOKEN_COOKIE = 'auth_token'
const encoder = new TextEncoder()

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return encoder.encode(secret)
}

export interface SessionTokenPayload {
  sub: string
  username: string
  role: UserRole
  teamName?: string | null
  exp?: number
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export async function createSessionToken(payload: SessionTokenPayload, expiresInHours = 24) {
  const secret = getJwtSecret()
  const expireSeconds = expiresInHours * 60 * 60
  const jwt = await new SignJWT({
    username: payload.username,
    role: payload.role,
    teamName: payload.teamName ?? null,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${expireSeconds}s`)
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.set(TOKEN_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: expireSeconds,
    path: '/',
  })

  return jwt
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.set(TOKEN_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })
}

export async function getTokenFromCookies() {
  const cookieStore = await cookies()
  return cookieStore.get(TOKEN_COOKIE)?.value ?? null
}

export async function getRequestUser(request?: NextRequest) {
  try {
    const token = request
      ? request.cookies.get(TOKEN_COOKIE)?.value
      : await getTokenFromCookies()

    if (!token) {
      return null
    }

    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      include: {
        broker: true,
        credential: true,
      },
    } as any)

    if (!user || !user.isActive) {
      return null
    }

    return user
  } catch (error) {
    return null
  }
}

export async function requireUser(request?: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    throw new Error('UNAUTHENTICATED')
  }

  if (request && user.role !== UserRole.ADMIN) {
    const security = await enforceSecurity(request)
    if (!security.allowed) {
      throw new Error('FORBIDDEN')
    }
  }
  return user
}

export async function requireAdmin(request?: NextRequest) {
  const user = await requireUser(request)
  if (user.role !== UserRole.ADMIN) {
    throw new Error('FORBIDDEN')
  }
  return user
}

export async function requireSuperAdmin(request?: NextRequest) {
  const user = await requireAdmin(request)
  if (!user.isSuperAdmin) {
    throw new Error('FORBIDDEN')
  }
  return user
}

