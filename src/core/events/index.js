// Binds all WhatsApp client events (auth, connection, message) to a session.
// Each event category is in its own module: auth.js, connection.js, message.js.

import { bindAuthEvents } from "./auth.js";
import { bindConnectionEvents } from "./connection.js";
import { bindMessageEvents } from "./message.js";

export const bindEvents = (session, target) => {
  bindAuthEvents(session, target);
  bindConnectionEvents(session, target);
  bindMessageEvents(session, target);
};
