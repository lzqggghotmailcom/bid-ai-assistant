'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileTextIcon, Loader2Icon } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password || !companyName) {
      setError('请填写所有必填字段');
      return;
    }
    if (password.length < 6) {
      setError('密码至少6个字符');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, companyName);
      router.push('/');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message = detail || (err instanceof Error ? err.message : '注册失败，请稍后重试');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 mb-4">
            <FileTextIcon className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI投标助手</h1>
          <p className="text-sm text-gray-500 mt-1">创建您的账号</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>注册</CardTitle>
            <CardDescription>填写以下信息创建新账号</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">公司名称</Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="输入公司名称"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="至少6个字符"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                    注册中...
                  </>
                ) : (
                  '注册'
                )}
              </Button>
            </form>
            <p className="text-sm text-center text-gray-500 mt-4">
              已有账号？{' '}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                登录
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
