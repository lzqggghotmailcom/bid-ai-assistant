'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { OutlineSection } from './useBid';

interface GenerateRequest {
  outline: OutlineSection[];
  settings: {
    company_name: string;
    bid_amount?: number;
  };
}

interface GenerateResponse {
  task_id: string;
  status: string;
}

export function useGenerateSections(bidId: string) {
  const queryClient = useQueryClient();

  const generate = useMutation<GenerateResponse, Error, GenerateRequest>({
    mutationFn: async (payload) => {
      const { data } = await api.post(`/bids/${bidId}/generate`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', bidId] });
    },
  });

  const regenerate = useMutation<void, Error, string>({
    mutationFn: async (sectionId: string) => {
      await api.post(`/bids/${bidId}/sections/${sectionId}/regenerate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', bidId] });
    },
  });

  return { generate, regenerate };
}
