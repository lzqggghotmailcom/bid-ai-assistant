'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface UploadResponse {
  bid_id: string;
  filename: string;
  status: string;
}

export function useUploadBid() {
  const queryClient = useQueryClient();

  return useMutation<UploadResponse, Error, { file: File; industry: string }>({
    mutationFn: async ({ file, industry }: { file: File; industry: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (industry) {
        formData.append('industry', industry);
      }
      const { data } = await api.post('/bids/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bids'] });
    },
  });
}
