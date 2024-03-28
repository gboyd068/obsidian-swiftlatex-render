# Obsidian SwiftLaTeX Renderer

This plugin renders codeblocks with the label `latex` into a pdf, or into svg when using the label `latexsvg`. This is achieved using the SwiftLaTeX wasm LaTeX compiler built into the plugin, which has no other dependencies. Packages are fetched on-demand from https://texlive2.swiftlatex.com/, by default.
The plugin additionally uses the poppler utility `pdftocairo` compiled to wasm to support converting pdf to svg.

# Setup
Select the plugin from the community plugins in obsidian, or if you want to install from this repository, just place the files from the release into the folder `.obsidian/plugins/swiftlatex-render`, and make sure that the plugin is enabled in the 'Community plugins' tab of the settings.

# Usage
The content inside of the supported code blocks will be rendered using the given command. You can load any packages you need with `\usepackage{}`, it may take longer to compile a given codeblock for the first time as packages may need to be downloaded.

The generated pdf's `<div>` parent has the class `block-language-latex`, so it can be styled using CSS snippets. For example, if you are using dark mode you can set `filter: invert(100%)` to invert the colours for a quick hack for dark themed diagrams.
The generated svg's parent has the class `block-lanuage-latexsvg`.

## Examples:

<details>

<img src="https://github.com/gboyd068/obsidian-swiftlatex-render/blob/master/examples/scrollable_sample.png?raw=true" width="60%" display="block" margin="auto">

<details>
<summary>Codeblock</summary>

Using codeblock type `latex`
```
\documentclass[]{article}

%%%%%%%%%%%%%%%%%%%
% Packages/Macros %
%%%%%%%%%%%%%%%%%%%
\usepackage{amssymb,latexsym,amsmath}     % Standard packages


%%%%%%%%%%%
% Margins %
%%%%%%%%%%%
\addtolength{\textwidth}{1.0in}
\addtolength{\textheight}{1.00in}
\addtolength{\evensidemargin}{-0.75in}
\addtolength{\oddsidemargin}{-0.75in}
\addtolength{\topmargin}{-.50in}


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Theorem/Proof Environments %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\newtheorem{theorem}{Theorem}
\newenvironment{proof}{\noindent{\bf Proof:}}{$\hfill \Box$ \vspace{10pt}}  


%%%%%%%%%%%%
% Document %
%%%%%%%%%%%%
\begin{document}

\title{Sample \LaTeX ~File}
\author{David P. Little}
\maketitle

\begin{abstract}
This document represents the output from the file ``sample.tex" once compiled using your favorite \LaTeX compiler.  This file should serve as a good example of the basic structure of a ``.tex" file as well as many of the most basic commands needed for typesetting documents involving mathematical symbols and expressions.  For more of a description on how each command works, please consult the links found on our course webpage.
\end{abstract}


\section{Lists}
%%%%%%%%%%%%%%%
\begin{enumerate}
\item {\bf First Point (Bold Face)}
\item {\em Second Point (Italic)}
\item {\Large Third Point (Large Font)}
    \begin{enumerate}
        \item {\small First Subpoint (Small Font)} 
        \item {\tiny Second Subpoint (Tiny Font)} 
        \item {\Huge Third Subpoint (Huge Font)} 
    \end{enumerate}
\item[$\bullet$] {\sf Bullet Point (Sans Serif)}
\item[$\circ$] {\sc Circle Point (Small Caps)} 
\end{enumerate}


\section{Equations}
%%%%%%%%%%%%%%%%%%%

\subsection{Binomial Theorem}
\begin{theorem}[Binomial Theorem]
For any nonnegative integer $n$, we have
$$(1+x)^n = \sum_{i=0}^n {n \choose i} x^i$$
\end{theorem}

\subsection{Taylor Series}
The Taylor series expansion for the function $e^x$ is given by
\begin{equation}
e^x = 1 + x + \frac{x^2}{2} + \frac{x^3}{6} + \cdots = \sum_{n\geq 0} \frac{x^n}{n!}
\end{equation}


\subsection{Sets}

\begin{theorem}
For any sets $A$, $B$ and $C$, we have
$$ (A\cup B)-(C-A) = A \cup (B-C)$$
\end{theorem}

\begin{proof}
\begin{eqnarray*}
(A\cup B)-(C-A) &=& (A\cup B) \cap (C-A)^c\\
&=& (A\cup B) \cap (C \cap A^c)^c \\
&=& (A\cup B) \cap (C^c \cup A) \\
&=& A \cup (B\cap C^c) \\
&=& A \cup (B-C)
\end{eqnarray*}
\end{proof}


\section{Tables}
%%%%%%%%%%%%%%%%
\begin{center}
\begin{tabular}{l||c|r}
left justified & center & right justified \\ \hline
1 & 3.14159 & 5 \\
2.4678 & 3 &  1234 \\ \hline \hline
3.4678 & 6.14159 & 1239
\end{tabular}
\end{center}


\section{A Picture}
%%%%%%%%%%%%%%%%%%%
\begin{center}
\begin{picture}(100,100)(0,0)
\setlength{\unitlength}{1pt}
\put(20,70){\circle{30}}  \put(20,70){\circle*{10}}   % left eye
\put(80,70){\circle{30}}  \put(80,70){\circle*{10}}   % right eye
\put(40,40){\line(1,2){10}} \put(60,40){\line(-1,2){10}} \put(40,40){\line(1,0){20}} % nose
\put(50,20){\oval(80,10)[b]} % mouth
\multiput(0,90)(4,0){10}{\line(1,3){4}}  % left eyebrow
\multiput(100,90)(-4,0){10}{\line(-1,3){4}}  % right eyebrow
\end{picture}
\end{center}


\end{document}
```
</details>

<img src="https://github.com/gboyd068/obsidian-swiftlatex-render/blob/master/examples/caffeine.png?raw=true" width="100%" display="block" margin="auto">

<details>
  <summary>Codeblock</summary>

Using codeblock type `latexsvg`
```
\documentclass{standalone}
\usepackage{chemfig}
\begin{document}
\hspace{3cm}
\chemfig{*6((=O)-N(-H)-(*5(-N=-N(-H)-))=-(=O)-N(-H)-)}
\hspace{3cm}
\end{document}
```

Note the use of `\hspace` to add whitespace either side of the diagram to reduce the displayed size in obsidian.
</details>

<img src="https://github.com/gboyd068/obsidian-swiftlatex-render/blob/master/examples/lindenmayer.png?raw=true" width="80%" display="block" margin="auto">

<details>
  <summary>Codeblock</summary>

Using codeblock type `latexsvg`
```
% Lindenmayer systems
% Dec 18, 2011, Stefan Kottwitz
% http://texblog.net
\documentclass{standalone}
\usepackage{tikz}
\usetikzlibrary{lindenmayersystems}
\usetikzlibrary[shadings]
\begin{document}
\pgfdeclarelindenmayersystem{Koch curve}{
  \rule{F -> F-F++F-F}}
\pgfdeclarelindenmayersystem{Sierpinski triangle}{
  \rule{F -> G-F-G}
  \rule{G -> F+G+F}}
\pgfdeclarelindenmayersystem{Fractal plant}{
  \rule{X -> F-[[X]+X]+F[+FX]-X}
  \rule{F -> FF}}
\pgfdeclarelindenmayersystem{Hilbert curve}{
  \rule{L -> +RF-LFL-FR+}
  \rule{R -> -LF+RFR+FL-}}
%\hspace*{-4cm}
\begin{tabular}{cc}
\begin{tikzpicture}
\shadedraw[shading=color wheel] 
[l-system={Koch curve, step=2pt, angle=60, axiom=F++F++F, order=4}]
lindenmayer system -- cycle;
\end{tikzpicture}
&
\begin{tikzpicture}
\shadedraw [top color=white, bottom color=blue!80, draw=blue!80!black]
[l-system={Sierpinski triangle, step=2pt, angle=60, axiom=F, order=8}]
lindenmayer system -- cycle;
\end{tikzpicture}
\\
\begin{tikzpicture}
    \shadedraw [bottom color=white, top color=red!80, draw=red!80!black]
    [l-system={Hilbert curve, axiom=L, order=5, step=8pt, angle=90}]
    lindenmayer system; 
\end{tikzpicture}
&
\begin{tikzpicture}
    \draw [green!50!black, rotate=90]
    [l-system={Fractal plant, axiom=X, order=6, step=2pt, angle=25}]
    lindenmayer system; 
\end{tikzpicture}
\end{tabular}
\end{document}
```
</details>

</details>

# Limitations
- All the code required to render the document must be contained within the code block, meaning that any images, \includes etc will not work

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

## FAQ

**Q: How can I solve package.sty is not found?**

**A:** If you are getting package not found errors, it is possible that the package you want is not available at https://texlive2.swiftlatex.com/ .
If this happens, you can download the `package.sty` file and place it in the package cache directory, which is `.obsidian/swiftlatex-render-cache/package-cache` by default.
After restarting obsidian, this package will be available to the compiler.

**Q: Why do pdfs created with the `latex` codeblock not appear when I export to pdf?**

**A:** The embedded pdfs created with a `latex` codeblock are interactive (you can scroll and zoom etc), so there is no simple way to statically export them into another pdf. Instead use a `latexsvg` codeblock to produce the first page of the document as svg, this will then appear in the exported pdf.

**Q: How can I resize the svg output?**

**A:** The plugin automatically resizes the view of the svg to fit into the correct width for the note, so uniformly resizing a diagram in `\documentclass{standalone}` will not work.
However, this can be solved within the latex code by adding horizontal spacing around the diagram (see the molecular diagram example above).

**Q: I have just pasted some valid latex into obsidian, why isn't it working?**

**A:** Extra newlines are sometimes added when you paste into obsidian, causing the latex compilation to fail. Pasting as plaintext (right click and select paste as plain text) has solved this problem in all the examples tested so far.

**Q: Why do some svgs not appear correctly in reading mode or when exported to pdf?**

**A:** I don't actually know the answer to this unfortunately, but the same thing happens with diagrams produced by the obsidian-tikzjax plugin, and this plugin uses a different utility to generate svgs than the tikzjax plugin, so it seems like it might be a bug in the obsidian export to pdf process. Maybe try alternative export tools and see if they work.




# Acknowledgements
Thanks to `fenjalien` who created https://github.com/fenjalien/obsidian-latex-render which this plugin is based on, and to all contributors to [SwiftLaTeX](https://github.com/SwiftLaTeX/SwiftLaTeX).

# TODO
- Support for mobile?

