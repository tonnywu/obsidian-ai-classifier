/**
 * 简单日志工具
 */
export class Logger {
	private enabled: boolean;
	private prefix = '[AIClassifier]';
	
	constructor(enabled = false) {
		this.enabled = enabled;
	}
	
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}
	
	debug(message: string, ...args: unknown[]): void {
		if (this.enabled) {
			console.debug(`${this.prefix} ${message}`, ...args);
		}
	}
	
	info(message: string, ...args: unknown[]): void {
		console.debug(`${this.prefix} ${message}`, ...args);
	}
	
	warn(message: string, ...args: unknown[]): void {
		console.warn(`${this.prefix} ${message}`, ...args);
	}
	
	error(message: string, ...args: unknown[]): void {
		console.error(`${this.prefix} ${message}`, ...args);
	}
}
