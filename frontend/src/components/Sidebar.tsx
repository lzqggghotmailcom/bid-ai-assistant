'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { cn } from '@/lib/utils';
import {
  FileTextIcon,
  DatabaseIcon,
  LogOutIcon,
  UserIcon,
  HelpCircleIcon,
  CoinsIcon,
} from 'lucide-react';
import CreditBadge from '@/components/CreditBadge';
import PurchaseDialog from '@/components/PurchaseDialog';

const navItems = [
  {
    href: '/',
    label: '投标管理',
    icon: FileTextIcon,
  },
  {
    href: '/knowledge',
    label: '知识库',
    icon: DatabaseIcon,
  },
  {
    href: '/pricing',
    label: '套餐定价',
    icon: CoinsIcon,
  },
  {
    href: '/help',
    label: '帮助中心',
    icon: HelpCircleIcon,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  return (
    <aside className="fixed left-0 top-0 z-30 h-screen w-60 border-r bg-white flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b shrink-0">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <FileTextIcon className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900">AI投标助手</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="border-t p-3 shrink-0 space-y-2">
        <CreditBadge onClick={() => setPurchaseOpen(true)} />
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            <UserIcon className="h-4 w-4 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">
              {user?.company_name || '用户'}
            </p>
            <p className="text-xs text-gray-400 truncate">{user?.email || ''}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="退出登录"
          >
            <LogOutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <PurchaseDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} />
    </aside>
  );
}
