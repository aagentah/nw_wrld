const path = require("path");

require(path.join(__dirname, "..", "dist", "runtime", "main", "mainProcess", "entry.js")).start();
