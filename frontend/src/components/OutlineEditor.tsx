'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import ScoreBadge from './ScoreBadge';
import {
  GripVertical,
  PlusIcon,
  Trash2Icon,
  MoveUpIcon,
  MoveDownIcon,
} from 'lucide-react';
import type { OutlineSection } from '@/hooks/useBid';

interface OutlineEditorProps {
  sections: OutlineSection[];
  onChange: (sections: OutlineSection[]) => void;
  onSave?: () => void;
  saving?: boolean;
}

export default function OutlineEditor({ sections, onChange, onSave, saving }: OutlineEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const updateSection = (index: number, updates: Partial<OutlineSection>) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeSection = (index: number) => {
    onChange(sections.filter((_, i) => i !== index));
  };

  const addSection = () => {
    const newSection: OutlineSection = {
      section_id: `new-${Date.now()}`,
      title: '新章节',
      score_point_ref: '',
      weight: 'medium',
      required_attachments: [],
    };
    onChange([...sections, newSection]);
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= sections.length) return;
    const updated = [...sections];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(updated);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    moveSection(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <Card
          key={section.section_id}
          className={`${dragIndex === index ? 'opacity-50' : ''}`}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-2 cursor-grab active:cursor-grabbing shrink-0">
                <GripVertical className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400 shrink-0">
                    {index + 1}.
                  </span>
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(index, { title: e.target.value })}
                    placeholder="章节标题"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">权重:</span>
                    <select
                      value={section.weight}
                      onChange={(e) =>
                        updateSection(index, {
                          weight: e.target.value as 'high' | 'medium' | 'low',
                        })
                      }
                      className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700"
                    >
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                    </select>
                    <ScoreBadge weight={section.weight} />
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-gray-400 shrink-0">评分点:</span>
                    <Input
                      value={section.score_point_ref}
                      onChange={(e) => updateSection(index, { score_point_ref: e.target.value })}
                      placeholder="关联评分点"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => moveSection(index, index - 1)}
                  disabled={index === 0}
                >
                  <MoveUpIcon className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => moveSection(index, index + 1)}
                  disabled={index === sections.length - 1}
                >
                  <MoveDownIcon className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeSection(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2Icon className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={addSection}>
          <PlusIcon className="h-4 w-4 mr-1" />
          添加章节
        </Button>
        {onSave && (
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? '保存中...' : '保存大纲'}
          </Button>
        )}
      </div>
    </div>
  );
}
