import { monthFormatter } from '../lib/formatters'

export default function EventCard({ event, onOpen }) {
  const date = new Date(event.starts_at)
  return (
    <article className={`event-card ${event.tone || 'cyan'}`}>
      <button className="card-action" onClick={() => onOpen(event)} aria-label={`Abrir ${event.title}`}>
        <div className="event-visual" style={event.cover_url ? { backgroundImage: `linear-gradient(rgba(6,6,17,.35),rgba(6,6,17,.85)),url(${event.cover_url})` } : undefined}>
          <span className="event-tag">{event.category}</span><div className="kanji">繋</div>
        </div>
        <div className="event-info">
          <div className="date"><strong>{String(date.getDate()).padStart(2, '0')}</strong><span>{monthFormatter.format(date).replace('.', '').toUpperCase()}</span></div>
          <div><h3>{event.title}</h3><p>⌖ {event.city || event.venue_name || 'Local a confirmar'}{event.state ? ` · ${event.state}` : ''}</p></div>
        </div>
      </button>
    </article>
  )
}
