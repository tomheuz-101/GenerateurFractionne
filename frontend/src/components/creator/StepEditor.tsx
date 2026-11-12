
import type { Dispatch, SetStateAction } from 'react';
import { mmss, parsePace } from '../../api';
import { STEP_NAMES } from '../../types';
import type { Step } from '../../types';

interface StepEditorProps {
  steps: Step[];
  setSteps: Dispatch<SetStateAction<Step[]>>;
}

export default function StepEditor({ steps, setSteps }: StepEditorProps) {
  const updateStep = (index: number, patch: Partial<Step>) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const duplicateStep = (index: number) => {
    setSteps((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, JSON.parse(JSON.stringify(prev[index])));
      return next;
    });
  };

  const deleteStep = (index: number) => {
    setSteps((prev) => prev.filter((_, j) => j !== index));
  };

  return (
    <div className="card">
      <h2>4 · Étapes</h2>
      <p className="note" style={{ marginBottom: 8 }}>
        Modifie chaque étape : distance, durée et plage d’allure des efforts.
        Réorganise avec ↑ ↓, duplique avec ⧉, supprime avec ×.
        Les réglages du haut régénèrent la séance.
      </p>

      <ol>
        {steps.length === 0 && (
          <li>Aucun palier : vérifie les valeurs saisies.</li>
        )}

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
                    updateStep(
                      i,
                      p !== null
                        ? { paceMinSecPerKm: p }
                        : { paceMinSecPerKm: null }
                    );
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
                    updateStep(
                      i,
                      p !== null
                        ? { paceMaxSecPerKm: p }
                        : { paceMaxSecPerKm: null }
                    );
                  }}
                />
              </span>
            )}

            <span className="step-actions">
              <button
                className="mini"
                type="button"
                aria-label="Monter l’étape"
                disabled={i === 0}
                onClick={() => moveStep(i, -1)}
              >
                ↑
              </button>

              <button
                className="mini"
                type="button"
                aria-label="Descendre l’étape"
                disabled={i === steps.length - 1}
                onClick={() => moveStep(i, 1)}
              >
                ↓
              </button>

              <button
                className="mini"
                type="button"
                aria-label="Dupliquer l’étape"
                onClick={() => duplicateStep(i)}
              >
                ⧉
              </button>

              <button
                className="del"
                type="button"
                aria-label="Supprimer l’étape"
                onClick={() => deleteStep(i)}
              >
                ×
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
