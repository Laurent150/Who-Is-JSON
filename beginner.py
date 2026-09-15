"""Evidence-based beginner explanations. Parses source; never executes it."""
import ast, io, tokenize, keyword, builtins

AST_TYPES = {
 'Name': '代码里写出的名字，例如 price。它代表名字本身，不是 price 保存的金额。',
 'Constant': '直接写在代码里的值，例如数字 10 或文字 "你好"。',
 'BinOp': '左右两部分之间的一次运算，例如 price * discount。',
 'Add': '加号 + 对应的种类。', 'Sub': '减号 - 对应的种类。',
 'Mult': '乘号 * 对应的种类。', 'Div': '除号 / 对应的种类。',
 'Mod': '% 对应的运算种类；数值中常用于求余数，文字中可用于填入内容。',
 'FloorDiv': '// 对应的种类：相除后向下取整。',
 'parse': '把代码文字拆成结构化记录，方便程序逐个检查；这一步不会运行那段代码。'
}
BUILTINS = {
 'max': ('选择最大的一项。', 'max(1, 3) 得到 3。'),
 'min': ('选择最小的一项。', 'min(1, 3) 得到 1。'),
 'str': ('Python 自带的文字类型，也可以把值转成文字。', 'str(12) 得到文字 "12"。'),
 'range': ('提供一段整数序列，常用于重复处理；不包含终点。', 'list(range(3)) 得到 [0, 1, 2]。'),
 'dict': ('Python 自带的对应表类型，通过键查找值。', 'dict(name="小林") 创建一份含 name 的对应表。'),
 'list': ('Python 自带的列表类型，按顺序存放多项内容。', 'list(range(2)) 得到 [0, 1]。'),
 'isinstance': ('判断一个东西是不是指定的种类，结果是 True（是）或 False（不是）。', 'isinstance(3, int) 的结果是 True，因为 3 是整数。'),
 'repr': ('把一个值写成便于查看的文字形式；遇到文字时通常会保留引号。', 'repr("hi") 得到包含引号的文字：\'hi\'。'),
 'type': ('查看一个东西属于哪种类型，例如整数、文字，或某一种代码部件。', 'type(3) 得到 int，即整数这一类。'),
 'round': ('按指定精度四舍五入；具体结果还受数字表示方式影响。', 'round(12.34, 1) 得到 12.3。'),
 'print': ('把内容显示出来，方便人查看。', 'print("你好") 会显示：你好。'),
 'len': ('数一数有多少项。', 'len([10, 20]) 得到 2。'),
 'sum': ('把一组数加起来。', 'sum([10, 20]) 得到 30。'),
 'int': ('Python 提供的整数类型，也能在适用时把值转换为整数。', 'int("12") 得到数字 12。')
}
KEYWORDS = {'def':'开始定义一个可以再次使用的小功能。后面跟作者给它起的名字。',
 'if':'如果后面的判断成立，就做下面缩进的事情。',
 'return':'结束当前这次函数处理，并把后面的结果交还给调用它的地方。',
 'import':'引入已有工具，让后面的代码可以使用它。',
 'for':'从一组内容中逐个取出一项，重复做下面的事。',
 'in':'在 for 中指定从哪里逐项取值；在判断中检查是否包含某项。',
 'else':'前面的情况不成立时，走这里。', 'while':'只要条件仍然成立，就继续重复。'}

class Teacher:
 def __init__(self, source, tree):
  self.source=source;self.tree=tree;self.imports={};self.defs={};self.assignments=set()
  for n in ast.walk(tree):
   if isinstance(n,ast.Import):
    for a in n.names:self.imports[a.asname or a.name.split('.')[0]]=a.name
   elif isinstance(n,ast.ImportFrom):
    for a in n.names:self.imports[a.asname or a.name]=(n.module or '')+'.'+a.name
   elif isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):
    self.defs[n.name]=('作者定义的功能' if not isinstance(n,ast.ClassDef) else '作者定义的类',n.lineno)
   elif isinstance(n,ast.arg):self.defs[n.arg]=('作者命名的输入',n.lineno)
   elif isinstance(n,ast.Name) and isinstance(n.ctx,(ast.Store,ast.Del)):
    self.assignments.add(n.id);self.defs.setdefault(n.id,('作者命名的变量',n.lineno))
 def text(self,n):return ast.get_source_segment(self.source,n) or ''
 def builtin(self,name):return name not in self.defs and name not in self.imports
 def ast_type(self,n):
  if isinstance(n,ast.Attribute) and isinstance(n.value,ast.Name):
   if self.imports.get(n.value.id)=='ast' and n.value.id not in self.defs:return n.attr
  if isinstance(n,ast.Name) and n.id not in self.defs and self.imports.get(n.id,'').startswith('ast.'):
   return self.imports[n.id][4:]
  return None
 def words(self,n):
  if n is None:return 'None（没有明确的结果）'
  if isinstance(n,ast.BinOp) and isinstance(n.op,ast.Mod) and isinstance(n.left,ast.Constant) and isinstance(n.left.value,str):
   return '把右侧提供的内容依次填进左侧文字模板，组成一段文字（这里的 % 不是求余数）'
  if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='isinstance' and self.builtin('isinstance') and len(n.args)>=2:
   kind=self.ast_type(n.args[1]);label={'Name':'一个表示名字的代码部件，例如 price','Constant':'一个表示固定值的代码部件，例如 10','BinOp':'一个左右两边参与运算的代码部件，例如 a + b'}.get(kind)
   return '看看 %s 是不是%s'%(self.text(n.args[0]),label or self.text(n.args[1])+' 这一类东西')
  if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='repr' and self.builtin('repr') and n.args:
   return '把 %s 里的值写成便于查看的文字，文字值通常会带引号'%self.text(n.args[0])
  if isinstance(n,ast.Attribute):
   field={'id':'保存的名字文字','value':'保存的值','left':'运算左边的部分','right':'运算右边的部分','op':'运算符的种类'}.get(n.attr)
   if field and self.checked_receiver(n.value):return '读取 %s.%s；按这里的 ast 类型检查来理解，这是%s'%(self.text(n.value),n.attr,field)
  return None
 def has_ast_checks(self):
  return any(isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='isinstance' and self.builtin('isinstance') and len(n.args)>1 and self.ast_type(n.args[1]) for n in ast.walk(self.tree))
 def checked_receiver(self,value):
  return isinstance(value,ast.Name) and any(isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='isinstance' and self.builtin('isinstance') and len(n.args)>1 and isinstance(n.args[0],ast.Name) and n.args[0].id==value.id and self.ast_type(n.args[1]) for n in ast.walk(self.tree))
 def symbols(self,node):
  out={}
  def put(name,origin,meaning,rename,example=''):
   out[name]=dict(name=name,origin=origin,meaning=meaning,rename=rename,example=example)
  if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)):
   put(node.name,'作者起的名字','这一组处理步骤的名字。','可以改名，但对应的调用也要一起修改。')
  for n in ast.walk(node):
   name=n.id if isinstance(n,ast.Name) else n.arg if isinstance(n,ast.arg) else None
   if name:
    if name in self.defs:
     origin,line=self.defs[name]
     meaning=('接收调用者交给这个功能的一份东西；它具体是什么要结合使用位置判断。' if '输入' in origin else '在源码第 %s 行附近由作者定义，需结合赋值或定义理解用途。'%line)
     put(name,origin,meaning,'可以在对应作用范围内一起改名；不要只改其中一处。')
    elif name in self.imports:
     target=self.imports[name]
     meaning=('Python 自带的代码拆解工具。它把代码看成名字、数字、运算等部件，方便程序检查。' if target=='ast' else ('从 ast 工具中引入的名称：'+AST_TYPES.get(target[4:],target)) if target.startswith('ast.') else '从 '+target+' 引入的工具。仅凭导入语句不能确认其他工具的完整用途。')
     put(name,'导入的工具',meaning,'导入来源不能随意拼写；可以通过 as 起本地别名，并同步修改使用位置。')
    elif name in BUILTINS:
     meaning,example=BUILTINS[name];put(name,'Python 自带',meaning,'使用这个功能时按原名拼写。不要用同名变量覆盖它。',example)
    elif hasattr(builtins,name):put(name,'Python 自带','Python 内置的 '+name+'；详细用法尚未提供。','未被同名变量覆盖时可直接使用；请保持拼写。')
    elif not keyword.iskeyword(name):put(name,'来源待确认','当前片段没有找到它的定义或导入。','先找到定义再判断，不能确认能否改名。')
   kind=self.ast_type(n)
   if kind:put(self.text(n),'ast 工具提供',AST_TYPES.get(kind,'ast 工具中的一个名称，需要结合文档进一步了解。'),'点号后面的名称由工具规定，不能任意换词。')
   if isinstance(n,ast.Import):
    for a in n.names:
     name=a.asname or a.name
     if a.name=='ast':put(name,'Python 标准库','Python 随安装附带的代码拆解工具；import ast 让后面的代码可以使用它。','ast 是工具名称；可写 import ast as code_tools，再用 code_tools.Name 等名称。')
   if isinstance(n,ast.Attribute) and n.attr in ['id','value','left','right','op'] and self.checked_receiver(n.value):
    put(self.text(n),'对象里的信息',self.words(n),'点号左侧可能是作者起的名字；右侧是所用对象约定的信息名称，不能随意改。')
   if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='get' and isinstance(n.func.value,ast.Dict):
    put('.get','字典提供的功能','从“对应表”里查找一项；没找到时使用给出的备用内容。','这里的 get 是已有功能名，不能随意改。','{"+": "加上"}.get("?", "未知") 得到“未知”。')
  try:
   for t in tokenize.generate_tokens(io.StringIO(self.text(node)).readline):
    if t.type==tokenize.NAME and t.string in KEYWORDS:put(t.string,'Python 固定写法',KEYWORDS[t.string],'不能换成自起的名字，大小写也需要保持一致。')
  except (tokenize.TokenError,IndentationError):pass
  if any(isinstance(n,ast.Attribute) for n in ast.walk(node)):
   put('.','Python 语法符号','表示到左边的工具或对象里面，找右边那一项。例如 ast.Name 就是 ast 工具里的 Name。','点号在这里有固定作用；不是名字的一部分。')
  if any(isinstance(n,ast.BinOp) and isinstance(n.op,ast.Mod) and isinstance(n.left,ast.Constant) and isinstance(n.left.value,str) for n in ast.walk(node)):
   put('% / %s','文字格式写法','这段代码用 % 将内容填进文字，%s 是等待填入内容的位置。','不是变量名；改变占位符数量时也要调整提供的内容。','"%s 加上 %s" % ("2", "3") 得到“2 加上 3”。')
  return list(out.values())
 def decorate(self,n,block):
  block['symbols']=self.symbols(n)
  if isinstance(n,ast.If):
   w=self.words(n.test)
   if w:
    block['title']=w
    action=n.body[0] if n.body else None
    step=('把结果交回去：'+(self.words(action.value) or self.text(action.value))+'。' if isinstance(action,ast.Return) and action.value else '继续做下面缩进的几行。')
    block['purpose']=w+'。如果是，就'+step+'如果不是，就'+('处理 else 下面的内容。' if n.orelse else '跳过这几行，继续往下看。')
   block['inputs']='';block['output']='';block['usage']='';block['concept']='if 可以读成“如果”。它下面缩进的内容，就是条件成立时要做的事情。'
  if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)):
   inside=[c for c in ast.walk(n) if isinstance(c,ast.Call) and isinstance(c.func,ast.Name) and c.func.id==n.name]
   outside=[c for c in ast.walk(self.tree) if isinstance(c,ast.Call) and isinstance(c.func,ast.Name) and c.func.id==n.name and not (n.lineno<=c.lineno<=n.end_lineno)]
   if inside and not outside:
    block['usage']='这里看到的是 '+n.name+' 在自己的步骤里再次使用自己。它不是给新手的外部调用范例；当前片段没有展示别人第一次如何使用这个功能。'
    block['concept']='把大问题拆成更小的问题，再用同一个办法处理，叫作“递归”。这里的 '+n.name+' 在自己的代码里再次出现，就是需要留意的地方。'
   if any(isinstance(c,ast.Call) and isinstance(c.func,ast.Name) and c.func.id=='isinstance' and self.builtin('isinstance') and len(c.args)>1 and self.ast_type(c.args[1]) for c in ast.walk(n)):
    block['purpose']='先判断交进来的代码部件属于哪一类，再按对应情况处理。比如：名字、固定值、左右两边的运算会走不同的几行。下面的名称说明会解释每个判断用到的工具。'
    args=n.args.args
    if args:block['inputs']=args[0].arg+' 是作者给输入起的名字。这里的判断检查的是已经拆解好的代码部件，不能直接把一整段代码文字当作同一种东西。'
    block['example']='概念示例（不是当前函数已运行的结果）：\nast.parse("price + 2", mode="eval").body\n\n这会把“price + 2”拆成一个运算部件：左边是名字 price，右边是数字 2，中间是加号。\nast.parse 负责拆代码；当前函数负责接着处理拆出来的部件。'
  return block
