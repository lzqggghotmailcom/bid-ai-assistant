'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCwIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';

interface SectionPreviewProps {
  title: string;
  content: string;
  status?: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export default function SectionPreview({
  title,
  content,
  status,
  onRegenerate,
  regenerating,
}: SectionPreviewProps) {
  const [expanded, setExpanded] = useState(true);

  const renderInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let idx = 0;

    while (remaining.length > 0) {
      // Bold: **text** or __text__
      const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
      // Italic: *text* or _text_ (single, not double)
      const italicMatch = remaining.match(/^(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
      // Inline code: `text`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      // Link: [text](url)
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);

      const matches = [
        { m: boldMatch, type: 'bold' },
        { m: italicMatch, type: 'italic' },
        { m: codeMatch, type: 'code' },
        { m: linkMatch, type: 'link' },
      ].filter((x) => x.m && x.m.index === 0) as {
        m: RegExpMatchArray;
        type: string;
      }[];

      if (matches.length > 0) {
        const match = matches[0];
        if (match.type === 'bold') {
          parts.push(<strong key={idx++}>{match.m[2]}</strong>);
          remaining = remaining.slice(match.m[0].length);
        } else if (match.type === 'italic') {
          parts.push(<em key={idx++}>{match.m[1]}</em>);
          remaining = remaining.slice(match.m[0].length);
        } else if (match.type === 'code') {
          parts.push(
            <code key={idx++} className="bg-gray-100 rounded px-1 py-0.5 font-mono text-xs text-red-600">
              {match.m[1]}
            </code>
          );
          remaining = remaining.slice(match.m[0].length);
        } else if (match.type === 'link') {
          parts.push(
            <a
              key={idx++}
              href={match.m[2]}
              className="text-blue-600 underline hover:text-blue-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              {match.m[1]}
            </a>
          );
          remaining = remaining.slice(match.m[0].length);
        }
      } else {
        const nextChar = remaining[0];
        parts.push(<span key={idx++}>{nextChar}</span>);
        remaining = remaining.slice(1);
      }
    }
    return parts;
  };

  const renderContent = (text: string) => {
    const lines = text.split('\n');
    const result: React.ReactNode[] = [];
    let i = 0;
    let inCodeBlock = false;
    let codeLines: string[] = [];

    while (i < lines.length) {
      const line = lines[i];

      // Code block handling
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          result.push(
            <pre
              key={`code-${i}`}
              className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-3 text-xs font-mono"
            >
              <code>{codeLines.join('\n')}</code>
            </pre>
          );
          codeLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        i++;
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        i++;
        continue;
      }

      // Horizontal rule
      if (line.match(/^(-{3,}|\*{3,})$/)) {
        result.push(<hr key={i} className="my-4 border-gray-200" />);
        i++;
        continue;
      }

      // Headings
      if (line.startsWith('### ')) {
        result.push(
          <h4 key={i} className="text-sm font-semibold text-gray-800 mt-3 mb-1">
            {renderInline(line.replace('### ', ''))}
          </h4>
        );
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        result.push(
          <h3 key={i} className="text-base font-semibold text-gray-900 mt-4 mb-2">
            {renderInline(line.replace('## ', ''))}
          </h3>
        );
        i++;
        continue;
      }
      if (line.startsWith('# ')) {
        result.push(
          <h2 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2">
            {renderInline(line.replace('# ', ''))}
          </h2>
        );
        i++;
        continue;
      }

      // Unordered lists
      if (line.match(/^[-*] /)) {
        result.push(
          <li key={i} className="text-sm text-gray-600 ml-4 list-disc">
            {renderInline(line.replace(/^[-*] /, ''))}
          </li>
        );
        i++;
        continue;
      }

      // Ordered lists
      if (line.match(/^\d+\. /)) {
        result.push(
          <li key={i} className="text-sm text-gray-600 ml-4 list-decimal">
            {renderInline(line.replace(/^\d+\. /, ''))}
          </li>
        );
        i++;
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        result.push(<div key={i} className="h-2" />);
        i++;
        continue;
      }

      // Regular paragraph
      result.push(
        <p key={i} className="text-sm text-gray-600 leading-relaxed">
          {renderInline(line)}
        </p>
      );
      i++;
    }

    // Close any unclosed code block
    if (inCodeBlock && codeLines.length > 0) {
      result.push(
        <pre
          key="code-tail"
          className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-3 text-xs font-mono"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
    }

    return result;
  };

  if (!content) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-sm text-gray-400">
          暂未生成内容
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 hover:text-gray-700"
            >
              {expanded ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
              {title}
            </button>
          </CardTitle>
          {onRegenerate && status === 'done' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onRegenerate}
              disabled={regenerating}
              className="text-xs text-gray-500"
            >
              <RefreshCwIcon
                className={`h-3 w-3 mr-1 ${regenerating ? 'animate-spin' : ''}`}
              />
              {regenerating ? '重新生成中...' : '重新生成'}
            </Button>
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="prose prose-sm max-w-none text-gray-700">
            {renderContent(content)}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
