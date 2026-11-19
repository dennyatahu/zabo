const FLAG = /(?:^|\s)(--[a-z]+|-h)(?=\s|$)/gi;

export const parseFlags = (input) => {
  const text = typeof input === "string" ? input : "";
  const matches = [...text.matchAll(FLAG)];
  const flags = new Map();

  matches.forEach((match, position) => {
    const start = match.index + match[0].length;
    const end = matches[position + 1]?.index ?? text.length;

    flags.set(match[1].replace(/^-+/, "").toLowerCase(), text.slice(start, end).trim());
  });

  return {
    positional: text.slice(0, matches[0]?.index ?? text.length).trim(),
    flags,
  };
};
