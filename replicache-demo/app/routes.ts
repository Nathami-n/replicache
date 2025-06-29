import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [index("routes/home.tsx"),
    route("api/replicache/pull", "routes/api/replicache-pull.ts"),
    route("api/replicache/push", "routes/api/replicache-push.ts"),
] satisfies RouteConfig;
