const fs = require("fs");
const path = require("path");
const terser = require("terser");

// Paths resolve against this file's folder (the repository root), not the caller's cwd.
const ROOT = __dirname;
const inputFile = path.join(ROOT, "stitch.js");
const outputFile = path.join(ROOT, "stitch.min.js");

const TERSER_OPTIONS = {
    compress: {
        passes: 2,
        unsafe_arrows: false,
        pure_getters: true
    },
    mangle: true,
    format: {
        comments: /^!|@license|@preserve|@cc_on/i
    }
};

/**
 * Minifies bundle text. Deterministic for a given terser version, so the
 * test runner can recompute stitch.min.js from stitch.js and compare bytes.
 */
async function minifyCode(code) {
    const result = await terser.minify(code, TERSER_OPTIONS);
    if (!result || typeof result.code !== "string") {
        throw new Error("Terser did not return minified output.");
    }
    return result.code;
}

async function main() {
    const code = fs.readFileSync(inputFile, "utf8");
    const originalSize = code.length;
    const minified = await minifyCode(code);

    fs.writeFileSync(outputFile, minified, "utf8");
    const newSize = minified.length;

    console.log(`Minification complete: ${path.basename(outputFile)}`);
    console.log(`Original: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`Minified: ${(newSize / 1024).toFixed(2)} KB`);
    console.log(`Savings:  ${((1 - (newSize / originalSize)) * 100).toFixed(1)}%`);
}

module.exports = { minifyCode };

if (require.main === module) {
    main().catch((err) => {
        console.error("Minification failed:", err);
        process.exitCode = 1;
    });
}
