import { useEffect, useState } from 'react'
import './Messenger.css'
import PlatformBase from './PlatformBase'
import SecureMessenger from './components/SecureMessenger'
import { isSupabaseConfigured, supabase } from './lib/supabase'

export default function Platform() {
  const [session, setSession] = useState(null)
  const [messenger, setMessenger] = useState(false)
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event,value) => setSession(value))
    return () => data.subscription.unsubscribe()
  }, [])
  return <><PlatformBase/>{session?.user && <button className="messenger-fab" onClick={() => setMessenger(true)}>💬 Messenger</button>}{messenger && session?.user && <SecureMessenger user={session.user} onClose={() => setMessenger(false)}/>}</>
}
