import { useEffect,useState } from 'react'
import './RoleGate.css'
import PlatformContrastBase from './PlatformContrastBase'
import { isSupabaseConfigured,supabase } from './lib/supabase'

export default function Platform(){
  const [privileged,setPrivileged]=useState(false)
  useEffect(()=>{
    if(!isSupabaseConfigured)return undefined
    const check=async(session)=>{
      if(!session?.user){setPrivileged(false);return}
      const {data}=await supabase.from('user_roles').select('role').eq('user_id',session.user.id).maybeSingle()
      setPrivileged(['owner','admin'].includes(data?.role))
    }
    supabase.auth.getSession().then(({data})=>check(data.session))
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>setTimeout(()=>check(session),0))
    return()=>data.subscription.unsubscribe()
  },[])
  return <div className={privileged?'admin-session':'standard-session'}><PlatformContrastBase/></div>
}
