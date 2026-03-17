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
  apiKey: string | null,
  settings: AiSettings,
  messages: { role: 'user' | 'assistant' | 'system', content: string }[],
  currentTodos: Todo[]
): Promise<AiOperationResponse> {
  const stateContext = `現在のタスク一覧:\n\`\`\`json\n${JSON.stringify(currentTodos, null, 2)}\n\`\`\``

  try {
    let parsed: AiOperationResponse | null = null

    if (settings.provider === 'gemini') {
      if (!apiKey) throw new Error("Gemini API key is required but not set.")
      const ai = new GoogleGenAI({ apiKey })

      const formattedContents = messages
        .filter(m => m.role !== 'system') // Gemini standard chat prefers user/model alternating
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
      if (!text) throw new Error("No text returned from Gemini API")
      parsed = JSON.parse(text)

    } else if (settings.provider === 'local') {
      // Logic for local LLM (OpenAI compatible endpoint)
      if (!settings.localEndpoint) throw new Error("Local LLM Endpoint URL is not set.")
      
      const payloadMessages = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        ...messages.filter(m => m.role !== 'system'),
      ]
      
      // Inject state into the last user message
      let lastUserIdx = -1
      for (let i = payloadMessages.length - 1; i >= 0; i--) {
        if (payloadMessages[i].role === 'user') {
          lastUserIdx = i
          break
        }
      }
      if (lastUserIdx >= 0) {
        payloadMessages[lastUserIdx].content += `\n\n${stateContext}`
      } else {
        payloadMessages.push({ role: 'user', content: stateContext })
      }

      const response = await fetch(settings.localEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: settings.localModel,
          messages: payloadMessages,
          response_format: { type: "json_object" }, // Attempt to force JSON output
          temperature: 0.1,
          stream: false
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Local LLM Error: ${response.status} ${errText}`)
      }

      const data = await response.json()
      const text = data.choices?.[0]?.message?.content
      if (!text) throw new Error("No response content from Local LLM")
      
      // Parse JSON (Local LLMs sometimes wrap in markdown code blocks even with json_object format)
      const cleanText = text.replace(/^```json/im, '').replace(/```$/im, '').trim()
      try {
        parsed = JSON.parse(cleanText)
      } catch (e) {
        throw new Error(`Failed to parse Local LLM response as JSON. Response: ${text}`)
      }
    }

    if (!parsed) throw new Error("Failed to receive or parse AI response")

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
