-- Shift Collection App - Database Schema
-- Run this in Supabase SQL Editor

-- 1. shift_events: 募集イベント
CREATE TABLE IF NOT EXISTS shift_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. disabled_slots: 管理者が無効化した枠
CREATE TABLE IF NOT EXISTS disabled_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_event_id UUID NOT NULL REFERENCES shift_events(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('morning', 'afternoon')),
  UNIQUE(shift_event_id, slot_date, slot_type)
);

-- 3. submissions: スタッフの提出データ
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_event_id UUID NOT NULL REFERENCES shift_events(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  selected_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  is_hidden BOOLEAN DEFAULT FALSE,
  UNIQUE(shift_event_id, staff_name)
);

-- Enable RLS
ALTER TABLE shift_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE disabled_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow anonymous access (no auth required)
CREATE POLICY "shift_events_select" ON shift_events FOR SELECT USING (true);
CREATE POLICY "shift_events_insert" ON shift_events FOR INSERT WITH CHECK (true);
CREATE POLICY "shift_events_update" ON shift_events FOR UPDATE USING (true);
CREATE POLICY "shift_events_delete" ON shift_events FOR DELETE USING (true);

CREATE POLICY "disabled_slots_select" ON disabled_slots FOR SELECT USING (true);
CREATE POLICY "disabled_slots_insert" ON disabled_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "disabled_slots_delete" ON disabled_slots FOR DELETE USING (true);

CREATE POLICY "submissions_select" ON submissions FOR SELECT USING (true);
CREATE POLICY "submissions_insert" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "submissions_update" ON submissions FOR UPDATE USING (true);
CREATE POLICY "submissions_delete" ON submissions FOR DELETE USING (true);
