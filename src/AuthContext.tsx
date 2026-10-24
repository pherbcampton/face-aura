import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type AuthValue = {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
  displayName: string
  avatarUrl: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const user = session?.user
    if (!supabase || !user) return
    const metadata = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string }
    void supabase.from('profiles').upsert({
      id: user.id,
      display_name: metadata.full_name || metadata.name || user.email?.split('@')[0] || 'Face Aura member',
      avatar_url: metadata.avatar_url || metadata.picture || null,
      updated_at: new Date().toISOString(),
    })
  }, [session?.user?.id])

  const value = useMemo<AuthValue>(() => {
    const metadata = session?.user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string } | undefined
    return {
      user: session?.user ?? null,
      session,
      loading,
      configured: isSupabaseConfigured,
      displayName: metadata?.full_name || metadata?.name || session?.user.email?.split('@')[0] || 'Member',
      avatarUrl: metadata?.avatar_url || metadata?.picture || null,
      signInWithGoogle: async () => {
        if (!supabase) throw new Error('Supabase is not configured yet.')
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        })
        if (error) throw error
      },
      signOut: async () => {
        if (!supabase) return
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
    }
  }, [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
