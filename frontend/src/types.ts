export type StepType = 'warmup' | 'recovery' | 'interval' | 'cooldown';

export interface Step {
  type: StepType;
  kind: 'time' | 'distance';
  /** secondes si kind='time', mètres si kind='distance' */
  value: number;
  paceMinSecPerKm?: number | null;
  paceMaxSecPerKm?: number | null;
}

export interface Block {
  reps: number;
  unit: 'm' | 's';
  val: number;
  rec: number;
  paceMin: string;
  paceMax: string;
  /** combien de fois le bloc entier est répété */
  rep: number;
  /** récupération après le bloc, en secondes */
  brec: number;
}

export type WorkoutType = 'normal' | 'pyramide' | 'descendant' | 'ascendant' | 'blocs';

export interface WorkoutData {
  type: WorkoutType;
  unit: 'm' | 's';
  f: Record<string, string>;
  steps: Step[];
  blocks?: Block[];
}

export interface Workout {
  id: number;
  name: string;
  data: WorkoutData;
  createdAt?: string;
  updatedAt?: string;
}

export const STEP_NAMES: Record<StepType, string> = {
  warmup: 'Échauffement',
  recovery: 'Récupération',
  interval: 'Effort',
  cooldown: 'Retour au calme',
};

export const TYPE_LABELS: Record<WorkoutType, string> = {
  normal: 'Normal',
  pyramide: 'Pyramide',
  descendant: 'Descendant',
  ascendant: 'Ascendant',
  blocs: 'Blocs',
};
