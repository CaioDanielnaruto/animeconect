import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'

async function hashEmail(email){
  const data=new TextEncoder().encode(email.trim().toLowerCase())
  const digest=await crypto.subtle.digest('SHA-256',data)
  return [...new Uint8Array(digest)].map((value)=>value.toString(16).padStart(2,'0')).join('')
}

export default function OwnerPanel({onClose}){
  const [accounts,setAccounts]=useState([])
  const [roles,setRoles]=useState({})
  const [email,setEmail]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const load=async()=>{
    const [accountsResult,rolesResult]=await Promise.all([
      supabase.from('authorized_accounts').select('*').order('created_at'),
      supabase.from('user_roles').select('user_id,role,moderator_alias'),
    ])
    if(accountsResult.error)return setNotice(accountsResult.error.message)
    setAccounts(accountsResult.data||[])
    setRoles(Object.fromEntries((rolesResult.data||[]).map((item)=>[item.user_id,item])))
  }
  useEffect(()=>{load()},[])
  const authorize=async(event)=>{
    event.preventDefault();setBusy(true);setNotice('')
    const normalized=email.trim().toLowerCase()
    const accountHash=await hashEmail(normalized)
    const {error}=await supabase.rpc('owner_authorize_account',{account_hash:accountHash,account_label:normalized})
    setBusy(false);if(error)return setNotice(error.message)
    setEmail('');setNotice('Gmail autorizado. A pessoa já pode criar ou acessar a conta.');load()
  }
  const setRole=async(account,role)=>{
    setBusy(true);const {error}=await supabase.rpc('owner_set_account_role',{account_hash:account.email_hash,new_role:role});setBusy(false)
    if(error)return setNotice(error.message);setNotice(role==='suspended'?'Funções administrativas suspensas.':'Permissão atualizada.');load()
  }
  const setActive=async(account,active)=>{
    setBusy(true);const {error}=await supabase.rpc('owner_set_account_active',{account_hash:account.email_hash,is_active:active});setBusy(false)
    if(error)return setNotice(error.message);setNotice(active?'Conta reativada.':'Conta suspensa e acesso revogado.');load()
  }
  return <div className="owner-backdrop"><section className="owner-window"><header><div><span className="kicker">CONTA DO CRIADOR</span><h2>Autorizações e administradores</h2></div><button onClick={onClose}>×</button></header><div className="owner-protection"><strong>👑 Caio_Dan_kido — Criador</strong><p>Sua conta não pode ser suspensa, rebaixada ou excluída por administradores delegados.</p></div>{notice&&<div className="owner-notice">{notice}</div>}<form className="owner-invite" onSubmit={authorize}><label>Autorizar um Gmail<input required type="email" pattern=".+@gmail\.com" value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="pessoa@gmail.com"/></label><button className="primary" disabled={busy}>{busy?'Salvando...':'Autorizar Gmail'}</button></form><div className="owner-list"><h3>Contas autorizadas</h3>{accounts.map((account)=>{const role=roles[account.user_id]?.role;const owner=role==='owner';return <article key={account.email_hash} className={account.active?'':'suspended'}><div><strong>{account.label}</strong><small>{owner?'Criador imutável':account.user_id?'Conta cadastrada':'Aguardando cadastro'} · {account.active?'ativa':'suspensa'}</small></div><span className={`role-badge ${role||'user'}`}>{role==='owner'?'Criador':role==='admin'?'Administrador':role==='moderator'?'Moderador':role==='suspended'?'Suspenso':'Usuário'}</span>{!owner&&<div className="owner-actions"><button disabled={busy||!account.user_id} onClick={()=>setRole(account,'admin')}>Tornar ADM</button><button disabled={busy||!account.user_id} onClick={()=>setRole(account,'moderator')}>Moderador</button><button disabled={busy} onClick={()=>setActive(account,!account.active)}>{account.active?'Suspender':'Reativar'}</button></div>}</article>})}</div></section></div>
}
