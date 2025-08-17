import { json, urlencoded } from "body-parser";
import express, { type Express } from "express";
import morgan from "morgan";
export const createServer = (): Express => {
  const app = express();

  app
    .disable("x-powered-by")
    .use(morgan("dev"))
    .use(urlencoded({ extended: true }))
    .use(json())
    .get("/message/:name", (req, res) => {
      res.status(200).json({ message: `Hello ${req.params.name}` });
    })
    .get("/status", (_, res) => {
      return res.json({ ok: true });
    });

  return app;
};
