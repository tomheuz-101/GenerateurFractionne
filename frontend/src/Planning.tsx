import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Workout } from './types';

interface PlanDay {
  id: number;
  week: number;
  weekday: number;
  workoutId: number | null;
  workoutName: string | null;
  label: string | null;
  done: boolean;
}

interface Plan {
  id: number;
  name: string;
  weeks: number;
  start: string;
  days: PlanDay[];
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - day);
  x.setHours(12, 0, 0, 0);
  return x;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function Planning() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [curId, setCurId] = useState<number | null>(null);
  const [state, setState] = useState('Chargement…');
  const [newName, setNewName] = useState('');
  const [newWeeks, setNewWeeks] = useState('4');

  useEffect(() => {
    (async () => {
      const [rp, rw] = await Promise.all([
        api<{ plans: Plan[] }>('/api/plans'),
        api<{ workouts: Workout[] }>('/api/workouts'),
      ]);
      const ps = rp.ok ? rp.j.plans ?? [] : [];
      setPlans(ps);
      setWorkouts(rw.ok ? rw.j.workouts ?? [] : []);
      setCurId(ps.length ? ps[0].id : null);
      setState(rp.ok ? '' : 'Impossible de charger les plans.');
    })();
  }, []);

  const cur = useMemo(
    () => plans.find((p) => p.id === curId) ?? null,
    [plans, curId],
  );

  const createPlan = async () => {
    const name = newName.trim();
    if (!name) return;
    const r = await api<{ plan: Plan }>('/api/plans', 'POST', {
      name,
      weeks: Number(newWeeks) || 4,
    });
    if (!r.ok || !r.j.plan) {
      setState('Création impossible.');
      return;
    }
    setPlans((prev) => [r.j.plan, ...prev]);
    setCurId(r.j.plan.id);
    setNewName('');
  };

  const removePlan = async (id: number) => {
    const p = plans.find((x) => x.id === id);
    if (!p || !window.confirm('Supprimer le plan « ' + p.name + ' » ?')) return;
    const r = await api('/api/plans/' + id, 'DELETE');
    if (!r.ok) {
      setState('Suppression impossible.');
      return;
    }
    const rest = plans.filter((x) => x.id !== id);
    setPlans(rest);
    setCurId(rest.length ? rest[0].id : null);
  };

  const setDay = async (day: PlanDay, patch: Record<string, unknown>) => {
    if (!cur) return;
    const r = await api('/api/plans/' + cur.id + '/days/' + day.id, 'PUT', patch);
    if (!r.ok) {
      setState('Modification impossible.');
      return;
    }
    setPlans((prev) =>
      prev.map((p) =>
        p.id !== cur.id
          ? p
          : {
              ...p,
              days: p.days.map((d) =>
                d.id !== day.id
                  ? d
                  : { ...d, ...patch, done: false } as PlanDay,
              ),
            },
      ),
    );
  };

  const toggleDone = async (day: PlanDay) => {
    if (!cur) return;
    const done = !day.done;
    const r = await api('/api/plans/' + cur.id + '/days/' + day.id + '/done', 'PUT', { done });
    if (!r.ok) {
      setState('Modification impossible.');
      return;
    }
    setPlans((prev) =>
      prev.map((p) =>
        p.id !== cur.id
          ? p
          : { ...p, days: p.days.map((d) => (d.id === day.id ? { ...d, done } : d)) },
      ),
    );
  };

  const base = cur ? startOfWeek(new Date(cur.start + 'T12:00:00Z')) : null;

  return (
    <>
      <h1>Planning</h1>

      <div className="card">
        <div className="grid">
          <label>
            Nouveau plan
            <input
              value={newName}
              placeholder="Prépa 10 km"
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <label>
            Semaines
            <input
              type="number"
              min={1}
              max={30}
              value={newWeeks}
              onChange={(e) => setNewWeeks(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="copy" type="button" style={{ margin: 0, width: '100%' }} onClick={createPlan}>
              Créer
            </button>
          </div>
        </div>
        {state && <p className="note">{state}</p>}
      </div>

      {plans.length === 0 && !state && (
        <p className="note">Aucun plan : crée-en un ci-dessus.</p>
      )}

      {plans.length > 0 && (
        <div className="card">
          <div className="grid">
            <label>
              Plan affiché
              <select value={curId ?? ''} onChange={(e) => setCurId(Number(e.target.value))}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            {cur && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="mini" type="button" style={{ width: '100%' }} onClick={() => removePlan(cur.id)}>
                  Supprimer ce plan
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {cur && base && (
        <div className="card">
          <p className="note" style={{ marginBottom: 10 }}>
            Début : {cur.start} · {cur.weeks} semaines
          </p>
          {Array.from({ length: cur.weeks }, (_, wi) => wi + 1).map((week) => (
            <div className="pweek" key={week}>
              <h3>Semaine {week}</h3>
              <div className="pdays">
                {Array.from({ length: 7 }, (_, di) => di + 1).map((weekday) => {
                  const day = cur.days.find((d) => d.week === week && d.weekday === weekday);
                  if (!day) return null;
                  const d = new Date(base);
                  d.setDate(d.getDate() + (week - 1) * 7 + (weekday - 1));
                  const today = isoDate(new Date()) === isoDate(d);
                  return (
                    <div className={'pday' + (today ? ' today' : '') + (day.done ? ' done' : '')} key={day.id}>
                      <div className="pday-h">
                        <b>{WEEKDAYS[weekday - 1]} {d.getDate()}</b>
                        {day.workoutId && (
                          <button
                            className="mini"
                            type="button"
                            aria-label={day.done ? 'Marquer non fait' : 'Marquer fait'}
                            onClick={() => toggleDone(day)}
                          >
                            {day.done ? '✓' : '○'}
                          </button>
                        )}
                      </div>
                      {day.workoutId ? (
                        <small className="pday-name">{day.workoutName}</small>
                      ) : (
                        <input
                          value={day.label ?? ''}
                          placeholder="Repos / texte libre…"
                          onChange={(e) => setDay(day, { label: e.target.value })}
                        />
                      )}
                      <select
                        value={day.workoutId ?? ''}
                        onChange={(e) =>
                          setDay(day, { workoutId: e.target.value ? Number(e.target.value) : null })
                        }
                      >
                        <option value="">— Séance —</option>
                        {workouts.map((w) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
