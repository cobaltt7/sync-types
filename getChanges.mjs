import { fromUrl } from "hosted-git-info";
import fileSystem from "node:fs/promises";
import path from "node:path";
import core from "@actions/core";

const rootPath = process.argv.at(-1);

const oldPackages = JSON.parse(
	await fileSystem.readFile(
		path.resolve(rootPath, "./package-lock.old.json"),
		"utf8",
	),
);
const newPackages = JSON.parse(
	await fileSystem.readFile(
		path.resolve(rootPath, "./package-lock.json"),
		"utf8",
	),
);

const changes = new Set();

for (const packageName in newPackages) {
	const parsedName =
		packageName.split("node_modules/").at("-1") ||
		newPackages[packageName].name;

	if (oldPackages[packageName]) {
		const oldVersion = oldPackages[packageName].version;
		const newVersion = newPackages[packageName].version;

		if (oldVersion !== newVersion) {
			const { repository } = JSON.parse(
				await fileSystem.readFile(
					path.resolve(rootPath, packageName, "./package.json"),
					"utf8",
				),
			);
			const repoLink =
				repository &&
				fromUrl(repository.url || repository, {
					noCommittish: true,
					noGitPlus: true,
				}).browse(repository.directory);
			const host = repoLink?.split("/")[2];
			const replacement = {
				"github.com": ["tree", "commits"],
				"bitbucket.org": ["src", "history-node"],
				"gitlab.com": ["tree", "commits"],
				"git.sr.ht": ["tree", "logs"],
				"gist.github.com": [/#|\?|$/, "/revisions$&"],
			}[host];

			const commitsLink =
				repoLink && replacement
					? repoLink.replace(...replacement)
					: repoLink;

			changes.add(
				`Bumped [\`${parsedName}@${oldVersion}\`](https://npmjs.com/package/${parsedName}/v/${oldVersion}) to [\`${newVersion}\`](https://npmjs.com/package/${parsedName}/v/${newVersion}) ([see recent commits](${commitsLink}))`,
			);
		}
	} else {
		const addedVersion = newPackages[packageName].version;
		changes.add(
			`Installed [\`${parsedName}@${addedVersion}\`](https://npmjs.com/package/${parsedName}/v/${addedVersion})`,
		);
	}
}

for (const packageName in oldPackages) {
	const parsedName =
		packageName.split("node_modules/").at("-1") ||
		oldPackages[packageName].name;
	if (!newPackages[packageName]) {
		const { version } = oldPackages[packageName];
		changes.add(
			`Removed [\`${parsedName}@${version}\`](https://npmjs.com/package/${parsedName}/v/${version})`,
		);
	}
}

core.setOutput(
	"changes",
	`<details><summary>Bumped dependencies</summary>${
		[...changes].join("\n") || "*No packages changed.*"
	}</details>`,
);
