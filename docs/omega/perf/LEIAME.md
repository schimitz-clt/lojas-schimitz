# Medição de rolagem (Playwright + Chrome headless)

`NODE_PATH=$(npm root -g) node vvjank.js <base-url> <tag> <caminho>` — mobile 390×844, CPU 4x, rolagem por toque com a barra de endereço simulada (altura da viewport muda a cada frame). Imprime tempo de `UpdateLayoutTree`, `Layout`, `Paint`, `RunTask`.
`vv-resultados.txt`: antes (produção, main afd9f1a) x depois (build local com o PR #200).
`scroll.js`, `trace.js`, `loadtrace.js`: frames/long tasks na rolagem, trace da rolagem e trace da carga.
Confirmação em celular real: abrir a home no Chrome do Android, rolar até o fim e voltar; deve ficar fluido.
