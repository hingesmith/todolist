import { useState, useEffect } from 'react'
import { storage } from '../storage/local'
import { Memo } from '../types/memo'
import { Todo } from '../types/todo'
import { Button } from '../components/ui/Button'
import { PageState } from '../App'
import {
  FilePlus, FileText, ClipboardList, Trash2, Loader2, AlertCircle
} from 'lucide-react'
import { generateDailyReportContent, buildDailyReportTemplate } from '../lib/ai'

interface MemoListPageProps {
  onNavigate: (page: PageState) => void
}

export default function MemoListPage({ onNavigate }: MemoListPageProps) {
  const [memos, setMemos]       = useState<Memo[]>([])
  const [todos, setTodos]       = useState<Todo[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    setMemos(storage.getMemos().slice().sort(
      (a, b) => new Date(b.updated_at ?? b.created_at).getTime()
               - new Date(a.updated_at ?? a.created_at).getTime()
    ))
    setTodos(storage.getTodos())
  }, [])

  const handleDelete = (id: string) => {
    if (!confirm('このメモを削除しますか？')) return
    storage.deleteMemo(id)
    setMemos(prev => prev.filter(m => m.id !== id))
  }

  const handleGenerateDailyReport = async () => {
    setError(null)
    setIsGenerating(true)
    const today = new Date().toISOString().slice(0, 10)
    const title = `日報 - ${today}`

    try {
      const apiKey  = storage.getApiKey()
      const settings = storage.getAiSettings()
      const canUseAi =
        (settings.provider === 'gemini' && !!apiKey) ||
        (settings.provider === 'local' && !!settings.localEndpoint)

      const content = canUseAi
        ? await generateDailyReportContent(apiKey, settings, todos, today)
        : buildDailyReportTemplate(todos, today)

      onNavigate({
        type: 'memo-edit',
        draft: { title, content, type: 'daily_report' }
      })
    } catch (err) {
      // AI failed → fall back to template
      const content = buildDailyReportTemplate(todos, today)
      const title = `日報 - ${today}`
      setError(err instanceof Error ? `AI生成に失敗しました（テンプレートを使用）: ${err.message}` : '不明なエラー')
      onNavigate({
        type: 'memo-edit',
        draft: { title, content, type: 'daily_report' }
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const typeLabel = (type: Memo['type']) =>
    type === 'daily_report' ? '日報' : 'ノート'

  const typeBadgeClass = (type: Memo['type']) =>
    type === 'daily_report'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Memo</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">メモの作成・管理、タスクとの連携</p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <Button
            variant="secondary"
            onClick={handleGenerateDailyReport}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating
              ? <><Loader2 size={15} className="animate-spin" /> 生成中...</>
              : <><ClipboardList size={15} /> 今日の日報を生成</>
            }
          </Button>
          <Button
            onClick={() => onNavigate({ type: 'memo-edit' })}
            className="gap-2"
          >
            <FilePlus size={15} /> 新規メモ
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Memo list */}
      {memos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-600 gap-3">
          <FileText size={40} strokeWidth={1.2} />
          <p className="text-sm">メモがありません。新規メモを作成してください。</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {memos.map(memo => (
            <div
              key={memo.id}
              className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4"
              onClick={() => onNavigate({ type: 'memo-edit', id: memo.id })}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadgeClass(memo.type)}`}>
                      {typeLabel(memo.type)}
                    </span>
                    <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 truncate">
                      {memo.title || '無題'}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    {memo.content.replace(/^#+\s*/gm, '').trim() || '（内容なし）'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(memo.updated_at ?? memo.created_at)}
                    {memo.linked_task_ids && memo.linked_task_ids.length > 0 && (
                      <span className="ml-2 text-indigo-400">
                        · タスク {memo.linked_task_ids.length}件
                      </span>
                    )}
                  </p>
                </div>
                <button
                  className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 dark:hover:text-red-400 p-1 shrink-0"
                  onClick={e => { e.stopPropagation(); handleDelete(memo.id) }}
                  aria-label="削除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
