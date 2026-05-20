'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface PlanInfo {
  plan: string;
  projects_remaining: number;
  free_trial_used: boolean;
}

export function usePlan() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['plan'],
    queryFn: async () => {
      const { data } = await api.get('/user/plan');
      return data as PlanInfo;
    },
    staleTime: 30_000,
  });

  return {
    plan: data?.plan ?? 'free',
    projectsRemaining: data?.projects_remaining ?? 0,
    freeTrialUsed: data?.free_trial_used ?? false,
    isLoading,
    refetch,
  };
}
