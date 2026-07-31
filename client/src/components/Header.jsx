import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Header({ compact = false }) {
  const { isAuthenticated } = useAuth();

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className={`brand ${compact ? 'brand--mark' : ''}`}>
          <img
            src={compact ? '/logos/atlas-agency-mark.png' : '/logos/atlas-agency.png'}
            alt="Atlas Agency"
          />
        </Link>
        <nav className="nav" aria-label="Principal">
          {isAuthenticated ? (
            <>
              <NavLink to="/campanha/fabio-garcia/mobilizacao">Mobilização</NavLink>
              <NavLink to="/admin">Administração</NavLink>
            </>
          ) : (
            <NavLink to="/login">Login equipe</NavLink>
          )}
        </nav>
        {isAuthenticated ? (
          <Link to="/campanha/fabio-garcia/mobilizacao" className="btn btn-primary btn-sm">
            Abrir painel
          </Link>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}
