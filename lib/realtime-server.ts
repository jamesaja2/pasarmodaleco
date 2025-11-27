import { WebSocket, WebSocketServer } from 'ws'
import { randomUUID } from 'crypto'
import { prisma } from './prisma'

interface ClientContext {
  id: string
  socket: WebSocket
  stockSubscriptions: Set<string>
}

type BroadcastType =
  | 'time_sync'
  | 'day_changed'
  | 'notification'
  | 'market_bell'
  | 'transaction_status'
  | 'price_update'
  | 'admin_broadcast'

let wss: WebSocketServer | null = null
let clients: Map<string, ClientContext> | null = null
let timeSyncInterval: NodeJS.Timeout | null = null

function serialize(type: BroadcastType, payload: unknown) {
  return JSON.stringify({ type, payload })
}

function ensureIntervals() {
  if (timeSyncInterval) return
  timeSyncInterval = setInterval(async () => {
    const now = new Date()
    broadcast('time_sync', {
      timestamp: now.toISOString(),
    })
  }, 30000)
}

function cleanupIntervals() {
  if (timeSyncInterval) {
    clearInterval(timeSyncInterval)
    timeSyncInterval = null
  }
}

function handleMessage(client: ClientContext, raw: WebSocket.RawData) {
  try {
    const parsed = JSON.parse(raw.toString())
    if (!parsed?.type) return

    switch (parsed.type) {
      case 'subscribe_prices': {
        const codes: string[] = Array.isArray(parsed.payload?.stockCodes)
          ? parsed.payload.stockCodes
          : []
        client.stockSubscriptions = new Set(codes.map((c) => c.toUpperCase()))
        break
      }
      default:
        break
    }
  } catch (error) {
    console.error('Failed to handle websocket message', error)
  }
}

function handleClose(clientId: string) {
  clients?.delete(clientId)
  if (clients && clients.size === 0) {
    cleanupIntervals()
  }
}

function startServer() {
  if (wss) return { wss, clients: clients! }

  const port = Number(process.env.WEBSOCKET_PORT || '3001')
  wss = new WebSocketServer({ port })
  clients = new Map<string, ClientContext>()

  wss.on('connection', (socket) => {
    const clientId = randomUUID()
    const ctx: ClientContext = {
      id: clientId,
      socket,
      stockSubscriptions: new Set(),
    }

    clients!.set(clientId, ctx)
    ensureIntervals()

    socket.send(
      serialize('notification', {
        type: 'info',
        title: 'Connected',
        message: 'WebSocket connection established',
        timestamp: new Date().toISOString(),
      })
    )

    socket.on('message', (message) => handleMessage(ctx, message))
    socket.on('close', () => handleClose(clientId))
    socket.on('error', (error) => {
      console.error('WebSocket client error', error)
      handleClose(clientId)
    })
  })

  wss.on('error', (error) => {
    console.error('WebSocket server error', error)
  })

  console.log(`[realtime] WebSocket server listening on ws://localhost:${port}`)

  return { wss, clients }
}

function getServer() {
  // In production/serverless, don't auto-start
  if (process.env.NODE_ENV !== 'development') {
    return { wss: null, clients: new Map() }
  }
  if (!wss || !clients) {
    return startServer()
  }
  return { wss, clients }
}

export function broadcast(type: BroadcastType, payload: unknown) {
  // Skip broadcasting in serverless environments
  if (process.env.NODE_ENV !== 'development') return
  
  const { clients } = getServer()
  const message = serialize(type, payload)
  for (const ctx of clients.values()) {
    if (ctx.socket.readyState === WebSocket.OPEN) {
      ctx.socket.send(message)
    }
  }
}

export async function broadcastPriceUpdate(stockCode: string) {
  // Skip in serverless environments
  if (process.env.NODE_ENV !== 'development') return
  
  const { clients } = getServer()
  const company = await prisma.company.findUnique({
    where: { stockCode },
    include: {
      prices: {
        where: { isActive: true },
        orderBy: { dayNumber: 'desc' },
        take: 1,
      },
    },
  })

  if (!company || company.prices.length === 0) return

  const latest = company.prices[0]
  const payload = {
    stockCode: company.stockCode,
    price: Number(latest.price),
    timestamp: new Date().toISOString(),
  }

  const message = serialize('price_update', payload)

  for (const ctx of clients.values()) {
    if (ctx.socket.readyState !== WebSocket.OPEN) continue
    if (ctx.stockSubscriptions.size === 0 || ctx.stockSubscriptions.has(stockCode)) {
      ctx.socket.send(message)
    }
  }
}

export function broadcastDayChanged(currentDay: number) {
  broadcast('day_changed', {
    currentDay,
    timestamp: new Date().toISOString(),
  })
  broadcast('market_bell', {
    type: 'open',
    timestamp: new Date().toISOString(),
  })
}

export function broadcastTransactionStatus(params: {
  userId: string
  status: 'pending' | 'completed' | 'failed'
  message: string
}) {
  broadcast('transaction_status', {
    id: params.userId,
    status: params.status,
    message: params.message,
    timestamp: new Date().toISOString(),
  })
}

export function broadcastNotification(notification: {
  type: 'success' | 'info' | 'warning' | 'error'
  title: string
  message: string
}) {
  broadcast('notification', {
    ...notification,
    timestamp: new Date().toISOString(),
  })
}

export function ensureRealtimeServer() {
  // Only start in development mode, not in serverless environments like Vercel
  if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
    try {
      getServer()
    } catch (error) {
      console.error('Failed to start realtime server', error)
    }
  }
}

// Don't auto-start on module import - causes issues in serverless environments
// The server should only be started explicitly when needed
