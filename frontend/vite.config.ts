import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	server: {
		proxy: {
			'/api': 'http://localhost:3001'
		}
	},
	preview: {
		proxy: {
			// The preview server does not inherit `server.proxy`; keep it in sync so
			// `vite preview` (used by e2e tests) can reach the backend too.
			'/api': 'http://localhost:3001'
		}
	},
	test: {
		// The import pipeline is pure TypeScript; component tests would need a browser and are not here.
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
