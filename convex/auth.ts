import { Phone } from '@convex-dev/auth/providers/Phone';
import { convexAuth } from '@convex-dev/auth/server';

// The Phone() wrapper only forwards sendVerificationRequest to the top-level
// provider object. generateVerificationToken is placed inside options and is
// never read by the library's token-generation logic (signIn.js reads
// provider.generateVerificationToken directly). We spread Phone() and patch
// generateVerificationToken onto the top-level object so the library finds it.
const generate6DigitOtp = () =>
  Promise.resolve(String(Math.floor(100000 + Math.random() * 900000)));

// ── Phone normalization ───────────────────────────────────────────────────────
// FIXED: phone-based family member matching runs on new user creation
// Mirrors lib/phoneUtils.ts normalizeIsraeliPhone — duplicated here because
// Convex backend cannot import from the client lib/ folder.
function normalizeToE164(phone: string): string | null {
  const stripped = phone.replace(/[\s\-()]/g, '');
  if (stripped.startsWith('+972')) return stripped;
  if (stripped.startsWith('972')) return `+${stripped}`;
  if (stripped.startsWith('0')) return `+972${stripped.slice(1)}`;
  if (stripped.startsWith('5')) return `+972${stripped}`;
  return null;
}

// Minimal shape of a family contact entry stored in the familyContacts blob
type FamilyContactEntry = {
  id: string;
  selectedPhoneNumber?: string;
  matchedUserId?: string;
  [key: string]: unknown;
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    {
      ...Phone({
        sendVerificationRequest: async ({ identifier: phone, token: code }) => {
          // SMS_PROVIDER_STUB: replace this with Twilio Verify in Phase 2
          // RATE_LIMIT_STUB: add server-side rate limiting in Phase 2
          console.log(`[Auth] OTP for ${phone}: ${code}`);
        },
      }),
      generateVerificationToken: generate6DigitOtp,
    },
  ],
  session: {
    totalDurationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const now = Date.now();
      // For Phone provider, the identifier is in args.profile.phone (E.164 format)
      const phone = (args.profile as { phone?: string }).phone ?? undefined;

      if (args.existingUserId) {
        await ctx.db.patch(args.existingUserId, {
          phone,
          updatedAt: now,
        });
        return args.existingUserId;
      }

      // New user — insert first, then run phone-based family member matching
      const userId = await ctx.db.insert('users', {
        phone,
        role: 'user',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // FIXED: phone-based family member matching runs on new user creation
      // Scan all users' familyContacts for any entry whose selectedPhoneNumber
      // normalizes to the same E.164 as the new user's phone. Set matchedUserId
      // on the match so deriveFamilyMemberStatus() returns "מחובר" for the inviter.
      if (phone) {
        const normalizedNewPhone = normalizeToE164(phone);
        if (normalizedNewPhone) {
          // Table scan — acceptable for MVP; replace with dedicated index when scale requires
          const allUsers = await ctx.db.query('users').collect();
          for (const otherUser of allUsers) {
            const contacts = otherUser.familyContacts;
            if (!contacts || !Array.isArray(contacts)) continue;

            let changed = false;
            const updated = (contacts as FamilyContactEntry[]).map((entry) => {
              if (entry.matchedUserId) return entry; // already matched — do not overwrite
              if (!entry.selectedPhoneNumber) return entry;
              const entryNorm = normalizeToE164(entry.selectedPhoneNumber);
              if (entryNorm === normalizedNewPhone) {
                changed = true;
                return { ...entry, matchedUserId: userId };
              }
              return entry;
            });

            if (changed) {
              await ctx.db.patch(otherUser._id, { familyContacts: updated });
            }
          }
        }
      }

      return userId;
    },
  },
});
