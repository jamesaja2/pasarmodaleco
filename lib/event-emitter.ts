export class EventEmitter {
  private listeners: Map<string, Set<Function>> = new Map()

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  once(event: string, callback: Function): () => void {
    const unsubscribe = this.on(event, (...args: any[]) => {
      callback(...args)
      unsubscribe()
    })
    return unsubscribe
  }

  off(event: string, callback?: Function): void {
    if (!callback) {
      this.listeners.delete(event)
    } else {
      this.listeners.get(event)?.delete(callback)
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(...args))
    }
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }
}

// Create singleton
export const eventBus = new EventEmitter()
