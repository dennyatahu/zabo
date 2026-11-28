// Plugin schema validation and result helpers.
// ok(data) / fail(error) produce {data} / {error} result objects used by
// managers and plugins. isValidPlugin checks the plugin contract shape.

// Result helpers
export const ok = (data) => ({ data });
export const fail = (error) => ({ error });

const isCommand = (value) =>
  typeof value === "string" && value.length > 0 && !/\s/.test(value);

// Plugin contract: { name, commands: string[], categories: string[], ownerOnly: boolean,
// options: { bypassPrefix?, lockBypass? }, fn(ctx) }
export const isValidPlugin = (plugin) =>
  typeof plugin === "object" &&
  plugin !== null &&
  typeof plugin.name === "string" &&
  plugin.name.length > 0 &&
  Array.isArray(plugin.commands) &&
  plugin.commands.length > 0 &&
  plugin.commands.every(isCommand) &&
  typeof plugin.fn === "function";
