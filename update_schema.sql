-- 1. shift_events テーブルに mode カラムを追加 ('store' または 'factory')
ALTER TABLE shift_events ADD COLUMN mode TEXT NOT NULL DEFAULT 'store' CHECK (mode IN ('store', 'factory'));

-- 2. disabled_slots テーブルの slot_type 制約を削除
-- (既存の 'morning', 'afternoon' 制約を外し、'09:00' などの時間文字列も保存できるようにする)
ALTER TABLE disabled_slots DROP CONSTRAINT disabled_slots_slot_type_check;
