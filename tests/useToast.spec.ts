import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useNoticeToast, useToast } from '~/composables/useToast'

const root = path.resolve(__dirname, '..')
const source = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('one toast for every portal', () => {
  const toast = useToast()

  beforeEach(() => {
    toast.toasts.value = []
  })

  it('takes each page\'s own word for a tone', () => {
    toast.notify('A', 'danger')
    toast.notify('B', 'notice')
    toast.notify('C')
    expect(toast.toasts.value.map(t => t.tone)).toEqual(['error', 'info', 'success'])
  })

  it('leaves a failure up longer than a success', () => {
    toast.success('Saved')
    toast.error('Not saved')
    const [saved, failed] = toast.toasts.value
    expect(failed!.duration).toBeGreaterThan(saved!.duration)
  })

  it('shows the same message once, and no more than four', () => {
    toast.success('Saved')
    toast.success('Saved')
    expect(toast.toasts.value).toHaveLength(1)
    for (const title of ['B', 'C', 'D', 'E']) toast.success(title)
    expect(toast.toasts.value.map(t => t.title)).toEqual(['B', 'C', 'D', 'E'])
  })

  it('ignores an empty message', () => {
    toast.notify('')
    expect(toast.toasts.value).toHaveLength(0)
  })

  it('sends a page\'s string message to the toast and empties it', async () => {
    const notice = ref('')
    useNoticeToast(notice)
    notice.value = 'Unit discarded.'
    await nextTick()
    expect(toast.toasts.value[0]).toMatchObject({ title: 'Unit discarded.', tone: 'success' })
    expect(notice.value).toBe('')
  })

  it('reads the tone from a { tone, text } message', async () => {
    const notice = ref<{ tone: string, text: string } | null>(null)
    useNoticeToast(notice)
    notice.value = { tone: 'error', text: 'Could not export.' }
    await nextTick()
    expect(toast.toasts.value[0]).toMatchObject({ title: 'Could not export.', tone: 'error' })
    expect(notice.value).toBeNull()
  })

  it('reads the tone from a separate kind, set after the message', async () => {
    const banner = ref('')
    const kind = ref('info')
    useNoticeToast(banner, { kind })
    banner.value = 'Not saved.'
    kind.value = 'danger'
    await nextTick()
    expect(toast.toasts.value[0]).toMatchObject({ title: 'Not saved.', tone: 'error' })
  })

  it('leaves on the page a failure that belongs there', async () => {
    const banner = ref('')
    useNoticeToast(banner, { keepWhile: () => true })
    banner.value = 'The list could not be loaded.'
    await nextTick()
    expect(toast.toasts.value).toHaveLength(0)
    expect(banner.value).toBe('The list could not be loaded.')
  })

  it('is drawn once, above every layout', () => {
    expect(source('app/app.vue')).toContain('<AppToaster />')
  })

  it('leaves no page its own toast stack', () => {
    for (const file of ['app/pages/blood-center/pos.vue', 'app/pages/hospital/request-days.vue', 'app/pages/hospital/staff.vue']) {
      expect(source(file)).not.toContain('class="toast-stack"')
      expect(source(file)).not.toContain('class="toast"')
    }
  })
})
