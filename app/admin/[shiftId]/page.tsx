'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateDateRange, formatDate, getDayName, isHoliday, isSaturday, isSunday, formatDateFull, toDateString } from '@/lib/dates';
import Image from 'next/image';

interface ShiftEvent {
  id: string;
  start_date: string;
  end_date: string;
  mode: 'store' | 'factory';
}

interface DisabledSlot {
  slot_date: string;
  slot_type: string;
}

const FACTORY_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export default function AdminEditPage() {
  const params = useParams();
  const shiftId = params.shiftId as string;
  const router = useRouter();

  const [event, setEvent] = useState<ShiftEvent | null>(null);
  const [initialDisabledSlots, setInitialDisabledSlots] = useState<Set<string>>(new Set());
  const [disabledSlots, setDisabledSlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');

  const fetchData = useCallback(async () => {
    const { data: eventData } = await supabase
      .from('shift_events')
      .select('*')
      .eq('id', shiftId)
      .single();

    if (eventData) {
      setEvent(eventData as ShiftEvent);
    }

    const { data: slotsData } = await supabase
      .from('disabled_slots')
      .select('slot_date, slot_type')
      .eq('shift_event_id', shiftId);

    if (slotsData) {
      const set = new Set<string>();
      slotsData.forEach((s: DisabledSlot) => set.add(`${s.slot_date}:${s.slot_type}`));
      setInitialDisabledSlots(new Set(set));
      setDisabledSlots(new Set(set));
    }

    setLoading(false);
  }, [shiftId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasUnsavedChanges = useMemo(() => {
    if (initialDisabledSlots.size !== disabledSlots.size) return true;
    for (const key of Array.from(disabledSlots)) {
      if (!initialDisabledSlots.has(key)) return true;
    }
    return false;
  }, [initialDisabledSlots, disabledSlots]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleNavigation = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    if (hasUnsavedChanges) {
      if (!window.confirm('保存されていない変更があります。破棄して移動しますか？')) return;
    }
    router.push(path);
  };

  const toggleSlot = (date: Date, slotType: string) => {
    const dateStr = toDateString(date);
    const key = `${dateStr}:${slotType}`;

    setDisabledSlots(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const saveChanges = async () => {
    setSubmitting(true);
    const toInsert = Array.from(disabledSlots).filter(k => !initialDisabledSlots.has(k));
    const toDelete = Array.from(initialDisabledSlots).filter(k => !disabledSlots.has(k));

    try {
      if (toDelete.length > 0) {
        for (const key of toDelete) {
          const [date, type] = key.split(':');
          await supabase.from('disabled_slots')
            .delete()
            .eq('shift_event_id', shiftId)
            .eq('slot_date', date)
            .eq('slot_type', type);
        }
      }

      if (toInsert.length > 0) {
        const insertData = toInsert.map(key => {
          const [date, type] = key.split(':');
          return { shift_event_id: shiftId, slot_date: date, slot_type: type };
        });
        await supabase.from('disabled_slots').insert(insertData);
      }

      setInitialDisabledSlots(new Set(disabledSlots));
      showToast('設定を保存しました');
    } catch (err) {
      console.error(err);
      showToast('保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const copyUrl = () => {
    const url = `${window.location.origin}/submit/${shiftId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    showToast('URLをコピーしました');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="page-container">
        <p className="text-secondary text-center" style={{ padding: 80 }}>読み込み中...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>募集が見つかりません</h3>
          <p>指定されたシフト募集は存在しません。</p>
          <a href="/" className="btn btn-primary">ホームに戻る</a>
        </div>
      </div>
    );
  }

  const dates = generateDateRange(event.start_date, event.end_date);
  const isFactory = event.mode === 'factory';

  return (
    <>
      <header className="app-header">
        <div className="flex items-center gap-12">
          <a href="/" onClick={(e) => handleNavigation(e, '/')} style={{ textDecoration: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            ← 戻る
          </a>
          <Image src="/logo.png" alt="Shift." width={80} height={26} style={{ objectFit: 'contain' }} />
        </div>
        <div className="flex gap-8">
          <a href={`/admin/${shiftId}/dashboard`} onClick={(e) => handleNavigation(e, `/admin/${shiftId}/dashboard`)} className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
            ダッシュボード
          </a>
        </div>
      </header>

      <div className="page-container">
        <div className="flex items-center justify-between" style={{ marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1>{isFactory ? '募集枠の編集（製造）' : '募集枠の編集（店舗）'}</h1>
            <p className="mt-8">
              {formatDateFull(new Date(event.start_date + 'T00:00:00'))} 〜 {formatDateFull(new Date(event.end_date + 'T00:00:00'))}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
              各枠をクリックして有効/無効を切り替えます。
            </p>
          </div>
          <div>
            <button 
              className={`btn ${hasUnsavedChanges ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={saveChanges}
              disabled={!hasUnsavedChanges || submitting}
            >
              {submitting ? '保存中...' : hasUnsavedChanges ? '● 変更を保存する' : '変更はありません'}
            </button>
          </div>
        </div>

        {/* Share URL Section */}
        <div className="card mb-24" style={{ background: 'var(--accent-light)', borderColor: 'transparent' }}>
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>共有URL</h3>
              <p style={{ fontSize: 13, color: 'var(--accent)', opacity: 0.7, marginTop: 4, wordBreak: 'break-all' }}>
                {typeof window !== 'undefined' ? `${window.location.origin}/submit/${shiftId}` : ''}
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={copyUrl}>
              {copied ? '✓ コピー済み' : 'URLをコピー'}
            </button>
          </div>
        </div>

        {/* Shift Table */}
        <div style={{ overflowX: 'auto', paddingBottom: 80 }}>
          <table className="shift-table" style={isFactory ? { whiteSpace: 'nowrap' } : {}}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: 16 }}>日付</th>
                {isFactory ? (
                  FACTORY_SLOTS.map(time => (
                    <th key={time} style={{ minWidth: 60 }}>{time}</th>
                  ))
                ) : (
                  <>
                    <th>前半<br/><span style={{ fontSize: 10, fontWeight: 400, opacity: 0.6 }}>10:45〜16:30</span></th>
                    <th>後半<br/><span style={{ fontSize: 10, fontWeight: 400, opacity: 0.6 }}>16:30〜22:00</span></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {dates.map(date => {
                const dateStr = toDateString(date);
                const holiday = isHoliday(date);
                const sat = isSaturday(date);
                const sun = isSunday(date);

                let dateClass = 'date-cell';
                if (holiday || sun) dateClass += ' holiday';
                else if (sat) dateClass += ' saturday';

                return (
                  <tr key={dateStr}>
                    <td className={dateClass}>
                      {formatDate(date)}
                      <span className="day-name">({getDayName(date)})</span>
                    </td>
                    
                    {isFactory ? (
                      FACTORY_SLOTS.map(time => {
                        const disabled = disabledSlots.has(`${dateStr}:${time}`);
                        return (
                          <td
                            key={time}
                            className={`slot-cell-admin ${disabled ? 'disabled-slot' : 'enabled'}`}
                            onClick={() => toggleSlot(date, time)}
                          />
                        );
                      })
                    ) : (
                      <>
                        <td
                          className={`slot-cell-admin ${disabledSlots.has(`${dateStr}:morning`) ? 'disabled-slot' : 'enabled'}`}
                          onClick={() => toggleSlot(date, 'morning')}
                        />
                        <td
                          className={`slot-cell-admin ${disabledSlots.has(`${dateStr}:afternoon`) ? 'disabled-slot' : 'enabled'}`}
                          onClick={() => toggleSlot(date, 'afternoon')}
                        />
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
