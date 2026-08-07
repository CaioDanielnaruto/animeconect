import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SafetyCenter({ user, onClose }) {
  const [profiles, setProfiles] = useState([])
  const [blocked, setBlocked] = useState([])
  const [selected, setSelected] = useState(null)
  const [reason, setReason] = useState('')
  const [reports, setReports] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [notice, setNotice] = useState('')
  const load = async () => {
    const [people, blocks, role] = await Promise.all([
      supabase.from('profiles').select('id,username,display_name,avatar_url').neq('id',user.id).limit(100),
      supabase.from('user_blocks').select('blocked_id').eq('blocker_id',user.id),
      supabase.from('user_roles').select('role').eq('user_id',user.id).maybeSingle(),
    ])
    setProfiles(people.data || []); setBlocked((blocks.data || []).map((item) => item.blocked_id))
    const admin = role.data?.role === 'admin'; setIsAdmin(admin)
    if (admin) { const result = await supabase.from('user_reports').select('*,reporter:reporter_id(display_name,username),reported:reported_user_id(display_name,username)').order('created_at',{ascending:false}).limit(100); setReports(result.data || []) }
  }
  useEffect(() => { load() }, [])
  const toggleBlock = async (person) => {
    const active = blocked.includes(person.id)
    const { error } = active ? await supabase.from('user_blocks').delete().eq('blocker_id',user.id).eq('blocked_id',person.id) : await supabase.from('user_blocks').insert({ blocker_id:user.id,blocked_id:person.id })
    if (error) return setNotice(error.message); setNotice(active ? 'Usuário desbloqueado.' : 'Usuário bloqueado. Novas conversas diretas foram impedidas.'); load()
  }
  const report = async (event) => {
    event.preventDefault(); if (!selected || reason.trim().length<10) return setNotice('Descreva o problema com pelo menos 10 caracteres.')
    const { error } = await supabase.from('user_reports').insert({ reporter_id:user.id,reported_user_id:selected.id,target_type:'user',target_id:selected.id,reason:reason.trim() })
    if (error) return setNotice(error.message); setReason(''); setSelected(null); setNotice('Denúncia enviada com segurança para análise.')
  }
  const review = async (reportId,status) => { const { error } = await supabase.from('user_reports').update({ status,reviewed_at:new Date().toISOString() }).eq('id',reportId); if (error) return setNotice(error.message); await supabase.rpc('log_admin_action',{action_name:`report_${status}`,target_kind:'report',target_value:reportId,extra:{}}); load() }
  return <div className="safety-backdrop"><section className="safety-window"><header><div><span className="kicker">PRIVACIDADE E PROTEÇÃO</span><h2>Central de segurança</h2></div><button onClick={onClose}>×</button></header>{notice && <p className="safety-notice">{notice}</p>}<div className="safety-content"><section><h3>Bloquear ou denunciar</h3><p>Bloquear impede novas conversas diretas. Denúncias são privadas e analisadas pela moderação.</p><div className="safety-people">{profiles.map((person) => <article key={person.id}><div><strong>{person.display_name}</strong><small>@{person.username}</small></div><button onClick={() => toggleBlock(person)}>{blocked.includes(person.id) ? 'Desbloquear' : 'Bloquear'}</button><button onClick={() => setSelected(person)}>Denunciar</button></article>)}</div>{selected && <form onSubmit={report}><h3>Denunciar @{selected.username}</h3><textarea maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explique o ocorrido sem incluir senhas ou dados bancários."/><div><button type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="primary">Enviar denúncia</button></div></form>}</section>{isAdmin && <section className="report-queue"><h3>Fila administrativa</h3><p>Use somente os dados necessários à análise. Conversas privadas não são exibidas.</p>{reports.map((item) => <article key={item.id}><strong>{item.reported?.display_name || 'Conteúdo removido'}</strong><span>{item.reason}</span><small>Enviado por @{item.reporter?.username} · {item.status}</small>{item.status === 'open' && <div><button onClick={() => review(item.id,'reviewing')}>Analisar</button><button onClick={() => review(item.id,'resolved')}>Resolver</button><button onClick={() => review(item.id,'dismissed')}>Descartar</button></div>}</article>)}</section>}</div></section></div>
}
