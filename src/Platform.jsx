import { useEffect,useState } from 'react'
import './OwnerPanel.css'
import PlatformRoleGateBase from './PlatformRoleGateBase'
import OwnerPanel from './components/OwnerPanel'
import { isSupabaseConfigured,supabase } from './lib/supabase'

export default function Platform(){
  const [session,setSession]=useState(null)
  const [owner,setOwner]=useState(false)
  const [open,setOpen]=useState(false)
  const [quickMenuOpen,setQuickMenuOpen]=useState(false)
  const check=async(current)=>{
    if(!current?.user){setSession(null);setOwner(false);return}
    setSession(current)
    const {data}=await supabase.from('user_roles').select('role').eq('user_id',current.user.id).maybeSingle()
    setOwner(data?.role==='owner')
  }
  useEffect(()=>{
    if(!isSupabaseConfigured)return undefined
    supabase.auth.getSession().then(({data})=>check(data.session))
    const {data}=supabase.auth.onAuthStateChange((_event,value)=>setTimeout(()=>check(value),0))
    return()=>data.subscription.unsubscribe()
  },[])
  useEffect(()=>{
    document.documentElement.classList.toggle('quick-menu-open',quickMenuOpen)
    return()=>document.documentElement.classList.remove('quick-menu-open')
  },[quickMenuOpen])
  const openQuickAction=(selector)=>{
    setQuickMenuOpen(false)
    document.querySelector(selector)?.click()
  }
  return <>
    <PlatformRoleGateBase/>
    {session?.user&&<>
      {quickMenuOpen&&<button className="quick-menu-backdrop" aria-label="Fechar acessos rápidos" onClick={()=>setQuickMenuOpen(false)}/>}
      <section className="quick-menu-surface" aria-label="Acessos rápidos" aria-hidden={!quickMenuOpen}>
        <button className="quick-menu-item mfa" onClick={()=>openQuickAction('.mfa-fab')}>🔐 <span>MFA</span></button>
        <button className="quick-menu-item safety" onClick={()=>openQuickAction('.safety-fab')}>🛡 <span>Segurança</span></button>
        <button className="quick-menu-item messenger" onClick={()=>openQuickAction('.messenger-fab')}>💬 <span>Messenger</span></button>
        <button className="quick-menu-item social" onClick={()=>openQuickAction('.social-fab')}>✦ <span>Rede social</span></button>
        {owner&&<button className="quick-menu-item owner" onClick={()=>setOpen(true)}>👑 <span>Painel do Criador</span></button>}
      </section>
      <button className="quick-menu-toggle" aria-expanded={quickMenuOpen} aria-label={quickMenuOpen?'Fechar acessos rápidos':'Abrir acessos rápidos'} onClick={()=>setQuickMenuOpen(value=>!value)}>
        <span>{quickMenuOpen?'×':'☰'}</span> {quickMenuOpen?'Fechar':'Menu'}
      </button>
    </>}
    {owner&&<button className="owner-fab" onClick={()=>setOpen(true)}>👑 Painel do Criador</button>}
    {open&&owner&&<OwnerPanel onClose={()=>setOpen(false)}/>}
  </>
}
