
import type { Block } from '../../types';

interface BlocksEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

export default function BlocksEditor({ blocks, onChange }: BlocksEditorProps) {
  const updateBlock = (index: number, patch: Partial<Block>) => {
    onChange(blocks.map((block, i) =>
      i === index ? { ...block, ...patch } : block
    ));
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const next = [...blocks];
    const target = index + direction;

    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const duplicateBlock = (index: number) => {
    const next = [...blocks];
    next.splice(index + 1, 0, { ...blocks[index] });
    onChange(next);
  };

  const deleteBlock = (index: number) => {
    if (blocks.length <= 1) return;
    onChange(blocks.filter((_, i) => i !== index));
  };

  const addBlock = () => {
    onChange([
      ...blocks,
      {
        reps: 4,
        unit: 'm',
        val: 400,
        rec: 60,
        paceMin: '',
        paceMax: '',
        rep: 1,
        brec: 120,
      },
    ]);
  };

  return (
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
              <button className="mini" type="button" aria-label="Monter"
                onClick={() => moveBlock(i, -1)}>↑</button>
              <button className="mini" type="button" aria-label="Descendre"
                onClick={() => moveBlock(i, 1)}>↓</button>
              <button className="mini" type="button"
                onClick={() => duplicateBlock(i)}>Dupliquer</button>
              <button className="mini" type="button"
                onClick={() => deleteBlock(i)}>Supprimer</button>
            </span>
          </div>

          <div className="grid">
            <label>Répétitions
              <input type="number" min={1} value={b.reps}
                onChange={(e) => updateBlock(i, { reps: Number(e.target.value) })} />
            </label>

            <label>Effort en
              <select value={b.unit}
                onChange={(e) => updateBlock(i, { unit: e.target.value as 'm' | 's' })}>
                <option value="m">Distance (m)</option>
                <option value="s">Temps (s)</option>
              </select>
            </label>

            <label>Valeur de l’effort
              <input type="number" min={1} value={b.val}
                onChange={(e) => updateBlock(i, { val: Number(e.target.value) })} />
            </label>

            <label>Récup entre répétitions (s)
              <input type="number" min={0} value={b.rec}
                onChange={(e) => updateBlock(i, { rec: Number(e.target.value) })} />
            </label>

            <label>Allure min (min/km)
              <input value={b.paceMin} placeholder="4:10" inputMode="numeric"
                onChange={(e) => updateBlock(i, { paceMin: e.target.value })} />
            </label>

            <label>Allure max (min/km)
              <input value={b.paceMax} placeholder="4:20" inputMode="numeric"
                onChange={(e) => updateBlock(i, { paceMax: e.target.value })} />
            </label>

            <label>Répéter le bloc ×
              <input type="number" min={1} max={20} value={b.rep}
                onChange={(e) => updateBlock(i, { rep: Number(e.target.value) })} />
            </label>

            <label>Récup après le bloc (s)
              <input type="number" min={0} value={b.brec}
                onChange={(e) => updateBlock(i, { brec: Number(e.target.value) })} />
            </label>
          </div>
        </div>
      ))}

      <button className="mini" type="button" onClick={addBlock}>
        + Ajouter un bloc
      </button>
    </div>
  );
}
