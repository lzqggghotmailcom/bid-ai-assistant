'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import { useUploadBid } from '@/hooks/useUploadBid';
import { UploadIcon, FileIcon, XIcon } from 'lucide-react';

const INDUSTRY_OPTIONS = [
  { value: 'it', label: 'IT/软件' },
  { value: 'construction', label: '建筑工程' },
  { value: 'healthcare', label: '医疗/医药' },
  { value: 'consulting', label: '咨询服务' },
  { value: 'manufacturing', label: '制造业' },
  { value: 'education', label: '教育/培训' },
  { value: 'other', label: '其他行业' },
];

interface BidUploaderProps {
  industry: string;
  onIndustryChange: (value: string) => void;
  onSuccess?: () => void;
}

export default function BidUploader({ industry, onIndustryChange, onSuccess }: BidUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadBid();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      await upload.mutateAsync({ file: selectedFile, industry });
      setSelectedFile(null);
      onSuccess?.();
    } catch {
      // error handled by react-query
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Industry Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">行业分类</label>
        <div className="flex flex-wrap gap-1.5">
          {INDUSTRY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onIndustryChange(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                industry === opt.value
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={handleFileSelect}
        />
        <UploadIcon className="h-10 w-10 text-gray-400 mb-3" />
        <p className="text-sm text-gray-600 font-medium">点击或拖拽上传招标文件</p>
        <p className="text-xs text-gray-400 mt-1">支持 PDF、Word 格式</p>
      </div>

      {selectedFile && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
          <FileIcon className="h-5 w-5 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">{selectedFile.name}</p>
            <p className="text-xs text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={clearFile}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      {upload.isPending && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">上传中...</span>
          </div>
          <Progress value={null}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </div>
      )}

      {upload.isError && (
        <p className="text-sm text-red-600">
          {(upload.error as Error)?.message || '上传失败，请重试'}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={clearFile} disabled={!selectedFile || upload.isPending}>
          取消
        </Button>
        <Button onClick={handleUpload} disabled={!selectedFile || upload.isPending}>
          {upload.isPending ? '上传中...' : '确认上传'}
        </Button>
      </div>
    </div>
  );
}
