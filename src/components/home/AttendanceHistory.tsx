"use client";
import React, { useEffect, useState } from 'react';

export default function AttendanceHistory() {
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const backend = (process.env as any).NEXT_PUBLIC_BACKEND_URL || '';
        const res = await fetch(`${backend}/api/attendances?limit=1000`);
        const j = await res.json();
        if (!j || !j.success) throw new Error(j && j.error ? j.error : 'Failed to load');
        const data = j.data || [];
        setAttendances(data);
        // normalize dates to strings, dedupe, and sort
        const datesArray = (data.map((d:any) => d.date).filter(Boolean) as unknown[]).map(String);
        const ds = Array.from(new Set(datesArray)).sort((a,b)=> b.localeCompare(a));
        setDates(ds);
        setSelectedDate(ds.length ? ds[0] : null);
      } catch (e:any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const byDate = (selectedDate ? attendances.filter(a => a.date === selectedDate) : attendances);

  function prevDate() {
    if (!selectedDate) return;
    const idx = dates.indexOf(selectedDate);
    if (idx < 0) return;
    if (idx < dates.length - 1) setSelectedDate(dates[idx+1]);
  }
  function nextDate() {
    if (!selectedDate) return;
    const idx = dates.indexOf(selectedDate);
    if (idx > 0) setSelectedDate(dates[idx-1]);
  }

  return (
    <div>
      {loading ? <div>Đang tải...</div> : null}
      {error ? <div className="text-red-600">Lỗi: {error}</div> : null}

      <div className="mb-4 flex items-center gap-2">
        <button onClick={prevDate} className="px-3 py-1 bg-gray-200 rounded">← Trước</button>
        <input type="date" value={selectedDate || ''} onChange={(e)=>setSelectedDate(e.target.value)} className="px-2 py-1 border rounded" />
        <button onClick={nextDate} className="px-3 py-1 bg-gray-200 rounded">Sau →</button>
        <div className="ml-4 text-sm text-gray-600">Có {dates.length} ngày trong lịch sử</div>
      </div>

      <div>
        {byDate.length === 0 ? (
          <div className="text-gray-600">Không có bản ghi cho ngày này</div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {byDate.map((a:any) => (
              <div key={a.id} className="p-3 border rounded flex items-center gap-4">
                <div style={{width:72, height:72, flex:'0 0 72px'}}>
                  {a.cid ? (
                    <a href={`${(process.env as any).NEXT_PUBLIC_BACKEND_URL || ''}${a.cid}`} target="_blank" rel="noreferrer">
                      <img src={`${(process.env as any).NEXT_PUBLIC_BACKEND_URL || ''}${a.cid}`} alt="thumb" style={{width:72, height:72, objectFit:'cover', borderRadius:6}} />
                    </a>
                  ) : (
                    <div className="w-18 h-18 bg-gray-200 rounded" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{a.workerName || a.workerId}</div>
                  <div className="text-sm text-gray-600">Thời gian: {a.time} — Confidence: {a.confidence ?? '-'} </div>
                  <div className="text-sm text-gray-500">ID: {a.id}</div>
                </div>
                <div className="text-right">
                  {a.matched ? <div className="text-green-600">Matched</div> : <div className="text-red-600">Unmatched</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
