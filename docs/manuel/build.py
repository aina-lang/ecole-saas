#!/usr/bin/env python3
"""Produit un manuel PDF à partir de son HTML.

Usage : build.py <desktop|mobile> <sortie.pdf>

1. Préparation : captures absentes → encadré « capture à venir » ; espaces
   insécables de la typographie française (avant : ; ? ! et dans « »).
2. Passe 1 : impression par Chrome, puis repérage de la page de chaque
   « CHAPITRE n » avec pdftotext.
3. Passe 2 : le sommaire reçoit les vrais numéros de page, réimpression.
"""
import os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
name, out = sys.argv[1], os.path.abspath(sys.argv[2])
src = open(os.path.join(HERE, f'{name}.html'), encoding='utf-8').read()

missing = []
# Captures d'écran d'ordinateur
def cap(m):
    block = m.group(0); path = re.search(r'<img src="([^"]+)"', block).group(1)
    if os.path.exists(os.path.join(HERE, path)): return block
    missing.append(path); label = os.path.basename(path).rsplit('.', 1)[0]
    block = block.replace('class="capture"', 'class="capture a-venir"', 1)
    return re.sub(r'<div class="barre">.*?</div><img[^>]*>', f'Capture à venir — {label}', block, flags=re.S)
src = re.sub(r'<figure class="capture">.*?</figure>', cap, src, flags=re.S)
# Captures de téléphone
def tel(m):
    block = m.group(0); path = m.group(1)
    if os.path.exists(os.path.join(HERE, path)): return block
    missing.append(path); label = os.path.basename(path).rsplit('.', 1)[0]
    return f'<div class="telephone a-venir">Capture à venir<br>{label}</div>'
src = re.sub(r'<div class="telephone"><img src="([^"]+)"[^>]*></div>', tel, src)

# Captures intégrées en JPEG de haute qualité, 1800 px de large au plus : le
# PDF est téléchargé depuis des connexions souvent lentes, et la différence
# est invisible sur des captures d'interface. Cache régénéré si la source change.
from PIL import Image
def optimise(m):
    path = m.group(1)
    full = os.path.join(HERE, path)
    if not (path.endswith('.png') and os.path.exists(full)): return m.group(0)
    cache = os.path.join(HERE, '.cache', path[:-4] + '.jpg')
    if not os.path.exists(cache) or os.path.getmtime(cache) < os.path.getmtime(full):
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        im = Image.open(full).convert('RGB')
        if im.width > 1800: im = im.resize((1800, round(im.height * 1800 / im.width)), Image.LANCZOS)
        im.save(cache, 'JPEG', quality=88, optimize=True, progressive=True)
    return m.group(0).replace(path, os.path.relpath(cache, HERE))
src = re.sub(r'<img src="([^"]+)"', optimise, src)

# Typographie française, uniquement dans le texte (jamais dans les balises).
NNBSP = ' '
def typo(text):
    text = re.sub(r' ([:;?!])', NNBSP + r'\1', text)
    text = text.replace('« ', '«' + NNBSP).replace(' »', NNBSP + '»')
    return text
src = re.sub(r'>([^<]+)<', lambda m: '>' + typo(m.group(1)) + '<', src)

def render(html, pdf):
    tmp = os.path.join(HERE, f'.build-{name}.html')
    open(tmp, 'w', encoding='utf-8').write(html)
    subprocess.run(['google-chrome', '--headless=new', '--disable-gpu', '--no-sandbox',
                    '--no-pdf-header-footer', '--generate-pdf-document-outline',
                    '--virtual-time-budget=20000', '--run-all-compositor-stages-before-draw',
                    f'--print-to-pdf={pdf}', 'file://' + tmp],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=240)

def chapter_pages(pdf):
    pages = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout).group(1))
    found = {}
    for p in range(1, pages + 1):
        txt = subprocess.run(['pdftotext', '-f', str(p), '-l', str(p), pdf, '-'], capture_output=True, text=True).stdout
        # Tolère les espaces entre lettres : pdftotext éclate parfois une
        # étiquette en petites capitales espacées (« C H A P I T R E 2 1 »).
        for n in re.findall(r'C\s*H\s*A\s*P\s*I\s*T\s*R\s*E\s+(\d(?:\s?\d)?)', txt):
            found.setdefault(int(n.replace(' ', '')), p)
    return found, pages

with tempfile.TemporaryDirectory() as t:
    p1 = os.path.join(t, 'passe1.pdf')
    render(src, p1)
    found, _ = chapter_pages(p1)
src = re.sub(r'<span class="pg" data-ch="(\d+)">·</span>',
             lambda m: f'<span class="pg">{found.get(int(m.group(1)), "")}</span>', src)
render(src, out)
_, pages = chapter_pages(out)
print(f'{out} : {pages} pages · chapitres repérés : {len(found)}')
if missing:
    print(f'captures à venir ({len(missing)}) : ' + ', '.join(sorted(set(os.path.basename(m) for m in missing))))
