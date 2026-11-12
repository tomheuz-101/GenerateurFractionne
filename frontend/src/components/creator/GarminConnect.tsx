
import type { FormEvent } from 'react';

interface GarminConnectProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  linked: boolean;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  mfa: boolean;
  busy: boolean;
  error: string;
  connect: (e?: FormEvent) => Promise<void>;
  submitMfa: (e?: FormEvent) => Promise<void>;
  disconnect: () => Promise<void>;
}

export default function GarminConnect({
  open,
  setOpen,
  linked,
  email,
  setEmail,
  password,
  setPassword,
  code,
  setCode,
  mfa,
  busy,
  error,
  connect,
  submitMfa,
  disconnect,
}: GarminConnectProps) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!busy) setOpen(false);
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Compte Garmin Connect</h2>

        {!mfa ? (
          <form onSubmit={connect}>
            <p className="note" style={{ marginBottom: 10 }}>
              {linked
                ? 'Compte déjà connecté : tu peux le reconnecter ou le délier.'
                : 'Le mot de passe Garmin ne sert qu’une fois : seuls des jetons chiffrés sont conservés.'}
            </p>

            <label>
              E-mail Garmin
              <input
                type="email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label>
              Mot de passe Garmin
              <input
                type="password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && <p className="err">{error}</p>}

            <div className="modal-actions">
              {linked && (
                <button
                  className="mini"
                  type="button"
                  onClick={disconnect}
                >
                  Délier
                </button>
              )}

              <button className="copy" type="submit" disabled={busy}>
                {busy ? 'Connexion…' : 'Se connecter'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitMfa}>
            <p className="note" style={{ marginBottom: 10 }}>
              Garmin a envoyé un code de vérification. Entre-le ci-dessous (valable 10 min).
            </p>

            <label>
              Code de vérification
              <input
                value={code}
                required
                inputMode="numeric"
                autoFocus
                onChange={(e) => setCode(e.target.value)}
              />
            </label>

            {error && <p className="err">{error}</p>}

            <div className="modal-actions">
              <button className="copy" type="submit" disabled={busy}>
                {busy ? 'Vérification…' : 'Valider'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
