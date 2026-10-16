#!/usr/bin/env python3
"""Confere a planilha do Hector ANTES de importar (não grava nada).
Uso: python3 validar_catalogo.py modelo-importacao-catalogo.csv [dados-fora-do-sistema.csv]
Regras: as mesmas do importador (docs/IMPORTACAO_PRODUTOS.md) + classificação A/B/C/D."""
import csv, re, sys
def num(v):
    v=(v or '').strip().replace('R$','').replace(' ','')
    if not v: return None
    if ',' in v: v=v.replace('.','').replace(',','.')
    try: return float(v)
    except ValueError: return 'ERRO'
def main(path, extra=None):
    rows=list(csv.DictReader(open(path,encoding='utf-8-sig'),delimiter=';'))
    ex={r['sku']:r for r in csv.DictReader(open(extra,encoding='utf-8-sig'),delimiter=';')} if extra else {}
    erros=0; skus=set(); cont={'A':0,'B':0,'C':0,'D':0}
    for i,r in enumerate(rows,start=2):
        e=[]; sku=(r.get('sku') or '').strip()
        if not 2<=len(sku)<=64: e.append('sku inválido')
        if sku in skus: e.append('sku repetido')
        skus.add(sku)
        p=num(r.get('preco')); pd=num(r.get('preco_de'))
        if p=='ERRO' or (p is not None and p<=0): e.append('preco inválido')
        if pd=='ERRO' or (pd is not None and p not in (None,'ERRO') and pd<=p): e.append('preco_de deve ser maior que preco')
        est=(r.get('estoque') or '').strip()
        if est and not re.fullmatch(r'\d+',est): e.append('estoque deve ser inteiro')
        dims={k:num(r.get(k)) for k in ['peso_kg','largura_cm','altura_cm','comprimento_cm']}
        for k,v in dims.items():
            if v=='ERRO' or (v is not None and v<=0): e.append(f'{k} inválido')
        if dims['peso_kg'] not in (None,'ERRO') and dims['peso_kg']>30: e.append('peso_kg > 30 (confira: kg, com embalagem)')
        fotos=[x for x in (r.get('fotos') or '').split('|') if x.strip()]
        if len(fotos)>10: e.append('mais de 10 fotos')
        desc=(r.get('descricao') or '').strip()
        tem_dims=all(isinstance(v,float) for v in dims.values())
        x=ex.get(sku,{}); specs=(x.get('especificacoes (rotulo: valor | rotulo: valor)') or '').strip()
        falta=[n for n,ok in [('fotos',fotos),('descricao',len(desc)>=80),('peso/medidas',tem_dims),('especificacoes',specs),('fornecedor',(x.get('fornecedor') or '').strip()),('custo',num(x.get('custo_unitario')) not in (None,'ERRO'))] if not ok]
        if not falta: c='A'
        elif fotos and tem_dims: c='B'
        elif fotos or tem_dims: c='C'
        else: c='D'
        cont[c]+=1
        if e: erros+=1
        print(f"linha {i} {sku}: classe {c}" + (f" | ERROS: {', '.join(e)}" if e else '') + (f" | falta: {', '.join(falta)}" if falta else ''))
    print(f"\n{len(rows)} linhas, {erros} com erro. Classes: {cont}")
    print("A = pronto para anunciar; B = falta só texto/specs/fornecedor/custo; C = falta foto OU peso/medidas; D = falta foto E peso/medidas.")
    return 1 if erros else 0
if __name__=='__main__': sys.exit(main(*sys.argv[1:3]))
