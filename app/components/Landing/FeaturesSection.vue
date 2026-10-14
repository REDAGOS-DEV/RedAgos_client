<template>
  <!--
    "How it works": the journey of one blood unit, donor to patient, in four
    stages. It replaced an eight-card feature grid that repeated what the
    "Who it's for" section already lists per role; this section answers
    *how* the system works, that one answers *who* uses it. All eight
    features are still here, each under the stage it belongs to.

    The id stays `features` so existing links (navbar, footer) still land here.
  -->
  <section id="features" class="features lp-section">
    <div class="lp-inner">
      <header v-reveal class="lp-head lp-head--center">
        <h2 class="lp-h2">
          From donor to patient, <span class="accent">tracked at every step</span>
        </h2>
        <p class="lp-lead">
          RedAgos connects the whole path of a blood unit, so nothing is lost
          between the people who give it and the patients who need it.
        </p>
      </header>

      <ol class="flow">
        <li
          v-for="(stage, i) in stages"
          :key="stage.verb"
          v-reveal="i * 110"
          class="stage"
        >
          <div class="stage-marker">
            <span class="stage-icon" :class="`stage-icon--${stage.tone}`">
              <AssetIcon :name="stage.icon" :size="24" />
            </span>
          </div>

          <div class="stage-body">
            <p class="stage-portal" :class="`stage-portal--${stage.tone}`">
              <AssetIcon :name="stage.portalIcon" :size="13" />
              {{ stage.portal }}
            </p>
            <h3 class="stage-verb">{{ stage.verb }}</h3>
            <p class="stage-desc">{{ stage.desc }}</p>

            <ul class="stage-features">
              <li v-for="feature in stage.features" :key="feature">
                <AssetIcon name="check-circle" :size="15" class="stage-check" />
                {{ feature }}
              </li>
            </ul>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

// Each stage names the portal that does the work and the features that
// cover it. Copy describes only what the portals actually do today.
const stages = [
  {
    verb: 'Donate',
    icon: 'blood-drop',
    tone: 'brand',
    portal: 'Donor portal',
    portalIcon: 'user',
    desc: 'Donors book an appointment, pass eligibility screening online, and check in at the blood center with a QR code.',
    features: ['Donor portal and booking', 'Donor records and blood drives'],
  },
  {
    verb: 'Test & store',
    icon: 'flask-conical',
    tone: 'accent',
    portal: 'Blood center',
    portalIcon: 'building-2',
    desc: 'Each unit is tested, processed into components, and stored. FEFO inventory flags units before they expire.',
    features: ['Inventory with expiry alerts', 'Reports and analytics'],
  },
  {
    verb: 'Request',
    icon: 'clipboard-list',
    tone: 'accent',
    portal: 'Hospital',
    portalIcon: 'hospital',
    desc: 'Hospital blood banks search available blood across partner centers and request supply before their stock runs low.',
    features: ['Blood search and requests', 'Low-stock supply coordination'],
  },
  {
    verb: 'Deliver',
    icon: 'truck',
    tone: 'accent',
    portal: 'Blood center to hospital',
    portalIcon: 'route',
    desc: 'The blood center processes the request and dispatches the units, and both sides track its status until it arrives.',
    features: ['Processing and dispatch', 'Status updates and notifications'],
  },
]
</script>

<style scoped>
/* Extra top room for the hero's stats card, which overlaps this section. */
.features { padding-top: 176px; }
.accent { color: var(--lp-accent-text); }

/* ── Desktop: four stages in a row, joined by a line through the icons ── */
.flow {
  --marker: 64px;
  position: relative;
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px;
}
/* The connecting line, from the first icon's centre to the last. */
.flow::before {
  content: '';
  position: absolute;
  top: calc(var(--marker) / 2);
  left: calc(12.5% - 14px);
  right: calc(12.5% - 14px);
  height: 2px;
  background: linear-gradient(90deg, var(--lp-brand) 0%, var(--lp-accent) 30%, var(--lp-accent) 100%);
  opacity: 0.35;
}

.stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stage-marker { position: relative; margin-bottom: 22px; }
.stage-icon {
  width: var(--marker);
  height: var(--marker);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--lp-surface);
  /* A ring of page colour cuts the connecting line cleanly at each icon. */
  box-shadow: 0 0 0 8px var(--lp-bg), var(--lp-shadow);
}
.stage-icon--brand { color: var(--lp-brand); background: #FFF5F5; }
.stage-icon--accent { color: var(--lp-accent-text); background: #F2F7FD; }

.stage-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  width: 100%;
  padding: 24px 22px;
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius);
}

.stage-portal {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}
.stage-portal--brand { background: var(--lp-brand-soft); color: var(--lp-brand); }
.stage-portal--accent { background: var(--lp-accent-soft); color: var(--lp-accent-text); }

.stage-verb {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--lp-text);
}
.stage-desc {
  margin: 0 0 18px;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--lp-text-2);
}

.stage-features {
  list-style: none;
  margin: auto 0 0;
  padding: 16px 0 0;
  width: 100%;
  display: grid;
  gap: 8px;
  border-top: 1px solid var(--lp-border);
  text-align: left;
}
.stage-features li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--lp-text);
}
.stage-check { flex-shrink: 0; margin-top: 2px; color: var(--lp-accent-text); }

/* ── Tablet and phone: a vertical timeline ── */
@media (max-width: 1024px) {
  .features { padding-top: 112px; }
  .flow {
    --marker: 52px;
    grid-template-columns: 1fr;
    gap: 20px;
    max-width: 640px;
    margin: 0 auto;
  }
  .flow::before {
    top: calc(var(--marker) / 2);
    bottom: calc(var(--marker) / 2);
    left: calc(var(--marker) / 2 - 1px);
    right: auto;
    width: 2px;
    height: auto;
    background: linear-gradient(180deg, var(--lp-brand) 0%, var(--lp-accent) 30%, var(--lp-accent) 100%);
  }
  .stage {
    flex-direction: row;
    align-items: flex-start;
    gap: 18px;
    text-align: left;
  }
  .stage-marker { margin: 0; flex-shrink: 0; }
  .stage-body { align-items: flex-start; padding: 20px; }
}
@media (max-width: 640px) {
  .features { padding-top: 80px; }
  .stage { gap: 14px; }
  .stage-verb { font-size: 20px; }
}
</style>
