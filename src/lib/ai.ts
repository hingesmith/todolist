import { GoogleGenAI } from '@google/genai'
import { Todo } from '../types/todo'

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
        "tags": ["タグ1", "タグ2"]
      }
    },
    {
      "type": "update",
      "id": "既存タスクのID",
      "reasoning": "ユーザーの指示により期限を延長しました",
      "todo": {
        "status": "done"
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

export async function generateOperationsFromChat(
  apiKey: string, 
  messages: { role: 'user' | 'assistant' | 'system', content: string }[],
  currentTodos: Todo[]
): Promise<AiOperationResponse> {
  const ai = new GoogleGenAI({ apiKey })

  try {
    // We append the current state JSON to the system instruction or as the very first context message
    const stateContext = `現在のタスク一覧:\n\`\`\`json\n${JSON.stringify(currentTodos, null, 2)}\n\`\`\``

    const formattedContents = messages
      .filter(m => m.role !== 'system') // Gemini standard chat prefers user/model alternating
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
      
    // Inject the state context into the last user message so the model has the freshest data
    if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === 'user') {
      formattedContents[formattedContents.length - 1].parts[0].text += `\n\n${stateContext}`
    } else {
      // Fallback if the last message isn't user (unlikely in our flow)
      formattedContents.push({
        role: 'user',
        parts: [{ text: stateContext }]
      })
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: formattedContents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    })

    const text = response.text
    if (!text) {
      throw new Error("No text returned from Gemini API")
    }

    const parsed: AiOperationResponse = JSON.parse(text)
    
    // Validate types basic fields
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
    console.error("Gemini API Error:", error)
    throw new Error(error instanceof Error ? error.message : "Failed to generate tasks")
  }
}
