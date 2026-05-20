'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Breadcrumb from '@/components/Breadcrumb';
import PurchaseDialog from '@/components/PurchaseDialog';
import { usePlan } from '@/hooks/useCredits';
import {
  CoinsIcon,
  CheckIcon,
  InfinityIcon,
  CalendarIcon,
  ArrowRightIcon,
} from 'lucide-react';

const PLAN_LIST: { id: string; label: string; price: number; projects: number; validity: string; popular: boolean; icon: string; color: string }[] = [
  { id: 'single',     label: '单项目',   price: 299,  projects: 1,  validity: '30天',  popular: false, icon: '📋', color: 'border-gray-200' },
  { id: 'quarterly',  label: '季度版',   price: 899,  projects: 5,  validity: '90天',  popular: false, icon: '📦', color: 'border-gray-200' },
  { id: 'annual',     label: '年度版',   price: 2999, projects: 20, validity: '1年',    popular: true,  icon: '🚀', color: 'border-blue-300 ring-2 ring-blue-100' },
  { id: 'enterprise', label: '企业版',   price: 9999, projects: 50, validity: '1年',    popular: false, icon: '🏢', color: 'border-purple-300 ring-2 ring-purple-100' },
];

const FEATURES = [
  '无限次生成 + 修改 + 下载',
  '企业知识库智能引用',
  '合规检查 & 评分分析',
  'Word 文档一键导出',
];

const ENTERPRISE_EXTRA = [
  '5 个子账号',
  'API 开放接入',
  '专属知识库隔离',
  '优先技术支持',
];

export default function PricingPage() {
  const { plan, projectsRemaining } = usePlan();
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  return (
    <div>
      <Breadcrumb items={[{ label: '投标管理', href: '/' }, { label: '套餐定价' }]} />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">套餐定价</h1>
        <p className="text-sm text-gray-500">按项目购买，灵活可控。每项目内无限次生成和下载。</p>
      </div>

      {/* Current Status */}
      <Card className="mb-8 border-blue-200 bg-gradient-to-r from-blue-50 to-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                当前套餐：<span className="font-medium text-gray-900">{plan === 'free' ? '免费试用' : PLAN_LIST.find(p => p.id === plan)?.label || plan}</span>
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                剩余 {projectsRemaining === -1 ? '无限' : projectsRemaining} 个项目
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <CoinsIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {PLAN_LIST.map((p) => (
          <Card key={p.id} className={`relative ${p.color} ${p.popular ? 'shadow-md' : ''}`}>
            {p.popular && (
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs">
                推荐
              </Badge>
            )}
            <CardContent className="p-6 text-center">
              <span className="text-2xl">{p.icon}</span>
              <p className="text-sm font-semibold text-gray-900 mt-2">{p.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ¥{p.price}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {p.projects} 个项目 · {p.validity}
              </p>
              <p className="text-xs text-gray-400">
                ¥{(p.price / p.projects).toFixed(0)}/项目
              </p>
              <Button
                className="mt-4 w-full"
                variant={p.popular ? 'default' : 'outline'}
                onClick={() => setPurchaseOpen(true)}
              >
                立即购买
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Feature Comparison */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">所有套餐均包含</h2>
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm text-gray-600">{f}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enterprise */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">企业版专属</h2>
      <Card className="mb-8 border-purple-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ENTERPRISE_EXTRA.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-purple-500 shrink-0" />
                <span className="text-sm text-gray-600">{f}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">常见问题</h2>
      <div className="space-y-3 mb-8">
        {[
          { q: '什么是"一个项目"？', a: '一次完整的标书制作流程：上传招标文件 → 解析 → 生成大纲 → 生成内容 → 导出。购买项目后，可对该标书无限次重新生成和修改。' },
          { q: '用不完的项目会过期吗？', a: '会的。单项目有效期 30 天，季度版 90 天，年度版和企业版 365 天。请在有效期内使用。' },
          { q: '可以升级套餐吗？', a: '可以。新购买的套餐额度会累加到现有剩余额度上，有效期按最新购买的套餐计算。' },
          { q: '支持对公转账和发票吗？', a: '企业版支持对公转账和开具增值税专用发票。请购买企业版后联系客服。' },
        ].map((faq, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-gray-900">{faq.q}</p>
              <p className="text-sm text-gray-500 mt-1">{faq.a}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center py-8 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-600 mb-3">准备开始制作标书？</p>
        <Button onClick={() => setPurchaseOpen(true)} size="lg">
          选择套餐
          <ArrowRightIcon className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <PurchaseDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} />
    </div>
  );
}
