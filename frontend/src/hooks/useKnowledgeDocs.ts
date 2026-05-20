'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface KnowledgeDoc {
  doc_id: string;
  title: string;
  doc_type: 'bid' | 'cert' | 'case' | 'resume';
  chunks: number;
  created_at: string;
  status: string;
}

interface PaginatedDocs {
  items: KnowledgeDoc[];
  total: number;
}

export function useKnowledgeDocs(
  docType: string = 'all',
  page: number = 1,
  pageSize: number = 20
) {
  return useQuery<PaginatedDocs>({
    queryKey: ['knowledgeDocs', docType, page, pageSize],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: pageSize };
      if (docType !== 'all') {
        params.doc_type = docType;
      }
      const { data } = await api.get('/knowledge/documents', { params });
      return data;
    },
  });
}
