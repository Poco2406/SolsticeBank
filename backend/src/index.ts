import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";

await connectDb(env.mongodbUri);

export default createApp();