import {getAllServers, formatServerInfo} from 'server.js';

export async function optimalThreads(ns, target, type, expected = 0) {
	let thread;
	if(type == 'weaken') {
		const securityLevel = ns.getServerSecurityLevel(target) + expected;
		const minSecurityLevel = ns.getServerMinSecurityLevel(target);
		let ok = 1 << 20;
		let ng = 0;
		while(ok - ng > 1) {
			thread = Math.floor((ok + ng) / 2);
			if(securityLevel - ns.weakenAnalyze(thread) < minSecurityLevel)
				ok = thread
			else
				ng = thread
		}
	} else if(type == 'grow') {
		const moneyAvailable = ns.getServerMoneyAvailable(target) + expected;
		const maxMoney = ns.getServerMaxMoney(target);
		const growthAmount = maxMoney / moneyAvailable;
		thread = ns.growthAnalyze(target, growthAmount);
	} else if(type == 'hack') {
		const moneyAvailable = ns.getServerMoneyAvailable(target) + expected;
		thread = ns.hackAnalyzeThreads(target, moneyAvailable);
	}
	return thread;
}

export async function allocateTask(ns, script, thread, args) {
	if(!ns.fileExists(script))
		throw new Error(`${script} does not exist.`);

	const ramNeeded = ns.getScriptRam(script) * thread;
	let target;
	for(const server of await getAllServers(ns)) {
		if(!server.hasAdminRights) continue;
		const {maxRam, ramUsed} = server;
		if(maxRam - ramUsed > ramNeeded) {
			target = server.hostname;
			break;
		}
	}

	if(typeof target === 'undefined')
		throw new Error(`No server can use more than ${ramNeeded}GB of RAM.`);
	if(!ns.fileExists(script, target))
		await ns.scp(script, target);
	const UNIXTIME = (new Date()).getTime()
	args.push(UNIXTIME);
	const PID = ns.exec(script, target, thread, ...args);
	if(PID == 0)
		throw new Error(`An error occured while running ${script} on ${target}.`);
	ns.print(`# ${script} is running...`);
	ns.print(`- server: ${target}`);
	ns.print(`- thread: ${thread}`);
	ns.print(`- ram: ${ramNeeded}GB`);
}

export async function attackOnServer(ns, target, threadLimit = 1<<19) {
	let earning = 0;
	let totalThread = 0;
	let duration = 0;
	ns.disableLog('sleep');
	while(true) {
		ns.clearLog();
		let sleepTime = 0;
		if(ns.getServerMinSecurityLevel(target) + 1 < ns.getServerSecurityLevel(target)) {
			const wThread = Math.min(await optimalThreads(ns, target, 'weaken'), threadLimit);
			await allocateTask(ns, 'weaken.js', wThread, [target]);

			totalThread += wThread;
			sleepTime = ns.getWeakenTime(target);
		} else if(ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target) * 0.95) {
			const gThread = await optimalThreads(ns, target, 'grow');
			await allocateTask(ns, 'grow.js', Math.min(gThread, threadLimit), [target]);
			const expected = ns.growthAnalyzeSecurity(gThread);
			const wThread = await optimalThreads(ns, target, 'weaken', expected);
			await allocateTask(ns, 'weaken.js', Math.min(wThread, threadLimit), [target]);

			totalThread += gThread + wThread;
			sleepTime = ns.getWeakenTime(target);
		} else {
			const leftover = ns.getServerMaxMoney(target) * 0.7;
			const hThread = await optimalThreads(ns, target, 'hack', -leftover);
			await allocateTask(ns, 'hack.js', Math.min(hThread, threadLimit), [target]);
			earning += ns.getServerMoneyAvailable(target) - leftover;

			totalThread += hThread;
			sleepTime = ns.getHackTime(target);
		}

		// display stats
		ns.print(await formatServerInfo(ns, ns.getServer(target)));

		duration += sleepTime + 100;
		await ns.sleep(sleepTime + 100);
	}
}

export async function main(ns) {
	ns.disableLog('ALL');
	switch(ns.args[0]) {
		case 'hack':
			await attackOnServer(ns, ...ns.args.slice(1));
			break;
		case 'exp':
			const thread = ns.args[1];
			const target = ns.args[2] || 'joesguns';
			while(true) {
				await allocateTask(ns, 'weaken.js', thread, [target])
				await ns.sleep(ns.getWeakenTime(target));
			}
			break;
	}
}