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
  const activeSubs = submissions.filter(s => !s.is_hidden);
  const heatmap: Record<string, number> = {};
  activeSubs.forEach(sub => { sub.selected_slots.forEach(slot => { const k = `${slot.date}:${slot.slot_type}`; heatmap[k] = (heatmap[k] || 0) + 1; }); });
  const maxCount = Math.max(1, ...Object.values(heatmap));
  const getHeatBg = (c: number) => c === 0 ? 'transparent' : `rgba(0, 113, 227, ${0.1 + Math.min(c / maxCount, 1) * 0.4})`;

  return (
    <>
      <header className="app-header">
        <div className="flex items-center gap-12">
          <Link href={`/admin/${shiftId}`} style={{ textDecoration: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 500 }}>← 枠編集</Link>
          <Image src="/logo.png" alt="Shift." width={80} height={26} style={{ objectFit: 'contain' }} />
        </div>
        <Link href="/" className="btn btn-ghost btn-sm">ホーム</Link>
      </header>
      <div className="page-container">
        <div style={{ marginBottom: 32 }}>
          <h1>集計ダッシュボード</h1>
          <p className="mt-8">{formatDateFull(new Date(event.start_date + 'T00:00:00'))} 〜 {formatDateFull(new Date(event.end_date + 'T00:00:00'))}</p>
          <div className="flex items-center gap-16 mt-16">
            <span className="badge badge-blue">{activeSubs.length} 件の提出</span>
            {submissions.some(s => s.is_hidden) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowHidden(!showHidden)} style={{ fontSize: 12 }}>
                {showHidden ? '非表示を隠す' : `非表示を含める (${submissions.filter(s => s.is_hidden).length}件)`}
              </button>
            )}
          </div>
        </div>

        <div className="card mb-24">
          <h3 className="mb-16">希望集計ヒートマップ</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="shift-table" style={{ boxShadow: 'none', border: 'none' }}>
              <thead><tr><th style={{ textAlign: 'left', paddingLeft: 16 }}>日付</th><th>前半</th><th>後半</th></tr></thead>
              <tbody>
                {dates.map(date => {
                  const ds = toDateString(date);
                  const hol = isHoliday(date); const sat = isSaturday(date); const sun = isSunday(date);
                  const mc = heatmap[`${ds}:morning`] || 0; const ac = heatmap[`${ds}:afternoon`] || 0;
                  let dc = 'date-cell'; if (hol || sun) dc += ' holiday'; else if (sat) dc += ' saturday';
                  const cellStyle = (c: number): React.CSSProperties => ({ background: getHeatBg(c), textAlign: 'center', padding: '14px 16px', fontWeight: c > 0 ? 600 : 400, color: c > 0 ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 14 });
                  return (<tr key={ds}><td className={dc}>{formatDate(date)}<span className="day-name">({getDayName(date)})</span></td><td style={cellStyle(mc)}>{mc > 0 ? mc : '—'}</td><td style={cellStyle(ac)}>{ac > 0 ? ac : '—'}</td></tr>);
                })}
              </tbody>
            </table>
          </div>
        </div>

        <h3 className="mb-16">提出一覧</h3>
        {visibleSubs.length === 0 ? (
          <div className="empty-state"><Image src="/empty-state.png" alt="提出なし" width={160} height={160} /><h3>まだ提出がありません</h3><p>共有URLをスタッフに送信しましょう。</p></div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {visibleSubs.map((sub, i) => (
              <div key={sub.id} className="card" style={{ animationDelay: `${i * 0.03}s`, animation: 'fadeInUp 0.3s ease forwards', opacity: sub.is_hidden ? 0.5 : 0 }}>
                <div className="flex items-center justify-between mb-8" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <div className="flex items-center gap-8">
                    <h3 style={{ fontSize: 16 }}>{sub.staff_name}</h3>
                    {sub.is_hidden && <span className="badge" style={{ background: '#F0F0F0', color: '#999', fontSize: 11 }}>非表示</span>}
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleHidden(sub)} style={{ fontSize: 12 }}>{sub.is_hidden ? '表示' : '非表示'}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteSub(sub)} style={{ color: 'var(--danger)', fontSize: 12 }}>削除</button>
                  </div>
                </div>
                <div className="flex gap-8" style={{ flexWrap: 'wrap', marginBottom: sub.notes ? 12 : 0 }}>
                  {sub.selected_slots.map((slot, j) => { const sd = new Date(slot.date + 'T00:00:00'); return (<span key={j} className="badge badge-blue" style={{ fontSize: 11 }}>{formatDate(sd)}({getDayName(sd)}) {slot.slot_type === 'morning' ? '前半' : '後半'}</span>); })}
                </div>
                {sub.notes && <p style={{ fontSize: 13, color: 'var(--text-secondary)', background: '#F9F9FB', padding: '8px 12px', borderRadius: 8 }}>📝 {sub.notes}</p>}
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>提出: {new Date(sub.submitted_at).toLocaleString('ja-JP')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
