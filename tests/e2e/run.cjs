const cp=require('node:child_process'),path=require('node:path');
for(const script of ['check-merchant-operations.cjs','check-menu-picker.cjs','check-dietary-ui.cjs']){
 cp.execFileSync(process.execPath,[path.join(__dirname,script)],{stdio:'inherit'});
}
