const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const CleanWebpackPlugin = require("clean-webpack-plugin");

module.exports = {
  node: {
    fs: "empty"
  },
  context: __dirname + "/src",
  entry: "./module.ts",
  output: {
    filename: "module.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "amd"
  },
  externals: [
    // remove the line below if you don't want to use buildin versions
    // "moment",
    "lodash",
    function(context, request, callback) {
      var prefix = "grafana/";
      if (request.indexOf(prefix) === 0) {
        return callback(null, request.substr(prefix.length));
      }
      callback();
    }
  ],
  plugins: [
    new CleanWebpackPlugin("dist", { allowExternal: true }),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new CopyWebpackPlugin([
      { from: "plugin.json", to: "." },
      { from: "../README.md", to: "." },
      { from: "partials/*", to: "." },
      { from: "images/*", to: "." },
      { from: "css/*", to: "." }
    ])
  ],
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loaders: [
          {
            loader: "babel-loader",
            options: { presets: ["env"] }
          },
          "ts-loader"
        ],
        exclude: /(node_modules)/
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: "style-loader"
          },
          {
            loader: "css-loader",
            options: {
              importLoaders: 1,
              sourceMap: true
            }
          }
        ]
      }
    ]
  }
};
