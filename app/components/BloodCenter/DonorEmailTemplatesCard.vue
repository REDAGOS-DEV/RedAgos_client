<template>
  <section v-if="canConfigure" class="tpl-card" aria-labelledby="donor-email-title">
    <div>
      <h2 id="donor-email-title" class="tpl-card__title">Donor emails</h2>
      <p class="tpl-card__hint">
        The wording of the emails staff send from the Donors page. They go out in your centre's name, and replies come
        to your centre's email address. Plain text: leave a blank line between paragraphs.
      </p>
    </div>

    <p v-if="loading" class="tpl-card__hint">Loading templates…</p>
    <p v-else-if="loadError" class="tpl-card__error" role="alert">
      {{ loadError }}
      <button type="button" class="tpl-link" @click="load">Retry</button>
    </p>

    <template v-else-if="current">
      <div class="tpl-tabs" role="tablist" aria-label="Email template">
        <button
          v-for="t in templates"
          :key="t.template"
          type="button"
          role="tab"
          class="tpl-tab"
          :class="{ 'tpl-tab--on': t.template === selected }"
          :aria-selected="t.template === selected"
          @click="select(t.template)"
        >
          {{ t.label }}
          <span v-if="t.customised" class="tpl-tab__tag">Edited</span>
        </button>
      </div>

      <form class="tpl-form" @submit.prevent="save">
        <div class="tpl-field">
          <label class="tpl-label" for="tpl-subject">Subject</label>
          <input id="tpl-subject" ref="subjectInput" v-model="draft.subject" type="text" class="tpl-input" maxlength="150" required @focus="lastField = 'subject'">
        </div>

        <div class="tpl-field">
          <label class="tpl-label" for="tpl-body">Message</label>
          <textarea id="tpl-body" ref="bodyInput" v-model="draft.body" class="tpl-input tpl-textarea" rows="10" maxlength="5000" required @focus="lastField = 'body'" />
        </div>

        <div class="tpl-field">
          <span class="tpl-label">Insert a detail</span>
          <div class="tpl-chips">
            <button
              v-for="p in placeholders"
              :key="p.key"
              type="button"
              class="tpl-chip"
              :title="p.description"
              @click="insert(p.key)"
            >
              {{ p.key }}
            </button>
          </div>
          <p v-if="unknown.length" class="tpl-card__warn">
            Not a recognised detail, so it will be sent as typed: {{ unknown.join(', ') }}
          </p>
        </div>

        <div class="tpl-actions">
          <button type="submit" class="tpl-btn tpl-btn--primary" :disabled="saving || !dirty || !draft.subject.trim() || !draft.body.trim()">
            {{ saving ? 'Saving…' : 'Save template' }}
          </button>
          <button v-if="dirty" type="button" class="tpl-btn" :disabled="saving" @click="select(selected)">Discard changes</button>
          <button v-if="current.customised && !dirty" type="button" class="tpl-btn" :disabled="saving" @click="reset">
            Restore default
          </button>
        </div>
      </form>

      <p v-if="error" class="tpl-card__error" role="alert">{{ error }}</p>
      <p v-else-if="notice" class="tpl-card__notice" role="status">{{ notice }}</p>
    </template>
  </section>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

/**
 * The Blood Center Admin's wording for the two donor emails: Thank-You and
 * Eligibility Reminder.
 *
 * Self-gating on `center.configure`, like the logo card beside it. The server
 * keeps one row per edited template and falls back to its default otherwise,
 * so Restore default simply deletes the centre's row.
 */

const { can } = useUser()
const canConfigure = computed(() => can('center.configure'))

const templates = ref([])
const placeholders = ref([])
const selected = ref('thank_you')
const draft = reactive({ subject: '', body: '' })
const loading = ref(false)
const loadError = ref('')
const saving = ref(false)
const error = ref('')
const notice = ref('')
const lastField = ref('body')
const subjectInput = ref(null)
const bodyInput = ref(null)

const current = computed(() => templates.value.find((t) => t.template === selected.value) ?? null)
const dirty = computed(() => Boolean(current.value) && (draft.subject !== current.value.subject || draft.body !== current.value.body))

/** {words} in the draft that the server will not fill in. */
const unknown = computed(() => {
  const known = new Set(placeholders.value.map((p) => p.key))
  const found = `${draft.subject} ${draft.body}`.match(/\{[a-z_]+\}/gi) ?? []
  return [...new Set(found)].filter((key) => !known.has(key))
})

function apply(data) {
  templates.value = data?.templates ?? []
  placeholders.value = data?.placeholders ?? []
}

function select(template) {
  selected.value = template
  const t = current.value
  draft.subject = t?.subject ?? ''
  draft.body = t?.body ?? ''
  error.value = ''
  notice.value = ''
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    apply(await bloodCenterService.emailTemplates())
    select(selected.value)
  } catch (err) {
    loadError.value = err?.message || 'Could not load the email templates.'
  } finally {
    loading.value = false
  }
}

/** Put a placeholder where the cursor was, in whichever field had it last. */
function insert(key) {
  const field = lastField.value === 'subject' ? 'subject' : 'body'
  const el = field === 'subject' ? subjectInput.value : bodyInput.value
  const text = draft[field]
  const start = el?.selectionStart ?? text.length
  const end = el?.selectionEnd ?? text.length

  draft[field] = text.slice(0, start) + key + text.slice(end)

  nextTick(() => {
    el?.focus()
    el?.setSelectionRange(start + key.length, start + key.length)
  })
}

async function save() {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const res = await bloodCenterService.saveEmailTemplate(selected.value, { subject: draft.subject, body: draft.body })
    apply(res)
    select(selected.value)
    notice.value = res?.message || 'Template saved.'
  } catch (err) {
    error.value = Object.values(err?.errors ?? {}).flat()[0] || err?.message || 'Could not save the template.'
  } finally {
    saving.value = false
  }
}

async function reset() {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const res = await bloodCenterService.resetEmailTemplate(selected.value)
    apply(res)
    select(selected.value)
    notice.value = res?.message || 'Template restored to the default.'
  } catch (err) {
    error.value = err?.message || 'Could not restore the template.'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (canConfigure.value) load()
})
</script>

<style scoped>
.tpl-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  margin-top: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
}

.tpl-card__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }

.tpl-card__hint {
  margin: 0.25rem 0 0;
  max-width: 68ch;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.tpl-tabs { display: flex; flex-wrap: wrap; gap: 6px; }

.tpl-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 999px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.tpl-tab:hover { color: var(--rb-text-primary); }
.tpl-tab--on { border-color: var(--rb-primary); color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), 0.06); }

.tpl-tab__tag {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  font-size: 11px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}

.tpl-form { display: flex; flex-direction: column; gap: 0.85rem; }
.tpl-field { display: flex; flex-direction: column; gap: 6px; }
.tpl-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }

/* Anchored on the card: other portals ship unscoped dark input rules. */
.tpl-card .tpl-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  font: inherit;
  font-size: 13.5px;
  color: var(--rb-text-primary);
}

.tpl-card .tpl-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.tpl-card .tpl-textarea { line-height: 1.55; resize: vertical; min-height: 180px; }

.tpl-chips { display: flex; flex-wrap: wrap; gap: 6px; }

.tpl-chip {
  padding: 3px 9px;
  border: 1px dashed var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-primary);
  font-family: var(--rb-font-mono);
  font-size: 12px;
  cursor: pointer;
}

.tpl-chip:hover { border-style: solid; }

.tpl-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }

.tpl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.95rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.tpl-btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.tpl-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.tpl-btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.tpl-btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }

.tpl-link {
  margin-left: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--rb-primary-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.tpl-tab:focus-visible,
.tpl-chip:focus-visible,
.tpl-btn:focus-visible,
.tpl-link:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.tpl-card__error,
.tpl-card__notice,
.tpl-card__warn { margin: 0; font-size: 13px; line-height: 1.45; }
.tpl-card__error { color: var(--rb-accent-text); }
.tpl-card__notice { color: var(--rb-success-text); }
.tpl-card__warn { color: var(--rb-warning-text); }
</style>
