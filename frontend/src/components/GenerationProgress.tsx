'use client';

import { Progress, ProgressIndicator, ProgressTrack, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from './StatusBadge';

interface SectionProgress {
  section_id: string;
  title: string;
  status: 'pending' | 'generating' | 'done' | 'error';
}

interface GenerationProgressProps {
  sectionsTotal: number;
  sectionsDone: number;
  sections: SectionProgress[];
  status: string;
}

export default function GenerationProgress({
  sectionsTotal,
  sectionsDone,
  sections,
  status,
}: GenerationProgressProps) {
  const percentage = sectionsTotal > 0 ? Math.round((sectionsDone / sectionsTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">生成进度</span>
              <StatusBadge status={status} />
            </div>
            <Progress value={percentage}>
              <ProgressLabel>
                {status === 'generating' ? '正在生成...' : status === 'done' ? '生成完成' : '准备中'}
              </ProgressLabel>
              <ProgressValue>
                {() => (
                  <span className="text-sm">
                    {sectionsDone} / {sectionsTotal}
                  </span>
                )}
              </ProgressValue>
              <ProgressTrack>
                <ProgressIndicator
                  className={`transition-all duration-1000 ${
                    status === 'done' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                />
              </ProgressTrack>
            </Progress>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        {sections.map((section) => (
          <div
            key={section.section_id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-2 w-2 rounded-full ${
                  section.status === 'done'
                    ? 'bg-green-500'
                    : section.status === 'generating'
                    ? 'bg-blue-500 animate-pulse'
                    : section.status === 'error'
                    ? 'bg-red-500'
                    : 'bg-gray-300'
                }`}
              />
              <span className="text-sm text-gray-700">{section.title}</span>
            </div>
            <StatusBadge status={section.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
