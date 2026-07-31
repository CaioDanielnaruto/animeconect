import { useState } from 'react'
import './App.css'

const events = [
  { day: '18', month: 'AGO', title: 'Neo Anime Festival', place: 'São Paulo · SP', tag: 'Festival', tone: 'cyan' },
  { day: '07', month: 'SET', title: 'Cosplay Universe', place: 'Campinas · SP', tag: 'Cosplay', tone: 'purple' },
  { day: '21', month: 'SET', title: 'Geek Matsuri', place: 'Rio de Janeiro · RJ', tag: 'Cultura', tone: 'blue' },
]

const communities = [
  { icon: '⚔️', name: 'Shonen Brasil', members: '24,8 mil', description: 'Teorias, lutas e lançamentos semanais.' },
  { icon: '🌸', name: 'Cosplay Creators', members: '18,2 mil', description: 'Crie, compartilhe e evolua seu cosplay.' },
  { icon: '🎮', name: 'Gamers Otaku', members: '31,4 mil', description: 'Do gacha ao competitivo, jogamos juntos.' },
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [joined, setJoined] = useState([])

  const toggleCommunity = (name) => {
    setJoined((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
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
          <button className="login">Entrar</button>
          <button className="primary small">Criar conta</button>
        </div>
      </nav>

      <section className="hero-section" id="inicio">
        <div className="grid-glow" />
        <div className="hero-content shell">
          <div className="eyebrow"><span>●</span> O seu universo começa aqui</div>
          <h1>Conecte-se com quem vive a mesma <em>paixão.</em></h1>
          <p className="hero-copy">Descubra eventos, encontre novas amizades e faça parte da maior comunidade de fãs de anime do Brasil.</p>
          <div className="hero-actions">
            <button className="primary">Entrar para a comunidade <span>→</span></button>
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
          {events.map((event) => (
            <article className={`event-card ${event.tone}`} key={event.title}>
              <div className="event-visual"><span className="event-tag">{event.tag}</span><div className="kanji">繋</div></div>
              <div className="event-info">
                <div className="date"><strong>{event.day}</strong><span>{event.month}</span></div>
                <div><h3>{event.title}</h3><p>⌖ {event.place}</p></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="communities" id="comunidades">
        <div className="shell">
          <div className="section-heading">
            <div><span className="kicker">ENCONTRE SUA TRIBO</span><h2>Comunidades populares</h2></div>
          </div>
          <div className="community-grid">
            {communities.map((community) => {
              const isJoined = joined.includes(community.name)
              return <article className="community-card" key={community.name}>
                <div className="community-icon">{community.icon}</div>
                <div className="community-text"><h3>{community.name}</h3><span>{community.members} membros</span><p>{community.description}</p></div>
                <button className={isJoined ? 'joined' : ''} onClick={() => toggleCommunity(community.name)}>{isJoined ? 'Participando ✓' : 'Participar'}</button>
              </article>
            })}
          </div>
        </div>
      </section>

      <section className="cta shell" id="sobre">
        <span className="cta-symbol">愛</span>
        <div><span className="kicker">FEITO PARA FÃS, POR FÃS</span><h2>Seu próximo nakama está a um clique.</h2><p>Crie seu perfil, escolha seus animes favoritos e comece a conectar.</p></div>
        <button className="primary">Criar meu perfil grátis →</button>
      </section>

      <footer><div className="shell footer-inner"><div className="brand"><span className="brand-mark">A</span><span>ANIME<span>CONECT</span></span></div><p>© 2026 AnimeConect. Conectando universos.</p></div></footer>
    </main>
  )
}

export default App
