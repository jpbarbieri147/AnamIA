# AnamIA — Guia de Configuração

## Estrutura do projeto

```
anamia-project/
├── api/
│   ├── transcribe.js   → Whisper (transcrição de áudio)
│   └── generate.js     → Claude (preenchimento da anamnese)
├── public/
│   └── index.html      → Interface do médico
├── vercel.json         → Configuração do Vercel
├── package.json        → Dependências Node.js
└── .env.example        → Variáveis de ambiente (referência)
```

## Variáveis de ambiente necessárias no Vercel

```
OPENAI_API_KEY=sk-...        (sua chave OpenAI para o Whisper)
ANTHROPIC_API_KEY=sk-ant-... (sua chave Anthropic para o Claude)
```

## Deploy no Vercel (passo a passo)

1. Crie conta em github.com
2. Crie um repositório novo chamado "anamia"
3. Faça upload de todos os arquivos desta pasta
4. Acesse vercel.com e importe o repositório do GitHub
5. Em "Environment Variables", adicione OPENAI_API_KEY e ANTHROPIC_API_KEY
6. Clique em Deploy

## Custo estimado por consulta

- Whisper: ~US$ 0,006/min × 20min = US$ 0,12
- Claude Sonnet: ~US$ 0,05
- Total por consulta: ~US$ 0,17 (~R$ 0,95)
