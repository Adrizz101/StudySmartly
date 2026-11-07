import { createContext, useContext } from 'react';

export type FocusModeContextValue = {
  focusMode: boolean;
  setFocusMode: (value: boolean) => void;
};

export const FocusModeContext = createContext<FocusModeContextValue>({
  focusMode: false,
  setFocusMode: () => {},
});

export function useFocusMode() {
  return useContext(FocusModeContext);
}
