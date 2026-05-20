import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
const logs = [];
page.on('console', msg => {
    const txt = msg.text();
    if (msg.type() === 'error') errors.push(txt);
    else logs.push(txt);
});
page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

// Login
await page.goto('http://localhost:3000/login.html');
await page.evaluate(() => {
    localStorage.setItem('giramundo_token', 'fake-token');
    localStorage.setItem('giramundo_user', JSON.stringify({id:'1',nome:'Admin',email:'admin@test.com',perfil:'admin'}));
});
await page.goto('http://localhost:3000/index.html');
await page.waitForTimeout(1500);

// Busca
await page.evaluate(() => {
    document.getElementById('origemCode').value = 'GRU';
    document.getElementById('origem').value = 'São Paulo (GRU)';
    document.getElementById('destinoCode').value = 'GIG';
    document.getElementById('destino').value = 'Rio de Janeiro (GIG)';
    const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 30);
    const returnDate = new Date(); returnDate.setDate(returnDate.getDate() + 37);
    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('dataIda').value = fmt(futureDate);
    document.getElementById('dataVolta').value = fmt(returnDate);
});
await page.evaluate(() => SearchModule.executarBusca());
await page.waitForTimeout(3000);

// Selecionar voos
const modalVisible = await page.evaluate(() => {
    const m = document.getElementById('modalVoos');
    return m ? m.classList.contains('show') : false;
});
console.log('Modal aberto:', modalVisible);

if (modalVisible) {
    await page.locator('#modalVoos .btn-selecionar-voo').first().click();
    await page.waitForTimeout(1500);
    const voltaModal = await page.evaluate(() => {
        const m = document.getElementById('modalVoos');
        return m ? m.classList.contains('show') : false;
    });
    if (voltaModal) {
        await page.locator('#modalVoos .btn-selecionar-voo').first().click();
        await page.waitForTimeout(1500);
    }
}

// Criar Cotação
const btnCot = page.locator('button:has-text("Criar Cotação")');
const btnCount = await btnCot.count();
console.log('Botões Criar Cotação:', btnCount);

if (btnCount > 0) {
    await btnCot.first().click();
    await page.waitForTimeout(2000);
}

// Debug: estado da página
const debug = await page.evaluate(() => {
    const cotacao = QuotationModule.cotacaoAtual;
    const content = document.getElementById('cotacaoContent');
    const activeSections = [];
    document.querySelectorAll('.page-section.active').forEach(s => activeSections.push(s.id));

    return {
        activeSections,
        cotacaoExists: !!cotacao,
        cotacaoVoos: cotacao?.voos?.length,
        cotacaoPrecos: cotacao?.precos,
        contentExists: !!content,
        contentEmpty: content?.innerHTML.trim() === '',
        contentSnippet: content?.innerHTML.substring(0, 500) || 'N/A',
        hash: window.location.hash
    };
});

console.log('\nDEBUG Estado:');
console.log(JSON.stringify(debug, null, 2));

console.log('\nLogs relevantes:');
logs.filter(l => l.includes('GiraMundoTour') || l.includes('Cotação') || l.includes('cotacao')).forEach(l => console.log('  ', l));

console.log('\nErros:', errors.length > 0 ? JSON.stringify(errors, null, 2) : 'Nenhum');

await browser.close();
