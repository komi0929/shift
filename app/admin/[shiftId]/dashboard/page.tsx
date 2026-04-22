'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateDateRange, formatDate, getDayName, isHoliday, isSaturday, isSunday, formatDateFull, toDateString } from '@/lib/dates';
import Image from 'next/image';
import Link from 'next/link';

interface ShiftEvent { id: string; start_date: string; end_date: string; }
interface Submission { id: string; staff_name: string; selected_slots: Array<{ date: string; slot_type: string }>; notes: string; submitted_at: string; is_hidden: boolean; }

export default function DashboardPage() {
  const params = useParams();
  const shiftId = params.shiftId as string;
  const [event, setEvent] = useState<ShiftEvent | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [toast, setToast] = useState('');

  const fetchData = useCallback(async () => {
    const { data: ev } = await supabase.from('shift_events').select('*').eq('id', shiftId).single();
    if (ev) setEvent(ev);
    const { data: subs } = await supabase.from('submissions').select('*').eq('shift_event_id', shiftId).order('submitted_at', { ascending: true });
    if (subs) setSubmissions(subs);
    setLoading(false);
  }, [shiftId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showToastMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const toggleHidden = async (sub: Submission) => {
    await supabase.from('submissions').update({ is_hidden: !sub.is_hidden }).eq('id', sub.id);
    showToastMsg(sub.is_hidden ? '表示に戻しました' : '非表示にしました');
    fetchData();
  };

  const deleteSub = async (sub: Submission) => {
    if (!window.confirm(`${sub.staff_name}さんのデータを削除しますか？`)) return;
    await supabase.from('submissions').delete().eq('id', sub.id);
    showToastMsg('削除しました');
    fetchData();
  };

  if (loading) return <div className="page-container"><p className="text-secondary text-center" style={{ padding: 80 }}>読み込み中...</p></div>;
  if (!event) return <div className="page-container"><div className="empty-state"><h3>募集が見つかりません</h3><Link href="/" className="btn btn-primary">ホームに戻る</Link></div></div>;

  const dates = generateDateRange(event.start_date, event.end_date);
  const visibleSubs = submissions.filter(s => showHidden || !s.is_hidden);
  
  const rows = dates.flatMap(d => [
    { dateStr: toDateString(d), slotType: 'morning', date: d },
    { dateStr: toDateString(d), slotType: 'afternoon', date: d }
  ]);

  const copyToClipboard = () => {
    let tsv = '日付\t曜日\t枠';
    visibleSubs.forEach(sub => {
      tsv += `\t${sub.staff_name}`;
    });
    tsv += '\n';

    rows.forEach(row => {
      const ds = row.dateStr;
      const dateFormatted = formatDate(row.date);
      const dayName = getDayName(row.date);
      const slotLabel = row.slotType === 'morning' ? '前半' : '後半';
      
      let line = `${dateFormatted}\t${dayName}\t${slotLabel}`;
      visibleSubs.forEach(sub => {
        const hasSlot = sub.selected_slots.some(s => s.date === ds && s.slot_type === row.slotType);
        line += `\t${hasSlot ? '◯' : ''}`;
      });
      tsv += line + '\n';
    });

    navigator.clipboard.writeText(tsv);
    showToastMsg('エクセル用にコピーしました');
  };

  return (
    <>
      <header className="app-header">
        <div className="flex items-center gap-12">
          <Link href={`/admin/${shiftId}`} style={{ textDecoration: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 500 }}>← 枠編集</Link>
          <Image src="/logo.png" alt="Shift." width={80} height={26} style={{ objectFit: 'contain' }} />
        </div>
        <Link href="/" className="btn btn-ghost btn-sm">ホーム</Link>
      </header>
      <div className="page-container" style={{ maxWidth: '100%' }}>
        <div style={{ marginBottom: 32 }}>
          <h1>集計ダッシュボード</h1>
          <p className="mt-8">{formatDateFull(new Date(event.start_date + 'T00:00:00'))} 〜 {formatDateFull(new Date(event.end_date + 'T00:00:00'))}</p>
          <div className="flex items-center gap-16 mt-16">
            <span className="badge badge-blue">{submissions.filter(s => !s.is_hidden).length} 件の提出</span>
            {submissions.some(s => s.is_hidden) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowHidden(!showHidden)} style={{ fontSize: 12 }}>
                {showHidden ? '非表示を隠す' : `非表示を含める (${submissions.filter(s => s.is_hidden).length}件)`}
              </button>
            )}
          </div>
        </div>

        <div className="card mb-24">
          <div className="flex items-center justify-between mb-16" style={{ flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0 }}>シフト提出マトリクス</h3>
            <button className="btn btn-secondary btn-sm" onClick={copyToClipboard}>
              📋 エクセル用にコピー
            </button>
          </div>
          
          {visibleSubs.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <Image src="/empty-state.png" alt="提出なし" width={120} height={120} />
              <h3 style={{ marginTop: 16 }}>まだ提出がありません</h3>
              <p>共有URLをスタッフに送信しましょう。</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
              <table className="shift-table" style={{ whiteSpace: 'nowrap', borderCollapse: 'collapse', border: 'none', boxShadow: 'none' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 10, borderRight: '1px solid var(--border-light)' }}>日付</th>
                    <th style={{ position: 'sticky', left: 100, background: '#FAFAFA', zIndex: 10, borderRight: '1px solid var(--border-light)' }}>枠</th>
                    {visibleSubs.map(sub => (
                      <th key={sub.id} style={{ minWidth: 100, borderBottom: '1px solid var(--border-light)' }}>
                        <div className="flex-col items-center gap-4">
                          <span style={{ opacity: sub.is_hidden ? 0.5 : 1 }}>{sub.staff_name}</span>
                          <div className="flex gap-4 justify-center" style={{ opacity: 0.7 }}>
                            <button onClick={() => toggleHidden(sub)} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>{sub.is_hidden ? '表示' : '非表示'}</button>
                            <button onClick={() => deleteSub(sub)} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>削除</button>
                          </div>
                          {sub.notes && (
                            <span title={sub.notes} style={{ fontSize: 10, background: '#F0F0F0', padding: '2px 6px', borderRadius: 4, marginTop: 4, cursor: 'help', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>📝 備考</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const ds = row.dateStr;
                    const hol = isHoliday(row.date);
                    const sat = isSaturday(row.date);
                    const sun = isSunday(row.date);
                    let dc = 'date-cell';
                    if (hol || sun) dc += ' holiday';
                    else if (sat) dc += ' saturday';
                    
                    const isMorning = row.slotType === 'morning';
                    
                    return (
                      <tr key={`${ds}-${row.slotType}`}>
                        {isMorning && (
                          <td rowSpan={2} className={dc} style={{ position: 'sticky', left: 0, background: 'var(--card)', zIndex: 1, borderRight: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
                            {formatDate(row.date)}
                            <span className="day-name">({getDayName(row.date)})</span>
                          </td>
                        )}
                        <td style={{ position: 'sticky', left: 100, background: 'var(--card)', zIndex: 1, fontSize: 13, color: 'var(--text-secondary)', borderRight: '1px solid var(--border-light)', borderBottom: isMorning ? 'none' : '1px solid var(--border-light)' }}>
                          {isMorning ? '前半' : '後半'}
                        </td>
                        {visibleSubs.map(sub => {
                          const hasSlot = sub.selected_slots.some(s => s.date === ds && s.slot_type === row.slotType);
                          return (
                            <td key={sub.id} style={{ background: hasSlot ? (sub.is_hidden ? '#F0F0F0' : 'var(--accent-light)') : 'transparent', color: hasSlot ? (sub.is_hidden ? '#999' : 'var(--accent)') : 'transparent', fontWeight: 600, textAlign: 'center', fontSize: 18, borderBottom: isMorning ? 'none' : '1px solid var(--border-light)' }}>
                              {hasSlot ? '◯' : ''}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
