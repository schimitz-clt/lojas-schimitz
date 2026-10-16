import json,urllib.request,csv,re
A="https://lojas-schimitz-production.up.railway.app/api/v1"
def g(u): return json.load(urllib.request.urlopen(A+u))['data']
items=[]
for p in range(1,6):
    d=g(f"/products?page={p}&pageSize=24"); items+=d['items']
    if len(items)>=d['total']: break
seen={};[seen.setdefault(i['slug'],i) for i in items]
rows=[]
for s in seen:
    x=g("/products/"+s)
    gen=bool(re.search(r"na categoria .*Preço, frete e pagamento são confirmados",x['description']))
    miss=[]
    if not x['images']: miss.append("fotos")
    if not x['description'] or gen: miss.append("descricao_real")
    if not x['features']: miss.append("especificacoes")
    for f in ["weightKg","widthCm","heightCm","lengthCm"]:
        if x[f] in (None,"0"): miss.append(f)
    miss+=["custo(sem campo no sistema)","fornecedor(sem campo no sistema)"]
    core=[m for m in miss if "sem campo" not in m]
    has_dims=not any(m in core for m in ["weightKg","widthCm","heightCm","lengthCm"])
    if not core: cl="A"
    elif "fotos" not in core and has_dims: cl="B"
    elif has_dims or "fotos" not in core: cl="C"
    else: cl="D"
    rows.append(dict(classe=cl,sku=x['sku'],nome=x['name'],slug=x['slug'],categoria=(x.get('category') or {}).get('name',''),
      preco=x['price'],preco_de=x['compareAtPrice'] or '',estoque=x['stock'],fotos=len(x['images']),descricao_generica=gen,
      especificacoes=len(x['features'] or []),destaques=len(x['highlights'] or []),peso_kg=x['weightKg'] or '',larg=x['widthCm'] or '',alt=x['heightCm'] or '',comp=x['lengthCm'] or '',
      campos_faltando=";".join(miss)))
rows.sort(key=lambda r:(r['classe'],r['sku']))
w=csv.DictWriter(open("catalogo-auditoria.csv","w",newline=""),fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
from collections import Counter
print(len(rows),Counter(r['classe'] for r in rows),Counter(r['categoria'] for r in rows))
print(Counter(m for r in rows for m in r['campos_faltando'].split(';')))
print(sum(r['estoque'] for r in rows), [r['sku'] for r in rows if not r['descricao_generica']][:10])
