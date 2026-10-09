# Gera os 8 banners (HTML) — 1200x400 CSS, renderizados em 1x (1200x400) e 2x (2400x800).
import json, html
ICONS = {
 'pix': '<path d="M32 6 58 32 32 58 6 32Z"/><path d="M32 18 46 32 32 46 18 32Z"/>',
 'pct': '<path d="M46 14 18 50"/><circle cx="20" cy="20" r="7"/><circle cx="44" cy="44" r="7"/>',
 'truck': '<path d="M6 18h30v26H6zM36 28h12l10 10v6H36z"/><circle cx="18" cy="48" r="5"/><circle cx="46" cy="48" r="5"/>',
 'pin': '<path d="M32 58S14 40 14 26a18 18 0 0 1 36 0c0 14-18 32-18 32z"/><circle cx="32" cy="26" r="7"/>',
 'card': '<rect x="6" y="14" width="52" height="36" rx="6"/><path d="M6 26h52M14 40h12"/>',
 'x12': 'TEXT:12x',
 'phone': '<rect x="18" y="4" width="28" height="56" rx="6"/><path d="M28 12h8M29 52h6"/>',
 'wifi': '<path d="M8 26a34 34 0 0 1 48 0M16 34a22 22 0 0 1 32 0M24 42a10 10 0 0 1 16 0"/><circle cx="32" cy="50" r="2.5"/>',
 'laptop': '<rect x="12" y="12" width="40" height="28" rx="3"/><path d="M4 48h56l-5 6H9z"/>',
 'chip': '<rect x="18" y="18" width="28" height="28" rx="4"/><path d="M26 10v8M38 10v8M26 46v8M38 46v8M10 26h8M10 38h8M46 26h8M46 38h8"/>',
 'home': '<path d="M8 30 32 8l24 22M16 26v28h32V26"/><path d="M27 54V40h10v14"/>',
 'plug': '<path d="M24 6v14M40 6v14M16 20h32v10a16 16 0 0 1-32 0zM32 46v12"/>',
 'bag': '<path d="M12 20h40l-3 36H15z"/><path d="M22 28v-6a10 10 0 0 1 20 0v6"/>',
 'cart': '<path d="M6 10h8l7 30h30l6-22H18"/><circle cx="26" cy="50" r="4"/><circle cx="46" cy="50" r="4"/>',
 'chat': '<path d="M8 12h48v32H30L16 56V44H8z"/><path d="M20 24h24M20 33h14"/>',
 'phone2': '<path d="M16 8l10 4-4 10c4 8 10 14 18 18l10-4 4 10-6 6C30 54 10 34 8 14z"/>',
 'bolt': '<path d="M36 4 14 36h16l-4 24 24-34H34z"/>',
}
B = [
 dict(n=1, slug='pix-5-off', theme='navy', kicker='PIX', h='*5% OFF* no PIX', sub='Desconto de 5% pagando no PIX.', link='/departamento/ofertas', L='pix', R='pct', alt='5% off pagando no PIX'),
 dict(n=2, slug='frete-gratis-poa', theme='bordo', kicker='ENTREGA', h='*Frete grátis* em Porto Alegre', sub='Para CEPs iniciados em 90 ou 91.', link='/produtos', L='pin', R='truck', alt='Frete grátis em Porto Alegre'),
 dict(n=3, slug='parcele-12x', theme='navy', kicker='CARTÃO', h='Parcele em até *12x* no cartão', sub='Juros conforme o cartão, informados no checkout.', link='/produtos', L='card', R='x12', alt='Parcele em até 12x no cartão, com juros conforme o cartão'),
 dict(n=4, slug='celulares', theme='bordo', kicker='DEPARTAMENTO', h='Celulares e acessórios', sub='Veja o que a loja tem disponível.', link='/departamento/celulares', L='phone', R='wifi', alt='Departamento de celulares e acessórios'),
 dict(n=5, slug='informatica', theme='navy', kicker='DEPARTAMENTO', h='Informática', sub='Confira os produtos do departamento.', link='/departamento/informatica', L='laptop', R='chip', alt='Departamento de informática'),
 dict(n=6, slug='eletro-casa', theme='bordo', kicker='DEPARTAMENTO', h='Eletrodomésticos e casa', sub='Para equipar a sua casa.', link='/departamento/eletrodomesticos', L='plug', R='home', alt='Eletrodomésticos e casa'),
 dict(n=7, slug='marketplace', theme='navy', kicker='MARKETPLACE', h='Marketplace Lojas Schimitz', sub='Um carrinho, um pedido: frete e pagamento juntos.', link='/marketplace', L='bag', R='cart', alt='Marketplace Lojas Schimitz: um carrinho, um pedido'),
 dict(n=9, slug='ofertas', theme='navy', kicker='OFERTAS', h='Ofertas *Lojas Schimitz*', sub='Veja as ofertas e pague no PIX com 5% off.', link='/departamento/ofertas', L='bag', R='pct', alt='Ofertas Lojas Schimitz, com 5% off no PIX'),
 dict(n=10, slug='pix-economize', theme='bordo', kicker='PIX', h='Pague no PIX e *economize 5%*', sub='O desconto aparece no checkout.', link='/produtos', L='pix', R='bolt', alt='Pague no PIX e economize 5%'),
 dict(n=11, slug='casa-utilidades', theme='navy', kicker='DEPARTAMENTO', h='Casa e *utilidades*', sub='Confira os produtos do departamento.', link='/departamento/casa', L='home', R='plug', alt='Departamento de casa e utilidades'),
 dict(n=8, slug='whatsapp', theme='bordo', kicker='ATENDIMENTO', h='Atendimento no WhatsApp', sub='(51) 99625-3766', link='/suporte', L='chat', R='phone2', alt='Atendimento pelo WhatsApp (51) 99625-3766'),
]
THEMES = {
 'navy':  dict(bg='radial-gradient(60% 120% at 88% 10%, rgba(122,30,48,.75), transparent 60%), radial-gradient(50% 110% at 8% 100%, rgba(59,107,214,.28), transparent 60%), linear-gradient(120deg,#07122A 0%,#0B1B3A 55%,#13284F 100%)', glow='#B03A52', line='rgba(246,239,228,.10)'),
 'bordo': dict(bg='radial-gradient(60% 120% at 10% 0%, rgba(201,168,106,.20), transparent 60%), radial-gradient(55% 120% at 92% 100%, rgba(59,107,214,.30), transparent 60%), linear-gradient(120deg,#3E0E18 0%,#5A1424 50%,#7A1E30 100%)', glow='#C9A86A', line='rgba(246,239,228,.12)'),
}
def deco(side, icon, glow):
    x = 150 if side=='L' else 1050
    sgn = 1 if side=='L' else -1
    rings = ''.join(f'<circle cx="{x}" cy="170" r="{r}" fill="none" stroke="{glow}" stroke-opacity="{o}" stroke-width="1.2"/>' for r,o in ((70,.55),(110,.30),(155,.16),(205,.08)))
    hexa = f'<polygon points="{x-34},{170-60} {x+34},{170-60} {x+68},170 {x+34},{170+60} {x-34},{170+60} {x-68},170" fill="rgba(246,239,228,.06)" stroke="rgba(246,239,228,.55)" stroke-width="1.6" style="filter:drop-shadow(0 0 10px {glow})"/>'
    nodes = ''.join(f'<circle cx="{x+sgn*dx}" cy="{y}" r="{r}" fill="{glow}" fill-opacity=".9"/>' for dx,y,r in ((-120,60,3),(112,300,3.5),(150,92,2.5),(-96,262,2.5)))
    trace = f'<path d="M{x+sgn*70} 170 H{x+sgn*100} L{x+sgn*118} 150 H{x+sgn*128}" fill="none" stroke="{glow}" stroke-opacity=".6" stroke-width="1.5"/><path d="M{x+sgn*60} 205 H{x+sgn*90} L{x+sgn*108} 224 H{x+sgn*122}" fill="none" stroke="rgba(246,239,228,.35)" stroke-width="1.5"/>'
    if ICONS[icon].startswith('TEXT:'):
        ic = f'<text x="{x}" y="{170+11}" text-anchor="middle" font-family="Inter Tight" font-weight="800" font-size="32" fill="#F6EFE4">{ICONS[icon][5:]}</text>'
        return rings+trace+hexa+nodes+ic
    ic = f'<g transform="translate({x-32} {170-32})" fill="none" stroke="#F6EFE4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">{ICONS[icon]}</g>'
    return rings+trace+hexa+nodes+ic
def page(b):
    t = THEMES[b['theme']]
    plain = b['h'].replace('*','')
    n = len(plain)
    size = 92 if n <= 14 else (78 if n <= 18 else (66 if n <= 22 else 60))
    hh = html.escape(b['h']).replace('*','\x00')
    parts = hh.split('\x00')
    hh = ''.join(('<em>'+x+'</em>' if i%2 else x) for i,x in enumerate(parts))
    return f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0}}
html,body{{width:1200px;height:400px;overflow:hidden;background:#07122A}}
.b{{position:relative;width:1200px;height:400px;overflow:hidden;background:{t['bg']};font-family:'Inter Tight',sans-serif;color:#F6EFE4}}
.grid{{position:absolute;inset:0;background-image:linear-gradient({t['line']} 1px,transparent 1px),linear-gradient(90deg,{t['line']} 1px,transparent 1px);background-size:40px 40px;-webkit-mask-image:radial-gradient(70% 90% at 50% 45%,#000 20%,transparent 80%);mask-image:radial-gradient(70% 90% at 50% 45%,#000 20%,transparent 80%)}}
.glow{{position:absolute;left:300px;top:40px;width:600px;height:260px;background:radial-gradient(closest-side,rgba(246,239,228,.10),transparent);filter:blur(10px)}}
svg.d{{position:absolute;inset:0}}
.streak{{position:absolute;inset:-40% -10%;background:linear-gradient(105deg,transparent 42%,rgba(246,239,228,.05) 50%,transparent 58%)}}
.logo{{position:absolute;left:0;right:0;top:16px;display:flex;justify-content:center}}
.logo img{{height:34px;display:block;filter:drop-shadow(0 0 12px rgba(246,239,228,.18))}}
.c{{position:absolute;left:290px;width:620px;top:52px;height:250px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}}
.k{{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:700;letter-spacing:.28em;color:{t['glow']};filter:brightness(1.35)}}
.k i{{display:block;width:34px;height:2px;background:currentColor;opacity:.8}}
h1{{margin-top:14px;font-family:'Instrument Serif',serif;font-weight:400;font-size:{size}px;line-height:.98;letter-spacing:-.01em;text-wrap:balance;max-width:600px;text-shadow:0 0 28px rgba(246,239,228,.18)}}
em{{font-style:normal;background:linear-gradient(100deg,#F6EFE4,#E8C98A 60%,#C9A86A);-webkit-background-clip:text;background-clip:text;color:transparent}}
p{{margin-top:14px;font-size:24px;font-weight:500;color:rgba(246,239,228,.88);letter-spacing:.005em}}
.bar{{position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,transparent,{t['glow']},transparent);opacity:.8}}
</style></head><body><div class="b"><div class="grid"></div><div class="streak"></div><div class="glow"></div>
<svg class="d" viewBox="0 0 1200 400" width="1200" height="400">{deco('L',b['L'],t['glow'])}{deco('R',b['R'],t['glow'])}</svg>
<div class="logo"><img src="lockup.svg" alt=""></div>
<div class="c"><div class="k"><i></i>{html.escape(b['kicker'])}<i></i></div><h1>{hh}</h1><p>{html.escape(b['sub'])}</p></div>
<div class="bar"></div></div></body></html>'''
ORDER=['pix-5-off', 'frete-gratis-poa', 'parcele-12x', 'marketplace', 'ofertas', 'pix-economize', 'celulares', 'informatica', 'eletro-casa', 'casa-utilidades', 'whatsapp']
B.sort(key=lambda b: ORDER.index(b['slug']))
for i,b in enumerate(B,1): b['n']=i
for b in B:
    open(f"banner-{b['n']:02d}-{b['slug']}.html",'w').write(page(b))
json.dump(B, open('banners.json','w'), ensure_ascii=False, indent=1)
