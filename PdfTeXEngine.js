"use strict";
// @ts-nocheck
/********************************************************************************
 * Copyright (C) 2019 Elliott Wen.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.PdfTeXEngine = exports.CompileResult = exports.EngineStatus = void 0;
var EngineStatus;
(function (EngineStatus) {
    EngineStatus[EngineStatus["Init"] = 1] = "Init";
    EngineStatus[EngineStatus["Ready"] = 2] = "Ready";
    EngineStatus[EngineStatus["Busy"] = 3] = "Busy";
    EngineStatus[EngineStatus["Error"] = 4] = "Error";
})(EngineStatus = exports.EngineStatus || (exports.EngineStatus = {}));
var fs = require("fs");
var path = require("path");
var swiftlatexpdftex_worker_js_1 = require("./swiftlatexpdftex.worker.js");
var texlivedownload_js_1 = require("./texlivedownload.js"); //should just build and save these...
var obsidian_1 = require("obsidian");
var CompileResult = /** @class */ (function () {
    function CompileResult() {
        this.pdf = undefined;
        this.status = -254;
        this.log = 'No log';
    }
    return CompileResult;
}());
exports.CompileResult = CompileResult;
var PdfTeXEngine = /** @class */ (function () {
    function PdfTeXEngine() {
        this.latexWorker = undefined;
        this.latexWorkerStatus = EngineStatus.Init;
        this.filenameToPackageIndex = {};
        this.packageToPathIndex = {};
    }
    PdfTeXEngine.prototype.downloadCTANFiles = function (filename) {
        return __awaiter(this, void 0, void 0, function () {
            var filedatas, url, response, text, pkg, filepaths;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(filename === "swiftlatexpdftex.fmt")) return [3 /*break*/, 3];
                        filedatas = new Map();
                        console.log("downloading", filename);
                        url = "https://github.com/gboyd068/Texlive-Ondemand/raw/refs/heads/master/swiftlatexpdftex.fmt";
                        return [4 /*yield*/, (0, obsidian_1.requestUrl)(url)];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.arrayBuffer];
                    case 2:
                        text = _a.sent();
                        filedatas.set(filename, text);
                        return [2 /*return*/, filedatas];
                    case 3:
                        pkg = this.filenameToPackageIndex[filename];
                        if (pkg === undefined) {
                            return [2 /*return*/];
                        }
                        filepaths = this.packageToPathIndex[pkg];
                        return [4 /*yield*/, (0, texlivedownload_js_1.fetchTeXLiveFiles)(pkg, filename)];
                    case 4: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    PdfTeXEngine.prototype.loadEngine = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (this.latexWorker !== undefined) {
                            throw new Error('Other instance is running, abort()');
                        }
                        this.latexWorkerStatus = EngineStatus.Init;
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                _this.latexWorker = (0, swiftlatexpdftex_worker_js_1["default"])();
                                _this.latexWorker.onmessage = function (ev) {
                                    var data = ev['data'];
                                    var cmd = data['result'];
                                    if (cmd === 'ok') {
                                        _this.latexWorkerStatus = EngineStatus.Ready;
                                        resolve();
                                    }
                                    else {
                                        _this.latexWorkerStatus = EngineStatus.Error;
                                        reject();
                                    }
                                };
                            })];
                    case 1:
                        _c.sent();
                        // move this to somewhere less error-prone and allow caching
                        console.log("building TeXLive lookups");
                        _a = this;
                        return [4 /*yield*/, (0, texlivedownload_js_1.buildPackageToPathIndex)()];
                    case 2:
                        _a.packageToPathIndex = _c.sent();
                        console.log("requested Url");
                        _b = this;
                        return [4 /*yield*/, (0, texlivedownload_js_1.buildFilenameToPackageIndex)(this.packageToPathIndex)];
                    case 3:
                        _b.filenameToPackageIndex = _c.sent();
                        console.log("Finished building TeXLive lookups");
                        this.latexWorker.onmessage = function (_) { };
                        this.latexWorker.onerror = function (_) { };
                        return [2 /*return*/];
                }
            });
        });
    };
    PdfTeXEngine.prototype.isReady = function () {
        return this.latexWorkerStatus === EngineStatus.Ready;
    };
    PdfTeXEngine.prototype.checkEngineStatus = function () {
        if (!this.isReady()) {
            throw Error('Engine is still spinning or not ready yet!');
        }
    };
    PdfTeXEngine.prototype.compileLaTeX = function () {
        return __awaiter(this, void 0, void 0, function () {
            var start_compile_time, res;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.checkEngineStatus();
                        this.latexWorkerStatus = EngineStatus.Busy;
                        start_compile_time = performance.now();
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                _this.latexWorker.onmessage = function (ev) { return __awaiter(_this, void 0, void 0, function () {
                                    var data, cmd, result, log, status_1, nice_report, pdf, filename, id, filedatas, error_1;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                data = ev['data'];
                                                cmd = data['cmd'];
                                                if (!(cmd === "compile")) return [3 /*break*/, 1];
                                                result = data['result'];
                                                log = data['log'];
                                                status_1 = data['status'];
                                                this.latexWorkerStatus = EngineStatus.Ready;
                                                console.log('Engine compilation finish ' + (performance.now() - start_compile_time));
                                                nice_report = new CompileResult();
                                                nice_report.status = status_1;
                                                nice_report.log = log;
                                                if (result === 'ok') {
                                                    pdf = new Uint8Array(data['pdf']);
                                                    nice_report.pdf = pdf;
                                                    resolve(nice_report);
                                                }
                                                else if (result === 'failed') {
                                                    nice_report.status = status_1;
                                                    nice_report.log = log;
                                                    reject(nice_report);
                                                }
                                                return [3 /*break*/, 5];
                                            case 1:
                                                if (!(cmd === "downloadFromCTAN")) return [3 /*break*/, 5];
                                                filename = data.filename;
                                                id = data.id;
                                                console.log("main trying to download files related to", filename, "id:", id);
                                                _a.label = 2;
                                            case 2:
                                                _a.trys.push([2, 4, , 5]);
                                                return [4 /*yield*/, this.downloadCTANFiles(filename)];
                                            case 3:
                                                filedatas = _a.sent();
                                                // if (filedatas === undefined) throw Error(`no filedata received for ${filename}`);
                                                this.latexWorker.postMessage({ cmd: "sendCTANFiles", id: id, result: filedatas, error: false });
                                                return [3 /*break*/, 5];
                                            case 4:
                                                error_1 = _a.sent();
                                                this.latexWorker.postMessage({ cmd: "sendCTANFiles", id: id, result: undefined, error: error_1 });
                                                return [3 /*break*/, 5];
                                            case 5: return [2 /*return*/];
                                        }
                                    });
                                }); };
                                _this.latexWorker.postMessage({ 'cmd': 'compilelatex' });
                                console.log('Engine compilation start');
                            })];
                    case 1:
                        res = _a.sent();
                        this.latexWorker.onmessage = function (_) { };
                        return [2 /*return*/, res];
                }
            });
        });
    };
    /* Internal Use */
    PdfTeXEngine.prototype.compileFormat = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this.checkEngineStatus();
                this.latexWorkerStatus = EngineStatus.Busy;
                new Promise(function (resolve, reject) {
                    _this.latexWorker.onmessage = function (ev) {
                        var data = ev['data'];
                        var cmd = data['cmd'];
                        if (cmd !== "compile")
                            return;
                        var result = data['result'];
                        var log = data['log'];
                        // const status: number = data['status'] as number;
                        _this.latexWorkerStatus = EngineStatus.Ready;
                        if (result === 'ok') {
                            var formatArray = data['pdf']; /* PDF for result */
                            var formatBlob = new Blob([formatArray], { type: 'application/octet-stream' });
                            var formatURL_1 = URL.createObjectURL(formatBlob);
                            setTimeout(function () { URL.revokeObjectURL(formatURL_1); }, 30000);
                            console.log('Download format file via ' + formatURL_1);
                            resolve();
                        }
                        else {
                            reject(log);
                        }
                    };
                    _this.latexWorker.postMessage({ 'cmd': 'compileformat' });
                });
                this.latexWorker.onmessage = function (_) { };
                return [2 /*return*/];
            });
        });
    };
    PdfTeXEngine.prototype.fetchCacheData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                            _this.latexWorker.onmessage = function (ev) {
                                var data = ev['data'];
                                var cmd = data['cmd'];
                                if (cmd !== 'fetchcache')
                                    return;
                                var result = data['result'];
                                var texlive404_cache = data['texlive404_cache'];
                                var texlive200_cache = data['texlive200_cache'];
                                var pk404_cache = data['pk404_cache'];
                                var pk200_cache = data['pk200_cache'];
                                if (result === 'ok') {
                                    resolve([texlive404_cache, texlive200_cache, pk404_cache, pk200_cache]);
                                }
                                else {
                                    reject('failed to fetch cache data');
                                }
                            };
                            _this.latexWorker.postMessage({ 'cmd': 'fetchcache' });
                        })];
                    case 1:
                        res = _a.sent();
                        this.latexWorker.onmessage = function (_) { };
                        return [2 /*return*/, res];
                }
            });
        });
    };
    PdfTeXEngine.prototype.writeCacheData = function (texlive404_cache, texlive200_cache, pk404_cache, pk200_cache) {
        this.checkEngineStatus();
        if (this.latexWorker !== undefined) {
            this.latexWorker.postMessage({ 'cmd': 'writecache', 'texlive404_cache': texlive404_cache, 'texlive200_cache': texlive200_cache, 'pk404_cache': pk404_cache, 'pk200_cache': pk200_cache });
        }
    };
    PdfTeXEngine.prototype.fetchTexFiles = function (filenames, host_dir) {
        return __awaiter(this, void 0, void 0, function () {
            var resolves, promises;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        resolves = new Map();
                        this.latexWorker.onmessage = function (ev) {
                            var data = ev['data'];
                            var cmd = data['cmd'];
                            if (cmd !== "fetchfile")
                                return;
                            var result = data['result'];
                            var fileContent = new Uint8Array(data['content']);
                            var fname = data['filename'];
                            // write fetched file
                            fs.writeFileSync(path.join(host_dir, fname), fileContent);
                            if (result === 'ok') {
                                // Resolve the Promise for this file
                                resolves.get(fname)();
                            }
                            else {
                                console.log("Failed to fetch ".concat(fname, " from memfs"));
                            }
                        };
                        promises = filenames.map(function (filename) { return new Promise(function (resolve) {
                            resolves.set(filename, resolve);
                            _this.latexWorker.postMessage({ 'cmd': 'fetchfile', 'filename': filename });
                        }); });
                        // Wait for all Promises to resolve
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        // Wait for all Promises to resolve
                        _a.sent();
                        this.latexWorker.onmessage = function (_) { };
                        return [2 /*return*/];
                }
            });
        });
    };
    PdfTeXEngine.prototype.writeTexFSFile = function (filename, srccode) {
        this.checkEngineStatus();
        if (this.latexWorker !== undefined) {
            this.latexWorker.postMessage({ 'cmd': 'writetexfile', 'url': filename, 'src': srccode });
        }
    };
    PdfTeXEngine.prototype.setEngineMainFile = function (filename) {
        this.checkEngineStatus();
        if (this.latexWorker !== undefined) {
            this.latexWorker.postMessage({ 'cmd': 'setmainfile', 'url': filename });
        }
    };
    PdfTeXEngine.prototype.writeMemFSFile = function (filename, srccode) {
        this.checkEngineStatus();
        if (this.latexWorker !== undefined) {
            this.latexWorker.postMessage({ 'cmd': 'writefile', 'url': filename, 'src': srccode });
        }
    };
    PdfTeXEngine.prototype.makeMemFSFolder = function (folder) {
        this.checkEngineStatus();
        if (this.latexWorker !== undefined) {
            if (folder === '' || folder === '/') {
                return;
            }
            this.latexWorker.postMessage({ 'cmd': 'mkdir', 'url': folder });
        }
    };
    PdfTeXEngine.prototype.flushCache = function () {
        this.checkEngineStatus();
        if (this.latexWorker !== undefined) {
            // console.warn('Flushing');
            this.latexWorker.postMessage({ 'cmd': 'flushcache' });
        }
    };
    PdfTeXEngine.prototype.setTexliveEndpoint = function (url) {
        if (this.latexWorker !== undefined) {
            this.latexWorker.postMessage({ 'cmd': 'settexliveurl', 'url': url });
        }
    };
    PdfTeXEngine.prototype.closeWorker = function () {
        if (this.latexWorker !== undefined) {
            this.latexWorker.postMessage({ 'cmd': 'grace' });
            this.latexWorker = undefined;
        }
    };
    return PdfTeXEngine;
}());
exports.PdfTeXEngine = PdfTeXEngine;
module.exports = { PdfTeXEngine: PdfTeXEngine };
