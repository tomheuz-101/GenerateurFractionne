import { useEffect, useState } from 'react';
import { api } from './api';

export default function Profil({
  email,
  onAccountDeleted,
}: {
  email: string;
  onAccountDeleted: () => void;
}) {
  // --- VMA ---
  const [vma, setVma] = useState('');
  const [vmaMsg, setVmaMsg] = useState('');

  // --- Garmin ---
  const [gLinked, setGLinked] = useState<boolean | null>(null);
  const [gOwnerEnv, setGOwnerEnv] = useState(false);
  const [gMail, setGMail] = useState('');
  const [gPw, setGPw] = useState('');
  const [gCode, setGCode] = useState('');
  const [gMfa, setGMfa] = useState(false);
  const [gErr, setGErr] = useState('');
  const [gBusy, setGBusy] = useState(false);

  // --- Mot de passe ---
  const [pCur, setPCur] = useState('');
  const [pNew, setPNew] = useState('');
  const [pMsg, setPMsg] = useState('');

  // --- Suppression ---
  const [dPw, setDPw] = useState('');
  const [dErr, setDErr] = useState('');

  useEffect(() => {
    api<{ email: string; vma: number | null }>('/api/profile').then((r) => {
      if (r.ok && r.j.vma) setVma(String(r.j.vma));
    });
    gRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function gRefresh() {
    const r = await api<{ linked: boolean; owner_env: boolean }>(
      '/api/garmin/status',
    );
    setGLinked(Boolean(r.j.linked));
    setGOwnerEnv(Boolean(r.j.owner_env));
  }

  async function gGo() {
    setGErr('');
    setGBusy(true);
    try {
      const r = gMfa
        ? await api<{ mfa_required?: boolean; error?: string }>(
            '/api/garmin/mfa',
            'POST',
            { code: gCode.trim() },
          )
        : await api<{ mfa_required?: boolean; error?: string }>(
            '/api/garmin/connect',
            'POST',
            { email: gMail.trim(), password: gPw },
          );
      if (r.j.mfa_required) {
        setGMfa(true);
        setGErr('Garmin t’a envoyé un code : saisis-le puis valide.');
        return;
      }
      if (!r.ok) {
        setGErr(r.j.error || 'Erreur.');
        return;
      }
      setGPw('');
      setGCode('');
      setGMfa(false);
      await gRefresh();
    } finally {
      setGBusy(false);
    }
  }

  async function gOff() {
    if (!window.confirm('Déconnecter ton compte Garmin ?')) return;
    await api('/api/garmin/disconnect', 'POST');
    gRefresh();
  }

  async function vmaGo() {
    const v = parseFloat(vma.replace(',', '.'));
    if (!(v >= 8 && v <= 30)) {
      setVmaMsg('VMA invalide (8 à 30 km/h).');
      return;
    }
    const r = await api<{ error?: string }>('/api/profile/vma', 'POST', { vma: v });
    setVmaMsg(r.ok ? 'VMA enregistrée ✅' : r.j.error || 'Erreur.');
  }

  async function pGo() {
    const r = await api<{ error?: string }>('/api/profile/password', 'POST', {       current: pCur,
      new: pNew,
    });
    setPMsg(r.ok ? 'Mot de passe modifié.' : r.j.error || 'Erreur.');
    if (r.ok) {
      setPCur('');
      setPNew('');
    }
  }

  async function dGo() {
    if (
      !window.confirm(
        'Supprimer définitivement ton compte et toutes tes séances ?',
      )
    ) {
      return;
    }
    const r = await api<{ error?: string }>('/api/profile/delete', 'POST', { password: dPw });    if (r.ok) onAccountDeleted();
    else setDErr(r.j.error || 'Erreur.');
  }

  return (
    <>
      <h1>Profil</h1>

      <div className="card">
        <h2>Compte</h2>
        <p style={{ margin: 0 }}>
          Connecté en tant que <b>{email}</b>
        </p>
      </div>

      <div className="card">
        <h2>VMA</h2>
        <p className="note" style={{ marginBottom: 8 }}>
          Ta Vitesse Maximale Aérobie (km/h) sert à pré-remplir les allures
          cibles dans le créateur.
        </p>
        <div className="grid">
          <label>
            VMA (km/h)
            <input
              type="number"
              step="0.1"
              min={8}
              max={30}
              inputMode="decimal"
              value={vma}
              onChange={(e) => setVma(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="copy" style={{ margin: 0, width: '100%' }} onClick={vmaGo}>
              Enregistrer la VMA
            </button>
          </div>
        </div>
        {vmaMsg && (
          <p className="note" style={{ marginTop: 6 }}>
            {vmaMsg}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Compte Garmin</h2>
        <p className="note" style={{ marginBottom: 6 }}>
          {gLinked === null
            ? 'Vérification de la connexion Garmin…'
            : gLinked
              ? 'Compte Garmin : connecté ✅'
              : gOwnerEnv
                ? 'Compte Garmin du serveur utilisé (propriétaire).'
                : 'Compte Garmin : non connecté.'}
        </p>
        {gLinked === false && (
          <div>
            <div className="grid">
              <label>
                E-mail Garmin
                <input
                  type="email"
                  autoComplete="off"
                  value={gMail}
                  onChange={(e) => setGMail(e.target.value)}
                />
              </label>
              <label>
                Mot de passe Garmin
                <input
                  type="password"
                  autoComplete="off"
                  value={gPw}
                  onChange={(e) => setGPw(e.target.value)}
                />
              </label>
            </div>
            {gMfa && (
              <div style={{ marginTop: 8 }}>
                <label>
                  Code de vérification Garmin
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={gCode}
                    onChange={(e) => setGCode(e.target.value)}
                  />
                </label>
              </div>
            )}
            {gErr && <p className="err">{gErr}</p>}
            <button className="copy" style={{ margin: '8px 0 6px' }} onClick={gGo} disabled={gBusy}>
              {gMfa ? 'Valider le code' : 'Connecter mon compte Garmin'}
            </button>
            <p className="note">
              Ton mot de passe sert une seule fois : il n’est jamais enregistré,
              seuls des jetons chiffrés le sont.
            </p>
          </div>
        )}
        {gLinked === true && (
          <button className="mini" onClick={gOff}>
            Déconnecter Garmin
          </button>
        )}
      </div>

      <div className="card">
        <h2>Mot de passe</h2>
        <div className="grid">
          <label>
            Mot de passe actuel
            <input
              type="password"
              autoComplete="current-password"
              value={pCur}
              onChange={(e) => setPCur(e.target.value)}
            />
          </label>
          <label>
            Nouveau mot de passe (12 caractères min.)
            <input
              type="password"
              autoComplete="new-password"
              value={pNew}
              onChange={(e) => setPNew(e.target.value)}
            />
          </label>
        </div>
        {pMsg && (
          <p className="note" style={{ margin: '8px 0' }}>
            {pMsg}
          </p>
        )}
        <button className="copy" style={{ margin: 0 }} onClick={pGo}>
          Changer le mot de passe
        </button>
      </div>

      <div className="card">
        <h2>Supprimer mon compte</h2>
        <p className="note" style={{ marginBottom: 8 }}>
          Supprime définitivement ton compte, tes séances et le lien Garmin.
        </p>
        <label>
          Mot de passe
          <input
            type="password"
            autoComplete="current-password"
            value={dPw}
            onChange={(e) => setDPw(e.target.value)}
          />
        </label>
        {dErr && <p className="err">{dErr}</p>}
        <button className="mini" style={{ marginTop: 8 }} onClick={dGo}>
          Supprimer mon compte
        </button>
      </div>
    </>
  );
}
