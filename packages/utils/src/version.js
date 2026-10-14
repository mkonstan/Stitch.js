"use strict";

// The release version has ONE source: the "version" field of the root package.json.
// Unbuilt (require() of packages/*), this module reads it from there.
// The bundle build (_tools/build-stitch-assembly.js) replaces this module's body with
// the stamped string, so stitch.js and stitch.min.js never read the file system.
module.exports = { VERSION: require("../../../package.json").version };
