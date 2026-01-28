# AGENTS.md - AI Assistant Configuration for Mobile Template

This file configures AI assistants to help non-developers build high-quality React Native mobile applications with Expo, Convex Auth, and RevenueCat safely and effectively.

---

## 🛡️ Safety First Agent

**Purpose**: Protect beginners from destructive operations
**Trigger**: Before executing any potentially dangerous command
**Priority**: CRITICAL

### Behavior:
- **BLOCK IMMEDIATELY**:
  - `git push --force`
  - `git reset --hard`
  - `git clean -fd`
  - `rm -rf` commands
  - Deletion of `.env` files

- **WARN AND CONFIRM**:
  - `npm` or `yarn` commands (Suggest `bun` instead)
  - Changes to `app.json` or `babel.config.js`
  - Database schema changes in Convex

- **TEACH**:
  - Explain the risk.
  - **Reference**: See `docs/README.md` for safe development practices.

---

## 🧪 Pre-Commit Guardian Agent

**Purpose**: Ensure code quality before commits
**Trigger**: When user attempts `git commit`
**Priority**: HIGH

### Behavior:

#### Step 1: Automatic Checks
Run: `bun run check:fix` (Ultracite + Biome linting & formatting).

#### Step 2: Mobile-Specific Validation
- ✅ No `console.log` in production.
- ✅ All `EXPO_PUBLIC_` variables checked.
- ✅ Images have `accessibilityLabel`.
- ✅ Touchable elements have accessibility props.
- ✅ Ultracite standards enforced (type safety, accessibility, performance).

#### Step 3: Report & Guide
If issues found, guide user to run `bun run check:fix` or fix manually.

---

## 🔐 Convex Auth Agent

**Purpose**: Ensure proper Convex authentication implementation
**Trigger**: When working with authentication code
**Priority**: CRITICAL

### Behavior:

#### Protected Screen Pattern
Use `useConvexAuth` and `Redirect` from `expo-router`.
- **Reference**: Check `app/(authenticated)/_layout.tsx` for implementation examples.

#### Sign In/Up
Use `useAuthActions` from `@convex-dev/auth/react`.
- **Reference**: See `app/(auth)/sign-in.tsx` or `docs/setup.md`.

---

## 💳 RevenueCat Integration Agent

**Purpose**: Guide proper RevenueCat usage for payments
**Trigger**: When working with payment/subscription code
**Priority**: MEDIUM

### Behavior:

#### Subscription Check
Use `useRevenueCat` hook from `contexts/RevenueCatContext.tsx`.

#### Configuration
1. Configure API keys in `.env` (`EXPO_PUBLIC_RC_...`).
2. Ensure offerings are set up in RevenueCat dashboard.

- **Reference**: Read `docs/REVENUECAT_SETUP.md` for step-by-step instructions.

---

## 🇮🇱 Hebrew/RTL Validator Agent

**Purpose**: Ensure proper Hebrew and RTL support in Mobile
**Trigger**: When creating text/layout components
**Priority**: HIGH

### Behavior:

#### RTL Checks
- Use `text-right` or RTL-aware classes.
- Expo is configured for RTL in `app.json` (`supportsRTL: true`).
- **Reference**: Check `lib/rtl.ts` for helper functions.

---

## 📱 Expo Best Practices Agent

**Purpose**: Ensure proper Expo patterns
**Trigger**: When creating/modifying Expo-specific code
**Priority**: HIGH

### Behavior:

#### Image Usage
Use `expo-image` for better performance.

#### Navigation
Use `expo-router` (file-based routing in `app/`).

#### Secure Storage
Use `expo-secure-store` for sensitive data, NOT `AsyncStorage`.

---

## 🆘 Help & Troubleshooting Agent

**Purpose**: Help users when they're stuck
**Trigger**: Error messages or repeated failures
**Priority**: HIGH

### Behavior:

#### Documentation First Approach
If errors persist (e.g., "Convex query failed", "RevenueCat error"):
1. **Suggest Docs**: "Please check the setup guide to ensure environment variables are correct."
2. **Point to Files**:
   - Setup: `docs/setup.md`
   - Payments: `docs/REVENUECAT_SETUP.md`
   - General: `docs/README.md`

#### Common Fixes
- **"Module not found"**: Run `bun install`.
- **"Metro bundler error"**: Run `bun dev --clear`.
- **Convex connection**: Check `EXPO_PUBLIC_CONVEX_URL` in `.env`.

---

## 🚀 Ultracite Code Quality Agent

**Purpose**: Enforce consistent, type-safe, accessible, and performant React Native code
**Trigger**: When generating or reviewing code
**Priority**: HIGH

### Behavior:

**Ultracite** is a zero-config Biome preset optimized for mobile development. Learn more at [ultracite.ai](https://www.ultracite.ai/).

#### Mobile-Specific Rules
- Every `Pressable`/`TouchableOpacity` must have `accessible={true}`
- Include `accessibilityLabel` and `accessibilityRole` on all interactive elements
- Add `accessibilityHint` for complex interactions
- Ensure minimum touch target size (44x44 iOS, 48x48 Android)
- Use `hitSlop` to expand touch targets for small icons
- Use `expo-image` for images (better performance)
- Use `expo-secure-store` for sensitive data, never `AsyncStorage`

#### Code Generation Standards
- Use explicit types for all function parameters and return values
- Leverage TypeScript's type narrowing instead of assertions
- Use `const` by default, `let` only when necessary, never `var`
- Prefer arrow functions for callbacks
- Use template literals over string concatenation
- Always `await` promises in async functions
- Memoize expensive components with `React.memo`
- Use `useCallback` for functions passed as dependencies

#### React Native Styling
- Use NativeWind (Tailwind) via `className` prop
- Don't hardcode colors - use Tailwind utilities
- Use responsive modifiers (`sm:`, `lg:`) for different screens
- Avoid inline styles

#### RTL Support (Hebrew/Arabic)
- Use `text-right` for RTL text
- Test layouts in both LTR and RTL modes
- App is configured for RTL in `app.json`

#### Performance Standards
- Memoize expensive components
- Use `useCallback` for dependencies
- Use `useMemo` for expensive computations
- Avoid creating objects/arrays in render
- Use `FlatList` with `keyExtractor` for large lists
- Add `getItemLayout` for fixed-height items

#### When in Doubt
Run `bun ultracite fix` to automatically format and fix issues.

---

## 📚 Learning Resources

All agents should reference these project files:
- `docs/REVENUECAT_SETUP.md` - RevenueCat configuration
- `docs/setup.md` - Initial setup guide
- `contexts/RevenueCatContext.tsx` - Payment logic
- `convex/auth.ts` - Authentication config
- `app.json` - Expo configuration (RTL, permissions)

**Remember**: Always encourage checking the `docs/` folder when users are stuck.
