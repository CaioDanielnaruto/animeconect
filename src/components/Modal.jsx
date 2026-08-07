export default function Modal({ title, eyebrow = 'ANIMECONECT', onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`auth-modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        <span className="kicker">{eyebrow}</span>
        <h2 id="modal-title">{title}</h2>
        {children}
      </section>
    </div>
  )
}
