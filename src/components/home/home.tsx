"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '../../i18n/i18n';
import AttendanceWidget from '@/components/home/AttendanceWidget';
import ManagementWidget from '@/components/home/ManagementWidget';
import UsersManagement from '@/components/home/UsersManagement';
import AttendanceHistory from '@/components/home/AttendanceHistory';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // State quản lý tabs
  const [activeMainTab, setActiveMainTab] = useState<'diemdanh' | 'quanly' | 'camera'>('diemdanh');
  const [activeSubTab, setActiveSubTab] = useState<'nguoidung' | 'lichsudiemdanh'>('nguoidung');
  const [isQuanLyExpanded, setIsQuanLyExpanded] = useState(true);
  
  // State cho mobile menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // --- RENDER NỘI DUNG CHÍNH ---
  const renderContent = () => {
    if (activeMainTab === 'diemdanh') {
      return <ManagementWidget />;
    }

    if (activeMainTab === 'camera') {
      return (
        <div className="flex flex-col h-full">
          {/* Chỉ hiển thị dòng này trên Mobile (md:hidden) */}
          <div className="md:hidden p-4 text-center bg-blue-50 border-b border-blue-100 mb-2 rounded-lg mx-4 mt-4">
            <p className="font-semibold text-blue-800">Camera sẵn sàng.</p>
            <p className="text-sm text-blue-600">Nhấn "Bắt đầu quét" để bắt đầu</p>
          </div>
          
          {/* Widget Camera */}
          <div className="flex-1">
             <AttendanceWidget />
          </div>
        </div>
      );
    }

    // activeMainTab === 'quanly'
    return (
      <div className="p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-4">
          {activeSubTab === 'nguoidung' ? 'Quản lý người dùng' : t('attendance_history')}
        </h2>
        {activeSubTab === 'nguoidung' ? (
          <UsersManagement />
        ) : (
          <AttendanceHistory />
        )}
      </div>
    );
  };

  return (
    // Thay đổi flex-row thành flex-col trên mobile để xếp chồng lên nhau
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      
      {/* --- MOBILE HEADER & TOGGLE BUTTON --- */}
      <div className="md:hidden bg-gray-800 text-white p-4 flex justify-between items-center">
        <span className="font-bold text-lg">My App</span>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 border border-gray-600 rounded hover:bg-gray-700 focus:outline-none"
        >
          {/* Icon Hamburger / Close */}
          {isMobileMenuOpen ? (
            <span>✕ Đóng Menu</span>
          ) : (
            <span>☰ Menu</span>
          )}
        </button>
      </div>

      {/* --- SIDEBAR --- */}
      {/* Logic hiển thị Sidebar:
         1. Trên Desktop (md:flex): Luôn hiện (w-1/6)
         2. Trên Mobile: 
            - Mặc định ẩn (hidden)
            - Nếu bấm mở menu -> hiện (block w-full)
      */}
      <aside className={`
        bg-gray-800 text-white flex-col transition-all duration-300
        md:w-1/6 md:flex md:min-h-screen
        ${isMobileMenuOpen ? 'flex w-full' : 'hidden'}
      `}>
        <nav className="flex-1 p-4 space-y-2">
          {/* Điểm danh */}
          <button
            onClick={() => { setActiveMainTab('diemdanh'); setIsMobileMenuOpen(false); }}
            className={`block w-full text-left px-4 py-2 rounded transition ${
              activeMainTab === 'diemdanh' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
            }`}
          >
            {t('attendance')}
          </button>

          {/* Quản lý */}
          <div>
            <button
              onClick={() => setIsQuanLyExpanded(!isQuanLyExpanded)}
              className={`flex w-full justify-between items-center px-4 py-2 rounded transition ${
                activeMainTab === 'quanly' ? 'bg-blue-600 text-white' : 'text-gray-200 hover:bg-gray-700'
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
                    setIsMobileMenuOpen(false); // Đóng menu mobile sau khi chọn
                  }}
                  className={`block w-full text-left px-3 py-1.5 rounded text-sm transition ${
                    activeMainTab === 'quanly' && activeSubTab === 'nguoidung'
                      ? 'text-blue-300 font-medium' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {t('user')}
                </button>
                <button
                  onClick={() => {
                    setActiveMainTab('quanly');
                    setActiveSubTab('lichsudiemdanh');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-1.5 rounded text-sm transition ${
                    activeMainTab === 'quanly' && activeSubTab === 'lichsudiemdanh'
                      ? 'text-blue-300 font-medium' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {t('attendance_history')}
                </button>
              </div>
            )}
          </div>

          {/* Camera */}
          <button
            onClick={() => { setActiveMainTab('camera'); setIsMobileMenuOpen(false); }}
            className={`block w-full text-left px-4 py-2 rounded transition ${
              activeMainTab === 'camera' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
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
                i18n.language === 'vi' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              VI
            </button>
            <button
              onClick={() => i18n.changeLanguage('en')}
              className={`px-3 py-1 rounded ${
                i18n.language === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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

      {/* --- NỘI DUNG CHÍNH --- */}
      {/* Trên mobile chiếm 100% width (w-full), trên desktop chiếm 5/6 (md:w-5/6) */}
      <main className="w-full md:w-5/6 bg-gray-50">
        {renderContent()}
      </main>
    </div>
  );
}