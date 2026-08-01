import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const fallbackEvents = [
  { id: 'neo-anime-festival', starts_at: '2026-08-18T18:00:00-03:00', title: 'Neo Anime Festival', city: 'São Paulo', state: 'SP', category: 'Festival', tone: 'cyan' },
  { id: 'cosplay-universe', starts_at: '2026-09-07T14:00:00-03:00', title: 'Cosplay Universe', city: 'Campinas', state: 'SP', category: 'Cosplay', tone: 'purple' },
  { id: 'geek-matsuri', starts_at: '2026-09-21T12:00:00-03:00', title: 'Geek Matsuri', city: 'Rio de Janeiro', state: 'RJ', category: 'Cultura', tone: 'blue' },
]

const fallbackCommunities = [
  { id: '10000000-0000-0000-0000-000000000001', slug: 'shonen-brasil', icon: '⚔️', name: 'Shonen Brasil', member_count: 24800, description: 'Teorias, lutas e lançamentos semanais.' },
  { id: '10000000-0000-0000-0000-000000000002', slug: 'cosplay-creators', icon: '🌸', name: 'Cosplay Creators', member_count: 18200, description: 'Crie, compartilhe e evolua seu cosplay.' },
  { id: '10000000-0000-0000-0000-000000000003', slug: 'gamers-otaku', icon: '🎮', name: 'Gamers Otaku', member_count: 31400, description: 'Do gacha ao competitivo, jogamos juntos.' },
]

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
const numberFormatter = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

function friendlyError(message) {
  const translations = {
    'Invalid login credentials': 'E-mail ou senha inválidos.',
    'User already registered': 'Este e-mail já está cadastrado.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
  }
  return translations[message] || message || 'Não foi possível concluir a operação.'
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '' })
  const [notice, setNotice] = useState(null)
  const [communities, setCommunities] = useState(fallbackCommunities)
  const [events, setEvents] = useState(fallbackEvents)
  const [joined, setJoined] = useState([])
  const [pendingCommunity, setPendingCommunity] = useState(null)

  const user = session?.user
  const displayName = useMemo(() => user?.user_metadata?.display_name || user?.email?.split('@')[0], [user])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true)
      setNotice({ type: 'error', text: 'Configure o arquivo .env para ativar login e cadastro.' })
      return undefined
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const loadContent = async () => {
      const [{ data: communityRows, error: communityError }, { data: eventRows }] = await Promise.all([
        supabase.from('communities').select('*').order('name'),
        supabase.from('event_details').select('*').eq('status', 'published').order('starts_at').limit(6),
      ])

      if (!communityError && communityRows?.length) setCommunities(communityRows)
      if (eventRows?.length) setEvents(eventRows.map((event, index) => ({ ...event, tone: ['cyan', 'purple', 'blue'][index % 3] })))
    }

    loadContent()
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !user) {
      setJoined([])
      return
    }

    supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!error) setJoined((data || []).map((item) => item.community_id))
      })
  }, [user])

  const openAuth = (mode) => {
    setAuthMode(mode)
    setMenuOpen(false)
    setNotice(null)
  }

  const submitAuth = async (event) => {
    event.preventDefault()
    if (!isSupabaseConfigured) return
    setAuthLoading(true)
    setNotice(null)

    const result = authMode === 'signup'
      ? await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: { data: { username: form.username.trim(), display_name: form.displayName.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password })

    setAuthLoading(false)
    if (result.error) {
      setNotice({ type: 'error', text: friendlyError(result.error.message) })
      return
    }

    const needsConfirmation = authMode === 'signup' && !result.data.session
    setNotice({
      type: 'success',
      text: needsConfirmation ? 'Conta criada! Confirme o e-mail para entrar.' : authMode === 'signup' ? 'Conta criada com sucesso!' : 'Login realizado com sucesso!',
    })
    setForm({ email: '', password: '', username: '', displayName: '' })
    if (!needsConfirmation) setAuthMode(null)
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    setNotice(error ? { type: 'error', text: friendlyError(error.message) } : { type: 'success', text: 'Você saiu da sua conta.' })
    setMenuOpen(false)
  }

  const toggleCommunity = async (community) => {
    if (!user) {
      setNotice({ type: 'error', text: 'Entre na sua conta para participar de uma comunidade.' })
      openAuth('login')
      return
    }

    const isJoined = joined.includes(community.id)
    setPendingCommunity(community.id)
    const query = isJoined
      ? supabase.from('community_members').delete().eq('community_id', community.id).eq('user_id', user.id)
      : supabase.from('community_members').insert({ community_id: community.id, user_id: user.id })
    const { error } = await query
    setPendingCommunity(null)

    if (error) {
      setNotice({ type: 'error', text: friendlyError(error.message) })
      return
    }

    setJoined((current) => isJoined ? current.filter((id) => id !== community.id) : [...current, community.id])
    setCommunities((current) => current.map((item) => item.id === community.id
      ? { ...item, member_count: Math.max(0, Number(item.member_count || 0) + (isJoined ? -1 : 1)) }
      : item))
    setNotice({ type: 'success', text: isJoined ? `Você saiu de ${community.name}.` : `Você entrou em ${community.name}!` })
  }

  return (
    <main>
      <nav className="nav shell">
        <a className="brand" href="#inicio" aria-label="AnimeConect início">
          <span className="brand-mark">A</span>
          <span>ANIME<span>CONECT</span></span>
        </a>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">☰</button>
        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <a href="#eventos">Eventos</a>
          <a href="#comunidades">Comunidades</a>
          <a href="#sobre">Sobre</a>
          {authReady && user ? (
            <>
              <span className="user-chip">Olá, {displayName}</span>
              <button className="login" onClick={signOut}>Sair</button>
            </>
          ) : (
            <>
              <button className="login" onClick={() => openAuth('login')}>Entrar</button>
              <button className="primary small" onClick={() => openAuth('signup')}>Criar conta</button>
            </>
          )}
        </div>
      </nav>

      <section className="hero-section" id="inicio">
        <div className="grid-glow" />
        <div className="hero-content shell">
          <div className="eyebrow"><span>●</span> O seu universo começa aqui</div>
          <h1>Conecte-se com quem vive a mesma <em>paixão.</em></h1>
          <p className="hero-copy">Descubra eventos, encontre novas amizades e faça parte da maior comunidade de fãs de anime do Brasil.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => user ? document.querySelector('#comunidades')?.scrollIntoView() : openAuth('signup')}>
              {user ? 'Explorar comunidades' : 'Entrar para a comunidade'} <span>→</span>
            </button>
            <a className="secondary" href="#eventos">Explorar eventos</a>
          </div>
          <div className="social-proof">
            <div className="avatars"><span>ナ</span><span>ア</span><span>メ</span><span>+</span></div>
            <p><strong>+50 mil fãs</strong><br />já estão conectados</p>
          </div>
        </div>
        <div className="orb orb-one" /><div className="orb orb-two" />
      </section>

      <section className="section shell" id="eventos">
        <div className="section-heading">
          <div><span className="kicker">PRÓXIMOS ENCONTROS</span><h2>Eventos em destaque</h2></div>
          <a href="#eventos">Ver todos →</a>
        </div>
        <div className="event-grid">
          {events.map((event) => {
            const date = new Date(event.starts_at)
            return (
              <article className={`event-card ${event.tone || 'cyan'}`} key={event.id || event.title}>
                <div className="event-visual"><span className="event-tag">{event.category}</span><div className="kanji">繋</div></div>
                <div className="event-info">
                  <div className="date"><strong>{String(date.getDate()).padStart(2, '0')}</strong><span>{monthFormatter.format(date).replace('.', '').toUpperCase()}</span></div>
                  <div><h3>{event.title}</h3><p>⌖ {event.city || event.venue_name || 'Local a confirmar'}{event.state ? ` · ${event.state}` : ''}</p></div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="communities" id="comunidades">
        <div className="shell">
          <div className="section-heading"><div><span className="kicker">ENCONTRE SUA TRIBO</span><h2>Comunidades populares</h2></div></div>
          <div className="community-grid">
            {communities.map((community) => {
              const isJoined = joined.includes(community.id)
              return (
                <article className="community-card" key={community.id}>
                  <div className="community-icon">{community.icon}</div>
                  <div className="community-text"><h3>{community.name}</h3><span>{numberFormatter.format(Number(community.member_count || 0))} membros</span><p>{community.description}</p></div>
                  <button disabled={pendingCommunity === community.id} className={isJoined ? 'joined' : ''} onClick={() => toggleCommunity(community)}>
                    {pendingCommunity === community.id ? 'Salvando...' : isJoined ? 'Participando ✓' : 'Participar'}
                  </button>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="cta shell" id="sobre">
        <span className="cta-symbol">愛</span>
        <div><span className="kicker">FEITO PARA FÃS, POR FÃS</span><h2>Seu próximo nakama está a um clique.</h2><p>Crie seu perfil, escolha seus animes favoritos e comece a conectar.</p></div>
        <button className="primary" onClick={() => user ? document.querySelector('#comunidades')?.scrollIntoView() : openAuth('signup')}>
          {user ? 'Ver comunidades →' : 'Criar meu perfil grátis →'}
        </button>
      </section>

      <footer><div className="shell footer-inner"><div className="brand"><span className="brand-mark">A</span><span>ANIME<span>CONECT</span></span></div><p>© 2026 AnimeConect. Conectando universos.</p></div></footer>

      {authMode && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAuthMode(null)}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="modal-close" onClick={() => setAuthMode(null)} aria-label="Fechar">×</button>
            <span className="kicker">ANIMECONECT</span>
            <h2 id="auth-title">{authMode === 'signup' ? 'Crie sua conta' : 'Entre na comunidade'}</h2>
            <p>{authMode === 'signup' ? 'Monte seu perfil e encontre sua tribo.' : 'Que bom ter você de volta.'}</p>
            <form onSubmit={submitAuth}>
              {authMode === 'signup' && (
                <div className="form-row">
                  <label>Nome de usuário<input required minLength="3" maxLength="30" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="seu_usuario" /></label>
                  <label>Nome exibido<input required minLength="2" maxLength="80" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Seu nome" /></label>
                </div>
              )}
              <label>E-mail<input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="voce@email.com" /></label>
              <label>Senha<input required type="password" minLength="6" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Mínimo de 6 caracteres" /></label>
              <button className="primary auth-submit" disabled={authLoading}>{authLoading ? 'Aguarde...' : authMode === 'signup' ? 'Criar conta' : 'Entrar'}</button>
            </form>
            <button className="auth-switch" onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}>
              {authMode === 'signup' ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Criar agora'}
            </button>
          </section>
        </div>
      )}

      {notice && <div className={`toast ${notice.type}`} role="status"><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Fechar aviso">×</button></div>}
    </main>
  )
}

export default App
