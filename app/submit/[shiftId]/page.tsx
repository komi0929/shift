'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateDateRange, formatDate, getDayName, isHoliday, isSaturday, isSunday, formatDateFull, toDateString } from '@/lib/dates';

interface ShiftEvent { id: string; start_date: string; end_date: string; }

export default function SubmitPage() {
  const params = useParams();
  const shiftId = params.shiftId as string;
  const [event, setEvent] = useState<ShiftEvent | null>(null);
  const [disabledSlots, setDisabledSlots] = useState<Set<string>>(new Set());
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [staffName, setStaffName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState('');

  const fetchData = useCallback(async () => {
    const { data: ev } = await supabase.from('shift_events').select('*').eq('id', shiftId).single();
    if (ev) setEvent(ev);
    const { data: slots } = await supabase.from('disabled_slots').select('slot_date, slot_type').eq('shift_event_id', shiftId);
    if (slots) {
      const set = new Set<string>();
      slots.forEach((s: { slot_date: string; slot_type: string }) => set.add(`${s.slot_date}:${s.slot_type}`));
      setDisabledSlots(set);
    }
    setLoading(false);
  }, [shiftId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSlot = (date: Date, slotType: string) => {
    const key = `${toDateString(date)}:${slotType}`;
    if (disabledSlots.has(key)) return;
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!staffName.trim()) { setToast('氏名を入力してください'); setTimeout(() => setToast(''), 2500); return; }
    setSubmitting(true);
    const slots = Array.from(selectedSlots).map(k => {
      const [date, slot_type] = k.split(':');
      return { date, slot_type };
    });

    const { error } = await supabase.from('submissions').upsert({
      shift_event_id: shiftId,
      staff_name: staffName.trim(),
      selected_slots: slots,
      notes: notes.trim(),
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'shift_event_id,staff_name' });

    setSubmitting(false);
    if (!error) {
      setSubmitted(true);
    } else {
      setToast('送信に失敗しました。もう一度お試しください。');
      setTimeout(() => setToast(''), 2500);
    }
  };

  if (loading) return (
    <div className="page-container-narrow">
      <p className="text-secondary text-center" style={{ padding: 80 }}>読み込み中...</p>
    </div>
  );

  if (!event) return (
    <div className="page-container-narrow">
      <div className="empty-state">
        <h3>募集が見つかりません</h3>
        <p>このURLは無効か、募集が終了しています。</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="page-container-narrow">
      <div className="empty-state" style={{ paddingTop: 120 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✓</div>
        <h2 style={{ color: 'var(--success)' }}>送信完了</h2>
        <p className="mt-8">{staffName}さんのシフト希望を受け付けました。</p>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>内容を変更する場合は同じ氏名で再送信してください。</p>
        <button className="btn btn-secondary mt-24" onClick={() => { setSubmitted(false); }}>
          内容を修正する
        </button>
      </div>
    </div>
  );

  const dates = generateDateRange(event.start_date, event.end_date);
  const selectedCount = selectedSlots.size;

  return (
    <>
      <div className="page-container-narrow">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>シフト希望提出</p>
          <h1 style={{ fontSize: 24 }}>Shift.</h1>
          <p className="mt-8" style={{ fontSize: 14 }}>
            {formatDateFull(new Date(event.start_date + 'T00:00:00'))} 〜 {formatDateFull(new Date(event.end_date + 'T00:00:00'))}
          </p>
        </div>

        {/* Name Input */}
        <div className="card mb-16">
          <div className="input-group">
            <label className="input-label">氏名 *</label>
            <input
              type="text"
              className="input-field"
              placeholder="山田 太郎"
              value={staffName}
              onChange={e => setStaffName(e.target.value)}
              autoComplete="name"
            />
          </div>
        </div>

        {/* Shift Table */}
        <div className="card mb-16" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid var(--border-light)' }}>
            <div className="flex items-center justify-between">
              <h3 style={{ fontSize: 14 }}>希望シフト</h3>
              {selectedCount > 0 && (
                <span className="badge badge-blue">{selectedCount} 枠選択中</span>
              )}
            </div>
          </div>
          <table className="shift-table" style={{ borderRadius: 0, boxShadow: 'none', border: 'none' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: 16 }}>日付</th>
                <th style={{ width: 80 }}>前半<br/><span style={{ fontSize: 9, fontWeight: 400, opacity: 0.6 }}>10:45-16:30</span></th>
                <th style={{ width: 80 }}>後半<br/><span style={{ fontSize: 9, fontWeight: 400, opacity: 0.6 }}>16:30-22:00</span></th>
              </tr>
            </thead>
            <tbody>
              {dates.map(date => {
                const ds = toDateString(date);
                const hol = isHoliday(date);
                const sat = isSaturday(date);
                const sun = isSunday(date);
                const mKey = `${ds}:morning`;
                const aKey = `${ds}:afternoon`;
                const mDisabled = disabledSlots.has(mKey);
                const aDisabled = disabledSlots.has(aKey);
                const mSelected = selectedSlots.has(mKey);
                const aSelected = selectedSlots.has(aKey);

                let dc = 'date-cell';
                if (hol || sun) dc += ' holiday';
                else if (sat) dc += ' saturday';

                const slotClass = (disabled: boolean, selected: boolean) => {
                  if (disabled) return 'slot-cell disabled';
                  if (selected) return 'slot-cell selected';
                  return 'slot-cell';
                };

                return (
                  <tr key={ds}>
                    <td className={dc}>
                      {formatDate(date)}
                      <span className="day-name">({getDayName(date)})</span>
                    </td>
                    <td className={slotClass(mDisabled, mSelected)} onClick={() => toggleSlot(date, 'morning')} />
                    <td className={slotClass(aDisabled, aSelected)} onClick={() => toggleSlot(date, 'afternoon')} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        <div className="card mb-24">
          <div className="input-group">
            <label className="input-label">備考（任意）</label>
            <textarea
              className="input-field"
              placeholder="時間帯の変更希望やその他の連絡事項があればご記入ください"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={handleSubmit}
          disabled={submitting || !staffName.trim()}
          style={{ marginBottom: 40 }}
        >
          {submitting ? '送信中...' : 'シフト希望を送信'}
        </button>

        <p className="text-center" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 32 }}>
          同じ氏名で再送信すると、以前の内容が上書きされます。
        </p>
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
