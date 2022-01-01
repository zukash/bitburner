export async function getAllServers(ns) {
	ns.disableLog('scan');
	let servers = [];
	let dfs = (node, prev) => {
		servers.push(ns.getServer(node));
		for(let next of ns.scan(node)) {
			if(next == prev) continue;
			dfs(next, node);
		}
	};
	dfs("home", "");
	return servers;
}

export async function formatServerInfo(ns, server) {
	const nF = (number) => ns.nFormat(number, '$0.000a');
	const tF = (time) => ns.tFormat(time);
	const {hostname, organizationName, minDifficulty, requiredHackingSkill, serverGrowth, moneyMax} = server;
	const moneyAvailable = ns.getServerMoneyAvailable(hostname);
	const securityLevel = ns.getServerSecurityLevel(hostname);

	let info = "\n";
	info += `# ${hostname} (${organizationName})\n`;
	info += `- requirement: Hack >= ${requiredHackingSkill}\n`;
	info += `- growth: ${serverGrowth}\n`;
	info += `- grow(): ${tF(ns.getGrowTime(hostname))}\n`;
	info += `- weaken(): ${tF(ns.getWeakenTime(hostname))}\n`;
	info += `- hack(): ${tF(ns.getHackTime(hostname))}\n`;
	info += `- money: ${nF(moneyAvailable)} / ${nF(moneyMax)}\n`;
	info += `- security: ${securityLevel.toFixed(3)} / ${minDifficulty}\n`;

	return info;
}

export async function showServers(ns, option) {
	const servers = await getAllServers(ns);
	// servers.sort((s0, s1) => s0.hostname < s1.hostname ? -1 : 1);
	servers.sort((s0, s1) => s0.requiredHackingSkill < s1.requiredHackingSkill ? -1 : 1);
	let message = "\n";
	for(const server of servers) {
		if(!server.hasAdminRights) continue;
		if(option == '-q')
			message += `${server.hostname}  `
		else
			message += await formatServerInfo(ns, server);
	}
	ns.tprint(message);
}

export async function watchServer(ns, target) {
	ns.tail();
	ns.disableLog('sleep');
	while(true) {
		const server = await ns.getServer(target)
		const info =  await formatServerInfo(ns, server);
		ns.clearLog();
		ns.print(info);
		await ns.sleep(100);
	}
}

export async function purchaseServer(ns, ram) {
	const purchasedServers = ns.getPurchasedServers();
	if(purchasedServers.length == ns.getPurchasedServerLimit()) {
		ns.toast('Already reached the limit.', 'error');
	}
	if(typeof ram === 'undefined') {
		ram = 1;
		while(ns.getPurchasedServerCost(ram) < ns.getServerMoneyAvailable("home"))
			ram <<= 1;
		ram >>= 1;
		const cost = ns.nFormat(ns.getPurchasedServerCost(ram), '$0.000a');
		const message = `Are you sure you want to purchase a ${ram}GB RAM server for ${cost}`;
		if(!await ns.prompt(message)) return;
	}
	const hostname = await ns.purchaseServer(`SERVER_${ram}GB`, ram);
	if(hostname) ns.toast(`Successfully purchased ${hostname}`);
}

export async function main(ns) {
	switch(ns.args[0]) {
		case 'list':
			await showServers(ns, ns.args[1]);
			break;
		case 'watch':
			await watchServer(ns, ns.args[1]);
			break;
		case 'purchase':
			await purchaseServer(ns, ns.args[1]);
			break;
		case 'path':
			await pathToServer(ns, ns.args[1]);
			break;
		default:

	}
}