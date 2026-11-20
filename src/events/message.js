import { dispatch } from "../core/dispatcher.js";
import { rememberPushName } from "../lib/push-name.js";
import { smsg } from "../lib/serialize-message.js";

export const bindMessageEvents = (session, target) => {
  session.listen(target, "message", (event) => {
    rememberPushName(event);

    return dispatch(smsg(event, target));
  });
};
