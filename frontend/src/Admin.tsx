import { useEffect, useState } from 'react';
import { api } from './api';

interface AdminUser {
  id: number;
  email: string;
  garmin: boolean;
  workouts: number;
}

interface AdminInvite {
  id: number;
  email: string | null;
  used: boolean;
  usedByEmail: string | null;
}

export default function Admin({ meEmail }: { meEmail: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [newCode, setNewCode] = useState('');

  async function loadUsers() {
    const r = await api<{ users: AdminUser[] }>('/api/admin/users');
    if (r.ok) setUsers(r.j.users || []);
  }

  async function loadInvites() {
    const r = await api<{ invites: AdminInvite[] }>('/api/admin/invites');
    if (r.ok) setInvites(r.j.invites || []);
  }

  useEffect(() => {
    loadUsers();
    loadInvites();
  }, []);

  async function createInvite() {
    setNewCode('');
    const r = await api<{ code: string }>('/api/admin/invites', 'POST');
    if (r.ok && r.j.code) setNewCode(r.j.code);
    loadInvites();
  }

  async function removeInvite(id: number) {
    await api('/api/admin/invites/' + id, 'DELETE');
    loadInvites();
  }

  async function resetPassword(id: number, mail: string) {
    if (!window.confirm('Générer un mot de passe temporaire pour ' + mail + ' ?')) return;
    const r = await api<{ password: string }>(
      '/api/admin/users/' + id + '/password',
      'POST',
    );
    if (r.ok && r.j.password) {
      window.prompt(
        'Mot de passe temporaire (à transmettre à ' + mail + ') :',
        r.j.password,
      );
    }
  }

  async function removeUser(id: number, mail: string) {
    if (!window.confirm('Supprimer ' + mail + ' et toutes ses séances ?')) return;
    await api('/api/admin/users/' + id, 'DELETE');
    loadUsers();
  }

  return (
    <>
      <h1>Administration</h1>

      <div className="card">
        <h2>Invitations</h2>
        <p className="note" style={{ marginBottom: 8 }}>
          Chaque code est à usage unique : donne-le à la personne, elle le
          saisit à la création de son compte. Le code n’est affiché qu’une
          seule fois, juste après sa création.
        </p>
        <button className="copy" style={{ margin: '0 0 10px' }} onClick={createInvite}>
          Créer une invitation
        </button>
        {newCode && (
          <p className="note">
            Nouveau code (à transmettre maintenant) : <code>{newCode}</code>
          </p>
        )}
        <ol style={{ padding: 0, listStyle: 'none', margin: 0 }}>
          {invites.length === 0 && <li>Aucune invitation.</li>}
          {invites.map((i) => (
            <li key={i.id} className="row">
              <span className="nm">
                <code>••••••</code>
                <br />
                <small>
                  {i.used
                    ? 'utilisé' + (i.usedByEmail ? ' par ' + i.usedByEmail : '')
                    : 'disponible' + (i.email ? ' (réservé à ' + i.email + ')' : '')}
                </small>
              </span>
              {!i.used && (
                <button className="mini" onClick={() => removeInvite(i.id)}>
                  Supprimer
                </button>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h2>Utilisateurs</h2>
        <ol style={{ padding: 0, listStyle: 'none', margin: 0 }}>
          {users.map((u) => (
            <li key={u.id} className="row">
              <span className="nm">
                <b>{u.email}</b>
                {u.email === meEmail ? ' (vous)' : ''}
                <br />
                <small>
                  {u.workouts} séance(s) · Garmin{' '}
                  {u.garmin ? 'connecté' : 'non connecté'}
                </small>
              </span>
              <span className="row-actions">
                <button className="mini" onClick={() => resetPassword(u.id, u.email)}>
                  Mot de passe temporaire
                </button>
                {u.email !== meEmail && (
                  <button className="mini" onClick={() => removeUser(u.id, u.email)}>
                    Supprimer
                  </button>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
