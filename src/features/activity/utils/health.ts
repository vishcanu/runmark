import type { ActivityType } from '../../../types';

// ── MET (Metabolic Equivalent of Task) values ─────────────────
// Source: Compendium of Physical Activities (Ainsworth et al.)
// MET × weight_kg × duration_hours = kcal burned

function getMET(type: ActivityType, paceMinPerKm?: number): number {
  switch (type) {
    case 'run': {
      if (!paceMinPerKm) return 9.8;      // moderate run ~10 km/h
      if (paceMinPerKm > 10) return 6.0;  // very slow jog  < 6 km/h
      if (paceMinPerKm > 8)  return 8.3;  // slow jog       ~7.5 km/h
      if (paceMinPerKm > 6)  return 9.8;  // moderate run   ~10 km/h
      if (paceMinPerKm > 5)  return 11.0; // fast run       ~12 km/h
      return 14.5;                         // race / sprint  > 12 km/h
    }
    case 'walk': {
      if (!paceMinPerKm) return 3.5;
      if (paceMinPerKm > 20) return 2.0;  // very slow walk
      if (paceMinPerKm > 15) return 2.8;  // slow walk
      if (paceMinPerKm > 12) return 3.5;  // moderate walk
      return 4.3;                          // brisk walk
    }
    case 'cycle': {
      if (!paceMinPerKm) return 7.5;      // moderate cycling
      if (paceMinPerKm > 5) return 5.8;   // leisurely < 16 km/h
      if (paceMinPerKm > 3) return 7.5;   // moderate  16–19 km/h
      return 10.0;                         // vigorous  > 20 km/h
    }
    default:
      return 5.0;
  }
}

// ── Calorie burn (MET formula) ────────────────────────────────
export function calcCaloriesBurned(
  distanceM:   number,
  durationSec: number,
  type:        ActivityType,
  weightKg:    number = 70,   // fallback if user hasn't set weight
): number {
  if (durationSec <= 0 || distanceM <= 0) return 0;
  const durationHours  = durationSec / 3600;
  const paceMinPerKm   = (durationSec / 60) / (distanceM / 1000);
  const met            = getMET(type, paceMinPerKm);
  return Math.round(met * weightKg * durationHours);
}

// ── Step estimation (height-based stride) ─────────────────────
// Stride length ≈ 0.413 × height for running, 0.415 × height for walking
export function estimateSteps(
  distanceM: number,
  type:      ActivityType,
  heightCm:  number = 170,  // fallback average adult height
): number {
  if (type === 'cycle') return 0;
  const heightM  = heightCm / 100;
  const strideM  = type === 'run'
    ? heightM * 0.413 * 2   // running: full stride = 2 steps
    : heightM * 0.415;       // walking: half-stride per step
  return Math.round(distanceM / strideM);
}

// ── BMI ───────────────────────────────────────────────────────
export function calcBMI(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

export function getBMILabel(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: '#f59e0b' };
  if (bmi < 25.0) return { label: 'Healthy',     color: '#22c55e' };
  if (bmi < 30.0) return { label: 'Overweight',  color: '#f97316' };
  return               { label: 'Obese',         color: '#ef4444' };
}

// ── Heart rate ────────────────────────────────────────────────
export function maxHeartRate(age: number): number {
  // Tanaka formula (more accurate than 220-age for adults)
  return Math.round(208 - 0.7 * age);
}

// ── Estimated pace zone based on pace + age ───────────────────
export interface PaceZone {
  name:        string;
  color:       string;
  hrEstimate:  string;
  description: string;
}

export function estimatePaceZone(
  paceMinPerKm: number,
  age:          number,
): PaceZone {
  const mhr = maxHeartRate(age);
  if (paceMinPerKm > 9)   return { name: 'Recovery',  color: '#94a3b8', hrEstimate: `< ${Math.round(mhr * 0.60)} bpm`, description: 'Easy, conversational' };
  if (paceMinPerKm > 7)   return { name: 'Fat Burn',  color: '#22c55e', hrEstimate: `~${Math.round(mhr * 0.65)} bpm`, description: 'Steady, fat oxidation' };
  if (paceMinPerKm > 5.5) return { name: 'Aerobic',   color: '#f59e0b', hrEstimate: `~${Math.round(mhr * 0.75)} bpm`, description: 'Comfortably hard' };
  if (paceMinPerKm > 4.5) return { name: 'Threshold', color: '#f97316', hrEstimate: `~${Math.round(mhr * 0.85)} bpm`, description: 'Race effort' };
  return                         { name: 'Max Effort', color: '#ef4444', hrEstimate: `~${Math.round(mhr * 0.93)} bpm`, description: 'Sprint / all-out' };
}

// ── Weekly calorie goal (based on WHO activity guidelines) ────
export function weeklyCalorieGoal(weightKg: number): number {
  // WHO: 150–300 min moderate activity/week ≈ 1000–2000 kcal/week for 70kg
  return Math.round(weightKg * 14.3); // scales with body weight
}
