<template>
    <div class="legal-page">
        <div class="legal-container">
            <NuxtLink to="/" class="back-link">
                <AssetIcon name="arrow-left" :size="14" />
                Back
            </NuxtLink>

            <h1 class="legal-title">Terms of Service</h1>
            <p class="legal-updated">Last updated: July 2026</p>

            <div class="legal-body">
                <section class="legal-section">
                    <h2>1. Acceptance of Terms</h2>
                    <p>
                        By creating an account or using RedAgos, you agree to be bound by these
                        Terms of Service. If you do not agree with any part of these terms, please
                        do not use the platform.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>2. Eligibility to Donate</h2>
                    <p>
                        RedAgos helps connect prospective blood donors with partner blood centers
                        in Davao City. Passing the eligibility screening on this platform is a
                        preliminary check only — final eligibility is always determined by
                        qualified medical staff at the blood center during your appointment.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>3. Account Responsibilities</h2>
                    <p>
                        You are responsible for keeping your login credentials secure and for the
                        accuracy of the personal and medical information you provide. Providing
                        false information during screening may result in account suspension.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>4. Appointments &amp; QR Codes</h2>
                    <p>
                        Your QR code is personal and tied to your eligibility screening result. It
                        should not be shared with anyone else. RedAgos is not liable for
                        appointments missed due to expired or shared QR codes.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>5. Limitation of Liability</h2>
                    <p>
                        RedAgos serves as a scheduling and information platform between donors and
                        partner blood centers. We are not a medical provider and are not liable for
                        medical outcomes arising from donation procedures performed at partner
                        facilities.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>6. Changes to These Terms</h2>
                    <p>
                        We may update these Terms from time to time. Continued use of RedAgos
                        after changes are posted constitutes acceptance of the revised terms.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>7. Contact Us</h2>
                    <p>
                        Questions about these Terms? Reach us at
                        <a href="mailto:support@bloodcenter.example">support@bloodcenter.example</a>.
                    </p>
                </section>
            </div>
        </div>
    </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

definePageMeta({
  layout: 'default',
})
</script>

<style scoped>
.legal-page {
    --primary: #1565c0;
    --text-primary: #1f2937;
    --text-secondary: #6b7280;
    background: #F5F7FA;
    min-height: 100vh;
    padding: 40px 24px;
}

.legal-container {
    max-width: 760px;
    margin: 0 auto;
    background: white;
    border-radius: 14px;
    border: 1px solid #eef0f3;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
    padding: 32px 40px 48px;
}

.back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-decoration: none;
    margin-bottom: 24px;
}

.back-link:hover {
    color: var(--primary);
}

.legal-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.legal-updated {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 4px 0 28px;
}

.legal-section {
    margin-bottom: 24px;
}

.legal-section h2 {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 8px;
}

.legal-section p {
    font-size: 13.5px;
    line-height: 1.7;
    color: var(--text-secondary);
    margin: 0;
}

.legal-section a {
    color: var(--primary);
    font-weight: 600;
    text-decoration: none;
}

@media (max-width: 640px) {
    .legal-container {
        padding: 24px 20px 36px;
    }
}
</style>
