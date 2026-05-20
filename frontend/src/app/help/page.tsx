'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Breadcrumb from '@/components/Breadcrumb';
import {
  UploadIcon,
  FileTextIcon,
  SparklesIcon,
  DownloadIcon,
  SearchIcon,
  DatabaseIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowRightIcon,
  BookOpenIcon,
  LightbulbIcon,
  ZapIcon,
} from 'lucide-react';

const pipelineDetail = [
  {
    icon: <UploadIcon className="h-6 w-6 text-blue-600" />,
    title: '第一步：上传招标文件',
    desc: '在投标管理页面点击「新建投标」按钮，上传 .pdf 或 .docx 格式的招标文件。对于扫描版 PDF，系统会自动使用 OCR 技术识别文字内容。文件上传后会进入自动解析流程。',
    tips: ['单个文件建议不超过 50MB', '清晰度越高，OCR 识别越准确', '支持同时上传多个文件，各自独立处理'],
  },
  {
    icon: <SearchIcon className="h-6 w-6 text-purple-600" />,
    title: '第二步：AI 智能解析',
    desc: '系统会自动从招标文件中提取结构化信息：评分标准（含分值和是否必选项）、废标条款（按高/中/低风险分类）、技术参数要求、商务资质要求。解析结果可在投标详情页的「解析结果」标签页查看。',
    tips: ['解析通常需要 30 秒到 2 分钟', '请核对解析结果，关键信息的准确性直接影响标书质量', '如解析有误，可重新上传文件触发重新解析'],
  },
  {
    icon: <SparklesIcon className="h-6 w-6 text-amber-600" />,
    title: '第三步：生成应标大纲与内容',
    desc: 'AI 根据评分标准自动生成应标大纲，每个章节关联对应评分点并设置权重（高/中/低）。您可以在大纲编辑器中拖拽调整章节顺序、修改标题、增减章节。确认大纲后，AI 会逐章节生成投标方案内容，同时自动检索企业知识库引用相关资质和案例。',
    tips: ['大纲的权重设置会影响 AI 对各章节的重视程度', '建议在大纲中关联评分点，确保内容针对性强', '每个章节支持单独重新生成以优化内容'],
  },
  {
    icon: <DownloadIcon className="h-6 w-6 text-green-600" />,
    title: '第四步：合规检查与导出',
    desc: '生成完成后执行合规检查，系统会自动对比标书内容与原始招标要求，检查评分点覆盖率、废标条款响应情况和敏感词风险。检查通过后，一键导出格式规范的 .docx Word 文档。',
    tips: ['合规检查会生成详细的通过/警告/失败项列表', '敏感词检查有助于规避投标风险', '导出前请确保所有标记为失败的检查项已处理'],
  },
];

const pageGuides = [
  {
    title: '投标管理（首页）',
    desc: '查看所有投标的列表，包含文件名、处理状态、页数和上传时间。支持按文件名搜索和按状态筛选。点击行进入详情页，点击删除按钮可移除投标（同时清除所有关联数据）。',
    steps: ['点击「新建投标」上传招标文件', '在列表中查看各投标的处理进度', '点击文件名进入详情页查看完整信息'],
  },
  {
    title: '投标详情页',
    desc: '查看单个投标的完整信息，包含四个标签页：「解析结果」展示 AI 提取的结构化数据，「大纲」展示应标框架，「生成内容」展示逐章节的投标方案，「合规检查」展示质量检查报告。',
    steps: ['在「解析结果」标签核对评分标准和废标条款', '点击「生成应标大纲」或切换到「大纲」标签', '在「生成内容」标签监控生成进度', '执行合规检查后在「合规检查」标签查看报告'],
  },
  {
    title: '大纲编辑器',
    desc: '专门的页面用于编辑应标大纲。支持拖拽排序、修改章节标题和权重、关联评分点、添加所需附件。修改后需点击「保存」按钮持久化更改。',
    steps: ['点击「AI 生成大纲」自动创建框架', '拖拽左侧手柄调整章节顺序', '为每个章节设置权重并关联评分点', '修改完成后点击「保存」'],
  },
  {
    title: '知识库',
    desc: '管理企业知识资产，支持四类文档：历史标书（AI 学习结构风格）、资质证书（自动引用认证信息）、项目案例（证明技术实力）、人员简历（展示团队能力）。',
    steps: ['点击「上传文档」选择文件并指定类型', '在列表中查看文档处理状态', '通过搜索框检索知识库内容', '定期更新知识库以保持信息时效性'],
  },
];

const faqs = [
  { q: '支持哪些文件格式？', a: '上传招标文件支持 PDF 和 Word（.docx）格式。扫描版 PDF 会自动触发 OCR 文字识别。知识库文档同样支持 PDF 和 Word 格式。' },
  { q: '解析结果不准确怎么办？', a: '您可以删除该投标并重新上传招标文件。AI 解析的质量受原文件清晰度影响，建议使用文字版 PDF 而非扫描件以获得最佳效果。' },
  { q: '生成的大纲可以修改吗？', a: '可以。在「编辑大纲」页面，您可以通过拖拽调整章节顺序、修改标题、更改权重、增减章节。修改后记得点击「保存」。' },
  { q: '知识库中的数据如何被使用？', a: 'AI 在生成投标方案时，会自动检索知识库中与当前招标需求匹配的文档片段，引用相应的资质证书、项目案例和人员信息。' },
  { q: '合规检查检查什么？', a: '合规检查包含三项：评分点覆盖率（是否所有评分要求都有对应内容）、废标条款核查（是否规避了所有废标风险）、敏感词检查（是否存在可能引起负面评价的用语）。' },
  { q: '导出的 Word 文档格式如何？', a: '导出的 .docx 文件包含封面、目录、正文章节和附件清单，格式规范可直接提交。您也可以用 Microsoft Word 或 WPS 进一步编辑调整。' },
];

export default function HelpPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: '帮助中心' }]} />

      {/* Hero */}
      <Card className="mb-8 bg-gradient-to-r from-blue-600 to-blue-700 border-0">
        <CardContent className="p-8 text-center text-white">
          <BookOpenIcon className="h-10 w-10 mx-auto mb-3 text-blue-200" />
          <h1 className="text-2xl font-bold mb-2">帮助中心</h1>
          <p className="text-blue-100 text-sm max-w-xl mx-auto">
            AI 投标助手是一套专为企业投标团队打造的智能标书撰写平台。
            上传招标文件后，AI 自动完成解析、大纲生成、内容撰写、合规检查到 Word 导出的全流程。
            以下是系统的完整使用指南。
          </p>
        </CardContent>
      </Card>

      {/* Pipeline Flow */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-1">工作流程</h2>
        <p className="text-sm text-gray-500 mb-6">
          从上传招标文件到导出标书，完整的四步流程
        </p>

        {/* Flow Diagram */}
        <div className="hidden sm:flex items-center justify-center gap-0 mb-8 p-4 bg-gray-50 rounded-xl border">
          {[
            { icon: <UploadIcon className="h-5 w-5" />, label: '上传文件', color: 'bg-blue-600' },
            { icon: <SearchIcon className="h-5 w-5" />, label: 'AI 解析', color: 'bg-purple-600' },
            { icon: <SparklesIcon className="h-5 w-5" />, label: '生成标书', color: 'bg-amber-600' },
            { icon: <DownloadIcon className="h-5 w-5" />, label: '导出 Word', color: 'bg-green-600' },
          ].map((step, idx) => (
            <div key={idx} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div className={`h-10 w-10 rounded-full ${step.color} flex items-center justify-center text-white`}>
                  {step.icon}
                </div>
                <span className="text-xs font-medium text-gray-700">{step.label}</span>
              </div>
              {idx < 3 && (
                <ArrowRightIcon className="h-4 w-4 text-gray-300 mx-4 shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Detail Cards */}
        <div className="space-y-4">
          {pipelineDetail.map((step, idx) => (
            <CollapsibleStep key={idx} defaultOpen={idx === 0} {...step} />
          ))}
        </div>
      </section>

      {/* Page Guides */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-1">页面说明</h2>
        <p className="text-sm text-gray-500 mb-6">
          系统中各页面的功能说明和操作指引
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pageGuides.map((guide, idx) => (
            <Card key={idx}>
              <CardContent className="p-5">
                <h3 className="text-base font-semibold text-gray-900 mb-2">{guide.title}</h3>
                <p className="text-sm text-gray-500 mb-3">{guide.desc}</p>
                <ul className="space-y-1.5">
                  {guide.steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="h-4 w-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-1">使用技巧</h2>
        <p className="text-sm text-gray-500 mb-6">
          提高标书质量和效率的实用建议
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <LightbulbIcon className="h-4 w-4 text-blue-500" />
                <h4 className="text-sm font-semibold text-gray-900">完善知识库</h4>
              </div>
              <p className="text-xs text-gray-500">
                上传越多的企业资质、历史标书和项目案例，AI 生成的标书越具针对性和说服力。
                建议在首次使用前先批量导入企业的核心文档。
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ZapIcon className="h-4 w-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-900">逐章节优化</h4>
              </div>
              <p className="text-xs text-gray-500">
                大纲生成后，先确认结构合理再生成内容。生成后逐章节检查，对不理想的章节
                可使用「重新生成」功能单独优化，而非重新生成全部内容。
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                <h4 className="text-sm font-semibold text-gray-900">合规优先</h4>
              </div>
              <p className="text-xs text-gray-500">
                废标条款是硬性门槛。生成完成后务必执行合规检查，确认所有标记为
                「失败」的检查项都已处理后再导出提交。
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-1">常见问题</h2>
        <p className="text-sm text-gray-500 mb-6">
          系统使用的常见问题解答
        </p>
        <div className="space-y-2">
          {faqs.map((faq, idx) => (
            <FaqItem key={idx} {...faq} defaultOpen={idx === 0} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CollapsibleStep({
  icon,
  title,
  desc,
  tips,
  defaultOpen,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tips: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || false);
  return (
    <Card>
      <CardContent className="p-0">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="shrink-0">{icon}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          </div>
          {open ? (
            <ChevronUpIcon className="h-4 w-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-gray-400 shrink-0" />
          )}
        </button>
        {open && (
          <div className="px-4 pb-4 pl-[60px]">
            <p className="text-sm text-gray-600 mb-3">{desc}</p>
            <div className="space-y-1.5">
              {tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangleIcon className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                  <span className="text-xs text-gray-500">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FaqItem({
  q,
  a,
  defaultOpen,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || false);
  return (
    <Card>
      <CardContent className="p-0">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-medium text-gray-900">{q}</span>
          {open ? (
            <ChevronUpIcon className="h-4 w-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-gray-400 shrink-0" />
          )}
        </button>
        {open && (
          <div className="px-4 pb-4">
            <p className="text-sm text-gray-600">{a}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
