const fs = require("fs");
const terser = require("terser");

const inputFile = "stitch.js";
const outputFile = "stitch.min.js";

async function main() {
    const code = fs.readFileSync(inputFile, "utf8");
    const originalSize = code.length;

    const result = await terser.minify(code, {
        compress: {
            passes: 2,
            unsafe_arrows: false
        },
        mangle: true,
        format: {
            comments: /^!|@license|@preserve|@cc_on/i
        }
    });

    if (!result || typeof result.code !== "string") {
        throw new Error("Terser did not return minified output.");
    }

    fs.writeFileSync(outputFile, result.code, "utf8");
    const newSize = result.code.length;

    console.log(`Minification complete: ${outputFile}`);
    console.log(`Original: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`Minified: ${(newSize / 1024).toFixed(2)} KB`);
    console.log(`Savings:  ${((1 - (newSize / originalSize)) * 100).toFixed(1)}%`);
}

main().catch((err) => {
    console.error("Minification failed:", err);
    process.exitCode = 1;
});
