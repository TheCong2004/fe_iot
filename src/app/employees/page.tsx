"use client";
import React, { useEffect, useState } from 'react';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || '';

  async function fetchList() {
    try {
      const res = await fetch(`${backend}/api/employees`);
      const j = await res.json();
      if (j.success) setEmployees(j.data || []);
      else setMsg('Lỗi khi lấy danh sách: ' + (j.error || ''));
    } catch (e: any) {
      setMsg('Lỗi khi gọi API: ' + (e.message || e));
    }
  }

  useEffect(() => { fetchList(); }, []);

  async function handleDelete(workerId: string) {
    if (!confirm(`Xóa nhân viên ${workerId}?`)) return;
    try {
      const res = await fetch(`${backend}/api/employees/${workerId}`, { method: 'DELETE' });
      const j = await res.json();
      if (j.success) {
        setMsg(`Đã xóa ${workerId}`);
        fetchList();
      } else setMsg('Lỗi: ' + (j.error || ''));
    } catch (e: any) { setMsg('Lỗi khi xóa: ' + (e.message || e)); }
  }

  function exportJSON() {
    const data = employees.map(e => ({ workerId: e.workerId, name: e.name, department: e.department, descriptor: e.descriptor }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'employees_descriptors.json'; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Quản lý nhân viên (khuôn mặt)</h2>
      <div style={{ marginBottom: 12 }}>
        <button onClick={fetchList} style={{ marginRight: 8 }}>Làm mới</button>
        <button onClick={exportJSON}>Xuất JSON descriptors</button>
      </div>

      <div style={{ color: '#c00', marginBottom: 12 }}>{msg}</div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>WorkerId</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Tên</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Bộ phận</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Ảnh</th>
            <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.workerId}>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{emp.workerId}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{emp.name}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{emp.department}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                {emp.imageUrl ? <img src={emp.imageUrl} alt="img" style={{ maxWidth: 120 }} /> : (emp.cid ? <span>{emp.cid}</span> : <em>Không có ảnh</em>)}
              </td>
              <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                <button onClick={() => handleDelete(emp.workerId)} style={{ color: '#900' }}>Xóa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
