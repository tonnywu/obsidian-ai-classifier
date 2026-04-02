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
	
	debug(message: string, ...args: any[]): void {
		if (this.enabled) {
			console.log(`${this.prefix} ${message}`, ...args);
		}
	}
	
	info(message: string, ...args: any[]): void {
		console.log(`${this.prefix} ${message}`, ...args);
	}
	
	warn(message: string, ...args: any[]): void {
		console.warn(`${this.prefix} ${message}`, ...args);
	}
	
	error(message: string, ...args: any[]): void {
		console.error(`${this.prefix} ${message}`, ...args);
	}
}
