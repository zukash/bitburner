export async function main(ns) {
	const target = ns.args[0];
	const securityThresh = ns.getServerMinSecurityLevel(target) + 5;
	const moneyThresh = ns.getServerMaxMoney(target) * 0.75;
	
	while(true) {
		const securityLevel = ns.getServerSecurityLevel(target);
		const moneyAvailable = ns.getServerMoneyAvailable(target);
		if(securityLevel > securityThresh)
			await ns.weaken(target);
		else if(moneyAvailable < moneyThresh)
			await ns.grow(target);
		else
			await ns.hack(target);
	}
}