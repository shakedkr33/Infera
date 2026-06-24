/**
 * useGoogleCalendarAuth — Google Calendar read-only authorization hook.
 *
 * Implements an OAuth 2.0 Authorization Code + PKCE flow using the low-level
 * expo-auth-session APIs. It is intentionally scoped to authorization only:
 * it obtains a short-lived access token for calendar.readonly and hands it
 * to the caller. It does not fetch calendars, normalize events, or call Convex.
 *
 * Security contract:
 * - Only the calendar.readonly scope is requested. No identity scopes.
 * - The client ID is read and validated exclusively at hook call-time from
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. It is never hardcoded.
 * - The redirect URI is derived from the validated client ID inside the hook.
 *   No Google URI is ever constructed from invalid or absent configuration.
 * - The access token lives in React state only; it is never written to
 *   AsyncStorage, SecureStore, module globals, analytics, or any Convex function.
 * - The authorization code and PKCE verifier are used only for the token
 *   exchange and then discarded. Neither is stored or logged.
 * - The refresh token returned by Google (if any) is immediately discarded.
 * - No Gmail address or user identity is requested or retained.
 * - No console.log / console.error call involves OAuth parameters.
 *
 * State machine:
 *   idle → authorizing → exchanging → authorized
 *                 ↓           ↓
 *               denied      error
 *   Any state → idle (via clearAuthorization or silent cancel/dismiss)
 */

import {
  CodeChallengeMethod,
  exchangeCodeAsync,
  makeRedirectUri,
  Prompt,
  ResponseType,
  useAuthRequest,
} from 'expo-auth-session';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Static Google OAuth 2.0 discovery endpoints.
 * Using static values avoids a network round-trip to fetch the discovery doc
 * and makes the endpoints auditable without inspecting network traffic.
 */
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
} as const;

const CALENDAR_READONLY = 'https://www.googleapis.com/auth/calendar.readonly';

/** Expected suffix for a Google iOS OAuth client ID. */
const GOOGLE_IOS_SUFFIX = '.apps.googleusercontent.com';

/**
 * Inert placeholder values used by useAuthRequest when the real configuration
 * is absent. These strings are never sent to any authorization server:
 * passing null discovery to useAuthRequest prevents the AuthRequest from
 * loading, so promptAsync cannot open a browser even if the screen renders.
 */
const INERT_CLIENT_ID = 'not-configured';
const INERT_REDIRECT_URI = 'inyomi://oauth-not-configured';

// ── Configuration helpers ────────────────────────────────────────────────────

/**
 * Validate and return a trimmed Google iOS client ID, or null.
 *
 * Accepts only a non-empty string value ending in ".apps.googleusercontent.com".
 * A missing, non-string, empty, or structurally inconsistent value returns null.
 */
function resolveClientId(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!trimmed.endsWith(GOOGLE_IOS_SUFFIX)) return null;
  return trimmed;
}

/**
 * Derive the iOS native redirect URI from a validated Google iOS client ID.
 * Reverses the dot-separated components and appends the standard path:
 *   "X.apps.googleusercontent.com" → "com.googleusercontent.apps.X:/oauthredirect"
 */
function deriveRedirectUri(clientId: string): string {
  const reversed = clientId.split('.').reverse().join('.');
  return makeRedirectUri({ native: `${reversed}:/oauthredirect` });
}

// ── Public types ─────────────────────────────────────────────────────────────

export type GoogleCalendarAuthStatus =
  | 'idle'
  | 'authorizing'
  | 'exchanging'
  | 'authorized'
  | 'denied'
  | 'error';

export type UseGoogleCalendarAuthResult = {
  status: GoogleCalendarAuthStatus;
  /** In-memory access token; null in every state except 'authorized'. */
  accessToken: string | null;
  /** Localised Hebrew error message; null unless status is 'denied' or 'error'. */
  errorMessage: string | null;
  /** Begin the OAuth flow. Safe to call only when status is 'idle'. */
  startAuthorization: () => Promise<void>;
  /** Reset to idle and discard the in-memory token and any error state. */
  clearAuthorization: () => void;
};

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Runs the Google Calendar read-only Authorization Code + PKCE flow and
 * surfaces the result as a simple status machine.
 *
 * Call startAuthorization() to begin the flow. On success, status becomes
 * 'authorized' and accessToken holds the short-lived Google access token.
 * Call clearAuthorization() to reset the hook to idle and discard the token.
 */
export function useGoogleCalendarAuth(): UseGoogleCalendarAuthResult {
  const [status, setStatus] = useState<GoogleCalendarAuthStatus>('idle');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guard: do not set state on an unmounted component.
  const isMounted = useRef(true);
  // Guard: prevent triggering a second token exchange for the same auth code.
  const isExchanging = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      // Signal all in-flight async work to discard their results.
      isMounted.current = false;
      isExchanging.current = false;
      // React state (accessToken, errorMessage) is GC'd with the component.
      // They are never persisted outside React state.
    };
  }, []);

  // ── Configuration validation ───────────────────────────────────────────────
  //
  // Validate the client ID on every render call.
  // process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is inlined at build time,
  // so the result is effectively constant across renders.
  //
  // Redirect URI derivation is intentionally deferred to this point (inside
  // the hook) so that no Google URI is ever constructed from absent or
  // malformed configuration at module initialization time.

  const clientId = resolveClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  const redirectUri = clientId !== null ? deriveRedirectUri(clientId) : null;
  const hasValidConfig = clientId !== null && redirectUri !== null;

  // ── Auth request setup ─────────────────────────────────────────────────────
  //
  // When configuration is absent (hasValidConfig === false):
  // - INERT_CLIENT_ID / INERT_REDIRECT_URI are placeholder strings that are
  //   never sent to any server.
  // - Passing null as the discovery document prevents the AuthRequest from
  //   loading, so request === null and promptAsync cannot open a browser.
  //
  // When configuration is valid:
  // - The real clientId and derivedRedirectUri are used.
  // - GOOGLE_DISCOVERY enables the request to load and promptAsync to run.

  const [request, , promptAsync] = useAuthRequest(
    {
      clientId: clientId ?? INERT_CLIENT_ID,
      responseType: ResponseType.Code,
      redirectUri: redirectUri ?? INERT_REDIRECT_URI,
      scopes: [CALENDAR_READONLY],
      usePKCE: true,
      codeChallengeMethod: CodeChallengeMethod.S256,
      prompt: Prompt.Consent,
    },
    hasValidConfig ? GOOGLE_DISCOVERY : null,
  );

  const clearAuthorization = useCallback((): void => {
    isExchanging.current = false;
    setStatus('idle');
    setAccessToken(null);
    setErrorMessage(null);
  }, []);

  const startAuthorization = useCallback(async (): Promise<void> => {
    // Configuration gate: fail with a generic message if the client ID is
    // missing, empty, or structurally inconsistent. Do not expose variable
    // names, client ID values, or redirect URIs in the user-facing message.
    if (!hasValidConfig || clientId === null || redirectUri === null) {
      if (isMounted.current) {
        setStatus('error');
        setErrorMessage('לא ניתן להשלים את ההרשאה. נסי שוב.');
      }
      return;
    }

    // The AuthRequest must finish loading before promptAsync is usable.
    // When hasValidConfig is false the request is null (discovery is null),
    // so this guard is a secondary safety net.
    if (!request) return;

    if (isMounted.current) {
      setStatus('authorizing');
      setErrorMessage(null);
      setAccessToken(null);
    }

    let result;
    try {
      result = await promptAsync();
    } catch {
      if (isMounted.current) {
        setStatus('error');
        setErrorMessage('לא ניתן להשלים את ההרשאה. נסי שוב.');
      }
      return;
    }

    if (!isMounted.current) return;

    // Cancel / dismiss: return silently to idle without any error message.
    if (result.type === 'cancel' || result.type === 'dismiss') {
      setStatus('idle');
      setAccessToken(null);
      return;
    }

    // Error result from the authorization server.
    if (result.type === 'error') {
      const serverError = result.params?.error;
      if (serverError === 'access_denied') {
        setStatus('denied');
        setErrorMessage('לא ניתנה הרשאה לגישה ליומן. ניתן לנסות שוב.');
      } else {
        setStatus('error');
        setErrorMessage('לא ניתן להשלים את ההרשאה. נסי שוב.');
      }
      setAccessToken(null);
      return;
    }

    // Unexpected non-success result type.
    if (result.type !== 'success') {
      setStatus('idle');
      return;
    }

    const authCode = result.params?.code;
    if (!authCode) {
      setStatus('error');
      setErrorMessage('לא ניתן להשלים את ההרשאה. נסי שוב.');
      setAccessToken(null);
      return;
    }

    // Prevent duplicate exchanges if this callback somehow fires twice.
    if (isExchanging.current) return;
    isExchanging.current = true;

    setStatus('exchanging');

    try {
      const codeVerifier = request.codeVerifier;
      const tokenResponse = await exchangeCodeAsync(
        {
          // Use the same clientId and redirectUri that were used in the
          // authorization request — both come from the same validated config.
          clientId,
          code: authCode,
          redirectUri,
          // Pass the PKCE verifier so the authorization server can validate
          // the code challenge that was included in the authorization request.
          extraParams: codeVerifier ? { code_verifier: codeVerifier } : undefined,
        },
        { tokenEndpoint: GOOGLE_DISCOVERY.tokenEndpoint },
      );

      if (!isMounted.current) return;

      // Retain only the access token. Discard the full TokenResponse object,
      // the refresh token, expiry metadata, and any other OAuth response fields.
      const token = tokenResponse.accessToken;
      setAccessToken(token);
      setStatus('authorized');
    } catch {
      if (!isMounted.current) return;
      setStatus('error');
      setErrorMessage('לא ניתן להשלים את ההרשאה. נסי שוב.');
      setAccessToken(null);
    } finally {
      isExchanging.current = false;
    }
  }, [request, promptAsync, hasValidConfig, clientId, redirectUri]);

  return { status, accessToken, errorMessage, startAuthorization, clearAuthorization };
}
