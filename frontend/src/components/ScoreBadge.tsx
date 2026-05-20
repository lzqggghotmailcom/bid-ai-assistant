'use client';

import { Badge } from '@/components/ui/badge';

const weightConfig: Record<string, { label: string; className: string }> = {
  high: { label: '高', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  medium: { label: '中', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  low: { label: '低', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
};

interface ScoreBadgeProps {
  weight: 'high' | 'medium' | 'low';
  score?: number;
}

export default function ScoreBadge({ weight, score }: ScoreBadgeProps) {
  const config = weightConfig[weight] || { label: weight, className: '' };

  return (
    <Badge variant="secondary" className={config.className}>
      {score !== undefined ? `${config.label} (${score}分)` : config.label}
    </Badge>
  );
}
