import { useEffect, useState } from 'react'
import { friendlyError } from './lib/formatters'
import { supabase } from './lib/supabase'

const tabs = [['feed','Feed'],['friends','Amizades'],['chat','Chat'],['notifications','Notificações'],['admin','Admin']]

export default function SocialHub({ user, onBack }) {
  const [tab, setTab] = useState('feed')
  const [posts, setPosts] = useState([])
  const [liked, setLiked] = useState([])
  const [postText, setPostText] = useState('')
  const [profiles, setProfiles] = useState([])
  const [friendships, setFriendships] = useState([])
  const [conversations, setConversations] = useState([])
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [notifications, setNotifications] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [stats, setStats] = useState({ users: 0, posts: 0, events: 0 })
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const showError = (error) => error && setNotice({ type: 'error', text: friendlyError(error.message) })

  const loadPosts = async () => {
    const [{ data, error }, likes] = await Promise.all([
      supabase.from('post_details').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('post_likes').select('post_id').eq('user_id', user.id),
    ])
    showError(error || likes.error); setPosts(data || []); setLiked((likes.data || []).map((item) => item.post_id))
  }
  const loadFriends = async () => {
    const [people, relations] = await Promise.all([
      supabase.from('profiles').select('id,username,display_name,avatar_url,city,state').neq('id', user.id).limit(50),
      supabase.from('friendships').select('*').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    ])
    showError(people.error || relations.error); setProfiles(people.data || []); setFriendships(relations.data || [])
  }
  const loadConversations = async () => {
    const memberships = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user.id)
    if (memberships.error) return showError(memberships.error)
    const ids = (memberships.data || []).map((item) => item.conversation_id)
    if (!ids.length) return setConversations([])
    const result = await supabase.from('conversation_members').select('conversation_id,user_id,profiles(display_name,username,avatar_url)').in('conversation_id', ids).neq('user_id', user.id)
    showError(result.error); setConversations(result.data || [])
  }
  const loadNotifications = async () => {
    const result = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    showError(result.error); setNotifications(result.data || [])
  }
  const loadAdmin = async () => {
    const role = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    const admin = role.data?.role === 'admin'; setIsAdmin(admin)
    if (!admin) return
    const [users, postCount, events] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
    ])
    setStats({ users: users.count || 0, posts: postCount.count || 0, events: events.count || 0 })
  }

  useEffect(() => { loadPosts(); loadFriends(); loadConversations(); loadNotifications(); loadAdmin() }, [])
  useEffect(() => {
    if (!conversation) return undefined
    supabase.from('messages').select('*,profiles:sender_id(display_name,username)').eq('conversation_id', conversation).order('created_at').then(({ data, error }) => { showError(error); setMessages(data || []) })
    const channel = supabase.channel(`chat-${conversation}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation}` }, (payload) => setMessages((items) => [...items, payload.new])).subscribe()
    return () => supabase.removeChannel(channel)
  }, [conversation])

  const createPost = async (event) => {
    event.preventDefault(); if (!postText.trim()) return
    setBusy(true); const { error } = await supabase.from('posts').insert({ author_id: user.id, content: postText.trim() }); setBusy(false)
    if (error) return showError(error); setPostText(''); loadPosts()
  }
  const toggleLike = async (post) => {
    const active = liked.includes(post.id)
    const { error } = active ? await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id) : await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
    if (error) return showError(error); loadPosts()
  }
  const friendshipWith = (id) => friendships.find((item) => [item.requester_id,item.addressee_id].includes(id))
  const requestFriend = async (id) => { const { error } = await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: id }); if (error) return showError(error); loadFriends() }
  const acceptFriend = async (relation) => { const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('requester_id', relation.requester_id).eq('addressee_id', user.id); if (error) return showError(error); loadFriends() }
  const openChat = async (otherUser) => { const { data, error } = await supabase.rpc('create_direct_conversation', { other_user: otherUser }); if (error) return showError(error); setConversation(data); setTab('chat'); loadConversations() }
  const sendMessage = async (event) => { event.preventDefault(); if (!message.trim() || !conversation) return; const { error } = await supabase.from('messages').insert({ conversation_id: conversation, sender_id: user.id, content: message.trim() }); if (error) return showError(error); setMessage('') }
  const readAll = async () => { const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null); if (error) return showError(error); loadNotifications() }
  const removePost = async (id) => { const { error } = await supabase.from('posts').delete().eq('id', id); if (error) return showError(error); loadPosts(); loadAdmin() }

  return <main className="social-page">
    <header className="social-header shell"><button className="secondary" onClick={onBack}>← Voltar ao início</button><div className="brand"><span className="brand-mark">A</span><span>ANIME<span>CONECT</span></span></div><span className="user-chip">Rede de fãs</span></header>
    <div className="social-layout shell"><aside className="social-tabs">{tabs.map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}{id === 'notifications' && notifications.some((item) => !item.read_at) ? ' ●' : ''}</button>)}</aside>
      <section className="social-content">
        {tab === 'feed' && <><div className="panel"><span className="kicker">COMUNIDADE</span><h1 className="page-title">Feed</h1><form className="composer" onSubmit={createPost}><textarea maxLength="2000" value={postText} onChange={(event) => setPostText(event.target.value)} placeholder="Compartilhe uma teoria, indicação ou momento otaku..."/><button className="primary" disabled={busy}>Publicar</button></form></div><div className="post-list">{posts.map((post) => <article className="panel post" key={post.id}><div className="post-author"><div className="avatar">{post.avatar_url ? <img src={post.avatar_url} alt=""/> : (post.display_name || 'A')[0]}</div><div><strong>{post.display_name}</strong><small>@{post.username} · {new Date(post.created_at).toLocaleDateString('pt-BR')}</small></div>{(post.author_id === user.id || isAdmin) && <button className="danger-link" onClick={() => removePost(post.id)}>Excluir</button>}</div><p>{post.content}</p>{post.image_url && <img className="post-image" src={post.image_url} alt="Conteúdo da publicação"/>}<button className={liked.includes(post.id) ? 'like active' : 'like'} onClick={() => toggleLike(post)}>♥ {post.like_count || 0}</button></article>)}</div></>}
        {tab === 'friends' && <><div className="panel"><span className="kicker">NAKAMAS</span><h1 className="page-title">Pessoas</h1></div><div className="people-grid">{profiles.map((person) => { const relation = friendshipWith(person.id); const incoming = relation?.status === 'pending' && relation.addressee_id === user.id; return <article className="panel person" key={person.id}><div className="avatar large">{person.avatar_url ? <img src={person.avatar_url} alt=""/> : (person.display_name || 'A')[0]}</div><h3>{person.display_name}</h3><p>@{person.username}{person.city ? ` · ${person.city}/${person.state}` : ''}</p>{!relation && <button className="primary small" onClick={() => requestFriend(person.id)}>Adicionar</button>}{incoming && <button className="primary small" onClick={() => acceptFriend(relation)}>Aceitar amizade</button>}{relation?.status === 'pending' && !incoming && <span className="status-chip">Pedido enviado</span>}{relation?.status === 'accepted' && <button className="secondary" onClick={() => openChat(person.id)}>Conversar</button>}</article> })}</div></>}
        {tab === 'chat' && <div className="chat-layout"><aside className="panel conversation-list"><h2>Conversas</h2>{conversations.map((item) => <button className={conversation === item.conversation_id ? 'active' : ''} key={item.conversation_id} onClick={() => setConversation(item.conversation_id)}>{item.profiles?.display_name || item.profiles?.username}</button>)}</aside><div className="panel chat-box">{conversation ? <><div className="messages">{messages.map((item) => <div className={item.sender_id === user.id ? 'message mine' : 'message'} key={item.id}><strong>{item.profiles?.display_name || (item.sender_id === user.id ? 'Você' : 'Nakama')}</strong><p>{item.content}</p></div>)}</div><form className="message-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva uma mensagem..."/><button className="primary">Enviar</button></form></> : <div className="empty-state">Escolha um amigo e inicie uma conversa.</div>}</div></div>}
        {tab === 'notifications' && <><div className="panel title-row"><div><span className="kicker">ATUALIZAÇÕES</span><h1 className="page-title">Notificações</h1></div><button className="secondary" onClick={readAll}>Marcar como lidas</button></div>{notifications.map((item) => <article className={`panel notification ${item.read_at ? '' : 'unread'}`} key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString('pt-BR')}</small></article>)}</>}
        {tab === 'admin' && <>{isAdmin ? <><div className="panel"><span className="kicker">ADMINISTRAÇÃO</span><h1 className="page-title">Visão geral</h1><div className="admin-stats"><div><strong>{stats.users}</strong><span>usuários</span></div><div><strong>{stats.posts}</strong><span>posts</span></div><div><strong>{stats.events}</strong><span>eventos</span></div></div></div><div className="panel"><h2>Moderação recente</h2><p>Use o botão “Excluir” no feed para remover publicações que violem as regras.</p></div></> : <div className="panel empty-state">Esta área é exclusiva para administradores.</div>}</>}
      </section>
    </div>{notice && <div className={`toast ${notice.type}`}><span>{notice.text}</span><button onClick={() => setNotice(null)}>×</button></div>}
  </main>
}
