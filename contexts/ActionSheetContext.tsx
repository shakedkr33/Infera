import { createContext, useContext } from 'react';

interface ActionSheetContextType {
  openActionSheet: () => void;
}

export const ActionSheetContext = createContext<ActionSheetContextType>({
  openActionSheet: () => {},
});

export const useActionSheet = () => useContext(ActionSheetContext);
