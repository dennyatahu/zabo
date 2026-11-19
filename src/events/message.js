import { dispatch } from "../core/dispatcher.js";
import { smsg } from "../lib/serialize-message.js";

export const bindMessageEvents = (session, target) => {
  session.listen(target, "message", (event) => dispatch(smsg(event, target)));
};
