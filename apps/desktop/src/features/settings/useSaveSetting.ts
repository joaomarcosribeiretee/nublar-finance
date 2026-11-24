import { useCallback, useEffect, useReducer } from "react";
import type { UpdatePreferencesInput } from "@nublar/validation";
import { usePreferences } from "@/hooks/usePreferences";
import { initialSaveState, saveLabel, saveReducer } from "@/lib/saveStatus";

/** How long "Salvo" stays before fading out. */
const SAVED_VISIBLE_MS = 2000;

/**
 * Every setting saves the moment it changes; there is no "Salvar" button.
 * Returns the save function for the controls and the discreet status line.
 */
export function useSaveSetting() {
  const { preferences, updateAsync } = usePreferences();
  const [state, dispatch] = useReducer(saveReducer, initialSaveState);

  const save = useCallback(
    (patch: UpdatePreferencesInput) => {
      dispatch("start");
      updateAsync(patch).then(
        () => dispatch("success"),
        () => dispatch("error"),
      );
    },
    [updateAsync],
  );

  const settled = state.pending === 0 && state.last === "saved";
  useEffect(() => {
    if (!settled) return;
    const timer = window.setTimeout(() => dispatch("clear"), SAVED_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [settled]);

  return {
    preferences,
    save,
    status: saveLabel(state),
    saved: settled,
    failed: state.pending === 0 && state.last === "error",
  };
}
