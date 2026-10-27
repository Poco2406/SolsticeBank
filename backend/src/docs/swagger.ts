import { readFileSync } from "node:fs";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";

const specPath = new URL("../../docs/openapi.yaml", import.meta.url);
const spec = parse(readFileSync(specPath, "utf8"));

export const docsRouter = Router();
docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(spec));