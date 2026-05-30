import { useState } from 'react';
import { upsertProfile, fetchProfile } from '../lib/db';

// ── Types ─────────────────────────────────────────────────────
export interface HealthProfile {
  age?:      number;
  weightKg?: number;
  heightCm?: number;
  gender?:   'male' | 'female' | 'other';
}

export interface UserProfile {
  id:      string;
  name:    string;
  email:   string | null;
  color:   string;
  initial: string;
  health:  HealthProfile;
}

// ── Helpers ───────────────────────────────────────────────────
function getUserId(): string {
  let id = localStorage.getItem('rg_user_id');
  if (!id) {
    // Generate a stable UUID for this device/browser
    id = crypto.randomUUID();
    localStorage.setItem('rg_user_id', id);
  }
  return id;
}

function loadHealth(): HealthProfile {
  const age      = localStorage.getItem('rg_user_age');
  const weightKg = localStorage.getItem('rg_user_weight');
  const heightCm = localStorage.getItem('rg_user_height');
  const gender   = localStorage.getItem('rg_user_gender');
  return {
    age:      age      ? Number(age)      : undefined,
    weightKg: weightKg ? Number(weightKg) : undefined,
    heightCm: heightCm ? Number(heightCm) : undefined,
    gender:   (gender as HealthProfile['gender']) || undefined,
  };
}

// ── Hook ──────────────────────────────────────────────────────
export function useUserProfile(): UserProfile {
  const [name]  = useState(() => localStorage.getItem('rg_user_name')  ?? 'Explorer');
  const [color] = useState(() => localStorage.getItem('rg_user_color') ?? '#0284c7');
  const [id]    = useState(() => getUserId());
  const [email] = useState(() => localStorage.getItem('rg_user_email'));
  const [health] = useState(() => loadHealth());
  return { id, name, email, color, initial: name.charAt(0).toUpperCase(), health };
}

// ── Save (called from Login) ──────────────────────────────────
export function saveUserProfile(
  name:   string,
  color:  string,
  health: HealthProfile = {},
): void {
  localStorage.setItem('rg_user_name',  name);
  localStorage.setItem('rg_user_color', color);
  if (health.age      != null) localStorage.setItem('rg_user_age',    String(health.age));
  if (health.weightKg != null) localStorage.setItem('rg_user_weight', String(health.weightKg));
  if (health.heightCm != null) localStorage.setItem('rg_user_height', String(health.heightCm));
  if (health.gender)           localStorage.setItem('rg_user_gender', health.gender);

  // Sync to Supabase (fire-and-forget)
  const id    = getUserId();
  const email = localStorage.getItem('rg_user_email');
  upsertProfile(id, name, color, health, email).catch(() => {/* offline — ignore */});
}

// ── Backfill from Supabase (called when localStorage health is empty) ──
export async function syncProfileFromRemote(): Promise<HealthProfile | null> {
  const id     = getUserId();
  const remote = await fetchProfile(id);
  if (!remote) return null;
  const { health, name, color } = remote;
  // Only write keys that are missing from localStorage to avoid overwriting edits
  if (!localStorage.getItem('rg_user_weight') && health.weightKg != null)
    localStorage.setItem('rg_user_weight', String(health.weightKg));
  if (!localStorage.getItem('rg_user_height') && health.heightCm != null)
    localStorage.setItem('rg_user_height', String(health.heightCm));
  if (!localStorage.getItem('rg_user_age')    && health.age      != null)
    localStorage.setItem('rg_user_age',    String(health.age));
  if (!localStorage.getItem('rg_user_gender') && health.gender)
    localStorage.setItem('rg_user_gender', health.gender);
  if (!localStorage.getItem('rg_user_name'))
    localStorage.setItem('rg_user_name',  name);
  if (!localStorage.getItem('rg_user_color'))
    localStorage.setItem('rg_user_color', color);
  return health;
}
