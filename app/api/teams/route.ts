import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET() {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error: 'Database not configured',
        message: 'Supabase environment variables are not set. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        teams: []
      },
      { status: 503 }
    );
  }

  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('*')
      .order('team_name', { ascending: true });

    if (error) {
      console.error('Error fetching teams:', error);
      return NextResponse.json(
        { error: 'Failed to fetch teams', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ teams: teams || [] });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
