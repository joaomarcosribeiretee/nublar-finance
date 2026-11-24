type KeyPress = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/** Ctrl+, (Cmd+, on macOS) opens Configurações, as in most desktop apps. */
export function isSettingsShortcut(event: KeyPress): boolean {
  return event.key === "," && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}
