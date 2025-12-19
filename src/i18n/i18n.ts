'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// File dịch
import en from '../components/messages/en.json';
import vi from '../components/messages/vi.json';

// Danh sách ngôn ngữ có sẵn trong project
const AVAILABLE_LOCALES = ['en', 'vi'];

function detectBrowserLocale(): string {
  if (typeof navigator === 'undefined') return 'vi';
  const nav = (navigator.languages && navigator.languages.length && navigator.languages[0]) || navigator.language || 'vi';
  const base = String(nav).split('-')[0].toLowerCase();
  if (AVAILABLE_LOCALES.includes(base)) return base;
  // Nếu không có bản dịch cho ngôn ngữ này, giữ mặc định là 'vi'
  return 'vi';
}

const detectedLang = detectBrowserLocale();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
  lng: detectedLang, // tự động lấy ngôn ngữ từ trình duyệt
  fallbackLng: 'vi',
  interpolation: {
    escapeValue: false, // React sẽ xử lý escape
  },
});

export default i18n;
