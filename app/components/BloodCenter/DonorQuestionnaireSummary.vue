<template>
  <div class="dhq-strip" :class="toneClass">
    <div class="dhq-strip__facts">
      <span class="dhq-strip__label">Health questionnaire</span>

      <template v-if="meta?.available">
        <span class="dhq-strip__fact">DHQ v{{ meta.question_version }}</span>
        <span class="dhq-strip__sep">·</span>
        <span class="dhq-strip__fact">Answered {{ shortDate(meta.screened_on) }}</span>

        <span class="dhq-strip__sep">·</span>
        <span class="dhq-strip__fact" :class="{ 'dhq-strip__fact--warn': !meta.consent_captured }">
          {{ meta.consent_captured ? 'Consent given' : 'No consent on file' }}
        </span>

        <template v-if="meta.is_current_version === false">
          <span class="dhq-strip__sep">·</span>
          <span class="dhq-strip__fact dhq-strip__fact--warn">Superseded form</span>
        </template>

        <template v-if="flaggedCount">
          <span class="dhq-strip__sep">·</span>
          <span class="dhq-strip__fact dhq-strip__fact--warn">
            {{ flaggedCount }} answer{{ flaggedCount === 1 ? '' : 's' }} to review
          </span>
        </template>
      </template>

      <span v-else class="dhq-strip__fact dhq-strip__fact--muted">
        Not answered in the app — ask the donor to complete it on their phone.
      </span>
    </div>

    <div class="dhq-strip__actions">
      <button type="button" class="dhq-btn" :disabled="loading" @click="$emit('open')">
        {{ loading ? 'Loading…' : 'Review questionnaire' }}
      </button>

      <!--
        The miss path: a donor who never answered fills it in at the counter on
        their own phone. Without this they would have to be re-scanned, or the
        page reloaded, to pick up what they just submitted.
      -->
      <button type="button" class="dhq-btn dhq-btn--ghost" :disabled="loading" @click="$emit('refresh')">
        Check again
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * The persistent questionnaire summary, pinned under the donor bar.
 *
 * Drawn entirely from what the scan already returned, so it costs no request.
 * It sits here rather than inside a stage because staff need it from the moment
 * the donor is verified through to the end of the collection — they read these
 * answers while recording their own findings.
 */

const props = defineProps({
  meta: { type: Object, default: null },
  flaggedCount: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
})

defineEmits(['open', 'refresh'])

// Tinted whenever something wants a second look: a flagged answer, a consent
// that was never captured, or a form the donor answered before the current one.
const toneClass = computed(() => {
  if (!props.meta?.available) return ''

  const needsAttention = props.flaggedCount > 0
    || !props.meta.consent_captured
    || props.meta.is_current_version === false

  return needsAttention ? 'dhq-strip--attention' : ''
})

function shortDate(value) {
  if (!value) return '—'

  return new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
/*
 * Reads as the second line of the pinned donor band, not as a card of its own.
 * Same recessed surface and same border as .donor-bar directly above it, whose
 * own comment explains why that band carries no accent stripe: the white stage
 * cards below have to come forward, and two stripes stacked at the top of the
 * page would compete with them and with each other.
 *
 * The states are carried by a tint and by the weight of the facts themselves,
 * which is enough when the strip sits immediately under the donor's name.
 */
.dhq-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface-alt);
  font-family: var(--rb-font-sans);
}

.dhq-strip--attention {
  border-color: rgba(var(--rb-warning-rgb), 0.45);
  background: rgba(var(--rb-warning-rgb), 0.08);
}

.dhq-strip__facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  font-size: 0.82rem;
  color: var(--rb-text-primary);
}

.dhq-strip__label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
  margin-right: 0.3rem;
}

.dhq-strip__sep { color: var(--rb-text-secondary); }
.dhq-strip__fact--warn { color: var(--rb-warning-text); font-weight: 600; }
.dhq-strip__fact--muted { color: var(--rb-text-secondary); }

.dhq-strip__actions { display: flex; gap: 0.4rem; flex: none; }

.dhq-btn {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--rb-primary);
  background: var(--rb-primary);
  color: #fff;
  border-radius: 8px;
  padding: 0.38rem 0.8rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.dhq-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.dhq-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.dhq-btn--ghost {
  background: var(--rb-surface);
  border-color: var(--rb-border-strong);
  color: var(--rb-text-primary);
}

.dhq-btn--ghost:hover:not(:disabled) {
  background: var(--rb-surface-hover);
  border-color: var(--rb-border-hover);
}

@media (max-width: 640px) {
  .dhq-strip { flex-direction: column; align-items: stretch; }
  .dhq-strip__actions { justify-content: flex-start; }
}
</style>
