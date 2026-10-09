# Como gerar as capturas de novo (depois de subir fotos dos produtos)

Na box (precisa do Google Chrome e de `playwright-core` em /tmp/pw):
```bash
mkdir -p /tmp/pw && cd /tmp/pw && npm init -y >/dev/null && npm install playwright-core@1.64.0
cp /workspace/omega/play-store/capturas/gerar-capturas.js /tmp/pw/shots.js && node shots.js
```
- O script gera 1080×1920 (viewport 360×640, densidade 3) da loja **pública**, sem login, em `capturas/`.
- Ajuste a lista de URLs no script, por exemplo para um produto que já tenha foto.
- Feature graphic: `fonte-feature-graphic/fg.html` → `node fg.js` (1024×500).
