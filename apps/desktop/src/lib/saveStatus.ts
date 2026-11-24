/**
 * Discreet "Salvo" feedback for settings that save on change. Several changes
 * can be in flight at once: "Salvo" only shows when none of them failed, since
 * a failed change is rolled back and the user must notice it.
 */
export type SaveState = { pending: number; last: "saved" | "error" | null };

export type SaveEvent = "start" | "success" | "error" | "clear";

export const initialSaveState: SaveState = { pending: 0, last: null };

export function saveReducer(state: SaveState, event: SaveEvent): SaveState {
  switch (event) {
    case "start":
      // A failure among changes still in flight is not forgotten by a new one.
      return { pending: state.pending + 1, last: state.pending > 0 ? state.last : null };
    case "success":
      return { pending: Math.max(state.pending - 1, 0), last: state.last === "error" ? "error" : "saved" };
    case "error":
      return { pending: Math.max(state.pending - 1, 0), last: "error" };
    case "clear":
      return state.pending > 0 ? state : { ...state, last: null };
  }
}

export function saveLabel(state: SaveState): string | null {
  if (state.pending > 0) return "Salvando…";
  if (state.last === "saved") return "Salvo";
  if (state.last === "error") return "Não foi possível salvar";
  return null;
}
