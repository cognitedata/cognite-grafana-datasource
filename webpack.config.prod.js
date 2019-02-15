const baseWebpackConfig = require("./webpack.config");
const ngAnnotatePlugin = require("ng-annotate-webpack-plugin");

var conf = baseWebpackConfig;
conf.mode = "production";
conf.devtool = "none";

conf.plugins.push(new ngAnnotatePlugin());

module.exports = conf;
