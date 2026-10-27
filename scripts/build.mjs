import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEVICES} from '../src/model.js';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const art={};
for(const name of Object.keys(DEVICES)){
  const source=fs.readFileSync(path.join(root,'assets/devices',name+'.svg'),'utf8').trim();
  if(!source.startsWith('<svg ') || /<(script|foreignObject)\b/i.test(source) || /\son\w+\s*=/i.test(source) || /(?:href|src)=['"](?:https?:|data:|javascript:)/i.test(source)) throw new Error('Invalid local illustration: '+name);
  art[name]=source;
}
const generated='// Generated from assets/devices. Do not edit by hand.\nexport const ART = '+JSON.stringify(art)+';\n';
fs.writeFileSync(path.join(root,'src/art.js'),generated);
const parts=['art.js','model.js','styles.js','editor-model.js','picker.js','editor.js','card.js'].map(name=>fs.readFileSync(path.join(root,'src',name),'utf8').replace(/\r\n/g,'\n').replace(/^import .*?;\n/gm,'').replace(/^export /gm,''));
const output='/* Soft Home Card v'+pkg.version+' | No runtime dependencies | Local SVG artwork */\n(() => {\n'+"'use strict';\n"+parts.join('\n')+'\n})();\n';
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/soft-home-card.js'),output);
console.log('Built '+Object.keys(art).length+' illustrations, '+(Buffer.byteLength(output)/1024).toFixed(1)+' KiB, v'+pkg.version+'.');
