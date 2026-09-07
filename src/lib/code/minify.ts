/**
 * Small, dependency-free formatters and minifiers.
 *
 * These are deliberately conservative: they do structural whitespace work and
 * nothing clever. A minifier that renames variables or reorders rules can
 * change behaviour, and that is not a trade a free web tool should make on
 * someone's behalf without warning.
 */

/** Removes comments and collapses whitespace in CSS. Selectors and values are untouched. */
export function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};:,>~+])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

export function formatCss(css: string, indent = 2): string {
  const pad = " ".repeat(indent);
  const minified = minifyCss(css);
  let depth = 0;
  let out = "";

  for (const char of minified) {
    if (char === "{") {
      depth++;
      out += " {\n" + pad.repeat(depth);
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
      out = out.replace(/\s+$/, "") + "\n" + pad.repeat(depth) + "}\n" + pad.repeat(depth);
    } else if (char === ";") {
      out += ";\n" + pad.repeat(depth);
    } else if (char === "," && depth === 0) {
      out += ",\n";
    } else {
      out += char;
    }
  }
  return out.replace(/\n\s*\n+/g, "\n").replace(/[ \t]+$/gm, "").trim() + "\n";
}

const GUARD = "__DO101_HTML_GUARD_";

/** Collapses HTML whitespace while protecting pre, textarea, script and style content. */
export function minifyHtml(html: string, { removeComments = true } = {}): string {
  const guarded: string[] = [];
  let out = html.replace(/<(pre|textarea|script|style)\b[\s\S]*?<\/\1>/gi, (match) => {
    guarded.push(match);
    return `${GUARD}${guarded.length - 1}__`;
  });

  if (removeComments) out = out.replace(/<!--(?!\[if)[\s\S]*?-->/g, "");
  out = out.replace(/\s{2,}/g, " ").replace(/>\s+</g, "><").trim();

  return out.replace(new RegExp(`${GUARD}(\\d+)__`, "g"), (_m, index: string) => guarded[Number(index)]);
}

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN", "CROSS JOIN",
  "JOIN", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "UNION ALL", "UNION",
  "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "CREATE TABLE", "ALTER TABLE",
  "DROP TABLE", "ON", "AND", "OR",
];

/** Keyword-aware SQL formatter: a newline before each clause, indentation inside them. */
export function formatSql(sql: string, { uppercase = true, indent = 2 } = {}): string {
  const pad = " ".repeat(indent);
  let out = sql.replace(/\s+/g, " ").trim();

  for (const keyword of SQL_KEYWORDS) {
    const pattern = new RegExp(`\\s+${keyword.replace(/ /g, "\\s+")}\\s+`, "gi");
    out = out.replace(pattern, () => {
      const rendered = uppercase ? keyword : keyword.toLowerCase();
      const nested = ["AND", "OR", "ON"].includes(keyword);
      return `\n${nested ? pad : ""}${rendered} `;
    });
  }

  out = out.replace(/,\s*/g, `,\n${pad}`).replace(/;\s*/g, ";\n\n");

  return out
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .filter((line, i, arr) => line.trim() || (i > 0 && arr[i - 1].trim()))
    .join("\n")
    .trim();
}

export function minifySql(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([,()])\s*/g, "$1")
    .trim();
}
