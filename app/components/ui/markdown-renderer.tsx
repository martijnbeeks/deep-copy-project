"use client"

interface MarkdownRendererProps {
  content: string
  className?: string
}

export const MarkdownRenderer = ({ content, className = "" }: MarkdownRendererProps) => {
  const formatMarkdown = (text: string) => {
    // Convert markdown-like formatting to HTML
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-foreground">$1</em>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-foreground mb-3 mt-4">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-foreground mb-4 mt-6">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-foreground mb-4 mt-6">$1</h1>')
      .replace(/^\* (.*$)/gim, '<li class="flex items-start gap-2 mb-2"><span class="text-primary font-bold">•</span><span>$1</span></li>')
      .replace(/^- (.*$)/gim, '<li class="flex items-start gap-2 mb-2"><span class="text-accent font-bold">-</span><span>$1</span></li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="flex items-start gap-2 mb-2"><span class="text-primary font-bold">1.</span><span>$1</span></li>')
      .replace(/\n\n/g, '</p><p class="text-sm text-muted-foreground leading-relaxed mb-4">')
      .replace(/\n/g, '<br>')
  }

  return (
    <div 
      className={`prose prose-sm max-w-none text-muted-foreground ${className}`}
      dangerouslySetInnerHTML={{ 
        __html: `<p class="text-sm text-muted-foreground leading-relaxed mb-4">${formatMarkdown(content)}</p>` 
      }}
    />
  )
}
