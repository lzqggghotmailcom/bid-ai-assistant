'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface SearchResult {
  doc_id: string;
  content: string;
  score: number;
}

interface SearchResponse {
  results: SearchResult[];
}

export function useSearchKnowledge(query: string, topK: number = 5) {
  return useQuery<SearchResponse>({
    queryKey: ['knowledgeSearch', query, topK],
    queryFn: async () => {
      const { data } = await api.post('/knowledge/search', {
        query,
        top_k: topK,
      });
      return data;
    },
    enabled: query.length > 0,
  });
}
