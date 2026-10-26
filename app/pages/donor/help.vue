<template>
    <div class="help-page">
        <!-- Skeleton loading state -->
        <div v-if="loading" class="skeleton-wrap">
            <div class="skeleton skeleton--header" />
            <div class="skeleton skeleton--situation" />
            <div class="skeleton-main-grid">
                <div class="skeleton-col">
                    <div class="skeleton skeleton--panel" style="height:420px" />
                </div>
                <div class="skeleton-col">
                    <div class="skeleton skeleton--panel" style="height:260px" />
                    <div class="skeleton skeleton--panel" style="height:90px" />
                </div>
            </div>
        </div>

        <template v-else>
            <!-- Ask a question; the answers filter as you type -->
            <section class="help-hero" aria-labelledby="help-title">
                <h1 id="help-title" class="page-title">How can we help?</h1>
                <p class="page-subtitle">Search the common questions, or reach the support team.</p>
                <div class="help-search">
                    <AssetIcon name="search" :size="18" class="help-search__icon" />
                    <input
                        v-model="query"
                        type="search"
                        class="help-search__input"
                        placeholder="Try &quot;QR code&quot;, &quot;reschedule&quot; or &quot;blood drive&quot;"
                        aria-label="Search help"
                        aria-controls="faq-list"
                    >
                    <button v-if="query" type="button" class="help-search__clear" aria-label="Clear search" @click="query = ''">
                        <AssetIcon name="x" :size="16" />
                    </button>
                </div>
                <!-- One click to what donors ask most -->
                <div class="popular" aria-label="Popular searches">
                    <span class="popular__label">Popular:</span>
                    <button v-for="term in POPULAR" :key="term" type="button" class="popular__chip"
                        :class="{ 'popular__chip--on': query === term }" @click="query = query === term ? '' : term">
                        {{ term }}
                    </button>
                </div>
            </section>

            <!--
              For you right now: the question this donor most likely has,
              from where they are (deferred, booked, resting, ready).
            -->
            <section v-if="situation" class="situation" :class="`situation--${situation.tone}`" aria-labelledby="situation-title">
                <span class="situation__icon" aria-hidden="true"><AssetIcon :name="situation.icon" :size="20" /></span>
                <div class="situation__body">
                    <p class="situation__kicker">For you right now</p>
                    <h2 id="situation-title" class="situation__title">{{ situation.title }}</h2>
                    <p class="situation__text">{{ situation.text }}</p>
                </div>
                <div class="situation__actions">
                    <NuxtLink v-if="situation.link" :to="situation.link.to" class="btn-primary">
                        {{ situation.link.label }}
                        <AssetIcon name="arrow-right" :size="14" />
                    </NuxtLink>
                    <button v-if="situation.faq" type="button" class="btn-ghost" @click="showFaq(situation.faq)">
                        Learn more
                    </button>
                </div>
            </section>

            <div class="main-grid">
                <!-- FAQ, by topic -->
                <div class="col-left">
                    <div class="panel">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Frequently asked questions</h2>
                            <span v-if="query" class="panel-count" aria-live="polite">
                                {{ filteredFaqs.length }} result{{ filteredFaqs.length === 1 ? '' : 's' }}
                            </span>
                        </div>

                        <div class="cats" role="tablist" aria-label="Help topics">
                            <button v-for="cat in categoryTabs" :key="cat.key" type="button" role="tab"
                                class="cat" :class="{ 'cat--on': activeCategory === cat.key }"
                                :aria-selected="activeCategory === cat.key" @click="activeCategory = cat.key">
                                <AssetIcon v-if="cat.icon" :name="cat.icon" :size="14" />
                                {{ cat.label }}
                                <span class="cat__count">{{ cat.count }}</span>
                            </button>
                        </div>

                        <div id="faq-list" class="faq-list">
                            <section v-for="group in groupedFaqs" :key="group.key" class="faq-group"
                                :aria-label="group.label">
                                <h3 v-if="groupedFaqs.length > 1" class="faq-group__title">{{ group.label }}</h3>
                                <div v-for="faq in group.items" :id="`faq-${faq.id}`" :key="faq.id" class="faq-item"
                                    :class="{ 'faq-item--open': isOpen(faq.id) }">
                                    <button
                                        :id="`faq-q-${faq.id}`"
                                        type="button"
                                        class="faq-question"
                                        :aria-expanded="isOpen(faq.id)"
                                        :aria-controls="`faq-a-${faq.id}`"
                                        @click="toggleFaq(faq.id)"
                                    >
                                        <span>
                                            <template v-for="(part, i) in highlight(faq.question)" :key="i">
                                                <mark v-if="part.hit">{{ part.text }}</mark><template v-else>{{ part.text }}</template>
                                            </template>
                                        </span>
                                        <span class="faq-question__toggle" aria-hidden="true">
                                            <AssetIcon :name="isOpen(faq.id) ? 'x' : 'plus'" :size="14" />
                                        </span>
                                    </button>
                                    <div v-if="isOpen(faq.id)" :id="`faq-a-${faq.id}`" class="faq-answer"
                                        role="region" :aria-labelledby="`faq-q-${faq.id}`">
                                        <p>
                                            <template v-for="(part, i) in highlight(faq.answer)" :key="i">
                                                <mark v-if="part.hit">{{ part.text }}</mark><template v-else>{{ part.text }}</template>
                                            </template>
                                        </p>
                                        <NuxtLink v-if="faq.link" :to="faq.link.to" class="faq-answer__link">
                                            {{ faq.link.label }}
                                            <AssetIcon name="arrow-right" :size="13" />
                                        </NuxtLink>
                                    </div>
                                </div>
                            </section>

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
                            <span v-if="supportOpen !== null" class="open-badge"
                                :class="supportOpen ? 'open-badge--open' : 'open-badge--closed'">
                                {{ supportOpen ? 'Open now' : 'Closed now' }}
                            </span>
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
                        <!-- The email arrives with what support asks first: who, where, on what. -->
                        <a :href="reportHref" class="btn-primary btn-block">
                            <AssetIcon name="flag" :size="16" />
                            Report a problem
                        </a>
                        <p class="report-note">Your donor ID, the page and your browser are added to the email for you.</p>
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
import { donorService } from '~/api/donor/DonorService'

// Page-load skeleton same pattern as the rest of the dashboard. The FAQ is
// static copy; the contact details are configured on the server and the
// "for you" card reads the donor's own state, so those gate the loading.
const loading = ref(true)

const contactInfo = reactive({
    hotline: '+63281234567',
    hotlineLabel: '(02) 8123-4567',
    email: 'support@bloodcenter.example',
    hours: 'Mon - Sat, 8:00 AM - 5:00 PM',
})

// ── Topics and answers ──
//
// Copy checked against the server's config/donation.php and services:
// 56-day interval, answers valid 90 days, the questionnaire opens 1 day before
// an appointment, a check-in code lasts 14 days but never past the end of the
// appointment day it was made for, no code during the rest interval, cancel
// any time before the visit, donors 18 and over and at least 50 kg.
const CATEGORIES = [
    { key: 'booking', label: 'Booking', icon: 'calendar' },
    { key: 'screening', label: 'Screening & QR', icon: 'clipboard-list' },
    { key: 'donation', label: 'Donation day', icon: 'droplets' },
    { key: 'account', label: 'Account & privacy', icon: 'user-circle' },
]

const faqs = [
    // Booking
    {
        id: 'how-book', category: 'booking',
        question: 'How do I book a donation?',
        answer: 'Open Book Appointment and choose either a time slot at a blood center or a mobile blood drive. You can hold one booking at a time.',
        link: { to: '/donor/appointments', label: 'Book a donation' },
    },
    {
        id: 'drives', category: 'booking',
        question: 'What is a mobile blood drive?',
        answer: 'A blood center sets up for a day at a school, mall or barangay hall. Upcoming drives are on Home and on the booking page, and you can be told when a blood center you have visited schedules one.',
        link: { to: '/donor/appointments?type=mobile', label: 'See blood drives' },
    },
    {
        id: 'reschedule', category: 'booking',
        question: 'Can I cancel or reschedule?',
        answer: 'Yes, any time before your appointment starts. Open Book Appointment and use Reschedule or Cancel on your booking.',
        link: { to: '/donor/appointments', label: 'Manage my booking' },
    },
    {
        id: 'missed-appointment', category: 'booking',
        question: 'What if I miss my appointment?',
        answer: 'Just book another date. Your health answers stay valid until they expire, so you may not need to answer again. The check-in code made for the missed visit stops working at the end of that day.',
    },
    {
        id: 'freq', category: 'booking',
        question: 'How often can I donate blood?',
        answer: 'You can give whole blood again 56 days (8 weeks) after your last donation. Home shows your next eligible date, and the booking page will not offer dates before it.',
    },

    // Screening & QR
    {
        id: 'when-questionnaire', category: 'screening',
        question: 'When do I answer the health questions?',
        answer: 'The day before your appointment, when they open. You get a reminder in the portal, and by email too if Appointments email is on in Settings. Your answers then stay valid for 90 days.',
        link: { to: '/donor/eligibility', label: 'Go to Eligibility Screening' },
    },
    {
        id: 'yes-answer', category: 'screening',
        question: 'Does a "Yes" answer mean I cannot donate?',
        answer: 'No. The questions do not decide that on their own. Blood center staff go through your answers with you and do a short check (blood pressure, hemoglobin, weight) before deciding.',
    },
    {
        id: 'deferral', category: 'screening',
        question: 'What does it mean if I am deferred?',
        answer: 'It means you should not donate for now, to keep you and the patient safe. Most deferrals are temporary: Home shows the date you can give again. Your deferral notice gives a code, such as R1, instead of the reason, to keep it private; the blood center can tell you what it means and what to do next.',
    },
    {
        id: 'qr-when', category: 'screening',
        question: 'When do I get my QR code?',
        answer: 'Once you have a booking and your health answers are in, your check-in code is made for you on My QR Code. Show it to the staff when you arrive.',
        link: { to: '/donor/qrcode', label: 'Open My QR Code' },
    },
    {
        id: 'qr-validity', category: 'screening',
        question: 'How long is my QR code valid?',
        answer: 'A code made for a booking works until the end of that appointment day. Otherwise it lasts up to 14 days, and never longer than your health answers. Making a new code stops the old one, including any copy you saved.',
    },
    {
        id: 'qr-rest', category: 'screening',
        question: 'Why is there no QR code after I donated?',
        answer: 'Your code is closed once your donation is recorded, and no new one is made while your body rests before the next donation. It comes back when you book again after your next eligible date.',
    },
    {
        id: 'qr-share', category: 'screening',
        question: 'Is it safe to share my QR code?',
        answer: 'No. Your code is personal and tied to your own health answers. Only show it to blood center staff when you arrive.',
    },

    // Donation day
    {
        id: 'who', category: 'donation',
        question: 'Who can donate blood?',
        answer: 'Donors who are 18 or older, weigh at least 50 kg and feel well on the day. The health questions and the check at the blood center confirm the rest.',
    },
    {
        id: 'prepare', category: 'donation',
        question: 'How should I prepare?',
        answer: 'Sleep well the night before, eat a full meal and drink plenty of water. Bring a valid ID and your QR code. The whole visit usually takes under an hour.',
    },
    {
        id: 'wrong-blood-type', category: 'donation',
        question: 'What if my blood type on record is wrong?',
        answer: 'Your blood type is confirmed by lab testing at the blood center. If it looks wrong, contact support and the staff will help you get it corrected.',
    },
    {
        id: 'history-missing', category: 'donation',
        question: 'A donation is not showing in my history',
        answer: 'A donation appears once the blood center records it, which can take a little while after your visit. If it is still missing after a few days, contact support with the date and place you donated.',
        link: { to: '/donor/history', label: 'Open Donation History' },
    },

    // Account & privacy
    {
        id: 'notifications', category: 'account',
        question: 'How do I choose which notifications I get?',
        answer: 'In Settings, under Notifications, turn each topic on or off in the portal and by email. Notices about your appointments, donation results and account always appear in the portal.',
        link: { to: '/donor/settings#notifications', label: 'Notification settings' },
    },
    {
        id: 'appearance', category: 'account',
        question: 'Can I change the colours or use dark mode?',
        answer: 'Yes. In Settings, under Appearance, pick light, dark or your device setting, and any colour for the portal. The choice is saved on this device.',
        link: { to: '/donor/settings', label: 'Open Settings' },
    },
    {
        id: 'password', category: 'account',
        question: 'How do I change my password?',
        answer: 'In Settings, under Password & security, enter your current password and a new one.',
        link: { to: '/donor/settings', label: 'Open Settings' },
    },
    {
        id: 'id-verify', category: 'account',
        question: 'Why do I need to verify my ID?',
        answer: 'It confirms that the donor records are really yours. Upload a valid ID on My Profile; blood center staff review it and you are told the result.',
        link: { to: '/donor/profile', label: 'Open My Profile' },
    },
    {
        id: 'privacy', category: 'account',
        question: 'Who can see my health answers?',
        answer: 'Only blood center staff who handle your donation. They are used to decide whether you can donate safely. The Privacy Policy explains how your data is kept.',
        link: { to: '/legal/privacy', label: 'Read the Privacy Policy' },
    },
]

const POPULAR = ['QR code', 'Reschedule', 'Deferred', 'Blood drive', 'Notifications']

// ── Filtering ──
const query = ref('')
const activeCategory = ref('all')

const searchWords = computed(() => query.value.toLowerCase().split(/\s+/).filter(Boolean))

// Every word typed has to appear in the question or the answer. A search
// looks across all topics, so the topic pills show where the matches are.
const matching = computed(() => {
    const words = searchWords.value
    if (!words.length) return faqs
    return faqs.filter((faq) => {
        const text = `${faq.question} ${faq.answer}`.toLowerCase()
        return words.every(word => text.includes(word))
    })
})

const filteredFaqs = computed(() => activeCategory.value === 'all'
    ? matching.value
    : matching.value.filter(faq => faq.category === activeCategory.value))

const categoryTabs = computed(() => [
    { key: 'all', label: 'All', count: matching.value.length },
    ...CATEGORIES.map(cat => ({ ...cat, count: matching.value.filter(faq => faq.category === cat.key).length })),
])

const groupedFaqs = computed(() => CATEGORIES
    .map(cat => ({ ...cat, items: filteredFaqs.value.filter(faq => faq.category === cat.key) }))
    .filter(group => group.items.length))

// A new search starts from all topics.
watch(query, () => { activeCategory.value = 'all' })

/** The text split around the searched words, so the matches can be marked. */
function highlight(text) {
    const words = searchWords.value
    if (!words.length) return [{ text, hit: false }]
    const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
    return text.split(pattern).filter(Boolean).map(part => ({ text: part, hit: words.includes(part.toLowerCase()) }))
}

// ── Open answers ──
const openFaqId = ref(null)

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

/** Open one answer and bring it into view (the "Learn more" on the card). */
async function showFaq(id) {
    query.value = ''
    activeCategory.value = 'all'
    openFaqId.value = id
    await nextTick()
    document.getElementById(`faq-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

// ── For you right now ──
const dashboard = ref(null)
const deferral = ref(null)
const nextEligibleDate = ref(null)
const donorCode = ref('')

// 'MMM D' or 'MMM D, YYYY' from a date or 'YYYY-MM-DD' (read as local, not UTC).
function formatDate(value, fmt) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T00:00:00`) : new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', fmt.includes('YYYY') ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' })
}

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const situation = computed(() => {
    const today = dayKey(new Date())
    const tomorrow = dayKey(new Date(Date.now() + 86_400_000))

    if (deferral.value?.deferred) {
        return deferral.value.until
            ? {
                tone: 'warning', icon: 'info',
                title: `You can give again from ${formatDate(deferral.value.until, 'MMM D, YYYY')}`,
                text: 'You are deferred for now, which keeps you and the patient safe. Book again from that date.',
                faq: 'deferral',
            }
            : {
                tone: 'warning', icon: 'info',
                title: 'About your deferral',
                text: 'You should not donate for now. The blood center can explain what this means for you; call or email support below.',
                faq: 'deferral',
            }
    }

    const visit = dashboard.value?.upcoming_appointment
    const visitDay = visit?.appointment_datetime ? dayKey(new Date(visit.appointment_datetime)) : null
    const answered = dashboard.value?.questionnaire_status === 'answered'

    if (visitDay === today) {
        return {
            tone: 'primary', icon: 'qr-code',
            title: 'Your visit is today',
            text: answered
                ? 'Bring a valid ID and show your QR code to the staff when you arrive.'
                : 'Answer your health questions before you go, then show your QR code at the blood center.',
            link: answered ? { to: '/donor/qrcode', label: 'Open My QR Code' } : { to: '/donor/eligibility', label: 'Answer now' },
            faq: 'prepare',
        }
    }
    if (visitDay === tomorrow && !answered) {
        return {
            tone: 'primary', icon: 'clipboard-list',
            title: 'Answer your health questions',
            text: 'Your visit is tomorrow, and the questions are open now. Your QR code is made once you submit them.',
            link: { to: '/donor/eligibility', label: 'Answer now' },
            faq: 'when-questionnaire',
        }
    }
    if (visitDay) {
        return {
            tone: 'primary', icon: 'calendar-check',
            title: `You are booked for ${formatDate(visit.appointment_datetime, 'MMM D')}`,
            text: 'Your health questions open the day before. You can reschedule or cancel any time before your visit.',
            link: { to: '/donor/appointments', label: 'View my booking' },
            faq: 'when-questionnaire',
        }
    }

    const next = nextEligibleDate.value ? String(nextEligibleDate.value).slice(0, 10) : null
    if (next && next > today) {
        return {
            tone: 'success', icon: 'droplets',
            title: `Resting until ${formatDate(next, 'MMM D, YYYY')}`,
            text: 'Your body needs 56 days between whole blood donations. You can book a visit for that date or later.',
            faq: 'freq',
        }
    }

    return {
        tone: 'primary', icon: 'calendar',
        title: 'Ready to give?',
        text: 'Book a time at a blood center or join a mobile blood drive near you.',
        link: { to: '/donor/appointments', label: 'Book a donation' },
        faq: 'how-book',
    }
})

// ── Contact support ──

// "Open now" from hours written like "Mon - Sat, 8:00 AM - 5:00 PM". Null
// (no badge) for hours in any other form, rather than a wrong guess.
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const nowTick = ref(Date.now())
let nowTimer = null

const supportOpen = computed(() => {
    const m = /^(\w{3})\w*\s*-\s*(\w{3})\w*,\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*-\s*(\d{1,2}):(\d{2})\s*([AP]M)$/i
        .exec(contactInfo.hours.trim())
    if (!m) return null
    const from = DAYS.indexOf(m[1].toLowerCase())
    const to = DAYS.indexOf(m[2].toLowerCase())
    if (from < 0 || to < 0) return null
    const mins = (h, mm, ap) => ((Number(h) % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(mm)
    const now = new Date(nowTick.value)
    const day = now.getDay()
    const onDay = from <= to ? day >= from && day <= to : day >= from || day <= to
    const t = now.getHours() * 60 + now.getMinutes()
    return onDay && t >= mins(m[3], m[4], m[5]) && t < mins(m[6], m[7], m[8])
})

// The page the donor came from, if any, so support knows where it went wrong.
const router = useRouter()
const reportHref = computed(() => {
    const back = import.meta.client ? router.options.history.state?.back : null
    const lines = [
        'Describe what happened:',
        '',
        '',
        '---',
        `Donor ID: ${donorCode.value || 'not loaded'}`,
        `Page: ${back || 'not known'}`,
        `Browser: ${import.meta.client ? navigator.userAgent : ''}`,
    ]
    return `mailto:${contactInfo.email}?subject=${encodeURIComponent('Report a problem')}&body=${encodeURIComponent(lines.join('\n'))}`
})

// ── Loading ──
// Gi-keepalive ni nga page. Tan-awa ang AppointmentsPage para sa detalye —
// ang onActivated mo-refresh sa background nga walay skeleton, ug gi-guard sa
// loadedOnce kay mo-fire sad siya human sa unang onMounted.
let loadedOnce = false

async function load({ silent = false } = {}) {
    if (!silent) loading.value = true
    try {
        // GET /api/support/contact-info (public), plus the donor's own state
        // for the "for you" card. Each is best effort: without it the page
        // falls back to the hardcoded contact details or a general card.
        const [contact, dash, profile, deferralStatus] = await Promise.allSettled([
            supportService.contactInfo(),
            donorService.dashboard(),
            donorService.profile(),
            donorService.deferralStatus(),
        ])

        if (contact.status === 'fulfilled') {
            const data = contact.value
            if (data?.hotline) contactInfo.hotline = data.hotline
            if (data?.hotline_label) contactInfo.hotlineLabel = data.hotline_label
            if (data?.email) contactInfo.email = data.email
            if (data?.hours) contactInfo.hours = data.hours
        } else {
            console.error('Failed to load support contact info:', contact.reason)
        }
        if (dash.status === 'fulfilled') {
            dashboard.value = dash.value ?? null
            donorCode.value = dash.value?.profile?.donor_code ?? donorCode.value
        }
        if (profile.status === 'fulfilled') {
            nextEligibleDate.value = profile.value?.next_eligible_date ?? null
            donorCode.value = profile.value?.donor_code ?? donorCode.value
        }
        if (deferralStatus.status === 'fulfilled') deferral.value = deferralStatus.value ?? null
    } finally {
        loading.value = false
        loadedOnce = true
    }
}

onMounted(() => {
    load()
    nowTimer = setInterval(() => { nowTick.value = Date.now() }, 60_000)
})
onBeforeUnmount(() => clearInterval(nowTimer))
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
    --text-secondary: #64748B;
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

.skeleton--header { height: 190px; }
.skeleton--situation { height: 96px; }
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
    .skeleton-main-grid { grid-template-columns: 1fr; }
}

/* ── Search hero ── */
.help-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 30px 24px 24px;
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

.popular { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; margin-top: 14px; }
.popular__label { font-size: var(--rb-fs-caption); font-weight: 600; color: #64748B; }
.popular__chip {
    padding: 5px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    background: white;
    font: inherit;
    font-size: var(--rb-fs-caption);
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
}
.popular__chip:hover { border-color: rgba(var(--rb-primary-rgb), 0.4); }
.popular__chip--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.popular__chip:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

/* ── For you right now ── */
.situation {
    --tone-bg: rgba(var(--rb-primary-rgb), 0.08);
    --tone-fg: var(--rb-primary-text);
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: white;
}
.situation--warning { --tone-bg: #FFF4E5; --tone-fg: #B45309; }
.situation--success { --tone-bg: #EAF6EA; --tone-fg: #2E7D32; }
.situation__icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--tone-bg);
    color: var(--tone-fg);
}
.situation__body { flex: 1; min-width: 0; }
.situation__kicker { margin: 0; font-size: 11px; font-weight: 700; color: var(--tone-fg); }
.situation__title { margin: 2px 0 0; font-size: var(--rb-fs-section); font-weight: 700; color: var(--text-primary); }
.situation__text { margin: 3px 0 0; font-size: var(--rb-fs-small); line-height: 1.5; color: #475569; }
.situation__actions { display: flex; flex-shrink: 0; align-items: center; gap: 8px; }

.btn-ghost {
    padding: 10px 16px;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    background: transparent;
    font: inherit;
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: var(--text-primary);
    cursor: pointer;
}
.btn-ghost:hover { background: #f8fafc; }
.btn-ghost:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

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

/* ── Topic pills ── */
.cats { display: flex; gap: 6px; padding: 12px 16px 4px; overflow-x: auto; scrollbar-width: none; }
.cats::-webkit-scrollbar { display: none; }
.cat {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
    background: white;
    font: inherit;
    font-size: var(--rb-fs-small);
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
}
.cat:hover:not(.cat--on) { border-color: rgba(var(--rb-primary-rgb), 0.35); }
.cat--on { border-color: var(--rb-primary); background: var(--rb-primary); color: #fff; }
.cat:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.cat__count {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: #f1f5f9;
    font-size: 11px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    color: #475569;
}
.cat--on .cat__count { background: rgba(255, 255, 255, 0.25); color: #fff; }

/* ── FAQ accordion ── */
.faq-list { display: flex; flex-direction: column; padding: 8px; }
.faq-group + .faq-group { margin-top: 8px; }
.faq-group__title {
    margin: 10px 14px 4px;
    font-size: var(--rb-fs-caption);
    font-weight: 700;
    color: #64748B;
}

.faq-item { border-radius: 14px; transition: background-color 0.15s ease; scroll-margin-top: 90px; }
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
.faq-answer__link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: var(--rb-primary-text);
    text-decoration: none;
}
.faq-answer__link:hover { text-decoration: underline; }
.faq-answer__link:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; border-radius: 4px; }

mark { padding: 0 2px; border-radius: 3px; background: rgba(var(--rb-primary-rgb), 0.16); color: inherit; }

.faq-empty { padding: 28px 16px; text-align: center; }
.faq-empty__title { margin: 0; font-size: var(--rb-fs-body); font-weight: 700; color: var(--text-primary); }
.faq-empty__sub { margin: 4px 0 0; font-size: var(--rb-fs-small); color: #64748B; }

/* ── Contact support ── */
.open-badge { padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.open-badge--open { background: #E8F5E9; color: #1B5E20; }
.open-badge--closed { background: #f1f5f9; color: #475569; }

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
.contact-row__value { display: block; font-size: var(--rb-fs-small); font-weight: 700; color: var(--text-primary); word-break: break-word; }
a.contact-row:hover .contact-row__value { color: var(--rb-primary-text); }

.report-note { margin: -12px 20px 18px; font-size: var(--rb-fs-caption); line-height: 1.45; text-align: center; color: #64748B; }

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
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.btn-primary:hover { background: var(--rb-primary-hover); }
.btn-primary:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.btn-block { width: calc(100% - 40px); margin: 6px 20px 20px; }

@media (prefers-reduced-motion: reduce) {
    .faq-item, .faq-question__toggle, .help-search__input, .cat, .popular__chip { transition: none; }
}

@media (max-width: 900px) {
    .main-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 760px) {
    .situation { flex-wrap: wrap; align-items: flex-start; }
    .situation__body { flex-basis: calc(100% - 64px); }
    .situation__actions { width: 100%; }
    .situation__actions .btn-primary { flex: 1; }
}

@media (max-width: 640px) {
    .help-page { padding: 16px 16px 32px; }
    .help-hero { padding: 22px 16px 18px; }
    .page-title { font-size: var(--rb-fs-title); }
    .popular__label { display: none; }
    .situation { padding: 16px; }
    .cats { padding: 12px 12px 4px; }
    .faq-answer { padding-right: 14px; }
}

/* ============ Dark mode ============ */
:global(.dark .help-page) {
    --text-primary: var(--ink-text, #F1F5F9);
    --text-secondary: var(--ink-text-2, #94A3B8);
    --border: var(--ink-border, #334155);
    background: var(--ink-page, #0F172A);
}

:global(.dark .help-page .panel),
:global(.dark .help-page .situation) { background: var(--ink-surface, #1E293B); border-color: var(--ink-border, #334155); }
:global(.dark .help-page .help-hero) {
    background:
        radial-gradient(120% 140% at 50% 0%, color-mix(in srgb, var(--rb-primary-text) 12%, transparent), transparent 60%),
        var(--ink-surface, #1E293B);
    border-color: var(--ink-border, #334155);
}
:global(.dark .help-page .help-search__input) { background: var(--ink-page, #0F172A); border-color: var(--ink-border, #334155); color: var(--ink-text, #F1F5F9); }
:global(.dark .help-page .help-search__clear) { background: var(--ink-hover, #263449); color: var(--ink-text-3, #CBD5E1); }
:global(.dark .help-page .popular__chip),
:global(.dark .help-page .cat),
:global(.dark .help-page .btn-ghost) { background: var(--ink-page, #0F172A); border-color: var(--ink-border, #334155); color: var(--ink-text-3, #CBD5E1); }
:global(.dark .help-page .popular__chip--on) { border-color: var(--rb-primary-text); color: var(--rb-primary-text); }
:global(.dark .help-page .cat--on) { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
:global(.dark .help-page .cat__count) { background: var(--ink-hover, #263449); color: var(--ink-text-3, #CBD5E1); }
:global(.dark .help-page .contact-row__icon) { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }
:global(.dark .help-page .situation) { --tone-bg: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }
:global(.dark .help-page .situation--warning) { --tone-bg: rgba(255, 167, 38, 0.16); --tone-fg: #FFB74D; }
:global(.dark .help-page .situation--success) { --tone-bg: rgba(102, 187, 106, 0.16); --tone-fg: #81C784; }
:global(.dark .help-page .open-badge--open) { background: rgba(102, 187, 106, 0.16); color: #81C784; }
:global(.dark .help-page .open-badge--closed) { background: var(--ink-hover, #263449); color: var(--ink-text-3, #CBD5E1); }
:global(.dark .help-page .panel-header--simple) { border-color: var(--ink-border, #334155); }
:global(.dark .help-page .faq-item--open),
:global(.dark .help-page .faq-question:hover),
:global(.dark .help-page a.contact-row:hover),
:global(.dark .help-page .legal-link:hover),
:global(.dark .help-page .btn-ghost:hover) { background: var(--ink-hover, #263449); }
:global(.dark .help-page .faq-question__toggle) { background: var(--ink-hover, #263449); color: var(--ink-text-3, #CBD5E1); }
:global(.dark .help-page .faq-item--open .faq-question__toggle) { background: var(--rb-primary); color: #fff; }
:global(.dark .help-page .faq-answer p),
:global(.dark .help-page .situation__text),
:global(.dark .help-page .page-subtitle) { color: var(--ink-text-3, #CBD5E1); }
:global(.dark .help-page mark) { background: color-mix(in srgb, var(--rb-primary-text) 28%, transparent); }

/* background-image, not the shorthand: keeps the 400% size for the shimmer. */
:global(.dark .help-page .skeleton) {
    background-image: linear-gradient(90deg, var(--ink-surface, #1E293B) 25%, var(--ink-hover, #263449) 37%, var(--ink-surface, #1E293B) 63%);
}
</style>
