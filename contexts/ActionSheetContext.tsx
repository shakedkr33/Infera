import { createContext, useContext } from 'react';

/**
 * Stage 2B: lets a screen (currently only the community screen) tell the
 * GLOBAL bottom-center "+" sheet which community is active, so the sheet can
 * add community creation actions alongside the personal ones — without the
 * sheet itself knowing about routes/screens. `canCreateCommunityContent`
 * mirrors the exact same owner/admin permission already enforced by the
 * server for community event/reminder creation (see convex/events.ts and
 * convex/tasks.ts) — this context never broadens that permission.
 */
export interface ActiveCommunityContext {
  communityId: string;
  communityName: string;
  canCreateCommunityContent: boolean;
}

interface ActionSheetContextType {
  openActionSheet: () => void;
  setActiveCommunityContext: (context: ActiveCommunityContext | null) => void;
}

export const ActionSheetContext = createContext<ActionSheetContextType>({
  openActionSheet: () => {},
  setActiveCommunityContext: () => {},
});

export const useActionSheet = () => useContext(ActionSheetContext);
