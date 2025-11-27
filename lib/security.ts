import { NextRequest } from 'next/server'
import { prisma } from './prisma'

function parseAllowedIPs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean)
  }
  return []
}

function matchCIDR(ip: string, cidr: string) {
  if (!ip || !cidr) return false

  // Allow wildcard
  if (cidr === '*') {
    return true
  }

  // Exact match
  if (!cidr.includes('/')) {
    return ip === cidr
  }

  if (ip.includes(':') || cidr.includes(':')) {
    // Basic IPv6 handling: exact match only
    return ip === cidr.replace('/128', '')
  }

  const [range, bits] = cidr.split('/')
  const mask = ~(2 ** (32 - Number(bits)) - 1)
  const ipLong = ipToLong(ip)
  const rangeLong = ipToLong(range)
  if (ipLong === null || rangeLong === null) {
    return false
  }

  return (ipLong & mask) === (rangeLong & mask)
}

function ipToLong(ip: string) {
  const octets = ip.split('.').map(Number)
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n))) {
    return null
  }
  return octets.reduce((acc, octet) => (acc << 8) + octet, 0)
}

export async function validateSafeExamBrowser(request: NextRequest) {
  // Check if SEB validation is enabled
  const enabledSetting = await prisma.setting.findUnique({ where: { key: 'seb_enabled' } })
  const isEnabled = enabledSetting?.value === true || enabledSetting?.value === 'true'
  
  if (!isEnabled) {
    return { allowed: true }
  }

  const userAgent = request.headers.get('user-agent') ?? ''
  const setting = await prisma.setting.findUnique({ where: { key: 'seb_user_agent' } })
  if (!setting) {
    return { allowed: true }
  }

  const allowedAgent = typeof setting.value === 'string' ? setting.value : ''
  if (allowedAgent && !userAgent.includes(allowedAgent)) {
    return {
      allowed: false,
      error: 'Access denied. Please use Safe Exam Browser.',
    }
  }

  return { allowed: true }
}

function extractClientIP(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) {
    return cfIp
  }

  const socket = (request as unknown as { ip?: string }).ip
  if (socket) {
    return socket
  }

  if (typeof request.nextUrl?.hostname === 'string') {
    const host = request.nextUrl.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return '127.0.0.1'
    }
  }

  return ''
}

export async function validateIPWhitelist(request: NextRequest) {
  // Check if IP restriction is enabled
  const enabledSetting = await prisma.setting.findUnique({ where: { key: 'ip_restriction_enabled' } })
  const isEnabled = enabledSetting?.value === true || enabledSetting?.value === 'true'
  
  if (!isEnabled) {
    return { allowed: true }
  }

  const clientIP = extractClientIP(request)
  if (!clientIP) {
    return { allowed: false, error: 'Unable to determine client IP address' }
  }

  const setting = await prisma.setting.findUnique({ where: { key: 'allowed_ips' } })
  if (!setting) {
    return { allowed: true }
  }

  const allowedIPs = parseAllowedIPs(setting.value)
  if (allowedIPs.length === 0) {
    return { allowed: true }
  }

  const matched = allowedIPs.some((ip) => matchCIDR(clientIP, ip))
  if (!matched) {
    return { allowed: false, error: 'Access denied. IP not whitelisted.' }
  }

  return { allowed: true }
}

export async function enforceSecurity(request: NextRequest) {
  const seb = await validateSafeExamBrowser(request)
  if (!seb.allowed) {
    return seb
  }

  const ip = await validateIPWhitelist(request)
  if (!ip.allowed) {
    return ip
  }

  return { allowed: true }
}
