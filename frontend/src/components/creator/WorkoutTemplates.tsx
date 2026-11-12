
import type { Block } from '../../types';

export interface WorkoutTemplate {
  n: string;
  t: 'normal' | 'pyramide' | 'descendant' | 'ascendant' | 'blocs';
  u: 'm' | 's';
  f: Partial<Record<string, string>>;
  b?: Block[];
}

const TPL: WorkoutTemplate[] = [
  { n: '10 × 400 m', t: 'normal', u: 'm', f: { reps: '10', val: '400', rec: '90' } },
  { n: '5 × 1000 m', t: 'normal', u: 'm', f: { reps: '5', val: '1000', rec: '120' } },
  { n: 'Pyramide 200-800 m', t: 'pyramide', u: 'm', f: { min: '200', max: '800', step: '200', rec: '90' } },
  { n: 'Descendant 1000-200 m', t: 'descendant', u: 'm', f: { min: '200', max: '1000', step: '200', rec: '90' } },
  { n: 'Seuil 3 × 10 min', t: 'normal', u: 's', f: { reps: '3', val: '600', rec: '120' } },
  { n: '30/30 × 12', t: 'normal', u: 's', f: { reps: '12', val: '30', rec: '30' } },
  {
    n: 'Blocs 5 × 400 m + 3 × 1000 m',
    t: 'blocs',
    u: 'm',
    f: { wu: '15', cd: '10' },
    b: [
      { reps: 5, unit: 'm', val: 400, rec: 60, paceMin: '', paceMax: '', rep: 1, brec: 120 },
      { reps: 3, unit: 'm', val: 1000, rec: 120, paceMin: '', paceMax: '', rep: 1, brec: 0 },
    ],
  },
];

interface WorkoutTemplatesProps {
  onApply: (template: WorkoutTemplate) => void;
}

export default function WorkoutTemplates({ onApply }: WorkoutTemplatesProps) {
  return (
    <div className="card">
      <h2>1 · Modèles</h2>
      <div className="seg" style={{ gridTemplateColumns: 'repeat(2,1fr)', margin: 0 }}>
        {TPL.map((template) => (
          <button
            key={template.n}
            type="button"
            onClick={() => onApply(template)}
          >
            {template.n}
          </button>
        ))}
      </div>
    </div>
  );
}
