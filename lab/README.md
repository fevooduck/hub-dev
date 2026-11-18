# lab/

Experimentos curtos, um por pasta: `lab/<id>-<slug>/` (o `<id>` é o id do item no hub).

Cada pasta tem um `README.md` com objetivo, passos, como medir e o resultado. Quando terminar:

```bash
npm run -s item -- status <id> testado
npm run -s item -- note <id> "o que aprendi / decidi" --lab lab/<id>-<slug>
```

No Claude Code, `/estudar` monta a pasta do próximo item da fila (ou de um id específico: `/estudar 42`).
