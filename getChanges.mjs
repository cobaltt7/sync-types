import {fromUrl} from "hosted-git-info";

const oldPackages = await import("./package-lock.old.json", {assert: {type: "json"}});
const newPackages = await import("./package-lock.json", {assert: {type: "json"}});

const changes = new Set();

for (const packageName in newPackages) {
	const parsedName = packageName.split("node_modules/").at("-1") || newPackages[packageName].name;

	if (oldPackages[packageName]) {
		const oldVersion = oldPackages[packageName].version;
		const newVersion = newPackages[packageName].version;

		if (oldVersion !== newVersion) {
			const {repository} = await import(`/${packageName}/package.json`, {assert: {type: "json"}});
			const repoLink = repository && fromUrl(repository.url || repository, {noCommittish: true, noGitPlus: true}).browse(repository.directory);
			const host = repoLink?.split("/")[2];
			const replacement = ({
				"github.com": ["tree", "commits"],
				"bitbucket.org": ["src", "history-node"],
				"gitlab.com": ["tree", "commits"],
				"git.sr.ht": ["tree", "logs"],
				"gist.github.com": [/#|\?|$/, "/revisions$&"]
			})[host];

			const commitsLink = repoLink && replacement ? repoLink.replace(...replacement) : repoLink;

			changes.add(
				`Bumped [\`${parsedName}@${oldVersion}\`](https://npmjs.com/package/${parsedName}/v/${oldVersion}) to [\`${newVersion}\`](https://npmjs.com/package/${parsedName}/v/${newVersion}) ([see recent commits](${commitsLink}))`
			);
		}
	} else {
		const addedVersion = newPackages[packageName].version;
		changes.add(`Installed [\`${parsedName}@${addedVersion}\`](https://npmjs.com/package/${parsedName}/v/${addedVersion})`);
	}
}

for (const packageName in oldPackages) {
	const parsedName = packageName.split("node_modules/").at("-1") || oldPackages[packageName].name;
	if (!newPackages[packageName]) {
		const {version} = oldPackages[packageName];
		changes.add(`Removed [\`${parsedName}@${version}\`](https://npmjs.com/package/${parsedName}/v/${version})`);
	}
}

console.log([...changes].join("\n") || "No packages changed.");
