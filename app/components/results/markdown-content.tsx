"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from "@/lib/utils"

interface MarkdownContentProps {
    content: string
    className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
    return (
        <div className={cn("prose prose-gray dark:prose-invert max-w-none", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-xl font-semibold text-foreground mb-3 mt-5">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-lg font-medium text-foreground mb-2 mt-4">
                            {children}
                        </h3>
                    ),
                    p: ({ children }) => (
                        <p className="text-foreground mb-4 leading-relaxed">
                            {children}
                        </p>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-4 space-y-1 text-foreground">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-4 space-y-1 text-foreground">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-foreground">{children}</li>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-primary/20 pl-4 py-2 mb-4 bg-muted/30 rounded-r-lg">
                            <div className="text-muted-foreground italic">{children}</div>
                        </blockquote>
                    ),
                    code: ({ children, className }) => {
                        const isInline = !className
                        if (isInline) {
                            return (
                                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
                                    {children}
                                </code>
                            )
                        }
                        return (
                            <code className={cn("block bg-muted p-4 rounded-lg text-sm font-mono text-foreground overflow-x-auto", className)}>
                                {children}
                            </code>
                        )
                    },
                    pre: ({ children }) => (
                        <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4">
                            {children}
                        </pre>
                    ),
                    table: ({ children }) => (
                        <div className="overflow-x-auto mb-4">
                            <table className="min-w-full border border-border rounded-lg">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-muted">
                            {children}
                        </thead>
                    ),
                    th: ({ children }) => (
                        <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="border border-border px-4 py-2 text-foreground">
                            {children}
                        </td>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-foreground">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-foreground">{children}</em>
                    ),
                    hr: () => (
                        <hr className="border-border my-6" />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
