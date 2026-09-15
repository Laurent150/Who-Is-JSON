// Inspect the outer language, not source embedded in quoted command arguments.
function shellEvidence(code){
 if(/^\s*#![^\n]*\b(?:bash|sh|zsh|dash)\b/.test(code))return true;
 let masked='',quote='',comment=false,escape=false;
 for(const c of code){if(comment){if(c==='\n'){comment=false;masked+='\n';}else masked+=' ';continue;}if(escape){masked+=c==='\n'?'\n':' ';escape=false;continue;}if(c==='\\'){escape=true;masked+=' ';continue;}if(quote){if(c===quote)quote='';masked+=c==='\n'?'\n':' ';continue;}if(c==='"'||c==="'"||c==='`'){quote=c;masked+=' ';continue;}if(c==='#'){comment=true;masked+=' ';continue;}masked+=c;}
 const first=masked.split('\n').find(l=>l.trim())||'';
 return /^\s*(?:if\s+(?:\[|!?\s*command\s)|(?:for|while|until)\s|(?:export|local|readonly)\s|[A-Za-z_]\w*\s*=)/.test(first)&&(/;\s*(?:then|do)\b|^\s*(?:fi|done)\s*;?\s*$/m.test(masked)||/^\s*(?:export|local)\s/.test(first));
}
module.exports={shellEvidence};
