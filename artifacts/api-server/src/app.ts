import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());
// Large campaign snapshots contain many repeated JSON keys and descriptions.
// Honor Accept-Encoding (gzip) on API responses; compression skips responses
// that already have a Content-Encoding header.
app.use(compression({ threshold: 1024 }));
// Campaign state can include uploaded Pokémon artwork encoded in the
// collection payload. Keep the API body limit large enough for normal sheet
// edits instead of silently rejecting otherwise valid saves with HTTP 413.
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use("/api", router);

export default app;
