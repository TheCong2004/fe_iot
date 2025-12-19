"use client";
import React, { useEffect, useState } from 'react';
// Hàm yêu cầu xác nhận MetaMask trước khi thực hiện thao tác
async function requestMetaMaskApproval(action: string, data: Record<string, unknown>) {
  if (!(window as any).ethereum) throw new Error('MetaMask chưa được cài đặt');
  // Tùy action, có thể encode dữ liệu khác nhau
  // Ví dụ: gửi tx lên contract với nội dung action và data
  // Ở đây chỉ demo popup ký message
  const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
  const signer = accounts[0];
  const msg = `Xác nhận thao tác: ${action}\nDữ liệu: ${JSON.stringify(data)}`;
  const signature = await (window as any).ethereum.request({
    method: 'personal_sign',
    params: [msg, signer],
  });
  // Sau này có thể gửi tx lên contract để ghi lịch sử
  return signature;
}
import { useRouter } from 'next/navigation';

type User = {
  workerId: string;
  name?: string;
  department?: string;
  imageUrl?: string;
};

export default function UsersManagement(){
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
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
          setUsers((j && j.success && j.employees) ? (j.employees as User[]) : []);
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
                {users.map((u) => (
                  <tr key={u.workerId} className="border-t">
                    <td className="px-2 py-2 align-top whitespace-nowrap">{u.workerId}</td>
                    <td className="px-2 py-2 align-top">{u.name || '-'}</td>
                    <td className="px-2 py-2 align-top">{u.department || '-'}</td>
                    <td className="px-2 py-2 align-top">
                      {u.imageUrl ? (
                        <img src={u.imageUrl.startsWith('http') ? u.imageUrl : `${backend}${u.imageUrl}`} alt={u.name ? `Ảnh ${u.name}` : `Ảnh ${u.workerId}` } style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                      ) : ('-')}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <button className="mr-2 px-2 py-1 bg-yellow-400 rounded" onClick={async () => {
                        const newName = window.prompt('Tên mới:', u.name || '') || u.name;
                        const newDept = window.prompt('Bộ phận mới:', u.department || '') || u.department;
                        try{
                          // Yêu cầu xác nhận MetaMask
                          await requestMetaMaskApproval('Sửa người dùng', { workerId: u.workerId, name: newName, department: newDept });
                          // Sau khi xác nhận, thực hiện API
                          const res = await fetch(`${backend}/api/employees/${u.workerId}`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ name: newName, department: newDept }) });
                          const j = await res.json();
                          if (j.success) {
                            setUsers((s) => s.map(x => x.workerId === u.workerId ? j.employee : x));
                          } else {
                            alert('Cập nhật thất bại: ' + (j.error || ''));
                          }
                        }catch(e){ console.error(e); alert('Lỗi khi cập nhật hoặc từ chối MetaMask'); }
                      }}>Sửa</button>
                      <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={async () => {
                        if (!confirm('Xóa người dùng này?')) return;
                        try{
                          // Yêu cầu xác nhận MetaMask
                          await requestMetaMaskApproval('Xóa người dùng', { workerId: u.workerId });
                          // Sau khi xác nhận, thực hiện API
                          const res = await fetch(`${backend}/api/employees/${u.workerId}`, { method: 'DELETE' });
                          const j = await res.json();
                          if (j.success) {
                            setUsers((s) => s.filter(x => x.workerId !== u.workerId));
                          } else {
                            alert('Xóa thất bại: ' + (j.error || ''));
                          }
                        }catch(e){ console.error(e); alert('Lỗi khi xóa hoặc từ chối MetaMask'); }
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
