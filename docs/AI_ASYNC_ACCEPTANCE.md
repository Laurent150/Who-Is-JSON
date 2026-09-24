# 异步解释人工回归

这些自编样本只用于静态阅读，不执行。修改解释规则或更换模型后，使用有效配置分别检查总览、选行解释和讲解稿。真实调用会计费，不纳入默认测试。

| 输入 | 必须讲对 | 不应出现 |
| --- | --- | --- |
| `async function value() { return 3; }` | 调用返回 Promise，兑现值为 3，即使没有 await | 因为 await 才返回 Promise；直接返回数字 |
| `async function double(x) { const y = await Promise.resolve(x * 2); return y; }` | async 决定返回 Promise；await 暂停该函数后续求值 | 阻塞整个线程；必须 await 才能调用 |
| `async function value() { return 3; } value().then(x => console.log(x));` | 普通上下文也可通过 then 消费结果；推演输出 3 | 调用方必须声明 async |
| `async function fail() { throw new Error('oops'); } fail().catch(e => console.log(e.message));` | 返回的 Promise 拒绝，catch 处理错误 | 同步返回 Error；正常兑现 |
| `async function recover() { try { await Promise.reject('oops'); } catch (e) { return e; } }` | await 在拒绝处抛出，catch 后返回的 Promise 兑现为 oops | 一定向调用方拒绝；永远成功 |
| `function value() { return 3; }` | 普通函数返回数字 | 套用 async/Promise 行为 |

另用 Python `async def value(): return 3` 检查是否区分协程对象与 JavaScript Promise。

每项记录模型、日期、操作入口、原始回答和是否通过。不要用关键词命中替代语义复核，也不要因为提示词测试通过而宣称真实模型正确。

取消回归：选行解释 → 立即停止 → 应显示“已停止生成，源码未修改，可以重试。”；重试应成功。停止后晚到的回复不得进入结果或缓存。超时应显示超时提示，服务端错误应保留对应信息。
