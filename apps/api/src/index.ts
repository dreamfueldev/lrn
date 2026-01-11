import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    name: "lrn-registry-api",
    version: "0.0.1",
  });
});

app.get("/packages", (c) => {
  // TODO: List available packages
  return c.json({ packages: [] });
});

app.get("/packages/:name", (c) => {
  const name = c.req.param("name");
  // TODO: Return package metadata
  return c.json({ error: "Not found", name }, 404);
});

app.get("/packages/:name/members", (c) => {
  const name = c.req.param("name");
  // TODO: Return package members
  return c.json({ error: "Not found", name }, 404);
});

app.get("/packages/:name/members/:path{.+}", (c) => {
  const name = c.req.param("name");
  const path = c.req.param("path");
  // TODO: Return specific member
  return c.json({ error: "Not found", name, path }, 404);
});

export default app;
