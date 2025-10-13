'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// File dịch
import en from '../components/messages/en.json';
import vi from '../components/messages/vi.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    lng: 'vi', // Ngôn ngữ mặc định
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false, // React tự xử lý rồi
    },
  });

export default i18n;
