'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Khi component mount, tự động chuyển hướng sang /login
    router.replace('./login'); // replace thay vì push để không lưu lại lịch sử
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p>Đang chuyển hướng sang trang đăng nhập...</p>
    </div>
  );
}
