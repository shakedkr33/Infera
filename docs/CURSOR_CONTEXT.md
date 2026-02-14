# Inyomi - Cursor Prompt Pack & Improvement Plan

**Version:** 1.0  
**Last Updated:** February 2026  
**Purpose:** Enable fast, precise development in Cursor with Sonnet 4/5

---

## A) CURSOR CONTEXT (Base Instructions)

**Copy-paste this at the start of every Cursor chat:**

```
You are building Inyomi, an AI-first personal life assistant app.

## CORE IDENTITY
Inyomi transforms unstructured inputs (text, images, voice notes) into structured, actionable events and tasks.
- PRIMARY INPUT: Screenshots, text paste, voice recording, free text
- PRIMARY OUTPUT: Calendar events, tasks, reminders with AI-extracted metadata
- TARGET USERS: Individuals, families (ages 25-45), small businesses
- CORE VALUE: Reduce cognitive load by automating organization

## CRITICAL: NOT A SOCIAL NETWORK
- This is an ASSISTANT app, not a communication platform
- Collaboration features are minimal (family sharing only)
- No chat, no groups, no social feed
- AI logic > social features, always

## TECH STACK
- Frontend: React Native (Expo), TypeScript
- Backend: Convex (database + server functions)
- State: Convex queries (reactive), React hooks
- Navigation: Expo Router (file-based)
- Styling: NativeWind (Tailwind for RN)

## RTL-FIRST PRINCIPLES
- Hebrew is primary language (RTL layout default)
- All UI must support RTL/LTR switching
- Text alignment: right-aligned for Hebrew
- Navigation: drawer/tabs respect RTL direction
- Use `textAlign: 'right'` for Hebrew, `I18nManager` for RTL

## DESIGN PHILOSOPHY
- Calm, minimal, emotionally warm
- Cognitive-friendly (not productivity-aggressive)
- Soft colors, rounded corners, generous spacing
- Clear visual hierarchy, no clutter
- Accessibility: readable fonts, good contrast

## CONVEX RULES
- Data ownership: Every document has `userId` or `familyId`
- Authorization: ALWAYS check `ctx.auth.getUserIdentity()` in mutations/queries
- Never expose other users' data
- Schema-first: define in `convex/schema.ts`
- Use indexes for queries: `withIndex("by_user", q => q.eq("userId", userId))`

## MVP SCOPE (What to build now)
✅ AI event/task creation (image, text, voice)
✅ Smart calendar view (timeline, grouped activities)
✅ Family profiles (color-coded, role-based sharing)
✅ Google Calendar one-time import
✅ Basic AI personalization (pattern detection)

❌ NOT IN MVP (do not build these):
- Advanced push notifications
- Group broadcasting / RSVP systems
- Chat features (family or event-level)
- Document vault
- Hebrew calendar integration
- Multi-language beyond Hebrew
- WhatsApp bot
- Birthday gift integrations

## CODE QUALITY STANDARDS
- TypeScript strict mode
- No `any` types (use `unknown` if needed)
- Functional components only (no class components)
- Hooks: useState, useEffect, useMemo, useCallback
- Error boundaries for Convex queries
- Loading states for all async operations
- Proper RTL support in all new components

## FILE NAMING
- Components: PascalCase (e.g., `EventCard.tsx`)
- Utilities: camelCase (e.g., `dateHelpers.ts`)
- Screens: lowercase (Expo Router convention, e.g., `calendar.tsx`)
- Convex functions: camelCase (e.g., `createEvent.ts`)

## WHEN REFACTORING
- Prefer minimal diffs (small, focused PRs)
- Don't break existing functionality
- Keep existing file structure unless explicitly refactoring
- Test on both iOS and Android
- Verify RTL layout after changes
```

---

## B) PROMPT TEMPLATES (Reusable)

### Template 1: Implement New Screen with RTL
```
Implement a new screen: [SCREEN_NAME]

REQUIREMENTS:
- Location: app/(authenticated)/[filename].tsx
- RTL support: Hebrew text right-aligned, layout direction handled
- Navigation: Use Expo Router `<Stack.Screen>` with Hebrew title
- Loading state: Show ActivityIndicator while data loads
- Empty state: Show helpful message if no data
- Error handling: Display user-friendly error message

DESIGN:
- Follow existing screen patterns in app/(authenticated)/
- Use NativeWind classes: bg-white, p-4, rounded-lg, etc.
- Color scheme: soft neutrals (bg-gray-50, text-gray-800)
- Spacing: consistent padding (p-4, gap-4)

DATA:
- Convex query: [QUERY_NAME] from convex/[file].ts
- Authorization: verify userId matches authenticated user
- Reactive: use `useQuery` for real-time updates

CONSTRAINTS:
- Do NOT modify navigation structure
- Do NOT add new dependencies
- Keep TypeScript strict
- No inline styles (use NativeWind only)

ACCEPTANCE CRITERIA:
[ ] Screen renders with proper RTL layout
[ ] Data loads from Convex with authorization check
[ ] Loading/error/empty states handled
[ ] Follows existing design patterns
[ ] No TypeScript errors
```

### Template 2: Add Convex Mutation with Authorization
```
Create Convex mutation: [MUTATION_NAME]

FILE: convex/[module].ts

SIGNATURE:
export const [mutationName] = mutation({
  args: {
    [field]: v.string(),
    // add more fields
  },
  handler: async (ctx, args) => {
    // implementation
  }
});

REQUIREMENTS:
1. Authorization check FIRST:
   ```
   const identity = await ctx.auth.getUserIdentity();
   if (!identity) throw new Error("Unauthorized");
   const userId = identity.subject;
   ```

2. Input validation:
   - Validate all args before database operations
   - Return clear error messages for invalid input

3. Database operation:
   - Insert/update with userId ownership
   - Use transactions if multiple operations
   - Return the created/updated document ID

4. Error handling:
   - Try-catch around database operations
   - Log errors for debugging
   - Throw user-friendly error messages

CONSTRAINTS:
- Do NOT skip authorization check
- Do NOT expose other users' data
- Use schema types from convex/schema.ts
- Keep mutations simple (single responsibility)

TESTING:
After implementation, verify:
[ ] Unauthorized users get error
[ ] Valid data creates/updates correctly
[ ] Invalid data returns clear error
[ ] User can only modify their own data
```

### Template 3: Refactor into Feature-Based Folders
```
Refactor [FEATURE_NAME] into feature-based structure

CURRENT STRUCTURE: [describe current files]

TARGET STRUCTURE:
lib/features/[feature-name]/
├── components/
│   ├── [FeatureComponent].tsx
│   └── [AnotherComponent].tsx
├── hooks/
│   └── use[FeatureName].ts
├── types.ts
└── utils.ts

STEPS:
1. Create new folder: lib/features/[feature-name]/
2. Move related components (preserve names)
3. Update imports in consuming files
4. Move related hooks (extract if inline)
5. Extract shared types to types.ts
6. Extract utilities to utils.ts
7. Update barrel export: lib/features/[feature-name]/index.ts

CONSTRAINTS:
- One file at a time (verify app works after each move)
- Do NOT modify component logic during move
- Update imports only (use relative paths within feature)
- Keep existing component names
- Do NOT break existing screens

VERIFICATION:
After each file move:
[ ] App builds without errors
[ ] Feature still works correctly
[ ] RTL layout preserved
[ ] TypeScript types resolve
```

### Template 4: Add AI Draft Confirmation Flow
```
Implement AI confirmation flow for [INPUT_TYPE: image/text/voice]

FLOW:
1. User inputs data → 2. AI processes → 3. Show preview → 4. User confirms/edits → 5. Save

COMPONENTS NEEDED:
- Input capture: [ImageUpload | TextInput | VoiceRecorder]
- AI processing: Convex action with AI API call
- Preview screen: Show extracted data in editable form
- Confirmation: Save button triggers mutation

IMPLEMENTATION:

FILE 1: app/(authenticated)/ai-input.tsx
- Capture input (image/text/voice)
- Call Convex action: `processAIInput`
- Show loading state during AI processing
- Navigate to confirmation screen with result

FILE 2: app/(authenticated)/ai-confirm.tsx
- Display AI-extracted event data
- Editable fields: title, date, time, location, participants
- "Looks good" button → save
- "Edit" mode for corrections
- "Cancel" → go back

FILE 3: convex/ai.ts
```typescript
export const processAIInput = action({
  args: { input: v.string(), type: v.union(v.literal("image"), v.literal("text"), v.literal("voice")) },
  handler: async (ctx, args) => {
    // Call AI API (OpenAI/Anthropic)
    // Extract: title, date, time, location, participants, isRecurring
    // Return structured object
  }
});
```

FILE 4: convex/events.ts
```typescript
export const createEventFromAI = mutation({
  args: { /* AI extracted fields */ },
  handler: async (ctx, args) => {
    // Authorization check
    // Validate extracted data
    // Create event with userId
  }
});
```

CONSTRAINTS:
- AI processing must be in Convex action (not client-side)
- Show clear loading indicator (AI takes 2-5 seconds)
- Allow user to edit before saving
- Handle AI errors gracefully (show "try again" option)
- Do NOT auto-save without confirmation

ACCEPTANCE:
[ ] Input captured correctly
[ ] AI extracts structured data
[ ] Preview shows all fields
[ ] User can edit before saving
[ ] Confirmation creates event in Convex
[ ] Error states handled
```

### Template 5: Fix Bug with Minimal Diff
```
Fix bug: [BUG_DESCRIPTION]

SYMPTOMS:
- [What's broken]
- [Expected behavior]
- [Current behavior]

FILES INVOLVED:
- [List files that might be causing issue]

INVESTIGATION STEPS:
1. Identify root cause (check console logs, Convex dashboard)
2. Locate exact line causing issue
3. Determine minimal fix (change only what's necessary)

FIX REQUIREMENTS:
- Change only the broken part (no "while we're here" refactors)
- Preserve existing logic everywhere else
- Add comment explaining the fix
- Test the specific broken flow

CONSTRAINTS:
- Do NOT refactor unrelated code
- Do NOT change file structure
- Do NOT add new dependencies
- Keep changes under 20 lines if possible

VERIFICATION:
[ ] Bug is fixed
[ ] No new bugs introduced
[ ] Existing tests still pass
[ ] App still works on iOS + Android
```

### Template 6: Create Reusable Component
```
Create reusable component: [COMPONENT_NAME]

LOCATION: lib/components/[ComponentName].tsx

PURPOSE: [Describe what this component does]

PROPS:
```typescript
interface [ComponentName]Props {
  [prop1]: string;
  [prop2]?: boolean; // optional
  onPress?: () => void;
  style?: ViewStyle;
}
```

REQUIREMENTS:
- TypeScript interface for props
- Default props for optional values
- RTL support (if contains text/icons)
- Accessible (screen reader support)
- Loading/disabled states if interactive

STYLING:
- Use NativeWind (no inline styles)
- Support custom style override via `style` prop
- Use design system colors (not hardcoded hex)

EXAMPLE USAGE:
```tsx
<ComponentName
  prop1="value"
  prop2={true}
  onPress={() => console.log('pressed')}
/>
```

CONSTRAINTS:
- Keep component simple (single responsibility)
- No business logic (only presentation)
- No Convex queries inside component
- Provide sensible defaults

TESTING:
[ ] Renders correctly
[ ] Props work as expected
[ ] RTL layout correct
[ ] Accessible
[ ] Works in both light/dark mode (if applicable)
```

### Template 7: Add Form with Validation
```
Create form: [FORM_NAME]

LOCATION: app/(authenticated)/[form-screen].tsx

FIELDS:
- [field1]: text input, required
- [field2]: date picker, required
- [field3]: dropdown, optional

VALIDATION:
- Use react-hook-form or simple useState validation
- Validate on blur and on submit
- Show inline error messages
- Disable submit until valid

STRUCTURE:
```tsx
const [errors, setErrors] = useState<Record<string, string>>({});

const validate = () => {
  const newErrors: Record<string, string> = {};
  if (!field1) newErrors.field1 = "This field is required";
  // more validations
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

const handleSubmit = async () => {
  if (!validate()) return;
  // call Convex mutation
};
```

REQUIREMENTS:
- RTL support for all inputs
- Clear error messages in Hebrew
- Loading state during submission
- Success feedback (toast or navigation)
- Error handling for mutation failures

CONSTRAINTS:
- Do NOT use external form libraries unless already in package.json
- Keep validation simple (no complex regex)
- Use existing input components if available

ACCEPTANCE:
[ ] All fields render correctly
[ ] Validation works on blur + submit
[ ] Error messages clear
[ ] Form submits to Convex
[ ] Success state shown
[ ] RTL layout correct
```

### Template 8: Implement List with Pull-to-Refresh
```
Create list view: [LIST_NAME]

LOCATION: app/(authenticated)/[list-screen].tsx

DATA SOURCE: Convex query `[queryName]`

FEATURES:
- Pull-to-refresh
- Loading skeleton
- Empty state
- Item tap navigation
- RTL support

IMPLEMENTATION:
```tsx
const data = useQuery(api.[module].[queryName], { userId });
const [refreshing, setRefreshing] = useState(false);

const onRefresh = async () => {
  setRefreshing(true);
  // Convex auto-refreshes, just provide visual feedback
  setTimeout(() => setRefreshing(false), 1000);
};

return (
  <FlatList
    data={data}
    renderItem={({ item }) => <ItemComponent item={item} />}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    ListEmptyComponent={<EmptyState />}
    contentContainerStyle={{ padding: 16 }}
  />
);
```

REQUIREMENTS:
- Use FlatList (not ScrollView for long lists)
- Add keyExtractor={(item) => item._id}
- Show loading skeleton while data loads
- Pull-to-refresh provides visual feedback
- Empty state shows helpful message
- Item component extracted (reusable)

CONSTRAINTS:
- Do NOT load all items at once (use pagination if >100 items)
- Optimize renderItem with React.memo
- Keep item component simple

ACCEPTANCE:
[ ] List renders data from Convex
[ ] Pull-to-refresh works
[ ] Empty state shows
[ ] Item tap navigates correctly
[ ] Performs well with 50+ items
[ ] RTL layout correct
```

### Template 9: Add Settings Toggle with Persistence
```
Add setting: [SETTING_NAME]

LOCATION: app/(authenticated)/settings.tsx

SETTING TYPE: [toggle | select | input]

STORAGE: Convex user preferences

IMPLEMENTATION:

1. Update Convex schema:
```typescript
// convex/schema.ts
users: defineTable({
  // existing fields...
  preferences: v.object({
    [settingName]: v.boolean(), // or v.string() for select
  }),
})
```

2. Create mutation:
```typescript
// convex/users.ts
export const updatePreference = mutation({
  args: { key: v.string(), value: v.any() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const user = await ctx.db.query("users").withIndex("by_user_id", q => q.eq("userId", identity.subject)).first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, {
      preferences: { ...user.preferences, [args.key]: args.value }
    });
  }
});
```

3. UI Component:
```tsx
const [enabled, setEnabled] = useState(user?.preferences.[settingName] ?? false);
const updatePreference = useMutation(api.users.updatePreference);

const handleToggle = async (value: boolean) => {
  setEnabled(value);
  await updatePreference({ key: "[settingName]", value });
};

<View className="flex-row justify-between items-center p-4">
  <Text className="text-right">[Setting Label]</Text>
  <Switch value={enabled} onValueChange={handleToggle} />
</View>
```

REQUIREMENTS:
- Immediate UI feedback (optimistic update)
- Persist to Convex
- Load current value on mount
- RTL layout for label

CONSTRAINTS:
- Keep settings simple (no complex nested objects)
- Use existing user table (don't create new table)

ACCEPTANCE:
[ ] Toggle changes immediately in UI
[ ] Value persists to Convex
[ ] Loads correct value on app restart
[ ] Works offline (queues update)
```

### Template 10: Integrate Voice Recording
```
Implement voice recording for AI input

REQUIREMENTS:
- Record audio on button press
- Stop recording on button release or timeout (60s max)
- Upload to Convex storage
- Send to AI for transcription + extraction

DEPENDENCIES:
- expo-av (for audio recording)

IMPLEMENTATION:

1. Install dependency:
```bash
npx expo install expo-av
```

2. Request permissions:
```tsx
import { Audio } from 'expo-av';

const [recording, setRecording] = useState<Audio.Recording>();
const [permissionResponse, requestPermission] = Audio.usePermissions();

const startRecording = async () => {
  if (permissionResponse?.status !== 'granted') {
    await requestPermission();
  }
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  setRecording(recording);
};

const stopRecording = async () => {
  if (!recording) return;
  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  // Upload to Convex storage
  await uploadAudio(uri);
};
```

3. Convex storage upload:
```typescript
// Use Convex file storage API
const upload = useMutation(api.files.generateUploadUrl);
const processAudio = useAction(api.ai.processVoiceInput);

const uploadAudio = async (uri: string) => {
  const uploadUrl = await upload();
  const response = await fetch(uri);
  const blob = await response.blob();
  await fetch(uploadUrl, { method: "POST", body: blob });
  const storageId = uploadUrl.split('/').pop();
  await processAudio({ storageId });
};
```

4. AI processing action:
```typescript
// convex/ai.ts
export const processVoiceInput = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const audioUrl = await ctx.storage.getUrl(args.storageId);
    // Send to Whisper API for transcription
    // Then extract event data with LLM
    // Return structured result
  }
});
```

CONSTRAINTS:
- Max 60 seconds recording
- Show recording indicator (animated)
- Handle permissions gracefully
- Delete audio after processing (privacy)

ACCEPTANCE:
[ ] User can record audio
[ ] Audio uploads to Convex
[ ] AI transcribes + extracts data
[ ] Confirmation screen shows result
[ ] Audio deleted after processing
```

### Template 11: Implement Family Sharing
```
Add family member sharing for events

REQUIREMENTS:
- User can invite family members via link
- Family members see shared events (color-coded)
- Each user has role: owner or member
- Only owner can modify shared event

CONVEX SCHEMA:
```typescript
families: defineTable({
  name: v.string(),
  ownerId: v.string(),
  createdAt: v.number(),
}).index("by_owner", ["ownerId"]),

familyMembers: defineTable({
  familyId: v.id("families"),
  userId: v.string(),
  role: v.union(v.literal("owner"), v.literal("member")),
  color: v.string(), // for color-coding events
  joinedAt: v.number(),
}).index("by_family", ["familyId"]).index("by_user", ["userId"]),

events: defineTable({
  // existing fields...
  familyId: v.optional(v.id("families")),
  createdBy: v.string(),
})
```

MUTATIONS:
```typescript
// convex/families.ts
export const createFamily = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const familyId = await ctx.db.insert("families", {
      name: args.name,
      ownerId: identity.subject,
      createdAt: Date.now(),
    });
    await ctx.db.insert("familyMembers", {
      familyId,
      userId: identity.subject,
      role: "owner",
      color: "#4A90E2", // default color
      joinedAt: Date.now(),
    });
    return familyId;
  }
});

export const generateInviteLink = mutation({
  args: { familyId: v.id("families") },
  handler: async (ctx, args) => {
    // Generate secure token, store in invites table
    // Return deep link: inyomi://join/[token]
  }
});
```

UI FLOW:
1. User creates family → generateInviteLink
2. Share link via system share sheet
3. Invitee opens link → app opens to join screen
4. Accept → add to familyMembers table

CONSTRAINTS:
- No group chat (just event sharing)
- Family members can't modify others' events
- Color-coding for visual clarity
- Keep sharing logic simple (no complex permissions)

ACCEPTANCE:
[ ] User can create family
[ ] Invite link generates
[ ] Invitee can join via link
[ ] Shared events visible to family
[ ] Color-coding works
[ ] Authorization enforced
```

### Template 12: Add Error Boundary
```
Implement error boundary for [SECTION]

LOCATION: lib/components/ErrorBoundary.tsx

PURPOSE: Catch React errors and show user-friendly message

IMPLEMENTATION:
```tsx
import React from 'react';
import { View, Text, Button } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Log to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-lg font-bold mb-2">משהו השתבש</Text>
          <Text className="text-gray-600 text-center mb-4">
            {this.state.error?.message || 'שגיאה לא צפויה'}
          </Text>
          <Button title="נסה שוב" onPress={() => this.setState({ hasError: false })} />
        </View>
      );
    }

    return this.props.children;
  }
}
```

USAGE:
```tsx
// Wrap sensitive sections
<ErrorBoundary>
  <CalendarView />
</ErrorBoundary>

// Or entire app
<ErrorBoundary>
  <RootLayout />
</ErrorBoundary>
```

CONSTRAINTS:
- Keep fallback UI simple
- Log errors for debugging
- Don't expose technical details to users

ACCEPTANCE:
[ ] Catches errors without crashing app
[ ] Shows user-friendly message
[ ] "Try again" resets boundary
[ ] Errors logged for debugging
```

---

## C) CODEBASE AUDIT CHECKLIST

### 1. File & Folder Structure
```
☐ All screens in app/(auth)/ or app/(authenticated)/
☐ Reusable components in lib/components/
☐ Feature-specific code in lib/features/[feature]/
☐ Utilities in lib/utils/ or utils/
☐ Convex functions in convex/ folder
☐ Types in lib/types/ or colocated with features
☐ Constants in lib/constants/ or constants/
☐ No deeply nested folders (max 3 levels)
☐ No orphaned files (files not imported anywhere)
```

### 2. Navigation Pattern
```
☐ Using Expo Router file-based routing
☐ All screens export default component
☐ Stack.Screen configured in _layout.tsx
☐ Deep linking configured in app.json
☐ RTL support in navigation (check drawer/tabs)
☐ Back button works correctly
☐ No broken navigation links
☐ No hardcoded navigation (use router.push)
```

### 3. State Management Consistency
```
☐ Convex queries using useQuery hook
☐ Convex mutations using useMutation hook
☐ Convex actions using useAction hook
☐ Local state using useState (not global state)
☐ Form state using controlled inputs
☐ No prop drilling (pass data through context if needed)
☐ No duplicate state (derive from single source)
☐ Loading states for all async operations
```

### 4. Styling System Consistency
```
☐ All styles using NativeWind (not inline styles)
☐ No StyleSheet.create (use className only)
☐ Consistent color usage (not random hex codes)
☐ Consistent spacing (p-4, gap-4, not arbitrary values)
☐ RTL support in all layouts
☐ No fixed widths (use flex, percentage)
☐ Responsive to different screen sizes
☐ Dark mode considered (if applicable)
```

### 5. Type Safety (TypeScript)
```
☐ No `any` types (search for `: any`)
☐ All components have typed props
☐ All functions have return types
☐ Convex schema types exported and used
☐ Event handlers typed correctly
☐ No implicit any (tsconfig.json strict mode)
☐ Import types from @types or lib/types
☐ No type assertions (as Type) unless necessary
```

### 6. Convex Schema Consistency
```
☐ All tables defined in convex/schema.ts
☐ All tables have indexes for common queries
☐ userId field on all user-owned documents
☐ Authorization checks in all mutations
☐ No duplicate queries (consolidate similar queries)
☐ Queries use indexes (not full table scan)
☐ Mutations have input validation
☐ Actions for external API calls (not mutations)
```

### 7. Duplication & Dead Code
```
☐ No copy-pasted components (extract to shared)
☐ No duplicate utility functions
☐ No unused imports (run linter)
☐ No commented-out code blocks
☐ No unused variables (check warnings)
☐ No dead screens (not linked in navigation)
☐ No unused Convex functions
☐ No duplicate API calls
```

### 8. Code Quality
```
☐ Components < 200 lines (split if larger)
☐ Functions < 50 lines (split if larger)
☐ Descriptive variable names (not x, temp, data)
☐ Consistent naming (camelCase, PascalCase)
☐ No magic numbers (use constants)
☐ Error handling in all async operations
☐ Loading states for all data fetching
☐ Proper TypeScript types (no any)
```

### 9. Security & Privacy
```
☐ Authorization checks in all Convex mutations
☐ User can only access their own data
☐ No sensitive data in client-side code
☐ No API keys in source code (use env vars)
☐ Input validation on all user inputs
☐ SQL injection not possible (Convex prevents this)
☐ XSS not possible (React prevents this)
☐ No exposed internal IDs in URLs
```

### 10. Performance
```
☐ FlatList for long lists (not ScrollView)
☐ React.memo for expensive components
☐ useMemo for expensive calculations
☐ useCallback for event handlers passed to children
☐ Images optimized (not huge file sizes)
☐ No unnecessary re-renders (check React DevTools)
☐ Lazy load heavy components (if applicable)
☐ Debounce search inputs
```

---

## D) INCREMENTAL REFACTOR PLAN

### Phase 1: Stabilize + Conventions (Week 1)
**Objective:** Establish coding standards and fix critical issues

**Steps:**
1. Run TypeScript compiler: `npx tsc --noEmit`
   - Fix all TypeScript errors
   - Remove all `any` types
   - Add missing return types

2. Run linter: `npx eslint . --fix`
   - Fix auto-fixable issues
   - Address remaining warnings

3. Create conventions document:
   - File naming standards
   - Component structure template
   - Convex function template
   - Commit message format

4. Add missing error boundaries:
   - Wrap main app in ErrorBoundary
   - Wrap individual screens if they're crash-prone

5. Add loading states:
   - Every useQuery needs loading indicator
   - Every mutation needs disabled state during submission

**Expected PR Size:** 50-100 lines (small fixes across multiple files)

**Risks:**
- Breaking existing functionality (test thoroughly)
- Merge conflicts if multiple people working

**Validation:**
- App builds without errors
- All screens load without crashing
- TypeScript strict mode enabled

---

### Phase 2: Refactor Folder Structure (Week 2)
**Objective:** Organize code into feature-based folders

**Steps:**
1. Create feature folders:
   ```
   lib/features/
   ├── events/
   ├── tasks/
   ├── family/
   ├── calendar/
   └── ai-input/
   ```

2. Move event-related code:
   - lib/features/events/components/EventCard.tsx
   - lib/features/events/hooks/useEvents.ts
   - lib/features/events/types.ts
   - Update imports in screens

3. Move task-related code:
   - Similar structure for tasks

4. Move family-related code:
   - Family profiles, sharing logic

5. Move AI input code:
   - Image upload, voice recording, text input
   - AI processing logic

6. Create barrel exports:
   - lib/features/events/index.ts exports all public APIs

**Expected PR Size:** 1 PR per feature (5 PRs total, ~20 files moved each)

**Risks:**
- Broken imports (use IDE refactor tools)
- Circular dependencies (fix with barrel exports)

**Validation:**
- App builds without errors
- All features work as before
- No duplicate code after refactor

---

### Phase 3: Consolidate UI Components (Week 3)
**Objective:** Extract common UI patterns into reusable components

**Steps:**
1. Audit existing components:
   - List all repeated UI patterns
   - Identify candidates for extraction

2. Create design system components:
   ```
   lib/components/
   ├── Button.tsx (primary, secondary, ghost)
   ├── Card.tsx (standard content card)
   ├── Input.tsx (text input with RTL)
   ├── DatePicker.tsx (Hebrew-friendly)
   ├── Avatar.tsx (user/family member)
   ├── Badge.tsx (status indicators)
   ├── EmptyState.tsx (no data message)
   └── LoadingState.tsx (skeleton loader)
   ```

3. Extract one component at a time:
   - Create component file
   - Add TypeScript props interface
   - Add RTL support
   - Replace usage in one screen
   - Test thoroughly
   - Replace usage in other screens

4. Document component API:
   - Add JSDoc comments
   - Create Storybook stories (optional)

5. Create color constants:
   ```typescript
   // lib/constants/colors.ts
   export const colors = {
     primary: '#4A90E2',
     secondary: '#7B68EE',
     success: '#4CAF50',
     error: '#F44336',
     // ...
   };
   ```

**Expected PR Size:** 1 PR per component (~5-10 PRs, ~50 lines each)

**Risks:**
- Over-engineering (keep components simple)
- Breaking existing layouts (test visually)

**Validation:**
- All screens use new components
- Consistent look across app
- No hardcoded colors/styles

---

### Phase 4: Data Layer Cleanup (Week 4)
**Objective:** Optimize Convex queries and schema

**Steps:**
1. Audit Convex schema:
   - Review all table definitions
   - Identify missing indexes
   - Add indexes for common queries

2. Consolidate similar queries:
   ```typescript
   // BEFORE: Multiple queries
   const todayEvents = useQuery(api.events.getToday);
   const tomorrowEvents = useQuery(api.events.getTomorrow);
   
   // AFTER: One query with filter
   const events = useQuery(api.events.getRange, { startDate, endDate });
   ```

3. Add authorization checks:
   - Review all mutations
   - Ensure userId check exists
   - Add test cases for unauthorized access

4. Add input validation:
   - Use Convex validators (v.string(), v.number())
   - Add custom validators for complex types
   - Return clear error messages

5. Optimize queries:
   - Add pagination for long lists
   - Use indexes instead of filters
   - Denormalize data if needed (trade-off)

6. Add database migrations:
   - Script to migrate existing data
   - Test on development environment first

**Expected PR Size:** 1 PR per table (~5-8 PRs, ~30-50 lines each)

**Risks:**
- Breaking existing queries (test all screens)
- Data migration failures (backup first)

**Validation:**
- All queries use indexes
- Authorization checks pass
- App performance improved

---

### Phase 5: AI Flows Integration (Week 5)
**Objective:** Implement AI input processing end-to-end

**Steps:**
1. Set up AI API:
   - Configure OpenAI or Anthropic API key
   - Create Convex action for AI calls
   - Add error handling for API failures

2. Implement image AI processing:
   - Upload image to Convex storage
   - Send to AI vision API
   - Extract event data (title, date, time, location)
   - Return structured result

3. Implement text AI processing:
   - Parse text input
   - Send to AI API
   - Extract event data
   - Handle recurring events

4. Implement voice AI processing:
   - Record audio
   - Upload to storage
   - Transcribe with Whisper API
   - Extract event data with LLM

5. Create confirmation flow:
   - Show AI results in editable form
   - Allow user to modify before saving
   - Save to Convex with one mutation

6. Add AI feedback loop:
   - Track user corrections
   - Use to improve prompts over time

**Expected PR Size:** 1 PR per input type (~3 PRs, ~150-200 lines each)

**Risks:**
- AI API costs (set budget limits)
- Slow AI responses (show loading state)
- Inaccurate extractions (allow editing)

**Validation:**
- Image uploads process correctly
- Text parsing works
- Voice transcription accurate
- User can edit AI results
- Events save correctly

---

## E) FEATURE IMPROVEMENT SUGGESTIONS

### UX Improvements (MVP-Ready)

1. **Gesture-Based Quick Actions**
   - Swipe right on event → mark as done
   - Swipe left on event → delete
   - Long press → edit
   - **Why:** Faster than tapping into each event
   - **Effort:** Medium (use react-native-gesture-handler)

2. **Calendar Week View Toggle**
   - Allow switching between day/week/month views
   - Default to day view (less overwhelming)
   - **Why:** Different users prefer different views
   - **Effort:** Medium (calendar logic)

3. **Smart Time Suggestions**
   - When creating event manually, suggest times based on:
     - User's typical schedule
     - Existing events (avoid conflicts)
   - **Why:** Reduces cognitive load
   - **Effort:** Medium (AI/heuristics)

4. **Quick Event Templates**
   - Pre-configured event types: "Doctor Appointment", "School Pickup", "Team Meeting"
   - One-tap to create with defaults
   - **Why:** Faster than AI for common events
   - **Effort:** Low (just pre-filled forms)

5. **Visual Event Density Indicator**
   - Show "busy" vs "free" days at a glance
   - Color-coded calendar cells (red = busy, green = free)
   - **Why:** Helps plan new events
   - **Effort:** Low (visual only)

---

### Product Improvements (MVP-Ready)

1. **Recurring Event Smart Detection**
   - AI detects: "Every Tuesday at 5pm" → suggests recurring event
   - User confirms recurrence pattern
   - **Why:** Most family events repeat (classes, sports)
   - **Effort:** Medium (AI prompt engineering)

2. **Location-Based Reminders**
   - "Remind me when I arrive at the grocery store"
   - Triggered by geofence
   - **Why:** Context-aware is more useful than time-based
   - **Effort:** Medium (requires location permissions)

3. **Shared Event Notifications**
   - When family member adds event, others get notification
   - "Dad added: Pizza night Friday 7pm"
   - **Why:** Keeps family coordinated
   - **Effort:** Low (push notifications)

4. **Event Conflict Warnings**
   - AI detects overlapping events: "You have a meeting at the same time"
   - Suggests rescheduling one
   - **Why:** Prevents double-booking
   - **Effort:** Medium (calendar logic + AI)

5. **Task Auto-Completion**
   - AI suggests related tasks for events
   - "Doctor appointment" → suggest "Fill prescription"
   - User can accept/reject
   - **Why:** Anticipates user needs
   - **Effort:** Medium (AI prompting)

---

### Technical Improvements (MVP-Ready)

1. **Offline Support with Sync**
   - Cache Convex data locally
   - Queue mutations when offline
   - Sync when back online
   - **Why:** Better UX in low connectivity
   - **Effort:** Medium (Convex has built-in support)

2. **Optimistic UI Updates**
   - Update UI immediately on mutation
   - Rollback if mutation fails
   - **Why:** Feels faster
   - **Effort:** Low (Convex optimistic updates)

3. **Image Compression Before Upload**
   - Compress images to <500KB before uploading
   - Faster uploads, lower storage costs
   - **Why:** Better performance, lower costs
   - **Effort:** Low (use expo-image-manipulator)

4. **Error Tracking Integration**
   - Add Sentry or similar
   - Track crashes and errors
   - **Why:** Catch bugs in production
   - **Effort:** Low (Sentry has Expo SDK)

5. **Analytics Events**
   - Track key actions: event_created, ai_input_used, family_invited
   - Use for product decisions
   - **Why:** Data-driven improvements
   - **Effort:** Low (use Expo Analytics or Mixpanel)

---

## USING THIS PROMPT PACK

### For New Features
1. Copy relevant prompt template
2. Fill in placeholders
3. Paste into Cursor chat
4. Review generated code
5. Test thoroughly before committing

### For Refactoring
1. Follow incremental refactor plan phases
2. One PR per phase step
3. Test after each PR
4. Don't move to next phase until current is stable

### For Bug Fixes
1. Use Template 5: Fix Bug with Minimal Diff
2. Investigate root cause first
3. Make smallest possible change
4. Test the specific broken flow

### For Code Review
1. Use Codebase Audit Checklist
2. Check one section at a time
3. Create issues for violations
4. Prioritize by severity

---

## CURSOR TIPS FOR INYOMI

1. **Always provide context:**
   - Paste the Base Context at start of chat
   - Reference specific files you want modified
   - Show existing patterns to follow

2. **Be specific about constraints:**
   - "Do NOT modify navigation structure"
   - "Keep TypeScript strict"
   - "Use existing components only"

3. **Request minimal changes:**
   - "Change only the broken part"
   - "Update just this one component"
   - "Don't refactor unrelated code"

4. **Ask for testing guidance:**
   - "How should I test this change?"
   - "What edge cases should I check?"
   - "Which screens are affected?"

5. **Iterate incrementally:**
   - Implement one feature at a time
   - Test before moving to next
   - Commit working code frequently

Do not redesign branding (boho colors must stay consistent)

Use assets/images/icon.png and assets/images/logo-with-text.png as the only logos

Follow existing screens’ patterns (onboarding + auth + authenticated)
---

**End of Cursor Prompt Pack**