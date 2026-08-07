import { useEffect,useState } from 'react'
import './OwnerPanel.css'
import PlatformRoleGateBase from './PlatformRoleGateBase'
import OwnerPanel from './components/OwnerPanel'
import { isSupabaseConfigured,supabase } from './lib/supabase'

export default function Platform(){
  const [session,setSession]=useState(null)
  const [owner,setOwner]=useState(false)
  const [authorized,setAuthorized]=useState(true)
  const [open,setOpen]=useState(false)
  const check=async(current)=>{
    if(!current?.user){setSession(null);setOwner(false);setAuthorized(true);return}
    setSession(current)
    const [roleResult,accessResult]=await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id',current.user.id).maybeSingle(),
      supabase.rpc('has_active_access'),
    ])
    setOwner(roleResult.data?.role==='owner');setAuthorized(accessResult.data!==false)
  }
  useEffect(()=>{
    if(!isSupabaseConfigured)return undefined
    supabase.auth.getSession().then(({data})=>check(data.session))
    const {data}=supabase.auth.onAuthStateChange((_event,value)=>setTimeout(()=>check(value),0))
    return()=>data.subscription.unsubscribe()
  },[])
  if(session&&!authorized)return <main className="access-denied"><section><span>🔒</span><h1>Acesso não autorizado</h1><p>Este Gmail não está na lista aprovada pelo Criador do AnimeConect.</p><button className="primary" onClick={()=>supabase.auth.signOut()}>Sair da conta</button></section></main>
  return <><PlatformRoleGateBase/>{owner&&<button className="owner-fab" onClick={()=>setOpen(true)}>👑 Painel do Criador</button>}{open&&owner&&<OwnerPanel onClose={()=>setOpen(false)}/>}</>
}
