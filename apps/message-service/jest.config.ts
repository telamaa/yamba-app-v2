export default {
  displayName: "@yamba-app/message-service",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  moduleFileExtensions: ["ts", "js"],
  coverageDirectory: "../../coverage/apps/message-service",
};
