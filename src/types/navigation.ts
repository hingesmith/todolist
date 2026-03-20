import { MemoType } from './memo'

export type PageState =
  | { type: 'list' }
  | { type: 'board' }
  | { type: 'gantt' }
  | { type: 'settings' }
  | { type: 'create' }
  | { type: 'edit'; id: string }
  | { type: 'memo'; folder?: string }
  | { type: 'memo-edit'; id?: string; folder?: string; draft?: { title: string; content: string; type: MemoType } }

export const TASK_VIEWS = ['list', 'board', 'gantt'] as const
export type TaskViewType = typeof TASK_VIEWS[number]
