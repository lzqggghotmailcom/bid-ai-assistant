'use client';

import { useContext } from 'react';
import { ToastContext } from '@/providers/ToastProvider';

export function useToast() {
  return useContext(ToastContext);
}
