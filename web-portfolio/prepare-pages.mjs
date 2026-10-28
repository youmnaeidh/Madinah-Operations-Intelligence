import { cp, mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const destination = resolve(here, "../docs");
await mkdir(destination, { recursive: true });
await cp(resolve(here, "dist"), destination, { recursive: true });
await writeFile(resolve(destination, ".nojekyll"), "");
await writeFile(
  resolve(destination, "robots.txt"),
  "User-agent: *\nAllow: /\n",
);
console.log("GitHub Pages files prepared in " + destination);
