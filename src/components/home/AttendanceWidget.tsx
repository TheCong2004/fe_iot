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
  const [txLoading, setTxLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

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
            // nếu cấu hình ghi on-chain thì gọi MetaMask
            if (useOnChain) {
              setMsg('Ghi giao dịch lên blockchain...');
              setTxLoading(true);
              setTxHash(null);
              setTxError(null);
              try {
                const nowDate = new Date();
                const date = nowDate.toISOString().split('T')[0];
                const time = nowDate.toTimeString().split(' ')[0];
                const status = 'present';
                const cid = att.cid || '';
                const txRes = await sendTxViaMetaMask(att.workerId, date, time, status, cid);
                setMsg(`Đã điểm danh (on-chain)`);
                setTxHash(txRes.txHash || null);
                try { att.txHash = txRes.txHash; } catch(e) {}
              } catch (e:any) {
                console.error('On-chain error', e);
                setMsg('Lỗi khi ghi on-chain: ' + (e.message || e));
                setTxError(e.message || String(e));
              } finally {
                setTxLoading(false);
              }
            } else {
              setMsg(`Đã điểm danh: ${att.workerId}`);
            }
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
        <label style={{ marginRight: 12 }}>
          <input type="checkbox" checked={useOnChain} onChange={(e) => setUseOnChain(e.target.checked)} />{' '}
          Ghi lên blockchain (MetaMask)
        </label>
        {sendCustomId ? (
          <input style={{ marginLeft: 8 }} placeholder="Custom attendance id" value={customId} onChange={(e) => setCustomId(e.target.value)} />
        ) : null}
      </div>
      <FaceScanner onDetected={handleDetected} />
      <div className="mt-3 text-gray-700">{msg}</div>
      <div className="mt-2">
        {txLoading ? (
          <div className="text-sm text-blue-600">Đang gửi giao dịch... (hãy kiểm tra MetaMask)</div>
        ) : txHash ? (
          <div className="text-sm text-green-700">Giao dịch thành công: {txHash}</div>
        ) : txError ? (
          <div className="text-sm text-red-600">Lỗi giao dịch: {txError}</div>
        ) : null}
      </div>
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

  // ensure user is on Sepolia testnet
  async function ensureSepolia() {
    const SEPOLIA_CHAIN_ID = '0xAA36A7'; // 11155111
    try {
      const current = (window as any).ethereum.chainId;
      if (current === SEPOLIA_CHAIN_ID) return;
      await (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID }] });
      return;
    } catch (err: any) {
      // 4902 = chain not added in MetaMask
      if (err && (err.code === 4902 || (err.message && err.message.includes('Unrecognized chain ID')))) {
        // try to add Sepolia
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xAA36A7',
              chainName: 'Sepolia Testnet',
              nativeCurrency: { name: 'SepoliaETH', symbol: 'SepoliaETH', decimals: 18 },
              rpcUrls: ['https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }]
          });
          // after adding, try switching again
          await (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xAA36A7' }] });
          return;
        } catch (addErr) {
          throw addErr;
        }
      }
      throw err;
    }
  }

  // dynamic import ethers from installed package (avoid SSR issues)
  const ethersPkg: any = await import('ethers');
  const { BrowserProvider, Contract } = ethersPkg;

  // ensure network then ask user to connect accounts
  await ensureSepolia();
  await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
  const provider = new BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();

  // get contract address from env or prompt
  let contractAddress = (process.env as any).NEXT_PUBLIC_CONTRACT_ADDRESS || '';
  if (!contractAddress) {
    contractAddress = window.prompt('Nhập contract address (ví dụ: 0x...)') || '';
  }
  if (!contractAddress) throw new Error('Contract address not provided');

  const ABI = [
    'function markAttendance(string workerId, string date, string time, string status, string cid) returns (uint256)'
  ];

  const contract = new Contract(contractAddress, ABI, signer);

  try {
    const tx = await contract.markAttendance(workerId, date, time, status, cid);
    const receipt = await tx.wait();
    return { txHash: receipt.transactionHash, receipt };
  } catch (e: any) {
    // user rejected signature / tx
    if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED' || (e.error && e.error.code === 4001))) {
      throw new Error('Người dùng đã từ chối giao dịch (MetaMask).');
    }
    throw e;
  }
}
