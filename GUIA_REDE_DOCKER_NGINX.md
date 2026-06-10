# Guia de rede Docker e Nginx para novas aplicacoes

Este guia define o padrao para publicar novas aplicacoes no servidor da Herbamed sem derrubar o `nginx-proxy` nem depender do NAT/port-forward do Docker Desktop.

## Regra principal

Toda aplicacao publicada pelo Nginx deve estar na rede Docker compartilhada:

```text
herbamed_proxy
```

O Nginx deve acessar a aplicacao por nome interno de container ou alias Docker:

```nginx
proxy_pass http://alias-da-aplicacao:porta-interna;
```

Evite este padrao para novas aplicacoes:

```nginx
proxy_pass http://192.168.100.4:9031;
```

Esse caminho faz:

```text
nginx container -> IP do host -> porta publicada Docker -> container da aplicacao
```

Em Docker Desktop/WSL, esse caminho pode falhar durante builds, recriacao de containers ou alteracoes de rede, gerando `502` ou `504` mesmo com os containers das aplicacoes de pe.

O caminho desejado e:

```text
nginx-proxy -> rede herbamed_proxy -> container da aplicacao:porta interna
```

## Mapa atual dos upstreams

Estes sao os upstreams que o `nginx.conf` deve usar hoje:

| Dominio | Upstream esperado | Observacao |
| --- | --- | --- |
| `pedidos.herbamed.com.br` | `pedidos-app:3001` | Rede interna |
| `logistica.herbamed.com.br` | `logistica-frontend:80` | Rede interna |
| `manutencao.herbamed.com.br` | `manutencao-frontend:80` | Rede interna |
| `rotas.herbamed.com.br` | `rotas-frontend:3030` | Rede interna |
| `acompanhamento.herbamed.com.br` | `acompanhamento-app:3000` | Rede interna |
| `hbx.herbamed.com.br` | `hbx-app:8080` | Rede interna |
| `sgq.herbamed.com.br` | `sgq-frontend:80` | Rede interna |
| `hub.herbamed.com.br` | `hub-pedidos:3040` | Rede interna |
| `alerthub.herbamed.com.br` | `herbamed-alert-hub:19191` | Rede interna |
| `ocorrencias.herbamed.com.br` | `ocorrencias-app:3000` | Rede interna |
| `mrp.herbamed.com.br` | `192.168.100.4:9025` | Excecao temporaria: containers MRP estavam parados |

Quando o MRP voltar a rodar, migrar tambem para alias interno antes de remover essa excecao.

## Rede compartilhada

Criar uma vez, se ainda nao existir:

```bash
docker network create herbamed_proxy
```

Conferir:

```bash
docker network ls | grep herbamed_proxy
```

O `nginx-proxy` deve estar conectado nessa rede. O compose atual do proxy deve conter:

```yaml
services:
  nginx:
    image: nginx:alpine
    container_name: nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx-html:/usr/share/nginx/html:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    networks:
      - default
      - proxy
    restart: always

networks:
  proxy:
    name: herbamed_proxy
    external: true
```

## Compose padrao para uma nova aplicacao

Exemplo para uma aplicacao chamada `minha-aplicacao`, escutando internamente na porta `3000`:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: herbamed_minha_aplicacao_app
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
    expose:
      - "3000"
    networks:
      default:
      proxy:
        aliases:
          - minha-aplicacao-app

networks:
  proxy:
    name: herbamed_proxy
    external: true
```

Use `ports` somente se a aplicacao tambem precisar ser acessada diretamente pelo host para diagnostico:

```yaml
ports:
  - "${APP_PORT:-9032}:3000"
```

Mesmo quando existir `ports`, o Nginx deve continuar usando a porta interna:

```nginx
proxy_pass http://minha-aplicacao-app:3000;
```

## Portas: publicada vs interna

Porta publicada:

```yaml
ports:
  - "9032:3000"
```

Significa:

```text
host:9032 -> container:3000
```

Porta interna:

```text
container:3000
```

O Nginx na rede Docker deve usar sempre a porta interna do container:

```nginx
proxy_pass http://minha-aplicacao-app:3000;
```

Nao use a porta publicada no Nginx quando existir alias interno:

```nginx
proxy_pass http://192.168.100.4:9032;
```

## Bloco Nginx padrao

Exemplo HTTP para redirecionar para HTTPS:

```nginx
server {
    listen 80;
    server_name minha-aplicacao.herbamed.com.br;

    return 301 https://$host$request_uri;
}
```

Exemplo HTTPS:

```nginx
server {
    listen 443 ssl http2;
    server_name minha-aplicacao.herbamed.com.br;

    ssl_certificate /etc/letsencrypt/live/minha-aplicacao.herbamed.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/minha-aplicacao.herbamed.com.br/privkey.pem;

    location / {
        proxy_pass http://minha-aplicacao-app:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Se a aplicacao nao usa WebSocket, os headers `Upgrade` e `Connection` podem ficar; eles normalmente nao atrapalham.

## Ordem segura de deploy

Siga esta ordem para uma nova aplicacao:

1. Criar ou confirmar a rede compartilhada:

```bash
docker network inspect herbamed_proxy >/dev/null 2>&1 || docker network create herbamed_proxy
```

2. Configurar o compose da aplicacao com `networks.proxy.aliases`.

3. Subir a aplicacao antes de alterar o Nginx:

```bash
COMPOSE_PARALLEL_LIMIT=1 docker compose -p minha-aplicacao up -d --no-build
```

Se precisar buildar no servidor:

```bash
COMPOSE_PARALLEL_LIMIT=1 docker compose -p minha-aplicacao build --progress=plain app
COMPOSE_PARALLEL_LIMIT=1 docker compose -p minha-aplicacao up -d --no-build
```

4. Testar DNS interno a partir do Nginx:

```bash
docker exec nginx-proxy getent hosts minha-aplicacao-app
```

5. Testar a aplicacao a partir do Nginx:

```bash
docker exec nginx-proxy wget -qO- http://minha-aplicacao-app:3000/api/health
```

Se nao existir `/api/health`, teste a rota principal:

```bash
docker exec nginx-proxy wget -S -O- http://minha-aplicacao-app:3000/
```

6. So depois adicionar ou alterar o bloco no `nginx.conf`.

7. Testar o Nginx antes de recarregar:

```bash
docker exec nginx-proxy nginx -t
```

8. Recarregar sem recriar o container:

```bash
docker exec nginx-proxy nginx -s reload
```

9. Testar o dominio localmente pelo proprio servidor:

```bash
curl -k -I --max-time 15 \
  --resolve minha-aplicacao.herbamed.com.br:443:127.0.0.1 \
  https://minha-aplicacao.herbamed.com.br/
```

## Certificados TLS

Nunca adicione um bloco HTTPS apontando para certificado que ainda nao existe.

O Nginx falha a inicializacao inteira se qualquer arquivo abaixo nao existir:

```nginx
ssl_certificate /etc/letsencrypt/live/minha-aplicacao.herbamed.com.br/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/minha-aplicacao.herbamed.com.br/privkey.pem;
```

Antes de usar no `nginx.conf`, valide dentro do container:

```bash
docker exec nginx-proxy ls -la /etc/letsencrypt/live/minha-aplicacao.herbamed.com.br/
```

Se o certificado ainda nao existir:

1. Confirme que o DNS do dominio aponta para o servidor.
2. Emita o certificado com webroot.
3. Valide que os arquivos existem.
4. Somente entao adicione o bloco HTTPS.
5. Rode `nginx -t`.
6. Recarregue com `nginx -s reload`.

Exemplo de emissao com webroot:

```bash
sudo certbot certonly --webroot \
  -w /home/servidor/herbamedti/nginx-proxy/nginx-html \
  -d minha-aplicacao.herbamed.com.br
```

## O que nunca fazer

Nao aponte o `proxy_pass` para hostname que ainda nao resolve:

```nginx
proxy_pass http://container-que-nao-existe:3000;
```

Nao recarregue o Nginx antes de:

```bash
docker exec nginx-proxy getent hosts alias-da-aplicacao
docker exec nginx-proxy wget -qO- http://alias-da-aplicacao:porta/health
docker exec nginx-proxy nginx -t
```

Nao referencie certificado inexistente.

Nao use `docker compose up -d --build` em horario de uso para projetos grandes. Esse comando pode disparar build, recriacao de rede e troca de containers ao mesmo tempo.

Nao dependa de conexao manual feita apenas com:

```bash
docker network connect herbamed_proxy container
```

Isso resolve na hora, mas se perde quando o container e recriado. A rede deve estar declarada no `docker-compose.yml`.

## Quando usar docker network connect manual

Use apenas para recuperacao imediata ou manutencao emergencial:

```bash
docker network connect --alias minha-aplicacao-app herbamed_proxy herbamed_minha_aplicacao_app
```

Depois, persista no compose:

```yaml
networks:
  default:
  proxy:
    aliases:
      - minha-aplicacao-app
```

## Cuidados com Docker Desktop e WSL

Este servidor usa Docker Desktop com WSL2. Evite rodar deploy a partir de caminho UNC do Windows quando houver bind mounts do WSL, por exemplo:

```text
\\wsl.localhost\Ubuntu\home\servidor\...
```

Se aparecer erro parecido com:

```text
accessing specified distro mount service:
stat /run/guest-services/distro-services/ubuntu.sock: no such file or directory
```

prefira executar o compose dentro do Ubuntu/WSL, no caminho Linux:

```bash
cd /home/servidor/herbamedti/minha-aplicacao
docker compose up -d
```

Se o Docker daemon nao estiver acessivel dentro da distro Ubuntu, verifique a integracao do Docker Desktop com WSL antes de tentar recriar containers de producao.

## Checklist rapido para nova aplicacao

Antes de alterar o Nginx:

- [ ] A aplicacao tem `container_name` estavel.
- [ ] A aplicacao esta na rede externa `herbamed_proxy`.
- [ ] A aplicacao tem alias estavel, exemplo `minha-aplicacao-app`.
- [ ] O Nginx esta conectado a `herbamed_proxy`.
- [ ] `docker exec nginx-proxy getent hosts minha-aplicacao-app` funciona.
- [ ] `docker exec nginx-proxy wget -qO- http://minha-aplicacao-app:PORTA/health` funciona.
- [ ] O certificado existe antes de referenciar no `nginx.conf`.
- [ ] `docker exec nginx-proxy nginx -t` passa.
- [ ] Reload feito com `docker exec nginx-proxy nginx -s reload`.
- [ ] Teste local com `curl --resolve dominio:443:127.0.0.1` nao retorna `502` nem `504`.

## Comandos uteis

Ver redes de um container:

```bash
docker inspect nginx-proxy --format '{{range $name,$net := .NetworkSettings.Networks}}{{$name}} {{end}}'
```

Ver containers na rede compartilhada:

```bash
docker network inspect herbamed_proxy
```

Testar resolucao interna:

```bash
docker exec nginx-proxy getent hosts alias-da-aplicacao
```

Testar upstream interno:

```bash
docker exec nginx-proxy wget -S -O- http://alias-da-aplicacao:porta/
```

Testar config Nginx:

```bash
docker exec nginx-proxy nginx -t
```

Recarregar Nginx:

```bash
docker exec nginx-proxy nginx -s reload
```

Ver erros recentes do proxy:

```bash
docker logs --since=5m nginx-proxy | egrep 'upstream|host not found|certificate|connect\(\) failed|timed out|502|504'
```

## Padrao de nomes recomendado

Use nomes previsiveis:

```text
container_name: herbamed_nome_app
alias proxy: nome-app
dominio: nome.herbamed.com.br
```

Exemplo:

```text
container_name: herbamed_ocorrencias_app
alias proxy: ocorrencias-app
dominio: ocorrencias.herbamed.com.br
proxy_pass: http://ocorrencias-app:3000
```

Esse padrao deixa claro qual dominio aponta para qual upstream e reduz o risco de quebrar o Nginx durante deploys futuros.
