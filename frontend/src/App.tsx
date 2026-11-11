import { useEffect, useState } from 'react';
import { api } from './api';
import Creator from './Creator';
import Library from './Library';
import Login from './Login';
import Planning from './Planning';

type ApiStatus = 'loading' | 'online' | 'offline';
type AuthState = 'loading' | 'anon' | 'authed';

interface SessionInfo {
  email: string;
  isAdmin: boolean;
}

const NAV = [
  { hash: '#/', label: 'Créateur', icon: '⚡' },
  { hash: '#/bibliotheque', label: 'Bibliothèque', icon: '📚' },
  { hash: '#/planning', label: 'Planning', icon: '🗓️' },
];

function currentHash() {
  return window.location.hash || '#/';
}

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('loading');
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [open, setOpen] = useState(() => localStorage.getItem('sb-open') !== '0');
  const [hash, setHash] = useState(currentHash);

  useEffect(() => {
    const onHash = () => setHash(currentHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) throw new Error('API indisponible');
        return response.json();
      })
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'));

    fetch('/api/auth/me', { credentials: 'include' })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error('anon')),
      )
      .then((data) => {
        setSession({ email: data.email, isAdmin: Boolean(data.isAdmin) });
        setAuthState('authed');
      })
      .catch(() => setAuthState('anon'));
  }, []);

  useEffect(() => {
    localStorage.setItem('sb-open', open ? '1' : '0');
  }, [open]);

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setSession(null);
    setAuthState('anon');
    window.location.hash = '';
  }

  if (authState === 'loading') {
    return (
      <main className="page-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="Accueil">
            <span className="brand-mark">GF</span>
            <span>
              Générateur<span className="brand-light">Fractionné</span>
            </span>
          </a>
          <span className="environment">NOUVELLE VERSION</span>
        </header>
        <section className="hero">
          <p className="eyebrow">LA REFONTE PREND FORME</p>
          <h1>Chargement…</h1>
        </section>
      </main>
    );
  }

  if (authState === 'anon' || !session) {
    return (
      <main className="page-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="Accueil">
            <span className="brand-mark">GF</span>
            <span>
              Générateur<span className="brand-light">Fractionné</span>
            </span>
          </a>
          <span className="environment">NOUVELLE VERSION</span>
        </header>

        <section className="hero">
          <p className="eyebrow">LA REFONTE PREND FORME</p>
          <h1>
            Vos entraînements,
            <br />
            <span>pensés autrement.</span>
          </h1>
          <p className="intro">
            Le nouveau socle technique est en place. Nous allons reconstruire
            progressivement le générateur, la bibliothèque et la planification.
          </p>

          <div className="status-card">
            <span className={`status-dot ${apiStatus}`} />
            <div>
              <strong>
                {apiStatus === 'loading' && 'Vérification de l’API…'}
                {apiStatus === 'online' && 'API connectée'}
                {apiStatus === 'offline' && 'API non joignable'}
              </strong>
              <p>
                {apiStatus === 'online'
                  ? 'Le frontend React communique avec le backend NestJS.'
                  : apiStatus === 'offline'
                    ? 'Vérifiez que le backend NestJS est démarré.'
                    : 'Connexion au backend en cours.'}
              </p>
            </div>
          </div>

          <Login
            onLoggedIn={(email, isAdmin) => {
              setSession({ email, isAdmin });
              setAuthState('authed');
            }}
          />
        </section>

        <footer>Une base saine pour construire la suite.</footer>
      </main>
    );
  }

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
          <span className="sb-mail">{session.email}</span>
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
