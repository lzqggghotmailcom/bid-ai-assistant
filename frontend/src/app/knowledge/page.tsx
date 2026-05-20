'use client';

import { useState } from 'react';
import { useKnowledgeDocs, type KnowledgeDoc } from '@/hooks/useKnowledgeDocs';
import { useUploadKnowledge } from '@/hooks/useUploadKnowledge';
import { useSearchKnowledge } from '@/hooks/useSearchKnowledge';
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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import Breadcrumb from '@/components/Breadcrumb';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  UploadIcon,
  SearchIcon,
  Trash2Icon,
  FileTextIcon,
  AwardIcon,
  BriefcaseIcon,
  UserIcon,
  XIcon,
  DatabaseIcon,
} from 'lucide-react';

const docTypeTabs = [
  { value: 'all', label: '全部' },
  { value: 'bid', label: '历史标书' },
  { value: 'cert', label: '资质证书' },
  { value: 'case', label: '项目案例' },
  { value: 'resume', label: '人员简历' },
];

const docTypeIcons: Record<string, React.ReactNode> = {
  bid: <FileTextIcon className="h-4 w-4 text-blue-500" />,
  cert: <AwardIcon className="h-4 w-4 text-yellow-500" />,
  case: <BriefcaseIcon className="h-4 w-4 text-green-500" />,
  resume: <UserIcon className="h-4 w-4 text-purple-500" />,
};

const docTypeLabels: Record<string, string> = {
  bid: '历史标书',
  cert: '资质证书',
  case: '项目案例',
  resume: '人员简历',
};

export default function KnowledgePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeDocType, setActiveDocType] = useState('all');
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<'bid' | 'cert' | 'case' | 'resume'>('bid');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<KnowledgeDoc | null>(null);

  const { data, isLoading, isError, refetch } = useKnowledgeDocs(activeDocType, page);
  const upload = useUploadKnowledge();
  const search = useSearchKnowledge(searchQuery);

  const docs = data?.items || [];
  const total = data?.total || 0;
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      await upload.mutateAsync({ file: selectedFile, doc_type: uploadDocType });
      setSelectedFile(null);
      setShowUpload(false);
      toast({ title: '上传成功', description: '文档已上传，正在处理...', type: 'success' });
    } catch (err: any) {
      toast({
        title: '上传失败',
        description: err?.response?.data?.detail || err?.message || '未知错误',
        type: 'error',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const docId = confirmDelete.doc_id;
    setDeletingId(docId);
    try {
      await api.delete(`/knowledge/documents/${docId}`);
      toast({ title: '删除成功', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['knowledgeDocs'] });
    } catch (err: any) {
      toast({
        title: '删除失败',
        description: err?.response?.data?.detail || err?.message || '未知错误',
        type: 'error',
      });
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  return (
    <div>
      <Breadcrumb items={[{ label: '知识库' }]} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">企业知识库</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-lg">
            上传公司的资质证书、历史标书、项目案例和人员简历。
            AI 在生成投标方案时会自动检索知识库，引用相关经验和资质，使标书更具说服力。
          </p>
        </div>
        <Button size="sm" onClick={() => setShowUpload(true)}>
          <PlusIcon className="h-4 w-4 mr-1" />
          上传文档
        </Button>
      </div>

      {/* Knowledge Types Guide */}
      {docs.length === 0 && !isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: <FileTextIcon className="h-5 w-5 text-blue-500" />, title: '历史标书', desc: '上传过往成功中标的标书，AI 会学习其结构和亮点' },
            { icon: <AwardIcon className="h-5 w-5 text-yellow-500" />, title: '资质证书', desc: 'ISO认证、行业资质等，生成标书时自动附上' },
            { icon: <BriefcaseIcon className="h-5 w-5 text-green-500" />, title: '项目案例', desc: '公司完成的类似项目，用于证明技术实力' },
            { icon: <UserIcon className="h-5 w-5 text-purple-500" />, title: '人员简历', desc: '项目团队核心成员的专业背景和证书' },
          ].map((item, idx) => (
            <Card key={idx} className="border-dashed">
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-2">{item.icon}</div>
                <h4 className="text-sm font-medium text-gray-900 mb-1">{item.title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索文档..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9 pr-8"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                setSearchQuery('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleSearch}>
          <SearchIcon className="h-4 w-4 mr-1" />
          搜索
        </Button>
      </div>

      {/* Search Results */}
      {searchQuery && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            搜索结果: &quot;{searchQuery}&quot;
          </h3>
          {search.isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : search.data?.results && search.data.results.length > 0 ? (
            <div className="space-y-2">
              {search.data.results.map((result, idx) => (
                <Card key={idx}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 line-clamp-2">{result.content}</p>
                      </div>
                      <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                        {(result.score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">未找到相关结果</p>
          )}
        </div>
      )}

      {/* Doc Type Filter Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b pb-2">
        {docTypeTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveDocType(tab.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeDocType === tab.value
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Document List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
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
      ) : docs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <DatabaseIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-1">暂无文档</p>
            <p className="text-xs text-gray-400 mb-4">
              上传历史标书、资质证书等文档，构建企业知识库
            </p>
            <Button size="sm" onClick={() => setShowUpload(true)}>
              <UploadIcon className="h-4 w-4 mr-1" />
              上传文档
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>文档名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>分块数</TableHead>
                  <TableHead>上传日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-20">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc: KnowledgeDoc) => (
                  <TableRow key={doc.doc_id}>
                    <TableCell>
                      {docTypeIcons[doc.doc_type] || (
                        <FileTextIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-gray-900 max-w-xs truncate">
                      {doc.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {docTypeLabels[doc.doc_type] || doc.doc_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">{doc.chunks}</TableCell>
                    <TableCell className="text-gray-500">
                      {doc.created_at
                        ? new Date(doc.created_at).toLocaleDateString('zh-CN')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={doc.status} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setConfirmDelete(doc)}
                        disabled={deletingId === doc.doc_id}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        {deletingId === doc.doc_id ? (
                          <span className="inline-block animate-spin h-3 w-3 border-2 border-red-500 border-t-transparent rounded-full" />
                        ) : (
                          <Trash2Icon className="h-3 w-3" />
                        )}
                      </Button>
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

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="删除文档"
        description={`确定要删除「${confirmDelete?.title || ''}」吗？此操作不可撤销，所有相关分块数据将被一并删除。`}
        confirmLabel="确认删除"
        variant="destructive"
        loading={!!deletingId}
        onConfirm={handleDelete}
      />

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>上传知识库文档</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>文档类型</Label>
              <div className="flex items-center gap-1 flex-wrap">
                {docTypeTabs.filter((t) => t.value !== 'all').map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setUploadDocType(type.value as 'bid' | 'cert' | 'case' | 'resume')}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      uploadDocType === type.value
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>选择文件</Label>
              <div className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 bg-gray-50 cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                />
                <UploadIcon className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  {selectedFile ? selectedFile.name : '点击选择文件'}
                </p>
                <p className="text-xs text-gray-400 mt-1">支持 PDF、Word 格式</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setShowUpload(false);
                }}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleUpload}
                disabled={!selectedFile || upload.isPending}
              >
                {upload.isPending ? '上传中...' : '确认上传'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
