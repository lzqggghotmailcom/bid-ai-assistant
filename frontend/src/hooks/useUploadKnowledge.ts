'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface UploadKnowledgeResponse {
  doc_id: string;
  chunks: number;
  status: string;
}

interface UploadKnowledgePayload {
  file: File;
  doc_type: 'bid' | 'cert' | 'case' | 'resume';
}

export function useUploadKnowledge() {
  const queryClient = useQueryClient();

  return useMutation<UploadKnowledgeResponse, Error, UploadKnowledgePayload>({
    mutationFn: async ({ file, doc_type }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', doc_type);
      const { data } = await api.post('/knowledge/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeDocs'] });
    },
  });
}
