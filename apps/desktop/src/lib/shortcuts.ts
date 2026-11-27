type KeyPress = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/** Ctrl+, (Cmd+, on macOS) opens Configurações, as in most desktop apps. */
export function isSettingsShortcut(event: KeyPress): boolean {
  return event.key === "," && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}

/**
 * Ctrl+H hides or shows every amount. Ctrl only: on macOS Cmd+H hides the app.
 */
export function isPrivacyShortcut(event: KeyPress): boolean {
  return event.key.toLowerCase() === "h" && event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}
