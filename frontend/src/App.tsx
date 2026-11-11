import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './api';
import Creator from './Creator';
import Library from './Library';
import Planning from './Planning';

type Me = { id: number; email: string; name?: string | null; vma?: number | null };

const NAV = [
  { hash: '#/', label: 'Créateur', icon: '⚡' },
  { hash: '#/bibliotheque', label: 'Bibliothèque', icon: '📚' },
  { hash: '#/planning', label: 'Planning', icon: '🗓️' },
];

function currentHash() {
  return window.location.hash || '#/';
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(() => localStorage.getItem('sb-open') !== '0');
  const [hash, setHash] = useState(currentHash);

  useEffect(() => {
    const onHash = () => setHash(currentHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    api<{ user?: Me }>('/api/auth/me').then((r) => {
      if (r.ok && r.j.user) setMe(r.j.user);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('sb-open', open ? '1' : '0');
  }, [open]);

  const logout = async () => {
    await api('/api/auth/logout', 'POST');
    setMe(null);
  };

  if (loading) return <div className="landing"><p>Chargement…</p></div>;
  if (!me) return <Login onLogged={setMe} />;

  const go = (h: string) => {
    window.location.hash = h;
    setHash(h);
    if (window.innerWidth <= 860) setOpen(false);
  };

  return (
    <div className={'app-shell ' + (open ? 'sb-open' : 'sb-closed')}>
      <button
        className="sb-toggle"
        type="button"
        aria-label={open ? 'Replier le menu' : 'Déplier le menu'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ☰
      </button>
      {open && <div className="sb-overlay" onClick={() => setOpen(false)} />}
      <nav className="sb">
        <div className="sb-lb">Fractionné</div>
        {NAV.map((n) => (
          <a
            key={n.hash}
            href={n.hash}
            className={hash === n.hash ? 'active' : ''}
            onClick={() => go(n.hash)}
          >
            <span aria-hidden="true">{n.icon}</span> {n.label}
          </a>
        ))}
        <div className="sb-foot">
          <span className="sb-mail">{me.email}</span>
          <button type="button" onClick={logout}>Se déconnecter</button>
        </div>
      </nav>
      <main className="main">
        {hash === '#/' && <Creator />}
        {hash === '#/bibliotheque' && <Library />}
        {hash === '#/planning' && <Planning />}
      </main>
    </div>
  );
}

function Login({ onLogged }: { onLogged: (me: Me) => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (tab === 'register' && password.length < 12) {
      setErr('Mot de passe : 12 caractères minimum.');
      return;
    }
    const url = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = tab === 'login' ? { email, password } : { email, password, name, inviteCode: invite };
    const r = await api<{ user?: Me; error?: string }>(url, 'POST', body);
    if (!r.ok) { setErr(r.j.error || 'Erreur.'); return; }
    if (r.j.user) onLogged(r.j.user);
  };

  return (
    <div className="landing">
      <div className="auth-card">
        <h1>Générateur de fractionné</h1>
        <div className="seg">
          <button type="button" aria-pressed={tab === 'login'} onClick={() => setTab('login')}>Connexion</button>
          <button type="button" aria-pressed={tab === 'register'} onClick={() => setTab('register')}>Inscription</button>
        </div>
        <form onSubmit={submit}>
          <label>
            Email
            <input type="email" value={email} required onChange={(e) => setEmail(e.target.value)} />
          </label>
          {tab === 'register' && (
            <label>
              Nom (optionnel)
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label>
            Mot de passe
            <input type="password" value={password} required minLength={12} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {tab === 'register' && (
            <label>
              Code d’invitation
              <input value={invite} required maxLength={64} onChange={(e) => setInvite(e.target.value)} />
            </label>
          )}
          {err && <p className="err">{err}</p>}
          <button type="submit" className="copy">
            {tab === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  );
}
