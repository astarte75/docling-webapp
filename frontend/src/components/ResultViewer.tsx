import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface ResultViewerProps {
  markdown: string;
  filename: string;
}

function downloadMarkdown(content: string, filename: string) {
  const baseName = filename.replace(/\.[^.]+$/, '');
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.md`;
  a.click();
  URL.revokeObjectURL(url); // immediate cleanup to prevent memory leak
}

export function ResultViewer({ markdown, filename }: ResultViewerProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Tabs defaultValue="preview" className="flex flex-col">
      {/* Sticky action bar — stays visible when scrolling long results */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background px-4 py-3">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => downloadMarkdown(markdown, filename)}>
            Download .md
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </Button>
        </div>
      </div>

      {/* Scrollable preview area */}
      <TabsContent value="preview" className="mt-0 p-4">
        {/* v10 BREAKING CHANGE: wrap in div — className prop removed from <Markdown> */}
        <div className="prose prose-sm max-w-none">
          <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
        </div>
      </TabsContent>

      <TabsContent value="raw" className="mt-0 p-4">
        <pre className="overflow-auto rounded-md bg-muted p-4 font-mono text-sm whitespace-pre-wrap">
          {markdown}
        </pre>
      </TabsContent>
    </Tabs>
  );
}
