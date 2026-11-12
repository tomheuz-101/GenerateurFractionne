
interface WorkoutActionsProps {
  garminLinked: boolean;
  sendToGarmin: () => void | Promise<void>;
  exportFit: () => void | Promise<void>;
  save: () => void | Promise<unknown>;
  jsonText: string;
  copyJson: () => void | Promise<void>;
  msg: string;
}

export default function WorkoutActions({
  garminLinked,
  sendToGarmin,
  exportFit,
  save,
  jsonText,
  copyJson,
  msg,
}: WorkoutActionsProps) {
  return (
    <>
      <div className="actionbar">
        <div className="in">
          <button
            className="copy"
            type="button"
            style={{ background: '#df5320', margin: 0 }}
            title={garminLinked ? 'Envoyer vers Garmin Connect' : 'Connecter ton compte Garmin'}
            onClick={sendToGarmin}
          >
            📤 Garmin
          </button>

          <button
            className="copy"
            type="button"
            style={{ background: '#16a34a', margin: 0 }}
            title="Télécharger en .fit"
            onClick={exportFit}
          >
            ⬇ .fit
          </button>

          <button
            className="copy"
            type="button"
            style={{ margin: 0 }}
            onClick={save}
          >
            💾 Enregistrer
          </button>
        </div>
      </div>

      <details className="card">
        <summary><h2>Séance (JSON)</h2></summary>
        <textarea readOnly value={jsonText} />
        <button className="copy" type="button" onClick={copyJson}>
          Copier le JSON
        </button>
        <p className="note" style={{ marginTop: 8 }}>{msg}</p>
      </details>
    </>
  );
}

