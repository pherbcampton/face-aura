import type { DailyRoutineCompletion, DailyRoutineRecord, SkinAnalysis, ProgressEntry } from './types'
import { supabase } from './lib/supabase'

export async function loadLatestAnalysis(userId: string): Promise<SkinAnalysis | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('skin_analyses')
    .select('result')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.result as SkinAnalysis | null
}

export async function saveAnalysis(userId: string, analysis: SkinAnalysis, goals: string[] = []) {
  if (!supabase) return
  const { error } = await supabase.from('skin_analyses').insert({ user_id: userId, goals, result: analysis })
  if (error) throw error
}

export async function loadProgress(userId: string): Promise<ProgressEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('progress_entries')
    .select('id, checkin_date, blemishes, dark_spots, hydration')
    .eq('user_id', userId)
    .order('checkin_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map((entry) => ({
    id: entry.id as string,
    date: new Date(`${entry.checkin_date as string}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    blemishes: entry.blemishes as number,
    darkSpots: entry.dark_spots as number,
    hydration: entry.hydration as number,
  }))
}

export async function saveProgress(userId: string, entry: Omit<ProgressEntry, 'id' | 'date'>): Promise<ProgressEntry> {
  if (!supabase) throw new Error('Cloud data is not configured.')
  const { data, error } = await supabase
    .from('progress_entries')
    .insert({ user_id: userId, blemishes: entry.blemishes, dark_spots: entry.darkSpots, hydration: entry.hydration })
    .select('id, checkin_date')
    .single()
  if (error) throw error
  return {
    id: data.id as string,
    date: new Date(`${data.checkin_date as string}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    ...entry,
  }
}

export async function loadDailyRoutine(userId: string, date: string): Promise<DailyRoutineRecord> {
  if (!supabase) return { completion: { morning: [], evening: [] }, updatedAt: null }
  const { data, error } = await supabase
    .from('daily_routine_completions')
    .select('morning_steps, evening_steps, updated_at')
    .eq('user_id', userId)
    .eq('completion_date', date)
    .maybeSingle()
  if (error) throw error
  return {
    completion: {
      morning: (data?.morning_steps as string[] | undefined) ?? [],
      evening: (data?.evening_steps as string[] | undefined) ?? [],
    },
    updatedAt: (data?.updated_at as string | undefined) ?? null,
  }
}

export async function saveDailyRoutine(userId: string, date: string, completion: DailyRoutineCompletion): Promise<string> {
  if (!supabase) throw new Error('Cloud data is not configured.')
  const updatedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('daily_routine_completions')
    .upsert({
      user_id: userId,
      completion_date: date,
      morning_steps: completion.morning,
      evening_steps: completion.evening,
      updated_at: updatedAt,
    }, { onConflict: 'user_id,completion_date' })
    .select('updated_at')
    .single()
  if (error) throw error
  return data.updated_at as string
}

export type BookingInput = {
  salonId: string
  salonName: string
  treatment: string
  startsAt: string
  priceGbp: number
}

export async function saveBooking(userId: string, booking: BookingInput) {
  if (!supabase) throw new Error('Cloud data is not configured.')
  const { error } = await supabase.from('bookings').insert({
    user_id: userId,
    salon_id: booking.salonId,
    salon_name: booking.salonName,
    treatment: booking.treatment,
    starts_at: booking.startsAt,
    price_gbp: booking.priceGbp,
  })
  if (error) throw error
}
