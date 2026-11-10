// Asset modules embedded into the bundle by esbuild (see `loader` in
// esbuild.config.mjs), so they never have to be fetched over the network.

declare module "*.png" {
	/** data: URL of the embedded image */
	const dataUrl: string;
	export default dataUrl;
}

declare module "*.md" {
	/** Raw file contents */
	const content: string;
	export default content;
}
