import { bindAuthEvents } from "./auth.js";
import { bindConnectionEvents } from "./connection.js";
import { bindMessageEvents } from "./message.js";

export const bindEvents = (session, target) => {
  bindAuthEvents(session, target);
  bindConnectionEvents(session, target);
  bindMessageEvents(session, target);
};
