# Herbamed RNC em Docker

## Subir em producao local

```bash
docker compose up --build -d
```

A aplicacao fica disponivel em:

```text
http://localhost:9027
```

Servicos e portas:

```text
frontend: http://localhost:9027
backend:  http://localhost:9028
banco:    localhost:5487 -> container:5432
```

## Variaveis de ambiente

O frontend usa a configuracao Firebase existente em `src/firebaseConfig.js`.

Para habilitar os recursos de IA que chamam `/api/claude`, defina:

```bash
ANTHROPIC_API_KEY=sua_chave
POSTGRES_DB=sgqherbamed
POSTGRES_USER=sgqherbamed
POSTGRES_PASSWORD=troque_esta_senha
```

No Windows PowerShell:

```powershell
$env:ANTHROPIC_API_KEY="sua_chave"
docker compose up --build -d
```

## Comandos uteis

```bash
docker compose ps
docker compose logs -f
docker compose down
```

## Estrutura principal

```text
src/app              Aplicacao raiz e orquestracao
src/core             Temas, status e utilitarios puros
src/shared           UI reutilizavel e estilos compartilhados
src/layout           Sidebar e icones de navegacao
src/features         Modulos por dominio/tela
src/services         Clientes de integracoes externas
server               Backend Node para healthcheck e API /api/claude
nginx                Configuracao do frontend e proxy /api para o backend
```
