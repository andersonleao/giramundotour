import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

await page.goto('http://localhost:3000/login.html');
await page.evaluate(() => {
    localStorage.setItem('giramundo_token', 'fake-token');
    localStorage.setItem('giramundo_user', JSON.stringify({id:'1',nome:'Admin',email:'admin@test.com',perfil:'admin'}));
});

await page.goto('http://localhost:3000/index.html');
await page.waitForTimeout(1500);

await page.evaluate(() => {
    document.getElementById('origemCode').value = 'GRU';
    document.getElementById('origem').value = 'São Paulo (GRU)';
    document.getElementById('destinoCode').value = 'GIG';
    document.getElementById('destino').value = 'Rio de Janeiro (GIG)';
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const returnDate = new Date();
    returnDate.setDate(returnDate.getDate() + 37);
    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('dataIda').value = fmt(futureDate);
    document.getElementById('dataVolta').value = fmt(returnDate);
});

await page.evaluate(() => SearchModule.executarBusca());
await page.waitForTimeout(3000);

// Seleciona ida
await page.locator('#modalVoos .btn-selecionar-voo').first().click();
await page.waitForTimeout(1500);

// Seleciona volta
await page.locator('#modalVoos .btn-selecionar-voo').first().click();
await page.waitForTimeout(1500);

// Verifica o voo selecionado
const vooData = await page.evaluate(() => {
    const ida = SearchModule.voosSelecionados.ida;
    const volta = SearchModule.voosSelecionados.volta;
    return {
        ida: ida ? { preco: ida.preco, precoType: typeof ida.preco, keys: Object.keys(ida) } : null,
        volta: volta ? { preco: volta.preco, precoType: typeof volta.preco } : null,
        passageiros: SearchModule.resultados?.passageiros
    };
});
console.log('Voo selecionado:', JSON.stringify(vooData, null, 2));

// Testa calcularPrecos diretamente
const calcResult = await page.evaluate(() => {
    const dadosCotacao = {
        voos: [SearchModule.voosSelecionados.ida],
        passageiros: SearchModule.resultados.passageiros
    };
    if (SearchModule.voosSelecionados.volta) {
        dadosCotacao.voos.push(SearchModule.voosSelecionados.volta);
    }
    QuotationModule.novaCotacao(dadosCotacao);
    return {
        cotacaoAtual: QuotationModule.cotacaoAtual,
        passageirosType: typeof QuotationModule.cotacaoAtual?.passageiros,
        passageirosKeys: QuotationModule.cotacaoAtual?.passageiros ? Object.keys(QuotationModule.cotacaoAtual.passageiros) : null,
        adultos: QuotationModule.cotacaoAtual?.passageiros?.adultos,
        adultosType: typeof QuotationModule.cotacaoAtual?.passageiros?.adultos
    };
});
console.log('Calc result:', JSON.stringify(calcResult, null, 2));

// Tenta render
const renderResult = await page.evaluate(() => {
    try {
        QuotationModule.render();
        const content = document.getElementById('cotacaoContent');
        return { success: true, html: content?.innerHTML.substring(0, 500) };
    } catch(e) {
        return { success: false, error: e.message, stack: e.stack };
    }
});
console.log('Render result:', JSON.stringify(renderResult, null, 2));

console.log('\nERROS:', errors.length > 0 ? JSON.stringify(errors, null, 2) : 'Nenhum');

await browser.close();
