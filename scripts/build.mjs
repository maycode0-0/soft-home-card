import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEVICES} from '../src/model.js';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const art={};
for(const name of Object.keys(DEVICES)){
  const source=fs.readFileSync(path.join(root,'assets/devices',name+'.svg'),'utf8').replace(/\r\n/g,'\n').trim();
  if(!source.startsWith('<svg ') || /<(script|foreignObject)\b/i.test(source) || /\son\w+\s*=/i.test(source) || /(?:href|src)=['"](?:https?:|data:|javascript:)/i.test(source)) throw new Error('Invalid local illustration: '+name);
  art[name]=source;
}
const generated='// Generated from assets/devices. Do not edit by hand.\nexport const ART = '+JSON.stringify(art)+';\n';
fs.writeFileSync(path.join(root,'src/art.js'),generated);
const readSource=name=>fs.readFileSync(path.join(root,'src',name),'utf8').replace(/\r\n/g,'\n').replace(/^import .*?;\n/gm,'').replace(/^export /gm,'');
const sharedParts=['art.js','washer-fields.js','device-fields.js','model.js','washer.js','devices.js','device-layouts.js','motion.js','styles.js','washer-styles.js','device-styles.js','compact-styles.js','card.js'].map(readSource);
const cardParts=['editor-model.js','picker.js','editor.js','register-card.js'].map(readSource);
const output='/* Soft Home Card v'+pkg.version+' | No runtime dependencies | Local SVG artwork */\n(() => {\n'+"'use strict';\n"+sharedParts.concat(cardParts).join('\n')+'\n})();\n';
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/soft-home-card.js'),output);
console.log('Built '+Object.keys(art).length+' illustrations, '+(Buffer.byteLength(output)/1024).toFixed(1)+' KiB, v'+pkg.version+'.');
const dialogParts=['more-info-model.js','more-info-styles.js','more-info.js'].map(readSource);
const dialogOutput='/* Soft Home More Info v'+pkg.version+' | Optional global entity dialogs | No runtime dependencies */\n(() => {\n'+"'use strict';\n"+sharedParts.concat(dialogParts).join('\n')+'\n})();\n';
fs.writeFileSync(path.join(root,'dist/soft-home-more-info.js'),dialogOutput);
console.log('Built global more-info add-on, '+(Buffer.byteLength(dialogOutput)/1024).toFixed(1)+' KiB.');
