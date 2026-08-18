import { useEffect, useState } from 'react'
import './SocialHub.css'
import CorePlatform from './CorePlatform'
import SocialHub from './SocialHub'
import { isSupabaseConfigured, supabase } from './lib/supabase'

export default function Platform() {
  const [social, setSocial] = useState(location.hash === '#rede')
  const [session, setSession] = useState(null)
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, value) => setSession(value))
    return () => data.subscription.unsubscribe()
  }, [])
  const openSocial = () => { if (!session?.user) return; location.hash = 'rede'; setSocial(true) }
  const closeSocial = () => { history.replaceState(null, '', location.pathname); setSocial(false) }
  if (social && session?.user) return <SocialHub user={session.user} onBack={closeSocial}/>
  return <><CorePlatform/>{session?.user && <button className="social-fab" onClick={openSocial}>✦ Abrir rede social</button>}</>
}
