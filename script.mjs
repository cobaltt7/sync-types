import fileSystem from "node:fs/promises";
import pkg from "./package.json" assert { type: "json" };

if (!pkg.devDependencies) {
	console.log("No dev dependencies found");
	process.exit();
}

let hasLogged = false;

function main(deps) {
	return Object.fromEntries(
		Object.entries(deps).map(([dependency, version]) => {
			if (!dependency.startsWith("@types/")) return [dependency, version];

			let root = dependency.split("/")[1];
			if (root.includes("__")) root = `@${root.replace("__", "/")}`;

			const rootVersion =
				pkg.dependencies[root] ??
				pkg.devDependencies[root] ??
				pkg.engines[root];
			if (rootVersion === undefined) {
				console.log(
					`**${dependency}**: ignored due to no parent dependency`,
				);
				return [dependency, version];
			}

			const transformed = transformVersion(rootVersion) ?? version;
			if (version !== transformed) {
				console.log(
					`**${dependency}**: requirement changed from \`${version}\` to \`${transformed}\``,
				);
				hasLogged = true;
			}
			return [dependency, transformed];
		}),
	);
}

pkg.devDependencies = main(pkg.devDependencies);
pkg.dependencies = main(pkg.dependencies);

function transformVersion(version) {
	if (version.includes("||"))
		return version.split("||").map(transformVersion).join("||");

	if (version.includes(" - ")) {
		const newest = version.split(" - ")[1];
		return transformVersion(newest);
	}

	version = version.trim();
	version = version.replace(/^(?:>=|[>~^])/, "");
	if (/^[v\d]/.test(version)) return `<=${version}`;
	if (version.startsWith("<") || ["*", "x", "latest", ""].includes(version))
		return version;
}

await fileSystem.writeFile(
	"./package.json",
	JSON.stringify(pkg, undefined, unparsed.match(/[ \t]+/)[0] ?? 2) + "\n",
	"utf8",
);

if (!hasLogged) console.log("*No requirements changed.*");
