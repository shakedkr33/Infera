import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';

// ─── Internal Query ───────────────────────────────────────────────────────────

export const getPushRecipients = internalQuery({
  args: {
    recipientUserIds: v.array(v.id('users')),
  },
  returns: v.array(
    v.object({
      userId: v.id('users'),
      enabled: v.boolean(),
      tokens: v.array(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const results = [];

    for (const userId of args.recipientUserIds) {
      const user = await ctx.db.get(userId);
      const enabled = user ? user.pushNotificationsEnabled !== false : false;

      const activeTokens = await ctx.db
        .query('pushTokens')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect();

      const tokens = activeTokens.filter((t) => t.isActive).map((t) => t.token);

      results.push({ userId, enabled, tokens });
    }

    return results;
  },
});

// ─── Internal Mutations ───────────────────────────────────────────────────────

export const logNotification = internalMutation({
  args: {
    recipientUserId: v.id('users'),
    pushType: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    status: v.union(
      v.literal('sent'),
      v.literal('skipped'),
      v.literal('failed')
    ),
    skipReason: v.optional(v.string()),
    expoReceiptId: v.optional(v.string()),
  },
  returns: v.id('notificationLog'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('notificationLog', {
      recipientUserId: args.recipientUserId,
      pushType: args.pushType,
      title: args.title,
      body: args.body,
      data: args.data,
      status: args.status,
      skipReason: args.skipReason,
      expoReceiptId: args.expoReceiptId,
      createdAt: Date.now(),
    });
  },
});

export const markTokenDead = internalMutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

// ─── Internal Action — single exit point for all push notifications ───────────

export const sendPush = internalAction({
  args: {
    recipientUserIds: v.array(v.id('users')),
    pushType: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    categoryId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipients = await ctx.runQuery(
      internal.pushNotifications.getPushRecipients,
      { recipientUserIds: args.recipientUserIds }
    );

    type PushMessage = {
      to: string;
      title: string;
      body: string;
      data?: unknown;
      sound: string;
      categoryIdentifier?: string;
      priority: string;
    };

    const messages: PushMessage[] = [];
    // Track which token belongs to which userId for error handling
    const tokenToUserId = new Map<string, Id<'users'>>();

    for (const recipient of recipients) {
      if (!recipient.enabled) {
        await ctx.runMutation(internal.pushNotifications.logNotification, {
          recipientUserId: recipient.userId,
          pushType: args.pushType,
          title: args.title,
          body: args.body,
          data: args.data,
          status: 'skipped',
          skipReason: 'notifications_disabled',
        });
        continue;
      }

      if (recipient.tokens.length === 0) {
        await ctx.runMutation(internal.pushNotifications.logNotification, {
          recipientUserId: recipient.userId,
          pushType: args.pushType,
          title: args.title,
          body: args.body,
          data: args.data,
          status: 'skipped',
          skipReason: 'no_token',
        });
        continue;
      }

      for (const token of recipient.tokens) {
        tokenToUserId.set(token, recipient.userId);
        const msg: PushMessage = {
          to: token,
          title: args.title,
          body: args.body,
          data: args.data,
          sound: 'default',
          priority: 'high',
        };
        if (args.categoryId) {
          msg.categoryIdentifier = args.categoryId;
        }
        messages.push(msg);
      }
    }

    if (messages.length === 0) return null;

    // Batch in chunks of 100
    const CHUNK_SIZE = 100;
    const chunks: PushMessage[][] = [];
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      chunks.push(messages.slice(i, i + CHUNK_SIZE));
    }

    try {
      for (const chunk of chunks) {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          // Log all in this chunk as failed
          for (const msg of chunk) {
            const userId = tokenToUserId.get(msg.to);
            if (userId) {
              await ctx.runMutation(
                internal.pushNotifications.logNotification,
                {
                  recipientUserId: userId,
                  pushType: args.pushType,
                  title: args.title,
                  body: args.body,
                  data: args.data,
                  status: 'failed',
                  skipReason: `http_${response.status}`,
                }
              );
            }
          }
          continue;
        }

        type ExpoTicket = {
          status: 'ok' | 'error';
          id?: string;
          message?: string;
          details?: { error?: string };
        };
        type ExpoResponse = { data: ExpoTicket[] };

        const result = (await response.json()) as ExpoResponse;
        const tickets = result.data ?? [];

        for (let i = 0; i < chunk.length; i++) {
          const msg = chunk[i];
          const ticket = tickets[i];
          const userId = tokenToUserId.get(msg.to);
          if (!userId) continue;

          if (ticket?.status === 'error') {
            if (ticket.details?.error === 'DeviceNotRegistered') {
              await ctx.runMutation(internal.pushNotifications.markTokenDead, {
                token: msg.to,
              });
            }
            await ctx.runMutation(internal.pushNotifications.logNotification, {
              recipientUserId: userId,
              pushType: args.pushType,
              title: args.title,
              body: args.body,
              data: args.data,
              status: 'failed',
              skipReason: ticket.message ?? ticket.details?.error ?? 'unknown',
            });
          } else {
            await ctx.runMutation(internal.pushNotifications.logNotification, {
              recipientUserId: userId,
              pushType: args.pushType,
              title: args.title,
              body: args.body,
              data: args.data,
              status: 'sent',
              expoReceiptId: ticket?.id,
            });
          }
        }
      }
    } catch (err) {
      // Network failure — log all as failed
      const alreadyLogged = new Set<Id<'users'>>();
      for (const msg of messages) {
        const userId = tokenToUserId.get(msg.to);
        if (userId && !alreadyLogged.has(userId)) {
          alreadyLogged.add(userId);
          await ctx.runMutation(internal.pushNotifications.logNotification, {
            recipientUserId: userId,
            pushType: args.pushType,
            title: args.title,
            body: args.body,
            data: args.data,
            status: 'failed',
            skipReason: err instanceof Error ? err.message : 'network_error',
          });
        }
      }
    }

    return null;
  },
});
