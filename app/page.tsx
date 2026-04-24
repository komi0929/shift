'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateFull } from '@/lib/dates';
import Image from 'next/image';
import Link from 'next/link';

interface ShiftEvent {
  id: string;
  start_date: string;
  end_date: string;
  created_at: string;
  mode: 'store' | 'factory';
}

export default function AdminHome() {
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mode, setMode] = useState<'store' | 'factory'>('store');
  const [creating, setCreating] = useState(false);

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('shift_events')
      .select('*')
      .order('created_at', { ascending: false });
    setEvents(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCreate = async () => {
    if (!startDate || !endDate) return;
    setCreating(true);

    const { error } = await supabase
      .from('shift_events')
      .insert({ start_date: startDate, end_date: endDate, mode });

    if (!error) {
      setShowModal(false);
      setStartDate('');
      setEndDate('');
      setMode('store');
      fetchEvents();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('この募集を削除しますか？関連するすべてのデータが削除されます。')) return;
    await supabase.from('shift_events').delete().eq('id', id);
    fetchEvents();
  };

  return (
    <>
      <header className="app-header">
        <div className="flex items-center gap-12">
          <Image src="/logo.png" alt="Shift." width={100} height={32} className="app-logo" style={{ objectFit: 'contain' }} />
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          新規募集
        </button>
      </header>

      <div className="page-container">
        <div style={{ marginBottom: 32 }}>
          <h1>シフト募集</h1>
          <p className="mt-8">募集イベントを作成し、スタッフにURLを共有してシフトを収集します。</p>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>読み込み中...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <Image src="/empty-state.png" alt="データなし" width={200} height={200} />
            <h3>まだ募集がありません</h3>
            <p>「新規募集」ボタンから最初のシフト募集を作成しましょう。</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              最初の募集を作成
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {events.map((event, index) => (
              <div
                key={event.id}
                className="card"
                style={{ animationDelay: `${index * 0.05}s`, animation: 'fadeInUp 0.4s ease forwards', opacity: 0 }}
              >
                <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div className="flex items-center gap-8 mb-8">
                      <span className="badge badge-blue">
                        {formatDateFull(new Date(event.start_date + 'T00:00:00'))} 〜 {formatDateFull(new Date(event.end_date + 'T00:00:00'))}
                      </span>
                      <span className={`badge ${event.mode === 'factory' ? 'badge-green' : ''}`} style={event.mode !== 'factory' ? { background: '#F0F0F0', color: '#666' } : {}}>
                        {event.mode === 'factory' ? '製造モード' : '店舗モード'}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                      作成: {new Date(event.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                    <Link href={`/admin/${event.id}`} className="btn btn-secondary btn-sm">
                      枠を編集
                    </Link>
                    <Link href={`/admin/${event.id}/dashboard`} className="btn btn-primary btn-sm">
                      ダッシュボード
                    </Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(event.id)} style={{ color: 'var(--danger)' }}>
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>新規シフト募集</h2>
            <p className="mb-24">シフトを収集する期間とモードを指定してください。</p>

            <div className="flex-col gap-16 mb-24">
              <div className="input-group">
                <label className="input-label">募集モード</label>
                <div className="flex gap-16 mt-8">
                  <label className="flex items-center gap-8" style={{ cursor: 'pointer' }}>
                    <input type="radio" name="mode" value="store" checked={mode === 'store'} onChange={() => setMode('store')} />
                    <span>店舗スタッフ（前半/後半）</span>
                  </label>
                  <label className="flex items-center gap-8" style={{ cursor: 'pointer' }}>
                    <input type="radio" name="mode" value="factory" checked={mode === 'factory'} onChange={() => setMode('factory')} />
                    <span>製造スタッフ（1時間刻み）</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex-col gap-16">
              <div className="input-group">
                <label className="input-label">開始日</label>
                <input
                  type="date"
                  className="input-field"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">終了日</label>
                <input
                  type="date"
                  className="input-field"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>

            <div className="modal-actions mt-32">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
                キャンセル
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!startDate || !endDate || creating}
              >
                {creating ? '作成中...' : '募集を作成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
