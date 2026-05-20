'use client';

import { Badge } from '@/components/ui/badge';

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  uploaded: { label: '已上传', variant: 'secondary', className: 'bg-gray-200 text-gray-700 hover:bg-gray-200' },
  parsing: { label: '解析中', variant: 'secondary', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  parsed: { label: '已解析', variant: 'secondary', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  generating: { label: '生成中', variant: 'secondary', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  done: { label: '已完成', variant: 'secondary', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  error: { label: '失败', variant: 'destructive' },
  pending: { label: '待生成', variant: 'secondary', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
  indexed: { label: '已索引', variant: 'secondary', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  processing: { label: '处理中', variant: 'secondary', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
