'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { OutlineSection } from './useBid';

export function useGenerateOutline(bidId: string) {
  const queryClient = useQueryClient();

  const generate = useMutation<{ outline: OutlineSection[] }, Error>({
    mutationFn: async () => {
      const { data } = await api.post(`/bids/${bidId}/outline`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', bidId] });
    },
  });

  const save = useMutation<void, Error, OutlineSection[]>({
    mutationFn: async (outline) => {
      await api.put(`/bids/${bidId}/outline`, { outline });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', bidId] });
    },
  });

  return { generate, save };
}
