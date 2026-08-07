import { useEffect,useState } from 'react'
import './RoleGate.css'
import PlatformContrastBase from './PlatformContrastBase'
import { isSupabaseConfigured,supabase } from './lib/supabase'

export default function Platform(){
  const [isAdmin,setIsAdmin]=useState(false)
  useEffect(()=>{
    if(!isSupabaseConfigured)return undefined
    const check=async(session)=>{
      if(!session?.user){setIsAdmin(false);return}
      const {data}=await supabase.from('user_roles').select('role').eq('user_id',session.user.id).maybeSingle()
      setIsAdmin(data?.role==='admin')
    }
    supabase.auth.getSession().then(({data})=>check(data.session))
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>setTimeout(()=>check(session),0))
    return()=>data.subscription.unsubscribe()
  },[])
  return <div className={isAdmin?'admin-session':'standard-session'}><PlatformContrastBase/></div>
}
