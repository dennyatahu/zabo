const isCommand = (value) => typeof value === "string" && value.length > 0 && !/\s/.test(value);

export const isValidPlugin = (plugin) =>
  typeof plugin === "object" &&
  plugin !== null &&
  typeof plugin.name === "string" &&
  plugin.name.length > 0 &&
  Array.isArray(plugin.commands) &&
  plugin.commands.length > 0 &&
  plugin.commands.every(isCommand) &&
  typeof plugin.fn === "function";
