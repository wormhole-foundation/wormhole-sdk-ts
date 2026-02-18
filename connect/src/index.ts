export * from "./wormhole.js";
export * from "./config.js";
export * from "./common.js";
export * from "./types.js";
export * from "./warnings.js";

export * from "./protocols/index.js";

// Deprecated namespace re-exports — use subpath imports instead:
//   import * as routes from "@wormhole-foundation/sdk-connect/routes"
//   import * as tasks from "@wormhole-foundation/sdk-connect/tasks"
//   import * as circleApi from "@wormhole-foundation/sdk-connect/circle-api"
//   import * as api from "@wormhole-foundation/sdk-connect/whscan-api"
import * as _tasks from "./tasks.js";
import * as _circleApi from "./circle-api.js";
import * as _api from "./whscan-api.js";
import * as _routes from "./routes/index.js";

const _warned = new Set<string>();
function _deprecate<T extends object>(name: string, subpath: string, mod: T): T {
  return new Proxy(mod, {
    get(target, prop, receiver) {
      if (!_warned.has(name)) {
        _warned.add(name);
        console.warn(
          `[@wormhole-foundation/sdk-connect] Accessing "${name}" from the barrel export is deprecated ` +
            `and will be removed in a future version. ` +
            `Use: import * as ${name} from "@wormhole-foundation/sdk-connect/${subpath}"`,
        );
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/** @deprecated Use `import * as routes from "@wormhole-foundation/sdk-connect/routes"` */
export const routes = _deprecate("routes", "routes", _routes);
/** @deprecated Use `import * as tasks from "@wormhole-foundation/sdk-connect/tasks"` */
export const tasks = _deprecate("tasks", "tasks", _tasks);
/** @deprecated Use `import * as circleApi from "@wormhole-foundation/sdk-connect/circle-api"` */
export const circleApi = _deprecate("circleApi", "circle-api", _circleApi);
/** @deprecated Use `import * as api from "@wormhole-foundation/sdk-connect/whscan-api"` */
export const api = _deprecate("api", "whscan-api", _api);

export * from "./indexers/index.js";

// Re-export from core packages
export * from "@wormhole-foundation/sdk-base";
export * from "@wormhole-foundation/sdk-definitions";
