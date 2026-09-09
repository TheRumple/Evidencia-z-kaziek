import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const AUTH_TIMEOUT_MS = 7000

export async function getSessionWithTimeout(timeoutMs = AUTH_TIMEOUT_MS): Promise<Session | null> {
  const timeout = new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), timeoutMs)
  })

  const session = supabase.auth
    .getSession()
    .then(({ data }) => data.session)
    .catch(() => null)

  return Promise.race([session, timeout])
}

export async function signInWithTimeout(email: string, password: string, timeoutMs = AUTH_TIMEOUT_MS) {
  const timeout = new Promise<{ error: Error }>((resolve) => {
    window.setTimeout(() => resolve({ error: new Error('Prihlasovanie trvá príliš dlho. Skús obnoviť stránku alebo počkaj, kým Supabase odpovie.') }), timeoutMs)
  })

  const signIn = supabase.auth.signInWithPassword({ email, password }).catch((error) => ({ error }))

  return Promise.race([signIn, timeout])
}
