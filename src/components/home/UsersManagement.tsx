"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UsersManagement(){
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    async function load(){
      try{
        const res = await fetch(`${backend}/api/employees`);
        if (!res.ok) throw new Error('Network error');
        const j = await res.json();
        if (mounted){
          setUsers((j && j.success && j.employees) ? j.employees : []);
        }
      }catch(e){
        console.warn('Failed to load employees', e);
        if (mounted) setUsers([]);
      }finally{
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [backend]);

  return (
    <div className="p-4 bg-white rounded shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium">Danh sách người dùng</h3>
        <div className="text-sm text-gray-500">{loading ? 'Đang tải...' : `${users.length} người`}</div>
      </div>
      <div className="mb-3">
        <button className="px-3 py-1 bg-green-500 text-white rounded" onClick={() => router.push('/register')}>Thêm người dùng</button>
      </div>
      {loading ? (
        <div className="text-gray-600">Đang tải dữ liệu...</div>
      ) : (
        <div className="overflow-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-2 py-1">WorkerId</th>
                <th className="px-2 py-1">Tên</th>
                <th className="px-2 py-1">Bộ phận</th>
                <th className="px-2 py-1">Ảnh</th>
              </tr>
            </thead>
            <tbody>
                {users.map(u => (
                  <tr key={u.workerId} className="border-t">
                    <td className="px-2 py-2 align-top whitespace-nowrap">{u.workerId}</td>
                    <td className="px-2 py-2 align-top">{u.name || '-'}</td>
                    <td className="px-2 py-2 align-top">{u.department || '-'}</td>
                    <td className="px-2 py-2 align-top">
                      {u.imageUrl ? (
                        <img src={u.imageUrl.startsWith('http') ? u.imageUrl : `${backend}${u.imageUrl}`} alt="avatar" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                      ) : ('-')}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <button className="mr-2 px-2 py-1 bg-yellow-400 rounded" onClick={async () => {
                        const newName = window.prompt('Tên mới:', u.name || '') || u.name;
                        const newDept = window.prompt('Bộ phận mới:', u.department || '') || u.department;
                        try{
                          const res = await fetch(`${backend}/api/employees/${u.workerId}`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ name: newName, department: newDept }) });
                          const j = await res.json();
                          if (j.success) {
                            setUsers((s) => s.map(x => x.workerId === u.workerId ? j.employee : x));
                          } else {
                            alert('Cập nhật thất bại: ' + (j.error || ''));
                          }
                        }catch(e){ console.error(e); alert('Lỗi khi cập nhật'); }
                      }}>Sửa</button>
                      <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={async () => {
                        if (!confirm('Xóa người dùng này?')) return;
                        try{
                          const res = await fetch(`${backend}/api/employees/${u.workerId}`, { method: 'DELETE' });
                          const j = await res.json();
                          if (j.success) {
                            setUsers((s) => s.filter(x => x.workerId !== u.workerId));
                          } else {
                            alert('Xóa thất bại: ' + (j.error || ''));
                          }
                        }catch(e){ console.error(e); alert('Lỗi khi xóa'); }
                      }}>Xóa</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
