import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SourceCitation({ sources, confidence }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  if (!sources || sources.length === 0) return null

  const confidenceConfig = {
    high:   { color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', label: 'High confidence' },
    medium: { color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  border: 'border-yellow-400/30',  label: 'Medium confidence' },
    low:    { color: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/30',     label: 'Low confidence' },
  }

  const conf = confidenceConfig[confidence] || confidenceConfig.medium

  const openInReader = (source) => {
    if (!source.document_id) return
    navigate(`/reader/${source.document_id}`, { state: { page: source.page_num || 1 } })
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${conf.bg} ${conf.color} ${conf.border}`}>
          {conf.label}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {sources.length} source{sources.length > 1 ? 's' : ''} {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 flex flex-col gap-2">
          {sources.map((source, i) => (
            <div
              key={i}
              className={`bg-[#222230] border border-[#334155] rounded-lg p-2.5 ${
                source.document_id ? 'cursor-pointer hover:border-[#7c6af7]/50 transition-colors' : ''
              }`}
              onClick={() => source.document_id && openInReader(source)}
              role={source.document_id ? 'button' : undefined}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs">📄</span>
                <span className="text-xs font-medium text-[#7c6af7] truncate">
                  {source.document_name}
                </span>
                <span className="text-xs text-gray-500 ml-auto flex-shrink-0">
                  Page {source.page_num}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                {source.text_preview}
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  Relevance: {Math.round(source.similarity_score * 100)}%
                </span>
                {source.document_id && (
                  <span className="text-xs text-[#7c6af7]">Open in Reader →</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
