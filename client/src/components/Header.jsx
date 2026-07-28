import { NavLink, Link } from 'react-router-dom';

export default function Header({ compact = false }) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className={`brand ${compact ? 'brand--mark' : ''}`}>
          <img
            src="/logos/atlas-agency.png"
            alt="Atlas Agency"
          />
        </Link>
        <nav className="nav" aria-label="Principal">
          <a href="/#servicos">Serviços</a>
          <a href="/#campanhas">Campanhas</a>
          <a href="/#dashboard">Dashboard</a>
          <NavLink to="/admin">Administração</NavLink>
        </nav>
        <Link to="/campanha/fabio-garcia" className="btn btn-primary btn-sm">
          Abrir campanha
        </Link>
      </div>
    </header>
  );
}
