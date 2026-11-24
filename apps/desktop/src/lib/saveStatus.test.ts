import { describe, expect, it } from "vitest";
import { initialSaveState, saveLabel, saveReducer, type SaveEvent } from "./saveStatus";

const run = (...events: SaveEvent[]) => events.reduce(saveReducer, initialSaveState);

describe("save status", () => {
  it("shows nothing before any change", () => {
    expect(saveLabel(initialSaveState)).toBeNull();
  });

  it("shows saving, then saved, then clears", () => {
    expect(saveLabel(run("start"))).toBe("Salvando…");
    expect(saveLabel(run("start", "success"))).toBe("Salvo");
    expect(saveLabel(run("start", "success", "clear"))).toBeNull();
  });

  it("keeps saving while another change is still in flight", () => {
    expect(saveLabel(run("start", "start", "success"))).toBe("Salvando…");
    expect(saveLabel(run("start", "start", "success", "clear"))).toBe("Salvando…");
    expect(saveLabel(run("start", "start", "success", "success"))).toBe("Salvo");
  });

  it("never says saved when one of the changes failed", () => {
    expect(saveLabel(run("start", "error"))).toBe("Não foi possível salvar");
    expect(saveLabel(run("start", "start", "error", "success"))).toBe("Não foi possível salvar");
    expect(saveLabel(run("start", "start", "error", "start", "success", "success"))).toBe("Não foi possível salvar");
  });

  it("starts fresh on the next change", () => {
    expect(saveLabel(run("start", "error", "start", "success"))).toBe("Salvo");
  });
});
