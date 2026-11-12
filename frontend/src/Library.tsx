import { useEffect, useMemo, useState } from 'react';
import { api, dur } from './api';
import type { Step, Workout } from './types';

function stepDuration(x: Step): number {
  if (x.kind === 'time') return x.value;
  const pmin = x.paceMinSecPerKm;
  const pmax = x.paceMaxSecPerKm;
  if (pmin && pmax) return (x.value / 1000) * ((pmin + pmax) / 2);
  return (x.value / 1000) * 300;
}

function total(w: Workout): number {
  return (w.data?.steps ?? []).reduce((a, x) => a + stepDuration(x), 0);
}

function intervalsCount(w: Workout): number {
  return (w.data?.steps ?? []).filter((x) => x.type === 'interval').length;
}

export default function Library() {
  const [items, setItems] = useState<Workout[]>([]);
  const [q, setQ] = useState('');
  const [state, setState] = useState('Chargement…');

  useEffect(() => {
    (async () => {
      const r = await api<{ workouts: Workout[] }>('/api/workouts');
      if (!r.ok) {
        setState('Impossible de charger la bibliothèque.');
        return;
      }
      setItems(r.j.workouts ?? []);
      setState('');
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((w) => w.name.toLowerCase().includes(needle));
  }, [items, q]);

  const goCreator = (id: number) => {
    window.location.href = '/?open=' + id + '#/';
  };

  const rename = async (w: Workout) => {
    const name = window.prompt('Nouveau nom :', w.name)?.trim();
    if (!name || name === w.name) return;
    const r = await api('/api/workouts/' + w.id, 'PUT', { name });
    if (!r.ok) {
      window.alert('Renommage impossible.');
      return;
    }
    setItems((prev) => prev.map((x) => (x.id === w.id ? { ...x, name } : x)));
  };

  const duplicate = async (w: Workout) => {
    const r = await api<{ workout: Workout }>('/api/workouts/' + w.id + '/duplicate', 'POST');
    if (!r.ok || !r.j.workout) {
      window.alert('Duplication impossible.');
      return;
    }
    setItems((prev) => [r.j.workout, ...prev]);
  };

  const remove = async (w: Workout) => {
    if (!window.confirm('Supprimer « ' + w.name + ' » ?')) return;
    const r = await api('/api/workouts/' + w.id, 'DELETE');
    if (!r.ok) {
      window.alert('Suppression impossible.');
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== w.id));
  };

  return (
    <>
      <h1>Bibliothèque</h1>
      <div className="card">
        <input
          value={q}
          placeholder="Rechercher une séance…"
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {state && <p className="note">{state}</p>}
      <div className="card">
        {filtered.length === 0 && !state && (
          <p className="note">Aucune séance. Crée-en une dans le créateur.</p>
        )}
        {filtered.map((w) => (
          <div className="wk-row" key={w.id}>
            <div className="wk-info">
              <b>{w.name}</b>
              <small>
                {intervalsCount(w)} efforts · {dur(total(w))}
              </small>
            </div>
            <div className="wk-actions">
              <button className="mini" type="button" onClick={() => goCreator(w.id)}>Ouvrir</button>
              <button className="mini" type="button" onClick={() => rename(w)}>Renommer</button>
              <button className="mini" type="button" onClick={() => duplicate(w)}>Dupliquer</button>
              <button className="del" type="button" onClick={() => remove(w)}>×</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
