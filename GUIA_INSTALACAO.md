# 🌿 Herbamed RNC — Guia de Instalação e Publicação
### Sistema de Registro de Não Conformidades · Versão 1.0

---

## 📋 O QUE VOCÊ VAI PRECISAR
- Conta Google (para o Firebase)
- Conta GitHub (gratuita) → github.com
- Conta Vercel (gratuita) → vercel.com
- Node.js instalado no computador → nodejs.org (baixe a versão LTS)

Tempo estimado: **30 a 45 minutos** (primeira vez)

---

## PASSO 1 — CRIAR O BANCO DE DADOS NO FIREBASE

### 1.1 — Criar o projeto
1. Acesse https://console.firebase.google.com
2. Clique em **"Criar um projeto"**
3. Nome: `herbamed-rnc`
4. Desative o Google Analytics (não precisa) → **Criar projeto**

### 1.2 — Ativar autenticação de usuários
1. No menu esquerdo: **Autenticação** → **Primeiros passos**
2. Clique em **E-mail/senha** → Ativar → **Salvar**

### 1.3 — Criar o banco de dados (Firestore)
1. No menu esquerdo: **Firestore Database** → **Criar banco de dados**
2. Selecione **"Iniciar no modo de produção"** → Avançar
3. Escolha a região: `southamerica-east1 (São Paulo)` → **Ativar**

### 1.4 — Configurar regras de segurança do Firestore
1. Dentro do Firestore → aba **Regras**
2. Substitua todo o conteúdo por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (request.auth.uid == userId || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    match /rncs/{rncId} {
      allow read, write: if request.auth != null;
    }
    match /meta/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Clique em **Publicar**

### 1.5 — Obter as credenciais do projeto
1. Clique na engrenagem ⚙️ → **Configurações do projeto**
2. Role para baixo até **"Seus aplicativos"**
3. Clique em **"</>** (Web)"
4. Nome do app: `herbamed-rnc-web` → **Registrar app**
5. Copie o objeto `firebaseConfig` que aparecer. Exemplo:
```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "herbamed-rnc.firebaseapp.com",
  projectId: "herbamed-rnc",
  storageBucket: "herbamed-rnc.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## PASSO 2 — CONFIGURAR O PROJETO

### 2.1 — Colar as credenciais
1. Abra o arquivo `src/firebaseConfig.js` (está na pasta do projeto)
2. Substitua os valores pelos que você copiou no passo 1.5
3. Salve o arquivo

### 2.2 — Criar o primeiro usuário Admin
1. No Firebase Console → **Autenticação** → **Usuários** → **Adicionar usuário**
2. E-mail: seu e-mail real (ex: lucas@herbamed.com)
3. Senha: crie uma senha forte
4. Clique em **Adicionar usuário**
5. Copie o **UID** que aparecer (string longa como `abc123xyz...`)

### 2.3 — Criar o perfil do usuário no Firestore
1. No Firebase → **Firestore Database** → **Iniciar coleção**
2. ID da coleção: `users`
3. ID do documento: cole o **UID** copiado acima
4. Adicione os campos:
   - `name` (string): `Lucas Ribeiro` (seu nome)
   - `email` (string): `lucas@herbamed.com`
   - `role` (string): `admin`
   - `setor` (string): `Controle de Qualidade`
5. Clique em **Salvar**

✅ Pronto! Agora você já pode criar os demais usuários direto pelo sistema (aba Admin).

---

## PASSO 3 — PUBLICAR NA VERCEL

### 3.1 — Subir o código no GitHub
1. Acesse github.com → faça login → **New repository**
2. Nome: `herbamed-rnc` → **Create repository**
3. Abra o terminal/prompt na pasta do projeto e execute:
```bash
git init
git add .
git commit -m "Sistema RNC Herbamed v1.0"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/herbamed-rnc.git
git push -u origin main
```

### 3.2 — Publicar na Vercel
1. Acesse vercel.com → **Sign Up** com sua conta GitHub
2. Clique em **"Add New Project"**
3. Importe o repositório `herbamed-rnc`
4. Clique em **Deploy** (as configurações padrão já funcionam)
5. Aguarde ~2 minutos

✅ Seu sistema estará online em um endereço como:
**`https://herbamed-rnc.vercel.app`**

---

## PASSO 4 — ADICIONAR DOMÍNIO PERSONALIZADO (opcional)

Se quiser um endereço como `rnc.herbamed.com.br`:
1. Na Vercel → seu projeto → **Settings** → **Domains**
2. Adicione seu domínio
3. Configure o DNS onde seu domínio está registrado

---

## 📱 COMO OS USUÁRIOS VÃO ACESSAR

Basta enviar o link (ex: `https://herbamed-rnc.vercel.app`) para cada pessoa.
- Funciona em qualquer navegador (Chrome, Edge, Firefox, Safari)
- Funciona no celular e no computador
- **Não precisa instalar nada**
- **Não precisa de conta no Claude**

---

## 👥 GERENCIAR USUÁRIOS

Após o primeiro acesso como Admin:
1. Vá na aba **⚙️ Admin**
2. Preencha nome, e-mail, senha, setor e perfil
3. Clique em **Criar usuário**
4. O sistema cria automaticamente o acesso no Firebase
5. Envie o e-mail e senha para a pessoa

Para **editar** um usuário: clique em ✏️ Editar
Para **remover** um usuário: clique em 🗑️ Remover

---

## 🔄 ATUALIZAR O SISTEMA NO FUTURO

Sempre que o código for alterado e enviado ao GitHub, a Vercel atualiza automaticamente em ~1 minuto.

```bash
git add .
git commit -m "Descrição da atualização"
git push
```

---

## ❓ DÚVIDAS FREQUENTES

**Os dados ficam salvos onde?**
No Firebase (Google), em servidores em São Paulo. É seguro e com backup automático.

**E se a Vercel ficar fora do ar?**
A Vercel tem 99.99% de uptime. Mas os dados ficam no Firebase, então nunca se perdem.

**Posso usar sem internet?**
Não. O sistema é online e requer conexão.

**Quantos usuários posso ter?**
O plano gratuito do Firebase suporta até ~50.000 leituras/dia, o que é mais que suficiente para equipes pequenas.

---

## 📞 SUPORTE

Em caso de dúvidas durante a configuração, entre em contato com o responsável técnico ou consulte:
- Firebase Docs: https://firebase.google.com/docs
- Vercel Docs: https://vercel.com/docs

---

*Herbamed® · Sistema RNC v1.0 · Gestão da Qualidade*
