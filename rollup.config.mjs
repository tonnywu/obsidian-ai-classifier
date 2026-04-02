import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
	input: 'src/main.ts',
	output: {
		dir: '.',
		entryFileNames: 'main.js',
		format: 'cjs',
		sourcemap: 'inline',
		exports: 'default'
	},
	external: ['obsidian'],
	plugins: [
		typescript({
			tsconfig: './tsconfig.json',
			declaration: false,
			sourceMap: true,
			inlineSources: true,
			rootDir: './src',
			outDir: './'
		}),
		nodeResolve({
			browser: true,
			preferBuiltins: false
		}),
		commonjs()
	]
};
