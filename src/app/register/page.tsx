"use client";
import React, { useState, useCallback } from 'react';
import CameraCapture from '@/components/CameraCapture';
import FaceScanner from '@/components/FaceScanner';

// Trang dang ky nhan vien: chup anh va gui len backend (LBPH)
export default function RegisterPage() {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [createdEmployee, setCreatedEmployee] = useState<any | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
  const [samples, setSamples] = useState<string[]>([]); // multiple capture samples
  const [msg, setMsg] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanningForMark, setScanningForMark] = useState(false);
  const [matchedEmployee, setMatchedEmployee] = useState<any | null>(null);

  function removeSample(idx: number) {
    setSamples(s => s.filter((_, i) => i !== idx));
    if (samples.length === 1) setCapturedDataUrl(null);
  }

  const loadFaceApi = useCallback(async () => {
    if (!(window as any).faceapi) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Cannot load face-api.js'));
        document.head.appendChild(s);
      });
    }
    const faceapi = (window as any).faceapi;
    const LOCAL_MODELS = '/face-api-models';
    const CDN_MODELS = [
      'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',
      'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights',
      'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
    ];

    async function manifestExists(basePath: string, manifestName: string) {
      try {
        const url = `${basePath.replace(/\/$/, '')}/${manifestName}`;
        const res = await fetch(url, { method: 'GET' });
        return res.ok;
      } catch (e) {
        return false;
      }
    }

    async function tryLoad(net: any, pathLocal: string, pathCdnArray: string[] | string, manifestName: string) {
      try {
        const localHas = await manifestExists(pathLocal, manifestName);
        if (localHas) {
          await net.loadFromUri(pathLocal);
          return true;
        }
        const cdns = Array.isArray(pathCdnArray) ? pathCdnArray : [pathCdnArray];
        for (const cdnBase of cdns) {
          try { await net.loadFromUri(cdnBase); return true; } catch (e) { /* ignore */ }
        }
        throw new Error('All CDN bases failed for ' + manifestName);
      } catch (e) { throw e; }
    }

    await tryLoad(faceapi.nets.ssdMobilenetv1, LOCAL_MODELS, CDN_MODELS, 'ssd_mobilenetv1_model-weights_manifest.json');
    await tryLoad(faceapi.nets.faceLandmark68Net, LOCAL_MODELS, CDN_MODELS, 'face_landmark_68_model-weights_manifest.json');
    await tryLoad(faceapi.nets.faceRecognitionNet, LOCAL_MODELS, CDN_MODELS, 'face_recognition_model-weights_manifest.json');
    return faceapi;
  }, []);

  async function handleCapture(dataUrl: string) {
    setCapturedDataUrl(dataUrl);
    setSamples((s) => [...s, dataUrl]);
    setMsg(`Đã thêm sample (${samples.length + 1}). Bạn có thể chụp thêm hoặc bấm Lưu.`);
  }

  function handleAutoDetected(d:{dataUrl:string}){
    setCapturedDataUrl(d.dataUrl);
    setSamples((s) => [...s, d.dataUrl]);
    setScanning(false);
    setMsg('Đã quét khuôn mặt và thêm vào samples. Bạn có thể chụp thêm hoặc bấm Lưu.');
  }

  async function handleAutoMarkDetected(d:{dataUrl:string}){
    setScanningForMark(false);
    setMsg('Đã quét, đang so khớp...');
    try {
      const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      setMsg('Gửi ảnh tới server để quét và lưu điểm danh...');
      try {
        const body: any = { dataUrl: d.dataUrl };
        if (createdEmployee && createdEmployee.workerId) body.id = createdEmployee.workerId;
        const markRes = await fetch(`${backend}/api/scan-and-mark`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
        const mj = await markRes.json();
        if (mj && mj.success) {
          const att = mj.attendance || mj.data || mj.result || null;
          if (att && att.workerId) {
            setMsg(`Đã điểm danh: ${att.workerId}` + (att.txHash ? ` (tx: ${att.txHash})` : ' (local)'));
            setMatchedEmployee(mj.employee || null);
          } else {
            setMsg('Không tìm thấy nhân viên phù hợp (server)');
            setMatchedEmployee(null);
          }
        } else {
          setMsg('Lỗi khi quét trên server: ' + (mj && mj.error ? mj.error : JSON.stringify(mj)));
        }
      } catch (e:any) {
        console.error(e);
        setMsg('Lỗi khi gọi /api/scan-and-mark: ' + (e.message || e));
      }
    } catch (e:any) {
      console.error(e);
      setMsg('Lỗi khi so khớp: ' + (e.message || e));
    }
  }

  function handleStartScan(){ setMsg('Bắt đầu quét tự động...'); setScanning(true); }
  function handleCancelScan(){ setScanning(false); setMsg('Quét đã bị huỷ'); }

  async function handleSave() {
    if (!samples || samples.length === 0) {
      setMsg('Chưa có sample nào để lưu. Vui lòng chụp ít nhất 1 ảnh.');
      return;
    }
    setMsg('Đang lưu đăng ký...');
    try {
      const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const payload: any = { name: name || undefined, department: department || undefined, dataUrls: samples };
      const res = await fetch(`${backend}/api/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const j = await res.json();
      if (j && j.success) {
        setMsg('Đăng ký thành công');
        setName(''); setDepartment(''); setCapturedDataUrl(null); setCapturedDescriptor(null); setSamples([]);
        if (j.employee) setCreatedEmployee(j.employee);
      } else {
        setMsg('Lỗi: ' + (j && j.error ? j.error : JSON.stringify(j)));
      }
    } catch (e: any) {
      console.error(e);
      setMsg('Lỗi khi lưu: ' + (e.message || e));
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Đăng ký nhân viên</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tên</label>
                <input className="mt-1 block w-full border border-gray-200 rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bộ phận (tuỳ chọn)</label>
                <input className="mt-1 block w-full border border-gray-200 rounded px-3 py-2" value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>

              <div className="p-4 border border-dashed rounded">
                {!scanning && !scanningForMark ? (
                  <>
                    <CameraCapture onCapture={handleCapture} />
                    <div className="mt-3 flex items-center gap-3">
                      <button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={handleStartScan}>Quét tự động</button>
                      <button className="px-4 py-2 border rounded" onClick={() => { setMsg('Bắt đầu quét để điểm danh...'); setScanningForMark(true); }}>Quét & Điểm danh</button>
                      <span className="text-sm text-gray-500">Hoặc nhấn chụp để lấy ảnh thủ công.</span>
                    </div>
                  </>
                ) : ((scanning || scanningForMark) ? (
                  <div>
                    <FaceScanner onDetected={(d)=> scanningForMark ? handleAutoMarkDetected(d) : handleAutoDetected(d)} onCancel={() => { if (scanningForMark) { setScanningForMark(false); setMsg('Quét điểm danh huỷ'); } else { handleCancelScan(); } }} onError={(e)=>setMsg('Lỗi quét: '+(e.message||e))} />
                  </div>
                ) : null)}
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={handleSave}>Lưu đăng ký</button>
                  <button className="px-3 py-2 border rounded" onClick={() => { setCapturedDataUrl(null); setCapturedDescriptor(null); setSamples([]); setMsg(''); }}>Reset</button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="border rounded p-4">
              <h3 className="font-medium mb-2">Ảnh preview</h3>
              {capturedDataUrl ? (
                <img src={capturedDataUrl} alt="preview" className="w-full rounded mb-3" />
              ) : (
                <div className="w-full h-40 bg-gray-50 flex items-center justify-center text-gray-400">Chưa có ảnh</div>
              )}

              <div className="mt-3">
                <h4 className="text-sm font-medium mb-2">Samples ({samples.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {samples.length === 0 && <div className="text-sm text-gray-500">Chưa có sample nào</div>}
                  {samples.map((s, i) => (
                    <div key={i} className="relative">
                      <img src={s} className="w-20 h-20 object-cover rounded border" />
                      <button className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs" onClick={() => removeSample(i)}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              {matchedEmployee && (
                <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded">
                  <div className="text-sm font-medium">Đã khớp: {matchedEmployee.name || matchedEmployee.workerId}</div>
                  <div className="text-xs text-gray-600">WorkerId: {matchedEmployee.workerId}</div>
                </div>
              )}

              {createdEmployee && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded">
                  <div className="text-sm font-medium">Employee đã tạo: {createdEmployee.name || createdEmployee.workerId}</div>
                  <div className="text-xs text-gray-600">WorkerId: {createdEmployee.workerId}</div>
                </div>
              )}
            </div>
            <div className="mt-4 text-sm text-red-600">{msg}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
