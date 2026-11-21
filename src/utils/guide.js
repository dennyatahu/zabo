const HELP_FLAG = /(?:^|\s)(?:-h|--help)\s*$/i;

const code = (value) => `\`${value}\``;

const section = (heading, lines) => [`*${heading}*`, ...lines].join("\n");

export const isHelp = (text) => typeof text === "string" && HELP_FLAG.test(text);

export const buildGuide = ({ title, summary, groups, examples = [], notes = [], prefix = "" }) => {
  const blocks = [[`*${title}*`, summary].filter(Boolean).join("\n")];

  for (const { heading = "Usage", rows } of groups) {
    const lines = rows.map(([syntax, description]) => `▸ ${code(prefix + syntax)}\n  ${description}`);

    blocks.push(section(heading, lines));
  }

  if (examples.length) {
    blocks.push(section("Examples", examples.map((example) => `▸ ${code(prefix + example)}`)));
  }

  if (notes.length) blocks.push(section("Notes", notes.map((note) => `▸ ${note}`)));

  return blocks.join("\n\n");
};

export const buildError = (message, command) =>
  [
    "*Error*",
    `▸ ${message}`,
    ...(command ? [`▸ Send ${code(`${command} -h`)} for help.`] : []),
  ].join("\n");
