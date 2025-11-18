"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Trang attendance nay da duoc ghep vao Home. Chuyen huong ve trang chu de tranh trung lap.
export default function AttendancePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
