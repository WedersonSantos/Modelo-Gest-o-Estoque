# Criptografia de dados recuperáveis

Importação, somente no backend Node.js:

```ts
import { encrypt, decrypt } from "@/shared/lib/crypto";

const encrypted = encrypt("informação confidencial");
const original = decrypt(encrypted);
```

As funções usam APP_CRYPTO_KEY_HEX, APP_CRYPTO_PASSPHRASE e APP_CRYPTO_SALT_HEX do ambiente. Chave e salt precisam conter 64 caracteres hexadecimais (32 bytes). O módulo não escreve no .env nem inclui valores reais no código ou nos testes.

A derivação existente foi mantida: HKDF-SHA256, chave hexadecimal aleatória concatenada à frase, salt e contexto `mesa:aes-256-gcm:v1`, produzindo 32 bytes. Esse contexto é parte do formato v1; não o renomeie ao mudar a marca do restaurante, pois isso mudaria a chave derivada.

Formato persistido: `v1:ivHex:authTagHex:ciphertextHex`. AES-256-GCM utiliza IV novo de 12 bytes a cada encrypt e tag de 16 bytes. decrypt exige exatamente esse formato, inclusive comprimentos e hexadecimal, e rejeita adulteração durante a autenticação. Texto vazio e Unicode são suportados.

Use apenas onde o dado precisa ser recuperado, após definir os campos que serão protegidos. Este módulo não altera automaticamente fornecedores, CPF/CNPJ, buscas, índices ou registros existentes. As senhas dos usuários continuam com bcryptjs.

A troca de qualquer um dos três componentes do ambiente impede recuperar dados antigos. Uma futura rotação precisa identificar versões/chaves e manter acesso controlado à chave anterior durante a migração; a rotação ainda não está implementada. O prefixo v1 identifica o formato, não uma implementação completa de gestão de chaves.

No Netlify, configure as três variáveis para produção antes de utilizar estas funções e publique um novo deploy para aplicá-las. Não use NEXT_PUBLIC_ nem commit de .env. A variável ENCRYPTION_KEY configurada anteriormente não substitui essas três variáveis. O .env local foi preservado. Para esta publicação, as três variáveis foram configuradas em produção no Netlify como variáveis padrão, após autorização explícita do usuário, porque o recurso Secret retornou HTTP 403. Os valores não foram incluídos no Git e podem ser vistos por administradores do projeto no Netlify.

Testes: `tests/unit/crypto.test.ts`, com valores fictícios isolados em memória. Cobrem ida e volta, Unicode, texto vazio, IV diferente, adulteração de IV/tag/ciphertext, payload inválido, variáveis ausentes ou inválidas, derivação determinística e erro ao usar outros componentes de chave.

Referência das primitivas: [Node.js Crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html).
