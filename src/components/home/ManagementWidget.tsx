"use client";
import React, { useEffect, useState } from 'react';

export default function ManagementWidget() {
  const [list, setList] = useState<any[]>([]);

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    fetch(`${backend}/api/attendances`).then((r) => {
      if (!r.ok) throw new Error('Network response not ok');
      return r.json();
    }).then((j) => {
      if (j.success) setList(j.data || []);
    }).catch((e) => console.warn('fetch attendances failed', e));
  }, [backend]);

  const fetchAttendances = async () => {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const res = await fetch(`${backend}/api/attendances`);
    const j = await res.json();
    if (j.success) setList(j.data || []);
  };

  useEffect(() => {
    fetchAttendances();
  }, []);

  useEffect(() => {
    // Listen for attendance updates triggered by the client (e.g., after camera scan)
    const handler = (ev: any) => {
      const detail = ev?.detail || {};
      const attendance = detail.attendance || detail.data || null;
      if (attendance && attendance.id) {
        // if we received attendance info from camera, prepend to list (optimistic)
        const date = attendance.date || '';
        const time = attendance.time || '';
        const cid = attendance.imageUrl || attendance.cid || attendance.image || '';
        const item = {
          id: attendance.id,
          workerId: attendance.workerId || '',
          date,
          time,
          cid,
          matched: attendance.matched,
          confidence: attendance.confidence
        };
        setList((s) => [item].concat(s.filter((x) => x.id !== item.id)).slice(0, 200));
      } else {
        // small debounce: wait a short moment for the chain/backend to settle, then refresh
        setTimeout(() => fetchAttendances(), 1200);
      }
    };
    window.addEventListener('attendance:updated', handler as EventListener);
    return () => window.removeEventListener('attendance:updated', handler as EventListener);
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Danh sách điểm danh</h2>
      <div className="overflow-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-4 py-2 border">ID</th>
              <th className="px-4 py-2 border">Worker</th>
              <th className="px-4 py-2 border">Date</th>
              <th className="px-4 py-2 border">Time</th>
              <th className="px-4 py-2 border">CID</th>
              <th className="px-4 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 border">{r.id}</td>
                <td className="px-4 py-2 border">{r.workerName ? `${r.workerName} (${r.workerId || ''})` : (r.workerId || '')}</td>
                <td className="px-4 py-2 border">{r.date}</td>
                <td className="px-4 py-2 border">{r.time}</td>
                <td className="px-4 py-2 border">
                  {r.cid ? (
                    <img src={r.cid.startsWith('http') ? r.cid : `${backend}${r.cid}`} alt="thumb" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} />
                  ) : ('')}
                </td>
                <td className="px-4 py-2 border">
                  <button className="mr-2 px-2 py-1 bg-yellow-400 rounded" onClick={async () => {
                    const newWorker = window.prompt('Sửa workerId', r.workerId || '') || r.workerId;
                    if (newWorker === r.workerId) return;
                    try {
                      const res = await fetch(`${backend}/api/attendances/${r.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workerId: newWorker }) });
                      const j = await res.json();
                      if (j.success) {
                        setList((s) => s.map(x => x.id === r.id ? ({ ...x, workerId: newWorker }) : x));
                      } else {
                        alert('Cập nhật thất bại: ' + (j.error || ''));
                      }
                    } catch (e) { console.error(e); alert('Lỗi khi cập nhật'); }
                  }}>Sửa</button>
                  <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={async () => {
                    if (!confirm('Xóa bản ghi điểm danh này?')) return;
                    try {
                      const res = await fetch(`${backend}/api/attendances/${r.id}`, { method: 'DELETE' });
                      const j = await res.json();
                      if (j.success) {
                        setList((s) => s.filter(x => x.id !== r.id));
                      } else {
                        alert('Xóa thất bại: ' + (j.error || ''));
                      }
                    } catch (e) { console.error(e); alert('Lỗi khi xóa'); }
                  }}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
