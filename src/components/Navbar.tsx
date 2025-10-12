import React from 'react'
import './Navbar.css'

type Props = {
  activeItem?: string
  onNavigate?: (item: string) => void
}

const links = ['Dashboard', 'Clientes', 'Propriedades', 'Calendário', 'Acompanhamentos', 'Oportunidades']


const Navbar: React.FC<Props> = ({ activeItem = 'Dashboard', onNavigate = () => {} }) => {
  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="sidebar__inner">
        <div className="sidebar__brand">
          <a href="#" onClick={e => { e.preventDefault(); onNavigate('Dashboard'); }}>AgroCRM</a>
        </div>
        <nav className="sidebar__nav" role="navigation">
          {links.map(l => (
            <a
              key={l}
              className={`sidebar__link ${l === activeItem ? 'active' : ''}`}
              href="#"
              onClick={(e) => { e.preventDefault(); onNavigate(l); }}
            >
              {l}
            </a>
          ))}
        </nav>
        <div className="sidebar__footer">
          <button className="sidebar__logout">Sair</button>
        </div>
      </div>
    </aside>
  )
}

export default Navbar
