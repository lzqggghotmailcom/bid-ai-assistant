'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useBids, type Bid } from '@/hooks/useBids';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';
import BidUploader from '@/components/BidUploader';
import { Badge } from '@/components/ui/badge';
import ConfirmDialog from '@/components/ConfirmDialog';
import WelcomeGuide from '@/components/WelcomeGuide';
import Breadcrumb from '@/components/Breadcrumb';
import {
  PlusIcon,
  RefreshCwIcon,
  FileTextIcon,
  CheckCircleIcon,
  ClockIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
  UploadIcon,
  SearchIcon as ParseIcon,
  SparklesIcon,
  DownloadIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'uploaded', label: '已上传' },
  { value: 'parsing', label: '解析中' },
  { value: 'parsed', label: '已解析' },
  { value: 'generating', label: '生成中' },
  { value: 'done', label: '已完成' },
  { value: 'error', label: '失败' },
];

const INDUSTRY_LABELS: Record<string, string> = {
  it: 'IT/软件',
  construction: '建筑工程',
  healthcare: '医疗/医药',
  consulting: '咨询服务',
  manufacturing: '制造业',
  education: '教育/培训',
  other: '其他行业',
};

const pipelineSteps = [
  { icon: <UploadIcon className="h-5 w-5" />, title: '上传招标文件', desc: '支持 PDF / Word / 扫描件' },
  { icon: <ParseIcon className="h-5 w-5" />, title: 'AI 智能解析', desc: '提取评分标准与废标条款' },
  { icon: <SparklesIcon className="h-5 w-5" />, title: '自动生成标书', desc: '结合知识库撰写方案' },
  { icon: <DownloadIcon className="h-5 w-5" />, title: '导出 Word 文档', desc: '一键下载，格式规范' },
];

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<Bid | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [introExpanded, setIntroExpanded] = useState(true);
  const [uploadIndustry, setUploadIndustry] = useState('it');
  const { data, isLoading, isError, refetch } = useBids(page);

  const bids = data?.items || [];
  const total = data?.total || 0;
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  const filteredBids = useMemo(() => {
    return bids.filter((b) => {
      const matchesSearch =
        searchTerm === '' || b.filename.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bids, searchTerm, statusFilter]);

  const stats = {
    total: searchTerm || statusFilter !== 'all' ? filteredBids.length : total,
    inProgress: filteredBids.filter((b: Bid) =>
      ['parsing', 'parsed', 'generating'].includes(b.status)
    ).length,
    completed: filteredBids.filter((b: Bid) => b.status === 'done').length,
  };

  const handleRowClick = (bidId: string) => {
    router.push(`/bids/${bidId}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/bids/${deleteTarget.id}`);
      toast({ title: '删除成功', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['bids'] });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({
        title: '删除失败',
        description: err?.response?.data?.detail || err.message || '未知错误',
        type: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleUploadSuccess = () => {
    setShowUpload(false);
    setUploadIndustry('it');
    toast({ title: '上传成功', description: '文件已上传，正在自动解析...', type: 'success' });
    queryClient.invalidateQueries({ queryKey: ['bids'] });
  };

  return (
    <div>
      <Breadcrumb items={[{ label: '投标管理' }]} />

      {/* Intro Section — always visible */}
      {bids.length > 0 ? (
        <Card className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-base font-bold text-gray-900">AI 投标助手</h1>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    四步完成标书制作
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3 max-w-2xl">
                  上传招标文件 → AI 自动解析评分规则和废标条款 → 智能生成应标大纲和方案内容
                  → 合规检查后导出 Word 文档。支持扫描件 OCR 识别，可结合企业知识库生成个性化标书。
                </p>
                {introExpanded && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    {pipelineSteps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-white border">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <span className="text-blue-600">{idx + 1}</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-800">{step.title}</p>
                          <p className="text-xs text-gray-400">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIntroExpanded(!introExpanded)}
                className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
              >
                {introExpanded ? (
                  <ChevronUpIcon className="h-4 w-4" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6 bg-gradient-to-r from-blue-600 to-blue-700 border-0">
          <CardContent className="p-6">
            <h1 className="text-xl font-bold text-white mb-2">AI 投标助手</h1>
            <p className="text-sm text-blue-100 max-w-2xl">
              专为企业投标团队打造的智能标书撰写平台。上传招标文件，AI 自动解析评分规则、
              提取废标条款、生成应标大纲、撰写章节内容，最终输出规范的 Word 文档。
              支持扫描件 OCR 识别，结合企业知识库自动引用资质和案例，让标书针对性强、更易中标。
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {pipelineSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/10 backdrop-blur">
                  <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{idx + 1}</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{step.title}</p>
                    <p className="text-xs text-blue-200">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  {searchTerm || statusFilter !== 'all' ? '筛选结果' : '全部投标'}
                </p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileTextIcon className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">进行中</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
              </div>
              <ClockIcon className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">已完成</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">投标列表</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCwIcon className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <PlusIcon className="h-4 w-4 mr-1" />
            新建投标
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索文件名..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-9 pr-8"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-red-600 mb-3">加载失败，请重试</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </CardContent>
        </Card>
      ) : filteredBids.length === 0 && bids.length > 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <FileTextIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">没有匹配的投标</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
            >
              清除筛选
            </Button>
          </CardContent>
        </Card>
      ) : bids.length === 0 && !isLoading ? (
        <WelcomeGuide onUpload={() => setShowUpload(true)} />
      ) : (
        <>
          <div className="rounded-lg border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文件名</TableHead>
                  <TableHead>行业</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>页数</TableHead>
                  <TableHead>上传时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBids.map((bid: Bid) => (
                  <TableRow
                    key={bid.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(bid.id)}
                  >
                    <TableCell className="font-medium text-gray-900 max-w-xs truncate">
                      {bid.filename}
                    </TableCell>
                    <TableCell>
                      {bid.industry ? (
                        <Badge variant="outline" className="text-xs">
                          {INDUSTRY_LABELS[bid.industry] || bid.industry}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={bid.status} />
                    </TableCell>
                    <TableCell className="text-gray-500">{bid.page_count || '-'}</TableCell>
                    <TableCell className="text-gray-500">
                      {bid.created_at ? new Date(bid.created_at).toLocaleDateString('zh-CN') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(bid.id);
                          }}
                        >
                          查看
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(bid);
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2Icon className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                共 {total} 条，第 {page}/{totalPages} 页
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>上传招标文件</DialogTitle>
          </DialogHeader>
          <BidUploader
            industry={uploadIndustry}
            onIndustryChange={setUploadIndustry}
            onSuccess={handleUploadSuccess}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="删除投标"
        description={`确定要删除「${deleteTarget?.filename || ''}」吗？此操作不可撤销，所有关联数据（大纲、生成内容、合规报告）将被一并删除。`}
        confirmLabel="确认删除"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
