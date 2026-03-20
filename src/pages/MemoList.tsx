import { useState, useEffect } from 'react'
import { storage } from '../storage/local'
import { Memo } from '../types/memo'
import { Todo } from '../types/todo'
import { Button } from '../components/ui/Button'
import { PageState } from '../types/navigation'
import {
  FilePlus, FileText, Folder, ClipboardList, Trash2, Loader2, AlertCircle,
  Home, ChevronRight, FolderPlus
} from 'lucide-react'
import { generateDailyReportContent, buildDailyReportTemplate } from '../lib/ai'

interface MemoListPageProps {
  folder?: string
  onNavigate: (page: PageState) => void
}

/** フォルダパスから直下のサブフォルダ名を抽出する */
function getImmediateSubFolders(memos: Memo[], currentFolder: string): string[] {
  const subFolders = new Set<string>()
  memos.forEach(m => {
    const f = m.folder ?? ''
    if (currentFolder === '') {
      // ルート: folder が設定されているメモの第1セグメントを収集
      if (f) subFolders.add(f.split('/')[0])
    } else {
      const prefix = currentFolder + '/'
      if (f.startsWith(prefix)) {
        const remaining = f.slice(prefix.length)
        if (remaining) subFolders.add(remaining.split('/')[0])
      }
    }
  })
  return Array.from(subFolders).sort()
}

/** 指定フォルダ直下のメモのみ返す（サブフォルダ内のメモは含まない） */
function getMemosInFolder(memos: Memo[], folder: string): Memo[] {
  return memos.filter(m => (m.folder ?? '') === folder)
}

/** フォルダパスをパンくず配列に変換する */
function getBreadcrumbs(folder: string): { label: string; path: string }[] {
  if (!folder) return []
  const parts = folder.split('/')
  return parts.map((part, i) => ({
    label: part,
    path: parts.slice(0, i + 1).join('/')
  }))
}

export default function MemoListPage({ folder, onNavigate }: MemoListPageProps) {
  const currentFolder = folder ?? ''
  const [memos, setMemos]       = useState<Memo[]>([])
  const [todos, setTodos]       = useState<Todo[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [newFolderInput, setNewFolderInput] = useState('')
  const [showNewFolder, setShowNewFolder]   = useState(false)

  useEffect(() => {
    setMemos(storage.getMemos().slice().sort(
      (a, b) => new Date(b.updated_at ?? b.created_at).getTime()
               - new Date(a.updated_at ?? a.created_at).getTime()
    ))
    setTodos(storage.getTodos())
  }, [])

  const subFolders   = getImmediateSubFolders(memos, currentFolder)
  const currentMemos = getMemosInFolder(memos, currentFolder)
  const breadcrumbs  = getBreadcrumbs(currentFolder)

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
      const apiKey   = storage.getApiKey()
      const settings = storage.getAiSettings()
      const canUseAi =
        (settings.provider === 'gemini' && !!apiKey) ||
        (settings.provider === 'local' && !!settings.localEndpoint)

      const content = canUseAi
        ? await generateDailyReportContent(apiKey, settings, todos, today)
        : buildDailyReportTemplate(todos, today)

      onNavigate({
        type: 'memo-edit',
        folder: currentFolder || undefined,
        draft: { title, content, type: 'daily_report' }
      })
    } catch (err) {
      const content = buildDailyReportTemplate(todos, today)
      setError(err instanceof Error ? `AI生成に失敗しました（テンプレートを使用）: ${err.message}` : '不明なエラー')
      onNavigate({
        type: 'memo-edit',
        folder: currentFolder || undefined,
        draft: { title, content, type: 'daily_report' }
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateFolder = () => {
    const name = newFolderInput.trim()
    if (!name) return
    // フォルダはメモが入ることで実体化する。ここではそのフォルダにいる新規メモ作成画面へ遷移する。
    const folderPath = currentFolder ? `${currentFolder}/${name}` : name
    setShowNewFolder(false)
    setNewFolderInput('')
    onNavigate({ type: 'memo-edit', folder: folderPath })
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
    <div className="space-y-6">
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
            variant="secondary"
            onClick={() => setShowNewFolder(v => !v)}
            className="gap-2"
          >
            <FolderPlus size={15} /> 新規フォルダ
          </Button>
          <Button
            onClick={() => onNavigate({ type: 'memo-edit', folder: currentFolder || undefined })}
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

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
        <button
          onClick={() => onNavigate({ type: 'memo' })}
          className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <Home size={14} />
          <span>Memo</span>
        </button>
        {breadcrumbs.map(({ label, path }) => (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight size={13} className="text-gray-300 dark:text-gray-600" />
            <button
              onClick={() => onNavigate({ type: 'memo', folder: path })}
              className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-medium"
            >
              {label}
            </button>
          </span>
        ))}
      </nav>

      {/* New folder input */}
      {showNewFolder && (
        <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Folder size={16} className="text-amber-500 shrink-0" />
          <input
            autoFocus
            value={newFolderInput}
            onChange={e => setNewFolderInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreateFolder()
              if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderInput('') }
            }}
            placeholder="フォルダ名を入力..."
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600"
          />
          <Button size="sm" onClick={handleCreateFolder} className="h-7 text-xs px-3">作成</Button>
          <button
            onClick={() => { setShowNewFolder(false); setNewFolderInput('') }}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs"
          >
            キャンセル
          </button>
        </div>
      )}

      {/* Sub-folders */}
      {subFolders.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">フォルダ</p>
          <div className="flex flex-col gap-1">
            {subFolders.map(name => {
              const folderPath = currentFolder ? `${currentFolder}/${name}` : name
              const folderMemoCount = memos.filter(m => {
                const f = m.folder ?? ''
                return f === folderPath || f.startsWith(folderPath + '/')
              }).length
              return (
                <button
                  key={name}
                  onClick={() => onNavigate({ type: 'memo', folder: folderPath })}
                  className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow text-left group"
                >
                  <Folder size={18} className="text-amber-500 shrink-0" />
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{folderMemoCount}件</span>
                  <ChevronRight size={15} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Memos in current folder */}
      {currentMemos.length === 0 && subFolders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-600 gap-3">
          <FileText size={40} strokeWidth={1.2} />
          <p className="text-sm">メモがありません。新規メモを作成してください。</p>
        </div>
      ) : currentMemos.length > 0 ? (
        <div className="flex flex-col gap-2">
          {subFolders.length > 0 && (
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">メモ</p>
          )}
          <div className="flex flex-col gap-3">
            {currentMemos.map(memo => (
              <div
                key={memo.id}
                className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4"
                onClick={() => onNavigate({ type: 'memo-edit', id: memo.id, folder: currentFolder || undefined })}
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
        </div>
      ) : null}
    </div>
  )
}
