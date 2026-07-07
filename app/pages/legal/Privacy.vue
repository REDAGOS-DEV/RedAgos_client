<template>
    <div class="legal-page">
        <div class="legal-container">
            <NuxtLink to="/" class="back-link">
                <AssetIcon name="arrow-left" :size="14" />
                Back
            </NuxtLink>

            <h1 class="legal-title">Privacy Policy</h1>
            <p class="legal-updated">Last updated: July 2026</p>

            <div class="legal-body">
                <section class="legal-section">
                    <h2>1. Information We Collect</h2>
                    <p>
                        We collect information you provide directly, such as your name, contact
                        details, blood type, date of birth, and eligibility screening answers,
                        as well as records of your appointments and donation history.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>2. How We Use Your Information</h2>
                    <p>
                        Your information is used to determine donation eligibility, schedule
                        appointments, generate your QR code, maintain your donation history, and
                        communicate important updates about your account.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>3. Sharing with Partner Blood Centers</h2>
                    <p>
                        Relevant screening and appointment information is shared with the partner
                        blood center you book with (e.g. SPMC, Sub-National Blood Center, or
                        Philippine Red Cross Davao) so their staff can verify your eligibility on
                        arrival.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>4. Data Security</h2>
                    <p>
                        We apply reasonable technical and organizational safeguards to protect your
                        personal and medical information from unauthorized access, loss, or misuse.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>5. Your Rights</h2>
                    <p>
                        You may request access to, correction of, or deletion of your personal
                        information by contacting support. Some data, such as donation records
                        required by partner blood centers, may be retained as required by law.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>6. Changes to This Policy</h2>
                    <p>
                        We may revise this Privacy Policy periodically. Continued use of RedAgos
                        after updates are posted constitutes acceptance of the revised policy.
                    </p>
                </section>

                <section class="legal-section">
                    <h2>7. Contact Us</h2>
                    <p>
                        For privacy-related concerns, email us at
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