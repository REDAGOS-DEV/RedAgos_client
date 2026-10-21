<template>
    <div class="help-page">
        <!-- Skeleton loading state -->
        <div v-if="loading" class="skeleton-wrap">
            <div class="skeleton skeleton--header" />
            <div class="skeleton-topics-grid">
                <div class="skeleton skeleton--topic" v-for="n in 4" :key="n" />
            </div>
            <div class="skeleton-main-grid">
                <div class="skeleton-col">
                    <div class="skeleton skeleton--panel" style="height:420px" />
                </div>
                <div class="skeleton-col">
                    <div class="skeleton skeleton--panel" style="height:220px" />
                    <div class="skeleton skeleton--panel" style="height:90px" />
                </div>
            </div>
        </div>

        <template v-else>
            <!-- The page's one showpiece: ask a question, the answers filter as you type -->
            <section class="help-hero" aria-labelledby="help-title">
                <h1 id="help-title" class="page-title">How can we help?</h1>
                <p class="page-subtitle">Search the common questions, or reach the support team below.</p>
                <div class="help-search">
                    <AssetIcon name="search" :size="18" class="help-search__icon" />
                    <input
                        v-model="query"
                        type="search"
                        class="help-search__input"
                        placeholder="Try &quot;QR code&quot;, &quot;how often&quot;, or &quot;blood type&quot;"
                        aria-label="Search help"
                        aria-controls="faq-list"
                    >
                    <button v-if="query" type="button" class="help-search__clear" aria-label="Clear search" @click="query = ''">
                        <AssetIcon name="x" :size="16" />
                    </button>
                </div>
            </section>

            <!-- Quick help topics -->
            <div class="topics-grid">
                <NuxtLink
                    v-for="topic in quickTopics"
                    :key="topic.key"
                    :to="topic.route"
                    class="topic-card"
                >
                    <div class="topic-card__icon" :class="`topic-card__icon--${topic.tone}`">
                        <AssetIcon :name="topic.icon" :size="18" />
                    </div>
                    <p class="topic-card__title">{{ topic.title }}</p>
                    <p class="topic-card__desc">{{ topic.desc }}</p>
                    <AssetIcon name="arrow-right" :size="16" class="topic-card__arrow" />
                </NuxtLink>
            </div>

            <div class="main-grid">
                <!-- FAQ -->
                <div class="col-left">
                    <div class="panel">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Frequently asked questions</h2>
                            <span v-if="query" class="panel-count" aria-live="polite">
                                {{ filteredFaqs.length }} result{{ filteredFaqs.length === 1 ? '' : 's' }}
                            </span>
                        </div>
                        <div id="faq-list" class="faq-list">
                            <div v-for="faq in filteredFaqs" :key="faq.id" class="faq-item"
                                :class="{ 'faq-item--open': isOpen(faq.id) }">
                                <button
                                    :id="`faq-q-${faq.id}`"
                                    type="button"
                                    class="faq-question"
                                    :aria-expanded="isOpen(faq.id)"
                                    :aria-controls="`faq-a-${faq.id}`"
                                    @click="toggleFaq(faq.id)"
                                >
                                    <span>{{ faq.question }}</span>
                                    <span class="faq-question__toggle" aria-hidden="true">
                                        <AssetIcon :name="isOpen(faq.id) ? 'x' : 'plus'" :size="14" />
                                    </span>
                                </button>
                                <div v-if="isOpen(faq.id)" :id="`faq-a-${faq.id}`" class="faq-answer"
                                    role="region" :aria-labelledby="`faq-q-${faq.id}`">
                                    <p>{{ faq.answer }}</p>
                                </div>
                            </div>

                            <div v-if="!filteredFaqs.length" class="faq-empty">
                                <p class="faq-empty__title">No answers match "{{ query }}"</p>
                                <p class="faq-empty__sub">Try other words, or contact support and we'll help directly.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Contact support -->
                <div class="col-right">
                    <div class="panel">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Contact support</h2>
                        </div>
                        <div class="contact-list">
                            <a :href="`tel:${contactInfo.hotline}`" class="contact-row">
                                <span class="contact-row__icon">
                                    <AssetIcon name="phone" :size="16" />
                                </span>
                                <span>
                                    <span class="contact-row__label">Hotline</span>
                                    <span class="contact-row__value">{{ contactInfo.hotlineLabel }}</span>
                                </span>
                            </a>
                            <a :href="`mailto:${contactInfo.email}`" class="contact-row">
                                <span class="contact-row__icon">
                                    <AssetIcon name="mail" :size="16" />
                                </span>
                                <span>
                                    <span class="contact-row__label">Email</span>
                                    <span class="contact-row__value">{{ contactInfo.email }}</span>
                                </span>
                            </a>
                            <div class="contact-row contact-row--static">
                                <span class="contact-row__icon">
                                    <AssetIcon name="clock" :size="16" />
                                </span>
                                <span>
                                    <span class="contact-row__label">Support hours</span>
                                    <span class="contact-row__value">{{ contactInfo.hours }}</span>
                                </span>
                            </div>
                        </div>

                        <a :href="`mailto:${contactInfo.email}?subject=Report%20a%20problem`" class="btn-primary btn-block">
                            <AssetIcon name="flag" :size="16" />
                            Report a problem
                        </a>
                    </div>

                    <div class="panel legal-panel">
                        <NuxtLink to="/legal/terms" class="legal-link">
                            <AssetIcon name="file-text" :size="15" />
                            <span class="legal-link__text">Terms of Service</span>
                            <AssetIcon name="arrow-right" :size="14" />
                        </NuxtLink>
                        <NuxtLink to="/legal/privacy" class="legal-link">
                            <AssetIcon name="shield" :size="15" />
                            <span class="legal-link__text">Privacy Policy</span>
                            <AssetIcon name="arrow-right" :size="14" />
                        </NuxtLink>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true,
})

import AssetIcon from '~/components/common/AssetIcon.vue'
import { supportService } from '~/api/support/SupportService'


// Page-load skeleton same pattern as the rest of the dashboard. The FAQ
// topics themselves are static copy, but contact info (hotline/email/hours)
// is the kind of thing a blood center admin would actually configure on the
// backend, so that's what gates the loading state here.
const loading = ref(true)

const contactInfo = reactive({
    hotline: '+63281234567',
    hotlineLabel: '(02) 8123-4567',
    email: 'support@bloodcenter.example',
    hours: 'Mon - Sat, 8:00 AM - 5:00 PM',
})

const quickTopics = [
    {
        key: 'eligibility',
        icon: 'clipboard',
        tone: 'primary',
        title: 'Eligibility Screening',
        desc: 'Answer or retake your health questionnaire.',
        route: '/donor/eligibility',
    },
    {
        key: 'qr',
        icon: 'qr-code',
        tone: 'success',
        title: 'QR Code & Appointments',
        desc: 'Get a new check-in code, or book a visit.',
        route: '/donor/qrcode',
    },
    {
        key: 'history',
        icon: 'history',
        tone: 'warning',
        title: 'Donation History',
        desc: "A donation isn't showing up in your records.",
        route: '/donor/history',
    },
    {
        key: 'account',
        icon: 'lock',
        tone: 'danger',
        title: 'Account & Security',
        desc: 'Change your password or manage your account.',
        route: '/donor/settings',
    },
]

// Copy checked against the server's config/donation.php: 56-day interval,
// screening answers valid 90 days, check-in code valid 14 days, questionnaire
// opens 1 day before an appointment, cancel any time before it.
const faqs = reactive([
    {
        id: 'freq',
        question: 'How often can I donate blood?',
        answer: 'You can give whole blood again 56 days (8 weeks) after your last donation. Your next eligible date is on your Profile, and the booking page will not offer dates before it.',
    },
    {
        id: 'when-questionnaire',
        question: 'When do I answer the health questionnaire?',
        answer: 'The day before your appointment. It opens one day before, and we email you a reminder. Your check-in QR code is generated as soon as you submit it.',
    },
    {
        id: 'deferred',
        question: 'Does a "Yes" answer mean I cannot donate?',
        answer: 'No. The questionnaire does not decide that on its own. Blood center staff go through your answers with you and do a short physical check (blood pressure, hemoglobin, weight) before deciding. If you cannot donate that day it is often temporary, and they will tell you when you can come back.',
    },
    {
        id: 'qr-validity',
        question: 'How long is my QR code valid for?',
        answer: 'A check-in code is valid for 14 days once it is issued. That is separate from your questionnaire answers, which stay valid for 90 days. If the code runs out while your answers are still valid, get a new one from My QR Code without answering again.',
    },
    {
        id: 'qr-share',
        question: 'Is it safe to share my QR code with others?',
        answer: 'No. Your QR code is personal and tied to your own screening answers. Do not share it with anyone; only show it to blood center staff when you arrive.',
    },
    {
        id: 'missed-appointment',
        question: 'What if I miss my appointment?',
        answer: 'Your questionnaire answers stay valid until they expire, so just book another date and time. You can also cancel or reschedule any time before the appointment starts.',
    },
    {
        id: 'wrong-blood-type',
        question: 'What if my blood type on record is incorrect?',
        answer: 'Blood type is only confirmed through lab testing at the center. If something looks wrong, contact support and our staff will help you get it corrected.',
    },
])

const openFaqId = ref(null)

// Search: every word typed has to appear in the question or the answer.
const query = ref('')
const filteredFaqs = computed(() => {
    const words = query.value.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return faqs
    return faqs.filter(faq => {
        const text = `${faq.question} ${faq.answer}`.toLowerCase()
        return words.every(word => text.includes(word))
    })
})

// While searching, matches open by default so the answer is right there;
// the donor can still fold any of them away.
const foldedWhileSearching = ref(new Set())
watch(query, () => { foldedWhileSearching.value = new Set() })

function isOpen(id) {
    if (query.value.trim()) return !foldedWhileSearching.value.has(id)
    return openFaqId.value === id
}

function toggleFaq(id) {
    if (query.value.trim()) {
        const next = new Set(foldedWhileSearching.value)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        foldedWhileSearching.value = next
        return
    }
    openFaqId.value = openFaqId.value === id ? null : id
}

// Gi-keepalive ni nga page. Tan-awa ang AppointmentsPage para sa detalye —
// ang onActivated mo-refresh sa background nga walay skeleton, ug gi-guard sa
// loadedOnce kay mo-fire sad siya human sa unang onMounted.
let loadedOnce = false

async function load({ silent = false } = {}) {
    if (!silent) loading.value = true
    try {
        // GET /api/support/contact-info
        // Public ni nga endpoint (walay auth middleware). Gitugotan ani ang
        // blood center nga mo-usab sa hotline/email/hours nga walay redeploy.
        // Response: { hotline, hotline_label, email, hours }
        const data = await supportService.contactInfo()
        if (data?.hotline) contactInfo.hotline = data.hotline
        if (data?.hotline_label) contactInfo.hotlineLabel = data.hotline_label
        if (data?.email) contactInfo.email = data.email
        if (data?.hours) contactInfo.hours = data.hours
    } catch (err) {
        // Kung mapakyas, mag-fallback ra sa hardcoded nga contact details.
        console.error('Failed to load support contact info:', err)
    } finally {
        loading.value = false
        loadedOnce = true
    }
}

onMounted(() => load())
onActivated(() => {
    if (loadedOnce) load({ silent: true })
})
</script>

<style scoped>
.help-page {
    --primary: var(--rb-primary);
    --accent: #C62828;
    --success: #2e7d32;
    --warning: #B45309;
    --text-primary: #1f2937;
    --text-secondary: #94A3B8;
    --border: #eef0f3;
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px 32px 40px;
    display: flex;
    background: var(--rb-page-bg);
    flex-direction: column;
    gap: 20px;
    transition: background-color 0.2s ease;
}

/* Skeleton loading */
.skeleton-wrap { display: flex; flex-direction: column; gap: 20px; }

.skeleton {
    background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
    background-size: 400% 100%;
    border-radius: 20px;
    animation: shimmer 1.4s ease infinite;
}

.skeleton--header { height: 150px; }
.skeleton-topics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.skeleton--topic { height: 120px; }
.skeleton-main-grid { display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start; }
.skeleton-col { display: flex; flex-direction: column; gap: 20px; }

@keyframes shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
    .skeleton { animation: none !important; }
}

@media (max-width: 900px) {
    .skeleton-topics-grid { grid-template-columns: 1fr 1fr; }
    .skeleton-main-grid { grid-template-columns: 1fr; }
}

/* ── Search hero ── */
.help-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 30px 24px 28px;
    border: 1px solid var(--border);
    border-radius: 24px;
    background:
        radial-gradient(120% 140% at 50% 0%, rgba(var(--rb-primary-rgb), 0.08), transparent 60%),
        white;
    text-align: center;
}

.page-title {
    margin: 0;
    font-size: var(--rb-fs-display);
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--text-primary);
}

.page-subtitle { margin: 4px 0 0; font-size: var(--rb-fs-small); color: #64748B; }

.help-search {
    position: relative;
    width: 100%;
    max-width: 560px;
    margin-top: 18px;
}

.help-search__icon {
    position: absolute;
    top: 50%;
    left: 18px;
    transform: translateY(-50%);
    color: #94A3B8;
    pointer-events: none;
}

.help-search__input {
    width: 100%;
    height: 50px;
    padding: 0 48px 0 48px;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    background: white;
    font: inherit;
    font-size: var(--rb-fs-body);
    color: var(--text-primary);
    box-shadow: 0 10px 28px -20px rgba(15, 23, 42, 0.45);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.help-search__input::placeholder { color: #94A3B8; }
.help-search__input::-webkit-search-cancel-button { display: none; }

.help-search__input:focus {
    outline: none;
    border-color: var(--rb-primary);
    box-shadow: 0 0 0 4px rgba(var(--rb-primary-rgb), 0.14);
}

.help-search__clear {
    position: absolute;
    top: 50%;
    right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    transform: translateY(-50%);
    border: none;
    border-radius: 50%;
    background: #f1f5f9;
    color: #64748B;
    cursor: pointer;
}

.help-search__clear:hover { background: #e2e8f0; color: var(--text-primary); }

/* ── Topic tiles ── */
.topics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }

.topic-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 18px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: white;
    text-decoration: none;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    transition: border-color 0.15s ease, transform 0.15s ease;
}

.topic-card:hover { border-color: rgba(var(--rb-primary-rgb), 0.4); transform: translateY(-1px); }
.topic-card:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.topic-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-bottom: 8px;
    border-radius: 12px;
}

.topic-card__icon--primary { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.topic-card__icon--success { background: #eaf6ea; color: var(--success); }
.topic-card__icon--warning { background: #fff4e5; color: var(--warning); }
.topic-card__icon--danger { background: #fdecec; color: var(--accent); }

.topic-card__title { margin: 0; font-size: var(--rb-fs-body); font-weight: 700; color: var(--text-primary); }
.topic-card__desc { margin: 0; font-size: var(--rb-fs-caption); line-height: 1.45; color: #64748B; }

.topic-card__arrow {
    position: absolute;
    top: 20px;
    right: 18px;
    color: #CBD5E1;
    transition: color 0.15s ease, transform 0.15s ease;
}

.topic-card:hover .topic-card__arrow { color: var(--rb-primary-text); transform: translateX(2px); }

/* ── Layout ── */
.main-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
.col-left, .col-right { display: flex; flex-direction: column; gap: 20px; }

.panel {
    border: 1px solid var(--border);
    border-radius: 20px;
    background: white;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    overflow: hidden;
}

.panel-header--simple {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px 14px;
    border-bottom: 1px solid #f1f5f9;
}

.panel-title { margin: 0; font-size: var(--rb-fs-section); font-weight: 700; color: var(--text-primary); }
.panel-count { font-size: var(--rb-fs-caption); font-weight: 600; color: #64748B; }

/* ── FAQ accordion ── */
.faq-list { display: flex; flex-direction: column; padding: 8px; }

.faq-item { border-radius: 14px; transition: background-color 0.15s ease; }
.faq-item + .faq-item { margin-top: 2px; }
.faq-item--open { background: #f8fafc; }

.faq-question {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 14px 14px;
    border: none;
    border-radius: 14px;
    background: none;
    font: inherit;
    font-size: var(--rb-fs-body);
    font-weight: 600;
    text-align: left;
    color: var(--text-primary);
    cursor: pointer;
}

.faq-question:hover { background: #f8fafc; }
.faq-question:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: -2px; }

.faq-question__toggle {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #f1f5f9;
    color: #64748B;
    transition: background-color 0.15s ease, color 0.15s ease;
}

.faq-item--open .faq-question__toggle { background: var(--rb-primary); color: #fff; }

.faq-answer { padding: 0 54px 16px 14px; }
.faq-answer p { margin: 0; font-size: var(--rb-fs-small); line-height: 1.65; color: #475569; }

.faq-empty { padding: 28px 16px; text-align: center; }
.faq-empty__title { margin: 0; font-size: var(--rb-fs-body); font-weight: 700; color: var(--text-primary); }
.faq-empty__sub { margin: 4px 0 0; font-size: var(--rb-fs-small); color: #64748B; }

/* ── Contact support ── */
.contact-list { display: flex; flex-direction: column; gap: 4px; padding: 10px 10px 6px; }

.contact-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 14px;
    text-decoration: none;
    transition: background-color 0.15s ease;
}

a.contact-row:hover { background: #f8fafc; }
a.contact-row:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

.contact-row__icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: rgba(var(--rb-primary-rgb), 0.1);
    color: var(--rb-primary-text);
}

.contact-row__label { display: block; font-size: var(--rb-fs-caption); color: #64748B; }
.contact-row__value { display: block; font-size: var(--rb-fs-small); font-weight: 700; color: var(--text-primary); }
a.contact-row:hover .contact-row__value { color: var(--rb-primary-text); }

/* ── Legal links ── */
.legal-panel { display: flex; flex-direction: column; padding: 8px; }

.legal-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 12px;
    border-radius: 12px;
    font-size: var(--rb-fs-small);
    font-weight: 600;
    color: var(--text-primary);
    text-decoration: none;
}

.legal-link__text { flex: 1; }
.legal-link :deep(svg) { color: #94A3B8; }
.legal-link:hover { background: #f8fafc; color: var(--rb-primary-text); }
.legal-link:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

/* ── Buttons ── */
.btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 11px 20px;
    border: none;
    border-radius: 999px;
    background: var(--primary);
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: white;
    text-decoration: none;
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.btn-primary:hover { background: var(--rb-primary-hover); }
.btn-primary:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.btn-block { width: calc(100% - 40px); margin: 6px 20px 20px; }

@media (prefers-reduced-motion: reduce) {
    .topic-card, .topic-card__arrow, .faq-item, .faq-question__toggle, .help-search__input { transition: none; }
}

@media (max-width: 1100px) {
    .topics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 900px) {
    .main-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 640px) {
    .help-page { padding: 16px 16px 32px; }
    .help-hero { padding: 22px 16px; }
    .page-title { font-size: var(--rb-fs-title); }
    .topics-grid { gap: 10px; }
    .topic-card { padding: 14px; }
    .topic-card__desc { display: none; }
    .topic-card__arrow { top: 16px; right: 14px; }
    .faq-answer { padding-right: 14px; }
}

/* ============ Dark mode ============ */
:global(.dark .help-page) {
    --text-primary: var(--ink-text, #F1F5F9);
    --text-secondary: var(--ink-text-2, #94A3B8);
    --border: var(--ink-border, #334155);
    background: var(--ink-page, #0F172A);
}

:global(.dark .help-page .topic-card),
:global(.dark .help-page .panel) { background: var(--ink-surface, #1E293B); border-color: var(--ink-border, #334155); }
:global(.dark .help-page .help-hero) {
    background:
        radial-gradient(120% 140% at 50% 0%, color-mix(in srgb, var(--rb-primary-text) 12%, transparent), transparent 60%),
        var(--ink-surface, #1E293B);
    border-color: var(--ink-border, #334155);
}
:global(.dark .help-page .help-search__input) { background: var(--ink-page, #0F172A); border-color: var(--ink-border, #334155); color: var(--ink-text, #F1F5F9); }
:global(.dark .help-page .help-search__clear) { background: var(--ink-hover, #263449); color: var(--ink-text-3, #CBD5E1); }
:global(.dark .help-page .topic-card__icon--primary),
:global(.dark .help-page .contact-row__icon) { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }
:global(.dark .help-page .topic-card__icon--success) { background: rgba(102, 187, 106, 0.16); color: #81C784; }
:global(.dark .help-page .topic-card__icon--warning) { background: rgba(255, 167, 38, 0.16); color: #FFB74D; }
:global(.dark .help-page .topic-card__icon--danger) { background: rgba(239, 83, 80, 0.16); color: #EF9A9A; }
:global(.dark .help-page .panel-header--simple) { border-color: var(--ink-border, #334155); }
:global(.dark .help-page .faq-item--open),
:global(.dark .help-page .faq-question:hover),
:global(.dark .help-page a.contact-row:hover),
:global(.dark .help-page .legal-link:hover) { background: var(--ink-hover, #263449); }
:global(.dark .help-page .faq-question__toggle) { background: var(--ink-hover, #263449); color: var(--ink-text-3, #CBD5E1); }
:global(.dark .help-page .faq-item--open .faq-question__toggle) { background: var(--rb-primary); color: #fff; }
:global(.dark .help-page .faq-answer p),
:global(.dark .help-page .topic-card__desc),
:global(.dark .help-page .page-subtitle) { color: var(--ink-text-3, #CBD5E1); }

/* background-image, not the shorthand: keeps the 400% size for the shimmer. */
:global(.dark .help-page .skeleton) {
    background-image: linear-gradient(90deg, var(--ink-surface, #1E293B) 25%, var(--ink-hover, #263449) 37%, var(--ink-surface, #1E293B) 63%);
}
</style>
