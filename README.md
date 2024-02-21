# Obsidian SwiftLaTeX Renderer

This plugin renders codeblocks with the label `latex` into a pdf and displays them inline in the note on preview. This is achieved using the SwiftLaTeX wasm LaTeX compiler built into the plugin, which has no other dependencies. Packages are fetched on-demand from https://texlive2.swiftlatex.com/, by default.

# Setup
Just install the plugin!

# Usage
The content inside of `latex` code blocks will be rendered using the given command. You can load any packages you need with `\usepackage{}`.

The generated svg's `<div>` parent has the class `block-language-latex`, so it can be styled using CSS snippets. For example, if you are using dark mode you can set `filter: invert(100%)` to invert the colours for a quick hack for dark themed diagrams. You could also set `background-color: white`.

# Limitations
- Currently, all the code required to render the document must be contained within the `latex` code block.
- Currently the store of package files is removed when obsidian is closed

## Caching
By default the plugin will keep generated `.pdf` files in `.obsidian/obsidian-latex-render-pdf-cache/` so it won't have to re-render if nothing in the code block has changed, or you copy the code block to a different file, the plugin will simply reuse the `.pdf` file. It'll keep track of which files use each `.pdf` and when no files use a `.pdf` the plugin removes it from the cache.

# Self-Hosting Packages
You can host your own package server using the repo at https://github.com/SwiftLaTeX/Texlive-Ondemand , which might be required if using very recent packages as the default url uses a slightly outdated version of TeX Live

# Acknowledgements
Thanks to `fenjalien` who created https://github.com/fenjalien/obsidian-latex-render which this plugin is based on, and to all contributors to [SwiftLaTeX](https://github.com/SwiftLaTeX/SwiftLaTeX).

# TODO
- Cache package files, removing the need to redownload after obsidian has been closed
- Support for images
- Support for bibliographies
- Support for `\input`
- Support for mobile?
