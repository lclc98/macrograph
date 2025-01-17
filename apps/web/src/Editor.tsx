import { Core } from "@macrograph/runtime";
import { Interface, PlatformContext } from "@macrograph/interface";
import * as pkgs from "@macrograph/packages";

import { env } from "~/env/client";

const AUTH_URL = `${env.PUBLIC_VERCEL_URL}/auth`;

export default () => {
  const core = new Core({
    fetch,
    oauth: {
      authorize: async (provider) => {
        const loginWindow = window.open(
          `${AUTH_URL}/${provider}/login?${new URLSearchParams({
            state: window.btoa(
              JSON.stringify({
                env: "web",
                targetOrigin: window.origin,
              })
            ),
          })}`
        );

        if (!loginWindow) {
          return null;
        }

        return await new Promise<any>((res) =>
          window.addEventListener("message", (e) => {
            if (e.source !== loginWindow) return;

            res({ ...e.data, issued_at: Date.now() / 1000 });
          })
        );
      },
      refresh: async (provider, refreshToken) => {
        const res = await fetch(`${AUTH_URL}/${provider}/refresh`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        return {
          ...((await res.json()) as any),
          issued_at: Date.now() / 1000,
        };
      },
    },
  });

  [
    pkgs.github.pkg,
    pkgs.google.pkg,
    pkgs.goxlr.pkg,
    pkgs.json.pkg,
    pkgs.keyboard.pkg,
    pkgs.list.pkg,
    pkgs.localStorage.pkg,
    pkgs.logic.pkg,
    pkgs.map.pkg,
    pkgs.obs.pkg,
    pkgs.spotify.pkg,
    pkgs.twitch.pkg,
    pkgs.utils.pkg,
    pkgs.openai.pkg,
    pkgs.speakerbot.pkg,
    pkgs.variables.pkg,
    pkgs.customEvents.pkg,
  ].map((p) => core.registerPackage(p));

  return (
    <PlatformContext.Provider value={{}}>
      <Interface core={core} environment="browser" />
    </PlatformContext.Provider>
  );
};
