"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Trang management nay da duoc ghep vao Home (muc Diem danh). Chuyen huong ve trang chu de tranh trung lap.
export default function ManagementPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
