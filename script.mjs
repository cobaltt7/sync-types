import fileSystem from "node:fs/promises";

const unparsed = await fileSystem.readFile("./package.json", "utf8");
const pkg = JSON.parse(unparsed);

if (!pkg.devDependencies) {
	console.log("No dev dependencies found");
	process.exit();
}

function main(deps) {
	return Object.fromEntries(
		Object.entries(deps).map(([dependency, version]) => {
			if (!dependency.startsWith("@types/")) {
				console.log(`[${dependency}] Ignored - Not a @types dependency`);
				return [dependency, version];
			}

			let root = dependency.split("/")[1];
			if (root.includes("__")) root = `@${root.replace("__", "/")}`;

			const rootVersion = pkg.dependencies[root] || pkg.devDependencies[root] || pkg.engines[root];
			if (rootVersion === undefined) {
				console.log(`[${dependency}] INGORED - Could not find parent dependency`);
				return [dependency, version];
			}

			const transformed = transformVersion(rootVersion) ?? version;
			console.log(`[${dependency}] ${
				version === transformed ?
				"Ignored - Already synced" :
				`BUMPED - from ${version} to ${transformed}`
			}`);
			return [dependency, transformed];
		}),
	);
}

console.log("Checking devDependencies...");
pkg.devDependencies = main(deps);

console.log("\nChecking dependencies...");
pkg.dependencies = main(deps);

function transformVersion(version) {
	if (version.includes("||")) return version.split("||").map(transformVersion).join("||");

	if (version.includes(" - ")) {
		const newest = version.split(" - ")[1];
		return transformVersion(newest);
	}

	version = version.trim();
	version = version.replace(/^(?:>=|[>~^])/, "");
	if (/^[v\d]/.test(version)) return `<=${version}`;
	if (version.startsWith("<") || ["*", "x", "latest", ""].includes(version)) return version;
}

await fileSystem.writeFile("./package.json", JSON.stringify(pkg, undefined, unparsed.match(/[ \t]+/)[0] ?? 2) + "\n", "utf8");
console.log("Completed successfully");
