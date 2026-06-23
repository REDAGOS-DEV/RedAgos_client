<template>
  <main class="login-screen">
    <div class="login-shell">
      <aside class="brand-panel">
        <div class="particle particle1"></div>
        <div class="particle particle2"></div>
        <div class="particle particle3"></div>
        <div class="particle particle4"></div>

        <div class="circle circle-top"></div>
        <div class="circle circle-bottom"></div>

        <div class="top-ring"></div>
        <div class="top-ring-2"></div>

      <div class="brand-lockup">
        <div class="brand-mark">
          <img :src="logo" alt="RedAgos Logo" class="logo-image">
        </div>

          <div>
            <p class="brand-name">
              Red<span>Agos</span>
            </p>
            <p class="brand-subtitle">Blood Bank System</p>
          </div>
        </div>

        <section class="brand-copy">
          <h2>
            Connecting Lives<br>
            Through Blood<br>
            Donation
          </h2>

          <p>
            Davao City's integrated blood bank management system<br>
            &mdash; connecting donors, hospitals, and blood centers.
          </p>
        </section>

        <div class="stats-row">
          <div>
            <strong>4</strong>
            <span>User Roles</span>
          </div>

          <div>
            <strong>24/7</strong>
            <span>Monitoring</span>
          </div>

          <div>
            <strong>100%</strong>
            <span>Digital</span>
          </div>
        </div>
        <div class="red-glow"></div>
      </aside>

      <section class="form-panel">
        <div class="form-card">
          <div class="mobile-brand">
            <p class="brand-name">
              Red<span>Agos</span>
            </p>
            <p class="brand-subtitle">Blood Bank System</p>
          </div>

          <NuxtLink
            to="/"
            class="back-link"
          >
            &larr; Back to Home
          </NuxtLink>

          <h1>Welcome Back!</h1>

          <p class="form-subtitle">
            Sign in to your RedAgos account
          </p>

          <form
            class="login-form"
            @submit.prevent="login"
          >
            <div class="field-group">
              <label for="email">Email Address</label>

              <div class="input-shell">
                <span class="field-icon">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4 6h16v12H4z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m4 7 8 6 8-6"
                    />
                  </svg>
                </span>

                <input
                  id="email"
                  v-model="email"
                  type="email"
                  placeholder="you@example.com"
                >
              </div>
            </div>

            <div class="field-group password-group">
              <label for="password">Password</label>

              <div class="input-shell">
                <span class="field-icon">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <rect
                      width="14"
                      height="10"
                      x="5"
                      y="11"
                      rx="2"
                    />
                    <path
                      stroke-linecap="round"
                      d="M8 11V8a4 4 0 1 1 8 0v3"
                    />
                  </svg>
                </span>

                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="********"
                >

                <button
                  type="button"
                  class="icon-button"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <svg
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div class="forgot-row">
              <NuxtLink to="/forgot-password">
                Forgot password?
              </NuxtLink>
            </div>

            <button class="sign-in-button">
              <svg
                aria-hidden="true"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="3"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 3h4v18h-4"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m10 17 5-5-5-5"
                />
                <path
                  stroke-linecap="round"
                  d="M15 12H3"
                />
              </svg>
              Sign In
            </button>

            <p class="signup-text">
              Need an account?
              <NuxtLink to="/signup">
                Sign Up
              </NuxtLink>
            </p>

            <div class="divider">
              <span></span>
              <p>or sign in as</p>
              <span></span>
            </div>

            <div class="role-grid">
              <button
                type="button"
                class="role-button hospital"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 21h16M6 21V7l6-3 6 3v14M9 11h2M13 11h2M9 15h2M13 15h2"
                  />
                </svg>
                Hospital
              </button>

              <button
                type="button"
                class="role-button blood-center"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 3s6 6.1 6 10a6 6 0 1 1-12 0c0-3.9 6-10 6-10z"
                  />
                  <path
                    stroke-linecap="round"
                    d="M9.5 14.5a2.5 2.5 0 0 0 5 0"
                  />
                </svg>
                Blood Center
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import logo from '~/assets/images/RedAgosLogo.png'
const email = ref('')
const password = ref('')
const showPassword = ref(false)

const login = () => {
  console.log('Login')
}
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.login-screen {
  min-height: 100vh;
  background: #eef4fb;
  color: #1f2937;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.login-shell {
  display: grid;
  min-height: 100vh;
  grid-template-columns: 540px 1fr;
}

.brand-panel {
  position: relative;
  display: block;
  overflow: hidden;
  padding: 48px;
  background: #206fbd;
  color: #ffffff;
}
.top-ring{
  position:absolute;
  top:-120px;
  left:-120px;
  width:320px;
  height:320px;
  border-radius:50%;
  border:2px solid rgba(255,255,255,.15);
}

.top-ring-2{
  position:absolute;
  top:-70px;
  left:-70px;
  width:220px;
  height:220px;
  border-radius:50%;
  border:2px solid rgba(255,255,255,.15);
}

.dots{
  position:absolute;
  top:60px;
  left:40px;
  width:80px;
  height:80px;
  background-image:
  radial-gradient( rgba(255,255,255,.65) 1.5px, transparent 1.5px);
  background-size:16px 16px;
}

.particle{
  position:absolute;
  width:5px;
  height:5px;
  border-radius:50%;
  background:#ff5a74;
}

.particle1{
  left:60px;
  bottom:260px;
  animation:float 6s infinite ease-in-out;
}

.particle2{
  left:200px;
  bottom:340px;
  animation:float 8s infinite ease-in-out;
}

.particle3{
  left:500px;
  bottom:220px;
  animation:float 7s infinite ease-in-out;
}
.particle4{
  left:420px;
  bottom:160px;
  animation:float 9s infinite ease-in-out;
}

.circle {
  position: absolute;
  pointer-events: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
}

.circle-top {
  top: -96px;
  right: -128px;
  width: 320px;
  height: 320px;
}

.circle-bottom {
  left: -96px;
  bottom: -96px;
  width: 384px;
  height: 384px;
}

.brand-lockup{
  animation:logoFloat 5s infinite ease-in-out;
}

.brand-mark {
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
}

.brand-mark-inner {
  position: relative;
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #0c559c;
}

.brand-drop {
  position: absolute;
  top: -6px;
  color: #ff2f559c;
  font-size: 20px;
  line-height: 1;
}

.brand-letter {
  margin-top: 10px;
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
}

.brand-name {
  margin: 0;
  color: #ffffff;
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}

.brand-name span {
  color: #ff2f55;
}

.brand-subtitle {
  margin: 8px 0 0;
  color: #ffffff;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 3px;
  line-height: 1;
  text-transform: uppercase;
}

.brand-copy {
  position: relative;
  z-index: 1;
  max-width: 390px;
  margin-top: 76px;
}

.brand-copy h2 {
  margin: 0;
  color: #ffffff;
  font-size: 37px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.62;
}

.brand-copy p {
  margin: 28px 0 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 14px;
  line-height: 2.15;
}

.red-glow{
  position:absolute;
  left:-120px;
  bottom:-250px;
  width:650px;
  height:650px;
  border-radius:50%;
  background:
  radial-gradient(
      circle,
      #ff4d6d 0%,
      #ff2f55 20%,
      rgba(255,47,85,.4) 60%,
      transparent 85% );
  filter:blur(100px);
}

.stats-row {
  position: absolute;
  z-index: 1;
  left: 56px;
  bottom: 30px;
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 42px;
}

.stats-row strong {
  display: block;
  color: #ffffff;
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
}

.stats-row span {
  display: block;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  font-weight: 400;
}

.form-panel {
  display: flex;
  min-height: 100vh;
  justify-content: flex-start;
  padding: 0;
}

.form-card {
  width: 100%;
  max-width: 460px;
  margin-top: 62px;
  margin-left: 140px;
}

.mobile-brand {
  display: none;
}

.mobile-brand .brand-name {
  color: #1769c9;
}

.mobile-brand .brand-subtitle {
  color: #64748b;
}

.back-link {
  display: inline-flex;
  align-items: center;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.back-link:hover {
  color: #334155;
}

h1 {
  margin: 46px 0 0;
  color: #1f2937;
  font-size: 38px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.18;
}

.form-subtitle {
  margin: 16px 0 0;
  color: #64748b;
  font-size: 16px;
  line-height: 1.5;
}

.login-form {
  margin-top: 54px;
}

.field-group {
  margin: 0;
}

.password-group {
  margin-top: 19px;
}

label {
  display: block;
  color: #1f2937;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.2;
}

.input-shell {
  display: flex;
  height: 52px;
  align-items: center;
  margin-top: 12px;
  padding: 0 14px;
  border: 1px solid #d6e0eb;
  border-radius: 8px;
  background: #ffffff;
}

.field-icon {
  display: flex;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  color: #64748b;
}

svg {
  width: 100%;
  height: 100%;
}

input {
  width: 100%;
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: #334155;
  font: inherit;
  font-size: 14px;
}

input::placeholder {
  color: #64748b;
}

.icon-button {
  display: flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  margin-left: 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}

.icon-button:hover {
  background: #f1f5f9;
  color: #334155;
}

.icon-button svg {
  width: 18px;
  height: 18px;
}

.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 22px;
}

.forgot-row a,
.signup-text a {
  color: #1266c3;
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
}

.forgot-row a:hover,
.signup-text a:hover {
  color: #0d4f9c;
}

.sign-in-button {
  display: flex;
  width: 100%;
  height: 52px;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
  border: 0;
  border-radius: 8px;
  background: #1e6fc8;
  color: #ffffff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 800;
}

.sign-in-button:hover {
  background: #185dac;
}

.sign-in-button svg {
  width: 24px;
  height: 24px;
}

.signup-text {
  margin: 24px 0 0;
  color: #64748b;
  font-size: 14px;
  text-align: center;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 44px;
}

.divider span {
  height: 1px;
  flex: 1;
  background: #d5dde7;
}

.divider p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.role-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 44px;
}

.role-button {
  display: flex;
  height: 46px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px solid #d6e0eb;
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 800;
}

.role-button svg {
  width: 20px;
  height: 20px;
}

.hospital {
  color: #1266c3;
}

.hospital:hover {
  border-color: #1266c3;
}

.blood-center {
  color: #2da1ff;
}

.blood-center:hover {
  border-color: #2da1ff;
}
@keyframes logoFloat{ 0%,100%{ transform:translateY(0);} 50% { transform:translateY(-8px);}}
@keyframes float{ 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-18px);}}
@keyframes floatParticle { 0%, 100% { transform:translateY(0);} 50% { transform:translateY(-20px);}}

@media (max-width: 1023px) {
  .login-shell {
    display: block;
  }

  .brand-panel {
    display: none;
  }

  .form-panel {
    justify-content: center;
    padding: 56px 24px;
  }

  .form-card {
    margin: 0;
  }

  .mobile-brand {
    display: block;
    margin-bottom: 48px;
  }
}

@media (max-width: 520px) {
  .form-panel {
    padding: 36px 18px;
  }

  h1 {
    font-size: 34px;
  }

  .role-grid {
    grid-template-columns: 1fr;
  }
}
</style>
