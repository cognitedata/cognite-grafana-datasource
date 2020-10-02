const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const ReplaceInFileWebpackPlugin = require("replace-in-file-webpack-plugin");

const packageJson = require("./package.json");

module.exports = {
  node: {
    fs: "empty"
  },
  context: __dirname + "/src",
  entry: "./module.tsx",
  output: {
    filename: "module.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "amd"
  },
  devtool: "source-map",
  externals: [
    // remove the line below if you don't want to use buildin versions
    // "moment",
    "lodash",
    "react",
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
    new CopyWebpackPlugin({
      patterns: [
        { from: "plugin.json", to: "." },
        { from: "../README.md", to: "." },
        { from: "partials/*", to: "." },
        { from: "img/*", to: "." },
        { from: "css/*", to: "." }
      ]
    }),
    new ReplaceInFileWebpackPlugin([
      {
        dir: "dist",
        files: ["plugin.json"],
        rules: [
          {
            search: /%VERSION%/g,
            replace: packageJson.version
          },
          {
            search: "%TODAY%",
            replace: new Date().toISOString().substring(0, 10)
          }
        ]
      }
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
