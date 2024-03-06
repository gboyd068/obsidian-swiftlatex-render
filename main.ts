import { App, FileSystemAdapter, MarkdownPostProcessorContext, Plugin, PluginSettingTab, SectionCache, Setting, TFile, TFolder } from 'obsidian';
import { Md5 } from 'ts-md5';
import * as fs from 'fs';
import * as temp from 'temp';
import * as path from 'path';
import {PdfTeXEngine} from './PdfTeXEngine.js';
import {PDFDocument} from 'pdf-lib';

interface MyPluginSettings {
	package_url: string,
	timeout: number,
	enableCache: boolean,
	cache: Array<[string, Set<string>]>;
	packageCache: Array<StringMap>;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	package_url: `https://texlive2.swiftlatex.com/`,
	timeout: 10000,
	enableCache: true,
	cache: [],
	packageCache: [{},{},{},{}]
}

type StringMap = { [key: string]: string };

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	cacheFolderPath: string;
	packageCacheFolderPath: string;
	pluginFolderPath: string;
	pdfEngine: any;

	cache: Map<string, Set<string>>; // Key: md5 hash of latex source. Value: Set of file path names.

	async onload() {
		await this.loadSettings();
		if (this.settings.enableCache) await this.loadCache();
		this.pluginFolderPath = path.join((this.app.vault.adapter as FileSystemAdapter).getBasePath(), this.app.vault.configDir, "plugins/obsidian-swiftlatex-render/");
		this.addSettingTab(new SampleSettingTab(this.app, this));
		this.pdfEngine = new PdfTeXEngine();
		await this.pdfEngine.loadEngine();
		await this.loadPackageCache();
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
		const cacheFolderParentPath = path.join((this.app.vault.adapter as FileSystemAdapter).getBasePath(), this.app.vault.configDir, "obsidian-swiftlatex-render-cache");
		if (!fs.existsSync(cacheFolderParentPath)) {
			fs.mkdirSync(cacheFolderParentPath);
		}
		this.cacheFolderPath = path.join(cacheFolderParentPath, "pdf-cache");
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


	async loadPackageCache() {
		const cacheFolderParentPath = path.join((this.app.vault.adapter as FileSystemAdapter).getBasePath(), this.app.vault.configDir, "obsidian-swiftlatex-render-cache");
		if (!fs.existsSync(cacheFolderParentPath)) {
			fs.mkdirSync(cacheFolderParentPath);
		}
		this.packageCacheFolderPath = path.join(cacheFolderParentPath, "package-cache");
		if (!fs.existsSync(this.packageCacheFolderPath)) {
			fs.mkdirSync(this.packageCacheFolderPath);
		}
		console.log("SwiftLaTeX: Loading package cache");
		// write cache data to the VFS
		this.pdfEngine.writeCacheData(this.settings.packageCache[0],
									this.settings.packageCache[1],
									this.settings.packageCache[2],
									this.settings.packageCache[3]);

		// write the tex packages to the cache in the VFS
		for (const [key, val] of Object.entries(this.settings.packageCache[1])) {
			const filename = path.basename(val);
			let read_success = false;
			try {
				const srccode = fs.readFileSync(path.join(this.packageCacheFolderPath, filename));
				this.pdfEngine.writeTexFSFile(filename, srccode);
			} catch (e) {
				// when unable to read file, remove this from the cache
				console.log(`Unable to read file ${filename} from package cache`)
				delete this.settings.packageCache[1][key];
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

	async pdfToHtml(pdfData: any) {
		const {width, height} = await this.getPdfDimensions(pdfData);
		const ratio = width / height;
		const pdfblob = new Blob([pdfData], { type: 'application/pdf' });
		const objectURL = URL.createObjectURL(pdfblob);
		return `<object data="${objectURL}#view=FitH&toolbar=0" type="application/pdf" class="block-lanuage-latex" style="width:100%; aspect-ratio:${ratio}"}></object>`;
	}

	async getPdfDimensions(pdf: any): Promise<{width: number, height: number}> {
		const pdfDoc = await PDFDocument.load(pdf);
		const firstPage = pdfDoc.getPages()[0];
		const {width, height} = firstPage.getSize();
		return {width, height};
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
				this.pdfToHtml(pdfData).then((html)=>{el.innerHTML = html; resolve();});
				this.addFileToCache(md5Hash, ctx.sourcePath);
				resolve();
			}
			else {
				console.log("Rendering PDF: ", md5Hash);

				this.renderLatexToPDF(source, md5Hash).then((r: any) => {
					if (this.settings.enableCache) this.addFileToCache(md5Hash, ctx.sourcePath);
				this.pdfToHtml(r.pdf).then((html)=>{el.innerHTML = html; resolve();});
				fs.writeFileSync(pdfPath, r.pdf);
				resolve();
				}
				).catch(err => { el.innerHTML = `<div class="block-latex-error">${err}</div>`; reject(err); });
			}
		}).then(() => { 
			this.pdfEngine.flushCache();
			if (this.settings.enableCache) setTimeout(() => this.cleanUpCache(), 1000);
		});
	}

	renderLatexToPDF(source: string, md5Hash: string) {
		return new Promise(async (resolve, reject) => {
			source = this.formatLatexSource(source);

			temp.mkdir("obsidian-swiftlatex-renderer", (err, dirPath) => {
				if (err) reject(err);
				this.pdfEngine.writeMemFSFile("main.tex", source);
				this.pdfEngine.setEngineMainFile("main.tex");
				this.pdfEngine.compileLaTeX().then((r: any) => {
				if (r.status != 0) {
					// manage latex errors
					reject(r.log);
				}
				// update the list of package files in the cache
				this.fetchPackageCacheData()
				resolve(r);
				});
			})
		});
	}

	fetchPackageCacheData(): void {
		this.pdfEngine.fetchCacheData().then((r: StringMap[]) => {
			// let texlive404_cache = r[0];
			// let texlive200_cache = r[1];
			// let pk404_cache = r[2];
			// let pk200_cache = r[3];
			for (var i = 0; i < r.length; i++) {
				if (i === 1) { // currently only dealing with texlive200_cache
					// get diffs
					const newFileNames = this.getNewPackageFileNames(this.settings.packageCache[i], r[i]);
					// fetch new package files
					this.pdfEngine.fetchTexFiles(newFileNames, this.packageCacheFolderPath);
				}
			}
			this.settings.packageCache = r;
			this.saveSettings().then(); // hmm
		});
	}

	getNewPackageFileNames(oldCacheData: StringMap, newCacheData: StringMap): string[] {
		// based on the old and new package files in package cache data,
		// return the new package files
		let newKeys = Object.keys(newCacheData).filter(key => !(key in oldCacheData));
		let newPackageFiles = newKeys.map(key => path.basename(newCacheData[key]));		
		return newPackageFiles;
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
			.setDesc('default: https://texlive2.swiftlatex.com/, reload required to take effect')
			.addText(text => text
				.setValue(this.plugin.settings.package_url.toString())
				.onChange(async (value) => {
					this.plugin.settings.package_url = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable caching of PDFs')
			.setDesc("PDFs rendered by this plugin will be kept in `.obsidian/obsidian-swiftlatex-render-pdf-cache`. The plugin will automatically keep track of used pdfs and remove any that aren't being used")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCache)
				.onChange(async (value) => {
					this.plugin.settings.enableCache = value;
					await this.plugin.saveSettings();
				}));
	}
}

