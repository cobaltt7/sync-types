import fileSystem from "node:fs/promises";

const unparsed = await fileSystem.readFile("./package.json", "utf8");
const pkg = JSON.parse(unparsed);

if (!pkg.devDependencies) {
	console.log("No dev dependencies found");
	process.exit();
}

pkg.devDependencies = Object.fromEntries(
	Object.entries(pkg.devDependencies).map(([dependency, version]) => {
		if (!dependency.startsWith("@types/")) return [dependency, version];

		let root = dependency.split("/")[1];
		if (root.includes("__")) root = `@${root.replace("__", "/")}`;

		const rootVersion = pkg.dependencies[root] || pkg.engines[root];
		if (rootVersion === undefined) {
			console.log(`Could not find parent dependency for ${dependency}; ignoring`);
			return [dependency, version];
		}

		const transformed = transformVersion(rootVersion) ?? version;
		if (version !== transformed)
			console.log(`Bumped ${dependency} from ${version} to ${transformed}`);
		else console.log(`No change needed to ${dependency}'s version`);
		return [dependency, transformed];
	}),
);

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
