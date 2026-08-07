import { useEffect,useState } from 'react'
import './MfaSetup.css'
import PlatformSafetyBase from './PlatformSafetyBase'
import MfaSetup from './components/MfaSetup'
import { isSupabaseConfigured,supabase } from './lib/supabase'

export default function Platform(){
  const [session,setSession]=useState(null)
  const [open,setOpen]=useState(false)
  const [required,setRequired]=useState(false)
  const checkMfa=async(currentSession)=>{
    if(!currentSession){setRequired(false);return}
    const [levels,roles]=await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(),supabase.from('user_roles').select('role').eq('user_id',currentSession.user.id).maybeSingle()])
    const privileged=['owner','admin'].includes(roles.data?.role)
    setRequired(privileged&&levels.data?.nextLevel==='aal2'&&levels.data?.currentLevel!=='aal2')
  }
  useEffect(()=>{
    if(!isSupabaseConfigured)return undefined
    supabase.auth.getSession().then(({data})=>{setSession(data.session);checkMfa(data.session)})
    const {data}=supabase.auth.onAuthStateChange((_event,value)=>{setSession(value);setTimeout(()=>checkMfa(value),0)})
    return()=>data.subscription.unsubscribe()
  },[])
  return <><PlatformSafetyBase/>{session?.user&&<button className="mfa-fab" onClick={()=>setOpen(true)}>🔐 MFA</button>}{(open||required)&&session?.user&&<MfaSetup required={required} onClose={()=>setOpen(false)} onVerified={()=>setRequired(false)}/>}</>
}
