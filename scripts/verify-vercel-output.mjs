import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import process from "node:process"

const functionDir = join(process.cwd(), ".vercel", "output", "functions", "__nitro.func")
const packagePath = join(functionDir, "package.json")
const parserPackages = [
  "cheerio",
  "cheerio-select",
  "dom-serializer",
  "domelementtype",
  "domhandler",
  "domutils",
  "entities",
  "htmlparser2",
  "parse5",
  "parse5-htmlparser2-tree-adapter",
  "parse5-parser-stream",
]

async function listModules(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await listModules(path))
    else if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(path)
  }
  return files
}

const pkg = JSON.parse(await readFile(packagePath, "utf8"))
const externalParserPackages = parserPackages.filter(name => pkg.dependencies?.[name])
if (externalParserPackages.length) {
  throw new Error(`Vercel bundle still externalizes parser packages: ${externalParserPackages.join(", ")}`)
}

const modules = await listModules(functionDir)
const bareImportPattern = new RegExp(`(?:from\\s+|import\\s*\\()(["'])(?:${parserPackages.join("|")})(?:/[^"']*)?\\1`, "g")
const offenders = []
for (const modulePath of modules) {
  const source = await readFile(modulePath, "utf8")
  if (bareImportPattern.test(source)) offenders.push(modulePath)
  bareImportPattern.lastIndex = 0
}
if (offenders.length) {
  throw new Error(`Vercel bundle contains bare parser imports: ${offenders.join(", ")}`)
}

console.log(`Verified Vercel parser bundle across ${modules.length} modules.`)
