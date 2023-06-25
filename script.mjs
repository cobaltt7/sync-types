import fileSystem from "node:fs/promises";
import path from "node:path";
import core from "@actions/core";

const packagePath = path.resolve(process.argv.at(-1), "./package.json");
const unparsed = await fileSystem.readFile(packagePath, "utf8");
const pkg = JSON.parse(unparsed);

if (!pkg.devDependencies) {
	core.setOutput(
		"sync",
		"<details><summary>Requirement changes</summary>*No dev dependencies found.*</details>",
	);
	process.exit();
}

const output = [];

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
				output.push(
					`**${dependency}**: ignored due to no parent dependency`,
				);
				return [dependency, version];
			}

			const transformed = transformVersion(rootVersion) ?? version;
			if (version !== transformed) {
				output.push(
					`**${dependency}**: requirement changed from \`${version}\` to \`${transformed}\``,
				);
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
	packagePath,
	JSON.stringify(pkg, undefined, unparsed.match(/[ \t]+/)[0] ?? 2) + "\n",
	"utf8",
);

core.setOutput(
	"sync",
	`<details><summary>Requirement changes</summary>${
		output.join("\n") || "*No requirements changed.*"
	}</details>`,
);
