'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBid, type ScoreItem, type RejectClause, type OutlineSection } from '@/hooks/useBid';
import { useGenerateOutline } from '@/hooks/useGenerateOutline';
import { useGenerateSections } from '@/hooks/useGenerateSections';
import { useComplianceCheck, type ComplianceResult } from '@/hooks/useComplianceCheck';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';
import ScoreBadge from '@/components/ScoreBadge';
import SectionPreview from '@/components/SectionPreview';
import GenerationProgress from '@/components/GenerationProgress';
import ComplianceReport from '@/components/ComplianceReport';
import PipelineStepper from '@/components/PipelineStepper';
import Breadcrumb from '@/components/Breadcrumb';
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
  SparklesIcon,
  AlertTriangleIcon,
} from 'lucide-react';
import api from '@/lib/api';
import PurchaseDialog from '@/components/PurchaseDialog';

const INDUSTRY_LABELS: Record<string, string> = {
  it: 'IT/软件',
  construction: '建筑工程',
  healthcare: '医疗/医药',
  consulting: '咨询服务',
  manufacturing: '制造业',
  education: '教育/培训',
  other: '其他行业',
};

export default function BidDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const bidId = params.id as string;

  const { data: bid, isLoading, isError, refetch } = useBid(bidId);
  const { generate: generateOutline } = useGenerateOutline(bidId);
  const { generate: generateSections, regenerate: regenerateSection } = useGenerateSections(bidId);
  const complianceCheck = useComplianceCheck(bidId);

  const [activeTab, setActiveTab] = useState('parsed');
  const [complianceData, setComplianceData] = useState<ComplianceResult | null>(null);
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  useEffect(() => {
    if (bid?.status === 'done') {
      setActiveTab('content');
    }
  }, [bid]);

  const handleGenerateOutline = async () => {
    try {
      await generateOutline.mutateAsync();
      toast({ title: '大纲生成成功', type: 'success' });
      setActiveTab('outline');
    } catch (err: any) {
      toast({
        title: '大纲生成失败',
        description: err?.response?.data?.detail || err?.message || '未知错误',
        type: 'error',
      });
    }
  };

  const handleGenerateContent = async () => {
    if (!bid?.outline) return;
    try {
      await generateSections.mutateAsync({
        outline: bid.outline,
        settings: {
          company_name: user?.company_name || '公司',
        },
      });
      toast({ title: '内容生成已启动', type: 'success' });
      setActiveTab('content');
    } catch (err: any) {
      if (err?.response?.status === 402) {
        setPurchaseOpen(true);
        toast({
          title: '项目额度不足',
          description: '免费试用已用完，请购买套餐后继续',
          type: 'error',
        });
      } else {
        toast({
          title: '生成失败',
          description: err?.response?.data?.detail || err?.message || '未知错误',
          type: 'error',
        });
      }
    }
  };

  const handleRegenerateSection = async (sectionId: string) => {
    setRegeneratingSectionId(sectionId);
    try {
      await regenerateSection.mutateAsync(sectionId);
      toast({ title: '重新生成成功', type: 'success' });
    } catch (err: any) {
      if (err?.response?.status === 402) {
        setPurchaseOpen(true);
        toast({ title: '项目额度不足，请购买套餐', type: 'error' });
      } else {
        toast({
          title: '重新生成失败',
          description: err?.response?.data?.detail || err?.message || '未知错误',
          type: 'error',
        });
      }
    } finally {
      setRegeneratingSectionId(null);
    }
  };

  const handleComplianceCheck = async () => {
    try {
      const result = await complianceCheck.mutateAsync();
      setComplianceData(result);
      toast({ title: '合规检查完成', type: 'success' });
      setActiveTab('compliance');
    } catch (err: any) {
      toast({
        title: '合规检查失败',
        description: err?.response?.data?.detail || err?.message || '未知错误',
        type: 'error',
      });
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get(`/bids/${bidId}/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${bid?.filename || 'bid'}_标书.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: '导出成功', type: 'success' });
    } catch (err: any) {
      if (err?.response?.status === 402) {
        setPurchaseOpen(true);
        // Parse error detail from blob response
        toast({ title: '余额不足，请充值', type: 'error' });
      } else {
        toast({ title: '导出失败', type: 'error' });
      }
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
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !bid) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          返回
        </Button>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-red-600 mb-3">加载失败或找不到该投标</p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                重试
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push('/')}>
                返回首页
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const parsed = bid.parsed;
  const outline = bid.outline;
  const generationStatus = bid.generation_status;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: '投标管理', href: '/' },
          { label: bid.filename },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" onClick={() => router.push('/')}>
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{bid.filename}</h1>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={bid.status} />
                {bid.industry && (
                  <Badge variant="outline" className="text-xs">
                    {INDUSTRY_LABELS[bid.industry] || bid.industry}
                  </Badge>
                )}
                {bid.page_count > 0 && (
                  <span className="text-xs text-gray-400">{bid.page_count} 页</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/bids/${bidId}/outline`)}
          >
            编辑大纲
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleExport}>
            <DownloadIcon className="h-4 w-4 mr-1" />
            导出Word
          </Button>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <PipelineStepper currentStatus={bid.status} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="parsed">解析结果</TabsTrigger>
          <TabsTrigger value="outline">大纲</TabsTrigger>
          <TabsTrigger value="content">生成内容</TabsTrigger>
          <TabsTrigger value="compliance">合规检查</TabsTrigger>
        </TabsList>

        {/* Tab 1: 解析结果 */}
        <TabsContent value="parsed">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-700">
              系统自动从招标文件中提取了以下结构化信息。请核对内容是否准确——
              评分标准和废标条款将直接影响后续大纲生成和合规检查的质量。
            </p>
          </div>
          {parsed ? (
            <div className="space-y-6">
              {/* Score Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">评分标准</CardTitle>
                </CardHeader>
                <CardContent>
                  {parsed.score_items.length > 0 ? (
                    <div className="grid gap-2">
                      {parsed.score_items.map((item: ScoreItem) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between p-3 rounded-lg border bg-gray-50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium text-xs text-gray-400 mr-1">
                                [{item.category}]
                              </span>
                              {item.item}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            {item.required && (
                              <Badge variant="outline" className="text-xs text-red-500 border-red-200">
                                必选
                              </Badge>
                            )}
                            <span className="text-sm font-semibold text-blue-600">
                              {item.score}分
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">未提取到评分标准</p>
                  )}
                </CardContent>
              </Card>

              {/* Reject Clauses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangleIcon className="h-4 w-4 text-red-500" />
                    废标条款
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {parsed.reject_clauses.length > 0 ? (
                    <div className="space-y-2">
                      {parsed.reject_clauses.map((clause: RejectClause) => (
                        <div
                          key={clause.id}
                          className="p-3 rounded-lg border border-red-200 bg-red-50"
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangleIcon className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm text-red-700">{clause.clause}</p>
                              <Badge
                                variant="destructive"
                                className="mt-1 text-xs"
                              >
                                {clause.severity === 'high' ? '高风险' : clause.severity === 'medium' ? '中风险' : '低风险'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">
                      未提取到废标条款
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Tech Requirements */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">技术参数要求</CardTitle>
                </CardHeader>
                <CardContent>
                  {parsed.tech_requirements.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside">
                      {parsed.tech_requirements.map((req) => (
                        <li key={req.id} className="text-sm text-gray-600">
                          <span className="text-xs text-gray-400">[{req.category}]</span>{' '}
                          {req.requirement}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">
                      未提取到技术参数要求
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Qualification Requirements */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">商务资质要求</CardTitle>
                </CardHeader>
                <CardContent>
                  {parsed.qualification_requirements.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside">
                      {parsed.qualification_requirements.map((req) => (
                        <li key={req.id} className="text-sm text-gray-600">
                          <span className="text-xs text-gray-400">[{req.type}]</span>{' '}
                          {req.requirement}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">
                      未提取到商务资质要求
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Generate Outline CTA */}
              {!outline && (
                <div className="text-center py-4">
                  <Button onClick={handleGenerateOutline} disabled={generateOutline.isPending}>
                    <SparklesIcon className="h-4 w-4 mr-1" />
                    {generateOutline.isPending ? '生成中...' : '生成应标大纲'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <FileTextIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-1">文件尚未解析完成</p>
                <p className="text-xs text-gray-400 mb-4">
                  当前状态: <StatusBadge status={bid.status} />
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  刷新状态
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: 大纲 */}
        <TabsContent value="outline">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-purple-700">
              应标大纲是根据评分标准自动生成的结构框架。每个章节关联了对应的评分点，
              您可以在「编辑大纲」页面中拖拽调整章节顺序、修改标题或增减章节。
            </p>
          </div>
          {outline && outline.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700">
                  共 {outline.length} 个章节
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/bids/${bidId}/outline`)}
                  >
                    编辑大纲
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleGenerateContent}
                    disabled={generateSections.isPending}
                  >
                    <SparklesIcon className="h-4 w-4 mr-1" />
                    {generateSections.isPending ? '生成中...' : '生成标书内容'}
                  </Button>
                </div>
              </div>
              {outline.map((section: OutlineSection, idx: number) => (
                <Card key={section.section_id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-gray-400">
                            {idx + 1}.
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {section.title}
                          </span>
                          <ScoreBadge weight={section.weight} />
                        </div>
                        {section.score_point_ref && (
                          <p className="text-xs text-gray-500 ml-5">
                            评分点: {section.score_point_ref}
                          </p>
                        )}
                        {section.required_attachments.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 ml-5 flex-wrap">
                            {section.required_attachments.map((att, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {att}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <FileTextIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-4">尚未生成大纲</p>
                <Button
                  onClick={handleGenerateOutline}
                  disabled={generateOutline.isPending}
                >
                  <SparklesIcon className="h-4 w-4 mr-1" />
                  {generateOutline.isPending ? '生成中...' : '生成应标大纲'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3: 生成内容 */}
        <TabsContent value="content">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-amber-700">
              AI 将根据大纲逐章节生成投标方案内容。生成过程会检索您的企业知识库，
              自动引用相关资质和案例。您可以在每个章节上点击「重新生成」优化内容。
            </p>
          </div>
          {generationStatus ? (
            <div className="space-y-6">
              <GenerationProgress
                sectionsTotal={generationStatus.sections_total}
                sectionsDone={generationStatus.sections_done}
                sections={
                  outline?.map((s: OutlineSection) => ({
                    section_id: s.section_id,
                    title: s.title,
                    status: s.status || 'pending',
                  })) || []
                }
                status={generationStatus.status}
              />
              {generationStatus.status === 'done' && outline && outline.length > 0 && (
                <div className="space-y-4 mt-6">
                  <h3 className="text-sm font-medium text-gray-700">章节内容</h3>
                  {outline.map((section: OutlineSection) => (
                    <SectionPreview
                      key={section.section_id}
                      title={section.title}
                      content={section.content || ''}
                      status={section.status}
                      onRegenerate={() => handleRegenerateSection(section.section_id)}
                      regenerating={regeneratingSectionId === section.section_id}
                    />
                  ))}
                  <div className="text-center pt-4">
                    <Button onClick={handleComplianceCheck} disabled={complianceCheck.isPending}>
                      {complianceCheck.isPending ? '检查中...' : '执行合规检查'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <FileTextIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-4">尚未开始生成内容</p>
                {outline && outline.length > 0 ? (
                  <Button
                    onClick={handleGenerateContent}
                    disabled={generateSections.isPending}
                  >
                    <SparklesIcon className="h-4 w-4 mr-1" />
                    {generateSections.isPending ? '生成中...' : '开始生成'}
                  </Button>
                ) : (
                  <p className="text-xs text-gray-400">请先生成大纲</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 4: 合规检查 */}
        <TabsContent value="compliance">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-green-700">
              合规检查会自动对比生成的标书与原始招标要求，检查评分点覆盖率、废标条款
              响应情况和敏感词风险。检查通过后即可导出 Word 文档。
            </p>
          </div>
          {complianceData || complianceCheck.data ? (
            <ComplianceReport
              data={complianceData || complianceCheck.data || null}
              loading={complianceCheck.isPending}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <AlertTriangleIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-4">尚未执行合规检查</p>
                <Button
                  onClick={handleComplianceCheck}
                  disabled={complianceCheck.isPending}
                >
                  {complianceCheck.isPending ? '检查中...' : '执行合规检查'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <PurchaseDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} />
    </div>
  );
}
