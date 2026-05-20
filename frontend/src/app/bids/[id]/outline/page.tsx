'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBid, type OutlineSection } from '@/hooks/useBid';
import { useGenerateOutline } from '@/hooks/useGenerateOutline';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import OutlineEditorComponent from '@/components/OutlineEditor';
import Breadcrumb from '@/components/Breadcrumb';
import { ArrowLeftIcon, SparklesIcon, SaveIcon } from 'lucide-react';

export default function OutlineEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const bidId = params.id as string;

  const { data: bid, isLoading } = useBid(bidId);
  const { generate, save } = useGenerateOutline(bidId);

  const [sections, setSections] = useState<OutlineSection[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (bid?.outline) {
      setSections(bid.outline);
    }
  }, [bid]);

  const handleSectionsChange = (updated: OutlineSection[]) => {
    setSections(updated);
    setIsDirty(true);
  };

  const handleGenerate = async () => {
    try {
      const result = await generate.mutateAsync();
      setSections(result.outline);
      setIsDirty(true);
      toast({ title: '大纲生成成功', type: 'success' });
    } catch (err: any) {
      toast({
        title: '大纲生成失败',
        description: err?.response?.data?.detail || err?.message || '未知错误',
        type: 'error',
      });
    }
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync(sections);
      setIsDirty(false);
      toast({ title: '大纲已保存', type: 'success' });
    } catch (err: any) {
      toast({
        title: '保存失败',
        description: err?.response?.data?.detail || err?.message || '未知错误',
        type: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: '投标管理', href: '/' },
          { label: bid?.filename || '...', href: `/bids/${bidId}` },
          { label: '编辑大纲' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">编辑应标大纲</h1>
            <p className="text-sm text-gray-500">
              {bid?.filename || '...'}
              {isDirty && (
                <span className="text-yellow-600 ml-2">(未保存)</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sections.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={generate.isPending}
            >
              <SparklesIcon className="h-4 w-4 mr-1" />
              {generate.isPending ? '生成中...' : 'AI生成大纲'}
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!isDirty || save.isPending}>
            <SaveIcon className="h-4 w-4 mr-1" />
            {save.isPending ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {/* Editor */}
      {sections.length > 0 ? (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-700">
              <strong>操作说明：</strong>拖拽左侧手柄可调整章节顺序，权重设置会影响 AI
              生成时对该章节的重视程度。每个章节应关联评分点以确保内容针对性强。
              修改后请点击右上角「保存」按钮。
            </p>
          </div>
          <OutlineEditorComponent
            sections={sections}
            onChange={handleSectionsChange}
            onSave={handleSave}
            saving={save.isPending}
          />
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <FileTextPlaceholder />
            <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">
              创建应标大纲
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-1">
              大纲是标书的骨架，决定了标书的结构和重点
            </p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mb-6">
              AI 会根据招标文件中的评分标准自动生成大纲，包含章节标题、权重、
              评分点关联和所需附件。您也可以在生成后手动编辑调整。
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleGenerate} disabled={generate.isPending}>
                <SparklesIcon className="h-4 w-4 mr-1" />
                {generate.isPending ? '生成中...' : 'AI 自动生成大纲'}
              </Button>
              <span className="text-xs text-gray-400">或</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSections([
                    {
                      section_id: `s${Date.now()}`,
                      title: '新章节',
                      score_point_ref: '',
                      weight: 'medium',
                      required_attachments: [],
                    },
                  ]);
                  setIsDirty(true);
                }}
              >
                手动添加章节
              </Button>
            </div>
            {generate.isError && (
              <p className="text-sm text-red-500 mt-3">
                生成失败: {(generate.error as Error)?.message || '未知错误'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      {sections.length > 0 && (
        <Card className="mt-6 border-blue-100 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-xs text-blue-700">
              提示：拖拽章节调整顺序，点击拖拽手柄或使用上下箭头移动。每个章节需要设置权重（高/中/低）并关联评分点。修改后请点击保存。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FileTextPlaceholder() {
  return (
    <svg className="h-10 w-10 text-gray-300 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
