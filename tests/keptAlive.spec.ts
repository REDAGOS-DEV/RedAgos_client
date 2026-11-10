// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, KeepAlive, nextTick, ref, Teleport } from 'vue'
import { onPageReturn, usePageHidden } from '~/composables/useKeptAlive'

/**
 * Two pages under one <KeepAlive>, as NuxtPage renders kept-alive pages, and a
 * way to switch between them.
 */
function mountPages(pageA: ReturnType<typeof defineComponent>) {
  const PageB = defineComponent({ name: 'PageB', setup: () => () => h('p', 'B') })
  const current = ref<'a' | 'b'>('a')
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp({
    setup: () => () => h(KeepAlive, null, [current.value === 'a' ? h(pageA) : h(PageB)]),
  })
  app.mount(root)

  async function show(page: 'a' | 'b') {
    current.value = page
    await nextTick()
    await nextTick()
  }

  return { show, unmount: () => { app.unmount(); root.remove() } }
}

describe('onPageReturn', () => {
  it('refreshes on each return, not on the first visit', async () => {
    let refreshes = 0
    const PageA = defineComponent({
      name: 'PageA',
      setup() {
        onPageReturn(() => { refreshes++ })
        return () => h('p', 'A')
      },
    })
    const { show, unmount } = mountPages(PageA)
    await nextTick()
    expect(refreshes).toBe(0)

    await show('b')
    expect(refreshes).toBe(0)
    await show('a')
    expect(refreshes).toBe(1)
    await show('b')
    await show('a')
    expect(refreshes).toBe(2)
    unmount()
  })

  it('refreshes a panel mounted after the page was first shown', async () => {
    let refreshes = 0
    const open = ref(false)
    const Panel = defineComponent({
      setup() {
        onPageReturn(() => { refreshes++ })
        return () => h('p', 'panel')
      },
    })
    const PageA = defineComponent({
      name: 'PageA',
      setup: () => () => h('div', [open.value ? h(Panel) : null]),
    })
    const { show, unmount } = mountPages(PageA)
    await nextTick()
    open.value = true
    await nextTick()

    await show('b')
    await show('a')
    expect(refreshes).toBe(1)
    unmount()
  })
})

describe('usePageHidden', () => {
  it('takes a teleported dialog off screen while its page is hidden', async () => {
    const Dialog = defineComponent({
      setup() {
        const pageHidden = usePageHidden()
        return () => h(Teleport, { to: 'body', disabled: pageHidden.value }, h('div', { id: 'kept-dialog' }, 'dialog'))
      },
    })
    const PageA = defineComponent({ name: 'PageA', setup: () => () => h('div', [h(Dialog)]) })
    const onScreen = () => document.body.contains(document.getElementById('kept-dialog'))

    const { show, unmount } = mountPages(PageA)
    await nextTick()
    expect(onScreen()).toBe(true)

    await show('b')
    expect(onScreen()).toBe(false)
    await show('a')
    expect(onScreen()).toBe(true)
    unmount()
  })
})
