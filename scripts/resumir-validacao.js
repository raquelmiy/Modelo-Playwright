// @ts-check
/**
 * Lê o JSON de um `sf project deploy start --dry-run` e escreve um resumo legível.
 *
 * A saída crua da CLI é um JSON de milhares de linhas: no log do CI, ninguém lê. O que
 * interessa cabe em poucas linhas — se o que está no repositório ainda é aplicável na org e,
 * quando não é, quais componentes divergiram e por quê.
 *
 * Sai com código 1 quando a validação falhou, para o passo do workflow ficar vermelho.
 *
 * Uso: node scripts/resumir-validacao.js deploy.json
 */
const fs = require('fs');

const MAX_LINHAS = 25;

/** @param {any} f */
const nomeDoComponente = (f) => [f.componentType, f.fullName].filter(Boolean).join(' · ') || f.fileName || '(sem nome)';

function main() {
    const arquivo = process.argv[2];
    if (!arquivo || !fs.existsSync(arquivo)) {
        console.log(`Não achei o resultado da validação (${arquivo || 'sem arquivo'}).`);
        console.log('A CLI provavelmente nem chegou a rodar — o log do passo anterior diz por quê.');
        return 1;
    }

    let dados;
    try {
        dados = JSON.parse(fs.readFileSync(arquivo, 'utf-8'));
    } catch (error) {
        console.log('## Validação de metadados');
        console.log('');
        console.log(`A saída da CLI não é um JSON válido: ${error instanceof Error ? error.message : error}`);
        return 1;
    }

    const r = dados.result || {};
    const total = r.numberComponentsTotal ?? 0;
    const erros = r.numberComponentErrors ?? 0;
    // A CLI usa dois formatos conforme a versão e o tipo de falha; os dois viram a mesma lista.
    const bruto = r.details?.componentFailures ?? r.files?.filter((/** @type {any} */ f) => f.state === 'Failed') ?? [];
    const falhas = Array.isArray(bruto) ? bruto : [bruto];

    console.log('## Validação de metadados');
    console.log('');

    if (dados.status === 0 && r.success) {
        console.log(`Os ${total} componentes do manifest continuam aplicáveis na org, sem divergência.`);
        console.log('');
        console.log('_Nada foi gravado: a validação roda em `--dry-run`._');
        return 0;
    }

    console.log(`**${erros || falhas.length} de ${total} componentes não puderam ser aplicados.**`);
    console.log('');
    console.log('Isso mede a distância entre o que está no repositório e o que a org tem hoje.');
    console.log('');

    if (falhas.length) {
        console.log('| Componente | Problema |');
        console.log('| --- | --- |');
        for (const f of falhas.slice(0, MAX_LINHAS)) {
            const problema = String(f.problem || f.error || f.message || '—').replace(/\s*\|\s*/g, ' / ');
            console.log(`| ${nomeDoComponente(f)} | ${problema} |`);
        }
        if (falhas.length > MAX_LINHAS) {
            console.log('');
            console.log(`_E mais ${falhas.length - MAX_LINHAS}. A lista completa está no log do passo anterior._`);
        }
    } else if (dados.message) {
        console.log(`A validação não chegou a comparar os componentes: ${dados.message}`);
    }

    console.log('');
    console.log('_Nada foi gravado: a validação roda em `--dry-run`._');
    return 1;
}

process.exitCode = main();
