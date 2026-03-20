export type MemoType = 'note' | 'daily_report'

export interface Memo {
  id: string
  title: string
  content: string
  type: MemoType
  folder?: string
  created_at: string
  updated_at?: string
  linked_task_ids?: string[]
}
