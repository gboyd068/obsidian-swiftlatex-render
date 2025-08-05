import { App, FileSystemAdapter, MarkdownPostProcessorContext, Plugin, PluginSettingTab, SectionCache, Setting, TFile, TFolder, MarkdownView, MarkdownPreviewRenderer, DropdownComponent, requestUrl } from 'obsidian';
import { Md5 } from 'ts-md5';
import * as fs from 'fs';
import * as temp from 'temp';
import * as path from 'path';
import {PdfTeXEngine} from './PdfTeXEngine.js';
import {XeTeXEngine} from './XeTeXEngine.js';
import {DvipdfmxEngine} from './DvipdfmxEngine.js';
import {PDFDocument} from 'pdf-lib';
const PdfToCairo = require("./pdftocairo.js")
import {optimize} from 'svgo';
import { isSharedArrayBuffer } from 'util/types';

enum CompilerType {
	PdfTeX,
	XeTeX
}

interface SwiftlatexRenderSettings {
	package_url: string,
	timeout: number,
	enableCache: boolean,
	invertColorsInDarkMode: boolean;
	cache: Array<[string, Set<string>]>;
	packageCache: Array<StringMap>;
	onlyRenderInReadingMode: boolean;
	compiler: CompilerType
}

const DEFAULT_SETTINGS: SwiftlatexRenderSettings = {
	package_url: `https://texlive2.swiftlatex.com/`,
	timeout: 10000,
	enableCache: true,
	invertColorsInDarkMode: true,
	cache: [],
	packageCache: [{},{},{},{}],
	onlyRenderInReadingMode: false,
	compiler: CompilerType.PdfTeX
}

class PdfXeTeXEngine {
	xetEng: any;
	dviEng: any;
	pluginRef: SwiftlatexRenderPlugin

	constructor(plugin: SwiftlatexRenderPlugin) {
		this.xetEng = new XeTeXEngine();
		this.dviEng = new DvipdfmxEngine();
		this.pluginRef = plugin;
	}

	async loadEngine() {
		await this.xetEng.loadEngine();
		await this.dviEng.loadEngine();
	}


	setTexliveEndpoint(url: string) {
		this.xetEng.setTexliveEndpoint(url);
		this.dviEng.setTexliveEndpoint(url);
	}

	writeTexFSFile(filename: string, srccode: any) {
		this.xetEng.writeTexFSFile(filename, srccode);
		this.dviEng.writeTexFSFile(filename, srccode);
	}
	

	writeCacheData(texlive404_cache: StringMap, texlive200_cache: StringMap, font404_cache: StringMap, font200_cache: StringMap) {
		this.xetEng.writeCacheData({}, texlive200_cache, font404_cache, font200_cache);
	}

	flushCache() {
		this.xetEng.flushCache();
	}

	isReady() {
		return this.xetEng.isReady() && this.dviEng.isReady();
	}


	writeMemFSFile(filename: string, source: any) {
		this.xetEng.writeMemFSFile("main.tex", source);
	}

	setEngineMainFile(file: string) {
		this.xetEng.setEngineMainFile("main.tex");
	}



	compileLaTeX() : Promise<any> {
		return new Promise<any>((resolve) => {
			this.xetEng.compileLaTeX().then((xetResult: any) => {
				// send the error up
				if (xetResult.status != 0) {
					resolve(xetResult);
					return;
				}

				let xdv = xetResult.pdf;

				this.dviEng.writeMemFSFile("main.xdv", xdv);
				this.dviEng.setEngineMainFile("main.xdv");
				this.dviEng.compilePDF().then((dviResult: any) => {
					resolve(dviResult)
				})
				})
			})
		}

		fetchCacheData(): Promise<StringMap[]> {
			return new Promise<StringMap[]>((resolve) => {
				this.xetEng.fetchCacheData().then((xetcache: StringMap[]) =>{
					this.dviEng.fetchCacheData().then((dvicache: StringMap[]) =>{
						const mergedcache = xetcache.map((item:any, index:any) => ({ ...item, ...dvicache[index] }));
						resolve(mergedcache);
					});
				});
			})
		}

		fetchTexFiles(newFileNames:any, cachepath: string) {
			this.xetEng.fetchTexFiles(newFileNames, cachepath);
			this.dviEng.fetchTexFiles(newFileNames, cachepath);
		}

}

type StringMap = { [key: string]: string };


const waitFor = async (condFunc: () => boolean) => {
	return new Promise<void>((resolve) => {
	  if (condFunc()) {
		resolve();
	  }
	  else {
		setTimeout(async () => {
		  await waitFor(condFunc);
		  resolve();
		}, 100);
	  }
	});
  };
  

export default class SwiftlatexRenderPlugin extends Plugin {
	settings: SwiftlatexRenderSettings;
	cacheFolderPath: string;
	packageCacheFolderPath: string;
	pluginFolderPath: string;
	pdfEngine: PdfXeTeXEngine;

	cache: Map<string, Set<string>>; // Key: md5 hash of latex source. Value: Set of file path names.

	async onload() {
		await this.loadSettings();
		if (this.settings.enableCache) await this.loadCache();
		this.pluginFolderPath = path.join(this.getVaultPath(), this.app.vault.configDir, "plugins/swiftlatex-render/");
		this.addSettingTab(new SampleSettingTab(this.app, this));
		// initialize the latex compiler
		if (this.settings.compiler === CompilerType.PdfTeX) {
			// @ts-ignore
			this.pdfEngine = new PdfTeXEngine();
		}
		if (this.settings.compiler === CompilerType.XeTeX) {
			this.pdfEngine = new PdfXeTeXEngine(this);
		}
		
		await this.pdfEngine.loadEngine();
		await this.loadPackageCache();
		this.pdfEngine.setTexliveEndpoint(this.settings.package_url);

		this.addSyntaxHighlighting();
		if (this.settings.onlyRenderInReadingMode) {
			const pdfBlockProcessor = MarkdownPreviewRenderer.createCodeBlockPostProcessor("latex", (source, el, ctx) => this.renderLatexToElement(source, el, ctx, false));
			MarkdownPreviewRenderer.registerPostProcessor(pdfBlockProcessor);
			const svgBlockProcessor = MarkdownPreviewRenderer.createCodeBlockPostProcessor("latexsvg", (source, el, ctx) => this.renderLatexToElement(source, el, ctx, true));
			MarkdownPreviewRenderer.registerPostProcessor(svgBlockProcessor);
		} else {
			this.registerMarkdownCodeBlockProcessor("latex", (source, el, ctx) => this.renderLatexToElement(source, el, ctx, false));
			this.registerMarkdownCodeBlockProcessor("latexsvg", (source, el, ctx) => this.renderLatexToElement(source, el, ctx, true));
		}
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

	getVaultPath() {
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			return this.app.vault.adapter.getBasePath();
		} else {
			throw new Error("SwiftLaTeX: Could not get vault path.");
		}
	}

	async loadCache() {
		const cacheFolderParentPath = path.join(this.getVaultPath(), this.app.vault.configDir, "swiftlatex-render-cache");
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
		const cacheFolderParentPath = path.join(this.getVaultPath(), this.app.vault.configDir, "swiftlatex-render-cache");
		if (!fs.existsSync(cacheFolderParentPath)) {
			fs.mkdirSync(cacheFolderParentPath);
		}
		this.packageCacheFolderPath = path.join(cacheFolderParentPath, "package-cache");
		if (!fs.existsSync(this.packageCacheFolderPath)) {
			fs.mkdirSync(this.packageCacheFolderPath);
		}
		console.log("SwiftLaTeX: Loading package cache");

		// add files in the package cache folder to the cache list
		const packageFiles = fs.readdirSync(this.packageCacheFolderPath);
		for (const file of packageFiles) {
			const filename = path.basename(file);
			const value = "/tex/"+filename;
			const packageValues = Object.values(this.settings.packageCache[1]);
			if (!packageValues.includes(value)) {
				const key = "26/" + filename
				this.settings.packageCache[1][key] = value;
			}
		}
		// move packages to the VFS
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

		// write cache data to the VFS, except don't write the texlive404_cache because this will cause problems when switching between texlive sources
		this.pdfEngine.writeCacheData({},
			this.settings.packageCache[1],
			this.settings.packageCache[2],
			this.settings.packageCache[3]);
	}

	unloadCache() {
		fs.rmdirSync(this.cacheFolderPath, { recursive: true });
	}

	addSyntaxHighlighting() {
		// @ts-ignore
		window.CodeMirror.modeInfo.push({name: "latexsvg", mime: "text/x-latex", mode: "stex"});
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
		return  {
			attr: {
			  data: `${objectURL}#view=FitH&toolbar=0`,
			  type: 'application/pdf',
			  class: 'block-lanuage-latex',
			  style: `width:100%; aspect-ratio:${ratio}`
			}
		};
	}

	svgToHtml(svg: any) {
		if (this.settings.invertColorsInDarkMode) {
			svg = this.colorSVGinDarkMode(svg);
		}
		return svg;
	}
	
	async getPdfDimensions(pdf: any): Promise<{width: number, height: number}> {
		const pdfDoc = await PDFDocument.load(pdf);
		const firstPage = pdfDoc.getPages()[0];
		const {width, height} = firstPage.getSize();
		return {width, height};
	}

	pdfToSVG(pdfData: any) {
		return PdfToCairo().then((pdftocairo: any) => {
			pdftocairo.FS.writeFile('input.pdf', pdfData);
			pdftocairo._convertPdfToSvg();
			let svg = pdftocairo.FS.readFile('input.svg', {encoding:'utf8'});

			// Generate a unique ID for each SVG to avoid conflicts
			const id = Md5.hashStr(svg.trim()).toString();
			const randomString = Math.random().toString(36).substring(2, 10);
			const uniqueId = id.concat(randomString);
			const svgoConfig =  {
				plugins: ['sortAttrs', { name: 'prefixIds', params: { prefix: uniqueId } }]
			};
			// @ts-ignore
			svg = optimize(svg, svgoConfig).data; 

			return svg;
	});
	}

	colorSVGinDarkMode(svg: string) {
		// Replace the color "black" with currentColor (the current text color)
		// so that diagram axes, etc are visible in dark mode
		// And replace "white" with the background color

		svg = svg.replace(/rgb\(0%, 0%, 0%\)/g, "currentColor")
				.replace(/rgb\(100%, 100%, 100%\)/g, "var(--background-primary)");

		return svg;
	}


	async renderLatexToElement(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext, outputSVG: boolean = false) {
		return new Promise<void>((resolve, reject) => {
			let md5Hash = this.hashLatexSource(source);
			let pdfPath = path.join(this.cacheFolderPath, `${md5Hash}.pdf`);

			// PDF file has already been cached
			// Could have a case where pdfCache has the key but the cached file has been deleted
			if (this.settings.enableCache && this.cache.has(md5Hash) && fs.existsSync(pdfPath)) {
				// console.log("Using cached PDF: ", md5Hash);
				let pdfData = fs.readFileSync(pdfPath);
				if (outputSVG) {
					this.pdfToSVG(pdfData).then((svg: string) => { el.innerHTML = this.svgToHtml(svg);})
				} else {
					this.pdfToHtml(pdfData).then((htmlData)=>{el.createEl("object", htmlData); resolve();});
				}
				this.addFileToCache(md5Hash, ctx.sourcePath);
				resolve();
			}
			else {
				// console.log("Rendering PDF: ", md5Hash);

				this.renderLatexToPDF(source, md5Hash).then((r: any) => {
					if (this.settings.enableCache) this.addFileToCache(md5Hash, ctx.sourcePath);
					if (outputSVG) {
						this.pdfToSVG(r.pdf).then((svg: string) => { el.innerHTML = this.svgToHtml(svg);})
					} else {
						this.pdfToHtml(r.pdf).then((htmlData)=>{el.createEl("object", htmlData); resolve();});
					}
					fs.writeFileSync(pdfPath, r.pdf);
					resolve();
				}
				).catch(err => { 
					let errorDiv = el.createEl('div', { text: `${err}`, attr: { class: 'block-latex-error' } });
					reject(err); 
				});				
			}
		}).then(() => { 
			this.pdfEngine.flushCache();
			if (this.settings.enableCache) setTimeout(() => this.cleanUpCache(), 1000);
		});
	}

	renderLatexToPDF(source: string, md5Hash: string) {
		return new Promise(async (resolve, reject) => {
			source = this.formatLatexSource(source);

			temp.mkdir("obsidian-swiftlatex-renderer", async (err, dirPath) => {
				
				try {
					await waitFor(() => {
						return this.pdfEngine.isReady()
					})
				} catch (err) {
					reject(err);
					return;
				}

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
			// get diffs
			let merged = {...r[1], ...r[3]};
			const newFileNames = this.getNewPackageFileNames(this.settings.packageCache[1], merged);
			console.log(newFileNames);
			// fetch new package files
			this.pdfEngine.fetchTexFiles(newFileNames, this.packageCacheFolderPath);
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
				if (file instanceof TFile) {
					await this.removeUnusedCachesForFile(file);
				}
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
	plugin: SwiftlatexRenderPlugin;

	constructor(app: App, plugin: SwiftlatexRenderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

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
			.setDesc("PDFs rendered by this plugin will be kept in {config directory}/swiftlatex-render-cache/pdf-cache, where the config directory is .obsidian by default. The plugin will automatically keep track of used pdfs and remove any that aren't being used")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCache)
				.onChange(async (value) => {
					this.plugin.settings.enableCache = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName('Invert dark colors in dark mode')
		.setDesc('Invert dark colors in diagrams (e.g. axes, arrows) when in dark mode, so that they are visible.')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.invertColorsInDarkMode)
			.onChange(async (value) => {
				this.plugin.settings.invertColorsInDarkMode = value;

				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('Only render in Reading mode')
		.setDesc('Codeblocks are rendered into LaTeX only in Reading mode, not in Preview mode, requires reload to take effect.')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.onlyRenderInReadingMode)
			.onChange(async (value) => {
				this.plugin.settings.onlyRenderInReadingMode = value;

				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
			.setName('LaTeX Compiler')
			.setDesc('LaTeX Compiler type to use, package caches are not shared between compilers, please reload and delete your package cache upon switching')
			.addDropdown(dropdown => {
				dropdown.addOption('PdfTeX', 'PdfTeX');
				dropdown.addOption('XeTeX', 'XeTeX');
				if (this.plugin.settings.compiler === 0) {
					dropdown.setValue('PdfTeX')
				} else {
					dropdown.setValue('XeTeX')
				}
				dropdown.onChange(async (value) => {
					if (value === 'PdfTeX') {
						this.plugin.settings.compiler = CompilerType.PdfTeX;
					}
					if (value === 'XeTeX') {
						this.plugin.settings.compiler = CompilerType.XeTeX;
					}
					await this.plugin.saveSettings();
		})});
	}
}

