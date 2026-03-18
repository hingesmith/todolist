import { GoogleGenAI } from '@google/genai'
import { Todo } from '../types/todo'
import { AiSettings } from '../storage/local'

export type AiOperation =
  | { type: 'add'; reasoning?: string; todo: Omit<Todo, 'id' | 'created_at'> }
  | { type: 'update'; id: string; reasoning?: string; todo: Partial<Omit<Todo, 'id' | 'created_at'>> }
  | { type: 'delete'; reasoning?: string; id: string }

export interface AiOperationResponse {
  message: string
  operations: AiOperation[]
}

const SYSTEM_INSTRUCTION = `
あなたはToDoリストアプリケーションのアシスタントです。
ユーザーと自然な会話を行いつつ、現在のタスク一覧（JSON）を考慮して、タスクの「追加(add)」「更新(update)」「削除(delete)」の操作リストをJSON形式で抽出・生成してください。

以下の情報を考慮してください：
- 現在の日時: ${new Date().toISOString()} (これを基準に期限などを計算してください)
- ユーザーに返信する自然言語のテキストを \`message\` に含めてください。
- ユーザー指示から推定される操作をすべて \`operations\` 配列に含めてください。各操作には、なぜその期間や内容に設定したかの理由（\`reasoning\`）を必ず含めてください。
- 既存のタスクを更新・削除する場合は、必ず提供された現在のタスクの \`id\` を指定してください。

返却するデータは必ず以下のスキーマに従った1つのJSONオブジェクトのみとしてください。

{
  "message": "ユーザーへの返信メッセージ",
  "operations": [
    {
      "type": "add",
      "reasoning": "来週末のアクティビティのため、金曜日を期限として設定しました",
      "todo": {
        "title": "タスク名（必須）",
        "description": "タスクの概要や補足説明",
        "status": "todo" | "in_progress" | "done",
        "priority": "low" | "medium" | "high",
        "start_date": "YYYY-MM-DD",
        "end_date": "YYYY-MM-DD",
        "tags": ["タグ1", "タグ2"],
        "dependencies": ["前提となるタスクのID", "別のタスクのID"]
      }
    },
    {
      "type": "update",
      "id": "既存タスクのID",
      "reasoning": "ユーザーの指示により期限を延長しました",
      "todo": {
        "status": "done",
        "dependencies": ["依存関係を追加・更新する場合はIDの配列"]
      }
    },
    {
      "type": "delete",
      "id": "削除する既存タスクのID",
      "reasoning": "不要になったとのことなので削除します"
    }
  ]
}
`

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

// ─── Gemini (Google GenAI SDK) ────────────────────────────────────────────────

async function generateWithGemini(
  apiKey: string,
  settings: AiSettings,
  messages: ChatMessage[],
  stateContext: string
): Promise<AiOperationResponse> {
  const cleanKey = apiKey.trim().replace(/[^\x20-\x7E]/g, '')
  const ai = new GoogleGenAI({ apiKey: cleanKey })

  const formattedContents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

  if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === 'user') {
    formattedContents[formattedContents.length - 1].parts[0].text += `\n\n${stateContext}`
  } else {
    formattedContents.push({ role: 'user', parts: [{ text: stateContext }] })
  }

  const response = await ai.models.generateContent({
    model: settings.geminiModel,
    contents: formattedContents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      temperature: 0.1,
    }
  })

  const text = response.text
  if (!text) throw new Error('No text returned from Gemini API')
  return JSON.parse(text)
}

// ─── Local LLM (OpenAI-compatible HTTP) ──────────────────────────────────────

async function generateWithLocalLLM(
  settings: AiSettings,
  messages: ChatMessage[],
  stateContext: string
): Promise<AiOperationResponse> {
  if (!settings.localEndpoint) throw new Error('Local LLM Endpoint URL is not set.')

  const payloadMessages: { role: string; content: string }[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content
    }))
  ]

  // Inject current task state into the last user message
  let lastUserIdx = -1
  for (let i = payloadMessages.length - 1; i >= 0; i--) {
    if (payloadMessages[i].role === 'user') { lastUserIdx = i; break }
  }
  if (lastUserIdx >= 0) {
    payloadMessages[lastUserIdx].content += `\n\n${stateContext}`
  } else {
    payloadMessages.push({ role: 'user', content: stateContext })
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (settings.localApiKey?.trim()) {
    headers['Authorization'] = `Bearer ${settings.localApiKey.trim()}`
  }

  const response = await fetch(settings.localEndpoint.trim(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.localModel.trim(),
      messages: payloadMessages,
      temperature: 0.1,
      stream: false
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Local LLM Error: ${response.status} ${errText}`)
  }

  const data = await response.json()
  const text: string | undefined = data.choices?.[0]?.message?.content
  if (!text) throw new Error('No response content from Local LLM')

  // Strip markdown code fences that some models add despite no format specifier
  const cleanText = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```$/im, '').trim()
  try {
    return JSON.parse(cleanText)
  } catch {
    throw new Error(`Failed to parse Local LLM response as JSON. Response: ${text}`)
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generateOperationsFromChat(
  apiKey: string | null,
  settings: AiSettings,
  messages: ChatMessage[],
  currentTodos: Todo[]
): Promise<AiOperationResponse> {
  const stateContext = `現在のタスク一覧:\n\`\`\`json\n${JSON.stringify(currentTodos, null, 2)}\n\`\`\``

  try {
    let parsed: AiOperationResponse

    if (settings.provider === 'gemini') {
      if (!apiKey) throw new Error('Gemini API key is required but not set.')
      parsed = await generateWithGemini(apiKey, settings, messages, stateContext)
    } else {
      parsed = await generateWithLocalLLM(settings, messages, stateContext)
    }

    const validOperations = (parsed.operations || []).filter(op => {
      if (op.type === 'add') return !!op.todo?.title
      if (op.type === 'update' || op.type === 'delete') return !!op.id
      return false
    })

    return {
      message: parsed.message || '承知いたしました。以下のタスク操作を提案します。',
      operations: validOperations
    }
  } catch (error) {
    console.error('AI Error:', error)
    throw new Error(error instanceof Error ? error.message : 'Failed to generate tasks')
  }
}
