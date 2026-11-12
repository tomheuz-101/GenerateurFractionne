
import type { CSSProperties } from 'react';
import { dur, mmss } from '../../api';
import { stepDuration } from '../../lib/workout';
import { STEP_NAMES } from '../../types';
import type { Step, StepType } from '../../types';

const BAR_HEIGHT: Record<StepType, number> = {
  warmup: 38,
  cooldown: 38,
  recovery: 20,
  interval: 100,
};

interface WorkoutPreviewProps {
  steps: Step[];
  summary: {
    tot: number;
    km: number | null;
    est: string;
  };
}

export default function WorkoutPreview({
  steps,
  summary,
}: WorkoutPreviewProps) {
  const intervals = steps.filter((x) => x.type === 'interval');

  return (
    <>
      <h2>3 · Aperçu</h2>
      <div className="card">
        <div id="bars" aria-label="Profil de la séance">
          {steps.map((x, i) => {
            const u = x.kind === 'distance' ? x.value + ' m' : mmss(x.value);
            const pace =
              x.type === 'interval' && x.paceMinSecPerKm && x.paceMaxSecPerKm
                ? ' @ ' + mmss(x.paceMinSecPerKm) + '-' + mmss(x.paceMaxSecPerKm)
                : '';

            let style: CSSProperties = {
              flex: stepDuration(x) + ' 1 0',
              height: BAR_HEIGHT[x.type] + '%',
            };

            if (
              x.type === 'interval' &&
              x.paceMinSecPerKm &&
              x.paceMaxSecPerKm
            ) {
              const p = (x.paceMinSecPerKm + x.paceMaxSecPerKm) / 2;
              const op = Math.min(1, Math.max(0.55, 0.55 + (300 - p) / 240));
              style = { ...style, opacity: op };
            }

            return (
              <i
                key={i}
                className={x.type}
                data-tip={STEP_NAMES[x.type] + ' ' + u + pace}
                style={style}
              />
            );
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
            (summary.km !== null
              ? ' · ' + summary.km.toFixed(2).replace('.', ',') + ' km d’effort'
              : '') +
            ' · ' + dur(summary.tot)}
        </div>

        {intervals.length > 0 && <p className="note">{summary.est}</p>}
      </div>
    </>
  );
}
