import { App, FileSystemAdapter, MarkdownPostProcessorContext, Plugin, PluginSettingTab, SectionCache, Setting, TFile, TFolder } from 'obsidian';
import { Md5 } from 'ts-md5';
import * as fs from 'fs';
import * as temp from 'temp';
import * as path from 'path';
import {PdfTeXEngine} from './PdfTeXEngine.js';

interface MyPluginSettings {
	package_url: string,
	timeout: number,
	enableCache: boolean,
	cache: Array<[string, Set<string>]>;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	package_url: `https://texlive2.swiftlatex.com/`,
	timeout: 10000,
	enableCache: true,
	cache: [],
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	cacheFolderPath: string;
	pluginFolderPath: string;
	pdfEngine: any;

	cache: Map<string, Set<string>>; // Key: md5 hash of latex source. Value: Set of file path names.

	async onload() {
		await this.loadSettings();
		if (this.settings.enableCache) await this.loadCache();
		this.pluginFolderPath = path.join((this.app.vault.adapter as FileSystemAdapter).getBasePath(), this.app.vault.configDir, "plugins\\obsidian-swiftlatex-render\\");
		this.addSettingTab(new SampleSettingTab(this.app, this));

		console.log(path.join(this.pluginFolderPath, "swiftlatexpdftex.js"));
		// console.log(process.cwd());
		// const sourcePath = path.join(this.pluginFolderPath, "swiftlatexpdftex.js");

		// if (!fs.existsSync(sourcePath)) {
		// 	console.error(`Source file does not exist: ${sourcePath}`);
		// } else if (!fs.existsSync(this.pluginFolderPath)) {
		// 	console.error(`Plugin folder does not exist: ${this.pluginFolderPath}`);
		// } else {
		// 	try {
		// 		fs.copyFileSync(sourcePath, "app://obsidian.md/swiftlatexpdftex.js");
		// 	} catch (err) {
		// 		console.error(`Error copying file: ${err}`);
		// 	}
		// }

		// console.log(__dirname);

		this.pdfEngine = new PdfTeXEngine();
		await this.pdfEngine.loadEngine();
		this.pdfEngine.setTexliveEndpoint(this.settings.package_url);
		this.registerMarkdownCodeBlockProcessor("latex", (source, el, ctx) => this.renderLatexToElement(source, el, ctx));
	}

	onunload() {
		if (this.settings.enableCache) this.unloadCache();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}


	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadCache() {
		this.cacheFolderPath = path.join((this.app.vault.adapter as FileSystemAdapter).getBasePath(), this.app.vault.configDir, "obsidian-swiftlatex-render-pdf-cache\\");
		if (!fs.existsSync(this.cacheFolderPath)) {
			fs.mkdirSync(this.cacheFolderPath);
			this.cache = new Map();
		} else {
			this.cache = new Map(this.settings.cache);
			// For some reason `this.cache` at this point is actually `Map<string, Array<string>>`
			for (const [k, v] of this.cache) {
				this.cache.set(k, new Set(v))
			}
		}
	}

	unloadCache() {
		fs.rmdirSync(this.cacheFolderPath, { recursive: true });
	}

	formatLatexSource(source: string) {
		return source;
	}

	hashLatexSource(source: string) {
		return Md5.hashStr(source.trim());
	}


	async renderLatexToElement(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		return new Promise<void>((resolve, reject) => {
			let md5Hash = this.hashLatexSource(source);
			let pdfPath = path.join(this.cacheFolderPath, `${md5Hash}.pdf`);

			// PDF file has already been cached
			// Could have a case where pdfCache has the key but the cached file has been deleted
			if (this.settings.enableCache && this.cache.has(md5Hash) && fs.existsSync(pdfPath)) {
				console.log("Using cached PDF: ", md5Hash);
				let pdfData = fs.readFileSync(pdfPath);
				const pdfblob = new Blob([pdfData], { type: 'application/pdf' });
				const objectURL = URL.createObjectURL(pdfblob);
				el.innerHTML = `<object data="${objectURL}" type="application/pdf" width="100%" height="100%"></object>`;
				this.addFileToCache(md5Hash, ctx.sourcePath);
				resolve();
			}
			else {
				console.log("Rendering PDF: ", md5Hash);

				this.renderLatexToPDF(source, md5Hash).then((r: any) => {
					if (this.settings.enableCache) this.addFileToCache(md5Hash, ctx.sourcePath);
				const pdfblob = new Blob([r.pdf], { type: 'application/pdf' });
				const objectURL = URL.createObjectURL(pdfblob);
				el.innerHTML = `<object data="${objectURL}" type="application/pdf" width="100%" height="100%"></object>`;
				console.log(typeof r.pdf);
				fs.writeFileSync(pdfPath, r.pdf);
				resolve();
				}
				).catch(err => { el.innerHTML = err; reject(err); });
			}
		}).then(() => { if (this.settings.enableCache) setTimeout(() => this.cleanUpCache(), 1000); });
	}

	renderLatexToPDF(source: string, md5Hash: string) {
		return new Promise(async (resolve, reject) => {
			source = this.formatLatexSource(source);

			temp.mkdir("obsidian-swiftlatex-renderer", (err, dirPath) => {
				if (err) reject(err);
				fs.writeFileSync(path.join(dirPath, md5Hash + ".tex"), source);
				this.pdfEngine.writeMemFSFile("main.tex", source);
				this.pdfEngine.setEngineMainFile("main.tex");
				this.pdfEngine.compileLaTeX().then((r: any) => {
				if (r.status != 0) {
					// manage latex errors
					reject(r.log);
				}
				resolve(r);
				});
			})
		});
	}


	renderLatexToSVG(source: string, md5Hash: string, svgPath: string) {
		return new Promise(async (resolve, reject) => {
			source = this.formatLatexSource(source);

			temp.mkdir("obsidian-latex-renderer", (err, dirPath) => {
				if (err) reject(err);
				fs.writeFileSync(path.join(dirPath, md5Hash + ".tex"), source);
				exec(
					this.settings.command.replace(/{file-path}/g, md5Hash)
					,
					{ timeout: this.settings.timeout, cwd: dirPath },
					async (err, stdout, stderr) => {
						if (err) reject([err, stdout, stderr]);
						else {
							if (this.settings.enableCache) fs.copyFileSync(path.join(dirPath, md5Hash + ".svg"), svgPath);
							let svgData = fs.readFileSync(path.join(dirPath, md5Hash + ".svg"));
							resolve(svgData);
						};
					},
				);
			})
		});
	}

	async saveCache() {
		let temp = new Map();
		for (const [k, v] of this.cache) {
			temp.set(k, [...v])
		}
		this.settings.cache = [...temp];
		await this.saveSettings();

	}

	addFileToCache(hash: string, file_path: string) {
		if (!this.cache.has(hash)) {
			this.cache.set(hash, new Set());
		}
		this.cache.get(hash)?.add(file_path);
	}

	async cleanUpCache() {
		let file_paths = new Set<string>();
		for (const fps of this.cache.values()) {
			for (const fp of fps) {
				file_paths.add(fp);
			}
		}

		for (const file_path of file_paths) {
			let file = this.app.vault.getAbstractFileByPath(file_path);
			if (file == null) {
				this.removeFileFromCache(file_path);
			} else {
				await this.removeUnusedCachesForFile(file as TFile);
			}
		}
		await this.saveCache();
	}

	async removeUnusedCachesForFile(file: TFile) {
		let hashes_in_file = await this.getLatexHashesFromFile(file);
		let hashes_in_cache = this.getLatexHashesFromCacheForFile(file);
		for (const hash of hashes_in_cache) {
			if (!hashes_in_file.contains(hash)) {
				this.cache.get(hash)?.delete(file.path);
				if (this.cache.get(hash)?.size == 0) {
					this.removePDFFromCache(hash);
				}
			}
		}
	}

	removePDFFromCache(key: string) {
		this.cache.delete(key);
		fs.rmSync(path.join(this.cacheFolderPath, `${key}.pdf`));
	}

	removeFileFromCache(file_path: string) {
		for (const hash of this.cache.keys()) {
			this.cache.get(hash)?.delete(file_path);
			if (this.cache.get(hash)?.size == 0) {
				this.removePDFFromCache(hash);
			}
		}
	}

	getLatexHashesFromCacheForFile(file: TFile) {
		let hashes: string[] = [];
		let path = file.path;
		for (const [k, v] of this.cache.entries()) {
			if (v.has(path)) {
				hashes.push(k);
			}
		}
		return hashes;
	}

	async getLatexHashesFromFile(file: TFile) {
		let hashes: string[] = [];
		let sections = this.app.metadataCache.getFileCache(file)?.sections
		if (sections != undefined) {
			let lines = (await this.app.vault.read(file)).split('\n');
			for (const section of sections) {
				if (section.type != "code" && lines[section.position.start.line].match("``` *latex") == null) continue;
				let source = lines.slice(section.position.start.line + 1, section.position.end.line).join("\n");
				let hash = this.hashLatexSource(source);
				hashes.push(hash);
			}
		}
		return hashes;
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'SwiftLaTeX Render Settings' });

		new Setting(containerEl)
			.setName('Package Fetching URL')
			.addText(text => text
				.setValue(this.plugin.settings.package_url.toString())
				.onChange(async (value) => {
					this.plugin.settings.package_url = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable caching of PDFs')
			.setDesc("PDFs rendered by this pluing will be kept in `.obsidian/obsidian-swiftlatex-render-pdf-cache`. The plugin will automatically keep track of used pdfs and remove any that aren't being used")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCache)
				.onChange(async (value) => {
					this.plugin.settings.enableCache = value;
					await this.plugin.saveSettings();
				}));
	}
}

