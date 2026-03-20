import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { storage } from '../storage/local'
import { Memo, MemoType } from '../types/memo'
import { Todo } from '../types/todo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PageState } from '../App'
import { extractTasksFromMemo, AiOperation } from '../lib/ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Save, Trash2, Eye, Edit2, Sparkles, Loader2,
  Check, Plus, Edit3, AlertCircle, ArrowLeft, ChevronDown, Folder
} from 'lucide-react'

interface MemoEditPageProps {
  id?: string
  folder?: string
  draft?: { title: string; content: string; type: MemoType }
  onNavigate: (page: PageState) => void
}

export default function MemoEditPage({ id, folder, draft, onNavigate }: MemoEditPageProps) {
  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [type,    setType]    = useState<MemoType>('note')
  const [memoFolder, setMemoFolder] = useState(folder ?? '')
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

  const [isSaving,   setIsSaving]   = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const [pendingOps, setPendingOps]   = useState<AiOperation[]>([])
  const [aiMessage,  setAiMessage]   = useState<string | null>(null)
  const [appliedMsg, setAppliedMsg]  = useState<string | null>(null)

  const [currentTodos, setCurrentTodos] = useState<Todo[]>([])
  const savedMemoId = useRef<string | null>(id ?? null)

  const aiSettings = storage.getAiSettings()
  const apiKey     = storage.getApiKey()
  const canUseAi   =
    (aiSettings.provider === 'gemini' && !!apiKey) ||
    (aiSettings.provider === 'local' && !!aiSettings.localEndpoint)

  useEffect(() => {
    setCurrentTodos(storage.getTodos())

    if (id) {
      const memo = storage.getMemo(id)
      if (memo) {
        setTitle(memo.title)
        setContent(memo.content)
        setType(memo.type)
        setMemoFolder(memo.folder ?? '')
      }
    } else if (draft) {
      setTitle(draft.title)
      setContent(draft.content)
      setType(draft.type)
    }
  }, [id, draft])

  const saveMemo = (): Memo => {
    const now = new Date().toISOString()
    if (savedMemoId.current) {
      const existing = storage.getMemo(savedMemoId.current)
      const updated: Memo = {
        ...(existing ?? { id: savedMemoId.current, created_at: now }),
        title: title || '無題',
        content,
        type,
        folder: memoFolder || undefined,
        updated_at: now,
      }
      storage.updateMemo(updated)
      return updated
    } else {
      const newId = uuidv4()
      savedMemoId.current = newId
      const memo: Memo = {
        id: newId,
        title: title || '無題',
        content,
        type,
        folder: memoFolder || undefined,
        created_at: now,
        updated_at: now,
      }
      storage.addMemo(memo)
      return memo
    }
  }

  const handleSave = () => {
    setIsSaving(true)
    setError(null)
    try {
      saveMemo()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const backToList = () => onNavigate({ type: 'memo', folder: memoFolder || undefined })

  const handleDelete = () => {
    if (!savedMemoId.current) { backToList(); return }
    if (!confirm('このメモを削除しますか？')) return
    storage.deleteMemo(savedMemoId.current)
    backToList()
  }

  const handleExtractTasks = async () => {
    if (!content.trim()) return
    setIsAiLoading(true)
    setError(null)
    setPendingOps([])
    setAiMessage(null)
    try {
      const result = await extractTasksFromMemo(
        apiKey, aiSettings, title || '無題', content, currentTodos
      )
      setPendingOps(result.operations)
      setAiMessage(result.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI処理に失敗しました')
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleApplyOps = () => {
    if (pendingOps.length === 0) return
    let added = 0, updated = 0, deleted = 0
    const newTaskIds: string[] = []

    pendingOps.forEach(op => {
      if (op.type === 'add') {
        const newId = uuidv4()
        newTaskIds.push(newId)
        storage.addTodos([{
          ...op.todo,
          id: newId,
          created_at: new Date().toISOString()
        } as Todo])
        added++
      } else if (op.type === 'update') {
        const ex = storage.getTodo(op.id)
        if (ex) { storage.updateTodo({ ...ex, ...op.todo }); updated++ }
      } else if (op.type === 'delete') {
        storage.deleteTodo(op.id); deleted++
      }
    })

    // Link created task IDs to this memo
    if (newTaskIds.length > 0 && savedMemoId.current) {
      const saved = storage.getMemo(savedMemoId.current)
      if (saved) {
        storage.updateMemo({
          ...saved,
          linked_task_ids: [...(saved.linked_task_ids ?? []), ...newTaskIds]
        })
      } else {
        // Memo not saved yet — save it first, then link
        const memo = saveMemo()
        storage.updateMemo({ ...memo, linked_task_ids: newTaskIds })
      }
    }

    setCurrentTodos(storage.getTodos())
    setPendingOps([])
    setAiMessage(null)
    setAppliedMsg(`タスクを適用しました（追加 ${added}件 / 更新 ${updated}件 / 削除 ${deleted}件）`)
    setTimeout(() => setAppliedMsg(null), 4000)
  }

  const textareaClass = `
    w-full h-full min-h-[400px] resize-none bg-transparent border border-gray-300 dark:border-gray-600
    rounded-lg p-4 text-sm text-gray-900 dark:text-gray-100 font-mono leading-relaxed
    focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500
    placeholder:text-gray-400 dark:placeholder:text-gray-600
  `

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={backToList}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft size={16} /> {memoFolder ? memoFolder.split('/').pop() : 'Memo'}
        </button>

        <div className="flex items-center gap-2">
          {/* Type toggle */}
          <div className="relative">
            <select
              value={type}
              onChange={e => setType(e.target.value as MemoType)}
              className="appearance-none text-xs font-medium px-3 py-1.5 pr-7 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="note">ノート</option>
              <option value="daily_report">日報</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
          </div>

          {/* Mobile: Edit/Preview tab */}
          <div className="flex sm:hidden rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
            <button
              onClick={() => setMobileTab('edit')}
              className={`flex items-center gap-1 px-3 py-1.5 ${mobileTab === 'edit' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <Edit2 size={12} /> 編集
            </button>
            <button
              onClick={() => setMobileTab('preview')}
              className={`flex items-center gap-1 px-3 py-1.5 ${mobileTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <Eye size={12} /> プレビュー
            </button>
          </div>

          {/* Save & Delete */}
          {savedMemoId.current && (
            <button
              onClick={handleDelete}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-1.5"
              aria-label="削除"
            >
              <Trash2 size={16} />
            </button>
          )}
          <Button onClick={handleSave} disabled={isSaving} className="gap-2 h-8 px-3 text-sm">
            {saved ? <><Check size={14} /> 保存済み</> : <><Save size={14} /> 保存</>}
          </Button>
        </div>
      </div>

      {/* Title */}
      <Input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="タイトル"
        className="text-lg font-semibold"
      />

      {/* Folder path */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Folder size={14} className="text-amber-500 shrink-0" />
        <input
          value={memoFolder}
          onChange={e => setMemoFolder(e.target.value)}
          placeholder="フォルダパス（例: work/projects）"
          className="flex-1 bg-transparent text-sm text-gray-600 dark:text-gray-400 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600 border-b border-transparent focus:border-gray-300 dark:focus:border-gray-600 transition-colors"
        />
      </div>

      {/* Editor area */}
      <div className="flex gap-4" style={{ minHeight: '400px' }}>
        {/* Textarea — hidden on mobile when preview tab active */}
        <div className={`flex-1 ${mobileTab === 'preview' ? 'hidden sm:flex' : 'flex'} flex-col`}>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Markdown で記述できます..."
            className={textareaClass}
          />
        </div>

        {/* Preview — hidden on mobile when edit tab active */}
        <div className={`flex-1 ${mobileTab === 'edit' ? 'hidden sm:block' : 'block'} min-h-[400px] border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-y-auto bg-white dark:bg-gray-800`}>
          {content.trim() ? (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-600">プレビューがここに表示されます</p>
          )}
        </div>
      </div>

      {/* AI: タスクを生成 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Sparkles size={15} className="text-indigo-500" />
            メモからタスクを生成
          </div>
          <Button
            variant="secondary"
            onClick={handleExtractTasks}
            disabled={isAiLoading || !content.trim() || !canUseAi}
            className="gap-2 h-8 px-3 text-sm"
          >
            {isAiLoading
              ? <><Loader2 size={13} className="animate-spin" /> 解析中...</>
              : <><Sparkles size={13} /> タスクを生成</>
            }
          </Button>
        </div>

        {!canUseAi && (
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>Settings で AI を設定するとメモからタスクを自動生成できます。</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {appliedMsg && (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
            <Check size={14} className="shrink-0" />
            <span>{appliedMsg}</span>
          </div>
        )}

        {aiMessage && (
          <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2">
            {aiMessage}
          </p>
        )}

        {pendingOps.length > 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                提案されたタスク（{pendingOps.length}件）
              </span>
              <Button size="sm" onClick={handleApplyOps} className="gap-1 h-6 text-xs">
                <Check size={11} /> 適用する
              </Button>
            </div>
            <div className="space-y-1.5">
              {pendingOps.map((op, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-indigo-100 dark:border-indigo-800 text-xs flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    {op.type === 'add'    && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Plus size={9} /> ADD</span>}
                    {op.type === 'update' && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Edit3 size={9} /> UPDATE</span>}
                    {op.type === 'delete' && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Trash2 size={9} /> DELETE</span>}
                    <span className={`font-medium text-gray-800 dark:text-gray-200 truncate ${op.type === 'delete' ? 'line-through text-gray-400' : ''}`}>
                      {op.type !== 'delete' ? op.todo?.title ?? `タスク ${idx + 1}` : op.id}
                    </span>
                  </div>
                  {op.reasoning && (
                    <p className="text-gray-400 dark:text-gray-500 italic pl-1">{op.reasoning}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
