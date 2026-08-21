const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

const assetOptionInputPath = path.join(
  __dirname,
  "..",
  "src",
  "dashboard",
  "components",
  "AssetOptionInput.tsx"
);

const loadAssetOptionInputModule = () => {
  const source = fs.readFileSync(assetOptionInputPath, "utf8");
  const { code } = babel.transformSync(source, {
    filename: assetOptionInputPath,
    babelrc: false,
    configFile: false,
    presets: [
      ["@babel/preset-env", { targets: { node: "current" }, modules: "commonjs" }],
      ["@babel/preset-react", { runtime: "automatic" }],
      ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
    ],
  });

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require: (specifier) => {
      if (specifier === "react") {
        return {
          memo: (value) => value,
          useEffect: () => {},
          useMemo: (factory) => factory(),
          useRef: (value) => ({ current: value }),
          useState: (value) => [value, () => {}],
        };
      }
      if (specifier === "react/jsx-runtime") {
        return {
          Fragment: Symbol.for("react.fragment"),
          jsx: () => null,
          jsxs: () => null,
        };
      }
      if (specifier === "./FormInputs") {
        return {
          Select: () => null,
          TextInput: () => null,
        };
      }
      if (specifier === "../core/constants") {
        return { CUSTOM_VALUE: "__nw_wrld_custom__" };
      }
      if (specifier === "../core/utils") {
        return {
          isPlainObject: (value) =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            Object.prototype.toString.call(value) === "[object Object]",
        };
      }
      throw new Error(`Unexpected require: ${specifier}`);
    },
    console,
  };

  vm.runInNewContext(code, sandbox, { filename: assetOptionInputPath });
  return module.exports;
};

test("isAssetOptionCustomValue keeps custom values editable when listing is empty", () => {
  const { isAssetOptionCustomValue } = loadAssetOptionInputModule();

  assert.equal(
    isAssetOptionCustomValue({
      allowCustom: true,
      value: "missing-assets/example.png",
      defaultValue: undefined,
      availableValues: new Set(),
    }),
    true
  );
});

test("isAssetOptionCustomValue keeps default values non-custom when listing is empty", () => {
  const { isAssetOptionCustomValue } = loadAssetOptionInputModule();

  assert.equal(
    isAssetOptionCustomValue({
      allowCustom: true,
      value: "images/example.png",
      defaultValue: "images/example.png",
      availableValues: new Set(),
    }),
    false
  );
});

test("isAssetOptionCustomValue treats listed values as non-custom", () => {
  const { isAssetOptionCustomValue } = loadAssetOptionInputModule();

  assert.equal(
    isAssetOptionCustomValue({
      allowCustom: true,
      value: "images/example.png",
      defaultValue: undefined,
      availableValues: new Set(["images/example.png"]),
    }),
    false
  );
});

test("isAssetOptionCustomValue treats multi-value syntax as custom", () => {
  const { isAssetOptionCustomValue } = loadAssetOptionInputModule();

  assert.equal(
    isAssetOptionCustomValue({
      allowCustom: true,
      value: "images/a.png,images/b.png",
      defaultValue: undefined,
      availableValues: new Set(),
    }),
    true
  );
});
