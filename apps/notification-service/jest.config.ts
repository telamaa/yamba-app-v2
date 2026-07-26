export default {
  displayName: "@yamba-app/notification-service",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  moduleFileExtensions: ["ts", "js"],
  coverageDirectory: "../../coverage/apps/notification-service",
};
