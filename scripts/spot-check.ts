import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { count: c2425 } = await sb.from('games').select('*', { count: 'exact', head: true }).eq('season', '2024-2025');
  const { count: c2526 } = await sb.from('games').select('*', { count: 'exact', head: true }).eq('season', '2025-2026');
  console.log('2024-2025 games:', c2425);
  console.log('2025-2026 games:', c2526);

  const { data: sample } = await sb.from('games').select('*').eq('season', '2025-2026').order('game_date').limit(1).single();
  console.log(`\nSample game: ${sample.game_id} | ${sample.game_date} | ${sample.away_team_code} @ ${sample.home_team_code}`);

  const { data: periods } = await sb.from('period_results').select('*').eq('game_id', sample.game_id).order('period_number').order('team_code');
  for (const p of (periods ?? [])) {
    console.log(`  P${p.period_number} ${p.team_code}: ${p.goals_for}GF ${p.goals_against}GA ${p.empty_net_goals}EN -> ${p.period_outcome} | 2+reg: ${p.won_two_plus_reg_periods}`);
  }

  const { data: enRows } = await sb
    .from('period_results')
    .select('game_id, team_code, period_number, goals_for, goals_against, empty_net_goals, period_outcome')
    .gt('empty_net_goals', 0)
    .limit(5);

  console.log('\nGames with EN goals (verify outcome excludes them):');
  for (const r of (enRows ?? [])) {
    const adjGF = r.goals_for - r.empty_net_goals;
    console.log(`  P${r.period_number} ${r.team_code}: ${r.goals_for}GF (${adjGF} adj) vs ${r.goals_against}GA -> ${r.period_outcome}`);
  }
}

main().catch(console.error);
