'use client';

import { usePathname } from 'next/navigation';
import QueryProvider from '@/providers/QueryProvider';
import AuthProvider from '@/providers/AuthProvider';
import ToastContextProvider from '@/providers/ToastProvider';
import Sidebar from '@/components/Sidebar';

const PUBLIC_PATHS = ['/login', '/register'];

function InnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <ToastContextProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-60 p-6 bg-gray-50 min-h-screen">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </ToastContextProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <InnerLayout>{children}</InnerLayout>
      </AuthProvider>
    </QueryProvider>
  );
}
