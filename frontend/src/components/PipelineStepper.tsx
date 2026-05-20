'use client';

import { CheckIcon, FileTextIcon, SearchIcon, FileUpIcon, SparklesIcon } from 'lucide-react';

interface PipelineStepperProps {
  currentStatus: string;
}

interface Stage {
  key: string;
  label: string;
  icon: React.ReactNode;
  statuses: string[];
}

const stages: Stage[] = [
  {
    key: 'upload',
    label: '上传',
    icon: <FileUpIcon className="h-3.5 w-3.5" />,
    statuses: ['uploaded'],
  },
  {
    key: 'parse',
    label: '解析',
    icon: <SearchIcon className="h-3.5 w-3.5" />,
    statuses: ['parsing', 'parsed'],
  },
  {
    key: 'generate',
    label: '生成',
    icon: <SparklesIcon className="h-3.5 w-3.5" />,
    statuses: ['generating'],
  },
  {
    key: 'done',
    label: '完成',
    icon: <CheckIcon className="h-3.5 w-3.5" />,
    statuses: ['done'],
  },
];

function getStageState(
  stage: Stage,
  currentStatus: string
): 'complete' | 'active' | 'pending' | 'error' {
  if (currentStatus === 'error') {
    const stageIdx = stages.findIndex((s) => s.statuses.includes(currentStatus));
    const thisIdx = stages.findIndex((s) => s.key === stage.key);
    if (thisIdx === stageIdx) return 'error';
    if (thisIdx < stageIdx) return 'complete';
    return 'pending';
  }

  if (stage.statuses.includes(currentStatus)) return 'active';

  const currentIdx = stages.findIndex((s) => s.statuses.includes(currentStatus));
  const thisIdx = stages.findIndex((s) => s.key === stage.key);

  if (currentIdx === -1) return 'pending';
  if (thisIdx < currentIdx) return 'complete';
  return 'pending';
}

export default function PipelineStepper({ currentStatus }: PipelineStepperProps) {
  return (
    <div className="flex items-center justify-center mb-6 py-3 px-4 bg-white rounded-lg border">
      {stages.map((stage, idx) => {
        const state = getStageState(stage, currentStatus);
        const isLast = idx === stages.length - 1;

        return (
          <div key={stage.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-medium transition-colors ${
                  state === 'complete'
                    ? 'bg-blue-600 text-white'
                    : state === 'active'
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400'
                    : state === 'error'
                    ? 'bg-red-100 text-red-700 ring-2 ring-red-400'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {state === 'complete' ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  stage.icon
                )}
              </div>
              <span
                className={`text-xs ${
                  state === 'complete'
                    ? 'text-blue-600 font-medium'
                    : state === 'active'
                    ? 'text-blue-700 font-medium'
                    : state === 'error'
                    ? 'text-red-600 font-medium'
                    : 'text-gray-400'
                }`}
              >
                {stage.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-2 h-0.5">
                <div
                  className={`h-full rounded transition-colors ${
                    state === 'complete' ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
