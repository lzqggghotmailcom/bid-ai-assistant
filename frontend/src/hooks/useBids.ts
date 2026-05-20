'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Bid {
  id: string;
  filename: string;
  status: 'uploaded' | 'parsing' | 'parsed' | 'generating' | 'done' | 'error';
  page_count: number;
  industry?: string | null;
  created_at: string;
}

interface PaginatedBids {
  items: Bid[];
  total: number;
  page: number;
  page_size: number;
}

export function useBids(page: number = 1, pageSize: number = 20) {
  return useQuery<PaginatedBids>({
    queryKey: ['bids', page, pageSize],
    queryFn: async () => {
      const { data } = await api.get('/bids', {
        params: { page, page_size: pageSize },
      });
      return data;
    },
    refetchInterval: 10000,
  });
}
