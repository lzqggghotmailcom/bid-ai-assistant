'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ComplianceResult } from '@/hooks/useComplianceCheck';
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon } from 'lucide-react';

interface ComplianceReportProps {
  data: ComplianceResult | null;
  loading?: boolean;
}

function PieChart({ covered, total }: { covered: number; total: number }) {
  const percentage = total > 0 ? (covered / total) * 100 : 0;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={percentage >= 80 ? '#22c55e' : percentage >= 60 ? '#eab308' : '#ef4444'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 80 80)"
          className="transition-all duration-1000"
        />
        <text
          x="80"
          y="75"
          textAnchor="middle"
          className="text-2xl font-bold"
          fill="currentColor"
        >
          {Math.round(percentage)}%
        </text>
        <text x="80" y="95" textAnchor="middle" className="text-xs" fill="#9ca3af">
          {covered}/{total}
        </text>
      </svg>
    </div>
  );
}

export default function ComplianceReport({ data, loading }: ComplianceReportProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
              <span className="ml-3 text-sm text-gray-600">正在进行合规检查...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-sm text-gray-400">
          尚未进行合规检查，请先生成标书内容
        </CardContent>
      </Card>
    );
  }

  const { score_coverage, reject_check, sensitive_check } = data;
  const coveragePassed = score_coverage.covered === score_coverage.total;

  return (
    <div className="space-y-4">
      {/* Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">评分点覆盖率</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <PieChart covered={score_coverage.covered} total={score_coverage.total} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                {coveragePassed ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangleIcon className="h-5 w-5 text-yellow-500" />
                )}
                <span className="text-sm font-medium">
                  {coveragePassed ? '所有评分点已覆盖' : '存在未覆盖的评分点'}
                </span>
              </div>
              {score_coverage.missed.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-red-600">未覆盖评分点:</p>
                  {score_coverage.missed.map((item) => (
                    <div key={item.id} className="text-xs text-gray-600 pl-2 border-l-2 border-red-300">
                      <span className="font-medium">{item.category}</span>: {item.item} ({item.score}分)
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reject Check */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">废标条款检查</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              {reject_check.passed ? (
                <>
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-700">全部通过</span>
                </>
              ) : (
                <>
                  <XCircleIcon className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium text-red-700">存在风险</span>
                </>
              )}
            </div>
            {reject_check.warnings.length > 0 ? (
              <div className="space-y-2">
                {reject_check.warnings.map((warning) => (
                  <div
                    key={warning.id}
                    className="flex items-start gap-2 p-2 rounded bg-red-50 border border-red-100"
                  >
                    <AlertTriangleIcon className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-red-700">{warning.clause}</p>
                      <Badge
                        variant={warning.severity === 'high' ? 'destructive' : 'secondary'}
                        className="mt-1 text-xs"
                      >
                        {warning.severity === 'high' ? '高风险' : warning.severity === 'medium' ? '中风险' : '低风险'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">未检测到废标风险</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sensitive Check */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">敏感词检查</CardTitle>
        </CardHeader>
        <CardContent>
          {sensitive_check.issues.length > 0 ? (
            <div className="space-y-2">
              {sensitive_check.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded bg-yellow-50 border border-yellow-100"
                >
                  <AlertTriangleIcon className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-yellow-700">
                      <span className="font-medium">敏感词: </span>
                      {issue.term}
                    </p>
                    {issue.location && (
                      <p className="text-xs text-yellow-600 mt-0.5">位置: {issue.location}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span className="text-xs text-gray-400">未检测到敏感词</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
