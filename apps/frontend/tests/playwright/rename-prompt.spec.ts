import { expect, test } from "@playwright/test";
import { setupPlaywrightRoutes } from "./route-helpers";

test("rename prompt trims input and updates the chat label", async ({ page }) => {
  let capturedRenameTitle: string | null = null;

  await setupPlaywrightRoutes(page, {
    onChatPatch: (_chatId, payload) => {
      if (typeof payload.title === "string") {
        capturedRenameTitle = payload.title;
      }
    },
  });

  await page.goto("/", { waitUntil: "networkidle" });
  const sourceChatItem = page.locator(".chats-column .list .item:not(.meta)").first();
  await sourceChatItem.waitFor();
  await sourceChatItem.click({ button: "right" });
  await page.locator(".context-menu").waitFor();

  const dialogPromise = page.waitForEvent("dialog");
  await page.getByRole("button", { name: "Rename chat" }).click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain("Rename chat");
  await dialog.accept("  Renamed Chat  ");

  await expect.poll(() => capturedRenameTitle ?? null).toBe("Renamed Chat");
  const renamedTitle = page
    .locator(".chats-column .list .item:not(.meta)")
    .first()
    .locator(".item-title");
  await expect(renamedTitle).toHaveText("Renamed Chat");
});
