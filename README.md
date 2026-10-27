# 2K DESIGN — demonstração

Landing page responsiva de lighting design para palcos e eventos, com logo 3D interativa, títulos com resposta ao cursor, revelação de textos, seis projetos e três faixas de marcas reais.

## Executar localmente

Na pasta do projeto, execute `python3 -m http.server 8080` e abra http://localhost:8080. Os dados JSON precisam de HTTP; não abra apenas o arquivo HTML por file://.

## Publicar no GitHub Pages

1. Crie o repositório público `2k-design-demo`.
2. Envie todos os arquivos desta pasta para a raiz da branch `main`, preservando a pasta `assets/`.
3. Em **Settings → Pages**, selecione **Deploy from a branch**, branch **main**, pasta **/(root)** e salve.
4. Acompanhe a publicação em **Actions** e abra o endereço mostrado pelo GitHub.

Demonstração: https://aldovieiradesigner.github.io/2k-design-demo/

## Conteúdo

- HTML, CSS e JavaScript estáticos, sem compilação ou backend.
- Three.js incluído localmente; aviso de licença mantido no arquivo da biblioteca.
- Fontes Archivo Black, Archivo e JetBrains Mono pelo Google Fonts.
- Logo com iluminação de Palco, mouse e arraste; enquadramento integral na rolagem.
- Textos com preenchimento/contorno ao cursor e entrada progressiva.
- Marcas com faixas suaves, arraste, pausa e suporte a movimento reduzido.
- Galerias, serviços, menu móvel e links de contato.

O arquivo vazio `.nojekyll` incluído desativa o processamento pelo Jekyll. Não remova esse arquivo.

Código, imagens e marcas estão incluídos para a demonstração do projeto 2K DESIGN; não foi atribuída uma licença geral de redistribuição aos materiais da marca.

Documentação: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
