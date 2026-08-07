import { useEffect, useMemo, useState } from 'react'
import './App.css'
import './Platform.css'
import EventCard from './components/EventCard'
import Modal from './components/Modal'
import { dateTimeFormatter, friendlyError, numberFormatter, slugify } from './lib/formatters'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const demoEvents = [
  { id: 'demo-1', starts_at: '2026-08-18T18:00:00-03:00', title: 'Neo Anime Festival', city: 'São Paulo', state: 'SP', category: 'Festival', description: 'Anime, música, artistas e cosplay.', tone: 'cyan' },
  { id: 'demo-2', starts_at: '2026-09-07T14:00:00-03:00', title: 'Cosplay Universe', city: 'Campinas', state: 'SP', category: 'Cosplay', description: 'Concurso, oficinas e encontro de criadores.', tone: 'purple' },
  { id: 'demo-3', starts_at: '2026-09-21T12:00:00-03:00', title: 'Geek Matsuri', city: 'Rio de Janeiro', state: 'RJ', category: 'Cultura', description: 'Cultura japonesa, gastronomia e jogos.', tone: 'blue' },
]
const demoCommunities = [
  { id: '10000000-0000-0000-0000-000000000001', icon: '⚔️', name: 'Shonen Brasil', member_count: 24800, description: 'Teorias, lutas e lançamentos semanais.' },
  { id: '10000000-0000-0000-0000-000000000002', icon: '🌸', name: 'Cosplay Creators', member_count: 18200, description: 'Crie, compartilhe e evolua seu cosplay.' },
  { id: '10000000-0000-0000-0000-000000000003', icon: '🎮', name: 'Gamers Otaku', member_count: 31400, description: 'Do gacha ao competitivo, jogamos juntos.' },
]
const blankProfile = { username: '', display_name: '', avatar_url: '', bio: '', city: '', state: '', favorite_animes: [] }
const blankEvent = { title: '', description: '', category: 'Festival', cover_url: '', starts_at: '', ends_at: '', capacity: '', status: 'published', venue_name: '', address_line: '', city: '', state: '' }

export default function Platform() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState(null)
  const [auth, setAuth] = useState({ email: '', password: '', username: '', displayName: '' })
  const [profile, setProfile] = useState(blankProfile)
  const [profileForm, setProfileForm] = useState(blankProfile)
  const [events, setEvents] = useState(demoEvents)
  const [communities, setCommunities] = useState(demoCommunities)
  const [joined, setJoined] = useState([])
  const [participations, setParticipations] = useState({})
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventForm, setEventForm] = useState(blankEvent)
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todas')
  const user = session?.user
  const displayName = profile.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0]
  const notify = (type, text) => setNotice({ type, text })

  const requireUser = () => {
    if (user) return true
    notify('error', 'Entre na sua conta para continuar.')
    setAuthMode('login')
    return false
  }

  const loadPublic = async () => {
    if (!isSupabaseConfigured) return
    const [communitiesResult, eventsResult] = await Promise.all([
      supabase.from('communities').select('*').order('name'),
      supabase.from('event_details').select('*').eq('status', 'published').order('starts_at'),
    ])
    const error = communitiesResult.error || eventsResult.error
    if (error) notify('error', friendlyError(error.message))
    if (communitiesResult.data?.length) setCommunities(communitiesResult.data)
    if (eventsResult.data?.length) setEvents(eventsResult.data.map((item, index) => ({ ...item, tone: ['cyan', 'purple', 'blue'][index % 3] })))
  }

  const loadUser = async (currentUser) => {
    if (!currentUser) { setProfile(blankProfile); setJoined([]); setParticipations({}); return }
    const [profileResult, membershipsResult, participationResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle(),
      supabase.from('community_members').select('community_id').eq('user_id', currentUser.id),
      supabase.from('event_participants').select('event_id,status').eq('user_id', currentUser.id),
    ])
    if (profileResult.data) { setProfile(profileResult.data); setProfileForm(profileResult.data) }
    setJoined((membershipsResult.data || []).map((item) => item.community_id))
    setParticipations(Object.fromEntries((participationResult.data || []).map((item) => [item.event_id, item.status])))
  }

  useEffect(() => {
    if (!isSupabaseConfigured) { setAuthReady(true); notify('error', 'Modo demonstração: configure o .env para salvar dados.'); return undefined }
    supabase.auth.getSession().then(({ data, error }) => { if (error) notify('error', friendlyError(error.message)); setSession(data.session); setAuthReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthReady(true) })
    loadPublic()
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (isSupabaseConfigured) loadUser(user) }, [user])

  const categories = ['Todas', ...new Set(events.map((item) => item.category).filter(Boolean))]
  const filteredEvents = useMemo(() => events.filter((item) => `${item.title} ${item.city || ''} ${item.state || ''} ${item.category}`.toLowerCase().includes(query.toLowerCase()) && (category === 'Todas' || item.category === category)), [events, query, category])

  const submitAuth = async (event) => {
    event.preventDefault(); if (!isSupabaseConfigured) return
    setBusy(true)
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email: auth.email.trim(), password: auth.password, options: { data: { username: auth.username.trim(), display_name: auth.displayName.trim() } } })
      : await supabase.auth.signInWithPassword({ email: auth.email.trim(), password: auth.password })
    setBusy(false)
    if (result.error) return notify('error', friendlyError(result.error.message))
    const confirmation = authMode === 'signup' && !result.data.session
    notify('success', confirmation ? 'Conta criada! Confirme o e-mail para entrar.' : 'Acesso realizado com sucesso!')
    setAuth({ email: '', password: '', username: '', displayName: '' })
    if (!confirmation) setAuthMode(null)
  }

  const saveProfile = async (event) => {
    event.preventDefault(); if (!requireUser()) return
    const favorites = Array.isArray(profileForm.favorite_animes) ? profileForm.favorite_animes : profileForm.favorite_animes.split(',').map((item) => item.trim()).filter(Boolean)
    const payload = { ...profileForm, username: profileForm.username.trim().toLowerCase(), display_name: profileForm.display_name.trim(), state: profileForm.state?.toUpperCase() || null, favorite_animes: favorites }
    setBusy(true)
    const { data, error } = await supabase.from('profiles').update(payload).eq('id', user.id).select().single()
    setBusy(false)
    if (error) return notify('error', friendlyError(error.message))
    setProfile(data); setProfileForm(data); setModal(null); notify('success', 'Perfil atualizado!')
  }

  const toggleCommunity = async (community) => {
    if (!requireUser()) return
    const active = joined.includes(community.id); setBusy(true)
    const { error } = active ? await supabase.from('community_members').delete().eq('community_id', community.id).eq('user_id', user.id) : await supabase.from('community_members').insert({ community_id: community.id, user_id: user.id })
    setBusy(false); if (error) return notify('error', friendlyError(error.message))
    setJoined((items) => active ? items.filter((id) => id !== community.id) : [...items, community.id])
    setCommunities((items) => items.map((item) => item.id === community.id ? { ...item, member_count: Math.max(0, Number(item.member_count) + (active ? -1 : 1)) } : item))
    notify('success', active ? `Você saiu de ${community.name}.` : `Você entrou em ${community.name}!`)
  }

  const setParticipation = async (eventId, status) => {
    if (!requireUser() || String(eventId).startsWith('demo-')) return
    const current = participations[eventId]; setBusy(true)
    const { error } = current === status ? await supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_id', user.id) : await supabase.from('event_participants').upsert({ event_id: eventId, user_id: user.id, status })
    setBusy(false); if (error) return notify('error', friendlyError(error.message))
    setParticipations((items) => ({ ...items, [eventId]: current === status ? undefined : status }))
    notify('success', current === status ? 'Participação removida.' : status === 'going' ? 'Presença confirmada!' : 'Evento salvo como interessante.')
  }

  const saveEvent = async (event) => {
    event.preventDefault(); if (!requireUser()) return
    setBusy(true)
    let venueId = null
    if (eventForm.venue_name || eventForm.address_line || eventForm.city || eventForm.state) {
      if (!eventForm.venue_name || !eventForm.address_line || !eventForm.city || eventForm.state.length !== 2) { setBusy(false); return notify('error', 'Preencha nome, endereço, cidade e UF do local.') }
      const venueResult = await supabase.from('venues').insert({ name: eventForm.venue_name, address_line: eventForm.address_line, city: eventForm.city, state: eventForm.state.toUpperCase(), created_by: user.id }).select('id').single()
      if (venueResult.error) { setBusy(false); return notify('error', friendlyError(venueResult.error.message)) }
      venueId = venueResult.data.id
    }
    const payload = { organizer_id: user.id, venue_id: venueId, title: eventForm.title.trim(), slug: `${slugify(eventForm.title)}-${Date.now().toString(36)}`, description: eventForm.description.trim(), category: eventForm.category, cover_url: eventForm.cover_url || null, starts_at: new Date(eventForm.starts_at).toISOString(), ends_at: eventForm.ends_at ? new Date(eventForm.ends_at).toISOString() : null, capacity: eventForm.capacity ? Number(eventForm.capacity) : null, status: eventForm.status }
    const { error } = await supabase.from('events').insert(payload)
    setBusy(false); if (error) return notify('error', friendlyError(error.message))
    setEventForm(blankEvent); setModal(null); await loadPublic(); notify('success', payload.status === 'published' ? 'Evento publicado!' : 'Rascunho salvo!')
  }

  return <main>
    <nav className="nav shell"><a className="brand" href="#inicio"><span className="brand-mark">A</span><span>ANIME<span>CONECT</span></span></a><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">☰</button><div className={`nav-links ${menuOpen ? 'open' : ''}`}><a href="#eventos">Eventos</a><a href="#comunidades">Comunidades</a><a href="#sobre">Sobre</a>{authReady && user ? <><button className="login user-chip" onClick={() => setModal('profile')}>Olá, {displayName}</button><button className="primary small" onClick={() => setModal('create')}>Criar evento</button><button className="login" onClick={() => supabase.auth.signOut()}>Sair</button></> : <><button className="login" onClick={() => setAuthMode('login')}>Entrar</button><button className="primary small" onClick={() => setAuthMode('signup')}>Criar conta</button></>}</div></nav>
    <section className="hero-section" id="inicio"><div className="grid-glow"/><div className="hero-content shell"><div className="eyebrow"><span>●</span> O seu universo começa aqui</div><h1>Conecte-se com quem vive a mesma <em>paixão.</em></h1><p className="hero-copy">Descubra eventos, encontre sua tribo e compartilhe a cultura que você ama.</p><div className="hero-actions"><button className="primary" onClick={() => user ? document.querySelector('#eventos')?.scrollIntoView() : setAuthMode('signup')}>{user ? 'Explorar eventos' : 'Entrar para a comunidade'} →</button><a className="secondary" href="#comunidades">Ver comunidades</a></div></div><div className="orb orb-one"/><div className="orb orb-two"/></section>
    <section className="section shell" id="eventos"><div className="section-heading"><div><span className="kicker">AGENDA ANIMECONECT</span><h2>Encontre seu próximo evento</h2></div>{user && <button className="secondary" onClick={() => setModal('create')}>+ Criar evento</button>}</div><div className="filters"><input aria-label="Buscar eventos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar evento, cidade ou estado..."/><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>{events[0]?.id?.startsWith('demo-') && <p className="demo-note">Eventos de demonstração — publique o primeiro evento para substituir esta lista.</p>}<div className="event-grid">{filteredEvents.map((item) => <EventCard event={item} onOpen={(chosen) => { setSelectedEvent(chosen); setModal('event') }} key={item.id}/>)}</div>{!filteredEvents.length && <div className="empty-state">Nenhum evento encontrado.</div>}</section>
    <section className="communities" id="comunidades"><div className="shell"><div className="section-heading"><div><span className="kicker">ENCONTRE SUA TRIBO</span><h2>Comunidades populares</h2></div></div><div className="community-grid">{communities.map((item) => <article className="community-card" key={item.id}><div className="community-icon">{item.icon}</div><div className="community-text"><h3>{item.name}</h3><span>{numberFormatter.format(Number(item.member_count || 0))} membros</span><p>{item.description}</p></div><button disabled={busy} className={joined.includes(item.id) ? 'joined' : ''} onClick={() => toggleCommunity(item)}>{joined.includes(item.id) ? 'Participando ✓' : 'Participar'}</button></article>)}</div></div></section>
    <section className="cta shell" id="sobre"><span className="cta-symbol">愛</span><div><span className="kicker">FEITO PARA FÃS, POR FÃS</span><h2>Seu próximo nakama está a um clique.</h2><p>Personalize seu perfil, participe de eventos e encontre sua comunidade.</p></div><button className="primary" onClick={() => user ? setModal('profile') : setAuthMode('signup')}>{user ? 'Editar meu perfil →' : 'Criar meu perfil grátis →'}</button></section>
    <footer><div className="shell footer-inner"><div className="brand"><span className="brand-mark">A</span><span>ANIME<span>CONECT</span></span></div><p>© 2026 AnimeConect. Conectando universos.</p></div></footer>

    {authMode && <Modal title={authMode === 'signup' ? 'Crie sua conta' : 'Entre na comunidade'} onClose={() => setAuthMode(null)}><p>{authMode === 'signup' ? 'Monte seu perfil e encontre sua tribo.' : 'Que bom ter você de volta.'}</p><form onSubmit={submitAuth}>{authMode === 'signup' && <div className="form-row"><label>Nome de usuário<input required minLength="3" maxLength="30" value={auth.username} onChange={(event) => setAuth({ ...auth, username: event.target.value })}/></label><label>Nome exibido<input required minLength="2" maxLength="80" value={auth.displayName} onChange={(event) => setAuth({ ...auth, displayName: event.target.value })}/></label></div>}<label>E-mail<input required type="email" value={auth.email} onChange={(event) => setAuth({ ...auth, email: event.target.value })}/></label><label>Senha<input required type="password" minLength="6" value={auth.password} onChange={(event) => setAuth({ ...auth, password: event.target.value })}/></label><button className="primary auth-submit" disabled={busy}>{busy ? 'Aguarde...' : authMode === 'signup' ? 'Criar conta' : 'Entrar'}</button></form><button className="auth-switch" onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}>{authMode === 'signup' ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Criar agora'}</button></Modal>}
    {modal === 'profile' && <Modal title="Meu perfil" eyebrow="SUA IDENTIDADE" onClose={() => setModal(null)} wide><form onSubmit={saveProfile}><div className="form-row"><label>Nome de usuário<input required minLength="3" maxLength="30" value={profileForm.username || ''} onChange={(event) => setProfileForm({ ...profileForm, username: event.target.value })}/></label><label>Nome exibido<input required minLength="2" maxLength="80" value={profileForm.display_name || ''} onChange={(event) => setProfileForm({ ...profileForm, display_name: event.target.value })}/></label></div><label>URL do avatar<input type="url" value={profileForm.avatar_url || ''} onChange={(event) => setProfileForm({ ...profileForm, avatar_url: event.target.value })}/></label><label>Bio<textarea maxLength="500" value={profileForm.bio || ''} onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })}/></label><div className="form-row"><label>Cidade<input value={profileForm.city || ''} onChange={(event) => setProfileForm({ ...profileForm, city: event.target.value })}/></label><label>UF<input maxLength="2" value={profileForm.state || ''} onChange={(event) => setProfileForm({ ...profileForm, state: event.target.value })}/></label></div><label>Animes favoritos <small>separe por vírgulas</small><input value={Array.isArray(profileForm.favorite_animes) ? profileForm.favorite_animes.join(', ') : profileForm.favorite_animes || ''} onChange={(event) => setProfileForm({ ...profileForm, favorite_animes: event.target.value })}/></label><button className="primary auth-submit" disabled={busy}>Salvar perfil</button></form></Modal>}
    {modal === 'event' && selectedEvent && <Modal title={selectedEvent.title} eyebrow={selectedEvent.category} onClose={() => setModal(null)} wide><div className="event-detail"><p className="event-when">{dateTimeFormatter.format(new Date(selectedEvent.starts_at))}</p><p>⌖ {selectedEvent.venue_name || selectedEvent.city || 'Local a confirmar'}{selectedEvent.state ? ` · ${selectedEvent.state}` : ''}</p><p>{selectedEvent.description || 'Mais informações serão divulgadas em breve.'}</p><div className="event-stats"><span>{selectedEvent.confirmed_count || 0} confirmados</span><span>{selectedEvent.interested_count || 0} interessados</span>{selectedEvent.capacity && <span>Capacidade: {selectedEvent.capacity}</span>}</div>{!String(selectedEvent.id).startsWith('demo-') && <div className="hero-actions"><button className={`secondary ${participations[selectedEvent.id] === 'interested' ? 'active' : ''}`} disabled={busy} onClick={() => setParticipation(selectedEvent.id, 'interested')}>☆ Tenho interesse</button><button className="primary" disabled={busy} onClick={() => setParticipation(selectedEvent.id, 'going')}>{participations[selectedEvent.id] === 'going' ? '✓ Presença confirmada' : '✓ Eu vou'}</button></div>}</div></Modal>}
    {modal === 'create' && <Modal title="Criar evento" eyebrow="ORGANIZE SUA TRIBO" onClose={() => setModal(null)} wide><form onSubmit={saveEvent}><div className="form-row"><label>Título<input required minLength="3" maxLength="120" value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })}/></label><label>Categoria<select value={eventForm.category} onChange={(event) => setEventForm({ ...eventForm, category: event.target.value })}><option>Festival</option><option>Cosplay</option><option>Cultura</option><option>Games</option><option>Encontro</option></select></label></div><label>Descrição<textarea required maxLength="5000" value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })}/></label><div className="form-row"><label>Início<input required type="datetime-local" value={eventForm.starts_at} onChange={(event) => setEventForm({ ...eventForm, starts_at: event.target.value })}/></label><label>Término<input type="datetime-local" value={eventForm.ends_at} onChange={(event) => setEventForm({ ...eventForm, ends_at: event.target.value })}/></label></div><div className="form-row"><label>URL da capa<input type="url" value={eventForm.cover_url} onChange={(event) => setEventForm({ ...eventForm, cover_url: event.target.value })}/></label><label>Capacidade<input type="number" min="1" value={eventForm.capacity} onChange={(event) => setEventForm({ ...eventForm, capacity: event.target.value })}/></label></div><h3 className="form-section">Local (opcional)</h3><div className="form-row"><label>Nome do local<input value={eventForm.venue_name} onChange={(event) => setEventForm({ ...eventForm, venue_name: event.target.value })}/></label><label>Endereço<input value={eventForm.address_line} onChange={(event) => setEventForm({ ...eventForm, address_line: event.target.value })}/></label></div><div className="form-row"><label>Cidade<input value={eventForm.city} onChange={(event) => setEventForm({ ...eventForm, city: event.target.value })}/></label><label>UF<input maxLength="2" value={eventForm.state} onChange={(event) => setEventForm({ ...eventForm, state: event.target.value })}/></label></div><div className="form-row"><label>Status<select value={eventForm.status} onChange={(event) => setEventForm({ ...eventForm, status: event.target.value })}><option value="published">Publicar agora</option><option value="draft">Salvar rascunho</option></select></label><button className="primary form-submit" disabled={busy}>{busy ? 'Salvando...' : 'Salvar evento'}</button></div></form></Modal>}
    {notice && <div className={`toast ${notice.type}`} role="status"><span>{notice.text}</span><button onClick={() => setNotice(null)}>×</button></div>}
  </main>
}
