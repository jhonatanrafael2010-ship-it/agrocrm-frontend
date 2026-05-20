# Seed Data para Modo Offline

Este diretório contém dados pré-carregados que permitem o app funcionar offline desde a primeira abertura.

## Como funciona

1. Na primeira abertura do app, se o IndexedDB estiver vazio, carrega `data.json`
2. Quando conectar à internet, os dados são atualizados pela API
3. Após a primeira sincronização, o seed não é mais usado

## Como atualizar o seed

### Opção 1: Via API (recomendado)

```bash
# Gerar seed atualizado do banco de produção
curl https://agrocrm-backend.onrender.com/api/admin/generate-seed > data.json

# Ou local
curl http://localhost:5000/api/admin/generate-seed > data.json
```

### Opção 2: Via navegador

1. Acesse: https://agrocrm-backend.onrender.com/api/admin/generate-seed
2. Copie o JSON retornado
3. Cole em `public/seed/data.json`

## Quando atualizar

- Quando adicionar novos consultores
- Quando adicionar muitos clientes novos
- Antes de gerar uma nova versão do APK

## Verificar estatísticas

```bash
curl https://agrocrm-backend.onrender.com/api/admin/seed-stats
```

Retorna quantos registros seriam incluídos no seed.
