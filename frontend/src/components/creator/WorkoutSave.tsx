
interface WorkoutSaveProps {
  wName: string;
  setWName: (name: string) => void;
  save: () => void | Promise<unknown>;
  wState: string;
}

export default function WorkoutSave({
  wName,
  setWName,
  save,
  wState,
}: WorkoutSaveProps) {
  return (
    <div className="card">
      <h2>6 · Enregistrer</h2>
      <div className="grid">
        <label>
          Nom de la séance
          <input
            value={wName}
            placeholder="10 × 400 m"
            onChange={(e) => setWName(e.target.value)}
          />
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            className="copy"
            type="button"
            style={{ margin: 0, width: '100%' }}
            onClick={save}
          >
            Enregistrer
          </button>
        </div>
      </div>
      <p className="note" style={{ marginTop: 6 }}>{wState}</p>
    </div>
  );
}
