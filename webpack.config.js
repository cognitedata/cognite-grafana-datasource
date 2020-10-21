const ReplaceInFileWebpackPlugin = require("replace-in-file-webpack-plugin");
const { version } = require("./package.json");

module.exports.getWebpackConfig = (config, options) => ({
  ...config,
  plugins: [
    ...config.plugins,
    new ReplaceInFileWebpackPlugin([
      {
        dir: "dist",
        files: ["plugin.json"],
        rules: [
          {
            search: /%VERSION%/g,
            replace: version
          }
        ]
      }
    ])
  ],
  module: {
    ...config.module,
    rules: [
      ...config.module.rules,
      {
        test: /\.md$/,
        use: 'raw-loader'
      }
    ],
  }
});

