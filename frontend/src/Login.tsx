import { useState } from 'react';

type Mode = 'login' | 'register';

interface Props {
  onLoggedIn: (email: string, isAdmin: boolean) => void;
}

export default function Login({ onLoggedIn }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          mode === 'register'
            ? { email, password, inviteCode: inviteCode || undefined }
            : { email, password },
        ),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.message;
        setError(
          typeof message === 'string'
            ? message
            : Array.isArray(message)
              ? message[0]
              : 'Une erreur est survenue.',
        );
        return;
      }

      const me = await fetch('/api/auth/me', { credentials: 'include' });
      const mj = await me.json().catch(() => ({}));
      onLoggedIn(mj.email ?? email, Boolean(mj.isAdmin));
    } catch {
      setError('Impossible de joindre le serveur.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card">
      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          className={mode === 'login' ? 'active' : ''}
          onClick={() => { setMode('login'); setError(''); }}
        >
          Se connecter
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'active' : ''}
          onClick={() => { setMode('register'); setError(''); }}
        >
          Créer un compte
        </button>
      </div>

      <form onSubmit={submit}>
        <label htmlFor="auth-email">E-mail</label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label htmlFor="auth-password">Mot de passe</label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={mode === 'register' ? 12 : undefined}
          required
        />

        {mode === 'register' && (
          <>
            <label htmlFor="auth-invite">Code d’invitation</label>
            <input
              id="auth-invite"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Requis sauf compte administrateur"
            />
          </>
        )}

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy
            ? '…'
            : mode === 'login'
              ? 'Se connecter'
              : 'Créer mon compte'}
        </button>

        {mode === 'register' && (
          <p className="auth-note">
            Mot de passe : 12 caractères minimum.
          </p>
        )}
      </form>
    </section>
  );
}
