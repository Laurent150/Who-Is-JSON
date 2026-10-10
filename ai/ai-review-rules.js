// Check obligations, not model verdicts or inferred runtime facts.
const rules=[
 {id:'LOGIC-01',kinds:['branch','logic','comparison'],en:'Compare the exact condition, grouping, comparison boundary and body action. Independent if statements are not an exclusive chain. Preserve short-circuiting and negation.',zh:'逐项核对真实条件、分组、比较边界和分支动作，保留短路与否定；独立if不能解释成互斥链。'},
 {id:'RETURN-01',kinds:['function','return','await','yield'],en:'Trace each returned expression and its owner. Distinguish function factories, immediate results, later completion, await and yield. A non-async function can pass through a Promise; annotations do not prove runtime types. A Python coroutine is not a JavaScript Promise.',zh:'沿每个返回表达式及所属函数核对，区分函数工厂、立即结果、稍后完成、await和yield；非async可原样返回Promise，注解不证明运行类型，Python协程不等于JavaScript Promise。'},
 {id:'LOOP-01',kinds:['loop','break','continue'],en:'Follow the actual loop header, updates and early exits. Recheck the continuation condition before promising another iteration; explicit arguments can differ from defaults. Nested functions do not inherit execution of an outer loop.',zh:'沿实际循环头、更新及提前退出核对；再次执行前须检查继续条件，显式参数不受默认值限制；内层函数不继承外层循环的执行关系。'},
 {id:'ERROR-01',kinds:['try','throw'],en:'Locate each operation inside or outside protected, handler, else and finally regions. Preserve caught error categories. A handler need not continue, and finally may replace an earlier completion. Missing dependency behavior remains unknown.',zh:'核对运算在保护体、处理体、else及finally内外的位置，保留捕获类别；处理后未必继续，finally可能改变先前结果；缺失依赖行为仍未知。'},
 {id:'VALUE-01',kinds:['parameter','comparison','logic','branch'],en:'Preserve nullish, falsy, zero, empty text and whitespace distinctions for this language. Scope numeric and error guarantees to reached operations and actual guards; neither a comparison nor a type annotation proves complete input validation.',zh:'按当前语言区分空值、假值、零、空字符串与空格；数值和报错结论限定于实际运算和条件，比较或类型注解不证明已完整校验输入。'},
 {id:'SOURCE-01',kinds:null,en:'Use original source as authority. Syntax records do not prove reachability, runtime types, external implementation or timing. Trace supplied implementations before declaring them missing. Missing or limited evidence is not a passing check. Explain only the requested scope.',zh:'以原始源码为准；语法记录不证明可达性、运行类型、外部实现或时机。先追踪已有实现，不把已提供函数说成缺失；证据缺失或受限不等于检查通过；只解释请求范围。'}
];
function select(facts,locale) {
    return rules.flatMap(rule=>{
        const evidence=facts.filter(f=>rule.kinds?.includes(f.kind)).map(f=>f.id);
        return rule.kinds&&!evidence.length?[]:[{id:rule.id,evidence,requirement:locale==='en'?rule.en:rule.zh,status:'required-not-verified'}];
    });
}
module.exports={rules,select};
