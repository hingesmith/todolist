import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import schema from '../../todo.schema.json'
import { Todo } from '../types/todo'

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)

export const validateTodo = ajv.compile<Todo>(schema.items)

export const validateTodoList = ajv.compile<Todo[]>(schema)

export const getValidationErrors = (errors: any[]) => {
  if (!errors) return []
  return errors.map((err) => ({
    path: err.instancePath,
    message: err.message,
  }))
}
