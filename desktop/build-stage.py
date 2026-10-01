"""Build an offline desktop payload; never include private fixtures or browser data."""
from pathlib import Path
import json,shutil,os,sys,hashlib,re
app=Path(__file__).resolve().parents[1]
import argparse,subprocess
parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
args=parser.parse_args()
build=Path(args.output).resolve()
if build.exists() and any(build.iterdir()):raise ValueError('Choose a new empty build directory')
version=json.loads((app/'package.json').read_text(encoding='utf-8'))['version']
files=json.loads((app/'desktop/app-files.json').read_text(encoding='utf-8'))
if len(files)!=len(set(files)):raise ValueError('Duplicate application file')
stage=build/'payload'
stage.mkdir(parents=True,exist_ok=True)
for name in files:
    source=(app/name).resolve()
    if not source.is_relative_to(app) or name.startswith(('.', '/')) or any(part.startswith('.') for part in Path(name).parts):raise ValueError('Unsafe application path: '+name)
    if not source.is_file():raise ValueError('Missing application file: '+name)
    dest=stage/'app'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
for p in (app/'node_modules').iterdir():
    if p.name.startswith('.'):continue
    if p.is_dir():shutil.copytree(p,stage/'app/node_modules'/p.name,dirs_exist_ok=True,symlinks=False,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
node=Path(os.environ['WHO_NODE_RUNTIME'])
py=Path(os.environ['WHO_PYTHON_RUNTIME'])
(stage/'runtime/node').mkdir(parents=True,exist_ok=True)
shutil.copy2(node,stage/'runtime/node/node.exe');shutil.copy2(Path(os.environ['WHO_NODE_LICENSE']),stage/'runtime/node/LICENSE.txt')
(stage/'runtime/python').mkdir(parents=True,exist_ok=True)
for p in py.iterdir():
    if p.is_file() and (p.suffix in ('.exe','.dll') or p.name=='LICENSE.txt'):shutil.copy2(p,stage/'runtime/python'/p.name)
for folder in ['Lib','DLLs']:
    shutil.copytree(py/folder,stage/'runtime/python'/folder,dirs_exist_ok=True,ignore=shutil.ignore_patterns('site-packages','__pycache__','*.pyc','test','tests','idlelib','tkinter','turtledemo','ensurepip','_tkinter.pyd'))
shutil.copy2(app/'public/favicon.ico',stage/'fimi.ico')
(stage/'desktop-install.marker').write_text('FIMI desktop '+version+'\n',encoding='utf-8')
shutil.copy2(app/'LICENSE',stage/'LICENSE.txt')
(stage/'使用说明.txt').write_text('FIMI '+version+' 桌面启动版\n\n双击桌面图标打开。窗口使用 Microsoft Edge；未安装 Edge 时会使用默认浏览器。\n解析服务仅监听本机。关闭窗口后可从系统托盘再次打开；托盘菜单“退出 FIMI”关闭后台服务。\n程序自带 Node.js 和 Python，无须另装开发环境。GitHub 登录、收藏云同步和有限 AI 试用已配置。云服务需要网络可达，免费服务可能不稳定；本地解析与本地收藏可离线使用。可从 Windows“已安装的应用”或开始菜单卸载。\n收藏保存在使用的浏览器里；此前 Codex 内置浏览器的收藏不会自动迁移。卸载不清空浏览器收藏。\n本安装包尚未进行商业代码签名，Windows 可能显示“未知发布者”。\n',encoding='utf-8-sig')
files=[p for p in stage.rglob('*') if p.is_file()]
assert not any(p.is_symlink() for p in stage.rglob('*'))
for p in files:
    if p.suffix in ('.js','.py','.ps1','.md','.txt','.json') and 'node_modules' not in p.parts and 'runtime' not in p.parts:
        text=p.read_text(encoding='utf-8-sig',errors='replace')
        if re.search(r'[A-Za-z]:[/\\]+Users[/\\]+[^/\\\s]+[/\\]',text) or '.codex/attachments' in text:raise ValueError('Personal path in '+str(p))
print(json.dumps({'files':len(files),'bytes':sum(p.stat().st_size for p in files),'node':subprocess.check_output([str(node),'--version'],text=True).strip(),'python':subprocess.check_output([str(py/'python.exe'),'--version'],text=True).strip()}))
