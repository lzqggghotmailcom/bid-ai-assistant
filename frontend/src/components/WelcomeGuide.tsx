'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  UploadIcon,
  SearchIcon,
  SparklesIcon,
  DownloadIcon,
  FileTextIcon,
  ArrowRightIcon,
} from 'lucide-react';

interface WelcomeGuideProps {
  onUpload: () => void;
}

const steps = [
  {
    icon: <UploadIcon className="h-6 w-6 text-blue-600" />,
    title: '上传招标文件',
    desc: '支持 PDF、Word 格式的招标文件，系统会自动识别并提取关键信息',
    color: 'bg-blue-50 border-blue-200',
  },
  {
    icon: <SearchIcon className="h-6 w-6 text-purple-600" />,
    title: 'AI 智能解析',
    desc: '自动提取评分标准、废标条款、技术要求和资质要求等关键内容',
    color: 'bg-purple-50 border-purple-200',
  },
  {
    icon: <SparklesIcon className="h-6 w-6 text-amber-600" />,
    title: '生成应标方案',
    desc: '基于解析结果和企业知识库，AI 自动生成结构完整、针对性强的投标方案',
    color: 'bg-amber-50 border-amber-200',
  },
  {
    icon: <DownloadIcon className="h-6 w-6 text-green-600" />,
    title: '导出 Word 文档',
    desc: '一键导出格式规范的 .docx 文件，可直接提交或进一步编辑',
    color: 'bg-green-50 border-green-200',
  },
];

const features = [
  { icon: <FileTextIcon className="h-4 w-4" />, text: '自动提取评分细则，精准定位得分要点' },
  { icon: <SearchIcon className="h-4 w-4" />, text: '智能识别废标条款，有效规避投标风险' },
  { icon: <SparklesIcon className="h-4 w-4" />, text: '结合企业知识库，生成个性化高质量标书' },
];

export default function WelcomeGuide({ onUpload }: WelcomeGuideProps) {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="bg-gradient-to-r from-blue-600 to-blue-700 border-0">
        <CardContent className="p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-2">欢迎使用 AI 投标助手</h2>
          <p className="text-blue-100 text-sm max-w-lg mx-auto">
            上传招标文件，AI 自动解析评分规则、生成应标大纲、撰写投标方案，
            并输出规范的 Word 文档。全流程只需数分钟。
          </p>
          <Button
            size="lg"
            onClick={onUpload}
            className="mt-6 bg-white text-blue-700 hover:bg-blue-50"
          >
            <UploadIcon className="h-4 w-4 mr-2" />
            上传第一份招标文件
          </Button>
        </CardContent>
      </Card>

      {/* Pipeline Steps */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4 text-center">
          四步完成投标方案制作
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {steps.map((step, idx) => (
            <Card key={idx} className={`border-2 ${step.color} relative`}>
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-3">{step.icon}</div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">
                  {idx + 1}. {step.title}
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Arrows between steps (visible on sm+) */}
        <div className="hidden sm:flex justify-center items-center gap-[72px] mt-[-80px] relative z-10 pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <ArrowRightIcon key={i} className="h-5 w-5 text-gray-300" />
          ))}
        </div>
      </div>

      {/* Key Features */}
      <Card className="border-dashed bg-gray-50">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">核心能力</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5 shrink-0">{f.icon}</span>
                <span className="text-xs text-gray-600">{f.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-1">使用技巧</h4>
            <p className="text-xs text-gray-500">
              上传的招标文件越完整，AI 解析越准确。对于扫描版 PDF，系统会自动使用
              OCR 技术进行文字识别。
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-1">知识库联动</h4>
            <p className="text-xs text-gray-500">
              在「知识库」中上传公司资质、历史标书和项目案例，AI 会自动引用相关
              内容，让生成的标书更具针对性。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
