
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';

export function useGarmin(setMsg: (message: string) => void) {
  const [linked, setLinked] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfa, setMfa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ linked: boolean }>('/api/garmin/status').then((r) => {
      if (r.ok) setLinked(Boolean(r.j.linked));
    });
  }, []);

  const connect = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('E-mail et mot de passe Garmin requis.');
      return;
    }

    setBusy(true);
    try {
      const r = await api<{ mfaRequired?: boolean; error?: string }>(
        '/api/garmin/connect',
        'POST',
        { email: email.trim(), password },
      );

      if (r.j.mfaRequired) {
        setMfa(true);
        return;
      }

      if (!r.ok) {
        setError(r.j.error || 'Connexion Garmin refusée.');
        return;
      }

      setLinked(true);
      setOpen(false);
      setMfa(false);
      setPassword('');
      setCode('');
      setMsg('Compte Garmin connecté.');
    } finally {
      setBusy(false);
    }
  };

  const submitMfa = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');

    if (!code.trim()) {
      setError('Entre le code de vérification.');
      return;
    }

    setBusy(true);
    try {
      const r = await api<{ error?: string }>(
        '/api/garmin/mfa',
        'POST',
        { code: code.trim() },
      );

      if (!r.ok) {
        setError(r.j.error || 'Code refusé.');
        return;
      }

      setLinked(true);
      setOpen(false);
      setMfa(false);
      setPassword('');
      setCode('');
      setMsg('Compte Garmin connecté.');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await api('/api/garmin/disconnect', 'POST');
    setLinked(false);
    setOpen(false);
    setMsg('Compte Garmin déconnecté.');
  };

  const openConnection = () => {
    setError('');
    setMfa(false);
    setOpen(true);
  };

  return {
    linked,
    open,
    setOpen,
    email,
    setEmail,
    password,
    setPassword,
    code,
    setCode,
    mfa,
    setMfa,
    busy,
    error,
    connect,
    submitMfa,
    disconnect,
    openConnection,
  };
}
