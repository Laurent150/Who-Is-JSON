# 中英文真实 AI 验收记录（2026-09-28）

后续修正与定向复测见 [修正后验收](BILINGUAL_TARGETED_ACCEPTANCE.md)。以下保留原批次结果和当时的限制。

结论：本轮真实连接与批量调用已完成，但讲解质量未通过发布验收。不能把请求成功率当作解释准确率，也不能承诺零基础用户一定能正确理解。

## 本轮范围

- 模型：用户配置的 deepseek-flash，经软件原有 analyze / flow / ask / talk 接口调用。
- 40 份固定 Git commit 的真实源文件，8 个开源项目；Python、JavaScript、TypeScript、Java 各 10 份。源码保持原字节，保存 SHA-256、源地址、LICENSE 和已有 NOTICE，仅静态分析，未执行第三方源码。
- 人工选择的复杂度分布：复杂 23、中等 12、简单 5。文件为 15–1281 行；复杂度是选样标签，不是自动测量值。
- 总览、流程、选中语句、词语／符号点读、讲解稿各 8 份样本；每份运行中文／英文 × 零基础／标准模式。讲解稿固定为零基础受众、简要、全部主要功能；readingMode 单独变化。
- 30 份开发集共 120 次，10 份留出集共 40 次；本轮测试期间没有修改模型提示词，也没有重试失败调用。留出集已被检查，后续若据此调优，必须使用新的留出集评估泛化。

## 实际结果

160 个不同组合全部产生记录：157 次返回结果，3 次因输出长度限制失败。开发集 118/120 返回结果，留出集 39/40 返回结果。这些数字只表示请求可用性。

长度失败：js-04 中文零基础、js-04 英文标准、py-10 英文标准。另有 py-02 中文零基础的一个流程节点未得到解释。

按关键语义点对 40 份样本作了源码对照抽查，重点检查英文零基础结果，并抽查中文、标准模式和容易说反的分支。目前记录 26 条事实、上下文、教学表达或功能覆盖问题；这不是全部问题数量，也不是 160 条逐句人工审定的通过率。没有真实零基础用户的可理解性评测，也没有对接账单统计实际费用。

## 必须说明的测试偏差

本轮测试器在选中语句和点读请求中复用了中文提问，未使用英文界面的已翻译提问；这一偏差在运行中被发现。15 个英文语句解释返回了中文，因此只能作为“英文系统指令＋中文提问”的语言约束压力测试失败，不能据此断言正常英文界面也有同样的 15 次失败。其他接口没有这个提问字段。

已修正后续测试器：默认 ui 协议使用与界面逐字一致的英文提问，并新增离线回归校验；旧协议命名为 zh-stress，旧结果保留且不混入新协议结果。修正后的 ui 协议尚未重新进行付费调用，本轮不能充当完整英文界面的最终验收。

## 优先修正方向

1. 先处理事实边界：条件正反、交集端点、显式参数优先级、Python 协程与 JavaScript Promise 的区别，以及异常发生时清理代码是否真的执行。不能仅靠把术语写得更简单来掩盖事实错误。
2. 让解释紧扣节点对应的源码片段，避免把外层函数初始化当成内层步骤；流程说明缺失时明确展示缺口，不能静默当作完整结果。
3. 总览优先覆盖主要函数，避免 12 个名额被 import 和嵌套条件占满；Java interface 方法的解析覆盖也需补齐。
4. 零基础稿按实际任务分成短段，首次出现的必要术语就地说明，避免把代码标识符串成自然语言；中英文采用同一事实与教学标准。
5. 修复后先用准确复现界面请求的 ui 协议做定向复测，再使用新留出样本评估，不能沿用这轮响应成功数作为通过依据。

## 自动化检查

本轮全量 265 项自动测试与 19 份公开样本检查通过。新增的 2 项测试检查中英文提问与实际界面一致，以及样本矩阵、固定提交、哈希格式和位置约定。这些是软件回归检查，不能代替真实讲解的语义验收。未重测安装包或 Windows 原生界面。

## 可复现方式

普通测试不会调用付费模型。下载步骤只取固定版本和校验原字节，不运行样本。

```sh
node tests/prepare-bilingual-corpus.cjs
node tests/live-bilingual-server.cjs
```

打开本机 43148 验收页，由用户亲自填写密钥并保存，再显式启动测试。默认 ui 协议写入 `.browser-artifacts/bilingual-live-ui/`。`WHO_EVAL_PROFILE=zh-stress` 才复现旧中文提问协议并写入 `.browser-artifacts/bilingual-live/`。不要把密钥写进命令行、环境文件或报告。旧测试进程仍运行时必须先关闭，否则端口占用。

```sh
node tests/summarize-bilingual-live.cjs ui
# 本轮旧协议结果
node tests/summarize-bilingual-live.cjs zh-stress
```

原始回复、错误、基线脚本和实现文件指纹保存在本机 `.browser-artifacts/bilingual-live/`，不纳入版本控制。测试结束后已通过验收页清除本轮内存密钥。

## 具体问题记录

### F01 · py-01 · zh-CN / standard · factual

Calls hostname.endswith a prefix comparison and describes the added dot as removed.

核对依据：utils.py:853-859 uses exact match then adds a dot for suffix matching.

### F02 · py-04 · en / beginner · factual

Summary says missing attribute and item access both fall back to None.

核对依据：structures.py:108-121 raises AttributeError for missing attribute; item lookup returns None.

### F03 · py-05 · en / beginner · factual

This line checks that nothing was returned before replacing hook_data reverses the is not None condition.

核对依据：hooks.py:46-47 replaces only a non-None callback result.

### F04 · py-03 · en / standard · factual

Says set_cookie strips leading and trailing double quotes.

核对依据：cookies.py:388 replaces escaped quotes inside the string; it does not strip delimiters.

### F05 · js-02 · en / standard · factual

Example explicitly passes UTC but says the offset and resulting zone are New York.

核对依据：timezone/index.js:137 gives arg1 precedence over defaultTimezone.

### F06 · js-02 · en / beginner · factual

Says subtracting the smaller offset picks the earlier UTC time.

核对依据：timezone/index.js:90 yields the larger timestamp for a smaller offset.

### F07 · js-06 · en / beginner · scope

Explains plugin setup as occurring when the file loads, and assigns setup lines to nodes inside fromToBase.

核对依据：relativeTime/index.js:3 exports a function; selected function is lines22-71, not setup lines4-21.

### F08 · js-07 · en / beginner · factual

Says absent date/month fields refer to now and all final variables have numeric values.

核对依据：objectSupport/index.js:20-22 sometimes defaults day to1/month to0, and does not guarantee numeric types. Response is also Chinese.

### F09 · ts-01 · en / beginner · factual

Opening says all paths eventually call schema._zod.run, contradicting its later explanation of compiled validate shortcut.

核对依据：parse.ts:142-148 can return directly from compiled validator result.

### F10 · ts-06 · en / beginner · coverage

Walkthrough omits primitive fallback String(a)===String(b), a core loose comparison rule.

核对依据：looseEqual.ts:118 handles values such as1 and string1.

### F11 · ts-07 · en / beginner · factual

Says empty-string concatenation works for any type.

核对依据：escapeHtml.ts:4 attempts coercion; a Symbol value or throwing coercion can fail.

### F12 · ts-03 · en / beginner · factual

Says a non-number takes the !version branch.

核对依据：regexes.ts:33 checks falsiness, not numeric type; a nonempty string is truthy.

### F13 · java-02 · en / beginner · clarity

In both cases, the cause is passed to launderException can incorrectly include cancellation from preceding sentence.

核对依据：Memoizer.java:149-155 cancellation removes and loops; execution failure throws.

### F14 · js-05 · zh-CN / beginner · pedagogy

Uses empty value for falsy without covering false/0.

核对依据：Falsy and nullish/empty are different concepts; concise wording should preserve deciding condition.

### F15 · ts-04 · zh-CN / beginner · pedagogy

Uses has a value for hit truthiness, obscuring cached empty string recomputation.

核对依据：general.ts:100 evaluates the right side for an empty cached string.

### F16 · py-03 · en / beginner · pedagogy

Brief beginner walkthrough contains long identifier-heavy sections with many unexplained terms.

核对依据：Examples include CookieJar, MutableMapping, Morsel, tuple, pickling; some sections exceed110 words.

### F17 · ts-01 · en / beginner · pedagogy

Beginner walkthrough adds3 unsolicited questions and leaves Promise/getter/context/stack trace vocabulary largely unexplained.

核对依据：Beginner contract asks questions:[] and plain-language first use.

### F18 · js-04 · en / beginner · coverage

Overview spends its12 block slots on setup/helper/condition blocks and omits purpose annotations for core duration conversion/arithmetic methods.

核对依据：This is output-selection coverage risk, not evidence the entire file was explained.

### F19 · java-07 · zh-CN / beginner · factual

Explains intersection as smaller lower bound and larger upper bound, reversing both endpoints.

核对依据：Range.java:481-483 uses larger lower bound and smaller upper bound; standard Chinese response is correct.

### F20 · java-03 · en / beginner · coverage

12 overview annotation slots are consumed by imports, class/builder and setters, with acquire/tryAcquire/shutdown unannotated.

核对依据：Summary covers main topic but cannot substitute for missing primary function purpose annotations.

### F21 · py-08 · en / beginner · factual

Says an async Python Queue.put caller receives a Promise resolving to None.

核对依据：queues.py:125 defines async def; Python returns a coroutine object, not a JavaScript Promise.

### F22 · py-09 · en / beginner · factual

Hypothetical generator prints done after yield without try/finally, but explanation guarantees printing it when with body raises.

核对依据：contextlib.py injects the body exception at yield; unprotected statements after yield can be skipped.

### F23 · js-09 · en / beginner · factual

Says asynchronous errors only surface when awaited.

核对依据：The Promise may be handled by then/catch or become an unhandled rejection; await is not required.

### F24 · ts-10 · en / beginner · context

Explains inherited keys as potentially counted by this returned lookup without tying back to its null-prototype map.

核对依据：makeMap.ts:11 uses Object.create(null), so this freshly closed-over map has no inherited properties.

### F25 · java-09 · en / beginner · coverage

Only2 import blocks have overview annotations; the predicate interface and its methods are absent from parser blocks.

核对依据：Static analysis.json for java-09 and returned blocks. This is a parser coverage issue, not simply model translation.

### F26 · java-08 · en / beginner · pedagogy

Long sections restate signatures and exception classes with limited plain-language definitions; first section overgeneralizes wrapped exceptions before later acknowledging NullPointerException.

核对依据：SerializationUtils.java:163,200,278 null checks occur outside the wrapping try/catch.

## 源码清单

| 样本 | 语言 | 功能 | 复杂度 | 阶段 | 固定源码 |
|---|---|---|---|---|---|
| py-01 | Python | selection | high | development | [psf/requests/src/requests/utils.py](https://github.com/psf/requests/blob/611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60/src/requests/utils.py) |
| py-02 | Python | flow | high | development | [psf/requests/src/requests/auth.py](https://github.com/psf/requests/blob/611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60/src/requests/auth.py) |
| py-03 | Python | talk | high | development | [psf/requests/src/requests/cookies.py](https://github.com/psf/requests/blob/611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60/src/requests/cookies.py) |
| py-04 | Python | overview | medium | development | [psf/requests/src/requests/structures.py](https://github.com/psf/requests/blob/611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60/src/requests/structures.py) |
| py-05 | Python | token | low | development | [psf/requests/src/requests/hooks.py](https://github.com/psf/requests/blob/611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60/src/requests/hooks.py) |
| py-06 | Python | selection | high | development | [psf/requests/src/requests/sessions.py](https://github.com/psf/requests/blob/611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60/src/requests/sessions.py) |
| py-07 | Python | token | high | development | [psf/requests/src/requests/models.py](https://github.com/psf/requests/blob/611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60/src/requests/models.py) |
| py-08 | Python | flow | high | holdout | [python/cpython/Lib/asyncio/queues.py](https://github.com/python/cpython/blob/db3ffd065ca31e3c0c7c3a4f313102b3e3564fb9/Lib/asyncio/queues.py) |
| py-09 | Python | talk | high | holdout | [python/cpython/Lib/contextlib.py](https://github.com/python/cpython/blob/db3ffd065ca31e3c0c7c3a4f313102b3e3564fb9/Lib/contextlib.py) |
| py-10 | Python | overview | high | holdout | [python/cpython/Lib/concurrent/futures/thread.py](https://github.com/python/cpython/blob/db3ffd065ca31e3c0c7c3a4f313102b3e3564fb9/Lib/concurrent/futures/thread.py) |
| js-01 | JavaScript | flow | high | development | [iamkun/dayjs/src/plugin/customParseFormat/index.js](https://github.com/iamkun/dayjs/blob/436bde0bcded312781cbe45dc2b0ef079a36d8e3/src/plugin/customParseFormat/index.js) |
| js-02 | JavaScript | talk | high | development | [iamkun/dayjs/src/plugin/timezone/index.js](https://github.com/iamkun/dayjs/blob/436bde0bcded312781cbe45dc2b0ef079a36d8e3/src/plugin/timezone/index.js) |
| js-03 | JavaScript | selection | high | development | [iamkun/dayjs/src/plugin/utc/index.js](https://github.com/iamkun/dayjs/blob/436bde0bcded312781cbe45dc2b0ef079a36d8e3/src/plugin/utc/index.js) |
| js-04 | JavaScript | overview | high | development | [iamkun/dayjs/src/plugin/duration/index.js](https://github.com/iamkun/dayjs/blob/436bde0bcded312781cbe45dc2b0ef079a36d8e3/src/plugin/duration/index.js) |
| js-05 | JavaScript | token | low | development | [iamkun/dayjs/src/plugin/isBetween/index.js](https://github.com/iamkun/dayjs/blob/436bde0bcded312781cbe45dc2b0ef079a36d8e3/src/plugin/isBetween/index.js) |
| js-06 | JavaScript | flow | medium | development | [iamkun/dayjs/src/plugin/relativeTime/index.js](https://github.com/iamkun/dayjs/blob/436bde0bcded312781cbe45dc2b0ef079a36d8e3/src/plugin/relativeTime/index.js) |
| js-07 | JavaScript | selection | medium | development | [iamkun/dayjs/src/plugin/objectSupport/index.js](https://github.com/iamkun/dayjs/blob/436bde0bcded312781cbe45dc2b0ef079a36d8e3/src/plugin/objectSupport/index.js) |
| js-08 | JavaScript | talk | high | development | [sindresorhus/p-limit/index.js](https://github.com/sindresorhus/p-limit/blob/a8a6fbec4e0e866d6d779b10889bb4f5567e70eb/index.js) |
| js-09 | JavaScript | overview | medium | holdout | [jprichardson/node-jsonfile/index.js](https://github.com/jprichardson/node-jsonfile/blob/0bb6b41beb950fa65b8e20a569e84e14acc136e6/index.js) |
| js-10 | JavaScript | token | low | holdout | [jprichardson/node-jsonfile/utils.js](https://github.com/jprichardson/node-jsonfile/blob/0bb6b41beb950fa65b8e20a569e84e14acc136e6/utils.js) |
| ts-01 | TypeScript | talk | high | development | [colinhacks/zod/packages/zod/src/v4/core/parse.ts](https://github.com/colinhacks/zod/blob/2bf7b0630d5378033e90bcee82cb32b0fe04628e/packages/zod/src/v4/core/parse.ts) |
| ts-02 | TypeScript | selection | high | development | [colinhacks/zod/packages/zod/src/v4/core/util.ts](https://github.com/colinhacks/zod/blob/2bf7b0630d5378033e90bcee82cb32b0fe04628e/packages/zod/src/v4/core/util.ts) |
| ts-03 | TypeScript | overview | high | development | [colinhacks/zod/packages/zod/src/v4/core/regexes.ts](https://github.com/colinhacks/zod/blob/2bf7b0630d5378033e90bcee82cb32b0fe04628e/packages/zod/src/v4/core/regexes.ts) |
| ts-04 | TypeScript | token | medium | development | [vuejs/core/packages/shared/src/general.ts](https://github.com/vuejs/core/blob/4ab865a848a1da3d10fb674f857e5fff13094644/packages/shared/src/general.ts) |
| ts-05 | TypeScript | flow | medium | development | [vuejs/core/packages/shared/src/normalizeProp.ts](https://github.com/vuejs/core/blob/4ab865a848a1da3d10fb674f857e5fff13094644/packages/shared/src/normalizeProp.ts) |
| ts-06 | TypeScript | talk | high | development | [vuejs/core/packages/shared/src/looseEqual.ts](https://github.com/vuejs/core/blob/4ab865a848a1da3d10fb674f857e5fff13094644/packages/shared/src/looseEqual.ts) |
| ts-07 | TypeScript | flow | medium | development | [vuejs/core/packages/shared/src/escapeHtml.ts](https://github.com/vuejs/core/blob/4ab865a848a1da3d10fb674f857e5fff13094644/packages/shared/src/escapeHtml.ts) |
| ts-08 | TypeScript | token | medium | development | [vuejs/core/packages/shared/src/toDisplayString.ts](https://github.com/vuejs/core/blob/4ab865a848a1da3d10fb674f857e5fff13094644/packages/shared/src/toDisplayString.ts) |
| ts-09 | TypeScript | selection | medium | holdout | [vuejs/core/packages/shared/src/codeframe.ts](https://github.com/vuejs/core/blob/4ab865a848a1da3d10fb674f857e5fff13094644/packages/shared/src/codeframe.ts) |
| ts-10 | TypeScript | overview | low | holdout | [vuejs/core/packages/shared/src/makeMap.ts](https://github.com/vuejs/core/blob/4ab865a848a1da3d10fb674f857e5fff13094644/packages/shared/src/makeMap.ts) |
| java-01 | Java | flow | high | development | [apache/commons-lang/src/main/java/org/apache/commons/lang3/concurrent/AtomicSafeInitializer.java](https://github.com/apache/commons-lang/blob/29624cdb50ecd794207d561345b2fc9ca3a9d326/src/main/java/org/apache/commons/lang3/concurrent/AtomicSafeInitializer.java) |
| java-02 | Java | talk | high | development | [apache/commons-lang/src/main/java/org/apache/commons/lang3/concurrent/Memoizer.java](https://github.com/apache/commons-lang/blob/29624cdb50ecd794207d561345b2fc9ca3a9d326/src/main/java/org/apache/commons/lang3/concurrent/Memoizer.java) |
| java-03 | Java | overview | high | development | [apache/commons-lang/src/main/java/org/apache/commons/lang3/concurrent/TimedSemaphore.java](https://github.com/apache/commons-lang/blob/29624cdb50ecd794207d561345b2fc9ca3a9d326/src/main/java/org/apache/commons/lang3/concurrent/TimedSemaphore.java) |
| java-04 | Java | selection | high | development | [apache/commons-lang/src/main/java/org/apache/commons/lang3/concurrent/EventCountCircuitBreaker.java](https://github.com/apache/commons-lang/blob/29624cdb50ecd794207d561345b2fc9ca3a9d326/src/main/java/org/apache/commons/lang3/concurrent/EventCountCircuitBreaker.java) |
| java-05 | Java | token | medium | development | [apache/commons-lang/src/main/java/org/apache/commons/lang3/math/IEEE754rUtils.java](https://github.com/apache/commons-lang/blob/29624cdb50ecd794207d561345b2fc9ca3a9d326/src/main/java/org/apache/commons/lang3/math/IEEE754rUtils.java) |
| java-06 | Java | flow | high | development | [apache/commons-lang/src/main/java/org/apache/commons/lang3/builder/ReflectionDiffBuilder.java](https://github.com/apache/commons-lang/blob/29624cdb50ecd794207d561345b2fc9ca3a9d326/src/main/java/org/apache/commons/lang3/builder/ReflectionDiffBuilder.java) |
| java-07 | Java | selection | medium | development | [apache/commons-lang/src/main/java/org/apache/commons/lang3/Range.java](https://github.com/apache/commons-lang/blob/29624cdb50ecd794207d561345b2fc9ca3a9d326/src/main/java/org/apache/commons/lang3/Range.java) |
| java-08 | Java | talk | high | holdout | [apache/commons-lang/src/main/java/org/apache/commons/lang3/SerializationUtils.java](https://github.com/apache/commons-lang/blob/29624cdb50ecd794207d561345b2fc9ca3a9d326/src/main/java/org/apache/commons/lang3/SerializationUtils.java) |
| java-09 | Java | overview | medium | holdout | [apache/commons-lang/src/main/java/org/apache/commons/lang3/function/FailablePredicate.java](https://github.com/apache/commons-lang/blob/29624cdb50ecd794207d561345b2fc9ca3a9d326/src/main/java/org/apache/commons/lang3/function/FailablePredicate.java) |
| java-10 | Java | token | low | holdout | [apache/commons-lang/src/main/java/org/apache/commons/lang3/mutable/MutableInt.java](https://github.com/apache/commons-lang/blob/29624cdb50ecd794207d561345b2fc9ca3a9d326/src/main/java/org/apache/commons/lang3/mutable/MutableInt.java) |

## 上游许可

源码归各上游项目所有。下载器保留固定提交中的 LICENSE 及已有 NOTICE；详细文件哈希见 tests/live-bilingual-cases.json。

- [psf/requests 许可](https://github.com/psf/requests/blob/611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60/LICENSE)
- [python/cpython 许可](https://github.com/python/cpython/blob/db3ffd065ca31e3c0c7c3a4f313102b3e3564fb9/LICENSE)
- [iamkun/dayjs 许可](https://github.com/iamkun/dayjs/blob/436bde0bcded312781cbe45dc2b0ef079a36d8e3/LICENSE)
- [sindresorhus/p-limit 许可](https://github.com/sindresorhus/p-limit/blob/a8a6fbec4e0e866d6d779b10889bb4f5567e70eb/license)
- [jprichardson/node-jsonfile 许可](https://github.com/jprichardson/node-jsonfile/blob/0bb6b41beb950fa65b8e20a569e84e14acc136e6/LICENSE)
- [colinhacks/zod 许可](https://github.com/colinhacks/zod/blob/2bf7b0630d5378033e90bcee82cb32b0fe04628e/LICENSE)
- [vuejs/core 许可](https://github.com/vuejs/core/blob/4ab865a848a1da3d10fb674f857e5fff13094644/LICENSE)
- [apache/commons-lang 许可](https://github.com/apache/commons-lang/blob/29624cdb50ecd794207d561345b2fc9ca3a9d326/LICENSE.txt)
