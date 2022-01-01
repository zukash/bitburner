export async function main(ns) {
	const interval = ns.args[0];
	const script = ns.args[1];
	const args = ns.args.slice(2);

	while(true) {
		ns.exec(script, 'home', 1, ...args);
		await ns.sleep(interval);
	}
}