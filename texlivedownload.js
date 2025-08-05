const path = require('path');
const readline = require('readline');
const { Readable } = require('stream');
import { XzReadableStream } from 'xz-decompress';
const tar = require('tar-stream');

async function buildPackageToPathIndex() {
  // needs error handling
  const index = {};
  const response = await requestUrl("https://mirror.ox.ac.uk/sites/ctan.org/systems/texlive/tlcontrib/tlpkg/texlive.tlpdb"); // store this??
  const tlpdbContent = await response.text;
  console.log("got texlive response text");
  var readStream = Readable.from(tlpdbContent)
  const rl = readline.createInterface({ input: readStream });

  let currentPkg = null;
  let inRunfiles = false;
  for await (const line of rl) {
    if (line.startsWith('name ')) {
      currentPkg = line.slice(5).trim();
      if (currentPkg === "cslatex") currentPkg = null; // HACK this package is disabled for pdflatex, TODO read the metadata to disable this properly
    } else if (line.startsWith('runfiles')) {
      inRunfiles = true;
    } else if (line.startsWith(' ')) {
      if (inRunfiles && currentPkg) {
        const f = line.trim();
        const base = path.basename(f);
        if (!(currentPkg in index)) index[currentPkg]=[];
        index[currentPkg].push(f.slice(6));
      }
    } else {
      inRunfiles = false;
    }
  }
  return index;
}

async function buildFilenameToPackageIndex(packageToPathIndex) {
  const invertedIndex = {};
  for (const pkg in packageToPathIndex) {
    for (const filePath of packageToPathIndex[pkg]) {
      const base = path.basename(filePath);
      invertedIndex[base] = pkg;
    }
  }
  return invertedIndex;
}

function webStreamToNodeStream(webStream) {
  const reader = webStream.getReader();
  return new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) this.push(null);
        else this.push(value);
      } catch (err) {
        this.destroy(err);
      }
    }
  });
}

async function retryRequestUrl(url, {
  retries = 6,
  timeoutMs = 5000,
  backoffFactor = 2,
  baseDelay = 500
} = {}) {
  let attempt = 0;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await requestUrl(url, { signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries) throw err;
      const delay = baseDelay * backoffFactor ** attempt;
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }
  }
}


async function extractTarXz(tarbuffer, filename) {
  
  const blob = new Blob([tarbuffer]);
  const tarstream = blob.stream();
  const decompressedStream = new XzReadableStream(tarstream)

  const extract = tar.extract();
  const filemap = new Map();

  let dStream = webStreamToNodeStream(decompressedStream)
  // console.log(dStream)
  dStream.pipe(extract)
  for await (const entry of extract) {
    let contentfname = path.basename(entry.header.name)
    // console.log(entry.header.name)
    if (filename === contentfname) {
      
      const chunks = []
      for await (const chunk of entry) chunks.push(chunk)
      const content = Buffer.concat(chunks)
      // console.log(content)
      filemap.set(filename, content);
    }
    entry.resume() // the entry is the stream also
  }
  return filemap;
}


async function fetchTeXLiveFiles(pkg, filename) {
  var zipUrl = `https://mirror.ox.ac.uk/sites/ctan.org/systems/texlive/tlnet/archive/${pkg}.tar.xz`; // TODO have some CTAN mirror checking system
  // yet another hack because the texlive source files aren't in the same place as the package files
  if (zipUrl === `https://mirror.ox.ac.uk/sites/ctan.org/systems/texlive/tlnet/archive/00texlive.image.tar.xz`) {
    zipUrl = "https://mirror.ox.ac.uk/sites/ctan.org/systems/texlive/Source/texlive-20250308-devsource.tar.xz"; // TODO dynamically fetch correct date
  }
  console.log(`Trying to download and extract from: ${zipUrl}`);

  try {
    console.log("trying tar download")
    const tarresponse = await retryRequestUrl(zipUrl);
    const tarbuffer = await tarresponse.arrayBuffer
    console.log("trying untar")
    const filemap = await extractTarXz(tarbuffer, filename)
    return filemap;
  } catch (e) {
    console.error(`Failed to extract from package ${pkg}: ${e.message}`);
  }
}



export {buildFilenameToPackageIndex, buildPackageToPathIndex, fetchTeXLiveFiles}