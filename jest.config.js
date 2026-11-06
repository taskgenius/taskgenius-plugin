// Test fixtures hardcode epoch timestamps for local midnight in UTC+8
// (e.g. 1704038400000 = 2024-01-01 00:00 +08:00). Pin the timezone so the
// suite gives the same result on every machine and on CI (UTC).
// Set here, before Jest spawns workers, so every worker inherits it.
process.env.TZ = "Asia/Shanghai";

const localMetadataPathIgnorePatterns = [
	"<rootDir>/.conductor/",
	"<rootDir>/.boncli/",
	"<rootDir>/.rebon/",
];

module.exports = {
	preset: "ts-jest",
	testEnvironment: "jsdom",
	roots: ["<rootDir>/src"],
	testMatch: ["**/__tests__/**/*.test.ts"],
	testPathIgnorePatterns: localMetadataPathIgnorePatterns,
	modulePathIgnorePatterns: localMetadataPathIgnorePatterns,
	watchPathIgnorePatterns: localMetadataPathIgnorePatterns,
	moduleNameMapper: {
		"^obsidian$": "<rootDir>/src/__mocks__/obsidian.ts",
		"^moment$": "<rootDir>/src/__mocks__/moment.js",
		"^localforage$": "<rootDir>/src/__mocks__/localforage.ts",
		"^@codemirror/state$": "<rootDir>/src/__mocks__/codemirror-state.ts",
		"^@codemirror/view$": "<rootDir>/src/__mocks__/codemirror-view.ts",
		"^@codemirror/language$":
			"<rootDir>/src/__mocks__/codemirror-language.ts",
		"^@codemirror/search$": "<rootDir>/src/__mocks__/codemirror-search.ts",
		"^@/.*\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.js",
		"^@/(.*)$": "<rootDir>/src/$1",
		"\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.js",
		".*\\.worker$": "<rootDir>/src/__mocks__/ProjectData.worker.ts",
	},
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				tsconfig: "tsconfig.json",
			},
		],
	},
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
	setupFilesAfterEnv: ["<rootDir>/src/test-setup.ts"],
};
