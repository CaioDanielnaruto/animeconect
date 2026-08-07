import { useEffect, useState } from 'react'
import './SafetyCenter.css'
import PlatformMessengerBase from './PlatformMessengerBase'
import SafetyCenter from './components/SafetyCenter'
import { isSupabaseConfigured, supabase } from './lib/supabase'

export default function Platform() {
  const [session,setSession] = useState(null)
  const [open,setOpen] = useState(false)
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    supabase.auth.getSession().then(({data}) => setSession(data.session))
    const {data}=supabase.auth.onAuthStateChange((_event,value) => setSession(value))
    return () => data.subscription.unsubscribe()
  },[])
  return <><PlatformMessengerBase/>{session?.user && <button className="safety-fab" onClick={() => setOpen(true)}>🛡 Segurança</button>}{open && session?.user && <SafetyCenter user={session.user} onClose={() => setOpen(false)}/>}</>
}
