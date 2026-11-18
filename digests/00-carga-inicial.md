---
tipo: digest-hub-dev
periodo: tudo
itens: 18
gerado_em: 2026-11-18T02:51:13.986Z
tags: [hub-dev, digest]
---

# Hub Dev — Carga inicial

> 17 novidade(s) com relevância ≥ 3 · 1 alerta(s) de segurança · 12 item(ns) na fila "pra testar"

## 🔴 Segurança

- **[Drupal core - Critical - Remote code execution - SA-CORE-2026-014](https://www.drupal.org/sa-core-2026-014)** — Drupal.org Security · 14 de out de 2026 · `seguranca` `drupal` · ★★★★★

  A release de segurança do core de 14/out corrigiu uma execução remota de código classificada como crítica no módulo Field UI (SA-CORE-2026-014) e dois XSS moderadamente críticos (SA-CORE-2026-015, no módulo Link, e SA-CORE-2026-016). No mesmo dia saiu um alerta crítico de RCE para o módulo contribuído Entity List (SA-CONTRIB-2026-218).

  **Impacto:** Conferir se todos os sites Drupal (inclusive cada instância do multisite) estão numa versão do core publicada em 14/out ou depois; atualizar o Entity List onde ele for usado. Vale reavaliar se o Field UI precisa ficar habilitado em produção.

## ⭐ Destaques

- **[Drupal core release schedule](https://www.drupal.org/core/release-cycle)** — Drupal.org · sem data · `drupal` `php` · ★★★★★

  O Drupal 12.0.0 e o 11.5.0 estão programados para a semana de 7 de dezembro de 2026, com release candidates previstos para a semana de 9 de novembro. O Drupal 10 chega ao fim de vida em 9 de dezembro, e o Drupal 12 exige PHP 8.5. O 11.5 será a versão de suporte longo da linha 11, com suporte previsto até o fim de 2028.

  **Impacto:** Sites ainda no Drupal 10 precisam ir para o 11 (de preferência 11.4+) antes de 9/dez para não ficar sem correções de segurança. Para o Drupal 12, os ambientes (Lando, servidores) vão precisar de PHP 8.5 e os módulos contribuídos precisam ser checados um a um.

- **[Google’s November 2026 Core Update Starts Rolling Out](https://www.searchenginejournal.com/google-november-2026-core-update/596614/)** — Search Engine Journal · 10 de nov de 2026 · `seo` · ★★★★★

  O Google começou em 10/11 a liberar o core update de novembro de 2026, o terceiro do ano (depois de março e maio), valendo para todos os idiomas e com rollout de até duas semanas. O Google não detalhou alvos específicos e recomenda esperar o fim do rollout antes de analisar os dados do Search Console.

  **Impacto:** Guardar agora uma linha de base do Search Console dos clientes (por exemplo, 3 a 9/nov) e só comparar depois que o rollout terminar, para não confundir oscilação de rollout com perda real.

- **[New to the web platform in October](https://web.dev/blog/web-platform-10-2026)** — web.dev · 29 de out de 2026 · `css` `performance` · ★★★★★

  Com o Firefox 159 ligando o recurso por padrão, as animações guiadas por rolagem (animation-timeline com scroll() e view()) viraram Baseline recém-disponível — Chrome já tinha desde a 115 e Safari desde a 26. O resumo de outubro também registra os registros de custom elements com escopo virando Baseline e o JPEG XL chegando ao Chrome 155 e ao Firefox 158.

  **Impacto:** Efeitos de revelar ao rolar, barra de progresso de leitura e parallax simples podem sair do JavaScript (scroll listeners, AOS, parte do ScrollTrigger) e ir para CSS, que pode rodar fora da thread principal — menos JS nos temas e ganho de responsividade.

  **Suporte:** Baseline: recém-disponível (desde 2026-10-27) — [web-features](https://web-platform-dx.github.io/web-features-explorer/features/scroll-driven-animations/)

- **[Shipping JPEG XL in Chrome](https://developer.chrome.com/blog/jpeg-xl-in-chrome)** — Chrome for Developers · 06 de out de 2026 · `plataforma` `performance` · ★★★★★

  O Chrome passou a decodificar imagens JPEG XL (.jxl) a partir da versão 155, com um decodificador escrito em Rust (jxl-rs) para reduzir riscos de segurança de memória. O formato promete arquivos 30–50% menores que JPEG, modo sem perdas, HDR e conversão de JPEG existente para JXL sem perda de qualidade. O Google recomenda testar JXL e AVIF lado a lado: o JXL tende a se sair melhor em fotos de alta fidelidade e quando a decodificação progressiva importa.

  **Impacto:** Abre caminho para servir .jxl via &lt;picture&gt; nos temas WordPress e Drupal, com AVIF/WebP/JPEG de fallback. O Firefox 158 também passou a suportar, mas o recurso ainda não é Baseline segundo o web-features, então o fallback continua obrigatório.

  **Suporte:** Suporte limitado — [web-features](https://web-platform-dx.github.io/web-features-explorer/features/jpegxl/)

- **[WordPress 7.1 “Mary Lou”](https://wordpress.org/news/?p=21420)** — WordPress.org News · 19 de ago de 2026 · `wordpress` · ★★★★★

  Lançado em 19/08, o WordPress 7.1 traz estilos responsivos por breakpoint direto no editor (com breakpoints de mobile e tablet definíveis no theme.json), estados de hover, um novo editor de mídia em modal com processamento de imagem no navegador, os blocos Tabs e Playlist, uma API pública para registrar coleções de ícones SVG e notas ancoradas em trechos de texto. A colaboração em tempo real segue de fora.

  **Impacto:** Temas de bloco ganham responsividade sem CSS manual; nos temas clássicos com ACF o impacto é menor, mas a API de ícones e o processamento de imagem no navegador afetam o fluxo de mídia dos clientes. Testar compatibilidade de plugins antes de atualizar.

## Por stack

### Plataforma Web

- **[Interop 2026 Focus Areas Announced](https://igalia.com/news/interop-2026.html)** — Igalia · 12 de fev de 2026 · `plataforma` `css` · ★★★★☆

  O Interop 2026 definiu as áreas em que os navegadores vão se alinhar ao longo do ano. No CSS entram anchor positioning, view transitions, container style queries, scroll-driven animations, attr() avançado, contrast-color(), shape(), scroll snap e custom highlights; em APIs, Navigation API, IndexedDB, WebTransport e registros de custom elements com escopo, entre outras. JPEG XL e testes de acessibilidade ficaram como áreas de investigação.

  **Impacto:** É um bom mapa do que deve virar seguro de usar nos próximos meses — ajuda a decidir o que estudar primeiro e o que ainda pede fallback.

### CSS

- **[June 2026 Baseline monthly digest](https://web.dev/blog/baseline-digest-jun-2026)** — web.dev · 17 de jul de 2026 · `css` `acessibilidade` · ★★★★☆

  Em junho de 2026 a propriedade field-sizing virou Baseline recém-disponível: com field-sizing: content, campos de formulário crescem e encolhem conforme o conteúdo. No mesmo mês o seletor :has() chegou a Baseline amplamente disponível.

  **Impacto:** Textareas que hoje usam script de auto-resize podem ficar só com CSS. Com :has() amplamente disponível, dá para usar sem fallback em estilos de formulário e de estados de layout.

  **Suporte:** Baseline: recém-disponível (desde 2026-06-16) — [web-features](https://web-platform-dx.github.io/web-features-explorer/features/field-sizing/)

- **[May 2026 Baseline monthly digest](https://web.dev/blog/baseline-digest-may-2026)** — web.dev · 03 de jun de 2026 · `css` · ★★★★☆

  Em maio de 2026 as container style queries viraram Baseline recém-disponível: além do tamanho, um componente pode mudar de estilo conforme custom properties do container pai. Também entraram a pseudo-classe :open (para &lt;dialog&gt;, &lt;details&gt; e afins), a propriedade image-rendering e a API SharedWorker.

  **Impacto:** Permite variar tema/estilo de componentes (SDC no Drupal, BEM no WordPress) por custom property do contexto, sem classes modificadoras espalhadas pelo HTML.

  **Suporte:** Baseline: recém-disponível (desde 2026-05-19) — [web-features](https://web-platform-dx.github.io/web-features-explorer/features/container-style-queries/)

### JavaScript

- **[Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)** — TypeScript Blog · 08 de jul de 2026 · `javascript` `next` `nest` · ★★★★☆

  O TypeScript 7.0 é o compilador reescrito em Go: builds completos de 8 a 12 vezes mais rápidos e menos memória, mantendo o mesmo comando tsc e a mesma linguagem. Ainda não há API de compilador (prometida para a 7.1), então ferramentas que dependem dela podem precisar do TypeScript 6 instalado em paralelo via alias.

  **Impacto:** Type-check e editor bem mais rápidos em projetos Next/Nest, mas algumas ferramentas (linters, loaders de bundler, CLIs de framework) podem ainda exigir o TS 6 até a 7.1.

### PHP

- **[What's new in PHP 8.6](https://stitcher.io/blog/new-in-php-86)** — stitcher.io · 29 de jul de 2026 · `php` · ★★★★☆

  O PHP 8.6 tem lançamento marcado para 19 de novembro de 2026. Os destaques são a aplicação parcial de funções (placeholders ? e ... para gerar closures), valores padrão em propriedades readonly, a função clamp(), a classe Time\Duration, uma nova API de polling de I/O e uma leva de deprecations preparando o terreno para o PHP 9.

  **Impacto:** Ainda não é requisito de nenhuma stack (o Drupal 12 pede 8.5), mas vale testar o starter WordPress e os temas Drupal contra a 8.6 para pegar deprecations cedo.

- **[PHP 8.5 Release Announcement](https://www.php.net/releases/8.5/en.php)** — php.net · 20 de nov de 2025 · `php` · ★★★☆☆

  O PHP 8.5, lançado em 20/11/2025, é a base atual: trouxe o operador pipe (|&gt;), clone com alteração de propriedades, o atributo #[\NoDiscard], a extensão nativa de URI e stack trace em erros fatais. A linha 8.5 recebe correções de bugs até o fim de 2027.

  **Impacto:** É o mínimo exigido pelo Drupal 12, então os ambientes de desenvolvimento e produção dos projetos Drupal precisam migrar para 8.5 até dezembro.

### WordPress

- **[WordPress 7.0 is out: the 7 highlights of this release](https://yoast.com/wordpress-7-0/)** — Yoast · 20 de mai de 2026 · `wordpress` · ★★★☆☆

  O WordPress 7.0 “Armstrong” saiu em 20/05, com atraso em relação à data original de abril. Colocou no core a base de IA (AI Client, Abilities API e um hub de Connectors para provedores), modernizou o admin, trouxe paleta de comandos e um bloco de breadcrumbs, e subiu o PHP mínimo para 7.4. A colaboração em tempo real foi retirada da versão.

  **Impacto:** A Abilities API passa a ser o ponto de integração padrão para recursos de IA em plugins; vale conhecer antes de criar integrações próprias em projetos de clientes.

### React

- **[React 19.3](https://react.dev/blog/2026/09/09/react-19-3)** — React Blog · 09 de set de 2026 · `react` `next` · ★★★★☆

  O React 19.3 tornou estáveis o componente &lt;ViewTransition&gt; e as refs em Fragment, sem mudanças que quebrem compatibilidade. Também trouxe a API browser() para renderizar algo só no cliente durante o SSR (a documentação ainda trata como canal Canary), suporte a Trusted Types e renderização de Context direto a partir de Server Components.

  **Impacto:** Transições de página e de estado nos projetos Next/React podem usar a API nativa do navegador via &lt;ViewTransition&gt;, no lugar de bibliotecas de animação para casos simples.

  **Suporte:** Baseline: recém-disponível (desde 2025-10-14) — [web-features](https://web-platform-dx.github.io/web-features-explorer/features/view-transitions/)

### Next.js

- **[Next.js 16.4](https://nextjs.org/blog/next-16-4)** — Next.js Blog · 06 de out de 2026 · `next` `react` `performance` · ★★★★☆

  O Next.js 16.4 passou a recomendar Cache Components para todo app e já liga o recurso por padrão no create-next-app; a ideia é virar padrão no Next 17. A versão traz ensureStatic para garantir que shell, prefetch ou página sejam estáticos, compilação sob demanda, bundles menores e o React 19.3.

  **Impacto:** Projetos Next novos já nascem com Cache Components; nos existentes vale planejar a migração e usar ensureStatic para impedir que um componente dinâmico estrague uma rota que deveria ser estática.

### NestJS

- **[NestJS — Migration guide (v11 → v12)](https://docs.nestjs.com/migration-guide)** — NestJS Docs · 27 de ago de 2026 · `nest` `javascript` · ★★★★☆

  O NestJS 12 saiu em 27/08 com os pacotes oficiais em ESM (projetos CommonJS continuam funcionando via require de ESM no Node moderno), validação com Standard Schema — dá para usar Zod direto em @Body, @Query e @Param —, CLI reconstruída e o SDK oficial de observabilidade @nestjs/observe. Os hooks de ciclo de vida passaram a rodar pela hierarquia de componentes, o que pode mudar a ordem de execução.

  **Impacto:** Em APIs novas, Zod via Standard Schema substitui DTOs com class-validator. Ao migrar projetos existentes, revisar a ordem dos hooks de ciclo de vida e a versão do TypeScript exigida pela CLI.

### Astro

- **[Astro 7.0](https://astro.build/blog/astro-7/)** — Astro Blog · 22 de jun de 2026 · `astro` · ★★★★☆

  O Astro 7 é uma versão focada em velocidade: o compilador de .astro foi reescrito em Rust, Markdown e MDX passaram para um pipeline novo em Rust e o dev server e o bundler foram para o Vite 8, com builds de 15% a 61% mais rápidos nos benchmarks do time. O compilador novo é mais rígido com HTML (tags não fechadas viram erro) e a versão estreia o roteamento avançado via src/fetch.ts.

  **Impacto:** Projetos Astro + WordPress headless precisam de Node 22 e de uma revisão de templates com HTML malformado antes do upgrade; espaços entre elementos inline também podem mudar no HTML final.

- **[Astro 6.0](https://astro.build/blog/astro-6)** — Astro Blog · 10 de mar de 2026 · `astro` · ★★★☆☆

  O Astro 6 redesenhou o servidor de desenvolvimento para ficar mais próximo da produção (inclusive em runtimes como Cloudflare Workers), trouxe APIs nativas de fontes e de CSP, estabilizou as live content collections e passou a exigir Node 22. Foi o primeiro major depois da compra do Astro pela Cloudflare, em janeiro de 2026.

  **Impacto:** A Fonts API resolve self-hosting e fallback de fontes (bom para CLS) sem plugin; a CSP API ajuda a fechar política de segurança em sites estáticos.

## 🧪 Pra testar

- [ ] **Drupal core release schedule** — Subir o 12.0.0-rc1 num Lando com PHP 8.5, instalar o tema SDC de um projeto e listar as deprecations e quebras encontradas. ([fonte](https://www.drupal.org/core/release-cycle))
- [ ] **New to the web platform in October** — Refazer um efeito de 'aparecer ao rolar' de um tema com animation-timeline: view() dentro de @supports, comparar com a versão em GSAP/JS e medir no painel Performance do DevTools. ([fonte](https://web.dev/blog/web-platform-10-2026))
- [ ] **Shipping JPEG XL in Chrome** — Converter 3 fotos de um tema com cjxl (inclusive a transcodificação sem perdas de um JPEG), comparar o peso com AVIF/WebP e medir o LCP de uma página de teste usando &lt;picture&gt; com fallback. ([fonte](https://developer.chrome.com/blog/jpeg-xl-in-chrome))
- [ ] **WordPress 7.1 “Mary Lou”** — Criar um tema de bloco de teste, definir breakpoints próprios no theme.json e inspecionar o CSS gerado (peso e especificidade) comparando com o SCSS do starter. ([fonte](https://wordpress.org/news/?p=21420))
- [ ] **Next.js 16.4** — Ativar Cache Components numa rota de um projeto paralelo, marcar com ensureStatic e ver o que o build acusa. ([fonte](https://nextjs.org/blog/next-16-4))
- [ ] **React 19.3** — Adicionar &lt;ViewTransition&gt; na troca de rota de uma página de lista para detalhe num projeto Next de teste e comparar com a solução atual. ([fonte](https://react.dev/blog/2026/09/09/react-19-3))
- [ ] **NestJS — Migration guide (v11 → v12)** — Criar um endpoint de teste no Nest 12 validando o body com um schema Zod e comparar com a versão em DTO + class-validator. ([fonte](https://docs.nestjs.com/migration-guide))
- [ ] **What's new in PHP 8.6** — Rodar um container php:8.6 no Lando e reescrever um helper do starter usando aplicação parcial de funções e clamp(); anotar as deprecations que aparecerem. ([fonte](https://stitcher.io/blog/new-in-php-86))
- [ ] **June 2026 Baseline monthly digest** — Trocar o script de auto-resize de um formulário de contato por field-sizing: content e testar no Safari e no Firefox. ([fonte](https://web.dev/blog/baseline-digest-jun-2026))
- [ ] **Announcing TypeScript 7.0** — Medir o tempo de tsc --noEmit de um projeto paralelo no TS 6 e no TS 7 e anotar quais ferramentas reclamaram. ([fonte](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/))
- [ ] **Astro 7.0** — Atualizar um projeto Astro de teste com npx @astrojs/upgrade e registrar o tempo de build antes e depois e os erros do compilador novo. ([fonte](https://astro.build/blog/astro-7/))
- [ ] **May 2026 Baseline monthly digest** — Refazer um card com modificador de tema (ex.: --dark) usando @container style(--tema: escuro) e comparar o CSS e o HTML resultantes. ([fonte](https://web.dev/blog/baseline-digest-may-2026))
