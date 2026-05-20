'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { usePlan } from '@/hooks/useCredits';
import { useQueryClient } from '@tanstack/react-query';
import { CoinsIcon, CheckCircleIcon, Loader2Icon, InfinityIcon, CalendarIcon } from 'lucide-react';
import api from '@/lib/api';

interface PlanDef {
  name: string;
  price_yuan: number;
  projects: number;
  validity_days: number;
}

interface PricingData {
  plans: Record<string, PlanDef>;
  free_trial_projects: number;
}

interface OrderResult {
  order_id: string;
  code_url: string;
  amount: number;
  plan_id: string;
  projects: number;
}

const PLAN_ICONS: Record<string, string> = {
  single: '📋',
  quarterly: '📦',
  annual: '🚀',
  enterprise: '🏢',
};

function formatValidity(days: number) {
  if (days >= 365) return `${days / 365}年`;
  if (days >= 30) return `${days / 30}个月`;
  return `${days}天`;
}

export default function PurchaseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { refetch: refetchPlan } = usePlan();
  const queryClient = useQueryClient();

  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (open) {
      api.get('/pricing').then(({ data }) => setPricing(data)).catch(() => {});
    } else {
      setSelectedPlan(null);
      setOrder(null);
      setPaid(false);
    }
  }, [open]);

  useEffect(() => {
    if (!order || paid) return;
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(`/orders/${order.order_id}/status`);
        if (data.status === 'paid') {
          setPaid(true);
          refetchPlan();
          queryClient.invalidateQueries({ queryKey: ['plan'] });
          toast({ title: '购买成功', description: `${order.projects} 个项目额度已到账`, type: 'success' });
        }
      } catch {}
    }, 2000);
    return () => clearInterval(timer);
  }, [order, paid, refetchPlan, queryClient, toast]);

  const handleCreateOrder = useCallback(async (planId: string) => {
    setSelectedPlan(planId);
    setCreating(true);
    try {
      const { data } = await api.post('/orders/create', { plan_id: planId });
      setOrder(data);
    } catch (err: any) {
      toast({
        title: '创建订单失败',
        description: err?.response?.data?.detail || '支付服务暂不可用',
        type: 'error',
      });
      setSelectedPlan(null);
    } finally {
      setCreating(false);
    }
  }, [toast]);

  const handleClose = useCallback(() => {
    if (paid) refetchPlan();
    onOpenChange(false);
  }, [paid, onOpenChange, refetchPlan]);

  const qrUrl = order
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(order.code_url)}`
    : null;

  const plan = pricing?.plans[selectedPlan || ''];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CoinsIcon className="h-5 w-5 text-amber-500" />
            购买套餐
          </DialogTitle>
        </DialogHeader>

        {paid ? (
          <div className="text-center py-8">
            <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-base font-medium text-gray-900">购买成功</p>
            <p className="text-sm text-gray-500 mt-1">
              {plan?.name || ''} · {order?.projects || ''} 个项目额度已到账
            </p>
            <Button className="mt-4" onClick={handleClose}>完成</Button>
          </div>
        ) : order ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-1">请使用微信或支付宝扫码支付</p>
            <p className="text-lg font-bold text-gray-900 mb-4">
              ¥{(order.amount / 100).toFixed(0)}
            </p>
            {qrUrl && (
              <img
                src={qrUrl}
                alt="支付二维码"
                className="mx-auto rounded-lg border"
                width={220}
                height={220}
              />
            )}
            <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
              <Loader2Icon className="h-3 w-3 animate-spin" />
              等待支付中...
            </p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setOrder(null); setSelectedPlan(null); }}>
              返回选择
            </Button>
          </div>
        ) : (
          <>
            {/* Free Trial Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              每个新用户可免费完成 1 个完整标书，体验全流程。
            </div>

            {/* Plan Cards */}
            <div className="space-y-2">
              {pricing ? (
                Object.entries(pricing.plans).map(([id, p]) => (
                  <button
                    key={id}
                    onClick={() => handleCreateOrder(id)}
                    disabled={creating}
                    className={`w-full flex items-center p-4 rounded-lg border-2 transition-colors text-left ${
                      id === 'annual'
                        ? 'border-blue-300 bg-blue-50/50 hover:bg-blue-50'
                        : id === 'enterprise'
                        ? 'border-purple-300 bg-purple-50/50 hover:bg-purple-50'
                        : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xl">{PLAN_ICONS[id] || '📋'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                          {id === 'annual' && (
                            <Badge className="text-xs bg-blue-600 text-white">推荐</Badge>
                          )}
                          {id === 'enterprise' && (
                            <Badge className="text-xs bg-purple-600 text-white">旗舰</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <InfinityIcon className="h-3 w-3" />
                            {p.projects} 个项目
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-0.5">
                            <CalendarIcon className="h-3 w-3" />
                            {formatValidity(p.validity_days)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-gray-900">¥{p.price_yuan}</p>
                      <p className="text-xs text-gray-400">
                        ¥{(p.price_yuan / p.projects).toFixed(0)}/项目
                      </p>
                      {selectedPlan === id && creating && (
                        <Loader2Icon className="h-4 w-4 animate-spin text-blue-500 ml-auto mt-1" />
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-4">
                  <Loader2Icon className="h-6 w-6 animate-spin text-gray-300 mx-auto" />
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
