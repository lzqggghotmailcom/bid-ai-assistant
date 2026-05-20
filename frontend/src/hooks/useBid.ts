'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ScoreItem {
  id: string;
  category: string;
  item: string;
  score: number;
  required: boolean;
}

export interface RejectClause {
  id: string;
  clause: string;
  severity: 'high' | 'medium' | 'low';
}

export interface TechRequirement {
  id: string;
  requirement: string;
  category: string;
}

export interface QualificationRequirement {
  id: string;
  requirement: string;
  type: string;
}

export interface OutlineSection {
  section_id: string;
  title: string;
  score_point_ref: string;
  weight: 'high' | 'medium' | 'low';
  required_attachments: string[];
  content?: string;
  status?: 'pending' | 'generating' | 'done' | 'error';
}

export interface GenerationStatus {
  task_id: string;
  status: 'generating' | 'done' | 'error';
  sections_done: number;
  sections_total: number;
}

export interface BidDetail {
  id: string;
  filename: string;
  status: 'uploaded' | 'parsing' | 'parsed' | 'generating' | 'done' | 'error';
  page_count: number;
  industry?: string | null;
  created_at: string;
  parsed: {
    score_items: ScoreItem[];
    reject_clauses: RejectClause[];
    tech_requirements: TechRequirement[];
    qualification_requirements: QualificationRequirement[];
  } | null;
  outline: OutlineSection[] | null;
  generation_status: GenerationStatus | null;
}

export function useBid(bidId: string | null) {
  return useQuery<BidDetail>({
    queryKey: ['bid', bidId],
    queryFn: async () => {
      const { data } = await api.get(`/bids/${bidId}`);
      return {
        ...data,
        parsed: data.parsed_data || null,
      };
    },
    enabled: !!bidId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      if (['done', 'error'].includes(data.status)) return false;
      return 3000;
    },
  });
}
