// src/app/login/page.tsx

import LoginForm from '@/components/loginfrom/login';


export default function LoginPage() {

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <LoginForm />
    </div>
  );
}