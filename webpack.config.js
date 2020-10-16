module.exports.getWebpackConfig = (config, options) => ({
  ...config,
  module: {
    ...config.module,
    rules: [
      ...config.module.rules,
      {
        test: /\.md$/,
        use: 'raw-loader'
      }
    ]
  }
});

