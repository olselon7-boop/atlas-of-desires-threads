import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseCorpus } from "../corpus.ts";
// Optional controlled server snapshot. Browser imports stay browser-local.
export async function readResearchSnapshot() {
  const file=path.join(process.cwd(),"data/art_ready/research-corpus.json");
  try {const contents=await readFile(file,"utf8");if(contents.length>10_000_000)throw new Error("Snapshot is too large");return parseCorpus(JSON.parse(contents));}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
}
