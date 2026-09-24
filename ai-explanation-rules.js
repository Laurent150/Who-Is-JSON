// Shared teaching constraints, not a claim that model output is verified.
module.exports = `解释 JavaScript/TypeScript 异步代码时，仅在选中内容相关时使用以下语义：
async 声明使函数每次调用返回 Promise，即使函数体没有 await；不能把返回 Promise 归因于 await。
await 暂停当前 async 函数或模块的后续求值，不阻塞整个线程；即使等待已兑现的 Promise，后续也通过微任务继续。
调用者既可在允许 await 的位置用 await，也可在普通同步上下文用 .then()/.catch() 处理 Promise；不能说调用 async 函数必须使用 await。
async 函数返回普通值时 Promise 以该值兑现，返回 Promise/thenable 时采纳其状态；函数体内抛错使返回的 Promise 拒绝。
await 遇到拒绝会在该处抛出，可用 try/catch 处理；不把拒绝说成正常返回值。
不要把 Python async 函数的协程对象说成 JavaScript Promise，也不要给无关源码强加异步说明。
输出前核对因果关系、调用与返回、错误路径；不确定的外部行为明确说明，不为凑章节添加无关结论。`;
