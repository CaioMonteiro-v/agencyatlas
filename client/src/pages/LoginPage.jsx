import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { api } from '../api';
import { EmptyState, Toast } from '../components/Ui';

export default function LoginPage() {
  const { login, register, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login'); // login | register
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    invite_code: '',
  });

  useEffect(() => {
    api.authStatus()
      .then((s) => {
        setStatus(s);
        if (s.needs_first_user) setMode('register');
      })
      .catch(() => setStatus({ can_register: true, needs_first_user: true }));
  }, []);

  if (!loading && isAuthenticated) {
    const next = location.state?.from || '/campanha/fabio-garcia/mobilizacao';
    return <Navigate to={next} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'register') {
        await register({
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password,
          invite_code: form.invite_code.trim(),
        });
        setToast('Conta criada — bem-vindo à equipe');
      } else {
        await login(form.username.trim(), form.password);
      }
      const next = location.state?.from || '/campanha/fabio-garcia/mobilizacao';
      navigate(next, { replace: true });
    } catch (err) {
      setToast(err.message || 'Falha na autenticação');
      if (err.can_register) setMode('register');
    } finally {
      setBusy(false);
    }
  }

  const showInvite = mode === 'register' && status?.invite_required;

  return (
    <div className="public-page login-page">
      <div className="public-card login-card">
        <div className="login-card__brand">
          <img src="/logos/atlas-agency-mark.png" alt="Atlas Agency" />
          <p className="eyebrow">Equipe interna</p>
          <h1>{mode === 'register' ? 'Criar conta' : 'Entrar no Atlas'}</h1>
          <p>
            {status?.needs_first_user
              ? 'Primeiro acesso: cadastre seu nome e senha para liberar o painel da equipe.'
              : 'Acesso só para a equipe de mobilização. QR e links públicos não precisam de login.'}
          </p>
        </div>

        {loading ? (
          <EmptyState>Verificando sessão…</EmptyState>
        ) : (
          <>
            {!status?.needs_first_user && status?.can_register && (
              <div className="chip-group" style={{ marginBottom: '0.85rem' }}>
                <button
                  type="button"
                  className={`chip ${mode === 'login' ? 'active' : ''}`}
                  onClick={() => setMode('login')}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  className={`chip ${mode === 'register' ? 'active' : ''}`}
                  onClick={() => setMode('register')}
                >
                  Criar conta
                </button>
              </div>
            )}

            <form className="form-grid" onSubmit={onSubmit}>
              {mode === 'register' && (
                <label>
                  Nome completo *
                  <input
                    className="input"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex.: Caio Monteiro"
                  />
                </label>
              )}
              <label>
                Usuário *
                <input
                  className="input"
                  required
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Ex.: caio"
                />
              </label>
              <label>
                Senha *
                <input
                  className="input"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                />
              </label>
              {showInvite && (
                <label>
                  Código de convite *
                  <input
                    className="input"
                    required
                    value={form.invite_code}
                    onChange={(e) => setForm({ ...form, invite_code: e.target.value })}
                    placeholder="Código da equipe"
                  />
                </label>
              )}
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy
                  ? (mode === 'register' ? 'Criando…' : 'Entrando…')
                  : (mode === 'register' ? 'Criar conta e entrar' : 'Entrar')}
              </button>
            </form>
          </>
        )}

        <p style={{ marginBottom: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
          Evento ou link de mobilizador? Use o QR / link pessoal — sem login.{' '}
          <Link to="/">Voltar</Link>
        </p>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
