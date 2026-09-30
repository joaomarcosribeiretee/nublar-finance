import { expect, test } from "@playwright/test";

test("home shows the Nublar identity", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nublar" })).toBeVisible();
  await expect(page.getByText("Onde estou?")).toBeVisible();
});
