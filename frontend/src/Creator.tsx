import { useEffect, useMemo, useState } from 'react';
import { api, mmss, dur, parsePace } from './api';
import { STEP_NAMES, TYPE_LABELS } from './types';
import type { Block, Step, StepType, Workout } from './types';

type WorkoutType = 'normal' | 'pyramide' | 'descendant' | 'ascendant' | 'blocs';

const BAR_HEIGHT: Record<StepType, number> = {
  warmup: 38,
  cooldown: 38,
  recovery: 20,
  interval: 100,
};

const DEF: Record<'m' | 's', Record<string, number>> = {
  m: { val: 400, min: 200, max: 600, step: 200 },
  s: { val: 60, min: 30, max: 90, step: 30 },
};

const FIELDS = [
  'paceMin', 'paceMax', 'reps', 'val', 'min', 'max',
  'step', 'rec', 'sets', 'srec', 'wu', 'cd',
] as const;

type FieldKey = (typeof FIELDS)[number];

const DEFAULT_FIELDS: Record<FieldKey, string> = {
  paceMin: '', paceMax: '',
  reps: '8', val: '400', min: '200', max: '600', step: '200',
  rec: '90', sets: '1', srec: '180', wu: '15', cd: '10',
};

interface Template {
  n: string;
  t: WorkoutType;
  u: 'm' | 's';
  f: Partial<Record<FieldKey, string>>;
  b?: Block[];
}

const TPL: Template[] = [
  { n: '10 × 400 m', t: 'normal', u: 'm', f: { reps: '10', val: '400', rec: '90' } },
  { n: '5 × 1000 m', t: 'normal', u: 'm', f: { reps: '5', val: '1000', rec: '120' } },
  { n: 'Pyramide 200-800 m', t: 'pyramide', u: 'm', f: { min: '200', max: '800', step: '200', rec: '90' } },
  { n: 'Descendant 1000-200 m', t: 'descendant', u: 'm', f: { min: '200', max: '1000', step: '200', rec: '90' } },
  { n: 'Seuil 3 × 10 min', t: 'normal', u: 's', f: { reps: '3', val: '600', rec: '120' } },
  { n: '30/30 × 12', t: 'normal', u: 's', f: { reps: '12', val: '30', rec: '30' } },
  {
    n: 'Blocs 5 × 400 m + 3 × 1000 m', t: 'blocs', u: 'm', f: { wu: '15', cd: '10' },
    b: [
      { reps: 5, unit: 'm', val: 400, rec: 60, paceMin: '', paceMax: '', rep: 1, brec: 120 },
      { reps: 3, unit: 'm', val: 1000, rec: 120, paceMin: '', paceMax: '', rep: 1, brec: 0 },
    ],
  },
];

const DEFAULT_BLOCKS: Block[] = [
  { reps: 5, unit: 'm', val: 400, rec: 60, paceMin: '', paceMax: '', rep: 1, brec: 120 },
  { reps: 3, unit: 'm', val: 1000, rec: 120, paceMin: '', paceMax: '', rep: 1, brec: 0 },
];

function valuesFor(t: WorkoutType, f: Record<FieldKey, string>): number[] {
  const n = Number(f.reps);
  const v = Number(f.val);
  const lo = Number(f.min);
  const hi = Number(f.max);
  const st = Math.max(1, Number(f.step));

  if (t === 'normal') {
    return n > 0 && v > 0 ? Array(Math.min(n, 60)).fill(v) : [];
  }

  const up: number[] = [];
  for (let x = lo, i = 0; x <= hi && i < 60; x += st, i += 1) up.push(x);

  if (t === 'pyramide') return up.concat(up.slice(0, -1).reverse());
  return t === 'descendant' ? up.slice().reverse() : up;
}

function blockSteps(blocks: Block[], f: Record<FieldKey, string>): Step[] {
  const out: Step[] = [];
  const wu = Math.max(0, Number(f.wu) || 0) * 60;
  const cd = Math.max(0, Number(f.cd) || 0) * 60;
  const clamp = (v: unknown, max: number) =>
    Math.min(Math.max(1, Math.round(Number(v)) || 1), max);

  if (wu > 0) out.push({ type: 'warmup', kind: 'time', value: wu });

  const runs: { b: Block; n: number }[] = [];
  blocks.forEach((b) => {
    const n = clamp(b.reps, 60);
    for (let k = 0; k < clamp(b.rep, 20); k += 1) runs.push({ b, n });
  });

  runs.forEach((r, k) => {
    const b = r.b;
    const v = Number(b.val);
    const rec = Math.max(0, Number(b.rec) || 0);
    const pmin = parsePace(b.paceMin);
    const pmax = parsePace(b.paceMax);
    const okPace = pmin !== null && pmax !== null && pmin <= pmax;

    if (v > 0) {
      for (let i = 0; i < r.n; i += 1) {
        const s: Step = {
          type: 'interval',
          kind: b.unit === 'm' ? 'distance' : 'time',
          value: v,
        };
        if (okPace) {
          s.paceMinSecPerKm = pmin;
          s.paceMaxSecPerKm = pmax;
        }
        out.push(s);
        if (i < r.n - 1 && rec > 0) {
          out.push({ type: 'recovery', kind: 'time', value: rec });
        }
      }
    }

    const brec = Math.max(0, Number(b.brec) || 0);
    if (k < runs.length - 1 && brec > 0) {
      out.push({ type: 'recovery', kind: 'time', value: brec });
    }
  });

  if (cd > 0) out.push({ type: 'cooldown', kind: 'time', value: cd });
  return out;
}

function buildSteps(
  t: WorkoutType,
  unit: 'm' | 's',
  f: Record<FieldKey, string>,
  blocks: Block[],
): Step[] {
  if (t === 'blocs') return blockSteps(blocks, f);

  const vs = valuesFor(t, f);
  const rec = Math.max(0, Number(f.rec) || 0);
  const wu = Math.max(0, Number(f.wu) || 0) * 60;
  const cd = Math.max(0, Number(f.cd) || 0) * 60;
  const paceMin = parsePace(f.paceMin);
  const paceMax = parsePace(f.paceMax);
  const validRange = paceMin !== null && paceMax !== null && paceMin <= paceMax;

  const out: Step[] = [];
  if (wu > 0) out.push({ type: 'warmup', kind: 'time', value: wu });

  const ns = Math.min(Math.max(1, Math.round(Number(f.sets)) || 1), 20);
  const sr = Math.max(0, Number(f.srec) || 0);

  for (let k = 0; k < ns; k += 1) {
    if (k > 0 && sr > 0) out.push({ type: 'recovery', kind: 'time', value: sr });

    vs.forEach((x, i) => {
      const s: Step = {
        type: 'interval',
        kind: unit === 'm' ? 'distance' : 'time',
        value: x,
      };
      if (validRange) {
        s.paceMinSecPerKm = paceMin;
        s.paceMaxSecPerKm = paceMax;
      }
      out.push(s);
      if (i < vs.length - 1 && rec > 0) {
        out.push({ type: 'recovery', kind: 'time', value: rec });
      }
    });
  }

  if (cd > 0) out.push({ type: 'cooldown', kind: 'time', value: cd });
  return out;
}

function stepDuration(x: Step): number {
  if (x.kind === 'time') return x.value;
  const pmin = x.paceMinSecPerKm;
  const pmax = x.paceMaxSecPerKm;
  if (pmin && pmax) return (x.value / 1000) * ((pmin + pmax) / 2);
  return (x.value / 1000) * 300;
}

const showField = (key: FieldKey, t: WorkoutType): boolean => {
  if (t === 'blocs') return key === 'wu' || key === 'cd';
  if (key === 'reps' || key === 'val') return t === 'normal';
  return true;
};

const FIELD_LABELS: Record<FieldKey, string> = {
  paceMin: 'Allure minimale', paceMax: 'Allure maximale',
  reps: 'Répétitions', val: 'Valeur de l’effort',
  min: 'Plus court', max: 'Plus long', step: 'Pas',
  rec: 'Récupération (s)', sets: 'Nombre de séries',
  srec: 'Récup entre séries (s)', wu: 'Échauffement (min)',
  cd: 'Retour au calme (min)',
};

export default function Creator() {
  const [type, setType] = useState<WorkoutType>('pyramide');
  const [unit, setUnit] = useState<'m' | 's'>('m');
  const [fields, setFields] = useState<Record<FieldKey, string>>({ ...DEFAULT_FIELDS });
  const [blocks, setBlocks] = useState<Block[]>(DEFAULT_BLOCKS.map((b) => ({ ...b })));
  const [steps, setSteps] = useState<Step[]>([]);
  const [wName, setWName] = useState('');
  const [curId, setCurId] = useState<number | null>(null);
  const [wState, setWState] = useState('Nouvelle séance · Ma bibliothèque');
  const [msg, setMsg] = useState('Étape suivante : envoi vers Garmin Connect.');
  const [vma, setVma] = useState<number | null>(null);

  // Étapes recalculées dès qu'un réglage change
  useEffect(() => {
    setSteps(buildSteps(type, unit, fields, blocks));
  }, [type, unit, fields, blocks]);

  useEffect(() => {
    api<{ vma: number | null }>('/api/auth/me').then((r) => {
      if (r.ok && r.j.vma) setVma(r.j.vma);
    });
  }, []);

  // Ouverture depuis la bibliothèque ou le planning : /?open=ID
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (!id) return;
    (async () => {
      const r = await api<{ workouts: Workout[] }>('/api/workouts');
      const w = (r.j.workouts || []).find((x) => String(x.id) === id);
      if (!w) { setWState('Séance introuvable.'); return; }
      const d = w.data;
      setType((d.type as WorkoutType) || 'pyramide');
      setUnit(d.unit || 'm');
      if (d.f) setFields((prev) => ({ ...prev, ...d.f }));
      if (d.blocks) setBlocks(d.blocks.map((b) => ({ ...b })));
      setSteps(d.steps || []);
      setWName(w.name);
      setCurId(w.id);
      setWState('Modification de « ' + w.name + ' »');
    })();
  }, []);

  const setField = (key: FieldKey, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const intervals = steps.filter((x) => x.type === 'interval');

  const summary = useMemo(() => {
    if (!intervals.length) return { tot: 0, km: null as number | null, est: '' };
    const tot = steps.reduce((a, x) => a + stepDuration(x), 0);
    let km = 0;
    let known = true;
    intervals.forEach((x) => {
      if (x.kind === 'distance') km += x.value / 1000;
      else if (x.paceMinSecPerKm && x.paceMaxSecPerKm) {
        km += x.value / ((x.paceMinSecPerKm + x.paceMaxSecPerKm) / 2);
      } else known = false;
    });
    if (!known) km = null;
    const est = intervals.some((x) => x.kind === 'distance' && !x.paceMinSecPerKm)
      ? 'Durée estimée sur une base de 5:00/km pour les efforts sans allure.'
      : 'Durée estimée à partir de l’allure moyenne de chaque plage.';
    return { tot, km, est };
  }, [steps]);

  const jsonText = useMemo(() => {
    if (!intervals.length) return '';
    const label = TYPE_LABELS[type] || 'Fractionné';
    return JSON.stringify(
      { name: label + ' ' + intervals.length + ' efforts', steps },
      null,
      2,
    );
  }, [steps, type]);

  const updateStep = (index: number, patch: Partial<Step>) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const moveStep = (index: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const applyTemplate = (t: Template) => {
    setType(t.t);
    setUnit(t.u);
    setFields({ ...DEFAULT_FIELDS, ...t.f });
    setBlocks(t.b ? t.b.map((b) => ({ ...b })) : DEFAULT_BLOCKS.map((b) => ({ ...b })));
    setWName(t.n);
    setCurId(null);
    setWState('Nouvelle séance (modèle).');
  };

  const vmaFill = () => {
    if (!vma) return;
    setFields((prev) => ({
      ...prev,
      paceMin: prev.paceMin || mmss(3600 / vma),
      paceMax: prev.paceMax || mmss(3600 / (0.9 * vma)),
    }));
  };

  const save = async () => {
    const name = wName.trim();
    if (!name) { setWState('Donne un nom à la séance.'); return; }
    if (!steps.length) { setWState('La séance est vide.'); return; }
    const body = { name, data: { type, unit, f: fields, steps, blocks } };
    const r = curId
      ? await api('/api/workouts/' + curId, 'PUT', body)
      : await api('/api/workouts', 'POST', body);
    if (!r.ok) {
      setWState((r.j as { error?: string }).error || 'Erreur d’enregistrement.');
      return;
    }
    setCurId((r.j as { workout: Workout }).workout.id);
    setWState('Enregistrée : « ' + name + ' » · Ma bibliothèque');
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setMsg('JSON copié.');
    } catch {
      setMsg('Copie impossible : sélectionne le texte manuellement.');
    }
  };

  return (
    <>
      <h1>Générateur de fractionné</h1>

      <div className="card">
        <h2>1 · Modèles</h2>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(2,1fr)', margin: 0 }}>
          {TPL.map((t) => (
            <button key={t.n} type="button" onClick={() => applyTemplate(t)}>
              {t.n}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>2 · Type et réglages</h2>
        <div className="seg">
          {(Object.keys(TYPE_LABELS) as WorkoutType[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="grid">
          <label>
            Unité des efforts
            <select
              value={unit}
              onChange={(e) => {
                const u = e.target.value as 'm' | 's';
                setUnit(u);
                setFields((prev) => ({ ...prev, ...DEF[u] } as Record<FieldKey, string>));
              }}
            >
              <option value="m">Distance (m)</option>
              <option value="s">Temps (s)</option>
            </select>
          </label>
          <div />
        </div>

        <div className="grid">
          <div className="pace-title">Plage d’allure cible des efforts (min/km)</div>
          {vma !== null && (
            <button className="mini" type="button" style={{ justifySelf: 'start' }} onClick={vmaFill}>
              ⚡ Pré-remplir les allures (VMA {String(vma).replace('.', ',')} km/h)
            </button>
          )}
          {FIELDS.filter(showField.bind(null, undefined as never) && ((k) => k !== 'paceMin' && k !== 'paceMax')(undefined as never)).length === 0 && null}
          {FIELDS.filter((k) => k === 'paceMin' || k === 'paceMax').map((k) => (
            <label key={k}>
              {FIELD_LABELS[k]}
              <input
                value={fields[k]}
                placeholder={k === 'paceMin' ? '4:10' : '4:20'}
                inputMode="numeric"
                onChange={(e) => setField(k, e.target.value)}
              />
            </label>
          ))}
          {FIELDS.filter((k) => k !== 'paceMin' && k !== 'paceMax' && showField(k, type)).map((k) => (
            <label key={k}>
              {FIELD_LABELS[k]}
              <input
                type="number"
                min={k === 'rec' || k === 'srec' || k === 'wu' || k === 'cd' ? 0 : 1}
                max={k === 'sets' ? 20 : undefined}
                value={fields[k]}
                onChange={(e) => setField(k, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

      {type === 'blocs' && (
        <div className="card">
          <h2>Blocs</h2>
          <p className="note" style={{ marginBottom: 10 }}>
            Enchaîne autant de blocs que tu veux : chacun a ses répétitions, sa récupération,
            son allure cible, et peut être répété. L’échauffement et le retour au calme se
            règlent plus haut.
          </p>
          {blocks.map((b, i) => (
            <div className="bk" key={i}>
              <div className="bkh">
                <b>Bloc {i + 1}</b>
                <span>
                  <button className="mini" type="button" aria-label="Monter" onClick={() => setBlocks((prev) => {
                    const next = [...prev]; if (i > 0) { [next[i - 1], next[i]] = [next[i], next[i - 1]]; } return next;
                  })}>↑</button>
                  <button className="mini" type="button" aria-label="Descendre" onClick={() => setBlocks((prev) => {
                    const next = [...prev]; if (i < next.length - 1) { [next[i + 1], next[i]] = [next[i], next[i + 1]]; } return next;
                  })}>↓</button>
                  <button className="mini" type="button" onClick={() => setBlocks((prev) => {
                    const next = [...prev]; next.splice(i + 1, 0, { ...prev[i] }); return next;
                  })}>Dupliquer</button>
                  <button className="mini" type="button" onClick={() => setBlocks((prev) => {
                    if (prev.length > 1) return prev.filter((_, j) => j !== i); return prev;
                  })}>Supprimer</button>
                </span>
              </div>
              <div className="grid">
                <label>Répétitions
                  <input type="number" min={1} value={b.reps}
                    onChange={(e) => setBlocks((prev) => prev.map((x, j) => j === i ? { ...x, reps: Number(e.target.value) } : x))} />
                </label>
                <label>Effort en
                  <select value={b.unit}
                    onChange={(e) => setBlocks((prev) => prev.map((x, j) => j === i ? { ...x, unit: e.target.value as 'm' | 's' } : x))}>
                    <option value="m">Distance (m)</option>
                    <option value="s">Temps (s)</option>
                  </select>
                </label>
                <label>Valeur de l’effort
                  <input type="number" min={1} value={b.val}
                    onChange={(e) => setBlocks((prev) => prev.map((x, j) => j === i ? { ...x, val: Number(e.target.value) } : x))} />
                </label>
                <label>Récup entre répétitions (s)
                  <input type="number" min={0} value={b.rec}
                    onChange={(e) => setBlocks((prev) => prev.map((x, j) => j === i ? { ...x, rec: Number(e.target.value) } : x))} />
                </label>
                <label>Allure min (min/km)
                  <input value={b.paceMin} placeholder="4:10" inputMode="numeric"
                    onChange={(e) => setBlocks((prev) => prev.map((x, j) => j === i ? { ...x, paceMin: e.target.value } : x))} />
                </label>
                <label>Allure max (min/km)
                  <input value={b.paceMax} placeholder="4:20" inputMode="numeric"
                    onChange={(e) => setBlocks((prev) => prev.map((x, j) => j === i ? { ...x, paceMax: e.target.value } : x))} />
                </label>
                <label>Répéter le bloc ×
                  <input type="number" min={1} max={20} value={b.rep}
                    onChange={(e) => setBlocks((prev) => prev.map((x, j) => j === i ? { ...x, rep: Number(e.target.value) } : x))} />
                </label>
                <label>Récup après le bloc (s)
                  <input type="number" min={0} value={b.brec}
                    onChange={(e) => setBlocks((prev) => prev.map((x, j) => j === i ? { ...x, brec: Number(e.target.value) } : x))} />
                </label>
              </div>
            </div>
          ))}
          <button className="mini" type="button" onClick={() => setBlocks((prev) => [
            ...prev, { reps: 4, unit: 'm', val: 400, rec: 60, paceMin: '', paceMax: '', rep: 1, brec: 120 },
          ])}>+ Ajouter un bloc</button>
        </div>
      )}

      <h2>3 · Aperçu</h2>
      <div className="card">
        <div id="bars" aria-label="Profil de la séance">
          {steps.map((x, i) => {
            const u = x.kind === 'distance' ? x.value + ' m' : mmss(x.value);
            const pace = x.type === 'interval' && x.paceMinSecPerKm && x.paceMaxSecPerKm
              ? ' @ ' + mmss(x.paceMinSecPerKm) + '-' + mmss(x.paceMaxSecPerKm) : '';
            let style: React.CSSProperties = {
              flex: stepDuration(x) + ' 1 0',
              height: BAR_HEIGHT[x.type] + '%',
            };
            if (x.type === 'interval' && x.paceMinSecPerKm && x.paceMaxSecPerKm) {
              const p = (x.paceMinSecPerKm + x.paceMaxSecPerKm) / 2;
              const op = Math.min(1, Math.max(0.55, 0.55 + (300 - p) / 240));
              style = { ...style, opacity: op };
            }
            return <i key={i} className={x.type} data-tip={STEP_NAMES[x.type] + ' ' + u + pace} style={style} />;
          })}
        </div>
        <div id="axis">
          {intervals.length > 0 && (
            <>
              <span>0:00</span>
              <span>{mmss(summary.tot / 4)}</span>
              <span>{mmss(summary.tot / 2)}</span>
              <span>{mmss((3 * summary.tot) / 4)}</span>
              <span>{mmss(summary.tot)}</span>
            </>
          )}
        </div>
        <div id="sum">
          {intervals.length > 0 &&
            intervals.length + ' efforts' +
            (summary.km !== null ? ' · ' + summary.km.toFixed(2).replace('.', ',') + ' km d’effort' : '') +
            ' · ' + dur(summary.tot)}
        </div>
        {intervals.length > 0 && <p className="note">{summary.est}</p>}
      </div>

      <div className="card">
        <h2>4 · Étapes</h2>
        <p className="note" style={{ marginBottom: 8 }}>
          Modifie chaque étape : distance, durée et plage d’allure des efforts.
          Réorganise avec ↑ ↓, duplique avec ⧉, supprime avec ×.
          Les réglages du haut régénèrent la séance.
        </p>
        <ol>
          {steps.length === 0 && <li>Aucun palier : vérifie les valeurs saisies.</li>}
          {steps.map((x, i) => (
            <li key={i} className={x.type}>
              <span className="nm">{STEP_NAMES[x.type]}</span>
              <input
                type="number"
                min={1}
                value={x.value}
                aria-label={STEP_NAMES[x.type]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0) updateStep(i, { value: v });
                }}
              />
              <small>{x.kind === 'distance' ? 'm' : 's'}</small>
              {x.type === 'interval' && (
                <span className="pace-fields">
                  <input
                    className="pc"
                    placeholder="4:10"
                    value={x.paceMinSecPerKm ? mmss(x.paceMinSecPerKm) : ''}
                    aria-label="Allure minimale"
                    onChange={(e) => {
                      const p = parsePace(e.target.value);
                      updateStep(i, p !== null ? { paceMinSecPerKm: p } : { paceMinSecPerKm: null });
                    }}
                  />
                  <span>à</span>
                  <input
                    className="pc"
                    placeholder="4:20"
                    value={x.paceMaxSecPerKm ? mmss(x.paceMaxSecPerKm) : ''}
                    aria-label="Allure maximale"
                    onChange={(e) => {
                      const p = parsePace(e.target.value);
                      updateStep(i, p !== null ? { paceMaxSecPerKm: p } : { paceMaxSecPerKm: null });
                    }}
                  />
                </span>
              )}
              <span className="step-actions">
                <button className="mini" type="button" aria-label="Monter l’étape" disabled={i === 0} onClick={() => moveStep(i, -1)}>↑</button>
                <button className="mini" type="button" aria-label="Descendre l’étape" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}>↓</button>
                <button className="mini" type="button" aria-label="Dupliquer l’étape" onClick={() => setSteps((prev) => {
                  const next = [...prev]; next.splice(i + 1, 0, JSON.parse(JSON.stringify(prev[i]))); return next;
                })}>⧉</button>
                <button className="del" type="button" aria-label="Supprimer l’étape" onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}>×</button>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h2>5 · Ajouter une étape</h2>
        <AddStep onAdd={(s) => setSteps((prev) => [...prev, s])} />
      </div>

      <div className="actionbar">
        <div className="in">
          <button className="copy" type="button" style={{ background: '#df5320', margin: 0 }} disabled title="Bientôt disponible : le module Garmin n’est pas encore porté">
            📤 Garmin
          </button>
          <button className="copy" type="button" style={{ background: '#16a34a', margin: 0 }} disabled title="Bientôt disponible : l’export .fit n’est pas encore porté">
            ⬇ .fit
          </button>
          <button className="copy" type="button" style={{ margin: 0 }} onClick={save}>
            💾 Enregistrer
          </button>
        </div>
      </div>

      <details className="card">
        <summary><h2>Séance (JSON)</h2></summary>
        <textarea readOnly value={jsonText} />
        <button className="copy" type="button" onClick={copyJson}>Copier le JSON</button>
        <p className="note" style={{ marginTop: 8 }}>{msg}</p>
      </details>

      <div className="card">
        <h2>6 · Enregistrer</h2>
        <div className="grid">
          <label>
            Nom de la séance
            <input value={wName} placeholder="10 × 400 m" onChange={(e) => setWName(e.target.value)} />
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="copy" type="button" style={{ margin: 0, width: '100%' }} onClick={save}>
              Enregistrer
            </button>
          </div>
        </div>
        <p className="note" style={{ marginTop: 6 }}>{wState}</p>
      </div>
    </>
  );
}

function AddStep({ onAdd }: { onAdd: (s: Step) => void }) {
  const [addType, setAddType] = useState<StepType>('interval');
  const [addUnit, setAddUnit] = useState<'m' | 's'>('m');
  const [addVal, setAddVal] = useState('400');
  const [pmin, setPmin] = useState('');
  const [pmax, setPmax] = useState('');

  const go = () => {
    const v = Number(addVal);
    if (!(v > 0)) return;
    const s: Step = {
      type: addType,
      kind: addUnit === 'm' ? 'distance' : 'time',
      value: v,
    };
    if (s.type === 'interval') {
      const a = parsePace(pmin);
      const b = parsePace(pmax);
      if (a !== null && b !== null && a <= b) {
        s.paceMinSecPerKm = a;
        s.paceMaxSecPerKm = b;
      }
    }
    onAdd(s);
  };

  return (
    <div className="grid">
      <label>
        Type d’étape
        <select value={addType} onChange={(e) => setAddType(e.target.value as StepType)}>
          <option value="interval">Effort</option>
          <option value="recovery">Récupération</option>
          <option value="warmup">Échauffement</option>
          <option value="cooldown">Retour au calme</option>
        </select>
      </label>
      <label>
        Unité
        <select value={addUnit} onChange={(e) => setAddUnit(e.target.value as 'm' | 's')}>
          <option value="m">Distance (m)</option>
          <option value="s">Temps (s)</option>
        </select>
      </label>
      <label>
        Valeur
        <input type="number" min={1} value={addVal} onChange={(e) => setAddVal(e.target.value)} />
      </label>
      <label>
        Allure min (efforts, min/km)
        <input value={pmin} placeholder="4:10" inputMode="numeric" onChange={(e) => setPmin(e.target.value)} />
      </label>
      <label>
        Allure max (efforts, min/km)
        <input value={pmax} placeholder="4:20" inputMode="numeric" onChange={(e) => setPmax(e.target.value)} />
      </label>
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <button className="copy" type="button" style={{ margin: 0, width: '100%' }} onClick={go}>
          Ajouter à la fin
        </button>
      </div>
    </div>
  );
}
