/**
 * ── Supabase DB Operations ────────────────────────────────────
 *
 * Run this SQL once in Supabase → SQL Editor to create the schema:
 *
 * create table public.profiles (
 *   id           uuid    primary key,
 *   name         text    not null,
 *   color        text    not null default '#0284c7',
 *   age          integer check (age > 0 and age < 120),
 *   weight_kg    numeric(5,1) check (weight_kg > 0),
 *   height_cm    integer check (height_cm > 0),
 *   gender       text    check (gender in ('male','female','other')),
 *   created_at   timestamptz default now()
 * );
 *
 * create table public.territories (
 *   id            text    primary key,
 *   user_id       uuid    not null references public.profiles(id) on delete cascade,
 *   name          text    not null,
 *   coordinates   jsonb   not null,
 *   inner_ring    jsonb,
 *   raw_path      jsonb,
 *   color         text    not null default '#0284c7',
 *   theme         text,
 *   emblem        text,
 *   tagline       text,
 *   shape         text    default 'zone',
 *   runs          integer default 1,
 *   distance      numeric not null default 0,
 *   duration      integer not null default 0,
 *   points        integer default 0,
 *   last_run_at   bigint,
 *   activity_type text    default 'run',
 *   building_type text,
 *   buildings     jsonb   default '[]',
 *   visit_days    jsonb   default '[]',
 *   created_at    bigint  not null
 * );
 *
 * create index territories_user_id_idx on public.territories(user_id);
 *
 * -- Allow public read/write (no auth required for MVP):
 * alter table public.profiles  enable row level security;
 * alter table public.territories enable row level security;
 * create policy "public access" on public.profiles  for all using (true) with check (true);
 * create policy "public access" on public.territories for all using (true) with check (true);
 */

import { supabase } from './supabase';
import type { Territory } from '../types';
import type { HealthProfile } from '../hooks/useUserProfile';

// ── Profile ──────────────────────────────────────────────────

export async function upsertProfile(
  id: string,
  name: string,
  color: string,
  health: Partial<HealthProfile>,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('profiles').upsert(
    {
      id,
      name,
      color,
      age:       health.age       ?? null,
      weight_kg: health.weightKg  ?? null,
      height_cm: health.heightCm  ?? null,
      gender:    health.gender    ?? null,
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[db] upsertProfile error', error.message);
}

// ── Territories ──────────────────────────────────────────────

export async function fetchTerritories(userId: string): Promise<Territory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('territories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.warn('[db] fetchTerritories error', error.message); return []; }
  return (data ?? []).map(rowToTerritory);
}

export async function upsertTerritory(userId: string, t: Territory): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('territories')
    .upsert({ ...territoryToRow(t), user_id: userId }, { onConflict: 'id' });
  if (error) console.warn('[db] upsertTerritory error', error.message);
}

export async function deleteTerritory(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('territories').delete().eq('id', id);
  if (error) console.warn('[db] deleteTerritory error', error.message);
}

// ── Row mappers ───────────────────────────────────────────────

function territoryToRow(t: Territory) {
  return {
    id:            t.id,
    name:          t.name,
    coordinates:   t.coordinates,
    inner_ring:    t.innerRing    ?? null,
    raw_path:      t.rawPath      ?? null,
    color:         t.color,
    theme:         t.theme        ?? null,
    emblem:        t.emblem       ?? null,
    tagline:       t.tagline      ?? null,
    shape:         t.shape        ?? 'zone',
    runs:          t.runs         ?? 1,
    distance:      t.distance,
    duration:      t.duration,
    points:        t.points       ?? 0,
    last_run_at:   t.lastRunAt    ?? null,
    activity_type: t.activityType ?? 'run',
    building_type: t.buildingType ?? null,
    buildings:     t.buildings    ?? [],
    visit_days:    t.visitDays    ?? [],
    created_at:    t.createdAt,
  };
}

function rowToTerritory(row: Record<string, unknown>): Territory {
  return {
    id:            row.id            as string,
    name:          row.name          as string,
    coordinates:   row.coordinates   as [number, number][],
    innerRing:     (row.inner_ring   as [number, number][] | null) ?? undefined,
    rawPath:       (row.raw_path     as [number, number][] | null) ?? undefined,
    color:         row.color         as string,
    theme:         (row.theme        as string | null)  ?? undefined,
    emblem:        (row.emblem       as string | null)  ?? undefined,
    tagline:       (row.tagline      as string | null)  ?? undefined,
    shape:         (row.shape        as 'zone' | 'corridor') ?? 'zone',
    runs:          (row.runs         as number) ?? 1,
    distance:      row.distance      as number,
    duration:      row.duration      as number,
    points:        (row.points       as number) ?? 0,
    lastRunAt:     (row.last_run_at  as number) ?? Date.now(),
    activityType:  (row.activity_type as 'run' | 'walk' | 'cycle') ?? 'run',
    buildingType:  (row.building_type as string | null) ?? undefined,
    buildings:     (row.buildings    as [])    ?? [],
    visitDays:     (row.visit_days   as number[]) ?? [],
    createdAt:     row.created_at    as number,
  };
}
