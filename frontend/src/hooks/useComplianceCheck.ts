'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ScoreItem, RejectClause } from './useBid';

export interface ComplianceResult {
  score_coverage: {
    covered: number;
    total: number;
    missed: ScoreItem[];
  };
  reject_check: {
    passed: boolean;
    warnings: RejectClause[];
  };
  sensitive_check: {
    issues: { term: string; location: string }[];
  };
}

export function useComplianceCheck(bidId: string) {
  const queryClient = useQueryClient();

  return useMutation<ComplianceResult, Error>({
    mutationFn: async () => {
      const { data } = await api.post(`/bids/${bidId}/compliance-check`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', bidId] });
    },
  });
}
