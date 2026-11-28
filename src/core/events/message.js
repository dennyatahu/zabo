// Message event: remembers the sender push name, serializes the raw event into
// a plugin-friendly message object, and dispatches it to matching plugins.

import { dispatch } from "../dispatcher.js";
import { rememberPushName } from "../../lib/push-name.js";
import { smsg } from "../../lib/serialize-message.js";

const bindMessageEvents = (session, target) => {
  session.listen(target, "message", (event) => {
    rememberPushName(event);
    return dispatch(smsg(event, target));
  });
};

export { bindMessageEvents };
