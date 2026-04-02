import * as esbuild from 'esbuild';
import fs from 'fs';

const baseConfig = {
	platform: 'browser',
	entryPoints: ['src/main.ts'],
	outfile: './main.js',
	bundle: true,
	sourcemap: 'inline',
	target: 'es2020',
	external: ['obsidian'],
	format: 'iife',
	globalName: 'Plugin',
	minify: process.argv.includes('--minify'),
};

if (process.argv.includes('--watch')) {
	console.log('[esbuild] 监听模式启动...');
	const ctx = await esbuild.context(baseConfig);
	await ctx.watch();
} else {
	await esbuild.build(baseConfig);
	
	// 读取生成的文件并添加导出
	let content = fs.readFileSync('./main.js', 'utf8');
	
	// 在文件开头添加模块检测
	const exportCode = `
// Obsidian Plugin Module Export
(function() {
  if (typeof window !== 'undefined' && window.Plugin && window.Plugin.default) {
    var pluginClass = window.Plugin.default;
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = pluginClass;
    }
    if (typeof global !== 'undefined') {
      global.module = { exports: pluginClass };
    }
  }
})();
`;
	
	// 将导出代码添加到文件末尾
	content += exportCode;
	fs.writeFileSync('./main.js', content);
	
	console.log('[esbuild] 构建完成!');
}
