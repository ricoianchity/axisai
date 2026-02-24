# AxisAI — Performance OS

App de coaching fitness com IA, baseado em metodologia MBSC/CFSC.

---

## Rodar localmente

1. Instale dependências:
   ```bash
   npm install
   ```

2. Crie o arquivo `.env` na raiz:
   ```
   ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI
   ```

3. Inicie o servidor:
   ```bash
   node dev-server.js
   ```

4. Acesse: [http://localhost:3000](http://localhost:3000)

---

## Deploy na Vercel (gratuito)

1. Instale o CLI da Vercel:
   ```bash
   npm i -g vercel
   ```

2. Na pasta do projeto:
   ```bash
   vercel
   ```

3. Siga o wizard. Quando pedir o nome do projeto, use `axisai`.

4. Após o deploy, adicione a variável de ambiente no painel da Vercel:
   - Acesse: [vercel.com](https://vercel.com) → seu projeto → **Settings → Environment Variables**
   - Nome: `ANTHROPIC_API_KEY`
   - Valor: sua chave `sk-ant-...`

5. Faça um redeploy:
   ```bash
   vercel --prod
   ```

6. Seu app estará em: `https://axisai.vercel.app`

---

## Variáveis de ambiente necessárias

| Variável            | Descrição                              |
|---------------------|----------------------------------------|
| `ANTHROPIC_API_KEY` | Chave da API Anthropic (obrigatória)   |

---

## Estrutura do projeto

```
axisai-proxy/
├── api/
│   └── chat.js          ← Edge function proxy para Anthropic
├── public/
│   └── AxisAI — Performance OS.html
├── dev-server.js        ← Servidor local para testes
├── vercel.json          ← Configuração de rotas Vercel
├── package.json
├── .env.example
└── .gitignore
```
