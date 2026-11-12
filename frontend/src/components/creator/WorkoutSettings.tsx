
import type { ReactNode } from 'react';

interface WorkoutSettingsProps<T extends string, K extends string> {
  type: T;
  setType: (type: T) => void;
  typeLabels: Record<T, string>;
  unit: 'm' | 's';
  onUnitChange: (unit: 'm' | 's') => void;
  fields: Record<K, string>;
  fieldKeys: readonly K[];
  fieldLabels: Record<K, string>;
  showField: (key: K, type: T) => boolean;
  setField: (key: K, value: string) => void;
  vma: number | null;
  vmaFill: () => void;
}

export default function WorkoutSettings<T extends string, K extends string>({
  type,
  setType,
  typeLabels,
  unit,
  onUnitChange,
  fields,
  fieldKeys,
  fieldLabels,
  showField,
  setField,
  vma,
  vmaFill,
}: WorkoutSettingsProps<T, K>): ReactNode {
  return (
    <div className="card">
      <h2>2 · Type et réglages</h2>

      <div className="seg">
        {(Object.keys(typeLabels) as T[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => setType(t)}
          >
            {typeLabels[t]}
          </button>
        ))}
      </div>

      <div className="grid">
        <label>
          Unité des efforts
          <select
            value={unit}
            onChange={(e) => onUnitChange(e.target.value as 'm' | 's')}
          >
            <option value="m">Distance (m)</option>
            <option value="s">Temps (s)</option>
          </select>
        </label>
        <div />
      </div>

      <div className="grid">
        <div className="pace-title">
          Plage d’allure cible des efforts (min/km)
        </div>

        {vma !== null && (
          <button
            className="mini"
            type="button"
            style={{ justifySelf: 'start' }}
            onClick={vmaFill}
          >
            ⚡ Pré-remplir les allures (VMA {String(vma).replace('.', ',')} km/h)
          </button>
        )}

        {fieldKeys
          .filter((k) => k === 'paceMin' || k === 'paceMax')
          .map((k) => (
            <label key={k}>
              {fieldLabels[k]}
              <input
                value={fields[k]}
                placeholder={k === 'paceMin' ? '4:10' : '4:20'}
                inputMode="numeric"
                onChange={(e) => setField(k, e.target.value)}
              />
            </label>
          ))}

        {fieldKeys
          .filter((k) => k !== 'paceMin' && k !== 'paceMax' && showField(k, type))
          .map((k) => (
            <label key={k}>
              {fieldLabels[k]}
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
  );
}
