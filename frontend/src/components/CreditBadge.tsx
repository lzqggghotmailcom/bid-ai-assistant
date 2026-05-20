'use client';

import { CoinsIcon } from 'lucide-react';
import { usePlan } from '@/hooks/useCredits';

const PLAN_LABELS: Record<string, string> = {
  free: '免费试用',
  single: '单项目',
  quarterly: '季度版',
  annual: '年度版',
  enterprise: '企业版',
};

export default function CreditBadge({ onClick }: { onClick?: () => void }) {
  const { plan, projectsRemaining, freeTrialUsed, isLoading } = usePlan();

  const label = freeTrialUsed ? PLAN_LABELS[plan] || plan : '免费试用';

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 transition-colors"
    >
      <CoinsIcon className="h-3.5 w-3.5 text-amber-500" />
      <span className="text-xs font-medium text-amber-700">
        {isLoading ? '...' : `${label} · 剩余${projectsRemaining === -1 ? '无限' : projectsRemaining}次`}
      </span>
    </button>
  );
}
