
import React, { useEffect, useState, useCallback } from 'react';

// Hàm yêu cầu xác nhận MetaMask trước khi thực hiện thao tác
/* eslint-disable @typescript-eslint/no-explicit-any */
// Hàm yêu cầu xác nhận MetaMask
async function requestMetaMaskApproval(action: string, data: Record<string, unknown>) {
  if (!(window as any).ethereum) throw new Error('MetaMask chưa được cài đặt');
  const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
  const signer = accounts[0];
  const msg = `Xác nhận thao tác: ${action}\nDữ liệu: ${JSON.stringify(data)}`;
  const signature = await (window as any).ethereum.request({
    method: 'personal_sign',
    params: [msg, signer],
  });
  return signature;
}

type Attendance = {
  id: string;
  workerId: string;
  workerName?: string;
  date: string;
  time: string;
  cid?: string;
  imageUrl?: string;
  image?: string;
  matched?: boolean;
  confidence?: number;
};

export default function ManagementWidget() {
  const [list, setList] = useState<Attendance[]>([]);

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  // Dùng useCallback để hàm này không bị tạo lại mỗi lần render -> Fix lỗi dependency
  const fetchAttendances = useCallback(async () => {
    try {
      const res = await fetch(`${backend}/api/attendances`);
      const j = await res.json();
      if (j.success) setList(j.data as Attendance[] || []);
    } catch (error) {
      console.warn('fetch attendances failed', error);
    }
  }, [backend]);

  useEffect(() => {
    fetchAttendances();
  }, [fetchAttendances]);

  useEffect(() => {
    const handler = (ev: CustomEvent) => {
      const detail = ev?.detail || {};
      const attendance = (detail.attendance || detail.data || null) as Attendance | null;

      if (attendance && attendance.id) {
        const date = attendance.date || '';
        const time = attendance.time || '';
        const cid: string = attendance.imageUrl || attendance.cid || attendance.image || '';

        const item: Attendance = {
          id: attendance.id,
          workerId: attendance.workerId || '',
          workerName: attendance.workerName,
          date,
          time,
          cid: cid || '',
          matched: attendance.matched,
          confidence: attendance.confidence
        };

        setList((s) => {
          const oldItems = s
            .filter((x) => x.id !== item.id)
            .map((x) => ({
              ...x,
              cid: x.cid || ''
            }));
          return [item, ...oldItems].slice(0, 200);
        });
      } else {
        setTimeout(() => fetchAttendances(), 1200);
      }
    };
    window.addEventListener('attendance:updated', handler as any);
    return () => window.removeEventListener('attendance:updated', handler as any);
  }, [fetchAttendances]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Danh sách điểm danh</h2>
      <div className="overflow-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-4 py-2 border">ID</th>
              <th className="px-4 py-2 border"> Name</th>
              <th className="px-4 py-2 border">Worker ID</th>
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
                <td className="px-4 py-2 border">{r.workerName || ''}</td>
                <td className="px-4 py-2 border">{r.workerId || ''}</td>
                <td className="px-4 py-2 border">{r.date}</td>
                <td className="px-4 py-2 border">{r.time}</td>
                <td className="px-4 py-2 border">
                  {r.cid ? (
                    <img src={r.cid.startsWith('http') ? r.cid : `${backend}${r.cid}`} alt={r.workerName ? `Ảnh ${r.workerName}` : `Ảnh ${r.cid}` } style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} />
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
                      // Yêu cầu xác nhận MetaMask
                      await requestMetaMaskApproval('Xóa điểm danh', { id: r.id, workerId: r.workerId });
                      // Sau khi xác nhận, thực hiện API
                      const res = await fetch(`${backend}/api/attendances/${r.id}`, { method: 'DELETE' });
                      const j = await res.json();
                      if (j.success) {
                        setList((s) => s.filter(x => x.id !== r.id));
                      } else {
                        alert('Xóa thất bại: ' + (j.error || ''));
                      }
                    } catch (e) { console.error(e); alert('Lỗi khi xóa hoặc từ chối MetaMask'); }
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
