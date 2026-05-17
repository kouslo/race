import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoute } from "./routes/auth";
import { coursesRoute } from "./routes/courses";
import { eventsRoute } from "./routes/events";
import { institutionsRoute } from "./routes/institutions";
import { favoritesRoute } from "./routes/favorites";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGINS?.split(",") ?? "*",
    allowHeaders: ["Content-Type", "Authorization", "X-User-Id"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 600,
  }),
);

app.get("/healthz", (c) => c.json({ ok: true }));

app.route("/api/v1/auth", authRoute);
app.route("/api/v1/courses", coursesRoute);
app.route("/api/v1/events", eventsRoute);
app.route("/api/v1/institutions", institutionsRoute);
app.route("/api/v1/favorites", favoritesRoute);

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`api listening on http://localhost:${port}`);
});

export type AppType = typeof app;
