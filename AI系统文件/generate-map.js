const fs = require("fs");
const path = require("path");

const IGNORE = [
  "node_modules",
  ".git",
  ".wrangler",
  "dist",
  ".DS_Store"
];

function walk(dir) {
  const result = {};

  fs.readdirSync(dir).forEach(file => {
    if (IGNORE.includes(file)) return;

    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      result[file + "/"] = walk(fullPath);
    } else {
      result[file] = {
        size: stat.size,
        type: "file"
      };
    }
  });

  return result;
}

const tree = walk(process.cwd());

fs.writeFileSync(
  "ai-project-map.json",
  JSON.stringify(tree, null, 2)
);

console.log("✔ AI 项目索引已生成");