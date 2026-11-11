import { useEffect, useState } from 'react';
import Login from './Login';

type ApiStatus = 'loading' | 'online' | 'offline';
type AuthState = 'loading' | 'anon' | 'authed';

interface SessionInfo {
  email: string;
  isAdmin: boolean;
}

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('loading');
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [session, setSession] = useState<SessionInfo | null>(null);

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

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setSession(null);
    setAuthState('anon');
  }

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

        {authState === 'anon' && (
          <Login
            onLoggedIn={(email, isAdmin) => {
              setSession({ email, isAdmin });
              setAuthState('authed');
            }}
          />
        )}

        {authState === 'authed' && session && (
          <div className="status-card">
            <span className="status-dot online" />
            <div>
              <strong>Connecté : {session.email}</strong>
              <p>
                {session.isAdmin
                  ? 'Compte administrateur.'
                  : 'Session active pendant 30 jours.'}
              </p>
              <button className="auth-link" type="button" onClick={logout}>
                Se déconnecter
              </button>
            </div>
          </div>
        )}
      </section>

      <footer>Une base saine pour construire la suite.</footer>
    </main>
  );
}
