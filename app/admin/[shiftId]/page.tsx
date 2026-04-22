'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateDateRange, formatDate, getDayName, isHoliday, isSaturday, isSunday, formatDateFull, toDateString } from '@/lib/dates';
import Image from 'next/image';
import Link from 'next/link';

interface ShiftEvent {
  id: string;
  start_date: string;
  end_date: string;
}

interface DisabledSlot {
  slot_date: string;
  slot_type: string;
}

export default function AdminEditPage() {
  const params = useParams();
  const shiftId = params.shiftId as string;

  const [event, setEvent] = useState<ShiftEvent | null>(null);
  const [disabledSlots, setDisabledSlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');

  const fetchData = useCallback(async () => {
    const { data: eventData } = await supabase
      .from('shift_events')
      .select('*')
      .eq('id', shiftId)
      .single();

    if (eventData) {
      setEvent(eventData);
    }

    const { data: slotsData } = await supabase
      .from('disabled_slots')
      .select('slot_date, slot_type')
      .eq('shift_event_id', shiftId);

    if (slotsData) {
      const set = new Set<string>();
      slotsData.forEach((s: DisabledSlot) => set.add(`${s.slot_date}:${s.slot_type}`));
      setDisabledSlots(set);
    }

    setLoading(false);
  }, [shiftId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleSlot = async (date: Date, slotType: string) => {
    const dateStr = toDateString(date);
    const key = `${dateStr}:${slotType}`;

    if (disabledSlots.has(key)) {
      // Enable the slot (remove from disabled)
      await supabase
        .from('disabled_slots')
        .delete()
        .eq('shift_event_id', shiftId)
        .eq('slot_date', dateStr)
        .eq('slot_type', slotType);

      setDisabledSlots(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      // Disable the slot (add to disabled)
      await supabase
        .from('disabled_slots')
        .insert({
          shift_event_id: shiftId,
          slot_date: dateStr,
          slot_type: slotType,
        });

      setDisabledSlots(prev => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
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
          <Link href="/" className="btn btn-primary">ホームに戻る</Link>
        </div>
      </div>
    );
  }

  const dates = generateDateRange(event.start_date, event.end_date);

  return (
    <>
      <header className="app-header">
        <div className="flex items-center gap-12">
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 500 }}>
            ← 戻る
          </Link>
          <Image src="/logo.png" alt="Shift." width={80} height={26} style={{ objectFit: 'contain' }} />
        </div>
        <div className="flex gap-8">
          <Link href={`/admin/${shiftId}/dashboard`} className="btn btn-ghost btn-sm">
            ダッシュボード
          </Link>
        </div>
      </header>

      <div className="page-container">
        <div style={{ marginBottom: 32 }}>
          <h1>募集枠の編集</h1>
          <p className="mt-8">
            {formatDateFull(new Date(event.start_date + 'T00:00:00'))} 〜 {formatDateFull(new Date(event.end_date + 'T00:00:00'))}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            各枠をクリックして有効/無効を切り替えます。無効な枠はスタッフ画面でグレーアウトされます。
          </p>
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
        <div style={{ overflowX: 'auto' }}>
          <table className="shift-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: 16 }}>日付</th>
                <th>前半<br/><span style={{ fontSize: 10, fontWeight: 400, opacity: 0.6 }}>10:45〜16:30</span></th>
                <th>後半<br/><span style={{ fontSize: 10, fontWeight: 400, opacity: 0.6 }}>16:30〜22:00</span></th>
              </tr>
            </thead>
            <tbody>
              {dates.map(date => {
                const dateStr = toDateString(date);
                const holiday = isHoliday(date);
                const sat = isSaturday(date);
                const sun = isSunday(date);
                const morningDisabled = disabledSlots.has(`${dateStr}:morning`);
                const afternoonDisabled = disabledSlots.has(`${dateStr}:afternoon`);

                let dateClass = 'date-cell';
                if (holiday || sun) dateClass += ' holiday';
                else if (sat) dateClass += ' saturday';

                return (
                  <tr key={dateStr}>
                    <td className={dateClass}>
                      {formatDate(date)}
                      <span className="day-name">({getDayName(date)})</span>
                    </td>
                    <td
                      className={`slot-cell-admin ${morningDisabled ? 'disabled-slot' : 'enabled'}`}
                      onClick={() => toggleSlot(date, 'morning')}
                    />
                    <td
                      className={`slot-cell-admin ${afternoonDisabled ? 'disabled-slot' : 'enabled'}`}
                      onClick={() => toggleSlot(date, 'afternoon')}
                    />
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
