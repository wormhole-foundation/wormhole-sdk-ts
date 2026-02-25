// Hand-written type declarations for the barrel export.
// The runtime JS uses deprecation Proxies for routes/tasks/etc.
// but TypeScript needs namespace re-exports for `routes.X` access.
export * from "./dist/cjs/wormhole.js";
export * from "./dist/cjs/config.js";
export * from "./dist/cjs/common.js";
export * from "./dist/cjs/types.js";
export * from "./dist/cjs/warnings.js";
export * from "./dist/cjs/protocols/index.js";

/** @deprecated Use `import * as routes from "@wormhole-foundation/sdk-connect/routes"` */
export * as routes from "./dist/cjs/routes/index.js";
/** @deprecated Use `import * as tasks from "@wormhole-foundation/sdk-connect/tasks"` */
export * as tasks from "./dist/cjs/tasks.js";
/** @deprecated Use `import * as circleApi from "@wormhole-foundation/sdk-connect/circle-api"` */
export * as circleApi from "./dist/cjs/circle-api.js";
/** @deprecated Use `import * as api from "@wormhole-foundation/sdk-connect/whscan-api"` */
export * as api from "./dist/cjs/whscan-api.js";

export * from "./dist/cjs/indexers/index.js";
export * from "@wormhole-foundation/sdk-base";
export * from "@wormhole-foundation/sdk-definitions";
