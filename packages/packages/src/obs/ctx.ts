import { ReactiveMap } from "@solid-primitives/map";
import OBS, { EventSubscription, EventTypes } from "obs-websocket-js";
import { Maybe } from "@macrograph/typesystem";
import { z } from "zod";

type InstanceState = { password: string | null } & (
  | {
      state: "disconnected" | "connecting";
    }
  | {
      state: "connected";
      obs: OBS;
    }
);

// old localstorage key
const OBS_WS = "obsWs";

const OBS_INSTANCES = "obs-instances";
const INSTANCE_SCHEMA = z.object({
  url: z.string(),
  password: z.string().optional(),
});

export function createCtx(
  emitEvent: <T extends keyof EventTypes>(data: {
    name: T;
    data: EventTypes[T];
  }) => void
) {
  const instances = new ReactiveMap<string, InstanceState>();

  async function addInstance(ip: string, password?: string) {
    await disconnectInstance(ip);

    instances.set(ip, { state: "connecting", password: password ?? null });
    persistInstances();

    await connectInstance(ip);
  }

  async function connectInstance(ip: string) {
    const maybeInstance = instances.get(ip);
    if (!maybeInstance) return;

    const instance = maybeInstance;
    function setDisconnected() {
      instances.set(ip, {
        state: "disconnected",
        password: instance.password,
      });
    }

    const obs = new OBS();

    try {
      await obs.connect(ip, instance.password ?? undefined, {
        eventSubscriptions:
          EventSubscription.All |
          EventSubscription.SceneItemTransformChanged |
          EventSubscription.InputActiveStateChanged |
          EventSubscription.InputShowStateChanged,
      });
    } catch {
      setDisconnected();
      return;
    }

    obs.on("ConnectionClosed", setDisconnected);
    obs.on("ConnectionError", setDisconnected);

    instances.set(ip, { state: "connected", obs, password: instance.password });
    persistInstances();
  }

  async function disconnectInstance(ip: string) {
    const instance = instances.get(ip);
    if (!instance) return;
    if (instance.state !== "connected") return;

    instances.set(ip, { state: "disconnected", password: instance.password });
    await instance.obs.disconnect();
  }

  async function removeInstance(ip: string) {
    instances.delete(ip);
    persistInstances();
    await disconnectInstance(ip);
  }

  // convert old localstorage data to new system
  Maybe(localStorage.getItem(OBS_WS)).mapAsync(async (jstr) => {
    const { url, password } = INSTANCE_SCHEMA.parse(JSON.parse(jstr));

    try {
      await addInstance(url, password);
    } catch {
    } finally {
      localStorage.removeItem(OBS_WS);
    }
  });

  Maybe(localStorage.getItem(OBS_INSTANCES)).mapAsync(async (jstr) => {
    const instances = z.array(INSTANCE_SCHEMA).parse(JSON.parse(jstr));

    instances.forEach((i) => addInstance(i.url, i.password));
  });

  function persistInstances() {
    localStorage.setItem(
      OBS_INSTANCES,
      JSON.stringify(
        [...instances].map(([url, instance]) => ({
          url,
          password: instance.password,
        }))
      )
    );
  }

  return {
    instances,
    addInstance,
    connectInstance,
    disconnectInstance,
    removeInstance,
  };
}

export type Ctx = ReturnType<typeof createCtx>;
