<template>
  <div class="hc-page">
    <div class="hc-inner">
      <PageHeader
        title="Help Center"
        subtitle="How each part of the blood center works. To find something fast, type it in the search at the top; help guides show there too."
      />

      <!-- GUIDES: departments down the left, their guides on the right -->
      <section class="card guides-card" aria-labelledby="hc-guides">
        <nav class="depts" aria-labelledby="hc-guides">
          <h2 id="hc-guides" class="depts__title">Guides</h2>
          <button
            v-for="d in departments"
            :key="d.name"
            type="button"
            class="dept"
            :class="{ 'dept--on': d.name === department }"
            :aria-current="d.name === department ? 'true' : undefined"
            @click="department = d.name"
          >
            <span class="dept__name">{{ d.name }}</span>
            <span class="dept__count">{{ d.count }}</span>
          </button>
          <p class="depts__note">Only the parts your account can open are shown.</p>
        </nav>

        <div class="guides">
          <details
            v-for="guide in departmentGuides"
            :id="`guide-${guide.id}`"
            :key="guide.id"
            class="guide"
            :open="openId === guide.id"
            @toggle="onToggle(guide.id, $event)"
          >
            <summary class="guide__summary">
              <span class="guide__text">
                <span class="guide__title">{{ guide.title }}</span>
                <span class="guide__lede">{{ guide.summary }}</span>
              </span>
              <AssetIcon name="chevron-down" :size="18" class="guide__chevron" />
            </summary>

            <div class="guide__body">
              <ol class="steps">
                <li v-for="(step, i) in guide.steps" :key="i" class="step">
                  <span class="step__n" aria-hidden="true">{{ i + 1 }}</span>
                  <span>{{ step }}</span>
                </li>
              </ol>

              <dl v-if="guide.shortcuts?.length" class="keys">
                <div v-for="s in guide.shortcuts" :key="s.label" class="keys__row">
                  <dt>{{ s.label }}<small v-if="s.note">{{ s.note }}</small></dt>
                  <dd><KeyCombo :combos="s.keys" /></dd>
                </div>
              </dl>

              <div v-if="guide.questions?.length" class="guide__faq">
                <div v-for="item in guide.questions" :key="item.q" class="qa">
                  <p class="qa__q">{{ item.q }}</p>
                  <p class="qa__a">{{ item.a }}</p>
                </div>
              </div>

              <NuxtLink :to="guide.path" class="guide__go">
                Go to {{ guide.via?.label ?? pageLabel(guide.path) }}
                <AssetIcon name="arrow-right" :size="15" />
              </NuxtLink>
            </div>
          </details>
        </div>
      </section>

      <!-- QUESTIONS AND TERMS, side by side -->
      <div class="hc-lower">
        <section v-if="topQuestions.length" class="card" aria-labelledby="hc-faq">
          <h2 id="hc-faq" class="card__title">Common questions</h2>
          <div class="faq">
            <details v-for="item in topQuestions" :key="item.q" class="faq__item">
              <summary>
                <span>{{ item.q }}</span>
                <AssetIcon name="chevron-down" :size="16" class="faq__chevron" />
              </summary>
              <p>{{ item.a }}</p>
            </details>
          </div>
        </section>

        <section class="card" aria-labelledby="hc-terms">
          <h2 id="hc-terms" class="card__title">Terms used in RedAgos</h2>
          <dl class="terms">
            <div v-for="t in HELP_GLOSSARY" :key="t.term" class="term">
              <dt>{{ t.term }}</dt>
              <dd>{{ t.meaning }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <!-- STILL STUCK: one line, not a card of its own -->
      <p class="stuck">
        <AssetIcon name="help-circle" :size="16" class="stuck__icon" />
        <span class="stuck__text">
          Still stuck? Ask your supervisor. A mistake in a saved record is fixed by a correction, never by editing it.
        </span>
        <NuxtLink v-if="allowedPaths.has('/blood-center/corrections')" to="/blood-center/corrections" class="stuck__link">
          Go to Corrections
          <AssetIcon name="arrow-right" :size="14" />
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup>
/**
 * The blood center's Help Center: every guide for the pages this staff member
 * can open, by department (their own first), with the common questions and
 * the terms RedAgos uses. Searching is the top bar's job: guides show among
 * its results and open here at ?guide=<id>. The words live in
 * utils/bloodCenterHelp.ts, shared with the top bar search.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import KeyCombo from '~/components/BloodCenter/KeyCombo.vue'
import { HELP_GLOSSARY, HELP_GUIDES, guideVisible } from '~/utils/bloodCenterHelp'
import PageHeader from '~/components/ui/PageHeader.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'blood-centerdashboard',
})

const route = useRoute()
const router = useRouter()
const { navGroups, searchablePages, labelForPath } = useBloodCenterNav()

// Only guides for pages this account can open; the sidebar's own rule.
const allowedPaths = computed(() => new Set(searchablePages.value.map((item) => item.path.split('?')[0])))
const guides = computed(() => HELP_GUIDES.filter((guide) => guideVisible(guide, allowedPaths.value)))

// Departments in the sidebar's order, which already puts the member's own first.
const departments = computed(() => navGroups.value
  .map((group) => ({ name: group.label, count: guides.value.filter((g) => g.department === group.label).length }))
  .filter((d) => d.count > 0))

const department = ref('')
const departmentGuides = computed(() => guides.value.filter((g) => g.department === department.value))

function pageLabel(path) {
  return labelForPath(path) || 'the page'
}

watch(departments, (list) => {
  if (!list.some((d) => d.name === department.value)) department.value = list[0]?.name ?? ''
}, { immediate: true })

/* OPEN GUIDE: one at a time; ?guide=<id> (from the top bar search) opens that one */
const openId = ref('')

function onToggle(id, event) {
  if (event.target.open) openId.value = id
  else if (openId.value === id) openId.value = ''
}

async function openGuide(id) {
  const guide = guides.value.find((g) => g.id === id)
  if (!guide) return
  department.value = guide.department
  openId.value = id
  await nextTick()
  document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Watched, not read once: a guide picked from the top bar search while
// already on this page changes only the query.
onMounted(() => {
  watch(() => route.query.guide, (id) => {
    if (typeof id !== 'string' || !id) return
    openGuide(id)
    router.replace({ query: {} })
  }, { immediate: true })
})

/* COMMON QUESTIONS: the first from each of this account's departments, then the rest */
const topQuestions = computed(() => {
  const byDept = departments.value.map((d) => guides.value
    .filter((g) => g.department === d.name)
    .flatMap((g) => g.questions ?? []))
  const picked = []
  for (let round = 0; picked.length < 6 && byDept.some((list) => list.length > round); round++) {
    for (const list of byDept) if (list[round] && picked.length < 6) picked.push(list[round])
  }
  return picked
})
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.hc-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.hc-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.hc-title { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.01em; color: var(--rb-text-primary); }
.hc-sub { margin: 4px 0 0; font-size: 13.5px; color: var(--rb-text-secondary); max-width: 80ch; }

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; padding: 18px; min-width: 0; }
.card__title { margin: 0 0 12px; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }

/* Guides: a department list beside its guides */
.guides-card { display: grid; grid-template-columns: 240px minmax(0, 1fr); padding: 0; overflow: hidden; }
.depts { display: flex; flex-direction: column; gap: 2px; padding: 18px 12px; border-right: 1px solid var(--rb-border); background: var(--rb-surface-alt); }
.depts__title { margin: 0 8px 10px; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.dept {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%;
  padding: 9px 10px; border: 0; border-radius: 10px; background: transparent;
  font: inherit; font-size: 13.5px; font-weight: 600; color: var(--rb-text-secondary); text-align: left; cursor: pointer;
}
.dept:hover { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.dept:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.dept--on { background: var(--rb-surface); color: var(--rb-primary-text); font-weight: 700; box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb, 15, 23, 42), .08); }
.dept__count { min-width: 22px; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 800; text-align: center; color: var(--rb-text-secondary); background: var(--rb-surface); border: 1px solid var(--rb-border); }
.dept--on .dept__count { color: #fff; background: var(--rb-primary); border-color: var(--rb-primary); }
.depts__note { margin: auto 8px 0; padding-top: 14px; font-size: 11.5px; line-height: 1.45; color: var(--rb-text-muted); }

.guides { display: flex; flex-direction: column; min-width: 0; }
.guide + .guide { border-top: 1px solid var(--rb-border); }
.guide { scroll-margin-top: 88px; }
.guide__summary { display: flex; align-items: center; gap: 14px; padding: 16px 20px; cursor: pointer; list-style: none; }
.guide__summary::-webkit-details-marker { display: none; }
.guide__summary:hover { background: var(--rb-surface-hover); }
.guide__summary:focus-visible { outline: none; box-shadow: inset var(--rb-focus-ring); }
.guide__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.guide__title { font-size: 14.5px; font-weight: 700; color: var(--rb-text-primary); }
.guide__lede { font-size: 12.5px; color: var(--rb-text-secondary); }
.guide__chevron { flex: none; color: var(--rb-text-muted); transition: transform .2s ease; }
.guide[open] .guide__chevron { transform: rotate(180deg); color: var(--rb-primary-text); }
.guide[open] .guide__title { color: var(--rb-primary-text); }
.guide__body { display: flex; flex-direction: column; gap: 14px; padding: 0 20px 18px; }

.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.step { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 10px; align-items: start; font-size: 13.5px; line-height: 1.5; color: var(--rb-text-primary); }
.step__n { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; font-size: 12px; font-weight: 800; color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .1); }

.keys { margin: 0; display: flex; flex-direction: column; border: 1px solid var(--rb-border); border-radius: 12px; overflow: hidden; max-width: 520px; }
.keys__row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 12px; font-size: 13px; color: var(--rb-text-primary); }
.keys__row + .keys__row { border-top: 1px solid var(--rb-border); }
.keys__row dt { display: flex; flex-direction: column; }
.keys__row dt small { font-size: 11.5px; color: var(--rb-text-muted); }
.keys__row dd { margin: 0; }

.guide__faq { display: flex; flex-direction: column; gap: 10px; }
.qa { padding-left: 12px; border-left: 2px solid var(--rb-border); }
.qa__q { margin: 0; font-size: 13px; font-weight: 700; color: var(--rb-text-primary); }
.qa__a { margin: 2px 0 0; font-size: 13px; line-height: 1.55; color: var(--rb-text-secondary); }

.guide__go { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 9px; font-size: 13px; font-weight: 700; color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .08); text-decoration: none; }
.guide__go:hover { background: rgba(var(--rb-primary-rgb), .14); }
.guide__go:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

/* Questions and terms side by side */
.hc-lower { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }

.faq { display: flex; flex-direction: column; gap: 6px; }
.faq__item { border: 1px solid var(--rb-border); border-radius: 12px; }
.faq__item summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); cursor: pointer; list-style: none; border-radius: 12px; }
.faq__item summary::-webkit-details-marker { display: none; }
.faq__item summary:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.faq__chevron { flex: none; color: var(--rb-text-muted); transition: transform .2s ease; }
.faq__item[open] .faq__chevron { transform: rotate(180deg); }
.faq__item[open] summary { color: var(--rb-primary-text); }
.faq__item p { margin: 0; padding: 0 12px 12px; font-size: 13px; line-height: 1.55; color: var(--rb-text-secondary); }

/* Terms in two columns, so ten of them stay short */
.terms { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; }
.term { display: flex; flex-direction: column; gap: 1px; font-size: 12.5px; }
.term dt { font-weight: 800; color: var(--rb-primary-text); }
.term dd { margin: 0; line-height: 1.45; color: var(--rb-text-secondary); }

.stuck {
  display: flex; align-items: center; gap: 10px; margin: 0; padding: 12px 16px; border-radius: 12px;
  font-size: 13px; color: var(--rb-text-secondary);
  background: rgba(var(--rb-primary-rgb), .05); border: 1px solid rgba(var(--rb-primary-rgb), .16);
}
.stuck__icon { flex: none; color: var(--rb-primary-text); }
.stuck__text { flex: 1; }
.stuck__link { flex: none; display: inline-flex; align-items: center; gap: 5px; font-weight: 700; color: var(--rb-primary-text); text-decoration: none; }
.stuck__link:hover { text-decoration: underline; text-underline-offset: 3px; }

@media (prefers-reduced-motion: reduce) {
  .guide__chevron, .faq__chevron { transition: none; }
}

@media (max-width: 1000px) {
  .hc-lower { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .guides-card { grid-template-columns: 1fr; }
  .depts { border-right: 0; border-bottom: 1px solid var(--rb-border); }
  .stuck { flex-wrap: wrap; }
}
</style>
