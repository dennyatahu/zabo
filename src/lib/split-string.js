// Splits "first rest" on the first whitespace. Used to parse command words
// from message text.

export const splitString = (input) => {
  if (typeof input !== "string" || !input) {
    return { first: undefined, rest: undefined };
  }

  const index = input.search(/\s/);

  return {
    first: index === -1 ? input : input.slice(0, index),
    rest: index === -1 ? undefined : input.slice(index).trimStart(),
  };
};
