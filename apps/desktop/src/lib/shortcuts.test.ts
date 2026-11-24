import { describe, expect, it } from "vitest";
import { isSettingsShortcut } from "./shortcuts";

const press = (key: string, modifiers: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("isSettingsShortcut", () => {
  it("opens settings with Ctrl+, and Cmd+,", () => {
    expect(isSettingsShortcut(press(",", { ctrlKey: true }))).toBe(true);
    expect(isSettingsShortcut(press(",", { metaKey: true }))).toBe(true);
  });

  it("ignores a plain comma, so typing is never hijacked", () => {
    expect(isSettingsShortcut(press(","))).toBe(false);
  });

  it("ignores other combinations", () => {
    expect(isSettingsShortcut(press(".", { ctrlKey: true }))).toBe(false);
    expect(isSettingsShortcut(press(",", { ctrlKey: true, altKey: true }))).toBe(false);
    expect(isSettingsShortcut(press(",", { ctrlKey: true, shiftKey: true }))).toBe(false);
  });
});
