"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '../../i18n/i18n';
import AttendanceWidget from '@/components/home/AttendanceWidget';
import ManagementWidget from '@/components/home/ManagementWidget';
import UsersManagement from '@/components/home/UsersManagement';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<'diemdanh' | 'quanly' | 'camera'>('diemdanh');
  const [activeSubTab, setActiveSubTab] = useState<'nguoidung' | 'lichsudiemdanh'>('nguoidung');
  const [isQuanLyExpanded, setIsQuanLyExpanded] = useState(true); // mặc định mở
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!loggedIn) {
      router.push('/login');
    } else {
      setIsLoggedIn(true);
    }
    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Đang kiểm tra đăng nhập...
      </div>
    );
  }

  if (!isLoggedIn) return null;

  // Xác định nội dung chính dựa trên main tab và sub tab
  const renderContent = () => {
    if (activeMainTab === 'diemdanh') {
      // Hiển thị danh sách điểm danh (management) khi vào mục điểm danh
      return <ManagementWidget />;
    }

    if (activeMainTab === 'camera') {
      // Cho tab Camera: hiển thị widget diem danh bang camera
      return <AttendanceWidget />;
    }

    // activeMainTab === 'quanly'
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          {activeSubTab === 'nguoidung' ? 'Quản lý người dùng' : 'Quản lý thiết bị'}
        </h2>
        {activeSubTab === 'nguoidung' ? (
          <UsersManagement />
        ) : (
          <p className="text-gray-600">Danh sách ESP-CAM, máy tính, thiết bị IoT, v.v.</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - 1/6 */}
      <aside className="w-1/6 bg-gray-800 text-white flex flex-col">
        <nav className="flex-1 p-4 space-y-2">
          {/* Điểm danh */}
          <button
            onClick={() => setActiveMainTab('diemdanh')}
            className={`block w-full text-left px-4 py-2 rounded transition ${
              activeMainTab === 'diemdanh'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-700'
            }`}
          >
            {t('attendance')}
          </button>

          {/* Quản lý - có mục con */}
          <div>
            <button
              onClick={() => setIsQuanLyExpanded(!isQuanLyExpanded)}
              className={`flex w-full justify-between items-center px-4 py-2 rounded transition ${
                activeMainTab === 'quanly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-200 hover:bg-gray-700'
              }`}
            >
              <span>{t('management')}</span>
              <span>{isQuanLyExpanded ? '▲' : '▼'}</span>
            </button>

            {isQuanLyExpanded && (
              <div className="ml-4 mt-1 space-y-1">
                <button
                  onClick={() => {
                    setActiveMainTab('quanly');
                    setActiveSubTab('nguoidung');
                  }}
                  className={`block w-full text-left px-3 py-1.5 rounded text-sm transition ${
                    activeMainTab === 'quanly' && activeSubTab === 'nguoidung'
                      ? 'text-blue-300 font-medium'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {t('user')}
                </button>
                <button
                  onClick={() => {
                    setActiveMainTab('quanly');
                    setActiveSubTab('lichsudiemdanh');
                  }}
                  className={`block w-full text-left px-3 py-1.5 rounded text-sm transition ${
                    activeMainTab === 'quanly' && activeSubTab === 'lichsudiemdanh'
                      ? 'text-blue-300 font-medium'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {t('device')}
                </button>
              </div>
            )}
          </div>

          {/* Camera */}
          <button
            onClick={() => setActiveMainTab('camera')}
            className={`block w-full text-left px-4 py-2 rounded transition ${
              activeMainTab === 'camera'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-700'
            }`}
          >
            {t('camera')}
          </button>
        </nav>

          {/* Language Switcher */}
          <div className="p-4 border-t border-gray-700">
            <p className="text-gray-400 mb-2">{t('language')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => i18n.changeLanguage('vi')}
                className={`px-3 py-1 rounded ${
                  i18n.language === 'vi'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                VI
              </button>
              <button
                onClick={() => i18n.changeLanguage('en')}
                className={`px-3 py-1 rounded ${
                  i18n.language === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                EN
              </button>
            </div>
          </div>

        {/* Thoát */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-red-300 hover:bg-red-900/30 rounded transition"
          >
            Thoát
          </button>
        </div>
      </aside>

      {/* Nội dung chính - 5/6 */}
      <main className="w-5/6">{renderContent()}</main>
    </div>
  );
}