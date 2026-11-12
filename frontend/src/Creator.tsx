import { useEffect, useMemo, useState } from 'react';
import { api, mmss } from './api';
import { buildSteps, stepDuration } from './lib/workout';
import { TYPE_LABELS } from './types';
import type { Block, Step, Workout } from './types';
import BlocksEditor from './components/creator/BlocksEditor';
import StepEditor from './components/creator/StepEditor';
import { useGarmin } from './hooks/useGarmin';
import GarminConnect from './components/creator/GarminConnect';
import WorkoutPreview from './components/creator/WorkoutPreview';
import WorkoutTemplates from './components/creator/WorkoutTemplates';
import type { WorkoutTemplate } from './components/creator/WorkoutTemplates';
import WorkoutSettings from './components/creator/WorkoutSettings';
import WorkoutActions from './components/creator/WorkoutActions';
import WorkoutSave from './components/creator/WorkoutSave';
import AddStep from './components/creator/AddStep';

type WorkoutType = 'normal' | 'pyramide' | 'descendant' | 'ascendant' | 'blocs';



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


const DEFAULT_BLOCKS: Block[] = [
  { reps: 5, unit: 'm', val: 400, rec: 60, paceMin: '', paceMax: '', rep: 1, brec: 120 },
  { reps: 3, unit: 'm', val: 1000, rec: 120, paceMin: '', paceMax: '', rep: 1, brec: 0 },
];

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
  const [loadingWorkout, setLoadingWorkout] = useState(false);
  const [isEditingWorkout, setIsEditingWorkout] = useState(false);
  const [wName, setWName] = useState('');
  const [curId, setCurId] = useState<number | null>(null);
  const [wState, setWState] = useState('Nouvelle séance · Ma bibliothèque');
  const [msg, setMsg] = useState('Étape suivante : envoi vers Garmin Connect.');
  const garmin = useGarmin(setMsg);
  const [vma, setVma] = useState<number | null>(null);


useEffect(() => {
  if (loadingWorkout || isEditingWorkout) return;

  setSteps(buildSteps(type, unit, fields, blocks));
}, [type, unit, fields, blocks, loadingWorkout, isEditingWorkout]);

  useEffect(() => {
    api<{ vma: number | null }>('/api/auth/me').then((r) => {
      if (r.ok && r.j.vma) setVma(r.j.vma);
    });
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (!id) return;
    window.history.replaceState(
  {},
  '',
  window.location.pathname + window.location.hash
);
    (async () => {
  setLoadingWorkout(true);

  try {
    const r = await api<{ workouts: Workout[] }>('/api/workouts');

    if (!r.ok) {
      setWState('Impossible de charger la séance.');
      return;
    }

    const w = (r.j.workouts || []).find((x) => String(x.id) === id);

    if (!w) {
      setWState('Séance introuvable.');
      return;
    }

    const d = w.data;
    setIsEditingWorkout(true);

    setType((d.type as WorkoutType) || 'pyramide');
    setUnit(d.unit || 'm');
    if (d.f) setFields((prev) => ({ ...prev, ...d.f }));
    if (d.blocks) setBlocks(d.blocks.map((b) => ({ ...b })));
    setSteps(d.steps || []);
    setWName(w.name);
    setCurId(w.id);
    setWState('Modification de « ' + w.name + ' »');
  } finally {
    setLoadingWorkout(false);
  }
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

const totalKm: number | null = known ? km : null;
    const est = intervals.some((x) => x.kind === 'distance' && !x.paceMinSecPerKm)
      ? 'Durée estimée sur une base de 5:00/km pour les efforts sans allure.'
      : 'Durée estimée à partir de l’allure moyenne de chaque plage.';
    return { tot, km: totalKm, est };
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

  

 const applyTemplate = (t: WorkoutTemplate) => {
    setIsEditingWorkout(false);
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

  const save = async (): Promise<number | null> => {
    const name = wName.trim();
    if (!name) { setWState('Donne un nom à la séance.'); return null; }
    if (!steps.length) { setWState('La séance est vide.'); return null; }
    const body = { name, data: { type, unit, f: fields, steps, blocks } };
    const r = curId
      ? await api('/api/workouts/' + curId, 'PUT', body)
      : await api('/api/workouts', 'POST', body);
    if (!r.ok) {
      setWState((r.j as { error?: string }).error || 'Erreur d’enregistrement.');
      return null;
    }
    const id = (r.j as { workout: Workout }).workout.id;
    setCurId(id);
    setWState('Enregistrée : « ' + name + ' » · Ma bibliothèque');
    return id;
  };

 const sendToGarmin = async () => {
  setMsg('Enregistrement et envoi vers Garmin Connect…');

  const id = await save();

  if (!id) {
    setMsg('Impossible d’enregistrer la séance avant l’envoi.');
    return;
  }

  const r = await api<{ workoutId?: string; message?: string; error?: string }>(
    '/api/garmin/send/' + id,
    'POST',
  );

  const errText = (r.j as { error?: string }).error || '';

  if (r.status === 401 || errText.includes('non connecté')) {
    setMsg('');
    garmin.openConnection();
    return;
  }

  if (!r.ok) {
    setMsg('Échec de l’envoi : ' + (errText || 'erreur inconnue'));
    return;
  }

  setMsg(
    '✅ ' +
      ((r.j as { message?: string }).message || 'Séance envoyée !') +
      ' (Garmin #' +
      (r.j as { workoutId?: string }).workoutId +
      ')',
  );
};

const exportFit = async () => {
  const id = await save();

  if (!id) {
    setMsg('Impossible d’enregistrer la séance avant l’export.');
    return;
  }

  window.location.href = '/api/garmin/fit/' + id;
  setMsg('Fichier .fit en cours de téléchargement.');
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

      <WorkoutTemplates onApply={applyTemplate} />

    <WorkoutSettings
  type={type}
  setType={setType}
  typeLabels={TYPE_LABELS}
  unit={unit}
  onUnitChange={(u) => {
    setUnit(u);
    setFields((prev) => ({ ...prev, ...DEF[u] } as Record<FieldKey, string>));
  }}
  fields={fields}
  fieldKeys={FIELDS}
  fieldLabels={FIELD_LABELS}
  showField={showField}
  setField={setField}
  vma={vma}
  vmaFill={vmaFill}
/>

{type === 'blocs' && (
  <BlocksEditor blocks={blocks} onChange={setBlocks} />
)}

    <WorkoutPreview steps={steps} summary={summary} />

      <StepEditor steps={steps} setSteps={setSteps} />

      <div className="card">
  <h2>5 · Ajouter une étape</h2>
  <AddStep onAdd={(s) => setSteps((prev) => [...prev, s])} />
</div>

            <WorkoutActions
  garminLinked={garmin.linked}
  sendToGarmin={sendToGarmin}
  exportFit={exportFit}
  save={save}
  jsonText={jsonText}
  copyJson={copyJson}
  msg={msg}
/>

     <WorkoutSave
  wName={wName}
  setWName={setWName}
  save={save}
  wState={wState}
/>


      <GarminConnect
  open={garmin.open}
  setOpen={garmin.setOpen}
  linked={garmin.linked}
  email={garmin.email}
  setEmail={garmin.setEmail}
  password={garmin.password}
  setPassword={garmin.setPassword}
  code={garmin.code}
  setCode={garmin.setCode}
  mfa={garmin.mfa}
  busy={garmin.busy}
  error={garmin.error}
  connect={garmin.connect}
  submitMfa={garmin.submitMfa}
  disconnect={garmin.disconnect}
/>
    </>
  );
}

