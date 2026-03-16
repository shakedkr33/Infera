import { useConvexAuth } from 'convex/react';
import { Redirect, Slot, useLocalSearchParams, useSegments } from 'expo-router';

import { IS_DEV_MODE } from '@/config/appConfig';

export default function AuthRoutesLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const segments = useSegments();
  const { preview } = useLocalSearchParams<{ preview?: string }>();

  // Wait for auth state to hydrate from SecureStore before making routing decisions
  if (isLoading) {
    return null;
  }

  // Preview mode lets authenticated developers access auth screens for debugging
  const isPreviewMode = IS_DEV_MODE && preview === 'true';
  const segmentStrings = segments as string[];
  const isPaywallRoute = segmentStrings.includes('paywall');
  const isAllowedForAuthenticated = isPaywallRoute || isPreviewMode;

  // Authenticated users have no business on auth screens — redirect them home
  if (isAuthenticated && !isAllowedForAuthenticated) {
    return <Redirect href="/(authenticated)" />;
  }

  return <Slot />;
}
