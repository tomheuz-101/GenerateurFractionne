
import { parsePace } from '../api';
import type { Block, Step, WorkoutType } from '../types';

export type FieldKey =
  | 'paceMin' | 'paceMax' | 'reps' | 'val' | 'min' | 'max'
  | 'step' | 'rec' | 'sets' | 'srec' | 'wu' | 'cd';

export function valuesFor(
  t: WorkoutType,
  f: Record<FieldKey, string>,
): number[] {
  const n = Number(f.reps);
  const v = Number(f.val);
  const lo = Number(f.min);
  const hi = Number(f.max);
  const st = Math.max(1, Number(f.step));

  if (t === 'normal') {
    return n > 0 && v > 0 ? Array(Math.min(n, 60)).fill(v) : [];
  }

  const up: number[] = [];
  for (let x = lo, i = 0; x <= hi && i < 60; x += st, i += 1) {
    up.push(x);
  }

  if (t === 'pyramide') return up.concat(up.slice(0, -1).reverse());
  return t === 'descendant' ? up.slice().reverse() : up;
}

export function blockSteps(
  blocks: Block[],
  f: Record<FieldKey, string>,
): Step[] {
  const out: Step[] = [];
  const wu = Math.max(0, Number(f.wu) || 0) * 60;
  const cd = Math.max(0, Number(f.cd) || 0) * 60;

  const clamp = (v: unknown, max: number) =>
    Math.min(Math.max(1, Math.round(Number(v)) || 1), max);

  if (wu > 0) out.push({ type: 'warmup', kind: 'time', value: wu });

  const runs: { b: Block; n: number }[] = [];

  blocks.forEach((b) => {
    const n = clamp(b.reps, 60);
    for (let k = 0; k < clamp(b.rep, 20); k += 1) {
      runs.push({ b, n });
    }
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

export function buildSteps(
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
    if (k > 0 && sr > 0) {
      out.push({ type: 'recovery', kind: 'time', value: sr });
    }

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

export function stepDuration(x: Step): number {
  if (x.kind === 'time') return x.value;

  const pmin = x.paceMinSecPerKm;
  const pmax = x.paceMaxSecPerKm;

  if (pmin && pmax) {
    return (x.value / 1000) * ((pmin + pmax) / 2);
  }

  return (x.value / 1000) * 300;
}
