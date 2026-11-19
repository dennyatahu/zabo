import { createPinoLogger } from "zapo-js";

export const logger = await createPinoLogger({
  name: "zabo",
  pretty: true,
  prettyOptions: {
    translateTime: "HH:MM:ss.l",
    ignore: "pid,hostname,service",
    colorize: true,
  },
});
