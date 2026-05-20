'use client';

import Link from 'next/link';
import { ChevronRightIcon, HomeIcon } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
      <Link href="/" className="flex items-center gap-1 hover:text-gray-700 transition-colors">
        <HomeIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">首页</span>
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          <ChevronRightIcon className="h-3.5 w-3.5 text-gray-300" />
          {item.href ? (
            <Link href={item.href} className="hover:text-gray-700 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
