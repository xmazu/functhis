import { createAuthIdentifier, type BetterAuthInstance } from "evlog/better-auth";

import { createAuth } from "../../src/services";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", async (event) => {
    const identify = createAuthIdentifier((await createAuth()) as BetterAuthInstance, {
      exclude: ["/api/auth/**"],
      maskEmail: true,
    });
    await identify(event);
  });
});
