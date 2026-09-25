"""Generate exact uninstall inventory, retaining user-created files and logs."""
from pathlib import Path
import sys, json, hashlib
stage = Path(sys.argv[1]).resolve()
if not (stage / 'desktop-install.marker').is_file():
    raise SystemExit('Missing desktop staging marker')
files = sorted(p for p in stage.rglob('*') if p.is_file())
lines = ['; Remove only files shipped by this installer.']
for d in sorted({p.parent for p in files if p.suffix == '.py'}):
    rel = str(d.relative_to(stage)).replace('$', '$$')
    lines += [f'Delete "$INSTDIR\\{rel}\\__pycache__\\*.pyc"', f'RMDir "$INSTDIR\\{rel}\\__pycache__"']
for p in files:
    rel = str(p.relative_to(stage)).replace('$', '$$')
    lines.append(f'Delete "$INSTDIR\\{rel}"')
for p in sorted((p for p in stage.rglob('*') if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
    rel = str(p.relative_to(stage)).replace('$', '$$')
    lines.append(f'RMDir "$INSTDIR\\{rel}"')
(stage.parent / 'remove-files.nsh').write_text('\n'.join(lines), encoding='utf-8-sig')
manifest = {str(p.relative_to(stage)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(stage.parent / 'payload-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'Inventoried {len(files)} installed files')
