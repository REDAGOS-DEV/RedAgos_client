Exit code: 0
Wall time: 4.9 seconds
Output:
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
            <div class="header-row fade-in" style="--delay: 0ms">
                <h1 class="page-title">We're here to help!</h1>
                <p class="page-subtitle">Find answers to common questions or contact our support team for assistance.</p>
            </div>

            <!-- Quick help topics -->
            <div class="topics-grid fade-in" style="--delay: 50ms">
                <NuxtLink
                    v-for="topic in quickTopics"
                    :key="topic.key"
                    :to="topic.route"
                    class="topic-card"
                >
                    <div class="topic-card__icon" :class="`topic-card__icon--${topic.tone}`">
                        <AssetIcon :name="topic.icon" :size="18" />
                    </div>
                    <div class="topic-card__body">
                        <p class="topic-card__title">{{ topic.title }}</p>
                        <p class="topic-card__desc">{{ topic.desc }}</p>
                    </div>
                    <AssetIcon name="arrow-right" :size="16" class="topic-card__arrow" />
                </NuxtLink>
            </div>

            <div class="main-grid">
                <!-- FAQ -->
                <div class="col-left">
                    <div class="panel fade-in" style="--delay: 100ms">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Frequently Asked Questions</h2>
                        </div>
                        <div class="faq-list">
                            <div v-for="faq in faqs" :key="faq.id" class="faq-item">
                                <button
                                    type="button"
                                    class="faq-question"
                                    :aria-expanded="openFaqId === faq.id"
                                    @click="toggleFaq(faq.id)"
                                >
                                    <span>{{ faq.question }}</span>
                                    <AssetIcon
                                        name="chevron-down"
                                        :size="16"
                                        class="faq-question__chevron"
                                        :class="{ 'faq-question__chevron--open': openFaqId === faq.id }"
                                    />
                                </button>
                                <div v-if="openFaqId === faq.id" class="faq-answer">
                                    <p>{{ faq.answer }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Contact support -->
                <div class="col-right">
                    <div class="panel fade-in" style="--delay: 150ms">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Contact Support</h2>
                        </div>
                        <div class="contact-list">
                            <div class="contact-row">
                                <div class="contact-row__icon">
                                    <AssetIcon name="phone" :size="16" />
                                </div>
                                <div>
                                    <p class="contact-row__label">Hotline</p>
                                    <a :href="`tel:${contactInfo.hotline}`" class="contact-row__value">{{ contactInfo.hotlineLabel }}</a>
                                </div>
                            </div>
                            <div class="contact-row">
                                <div class="contact-row__icon">
                                    <AssetIcon name="mail" :size="16" />
                                </div>
                                <div>
                                    <p class="contact-row__label">Email</p>
                                    <a :href="`mailto:${contactInfo.email}`" class="contact-row__value">{{ contactInfo.email }}</a>
                                </div>
                            </div>
                            <div class="contact-row">
                                <div class="contact-row__icon">
                                    <AssetIcon name="clock" :size="16" />
                                </div>
                                <div>
                                    <p class="contact-row__label">Support hours</p>
                                    <p class="contact-row__value">{{ contactInfo.hours }}</p>
                                </div>
                            </div>
                        </div>

                        <a :href="`mailto:${contactInfo.email}?subject=Report%20a%20problem`" class="btn-primary btn-block">
                            <AssetIcon name="flag" :size="16" />
                            Report a problem
                        </a>
                    </div>

                    <div class="panel fade-in legal-panel" style="--delay: 200ms">
                        <NuxtLink to="/legal/Terms" class="legal-link">
                            Terms of Service
                            <AssetIcon name="arrow-right" :size="14" />
                        </NuxtLink>
                        <NuxtLink to="/legal/Privacy" class="legal-link">
                            Privacy Policy
                            <AssetIcon name="arrow-right" :size="14" />
                        </NuxtLink>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup>
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
        desc: 'Retake the screening or check why you were deferred.',
        route: '/donor/eligibility',
    },
    {
        key: 'qr',
        icon: 'qr-code',
        tone: 'success',
        title: 'QR Code & Appointments',
        desc: "Your QR expired, or you need to book a visit.",
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

const faqs = reactive([
    {
        id: 'freq',
        question: 'How often can I donate blood?',
        answer: "Whole blood donors can generally donate again after 90 days. Your exact next eligible date is shown on your Donation History page once a donation is recorded.",
    },
    {
        id: 'deferred',
        question: "What happens if I'm deferred during screening?",
        answer: "A deferral just means you're not eligible right now, it's usually temporary (e.g. recent illness or travel). Check the reason shown after your screening, and you can retake it once the waiting period has passed.",
    },
    {
        id: 'qr-validity',
        question: 'How long is my QR code valid for?',
        answer: 'Your QR code is tied to your eligibility screening result and stays valid for a limited window after you pass. Once it expires, you just need to retake the screening to get a new one.',
    },
    {
        id: 'qr-share',
        question: 'Is it safe to share my QR code with others?',
        answer: "No, your QR code is personal and tied to your own eligibility result. Don't share it with anyone else; only present it to blood center staff when you arrive for your appointment.",
    },
    {
        id: 'missed-appointment',
        question: 'What if I miss my appointment?',
        answer: "No worries, your eligibility screening stays valid as long as it hasn't expired. Just book a new appointment for another available date and time.",
    },
    {
        id: 'wrong-blood-type',
        question: 'What if my blood type on record is incorrect?',
        answer: 'Blood type on file is only confirmed through lab testing at the center. If something looks wrong, contact support below and our staff will help you get it corrected.',
    },
])

const openFaqId = ref(null)

function toggleFaq(id) {
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
    --primary: #1565c0;
    --accent: #d32f2f;
    --success: #2e7d32;
    --warning: #f57c00;
    --text-primary: #1f2937;
    --text-secondary: #9ca3af;
    max-width: 1152px;
    margin: 0 auto;
    padding: 24px 32px 40px;
    display: flex;
    background: #F5F7FA;
    flex-direction: column;
    gap: 20px;
    transition: background-color 0.2s ease;
}

.fade-in {
    animation: fadeInUp 0.5s ease both;
    animation-delay: var(--delay, 0ms);
}

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Skeleton loading */
.skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.skeleton {
    background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
    background-size: 400% 100%;
    border-radius: 14px;
    animation: shimmer 1.4s ease infinite;
}

.skeleton--header {
    height: 40px;
    max-width: 280px;
}

.skeleton-topics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
}

.skeleton--topic {
    height: 76px;
}

.skeleton-main-grid {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 20px;
    align-items: start;
}

.skeleton-col {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.skeleton--panel {
    border-radius: 14px;
}

@keyframes shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
    .skeleton, .fade-in { animation: none !important; }
}

@media (max-width: 900px) {
    .skeleton-topics-grid { grid-template-columns: 1fr 1fr; }
    .skeleton-main-grid { grid-template-columns: 1fr; }
}

.header-row {
    display: flex;
    flex-direction: column;
}

.page-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.page-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 2px 0 0;
}

/* Quick topics */
.topics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
}

.topic-card {
    background: white;
    border-radius: 14px;
    border: 1px solid #eef0f3;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
    padding: 16px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    text-decoration: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.topic-card:hover {
    border-color: #d3e6fa;
    box-shadow: 0 4px 10px rgba(21, 101, 192, 0.08);
}

.topic-card__icon {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.topic-card__icon--primary { background: #eaf3fc; color: var(--primary); }
.topic-card__icon--success { background: #eaf6ea; color: var(--success); }
.topic-card__icon--warning { background: #fff4e5; color: var(--warning); }
.topic-card__icon--danger { background: #fbeaea; color: var(--accent); }

.topic-card__body {
    flex: 1;
    min-width: 0;
}

.topic-card__title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.topic-card__desc {
    font-size: 11.5px;
    color: var(--text-secondary);
    margin: 4px 0 0;
    line-height: 1.4;
}

.topic-card__arrow {
    color: var(--text-secondary);
    flex-shrink: 0;
    margin-top: 4px;
}

/* Layout */
.main-grid {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 20px;
    align-items: start;
}

.col-left,
.col-right {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.panel {
    background: white;
    border-radius: 14px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
    border: 1px solid #eef0f3;
    overflow: hidden;
}

.panel-header--simple {
    padding: 16px 20px;
    border-bottom: 1px solid #f3f4f6;
}

.panel-title {
    font-weight: 700;
    font-size: 14px;
    color: var(--text-primary);
    margin: 0;
}

/* FAQ accordion */
.faq-list {
    display: flex;
    flex-direction: column;
}

.faq-item {
    border-bottom: 1px solid #f3f4f6;
}

.faq-item:last-child {
    border-bottom: none;
}

.faq-question {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border: none;
    background: none;
    text-align: left;
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary);
    cursor: pointer;
}

.faq-question__chevron {
    flex-shrink: 0;
    color: var(--text-secondary);
    transition: transform 0.2s ease;
}

.faq-question__chevron--open {
    transform: rotate(180deg);
}

.faq-answer {
    padding: 0 20px 18px;
}

.faq-answer p {
    font-size: 12.5px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
}

/* Contact support */
.contact-list {
    display: flex;
    flex-direction: column;
    padding: 16px 20px 4px;
    gap: 16px;
}

.contact-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.contact-row__icon {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: #eaf3fc;
    color: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.contact-row__label {
    font-size: 11.5px;
    color: var(--text-secondary);
    margin: 0 0 2px;
}

.contact-row__value {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    text-decoration: none;
    margin: 0;
}

a.contact-row__value:hover {
    color: var(--primary);
}

/* Legal links */
.legal-panel {
    padding: 8px 4px;
    display: flex;
    flex-direction: column;
}

.legal-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    text-decoration: none;
}

.legal-link:hover {
    color: var(--primary);
}

/* Buttons */
.btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 11px 20px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    color: white;
    background: var(--primary);
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: opacity 0.15s ease;
}

.btn-primary:hover {
    opacity: 0.92;
}

.btn-block {
    width: calc(100% - 40px);
    margin: 4px 20px 20px;
}

@media (max-width: 900px) {
    .topics-grid {
        grid-template-columns: 1fr 1fr;
    }

    .main-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 640px) {
    .help-page {
        padding: 16px 16px 32px;
    }

    .topics-grid {
        grid-template-columns: 1fr;
    }
}

/* ============ Dark mode ============ */
:global(.dark .help-page) {
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
    background: #0F172A;
}

:global(.dark .topic-card),
:global(.dark .panel) {
    background: #1E293B;
    border-color: #334155;
}

:global(.dark .topic-card:hover) {
    border-color: #42A5F5;
    box-shadow: 0 4px 10px rgba(66,165,245,0.14);
}

:global(.dark .topic-card__icon--primary) { background: rgba(66,165,245,0.16); }
:global(.dark .topic-card__icon--success) { background: rgba(102,187,106,0.16); }
:global(.dark .topic-card__icon--warning) { background: rgba(255,167,38,0.16); }
:global(.dark .topic-card__icon--danger) { background: rgba(239,83,80,0.16); }

:global(.dark .panel-header--simple),
:global(.dark .faq-item) {
    border-color: #334155;
}

:global(.dark .contact-row__icon) { background: rgba(66,165,245,0.16); }

:global(.dark .skeleton) {
    background: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}
</style>
