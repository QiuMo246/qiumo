const fs = require("fs");

const map = fs.readFileSync("ai-project-map.json", "utf-8");
const diff = fs.readFileSync("ai-diff.txt", "utf-8");

const context = `
# PROJECT MAP
${map}

# CHANGES (GIT DIFF)
${diff}
`;

fs.writeFileSync("ai-context.txt", context);

console.log("✔ AI context 已生成");