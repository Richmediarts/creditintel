'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@/types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const lastAuthEvent = useRef(0)

  const checkAuth = useCallback(async () => {
    const startedAt = Date.now()
    try {
      const res = await fetch('/api/auth/me')
      if (startedAt < lastAuthEvent.current) return
      if (res.ok) {
        const data = await res.json()
        if (startedAt > lastAuthEvent.current) setUser(data.user)
      } else {
        if (startedAt > lastAuthEvent.current) setUser(null)
      }
    } catch {
      if (startedAt > lastAuthEvent.current) setUser(null)
    } finally {
      if (startedAt > lastAuthEvent.current) setLoading(false)
    }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) return data.error || 'Login failed'
    lastAuthEvent.current = Date.now()
    setUser(data.user)
    return null
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    lastAuthEvent.current = Date.now()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
