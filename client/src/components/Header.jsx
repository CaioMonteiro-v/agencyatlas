import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Header({ compact = false }) {
  const { isAuthenticated, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('nav-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('nav-open');
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className={`brand ${compact ? 'brand--mark' : ''}`} onClick={closeMenu}>
          <img
            src={compact ? '/logos/atlas-agency-mark.png' : '/logos/atlas-agency.png'}
            alt="Atlas Agency"
          />
        </Link>

        <nav className="nav nav--desktop" aria-label="Principal">
          {isAuthenticated ? (
            <>
              <NavLink to="/campanha/fabio-garcia/mobilizacao">Mobilização</NavLink>
              <NavLink to="/admin">Administração</NavLink>
            </>
          ) : (
            <NavLink to="/login">Login equipe</NavLink>
          )}
        </nav>

        <div className="site-header__actions">
          {isAuthenticated ? (
            <>
              <span className="header-user" title={user?.username || ''}>
                {user?.name || user?.username || 'Equipe'}
              </span>
              <Link to="/campanha/fabio-garcia/mobilizacao" className="btn btn-primary btn-sm header-cta">
                Abrir painel
              </Link>
              <button
                type="button"
                className="btn btn-soft btn-sm header-logout"
                onClick={() => logout()}
              >
                Sair
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm header-cta">
              Entrar
            </Link>
          )}

          <button
            type="button"
            className={`nav-toggle ${menuOpen ? 'is-open' : ''}`}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <div
        className={`nav-drawer ${menuOpen ? 'is-open' : ''}`}
        id="mobile-nav"
        hidden={!menuOpen}
      >
        <nav className="nav-drawer__links" aria-label="Menu mobile">
          {isAuthenticated ? (
            <>
              <NavLink to="/campanha/fabio-garcia/mobilizacao" onClick={closeMenu}>
                Mobilização
              </NavLink>
              <NavLink to="/campanha/fabio-garcia/coordenadores" onClick={closeMenu}>
                Coordenadores
              </NavLink>
              <NavLink to="/campanha/fabio-garcia/conteudo" onClick={closeMenu}>
                Conteúdo
              </NavLink>
              <NavLink to="/campanha/fabio-garcia/relatorio" onClick={closeMenu}>
                Relatório
              </NavLink>
              <NavLink to="/admin" onClick={closeMenu}>
                Administração
              </NavLink>
            </>
          ) : (
            <NavLink to="/login" onClick={closeMenu}>
              Login equipe
            </NavLink>
          )}
          <Link
            to={isAuthenticated ? '/campanha/fabio-garcia/mobilizacao' : '/login'}
            className="btn btn-primary"
            onClick={closeMenu}
          >
            {isAuthenticated ? 'Abrir painel' : 'Entrar / Criar perfil'}
          </Link>
          {isAuthenticated ? (
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                logout();
                closeMenu();
              }}
            >
              Sair ({user?.name || user?.username || 'equipe'})
            </button>
          ) : null}
        </nav>
      </div>

      {menuOpen ? (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Fechar menu"
          onClick={closeMenu}
        />
      ) : null}
    </header>
  );
}
