import { useState } from 'react';
import { parsePace } from '../../api';
import type { Step, StepType } from '../../types';

export default function AddStep({ onAdd }: { onAdd: (s: Step) => void }) {
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