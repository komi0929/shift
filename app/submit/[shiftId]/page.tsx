'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateDateRange, formatDate, getDayName, isHoliday, isSaturday, isSunday, formatDateFull, toDateString } from '@/lib/dates';

interface ShiftEvent { id: string; start_date: string; end_date: string; mode: 'store' | 'factory'; }

interface DailyTime { start: string; end: string; isOff: boolean; }

const FACTORY_HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

export default function SubmitPage() {
  const params = useParams();
  const shiftId = params.shiftId as string;
  const [event, setEvent] = useState<ShiftEvent | null>(null);
  const [disabledSlots, setDisabledSlots] = useState<Set<string>>(new Set());
  
  // Store mode state
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  
  // Factory mode state
  const [step, setStep] = useState(1);
  const [basicStartTime, setBasicStartTime] = useState('09:00');
  const [basicEndTime, setBasicEndTime] = useState('18:00');
  const [dailyTimes, setDailyTimes] = useState<Record<string, DailyTime>>({});
  
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

  const toggleSlotStore = (date: Date, slotType: string) => {
    const key = `${toDateString(date)}:${slotType}`;
    if (disabledSlots.has(key)) return;
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleNextStepFactory = () => {
    if (!staffName.trim()) { setToast('氏名を入力してください'); setTimeout(() => setToast(''), 2500); return; }
    
    if (parseInt(basicStartTime) >= parseInt(basicEndTime)) {
      setToast('終了時間は開始時間より後にしてください'); setTimeout(() => setToast(''), 2500); return;
    }

    if (event) {
      const dates = generateDateRange(event.start_date, event.end_date);
      const initialDaily: Record<string, DailyTime> = {};
      dates.forEach(d => {
        initialDaily[toDateString(d)] = { start: basicStartTime, end: basicEndTime, isOff: false };
      });
      setDailyTimes(initialDaily);
    }
    setStep(2);
  };

  const updateDailyTime = (dateStr: string, field: keyof DailyTime, value: any) => {
    setDailyTimes(prev => ({
      ...prev,
      [dateStr]: { ...prev[dateStr], [field]: value }
    }));
  };

  const handleSubmit = async () => {
    if (!staffName.trim()) { setToast('氏名を入力してください'); setTimeout(() => setToast(''), 2500); return; }
    setSubmitting(true);
    
    let slots: { date: string; slot_type: string }[] = [];
    
    if (event?.mode === 'factory') {
      Object.entries(dailyTimes).forEach(([dateStr, dt]) => {
        if (dt.isOff) return;
        const startHr = parseInt(dt.start.split(':')[0]);
        const endHr = parseInt(dt.end.split(':')[0]);
        for (let h = startHr; h < endHr; h++) {
          const slotStr = `${h.toString().padStart(2, '0')}:00`;
          if (!disabledSlots.has(`${dateStr}:${slotStr}`)) {
            slots.push({ date: dateStr, slot_type: slotStr });
          }
        }
      });
    } else {
      slots = Array.from(selectedSlots).map(k => {
        const [date, slot_type] = k.split(':');
        return { date, slot_type };
      });
    }

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
        <button className="btn btn-secondary mt-24" onClick={() => { setSubmitted(false); setStep(event.mode === 'factory' ? 1 : 1); }}>
          内容を修正する
        </button>
      </div>
    </div>
  );

  const dates = generateDateRange(event.start_date, event.end_date);
  const isFactory = event.mode === 'factory';

  return (
    <>
      <div className="page-container-narrow">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>シフト希望提出 {isFactory && '（製造）'}</p>
          <h1 style={{ fontSize: 24 }}>Shift.</h1>
          <p className="mt-8" style={{ fontSize: 14 }}>
            {formatDateFull(new Date(event.start_date + 'T00:00:00'))} 〜 {formatDateFull(new Date(event.end_date + 'T00:00:00'))}
          </p>
        </div>

        {isFactory && step === 1 ? (
          <>
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

            <div className="card mb-16">
              <h3 style={{ fontSize: 15, marginBottom: 16 }}>基本の勤務時間</h3>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                普段出勤できる時間帯を設定してください。次の画面で日ごとの微調整ができます。
              </p>
              <div className="flex items-center gap-12" style={{ flexWrap: 'wrap' }}>
                <select className="input-field" style={{ width: 120 }} value={basicStartTime} onChange={e => setBasicStartTime(e.target.value)}>
                  {FACTORY_HOURS.slice(0, -1).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span>〜</span>
                <select className="input-field" style={{ width: 120 }} value={basicEndTime} onChange={e => setBasicEndTime(e.target.value)}>
                  {FACTORY_HOURS.slice(1).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg btn-full mt-24"
              onClick={handleNextStepFactory}
              disabled={!staffName.trim()}
            >
              次へ（日ごとの調整）
            </button>
          </>
        ) : (
          <>
            {!isFactory && (
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
            )}

            {isFactory && step === 2 && (
              <div className="flex items-center justify-between mb-16">
                <button className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>← 基本設定に戻る</button>
                <div style={{ fontSize: 14 }}>氏名: <strong>{staffName}</strong></div>
              </div>
            )}

            {/* Shift Table */}
            <div className="card mb-16" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid var(--border-light)' }}>
                <div className="flex items-center justify-between">
                  <h3 style={{ fontSize: 14 }}>{isFactory ? '日ごとの調整' : '希望シフト'}</h3>
                  {!isFactory && selectedSlots.size > 0 && (
                    <span className="badge badge-blue">{selectedSlots.size} 枠選択中</span>
                  )}
                </div>
              </div>
              
              {isFactory ? (
                <div style={{ padding: 16 }}>
                  {dates.map(date => {
                    const ds = toDateString(date);
                    const hol = isHoliday(date);
                    const sat = isSaturday(date);
                    const sun = isSunday(date);
                    const dt = dailyTimes[ds] || { start: '09:00', end: '18:00', isOff: false };

                    let textStyle: any = { fontWeight: 500 };
                    if (hol || sun) textStyle.color = 'var(--danger)';
                    else if (sat) textStyle.color = 'var(--info)';

                    return (
                      <div key={ds} className="flex items-center justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ minWidth: 100, ...textStyle }}>
                          {formatDate(date)} <span style={{ fontSize: 12, opacity: 0.8 }}>({getDayName(date)})</span>
                        </div>
                        <div className="flex items-center gap-12">
                          <label className="flex items-center gap-4" style={{ fontSize: 14, cursor: 'pointer', marginRight: 8 }}>
                            <input type="checkbox" checked={dt.isOff} onChange={e => updateDailyTime(ds, 'isOff', e.target.checked)} />
                            休み
                          </label>
                          <select 
                            className="input-field" style={{ width: 90, padding: '6px 8px', fontSize: 14 }} 
                            value={dt.start} 
                            onChange={e => updateDailyTime(ds, 'start', e.target.value)}
                            disabled={dt.isOff}
                          >
                            {FACTORY_HOURS.slice(0, -1).map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <span>〜</span>
                          <select 
                            className="input-field" style={{ width: 90, padding: '6px 8px', fontSize: 14 }} 
                            value={dt.end} 
                            onChange={e => updateDailyTime(ds, 'end', e.target.value)}
                            disabled={dt.isOff}
                          >
                            {FACTORY_HOURS.slice(1).map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
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
                          <td className={slotClass(mDisabled, mSelected)} onClick={() => toggleSlotStore(date, 'morning')} />
                          <td className={slotClass(aDisabled, aSelected)} onClick={() => toggleSlotStore(date, 'afternoon')} />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
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
              disabled={submitting || (!isFactory && !staffName.trim())}
              style={{ marginBottom: 40 }}
            >
              {submitting ? '送信中...' : 'シフト希望を送信'}
            </button>

            <p className="text-center" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 32 }}>
              同じ氏名で再送信すると、以前の内容が上書きされます。
            </p>
          </>
        )}
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
