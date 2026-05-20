const jwt = require('jsonwebtoken');
const freshToken = jwt.sign(
    { id: '2d097383-2831-481c-9b4b-f3c98e5b1dae', email: 'operador@giramundotour.com.br', perfil: 'operador' },
    'giramundotour_jwt_secret_key_2024_altere_em_producao',
    { expiresIn: '2h' }
);
const BASE = 'https://giramundotour.onrender.com';
const h = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + freshToken });

(async () => {
    const t0 = Date.now();
    const e = () => ((Date.now()-t0)/1000).toFixed(0) + 's';

    console.log('Aguardando deploy (40s)...');
    await new Promise(r => setTimeout(r, 40000));

    console.log(`[${e()}] POST /gol-lookup...`);
    const start = await fetch(`${BASE}/api/reservas/gol-lookup`, {
        method: 'POST', headers: h(),
        body: JSON.stringify({ pnr: 'SEOBQV', origin: 'BSB', lastName: 'SILVA' })
    }).catch(e => { console.log('POST falhou:', e.message); return null; });
    if (!start) return;
    const sd = await start.json();
    console.log(`[${e()}] Resposta POST:`, JSON.stringify(sd));
    if (!sd.jobId) return;

    // Poll por até 130s (cobre hard timeout 120s + margem)
    for (let i = 1; i <= 65; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const r = await fetch(`${BASE}/api/reservas/gol-status/${sd.jobId}`, { headers: h() }).catch(() => null);
        if (!r) { console.log(`[${e()}] poll #${i}: sem resposta`); continue; }
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('json')) { console.log(`[${e()}] poll #${i}: HTML — servidor reiniciou`); continue; }
        const data = await r.json();
        const info = [data.status, data.error||'', data.pageTitle||''].filter(Boolean).join(' | ');
        console.log(`[${e()}] poll #${i}: ${info}`);
        if (data.status === 'done') {
            const bd = data.bilheteData;
            console.log(`\n✅ SUCESSO em ${e()}`);
            console.log(`IDA:   ${bd?.ida?.origem} → ${bd?.ida?.destino}  ${bd?.ida?.data}  ${bd?.ida?.voo}`);
            console.log(`VOLTA: ${bd?.volta ? bd.volta.origem+'→'+bd.volta.destino+' '+bd.volta.data : '(sem)'}`);
            return;
        }
        if (data.status === 'failed') { console.log(`\n❌ FALHOU: ${data.error}`); return; }
    }
    console.log(`\n❌ TIMEOUT ${e()}`);
})();
