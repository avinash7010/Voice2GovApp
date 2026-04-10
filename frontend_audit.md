# Voice2Gov Mobile — Frontend Audit Report

**Date:** 2026-04-08  
**Auditor:** Frontend Architecture Review  
**Stack:** React Native 0.81 · Expo SDK 54 · Expo Router 6 · TypeScript 5.9  
**Backend Status:** Production-ready (FastAPI + JWT + MongoDB)

---

## 📋 1. Executive Summary

| Dimension | Health | Notes |
|---|---|---|
| UI/UX Consistency | 🟡 Medium | Design tokens exist but are **bypassed in most screens** |
| Navigation | 🟢 Good | Expo Router file-based routing is clean, auth guard works |
| Authentication | 🟡 Medium | Token stored in AsyncStorage (no encryption), auth guard adequate |
| API Integration | 🟢 Good | Centralized service, auth headers, error handling present |
| Performance | 🟡 Medium | Several avoidable re-renders, no memoization culture |
| Complaint Flow | 🟢 Good | Draft → Review → Submit pipeline is well-built |
| State Management | 🔴 Critical | No global state. Each screen fetches independently, zero cache |
| Error/Loading States | 🟡 Medium | Present but inconsistent styling/messaging across screens |
| Responsiveness | 🟡 Medium | Hardcoded widths/avatars, no responsive scaling |
| Code Quality | 🟡 Medium | Massive screen files (400-750 lines), style duplication everywhere |
| UI Polish | 🔴 Critical | No animations, no transitions, no haptic feedback, generic feel |

**Overall Frontend Health: 5.5 / 10** — Functional but not production-quality. The backend is significantly ahead of the frontend in terms of architecture, consistency, and polish.

---

## 🔴 2. Critical Issues

### CRIT-01: No Global State Management

**Files:** Every screen file  
**Problem:** Every screen independently calls `getComplaints()`, `getNotifications()`, etc. on mount. There is zero shared state between:
- `DashboardScreen` (calls `getComplaints`)
- `MyComplaintsScreen` (calls `getComplaints` again)
- `PublicFeedScreen` (calls `getFeed` which calls `getComplaints`)

**Impact:**
- Triple API calls on app launch when user switches tabs
- Stale data — creating a complaint in one tab won't reflect in another without manual navigation
- No optimistic updates
- No background refresh or cache invalidation

**Severity:** 🔴 Critical

---

### CRIT-02: Massive Style Duplication — "Design System" Exists But Is Ignored

**Files:** `constants/theme.ts`, `constants/ui.ts` vs every screen file

The project has a well-structured design token system (`Colors`, `Typography`, `Spacing`, `BorderRadius`, `ScreenUI`, `UI`) but **most screens define their own local `UI` object that partially copies and partially overrides these tokens**:

| Screen | Has Local `UI` Object | Uses `ScreenUI` from constants | Uses `Colors` from theme |
|---|---|---|---|
| `DashboardScreen.tsx` | ✅ Lines 34-48 | ✅ Partially | ✅ Partially |
| `MyComplaintsScreen.tsx` | ✅ Lines 25-39 | ❌ Redeclares everything | ❌ |
| `PublicFeedScreen.tsx` | ✅ Lines 29-37 | ✅ Partially | ❌ |
| `NotificationsScreen.tsx` | ✅ Lines 26-35 | ✅ Partially | ❌ |
| `ComplaintDetailsScreen.tsx` | ✅ Lines 62-70 | ✅ Partially | ✅ Partially |
| `Profile.tsx` | ✅ Lines 44-54 | ✅ Partially | ❌ |

**`MyComplaintsScreen` is the worst offender** — it redefines `background: "#F2F5F9"` (should be `#F4F6F9` from `ScreenUI.background`), `radius: 12` (should be `ScreenUI.radiusMd`), and its own color palette with `green`, `orange`, `red` values that don't match the theme's `Colors.success`, `Colors.warning`, `Colors.error`.

**Severity:** 🔴 Critical — This makes visual consistency impossible and every future design change requires editing 10+ files.

---

### CRIT-03: Hardcoded Avatar URLs Across Every Screen

**Files:** `DashboardScreen.tsx:158`, `MyComplaintsScreen.tsx:92`, `PublicFeedScreen.tsx:133`, `create-complaint.tsx:48-49`, `profile.tsx:41-42`

Multiple different Google Photos URLs are hardcoded as avatar placeholders. Some screens use different avatar images for the same "user." There is no user profile context or centralized avatar source.

**Severity:** 🔴 Critical — The avatar in the Dashboard header links to logout (!) via `onPress={handleLogout}`, which is an extremely confusing UX antipattern.

---

### CRIT-04: Duplicate Complaint Details Routes

**Files:** `app/complaint/[id].tsx` AND `app/complaint/details.tsx`

Both files export the same `ComplaintDetailsScreen` component. The `details.tsx` route is used for draft viewing (`?source=draft`), and `[id].tsx` for fetched complaints. However, the `ComplaintDetailsScreen` handles both cases internally via `useLocalSearchParams`. This creates:

- Two routes (`/complaint/123` and `/complaint/details?source=draft`) pointing to the same component
- Confusing deep link behavior
- Redundant route configuration

**Severity:** 🔴 Critical

---

### CRIT-05: Exposed Secrets in `.env` File

**File:** `.env` (root)

```
MONGO_URL=mongodb+srv://avinash:avinash123@...
JWT_SECRET_KEY=7416cd6c...
ADMIN_PASSWORD=Voice2Gov@Admin987
```

While this is technically a backend issue, the `.env` file sits at the **project root** alongside the frontend. If this repo is public or shared, all secrets are compromised. The backend audit already flagged this — reinforcing that the frontend build pipeline shares the same risk surface.

**Severity:** 🔴 Critical (security)

---

## 🟡 3. Medium Issues

### MED-01: No Reusable UI Components

**Problem:** There are zero reusable form components. Every screen redefines:
- Button styles (`loginButton`, `registerButton`, `verifyButton`, `resetButton`, `submitButton`, `confirmButton` — all with slightly different padding, heights, border-radius)
- Input field styles (3 different `inputWrapper` patterns across Login, Registration, ForgotPassword)
- Card styles (at least 5 different `card` style definitions)
- Header bars (each screen builds its own header from scratch)
- Filter chip components (redefined in `MyComplaintsScreen`, `PublicFeedScreen`, `NotificationsScreen`)
- FAB buttons (3 slightly different implementations)

**Components directory reality:**
```
components/
├── ApiExample.tsx          ← unused boilerplate
├── ScreenContainer.tsx     ← used by ONE screen (HomeScreen, which is dead code)
├── external-link.tsx       ← unused boilerplate
├── hello-wave.tsx          ← unused Expo template boilerplate
├── parallax-scroll-view.tsx← unused Expo template boilerplate
├── themed-text.tsx         ← unused
├── themed-view.tsx         ← unused
└── ui/
    ├── collapsible.tsx     ← unused boilerplate
    ├── icon-symbol.ios.tsx ← unused boilerplate
    └── icon-symbol.tsx     ← unused boilerplate
```

**Not a single custom component is actually reused across screens.** The `components/` directory is 100% Expo template leftovers.

**Severity:** 🟡 Medium

---

### MED-02: `console.log` Statements in Production Code

**Files:**
- `LoginScreen.tsx:36-37` — `console.log("LOGIN SUCCESS")`, `console.log("NAVIGATING TO DASHBOARD")`
- `RegistrationScreen.tsx:48` — `console.log("REGISTRATION SUCCESS")`
- `usePushNotifications.ts:79,103,110-113` — Multiple console.log for tokens and notifications
- `useUserLocation.ts:64,81` — console.error for location failures

**Severity:** 🟡 Medium — Leaks intent to debugging tools in production, performance overhead.

---

### MED-03: `softShadow` Redefined in Every Screen

The same shadow configuration is copy-pasted into at least 6 different `StyleSheet.create` blocks:

```typescript
softShadow: {
  shadowColor: "#000000",
  shadowOpacity: 0.04,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
}
```

It already exists as `UI.shadow` in `constants/ui.ts` but with slightly different values (`shadowOpacity: 0.05`, `shadowRadius: 16`, `shadowOffset.height: 6`), so screens wrote their own to get a different look. This means the centralized shadow is unused.

**Severity:** 🟡 Medium

---

### MED-04: Hardcoded Stats / Mock Data

**Files:**
- `DashboardScreen.tsx:52` — `civicScore = 842` (hardcoded `useState`)
- `DashboardScreen.tsx:220-222` — `StatCard` values "38", "12", "26" are hardcoded strings
- `MyComplaintsScreen.tsx:115-116` — "84%" community impact is hardcoded
- `PublicFeedScreen.tsx:204-211` — "84% faster responses" hardcoded
- `NotificationsScreen.tsx:219-224` — Weekly impact stats "12", "84%" hardcoded
- `RegistrationScreen.tsx:241` — "10k+ VERIFIED CITIZENS" hardcoded
- `OnboardingScreen.tsx:121-138` — Stats "1.2k+", "15k+", "$2M+" hardcoded
- `MyComplaintsScreen.tsx:61` — Issue ID generated with `#${8800 + index}` formula

**Impact:** The app appears data-rich but it's all fake. None of these values come from the API.

**Severity:** 🟡 Medium

---

### MED-05: Token Storage Not Using Secure Storage

**File:** `services/api.ts`

JWT tokens are stored in `AsyncStorage`, which is unencrypted plaintext storage. On rooted/jailbroken devices, tokens are trivially readable.

**Recommendation:** Use `expo-secure-store` for token storage.

**Severity:** 🟡 Medium (security)

---

### MED-06: ForgotPassword and OTP Flows Are Non-Functional

**Files:** `ForgotPasswordScreen.tsx:39`, `OtpVerificationScreen.tsx:68`, `CreateNewPasswordScreen.tsx:56`

All three screens simulate API calls with `setTimeout` delays:
```typescript
await new Promise((resolve) => setTimeout(resolve, 1500));
```

These are completely fake — they don't call any backend endpoint. The forgot-password flow shows "OTP sent!" but nothing actually happens.

**Severity:** 🟡 Medium

---

### MED-07: TypeScript Files Excluded from Compilation

**File:** `tsconfig.json:10-17`

```json
"exclude": [
  "screens/HomeScreen.tsx",
  "screens/CreateComplaintScreen.tsx",
  "screens/ComplaintsMapScreen.tsx",
  "screens/OnboardingScreen.tsx",
  "screens/CreateNewPasswordScreen.tsx",
  "screens/OtpVerificationScreen.tsx"
]
```

Six screen files are excluded from TypeScript checking. These files still exist in the codebase and some are actively used (e.g., `ComplaintsMapScreen` is imported for the map tab). Excluding them from type checking means type errors in these files are completely invisible.

**Severity:** 🟡 Medium

---

### MED-08: No Pull-to-Refresh on Any List

**Files:** `DashboardScreen.tsx`, `MyComplaintsScreen.tsx`, `PublicFeedScreen.tsx`, `NotificationsScreen.tsx`

None of the data-displaying screens implement `RefreshControl`. Users have no way to manually refresh data without navigating away and back.

**Severity:** 🟡 Medium

---

### MED-09: No Network Error Recovery / Retry

**File:** `services/api.ts`

The `request()` function has no:
- Timeout configuration (uses browser default, which can be 30+ seconds)
- Retry logic for transient failures
- Offline detection
- Request cancellation on unmount

**Severity:** 🟡 Medium

---

### MED-10: `FlatList` Used Inside `ScrollView`

**Files:** `DashboardScreen.tsx:253`, `MyComplaintsScreen.tsx:189`, `OnboardingScreen.tsx:152`

`FlatList` with `scrollEnabled={false}` inside a `ScrollView` disables all virtualization benefits. These should either be:
- Regular `.map()` with `View` (since scrolling is disabled anyway)
- Standalone `FlatList` with `ListHeaderComponent` for content above

**Severity:** 🟡 Medium (performance)

---

## 🟢 4. Low / Improvements

### LOW-01: No Loading Skeleton Components

All screens show a plain `ActivityIndicator` while loading. Modern apps use skeleton/placeholder UI to maintain perceived performance and prevent layout shift.

---

### LOW-02: No Animations or Transitions

- No screen transition animations beyond the basic `animation: "fade"` in root `Stack`
- No card entrance animations
- No micro-interactions on buttons (no scale-down on press)
- No animated tab bar transitions
- No gesture-based interactions
- `expo-haptics` is installed but never used

---

### LOW-03: Dead Code / Unused Files

| File | Status |
|---|---|
| `screens/HomeScreen.tsx` | Dead code — not routed anywhere |
| `screens/CreateComplaintScreen.tsx` | Dead code — replaced by `app/create-complaint.tsx` |
| `screens/ComplaintsMapScreen.tsx` | Dead code — not routed in tab layout |
| `screens/OnboardingScreen.tsx` | Dead code — not accessible from any navigation |
| `screens/CreateNewPasswordScreen.tsx` | Dead code — no route |
| `screens/OtpVerificationScreen.tsx` | Dead code — no route |
| `components/ApiExample.tsx` | Expo boilerplate — unused |
| `components/external-link.tsx` | Expo boilerplate — unused |
| `components/hello-wave.tsx` | Expo boilerplate — unused |
| `components/parallax-scroll-view.tsx` | Expo boilerplate — unused |
| `components/themed-text.tsx` | Expo boilerplate — unused |
| `components/themed-view.tsx` | Expo boilerplate — unused |
| `components/ui/collapsible.tsx` | Expo boilerplate — unused |
| `components/ui/icon-symbol.*.tsx` | Expo boilerplate — unused |
| `hooks/use-color-scheme.ts` | Used only by dead code |
| `hooks/use-color-scheme.web.ts` | Unused |
| `hooks/use-theme-color.ts` | Completely unused |
| `types/srs.ts` | Type definitions not imported anywhere |
| `navigation/` | Empty directory |

**~18 files** are completely dead. This is ~40% of the non-route source files.

---

### LOW-04: No Empty State Illustrations

Empty states use plain text like "No complaints yet." Modern apps should show illustrations, icons, and call-to-action buttons for empty states.

---

### LOW-05: Inconsistent Date Formatting

`DashboardScreen` formats dates as "15m ago", "2h ago", "3d ago". `NotificationsScreen` formats as "15M AGO", "2H AGO". `PublicFeedScreen` shows raw ISO timestamps. Three different date formatting approaches.

---

### LOW-06: `handleGoogleLogin` and `handleAgencySSOLogin` Are Stubs

**File:** `LoginScreen.tsx:85-91`

These buttons render clickable UI with `Alert.alert("Google Login", "Google SSO integration would go here")`. Users see a clickable Google login button that does nothing useful. Either implement or remove.

---

### LOW-07: No Keyboard-Aware Scroll Behavior

Login, Registration, ForgotPassword, and CreateComplaint forms use `ScrollView` but do not use `KeyboardAvoidingView` or `KeyboardAwareScrollView`. On smaller devices, the keyboard will cover input fields.

---

### LOW-08: `Href` Type Casting Everywhere

**Files:** Most screen files

Navigation calls use `as Href` type casting:
```typescript
router.push("/(auth)/register" as Href);
router.push(`/complaint/${item.id}` as Href);
```

This defeats the purpose of typed routes (enabled in `app.json` via `experiments.typedRoutes`).

---

### LOW-09: No Dark Mode Support

The theme file defines `Colors.light` and `Colors.dark` palettes but they are never actually used to conditionally style components. The app is hardcoded to light mode despite `userInterfaceStyle: "automatic"` in `app.json`.

---

### LOW-10: `submitComplaint` Endpoint Mismatch

**File:** `services/api.ts:35`

```typescript
submitComplaint: "/submit-complaint",  // NOT under /api/v1/
```

This endpoint doesn't follow the `/api/v1/` prefix convention used by all other endpoints. Likely a legacy route.

---

## 🎨 5. UI/UX Redesign Suggestions

### 5.1 Current Design Problems

1. **Monochromatic blue** — Every accent, title, icon, and interactive element uses `#1C4980`. The app feels like an enterprise admin panel, not a citizen engagement tool.

2. **No visual hierarchy** — Section titles, card titles, page titles, and action labels all use `fontWeight: "800"`. When everything is bold, nothing is bold.

3. **Overuse of uppercase labels** — Uppercase `letterSpacing: 0.8` labels are used for everything from field labels to section titles to stat labels. The app feels like it's shouting.

4. **No breathing room** — Cards are packed tightly with 12px margins. The density feels oppressive on smaller screens.

5. **Fake data overload** — Civic Impact Score, Community Rank, Impact Points, "84%" everywhere, "Top 5%", "2,450 XP" — none of this is real. It creates a gamification veneer that's hollow.

### 5.2 Specific Improvements

| Area | Current | Recommended |
|---|---|---|
| Primary CTA | Solid `#1C4980` rectangle | Gradient `#1C4980` to `#2B6CB0` with subtle shadow, 2px border-radius increase |
| Cards | Flat white with 1px border | Add subtle gradient backgrounds, 3D shadow with colored tint |
| Tab Bar | Plain white, 64px | 72px height, icon-first design, animated indicator dot |
| Empty States | Plain text | SVG illustrations with action buttons |
| Loading | Generic `ActivityIndicator` | Skeleton placeholder screens (content-shaped loading) |
| Transitions | `fade` only | Use `slide_from_right` for push, `fade_from_bottom` for modals |
| FAB | Static circle | Animated entrance with spring, micro-bounce on press |
| Status Badges | Flat colored chips | Subtle glass-morphism badges with icon |
| Complaint Cards | Dense text layout | Card with hero image, gradient overlay, cleaner spacing |
| Headers | Custom per-screen | Unified header component with back/title/action pattern |

### 5.3 Recommended Color Palette Extension

```typescript
const Colors = {
  primary:     '#1C4980',
  primaryDark: '#0D2B52',
  primaryLight:'#3A6DB5',
  accent:      '#4F9CF5',    // New, for interactive highlights
  accentGreen: '#34D399',    // New, for success/positive
  gradient: {
    primary: ['#1C4980', '#3A6DB5'],
    warm:    ['#FF6B6B', '#FFA07A'],
    cool:    ['#4F9CF5', '#6366F1'],
  },
  surface: {
    elevated: '#FFFFFF',
    default:  '#F8FAFC',     // Softer than current #F4F6F9
    sunken:   '#F1F5F9',
  },
};
```

---

## 🏗 6. Recommended Architecture

### 6.1 Current vs Proposed Structure

```
CURRENT (Flat, duplicated)          PROPOSED (Component-based, layered)
------------------------------      ------------------------------------------
frontend/                           frontend/
├── app/                            ├── app/              (routes only, thin wrappers)
│   ├── (auth)/                     │   ├── (auth)/
│   ├── (tabs)/                     │   ├── (tabs)/
│   ├── complaint/                  │   ├── complaint/
│   └── create-complaint.tsx        │   └── create-complaint.tsx
├── screens/       ← 400-750 LOC   ├── features/         ← Split by domain
│   ├── DashboardScreen.tsx         │   ├── auth/
│   ├── LoginScreen.tsx             │   │   ├── LoginForm.tsx
│   └── ...                         │   │   ├── RegisterForm.tsx
├── components/    ← all unused     │   │   └── useAuth.ts
│   └── (Expo boilerplate)          │   ├── complaints/
├── constants/                      │   │   ├── ComplaintCard.tsx
│   ├── theme.ts                    │   │   ├── ComplaintForm.tsx
│   └── ui.ts                       │   │   ├── ComplaintDetails.tsx
├── services/                       │   │   └── useComplaints.ts
│   └── api.ts                      │   ├── dashboard/
├── hooks/                          │   │   ├── DashboardView.tsx
│   └── ...                         │   │   └── StatCard.tsx
└── types/                          │   ├── feed/
                                    │   └── notifications/
                                    ├── components/ui/    ← Reusable design system
                                    │   ├── Button.tsx
                                    │   ├── Input.tsx
                                    │   ├── Card.tsx
                                    │   ├── Header.tsx
                                    │   ├── FilterChip.tsx
                                    │   ├── FAB.tsx
                                    │   ├── Badge.tsx
                                    │   ├── EmptyState.tsx
                                    │   ├── ErrorState.tsx
                                    │   ├── Skeleton.tsx
                                    │   └── Avatar.tsx
                                    ├── lib/              ← Shared utilities
                                    │   ├── api.ts
                                    │   ├── auth.ts
                                    │   ├── storage.ts
                                    │   └── dates.ts
                                    ├── store/            ← Global state (Zustand)
                                    │   ├── useAuthStore.ts
                                    │   ├── useComplaintsStore.ts
                                    │   └── useNotificationsStore.ts
                                    ├── constants/
                                    │   └── theme.ts      ← Single source of truth
                                    └── types/
```

### 6.2 State Management: Zustand

```mermaid
graph TD
    A[useAuthStore] --> B[Token / User Profile]
    A --> C[Login / Logout / Auto-login]
    D[useComplaintsStore] --> E[Complaint List Cache]
    D --> F[Create / Update / Delete]
    D --> G[Pagination Cursors]
    H[useNotificationsStore] --> I[Notification List]
    H --> J[Unread Count / Badge]
```

Why Zustand over Context API:
- No Provider nesting required
- Built-in persistence middleware 
- Smaller bundle size than Redux
- TypeScript-first API
- Perfect for this app's scale

### 6.3 API Layer Enhancement

```typescript
// Proposed: lib/api.ts
const api = createApiClient({
  baseUrl: resolveBaseUrl(),
  timeout: 15_000,
  retry: { attempts: 2, delay: 1_000 },
  interceptors: {
    request: attachAuthToken,
    response: {
      onUnauthorized: triggerLogout,
      onError: normalizeError,
    },
  },
});
```

---

## 📅 7. Step-by-Step Fix Plan

### Phase 1: Foundation (Days 1-3)

> [!IMPORTANT]
> These must be done first — every subsequent phase depends on them.

- [ ] **1.1** Unify design tokens — Merge `theme.ts` and `ui.ts` into single source, delete all local `UI` objects from screens
- [ ] **1.2** Create reusable UI components: `Button`, `TextInput`, `Card`, `Header`, `Avatar`, `Badge`, `FilterChip`, `FAB`, `EmptyState`, `ErrorState`, `Skeleton`
- [ ] **1.3** Install Zustand, create `useAuthStore` with token persistence via `expo-secure-store`
- [ ] **1.4** Remove ALL dead code files (~18 files), clean `components/` directory
- [ ] **1.5** Fix `tsconfig.json` — remove exclusions, fix type errors in excluded files

### Phase 2: State and Data (Days 4-6)

- [ ] **2.1** Create `useComplaintsStore` with cache, loading, error states
- [ ] **2.2** Create `useNotificationsStore`
- [ ] **2.3** Replace all screen-level `getComplaints()` / `getNotifications()` calls with store actions
- [ ] **2.4** Implement pull-to-refresh on all list screens via `RefreshControl`
- [ ] **2.5** Add request timeout (15s) and basic retry (2 attempts) to API client
- [ ] **2.6** Replace hardcoded stats with real API data where endpoints exist, remove fake stats that have no backend source

### Phase 3: Screen Refactoring (Days 7-10)

- [ ] **3.1** Refactor `DashboardScreen` — extract `StatCard`, `ActivityCard` to components, use store
- [ ] **3.2** Refactor `MyComplaintsScreen` — use shared `ComplaintCard`, store, unified filter chips
- [ ] **3.3** Refactor `PublicFeedScreen` — use shared `FeedCard`, store
- [ ] **3.4** Refactor `NotificationsScreen` — use shared `NotificationCard`, store
- [ ] **3.5** Refactor auth screens — use shared `Button`, `TextInput`, unified form layout
- [ ] **3.6** Refactor `CreateComplaintScreen` — extract `OptionGrid` to shared component
- [ ] **3.7** Consolidate `complaint/details.tsx` and `complaint/[id].tsx` into single route

### Phase 4: UX Polish (Days 11-14)

- [ ] **4.1** Add screen transition animations (`slide_from_right`, `fade_from_bottom`)
- [ ] **4.2** Add skeleton loading screens for Dashboard, Feed, MyComplaints
- [ ] **4.3** Add pull-to-refresh with haptic feedback (`expo-haptics`)
- [ ] **4.4** Add `KeyboardAvoidingView` to all form screens
- [ ] **4.5** Add button press animations (scale effect via `react-native-reanimated`)
- [ ] **4.6** Add empty state illustrations with CTA buttons
- [ ] **4.7** Remove or implement Google SSO and Agency SSO buttons
- [ ] **4.8** Implement proper forgot-password flow when backend endpoint is available
- [ ] **4.9** Remove all `console.log` / `console.error` statements

### Phase 5: Quality and Testing (Days 15-17)

- [ ] **5.1** Add proper error boundaries
- [ ] **5.2** Standardize date formatting into a shared `formatRelativeTime()` utility
- [ ] **5.3** Remove `as Href` casts — use proper typed route paths
- [ ] **5.4** Fix `submitComplaint` endpoint path to use `/api/v1/` prefix
- [ ] **5.5** Add network status detection + offline banner
- [ ] **5.6** End-to-end flow testing: Register → Login → Create Complaint → View → Feed

### Phase 6: Premium Features (Days 18-21)

- [ ] **6.1** Implement dark mode using the existing `Colors.dark` palette
- [ ] **6.2** Add deep linking support for complaint URLs
- [ ] **6.3** Add biometric authentication option (Face ID / Fingerprint) for auto-login
- [ ] **6.4** Add complaint image gallery with pinch-to-zoom
- [ ] **6.5** Add share complaint feature
- [ ] **6.6** Add notification badge count on tab bar icon

---

## 📊 Detailed Audit Sections

---

## 🔴 Section 1: UI / UX Consistency

### Typography Inconsistencies

| Element | LoginScreen | RegistrationScreen | DashboardScreen | MyComplaintsScreen |
|---|---|---|---|---|
| App title size | 24 | 24 | 18 | 18 |
| App title weight | "800" | "800" | "800" | "800" |
| Input label size | 14 | 14 | — | — |
| Input label weight | "700" | "700" | — | — |
| Input label case | UPPERCASE | Normal | — | — |
| Button text size | 16 | 16 | — | — |
| Page title size | — | — | 24 | 24 |
| Card title size | — | — | 14 | 17 |

**Login labels are UPPERCASE** ("EMAIL ADDRESS") while **Registration labels are sentence case** ("Full Name"). These are adjacent screens in the auth flow.

### Spacing Inconsistencies

| Element | LoginScreen | RegistrationScreen | ForgotPasswordScreen |
|---|---|---|---|
| Card padding horizontal | 18 | 16 | 18 (via Spacing.md=12??) |
| Card maxWidth | 480 | 440 | "100%" |
| Form group margin | 12 | 10 | 20 (Spacing.xl) |
| Input icon margin | 10 | 8 | 8 (Spacing.sm) |
| Input padding horizontal | 14 | 12 | 12 (Spacing.md) |
| Input background | ScreenUI.card | "#F8FAFD" | Colors.white |

The ForgotPasswordScreen uses `Spacing`, `BorderRadius`, `Typography` tokens from theme. Login and Registration use hardcoded values. Three adjacent auth screens, three different styling approaches.

### Color Inconsistencies

- **Background**: `#F4F6F9` (ScreenUI), `#F2F5F9` (MyComplaintsScreen), `#F0F6FF` (Colors.background from theme). Three different background grays.
- **Border**: `#E6EBF2` (ScreenUI.border), `#E5E7EB` (Colors.border from theme), `#E5E7EB` (DashboardScreen). Two different border grays.
- **Text Secondary**: `#667085` (ScreenUI), `#444651` (Colors.textSecondary), `#434750` (MyComplaintsScreen). Three different secondary text colors.

### Button Height Inconsistencies

| Screen | Primary Button Height | Notes |
|---|---|---|
| LoginScreen | 52 | minHeight |
| RegistrationScreen | 52 | minHeight |
| ForgotPasswordScreen | paddingVertical: 16 (~48) | No minHeight |
| CreateComplaintScreen | 52 | height (not minHeight) |
| ComplaintDetailsScreen | 52 | minHeight |
| DashboardScreen FAB | 56 (circle) | width+height |
| MyComplaintsScreen FAB | 56 (circle) | width+height |
| PublicFeedScreen FAB | 56 (circle) | width+height |

The `ScreenUI.buttonHeight` is set to 50 but almost no button actually uses it.

---

## 🧭 Section 2: Navigation Structure

### Current Structure
```
app/
├── _layout.tsx          ← Root: Auth guard + Stack
├── index.tsx            ← Bootstrap: token check → redirect
├── create-complaint.tsx ← Standalone stack screen
├── (auth)/
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (tabs)/
│   ├── _layout.tsx      ← Tab bar: 5 tabs
│   ├── dashboard.tsx
│   ├── my-complaints.tsx
│   ├── feed.tsx
│   ├── notifications.tsx
│   └── profile.tsx
└── complaint/
    ├── [id].tsx          ← Complaint details by ID
    ├── details.tsx       ← Complaint details for draft
    └── review.tsx        ← Draft review screen
```

### Issues Found
1. **Dual auth check** — Both `_layout.tsx` AND `index.tsx` check `AsyncStorage` for the token on app launch. This is redundant and causes two async reads.
2. **Missing auth layout** — The `(auth)` group has no `_layout.tsx`, so no shared configuration for auth screens.
3. **No deep linking tests** — `app.json` configures `scheme: "voice2govapp"` but no screen handles incoming links.
4. **Complaint navigation confusion** — "View All" in Dashboard links to `/complaint/${complaints[0]?.id}` (first complaint), not to MyComplaints list.
5. **OnboardingScreen not routed** — Exists in `screens/` but has no route in `app/`.

### Recommendations
1. Add `(auth)/_layout.tsx` with shared auth header/footer
2. Remove duplicate token check from `index.tsx` — let `_layout.tsx` handle all routing
3. Merge `complaint/details.tsx` into `complaint/[id].tsx` — use query params for draft mode
4. Fix "View All" to navigate to `/(tabs)/my-complaints`
5. Add onboarding route or delete the screen

---

## 🔐 Section 3: Authentication Flow

### What Works Well
- Token extraction handles multiple response shapes (`access_token`, `token`, `jwt`, nested `data`)
- Auth recovery flow properly clears token and redirects to login on 401
- Race condition protection with `authRecoveryInProgress` flag
- Cleanup with `isMounted` flag in auth effects

### Issues Found
1. **No token expiry management** — The app never checks JWT expiry. If server returns a 401, then it redirects. Should proactively check `exp` claim.
2. **Logout on avatar tap** — `DashboardScreen` triggers logout when user taps profile avatar. Very unexpected behavior.
3. **No user profile stored on login** — `loginUser()` extracts and stores the token but discards the rest of the response. User name/email shown on Profile screen is extracted by decoding the JWT at render time (fragile).
4. **Duplicate logout implementations** — `DashboardScreen.handleLogout` uses `logoutUser()` then `router.replace`. `ProfileScreen.handleLogout` uses `AsyncStorage.removeItem` directly (bypasses `logoutUser()`). Different code paths for the same action.
5. **Registration doesn't auto-login** — After successful registration, user is shown an alert and redirected to login. Should auto-login.

---

## 🌐 Section 4: API Integration

### What Works Well
- Centralized `request<T>()` function with typed generics
- Proper auth header injection via `buildAuthHeaders()`
- Response parsing handles empty responses, non-JSON responses
- Error message extraction is thorough
- Base URL resolution supports env vars, web, and native platforms

### Issues Found
1. **No request timeout** — `fetch()` uses no `AbortController` or timeout config
2. **No retry logic** — Single attempt, fails permanently on first error
3. **No request deduplication** — Multiple components calling `getComplaints()` simultaneously send duplicate HTTP requests
4. **`submitComplaint` uses non-versioned endpoint** — `/submit-complaint` instead of `/api/v1/complaints`
5. **`registerPushToken` uses non-versioned endpoint** — `/register-push-token`
6. **`getFeed` is a wrapper around `getComplaints`** — There's no dedicated feed endpoint; the feed literally returns the same data as user complaints
7. **No pagination** — `getComplaints()` returns entire list. Backend supports pagination but frontend doesn't use it
8. **Hardcoded IP in default URL** — `DEFAULT_NATIVE_BASE_URL = "http://10.187.103.184:8000"`. This only works on one specific network.

---

## ⚡ Section 5: Performance

### Re-render Issues
1. **`_layout.tsx` auth guard runs on every segment change** — The `useEffect` depends on `segments`, which changes on every navigation. This means the auth token is read from AsyncStorage on every screen transition.
2. **`DashboardScreen` helper functions inside component** — `getCategoryIcon`, `getPriorityColor`, `getStatusColor`, `getReportedTime` are defined inside the component and recreated every render.
3. **`ItemSeparatorComponent={() => <View style={{ height: 12 }} />}`** — Anonymous component created every render. Should be extracted to a stable reference.
4. **`ComplaintsMapScreen` has `loadComplaints` depending on `markers.length`** — This creates a new function reference whenever markers change, potentially causing re-fetch loops via the `useEffect` dependency.

### Bundle Size
- `react-native-maps` is included but only used by 2 screens (one of which is dead code)
- `expo-av` is in dependencies but never imported anywhere
- `react-native-worklets` is in dependencies but appears unused

---

## 📸 Section 6: Complaint Flow

### Flow Analysis

```
[Create Form] → [Save Draft to AsyncStorage] → [Review Screen]
                                                      ↓
                                               [Details Screen (draft mode)]
                                                      ↓
                                               [Confirm → API Submit]
                                                      ↓
                                               [Details Screen (live mode)]
```

### What Works Well
- Draft persistence via AsyncStorage survives app restarts
- Multi-step review before final submission
- Image picker with permission handling
- Location capture with geocoding
- Map preview in form
- Coordinates stored with draft

### Issues Found
1. **No form validation feedback** — Validation only shows `Alert.alert` dialogs. Should show inline field errors (red borders, helper text).
2. **No image compression** — `quality: 0.9` is high. Mobile images can be 5-10MB. Should compress to 0.5-0.7 or resize.
3. **No camera capture** — Only photo library picker. Should offer camera option for real-time evidence capture.
4. **No voice recording** — Despite the app name "Voice2Gov" and having `expo-av` in dependencies, there's no voice recording UI in the complaint form. The `uploadAudio` function exists in the API service but nothing calls it.
5. **Category/Department options are hardcoded** — Only 4 categories and 4 departments. Should come from backend.
6. **No draft auto-save** — Draft is saved only on "Review" button press. If the user navigates away mid-form, all input is lost.

---

## 📊 Section 7: State Management

### Current Architecture: None

Every screen manages its own state via `useState`. There is:
- No React Context
- No Redux/Zustand/Jotai/MobX
- No custom hooks for shared data (except `useUserLocation` and `usePushNotifications`)

### Consequences
- User data is fetched by decoding JWT on every Profile render
- Complaint lists are fetched independently on 3 different screens
- No optimistic updates
- No cache invalidation strategy
- Tab switching causes full data re-fetches
- No way to show unread notification count on the tab icon

---

## 🧪 Section 8: Error + Loading States

### Coverage Matrix

| Screen | Loading State | Error State | Empty State | Retry Action |
|---|---|---|---|---|
| Dashboard | ✅ Spinner | ✅ Error text | ✅ Empty text | ❌ None |
| MyComplaints | ✅ Spinner | ✅ Error card with icon | ✅ Empty with icon | ❌ None |
| PublicFeed | ✅ Spinner | ✅ Error text | ✅ Empty text | ❌ None |
| Notifications | ✅ Spinner | ✅ Error text | ❌ Missing | ❌ None |
| ComplaintDetails | ✅ Spinner | ✅ Error text | ✅ "Not found" text | ❌ None |
| ComplaintsMap | ✅ Spinner | ✅ Error text | ✅ "No locations" text | ✅ Retry button |
| Profile | ❌ None | ❌ None | N/A | N/A |

**Only `ComplaintsMapScreen` has a retry button.** All other screens leave users with no recovery path — they must navigate away and come back.

### Style Inconsistencies in Error States
- Dashboard: `backgroundColor: "#FEF2F2"`, `borderLeftColor: Colors.error`, `color: Colors.error`
- MyComplaints: `backgroundColor: "#FEF2F2"`, `borderLeftColor: UI.red`, error icon
- PublicFeed: No background, `color: "#B42318"`
- ComplaintDetails: No background, `color: "#B42318"`

Four different error UI treatments.

---

## 📱 Section 9: Responsiveness

### Issues Found

1. **LoginScreen card max-width 480** — Works for tablets but on small phones (320dp width), the 16px horizontal padding leaves only 288px for the card.
2. **RegistrationScreen card max-width 440** — Different from LoginScreen's 480. These are adjacent screens.
3. **Avatar images are hardcoded 40x40, 46x46, 56x56, 80x80** — No responsive scaling.
4. **Font sizes are all hardcoded** — No responsive text scaling for different display densities.
5. **Map views have hardcoded heights** — 168px, 188px, full-screen. On landscape orientation, these break.
6. **Tab bar height 64px hardcoded** — May be too tall or short on different devices. Should account for bottom safe area.
7. **FAB `bottom: 80`** — Hardcoded to avoid tab bar. If tab bar height changes, FAB overlaps or floats too high.
8. **No landscape mode handling** — `orientation: "portrait"` is set in `app.json`, which is OK for now but limits tablet usage.

---

## 🧹 Section 10: Code Quality

### Screen File Sizes (LOC)

| File | Lines | Assessment |
|---|---|---|
| `create-complaint.tsx` | 751 | 🔴 Way too large — should be 3-4 components |
| `DashboardScreen.tsx` | 711 | 🔴 Way too large |
| `ComplaintDetailsScreen.tsx` | 702 | 🔴 Way too large |
| `PublicFeedScreen.tsx` | 632 | 🔴 Too large |
| `OnboardingScreen.tsx` | 596 | 🟡 Large (dead code anyway) |
| `MyComplaintsScreen.tsx` | 578 | 🔴 Too large |
| `NotificationsScreen.tsx` | 567 | 🟡 Large |
| `Profile.tsx` | 510 | 🟡 Acceptable given it's a full profile page |
| `RegistrationScreen.tsx` | 483 | 🟡 Large for a form |
| `CreateNewPasswordScreen.tsx` | 438 | 🟡 Large for a form |
| `LoginScreen.tsx` | 424 | 🟡 Acceptable |
| `ComplaintsMapScreen.tsx` | 384 | ✅ Acceptable |
| `OtpVerificationScreen.tsx` | 326 | ✅ Acceptable |
| `ComplaintReviewScreen.tsx` | 311 | ✅ Acceptable |
| `ForgotPasswordScreen.tsx` | 273 | ✅ Good |

**Average: ~480 LOC per screen.** In a well-structured React Native app, screens should be 100-200 LOC with logic extracted to hooks and UI extracted to components. These files bundle component logic, style definitions, sub-components, and API calls into monoliths.

### Naming Conventions

- Screen files: PascalCase with "Screen" suffix ✅
- Route files: lowercase with hyphens ✅
- Hooks: camelCase with "use" prefix ✅
- Constants: PascalCase exports ✅
- **Inconsistency**: Some tab routes use `export { default }` re-export pattern, while `profile.tsx` contains the full component inline. No consistent pattern.

### Style Definition Pattern

Three different approaches used across the codebase:
1. **`StyleSheet.create` with `satisfies ViewStyle`** — Used in newer screens (ComplaintDetails, ComplaintReview, CreateComplaint)
2. **Plain `StyleSheet.create`** — Used in most screens
3. **Theme token objects (`UI.screen`, `UI.card`)** — Defined in `constants/ui.ts` but rarely spread into StyleSheet

---

## 🔥 Issue Priority Summary

| # | Issue | Severity | Category | Effort |
|---|---|---|---|---|
| CRIT-01 | No global state management | 🔴 Critical | Architecture | Large |
| CRIT-02 | Design system exists but is ignored | 🔴 Critical | UI/UX | Large |
| CRIT-03 | Hardcoded avatar URLs / avatar-logout | 🔴 Critical | UX / Security | Small |
| CRIT-04 | Duplicate complaint routes | 🔴 Critical | Navigation | Small |
| CRIT-05 | Exposed secrets in .env | 🔴 Critical | Security | Small |
| MED-01 | No reusable UI components | 🟡 Medium | Architecture | Large |
| MED-02 | console.log in production | 🟡 Medium | Quality | Small |
| MED-03 | softShadow redefined everywhere | 🟡 Medium | Consistency | Small |
| MED-04 | Hardcoded stats / mock data | 🟡 Medium | Data integrity | Medium |
| MED-05 | Token in AsyncStorage (not secure) | 🟡 Medium | Security | Small |
| MED-06 | Forgot/OTP/Reset flows are fake | 🟡 Medium | Functionality | Medium |
| MED-07 | TS files excluded from type checking | 🟡 Medium | Quality | Small |
| MED-08 | No pull-to-refresh | 🟡 Medium | UX | Small |
| MED-09 | No timeout/retry in API | 🟡 Medium | Reliability | Medium |
| MED-10 | FlatList inside ScrollView | 🟡 Medium | Performance | Small |
| LOW-01 | No skeleton loading | 🟢 Low | UX Polish | Medium |
| LOW-02 | No animations/transitions | 🟢 Low | UX Polish | Medium |
| LOW-03 | 18 dead code files | 🟢 Low | Quality | Small |
| LOW-04 | No empty state illustrations | 🟢 Low | UX Polish | Small |
| LOW-05 | Inconsistent date formatting | 🟢 Low | Consistency | Small |
| LOW-06 | SSO stubs show as real buttons | 🟢 Low | UX Honesty | Small |
| LOW-07 | No keyboard-aware scroll | 🟢 Low | UX | Small |
| LOW-08 | Href type casting | 🟢 Low | TypeScript | Small |
| LOW-09 | No dark mode implementation | 🟢 Low | Feature | Large |
| LOW-10 | submitComplaint endpoint mismatch | 🟢 Low | API | Small |

---

> [!CAUTION]
> **Do NOT ship this frontend to production without addressing at minimum CRIT-01 through CRIT-05 and MED-05.** The combination of no global state, token insecurity, exposed secrets, and UX antipatterns (logout on avatar tap) would result in a poor user experience and security concerns.

> [!TIP]
> **Highest ROI changes:** Creating ~10 reusable components (Phase 1.2) and adding Zustand (Phase 1.3) would immediately fix 60% of the issues in this audit. Start there.
