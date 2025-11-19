"use client";
import React, { useState, useCallback, useEffect } from 'react';
import FaceScanner from '@/components/FaceScanner';

export default function AttendanceWidget() {
  const [msg, setMsg] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [useOnChain, setUseOnChain] = useState(false); // nếu true sẽ dùng MetaMask, nếu false lưu lên backend

  useEffect(() => {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    fetch(`${backend}/api/employees`).then((r) => r.json()).then((j) => {
      if (j.success) setEmployees(j.data || []);
    }).catch((e) => console.warn(e));
  }, []);

  // New behavior: use FaceScanner to detect faces and call server /api/scan-and-mark
  const [processing, setProcessing] = useState(false);
  const [lastMarked, setLastMarked] = useState<{ workerId?: string; ts: number } | null>(null);
  const [customId, setCustomId] = useState('');
  const [sendCustomId, setSendCustomId] = useState(false);

  async function handleDetected(d: { dataUrl: string; bbox?: { x:number,y:number,w:number,h:number } }) {
    if (processing) return;
    setProcessing(true);
    setMsg('Đang kiểm tra khuôn mặt...');
    try {
      const backend = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      if (!backend) throw new Error('Backend URL not configured');
      const body: any = { dataUrl: d.dataUrl };
      if (sendCustomId && customId && customId.trim()) body.id = customId.trim();
      const res = await fetch(`${backend}/api/scan-and-mark`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (res.status === 409) {
        setMsg('Lỗi: id đã tồn tại (duplicate)');
        return;
      }
      if (j && j.success) {
        const att = j.attendance || j.data || j.result || null;
        if (att && att.workerId) {
          // avoid marking same person repeatedly in short time (30s)
          const now = Date.now();
          if (lastMarked && lastMarked.workerId === att.workerId && (now - lastMarked.ts) < 30000) {
            setMsg(`Đã điểm danh gần đây: ${att.workerId}`);
          } else {
            setMsg(`Đã điểm danh: ${att.workerId}`);
            setLastMarked({ workerId: att.workerId, ts: now });
            try { window.dispatchEvent(new CustomEvent('attendance:updated', { detail: { source: 'camera', attendance: att } })); } catch(e) {}
          }
        } else {
          setMsg('Không tìm thấy nhân viên phù hợp');
        }
      } else {
        setMsg('Lỗi khi quét trên server: ' + (j && j.error ? j.error : JSON.stringify(j)));
      }
    } catch (e:any) {
      console.error(e);
      setMsg('Lỗi khi quét: ' + (e.message || e));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Diem danh - Camera</h2>
      <div style={{ marginBottom: 8 }}>
        <label style={{ marginRight: 8 }}>
          <input type="checkbox" checked={useOnChain} onChange={(e) => setUseOnChain(e.target.checked)} />{' '}
          Ghi nhận on-chain (MetaMask)
        </label>
        <span style={{ color: '#666' }}> (bỏ chọn để chỉ lưu lên server, không cần MetaMask)</span>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ marginRight: 8 }}>
          <input type="checkbox" checked={sendCustomId} onChange={(e) => setSendCustomId(e.target.checked)} />{' '}
          Gửi `id` tùy chỉnh khi điểm danh
        </label>
        {sendCustomId ? (
          <input style={{ marginLeft: 8 }} placeholder="Custom attendance id" value={customId} onChange={(e) => setCustomId(e.target.value)} />
        ) : null}
      </div>
      <FaceScanner onDetected={handleDetected} />
      <div className="mt-3 text-gray-700">{msg}</div>
    </div>
  );
}

function euclideanDistance(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

async function sendTxViaMetaMask(workerId: string, date: string, time: string, status: string, cid: string) {
  // Require MetaMask
  if (!(window as any).ethereum) throw new Error('MetaMask (window.ethereum) not found');

  // load ethers from CDN if not present
  if (!(window as any).ethers) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Cannot load ethers.js'));
      document.head.appendChild(s);
    });
  }
  const ethers = (window as any).ethers;

  // ask user to connect accounts
  await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
  const provider = new ethers.providers.Web3Provider((window as any).ethereum);
  const signer = provider.getSigner();

  // get contract address from env or prompt
  let contractAddress = (process.env as any).NEXT_PUBLIC_CONTRACT_ADDRESS || '';
  if (!contractAddress) {
    contractAddress = window.prompt('Nhập contract address (ví dụ: 0x...)') || '';
  }
  if (!contractAddress) throw new Error('Contract address not provided');

  const ABI = [
    'function markAttendance(string workerId, string date, string time, string status, string cid) returns (uint256)'
  ];

  const contract = new ethers.Contract(contractAddress, ABI, signer);

  const tx = await contract.markAttendance(workerId, date, time, status, cid);
  const receipt = await tx.wait();
  return { txHash: receipt.transactionHash, receipt };
}
