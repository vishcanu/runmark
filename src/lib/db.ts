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
 *   run_log       jsonb   default '[]',
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
import type { Territory, SiegeCharges, WorldTerritory, AttackType } from '../types';
import { SIEGE_ZERO } from '../types';
import type { HealthProfile } from '../hooks/useUserProfile';

// ── Profile ──────────────────────────────────────────────────

export async function upsertProfile(
  id: string,
  name: string,
  color: string,
  health: Partial<HealthProfile>,
  email?: string | null,
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
      ...(email != null ? { email } : {}),
    },
    { onConflict: 'id' },
  );
  if (error) console.warn('[db] upsertProfile error', error.message);
}

// ── Siege Charges ─────────────────────────────────────────────

export async function fetchCharges(userId: string): Promise<SiegeCharges> {
  if (!supabase) return { ...SIEGE_ZERO };
  const { data, error } = await supabase
    .from('profiles')
    .select('charge_inferno, charge_cyclone, charge_tremor, charge_deluge, charge_vortex')
    .eq('id', userId)
    .single();
  if (error || !data) return { ...SIEGE_ZERO };
  return {
    inferno: (data.charge_inferno as number) ?? 0,
    cyclone: (data.charge_cyclone as number) ?? 0,
    tremor:  (data.charge_tremor  as number) ?? 0,
    deluge:  (data.charge_deluge  as number) ?? 0,
    vortex:  (data.charge_vortex  as number) ?? 0,
  };
}

export async function saveCharges(userId: string, c: SiegeCharges): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('profiles')
    .update({
      charge_inferno: c.inferno,
      charge_cyclone: c.cyclone,
      charge_tremor:  c.tremor,
      charge_deluge:  c.deluge,
      charge_vortex:  c.vortex,
    })
    .eq('id', userId);
  if (error) console.warn('[db] saveCharges error', error.message);
}

// ── Enemy territories (all players except current user) ───────

export async function fetchEnemyTerritories(excludeUserId: string): Promise<WorldTerritory[]> {
  if (!supabase) return [];
  // Fetch all territories not owned by current user
  const { data: rows, error } = await supabase
    .from('territories')
    .select('*')
    .neq('user_id', excludeUserId);
  if (error) { console.warn('[db] fetchEnemyTerritories error', error.message); return []; }
  if (!rows?.length) return [];

  // Fetch owner profiles in one batch
  const ownerIds = [...new Set(rows.map(r => r.user_id as string))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, color')
    .in('id', ownerIds);
  const profileMap = new Map(
    (profiles ?? []).map(p => [p.id as string, p as { id: string; name: string; color: string }]),
  );

  return rows.map(row => {
    const owner = profileMap.get(row.user_id as string);
    return {
      ...rowToTerritory(row),
      userId:     row.user_id as string,
      ownerName:  owner?.name  ?? 'Unknown',
      ownerColor: owner?.color ?? '#64748b',
    };
  });
}

// ── Siege attacks ─────────────────────────────────────────────

export async function launchAttack(
  attackerId: string,
  territoryId: string,
  type: AttackType,
  expiresAt: number | null,   // null = permanent (tremor)
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'no_client' };
  const updates: Record<string, unknown> = {
    attack_type:       type,
    attacker_id:       attackerId,
    attack_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
  };
  // Tremor collapses the territory to Tier 1 immediately
  if (type === 'tremor') updates.runs = 1;
  const { error, count } = await supabase
    .from('territories')
    .update(updates, { count: 'exact' })
    .eq('id', territoryId);
  if (error) {
    console.error('[db] launchAttack error:', error.message, '| code:', error.code);
    return { ok: false, error: error.message };
  }
  if ((count ?? 0) === 0) {
    console.warn('[db] launchAttack: 0 rows updated — RLS policy is blocking cross-user writes.');
    console.warn('Fix: run this SQL in Supabase → CREATE POLICY "siege_attacks" ON territories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);');
    return { ok: false, error: 'rls_blocked' };
  }
  return { ok: true };
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

export async function fetchPlayerTerritories(userId: string): Promise<Territory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('territories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.warn('[db] fetchPlayerTerritories error', error.message); return []; }
  return (data ?? []).map(rowToTerritory);
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
    run_log:       t.runLog       ?? [],
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
    runs:          Number(row.runs)  || 1,
    distance:      Number(row.distance),
    duration:      Number(row.duration),
    points:        Number(row.points)  || 0,
    lastRunAt:     Number(row.last_run_at) || Date.now(),
    activityType:  (row.activity_type as 'run' | 'walk' | 'cycle') ?? 'run',
    buildingType:  (row.building_type as import('../types').ConstructionBuildingType | null) ?? undefined,
    buildings:     (row.buildings    as [])    ?? [],
    visitDays:     (row.visit_days   as number[]) ?? [],
    runLog:        (row.run_log      as import('../types').RunEntry[]) ?? [],
    createdAt:     Number(row.created_at),
    userId:        (row.user_id      as string  | null) ?? undefined,
    attackType:    (row.attack_type  as AttackType | null) ?? null,
    attackExpiresAt: row.attack_expires_at
      ? new Date(row.attack_expires_at as string).getTime()
      : null,
    attackerId:    (row.attacker_id  as string  | null) ?? null,
  };
}
