# Obsidian SwiftLaTeX Renderer

This plugin renders codeblocks with the label `latex` into a pdf, or into svg when using the label `latexsvg`. This is achieved using the SwiftLaTeX wasm LaTeX compiler built into the plugin, which has no other dependencies. Packages are fetched on-demand from https://texlive2.swiftlatex.com/, by default.
The plugin additionally uses the poppler utility `pdftocairo` compiled to wasm to support converting pdf to svg.

# Setup
Just place the files from the release into the folder `.obsidian/plugins/swiftlatex-render`, and make sure that the plugin is enabled in the 'Community plugins' tab of the settings.

# Usage
The content inside of the supported code blocks will be rendered using the given command. You can load any packages you need with `\usepackage{}`, it may take longer to compile a given codeblock for the first time as packages may need to be downloaded.

The generated pdf's `<div>` parent has the class `block-language-latex`, so it can be styled using CSS snippets. For example, if you are using dark mode you can set `filter: invert(100%)` to invert the colours for a quick hack for dark themed diagrams.
The generated svg's parent has the class `block-lanuage-latexsvg`.

# Limitations
- Currently, all the code required to render the document must be contained within the code block.

# Caching

### pdfs
By default the plugin will keep generated `.pdf` files in `.obsidian/swiftlatex-render-cache/pdf-cache` so it won't have to re-render if nothing in the code block has changed, or you copy the code block to a different file, the plugin will simply reuse the `.pdf` file. It'll keep track of which files use each `.pdf` and when no files use a `.pdf` the plugin removes it from the cache.

### Packages
The plugin also caches used packages in `.obsidian/swiftlatex-render-cache/package-cache`, loading the packages back into the virtual file system used by the WebAssembly on startup

# Self-Hosting Packages
You can host your own package server using the repo at https://github.com/SwiftLaTeX/Texlive-Ondemand , which might be required if using very recent packages as the default url uses a slightly outdated version of TeX Live

# Building from source
1. follow the instructions in https://github.com/gboyd068/SwiftLaTeX to use Emscripten to build `swiftlatexpdftex.worker.js` within the `pdftex.wasm` directory (currently only PdfTeX is supported)
2. Within that repo, run `tsc PdfTeXEngine.tsx` to build `PdfTeXEngine.js` from the Typescript source
3. Clone this repository `git clone https://github.com/gboyd068/obsidian-swiftlatex-render`
and copy the two output files mentioned above into the `obsidian-swiftlatex-render` directory
4. Install the necessary node packages with `npm i`
5. Build `main.js` with `npm run build`

# Acknowledgements
Thanks to `fenjalien` who created https://github.com/fenjalien/obsidian-latex-render which this plugin is based on, and to all contributors to [SwiftLaTeX](https://github.com/SwiftLaTeX/SwiftLaTeX).

# TODO
- Support for mobile? At least viewing cached pdfs
- Support for images
- Support for bibliographies
- Support for `\input`

