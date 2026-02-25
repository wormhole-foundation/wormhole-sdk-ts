// Hand-written type declarations for the barrel export.
// The runtime JS uses deprecation Proxies for routes/tasks/etc.
// but TypeScript needs namespace re-exports for `routes.X` access.
export * from "./dist/esm/wormhole.js";
export * from "./dist/esm/config.js";
export * from "./dist/esm/common.js";
export * from "./dist/esm/types.js";
export * from "./dist/esm/warnings.js";
export * from "./dist/esm/protocols/index.js";

/** @deprecated Use `import * as routes from "@wormhole-foundation/sdk-connect/routes"` */
export * as routes from "./dist/esm/routes/index.js";
/** @deprecated Use `import * as tasks from "@wormhole-foundation/sdk-connect/tasks"` */
export * as tasks from "./dist/esm/tasks.js";
/** @deprecated Use `import * as circleApi from "@wormhole-foundation/sdk-connect/circle-api"` */
export * as circleApi from "./dist/esm/circle-api.js";
/** @deprecated Use `import * as api from "@wormhole-foundation/sdk-connect/whscan-api"` */
export * as api from "./dist/esm/whscan-api.js";

export * from "./dist/esm/indexers/index.js";
export * from "@wormhole-foundation/sdk-base";
export * from "@wormhole-foundation/sdk-definitions";
