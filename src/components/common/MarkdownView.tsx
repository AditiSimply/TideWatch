import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface MarkdownViewProps {
  content: string
  className?: string
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  // Split lines and parse blocks
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []

  let inCodeBlock = false
  let codeLanguage = ''
  let codeBuffer: string[] = []
  let blockIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // Closing code block
        const codeText = codeBuffer.join('\n')
        const currentIdx = blockIndex++
        blocks.push(
          <div key={`code-${currentIdx}`} className="relative my-3 rounded-lg overflow-hidden border border-[#D5E3DC] bg-[#F4F8F5]">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#E7F0EB] text-[11px] font-mono text-[#405B50] border-b border-[#D5E3DC]">
              <span>{codeLanguage || 'text'}</span>
              <button
                onClick={() => copyToClipboard(codeText, currentIdx)}
                className="inline-flex items-center gap-1 text-[11px] text-[#0F3D2E] hover:text-[#10B981] transition-colors"
                title="Copy code"
              >
                {copiedIndex === currentIdx ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 text-xs font-mono text-[#0F3D2E] overflow-x-auto whitespace-pre leading-relaxed">
              <code>{codeText}</code>
            </pre>
          </div>
        )
        inCodeBlock = false
        codeBuffer = []
      } else {
        // Opening code block
        inCodeBlock = true
        codeLanguage = line.replace('```', '').trim()
        codeBuffer = []
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    // Headers
    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={i} className="font-display text-base font-semibold text-[#0F3D2E] mt-4 mb-2 tracking-tight">
          {renderInline(line.replace('### ', ''))}
        </h3>
      )
    } else if (line.startsWith('#### ')) {
      blocks.push(
        <h4 key={i} className="text-sm font-semibold text-[#0F3D2E] uppercase tracking-wider mt-3 mb-1.5">
          {renderInline(line.replace('#### ', ''))}
        </h4>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push(
        <li key={i} className="text-sm text-[#385145] ml-4 list-disc mb-1 leading-relaxed">
          {renderInline(line.substring(2))}
        </li>
      )
    } else if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, '')
      blocks.push(
        <li key={i} className="text-sm text-[#385145] ml-4 list-decimal mb-1 leading-relaxed">
          {renderInline(text)}
        </li>
      )
    } else if (line.trim().length > 0) {
      blocks.push(
        <p key={i} className="text-sm text-[#385145] leading-relaxed mb-2">
          {renderInline(line)}
        </p>
      )
    }
  }

  // Handle unclosed code block if streaming
  if (inCodeBlock && codeBuffer.length > 0) {
    const codeText = codeBuffer.join('\n')
    blocks.push(
      <div key="unclosed-code" className="my-2 rounded-lg bg-[#F4F8F5] border border-[#D5E3DC] p-3 font-mono text-xs text-[#0F3D2E]">
        <code>{codeText}</code>
      </div>
    )
  }

  return <div className={`space-y-1 ${className}`}>{blocks}</div>
}

function renderInline(text: string): React.ReactNode {
  // Support bold: **text**
  // Support inline code: `code`
  const parts: React.ReactNode[] = []
  const regex = /(\*\*.*?\*\*|`.*?`)/g
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-[#0F3D2E]">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-[#EBF3EF] border border-[#D5E3DC] text-xs font-mono text-[#0F3D2E]"
        >
          {token.slice(1, -1)}
        </code>
      )
    }
    lastIdx = regex.lastIndex
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx))
  }

  return parts
}
