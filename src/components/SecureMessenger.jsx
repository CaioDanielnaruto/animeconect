import { useEffect, useState } from 'react'
import CallRoom from './CallRoom'
import { supabase } from '../lib/supabase'

export default function SecureMessenger({ user, onClose }) {
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [activeRooms, setActiveRooms] = useState([])
  const [call, setCall] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [alias, setAlias] = useState('Caio_Dan_kido')
  const [audit, setAudit] = useState([])
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const load = async () => {
      const [participating, organized, role] = await Promise.all([
        supabase.from('event_participants').select('events:event_id(id,title,starts_at,status)').eq('user_id', user.id),
        supabase.from('events').select('id,title,starts_at,status').eq('organizer_id', user.id),
        supabase.from('user_roles').select('role,moderator_alias').eq('user_id', user.id).maybeSingle(),
      ])
      const merged = [...(participating.data || []).map((item) => item.events), ...(organized.data || [])].filter(Boolean)
      setEvents([...new Map(merged.map((item) => [item.id,item])).values()]); if (role.data) { setAdmin(role.data); setAlias(role.data.moderator_alias); loadAudit() }
    }
    load()
  }, [user.id])
  const loadAudit = async () => { const { data } = await supabase.from('moderation_audit').select('*').order('created_at', { ascending: false }).limit(30); setAudit(data || []) }
  useEffect(() => {
    if (!selected) return undefined
    const load = async () => {
      const [chat, rooms] = await Promise.all([
        supabase.from('event_messages').select('*,profiles:sender_id(display_name,username,avatar_url)').eq('event_id', selected.id).order('created_at').limit(200),
        supabase.from('call_rooms').select('*').eq('event_id', selected.id).eq('status', 'active').order('created_at', { ascending: false }),
      ])
      setMessages(chat.data || []); setActiveRooms(rooms.data || [])
    }
    load()
    const channel = supabase.channel(`event-messenger-${selected.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_messages', filter: `event_id=eq.${selected.id}` }, ({ new: item }) => setMessages((items) => [...items,item])).on('postgres_changes', { event: '*', schema: 'public', table: 'call_rooms', filter: `event_id=eq.${selected.id}` }, () => load()).subscribe()
    return () => supabase.removeChannel(channel)
  }, [selected])
  const send = async (event) => { event.preventDefault(); if (!text.trim()) return; const { error } = await supabase.from('event_messages').insert({ event_id: selected.id, sender_id: user.id, content: text.trim() }); if (error) return setNotice(error.message); setText('') }
  const startCall = async (mediaType) => {
    const roomResult = await supabase.from('call_rooms').insert({ event_id: selected.id, created_by: user.id, media_type: mediaType }).select().single()
    if (roomResult.error) return setNotice(roomResult.error.message)
    await joinCall(roomResult.data)
  }
  const joinCall = async (room) => { const { error } = await supabase.from('call_participants').upsert({ room_id: room.id, user_id: user.id, left_at: null }); if (error) return setNotice(error.message); setCall(room) }
  const saveAlias = async (event) => { event.preventDefault(); const { error } = await supabase.from('user_roles').update({ moderator_alias: alias.trim() }).eq('user_id', user.id); if (error) return setNotice(error.message); await supabase.rpc('log_admin_action', { action_name: 'update_alias', target_kind: 'administrator', target_value: user.id, extra: { alias: alias.trim() } }); setNotice('Pseudônimo administrativo atualizado.'); loadAudit() }

  return <><div className="messenger-backdrop"><section className="messenger-window"><header><div><span className="kicker">MENSAGENS SEGURAS</span><h2>AnimeConect Messenger</h2></div><button onClick={onClose}>×</button></header><div className="messenger-body"><aside><h3>Grupos de eventos</h3>{events.map((item) => <button className={selected?.id === item.id ? 'active' : ''} key={item.id} onClick={() => setSelected(item)}><strong>{item.title}</strong><small>{new Date(item.starts_at).toLocaleDateString('pt-BR')}</small></button>)}{!events.length && <p>Participe de um evento para acessar o grupo.</p>}{admin?.role === 'admin' && <button className={selected?.id === 'admin' ? 'active admin-room' : 'admin-room'} onClick={() => setSelected({ id: 'admin', title: 'Monitoramento administrativo' })}>🛡 {admin.moderator_alias}</button>}</aside><main>{selected?.id === 'admin' ? <div className="admin-monitor"><h2>Identidade e auditoria</h2><p>O monitoramento mostra ações administrativas, não o conteúdo de conversas privadas.</p><form onSubmit={saveAlias}><label>Pseudônimo administrativo<input minLength="3" maxLength="40" value={alias} onChange={(event) => setAlias(event.target.value)}/></label><button className="primary">Salvar pseudônimo</button></form><h3>Trilha de auditoria</h3>{audit.map((item) => <article key={item.id}><strong>{item.actor_alias}</strong> · {item.action}<small>{new Date(item.created_at).toLocaleString('pt-BR')}</small></article>)}</div> : selected ? <><div className="messenger-title"><div><h2>{selected.title}</h2><small>Somente organizadores e participantes</small></div><div><button onClick={() => startCall('audio')}>☎ Áudio</button><button onClick={() => startCall('video')}>▣ Vídeo</button></div></div>{activeRooms.map((room) => <button className="active-call" key={room.id} onClick={() => joinCall(room)}>● Chamada {room.media_type === 'video' ? 'de vídeo' : 'de áudio'} em andamento — entrar</button>)}<div className="event-chat">{messages.map((item) => <div className={item.sender_id === user.id ? 'bubble mine' : 'bubble'} key={item.id}><strong>{item.profiles?.display_name || (item.sender_id === user.id ? 'Você' : 'Participante')}</strong><p>{item.content}</p><small>{new Date(item.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></div>)}</div><form className="messenger-form" onSubmit={send}><input maxLength="2000" value={text} onChange={(event) => setText(event.target.value)} placeholder="Mensagem para o grupo..."/><button className="primary">Enviar</button></form></> : <div className="empty-state">Selecione um grupo de evento.</div>}</main></div>{notice && <div className="messenger-notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}</section></div>{call && <CallRoom room={call} user={user} onLeave={() => setCall(null)}/>}</>
}
