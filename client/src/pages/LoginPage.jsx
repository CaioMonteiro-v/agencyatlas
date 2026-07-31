import { useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { EmptyState, Toast } from '../components/Ui';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('equipe');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  if (!loading && isAuthenticated) {
    const next = location.state?.from || '/campanha/fabio-garcia/mobilizacao';
    return <Navigate to={next} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(username.trim() || 'equipe', password);
      const next = location.state?.from || '/campanha/fabio-garcia/mobilizacao';
      navigate(next, { replace: true });
    } catch (err) {
      setToast(err.message || 'Falha no login');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="public-page login-page">
      <div className="public-card login-card">
        <div className="login-card__brand">
          <img src="/logos/atlas-agency-mark.png" alt="Atlas Agency" />
          <p className="eyebrow">Equipe interna</p>
          <h1>Entrar no Atlas</h1>
          <p>Acesso só para a equipe de mobilização. Cadastros públicos continuam pelos QR e links.</p>
        </div>

        {loading ? (
          <EmptyState>Verificando sessão…</EmptyState>
        ) : (
          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Usuário
              <input
                className="input"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              Senha
              <input
                className="input"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha da equipe"
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        )}

        <p style={{ marginBottom: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
          Evento ou link de mobilizador? Use o QR / link pessoal — não precisa de login.{' '}
          <Link to="/">Voltar</Link>
        </p>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
