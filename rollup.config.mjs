import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { wasm } from '@rollup/plugin-wasm';

export default {
  input: 'main.ts',
  output: {
    dir: 'output',
    format: 'cjs'
  },
  plugins: [
    nodeResolve(),
    typescript(),
    wasm()]
};