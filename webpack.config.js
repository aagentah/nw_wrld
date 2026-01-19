const path = require("path");

module.exports = (env, argv) => {
  const mode = argv?.mode || "development";
  const isProduction = mode === "production";

  return {
    mode,
    entry: {
      dashboard: ["./src/rendererPolyfills.ts", "./src/dashboard/entry.ts"],
      projector: ["./src/rendererPolyfills.ts", "./src/projector/entry.ts"],
      moduleSandbox: "./src/projector/moduleSandboxEntry.ts",
    },
    resolve: {
      extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      globalObject: "globalThis",
      publicPath: "auto", // Use this as the publicPath
    },
    devtool: isProduction ? false : "eval-source-map",
    node: {
      __dirname: false,
      __filename: false,
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          include: [path.resolve(__dirname, "src")],
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                "@babel/preset-env",
                ["@babel/preset-react", { runtime: "automatic" }],
                ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
              ],
            },
          },
        },
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                "@babel/preset-env",
                ["@babel/preset-react", { runtime: "automatic" }],
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            "style-loader",
            "css-loader",
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: {
                  ident: "postcss",
                  plugins: [require("tailwindcss"), require("autoprefixer")],
                },
              },
            },
          ],
        },
      ],
    },
    plugins: [],
    devServer: {
      static: path.join(__dirname, "dist"),
      compress: true,
      port: 9000,
      hot: true,
      liveReload: false,
      devMiddleware: {
        writeToDisk: true,
      },
      watchFiles: {
        paths: ["src/**/*"],
        options: {
          ignored: /src\/shared\/json\/userData\.json$/,
        },
      },
    },
    watchOptions: {
      ignored: /src\/shared\/json\/userData\.json$/,
    },
    target: "web",
  };
};
