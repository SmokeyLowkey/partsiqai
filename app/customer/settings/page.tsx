'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { RefreshCw } from 'lucide-react';

export default function CustomerSettingsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'MASTER_ADMIN';
      if (isAdmin) {
        // Redirect admins to the admin settings page
        router.replace('/admin/settings');
      } else {
        // Redirect non-admins to dashboard
        router.replace('/customer/dashboard');
      }
    }
  }, [status, session, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Redirecting to settings...</p>
      </div>
    </div>
  );
}
