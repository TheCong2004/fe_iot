"use client";
import React, { useState, useCallback, useEffect } from 'react';
import FaceScanner from '@/components/FaceScanner';

export default function AttendanceWidget() {
  const [msg, setMsg] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    fetch(`${backend}/api/employees`).then((r) => r.json()).then((j) => {
      if (j.success) setEmployees(j.data || []);
    }).catch((e) => console.warn(e));
  }, []);

  const [processing, setProcessing] = useState(false);
  const [lastMarked, setLastMarked] = useState<{ workerId?: string; ts: number } | null>(null);
  const [customId, setCustomId] = useState('');
  const [sendCustomId, setSendCustomId] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
          const now = Date.now();
          if (lastMarked && lastMarked.workerId === att.workerId && (now - lastMarked.ts) < 30000) {
            setMsg(`Đã điểm danh gần đây: ${att.workerId}`);
          } else {
            // Tự động kết nối blockchain nếu không phải mobile
            if (!isMobile) {
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Điểm danh - Camera</h2>
                <p className="text-sm text-gray-500">Quét khuôn mặt để điểm danh tự động</p>
              </div>
            </div>
            
          </div>
        </div>

        {/* Camera Section */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="p-6">
            <FaceScanner onDetected={handleDetected} />
          </div>
          
          {/* Status Messages */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-200">
            {msg && (
              <div className={`flex items-center space-x-3 p-4 rounded-xl ${
                msg.includes('Lỗi') || msg.includes('Không tìm thấy') 
                  ? 'bg-red-50 border border-red-200' 
                  : msg.includes('Đã điểm danh')
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}>
                {msg.includes('Lỗi') || msg.includes('Không tìm thấy') ? (
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : msg.includes('Đã điểm danh') ? (
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span className={`font-medium ${
                  msg.includes('Lỗi') || msg.includes('Không tìm thấy')
                    ? 'text-red-700'
                    : msg.includes('Đã điểm danh')
                    ? 'text-green-700'
                    : 'text-blue-700'
                }`}>
                  {msg}
                </span>
              </div>
            )}

            {/* Transaction Status */}
            {txLoading && (
              <div className="mt-3 flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-medium text-blue-700">
                  Đang gửi giao dịch... (hãy kiểm tra MetaMask)
                </span>
              </div>
            )}

            {txHash && (
              <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-700 mb-1">Giao dịch thành công!</p>
                    <p className="text-xs text-green-600 font-mono break-all">{txHash}</p>
                  </div>
                </div>
              </div>
            )}

            {txError && (
              <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700 mb-1">Lỗi giao dịch</p>
                    <p className="text-xs text-red-600">{txError}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Optional: Custom ID Input */}
        {sendCustomId && (
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Attendance ID
            </label>
            <input 
              type="text"
              placeholder="Nhập ID tùy chỉnh" 
              value={customId} 
              onChange={(e) => setCustomId(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all"
            />
          </div>
        )}
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
  if (!(window as any).ethereum) throw new Error('MetaMask (window.ethereum) not found');

  async function ensureSepolia() {
    const SEPOLIA_CHAIN_ID = '0xAA36A7';
    try {
      const current = (window as any).ethereum.chainId;
      if (current === SEPOLIA_CHAIN_ID) return;
      await (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID }] });
      return;
    } catch (err: any) {
      if (err && (err.code === 4902 || (err.message && err.message.includes('Unrecognized chain ID')))) {
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
          await (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xAA36A7' }] });
          return;
        } catch (addErr) {
          throw addErr;
        }
      }
      throw err;
    }
  }

  const ethersPkg: any = await import('ethers');
  const { BrowserProvider, Contract } = ethersPkg;

  await ensureSepolia();
  await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
  const provider = new BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();

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
    if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED' || (e.error && e.error.code === 4001))) {
      throw new Error('Người dùng đã từ chối giao dịch (MetaMask).');
    }
    throw e;
  }
}