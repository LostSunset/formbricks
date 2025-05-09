module.exports = {
  extends: ["@formbricks/eslint-config/legacy-next.js"],
  ignorePatterns: ["**/package.json", "**/tsconfig.json"],
  overrides: [
    {
      files: ["locales/*.json"],
      plugins: ["i18n-json"],
      rules: {
        "i18n-json/identical-keys": [
          "error",
          {
            filePath: require("path").join(__dirname, "locales", "en-US.json"),
            checkExtraKeys: false,
            checkMissingKeys: true,
          },
        ],
      },
    },
  ],
};
