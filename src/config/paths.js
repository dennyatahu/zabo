// All filesystem paths used by the application.
// Derived from import.meta.dir so they resolve regardless of cwd.
// This file lives at src/config/paths.js, so ".." is src/ and "../.." is root.

export const PATHS = Object.freeze({
  // Project root (parent of src/)
  root: new URL("../../", import.meta.url).pathname,

  // Source directory (src/)
  src: new URL("../", import.meta.url).pathname,

  // Runtime data directory (created at bootstrap, not on import)
  data: new URL("../../data", import.meta.url).pathname,

  // Plugin directory: src/plugins/<category>/<name>.js (contract: fixed location)
  plugins: new URL("../plugins", import.meta.url).pathname,

  // Application databases
  session: new URL("../../data/session.sqlite", import.meta.url).pathname,
  database: new URL("../../data/database.sqlite", import.meta.url).pathname,
});
