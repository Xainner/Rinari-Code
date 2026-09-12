// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { QuestionCard } from './Questions'
import { desktopApi, type QuestionRequest } from '../../services/desktop'

vi.mock('../../services/desktop', () => ({ desktopApi: { answer: vi.fn().mockResolvedValue({}) } }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const request: QuestionRequest = {
  request_id: 'q1',
  session_id: 's1',
  turn_id: 't1',
  status: 'pending',
  questions: [
    { id: 'choice', title: '¿Qué hacemos?', options: [{ label: 'Planificar', recommended: true }] },
  ],
}

it('waits for explicit submit after selecting an option', async () => {
  const user = userEvent.setup()
  render(<QuestionCard request={request} onResolved={vi.fn()} />)
  expect(desktopApi.answer).not.toHaveBeenCalled()
  await user.click(screen.getByRole('radio'))
  expect(desktopApi.answer).not.toHaveBeenCalled()
  await user.click(screen.getByText('Enviar respuesta'))
  expect(desktopApi.answer).toHaveBeenCalledWith(request, { choice: 'Planificar' }, false)
})

it('retains a free answer while minimized and across question navigation', async () => {
  const user = userEvent.setup()
  const multiple = {
    ...request,
    questions: [...request.questions, { id: 'second', title: '¿Algo más?' }],
  }
  render(<QuestionCard request={multiple} onResolved={vi.fn()} />)
  await user.type(screen.getByLabelText('Tu respuesta'), 'Mi alternativa')
  await user.click(screen.getByLabelText('Minimizar preguntas'))
  await user.click(screen.getByText(/Mostrar preguntas/))
  expect((screen.getByLabelText('Tu respuesta') as HTMLTextAreaElement).value).toBe(
    'Mi alternativa',
  )
  await user.click(screen.getByLabelText('Pregunta siguiente'))
  await user.type(screen.getByLabelText('Tu respuesta'), 'Sí')
  await user.click(screen.getByText('Enviar respuesta'))
  expect(desktopApi.answer).toHaveBeenCalledWith(
    multiple,
    { choice: 'Mi alternativa', second: 'Sí' },
    false,
  )
})

it('sends explicit skip rather than choosing the recommended option', async () => {
  const user = userEvent.setup()
  render(<QuestionCard request={request} onResolved={vi.fn()} />)
  await user.click(screen.getByText('Omitir'))
  expect(desktopApi.answer).toHaveBeenCalledWith(request, {}, true)
})
