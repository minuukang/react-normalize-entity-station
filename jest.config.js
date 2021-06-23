
module.exports = {
  "verbose": true,
  "preset": "ts-jest",
  "testEnvironment": "jsdom",
  "globals": {
    "ts-jest": {
      "tsconfig": "<rootDir>/tsconfig.json",
      "diagnostics": false
    }
  },
  "roots": [
    "<rootDir>/src"
  ],
  "moduleFileExtensions": [
    "ts",
    "tsx",
    "js"
  ],
  "testRegex": "(.*(\\.|/)(test|spec))\\.tsx?$",
  "transform": {
    "^.+\\.tsx?$": "ts-jest"
  },
  "transformIgnorePatterns": [
    "../node_modules/"
  ],
  "coverageDirectory": "coverage",
  "automock": false
}
