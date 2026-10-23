import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";

// Read only literal data from the public patch. Never execute imported code.
const patch = fs.readFileSync(process.argv[2], "utf8");
const marker = "diff --git a/desktop/src/shared/i18n/ko.generated.ts";
const section = patch.slice(patch.indexOf(marker)).split("\n");
if (!patch.includes(marker)) throw new Error("Korean catalogue not found");
const source = section
  .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
  .map((l) => l.slice(1))
  .join("\n");
const ast = ts.createSourceFile(
  "catalog.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
function literal(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node))
    return Object.fromEntries(
      node.properties.map((p) => {
        if (!ts.isPropertyAssignment(p))
          throw new Error("Non-literal catalogue property");
        return [p.name.text, literal(p.initializer)];
      }),
    );
  throw new Error(`Non-literal catalogue node ${ts.SyntaxKind[node.kind]}`);
}
let table;
function find(n) {
  if (ts.isVariableDeclaration(n) && n.name.getText(ast) === "KO_TABLE")
    table = literal(n.initializer);
  ts.forEachChild(n, find);
}
find(ast);
if (!table?.exact || !table?.patterns) throw new Error("Invalid catalogue");
const keys = {},
  en = {},
  ko = {};
for (const [english, korean] of [
  ...Object.entries(table.exact),
  ...table.patterns,
]) {
  const source = english.replace(/\s+/g, " ").trim();
  const key =
    "m" + crypto.createHash("sha256").update(source).digest("hex").slice(0, 16);
  if (en[key] && keys[source] !== key)
    throw new Error("Catalogue key collision");
  keys[source] = key;
  en[key] = source.replace(/\{(\d+)\}/g, (_, n) => `{{p${n}}}`);
  ko[key] = korean.replace(/\{(\d+)\}/g, (_, n) => `{{p${n}}}`);
}
const root = path.resolve(import.meta.dirname, "../src/locales");
fs.mkdirSync(root, { recursive: true });
const additional = JSON.parse(
  fs.readFileSync(path.join(root, "ko.additional.json"), "utf8"),
);
for (const [english, korean] of Object.entries(additional)) {
  const source = english.replace(/\s+/g, " ").trim();
  const key =
    "m" + crypto.createHash("sha256").update(source).digest("hex").slice(0, 16);
  keys[source] = key;
  en[key] = source.replace(/\{(\d+)\}/g, (_, n) => `{{p${n}}}`);
  ko[key] = korean.replace(/\{(\d+)\}/g, (_, n) => `{{p${n}}}`);
}
for (const [name, data] of [
  ["ui-keys", keys],
  ["en.ui", en],
  ["ko.ui", ko],
])
  fs.writeFileSync(
    path.join(root, name + ".json"),
    JSON.stringify(data, null, 2) + "\n",
  );
const base = JSON.parse(fs.readFileSync(path.join(root, "en.json"), "utf8"));
base.settings.language.unsaved =
  "Applied for this session. The language preference could not be saved.";
base.settings.language.error = "The language could not be changed. Try again.";
fs.writeFileSync(
  path.join(root, "en.json"),
  JSON.stringify(base, null, 2) + "\n",
);
for (const locale of ["zh-Hans", "zh-Hant"]) {
  const p = path.join(root, locale + ".json");
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  data.settings.language.unsaved = base.settings.language.unsaved;
  data.settings.language.error = base.settings.language.error;
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}
const manual = {
  Language: "언어",
  "Choose the language used by Buzz.": "Buzz에서 사용할 언어를 선택합니다.",
  System: "시스템 설정 따름",
  English: "English",
  "Traditional Chinese": "繁體中文",
  "Simplified Chinese": "简体中文",
  Korean: "한국어",
};
manual[base.settings.language.unsaved] =
  "현재 실행 중에는 적용되지만 언어 설정을 저장하지 못했습니다.";
manual[base.settings.language.error] =
  "언어를 변경하지 못했습니다. 다시 시도하세요.";
const missing = [];
function translate(x) {
  if (typeof x === "string") {
    if (manual[x]) return manual[x];
    if (additional[x]) return additional[x];
    if (table.exact[x]) return table.exact[x];
    missing.push(x);
    return x;
  }
  return Object.fromEntries(
    Object.entries(x).map(([k, v]) => [k, translate(v)]),
  );
}
fs.writeFileSync(
  path.join(root, "ko.json"),
  JSON.stringify(translate(base), null, 2) + "\n",
);
fs.writeFileSync(
  path.join(root, "korean-source.json"),
  JSON.stringify(
    {
      repository: "https://github.com/Gwani-28/buzz",
      ref: "0a1e20470327270e572b2495eddb55bd726951f6",
      path: "team-patches/40-korean.patch",
      upstreamLicense: "Apache-2.0",
      exact: Object.keys(table.exact).length,
      patterns: table.patterns.length,
      method: "Literal catalogue only; DOM observer code is not imported.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    {
      exact: Object.keys(table.exact).length,
      patterns: table.patterns.length,
      messages: Object.keys(keys).length,
      baseMissing: missing,
    },
    null,
    2,
  ),
);
