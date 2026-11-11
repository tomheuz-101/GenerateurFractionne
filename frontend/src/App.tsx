import { useEffect, useState } from 'react';

type ApiStatus = 'loading' | 'online' | 'offline';

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('loading');

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) throw new Error('API indisponible');
        return response.json();
      })
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'));
  }, []);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Accueil">
          <span className="brand-mark">GF</span>
          <span>Générateur<span className="brand-light">Fractionné</span></span>
        </a>
        <span className="environment">NOUVELLE VERSION</span>
      </header>

      <section className="hero">
        <p className="eyebrow">LA REfonte PREND FORME</p>
        <h1>Vos entraînements,<br /><span>pensés autrement.</span></h1>
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
      </section>

      <footer>Une base saine pour construire la suite.</footer>
    </main>
  );
}
