const { execSync } = require("child_process");
const fs = require("fs");

try {
  const diff = execSync("git diff", { encoding: "utf-8" });

  fs.writeFileSync("ai-diff.txt", diff);

  console.log("✔ diff 已生成");
} catch (e) {
  console.log("❌ 无法生成 diff");
}