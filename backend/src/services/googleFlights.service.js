/**
 * GiraMundoTour - Google Flights Scraper Service
 *
 * Web scraping do Google Flights via Puppeteer para busca de voos reais.
 * Usa URL parametrizada que já abre a página de resultados diretamente.
 * Fallback para Flights Sky API / dados simulados se scraping falhar.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class GoogleFlightsService {
    constructor() {
        this.browser = null;
        this.cache = new Map();
        this.cacheTTL = 15 * 60 * 1000; // 15 minutos
        this.scraping = false; // semáforo simples
        this.scrapeTimeout = 12000; // 12s timeout por scrape
        this.debugDir = path.join(__dirname, '..', '..', 'debug');
    }

    // ============================================================
    //  BROWSER MANAGEMENT
    // ============================================================

    async getBrowser() {
        if (this.browser && this.browser.connected) {
            return this.browser;
        }

        this.browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/usr/bin/chromium-browser',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--lang=pt-BR',
                '--disable-blink-features=AutomationControlled'
            ],
            defaultViewport: { width: 1920, height: 1080 }
        });

        this.browser.on('disconnected', () => {
            this.browser = null;
        });

        return this.browser;
    }

    async closeBrowser() {
        if (this.browser) {
            try { await this.browser.close(); } catch (e) { /* ignore */ }
            this.browser = null;
        }
    }

    // ============================================================
    //  CACHE
    // ============================================================

    getCacheKey(params) {
        return `${params.origem}-${params.destino}-${params.dataIda}-${params.classe || 'economica'}-${params.adultos || 1}`;
    }

    getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.cacheTTL) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
        if (this.cache.size > 50) {
            const now = Date.now();
            for (const [k, v] of this.cache) {
                if (now - v.timestamp > this.cacheTTL) this.cache.delete(k);
            }
        }
    }

    // ============================================================
    //  ENTRY POINT
    // ============================================================

    async buscarVoos(params) {
        const cacheKeyIda = this.getCacheKey(params);
        const cachedIda = this.getFromCache(cacheKeyIda);

        let cacheKeyVolta = null;
        let cachedVolta = null;

        if (params.dataVolta) {
            cacheKeyVolta = this.getCacheKey({
                ...params,
                origem: params.destino,
                destino: params.origem,
                dataIda: params.dataVolta
            });
            cachedVolta = this.getFromCache(cacheKeyVolta);
        }

        if (cachedIda && (!params.dataVolta || cachedVolta)) {
            console.log('📦 Google Flights: retornando do cache');
            return { ida: cachedIda, volta: cachedVolta || [] };
        }

        // Semáforo
        const maxWait = 60000;
        const waitStart = Date.now();
        while (this.scraping && Date.now() - waitStart < maxWait) {
            await new Promise(r => setTimeout(r, 500));
        }

        this.scraping = true;
        try {
            let voosIda = cachedIda;
            if (!voosIda) {
                console.log(`🌐 Google Flights: scraping ida ${params.origem} → ${params.destino} em ${params.dataIda}`);
                voosIda = await this.scrapeFlights({
                    origem: params.origem,
                    destino: params.destino,
                    data: params.dataIda,
                    classe: params.classe,
                    adultos: params.adultos || 1,
                    tipo: 'ida'
                });
                if (voosIda.length > 0) this.setCache(cacheKeyIda, voosIda);
            }

            let voosVolta = cachedVolta || [];
            if (params.dataVolta && !cachedVolta) {
                console.log(`🌐 Google Flights: scraping volta ${params.destino} → ${params.origem} em ${params.dataVolta}`);
                voosVolta = await this.scrapeFlights({
                    origem: params.destino,
                    destino: params.origem,
                    data: params.dataVolta,
                    classe: params.classe,
                    adultos: params.adultos || 1,
                    tipo: 'volta'
                });
                if (voosVolta.length > 0) this.setCache(cacheKeyVolta, voosVolta);
            }

            return { ida: voosIda, volta: voosVolta };
        } finally {
            this.scraping = false;
        }
    }

    // ============================================================
    //  CONSTRUIR URL DO GOOGLE FLIGHTS
    // ============================================================

    /**
     * Constrói a URL do Google Flights com resultados de busca.
     * Formato: /travel/flights/search?tfs=<protobuf_encoded>
     *
     * O Google Flights usa um parâmetro `tfs` com dados protobuf codificados em base64.
     * Abordagem alternativa: usar o formato de URL legível com query params.
     */
    // ============================================================
    //  CONSTRUIR URL COM PARÂMETRO TFS (protobuf Google Flights)
    // ============================================================

    /**
     * Constrói o parâmetro tfs do Google Flights (protobuf binário, base64url).
     * Estrutura: itinerary{ segment{ date, origin{code}, destination{code} } }, trip_type=1
     */
    buildTfs(origem, destino, data) {
        function encodeVarInt(n) {
            const b = [];
            while (n > 127) { b.push((n & 0x7F) | 0x80); n >>>= 7; }
            b.push(n & 0x7F);
            return Buffer.from(b);
        }
        function ld(fieldNum, content) {
            return Buffer.concat([
                encodeVarInt((fieldNum << 3) | 2),
                encodeVarInt(content.length),
                content
            ]);
        }
        function sf(fieldNum, str) { return ld(fieldNum, Buffer.from(str, 'utf8')); }

        // segment: { 1: date, 3: origin{2: code}, 4: dest{2: code} }
        const segment = Buffer.concat([sf(1, data), ld(3, sf(2, origem)), ld(4, sf(2, destino))]);
        // itinerary: { 1: segment }
        const itinerary = ld(1, segment);
        // root: { 1: itinerary, 2: 1 (one-way) }
        const root = Buffer.concat([ld(1, itinerary), Buffer.from([0x10, 0x01])]);
        return root.toString('base64url');
    }

    // ============================================================
    //  SCRAPING — navega diretamente para URL com tfs
    // ============================================================

    async scrapeFlights({ origem, destino, data, classe, adultos, tipo }) {
        let page = null;
        try {
            const browser = await this.getBrowser();
            page = await browser.newPage();

            await page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            );
            await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' });
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
            });

            const tfs = this.buildTfs(origem, destino, data);
            const url = `https://www.google.com/travel/flights?hl=pt-BR&gl=br&curr=BRL&tfs=${tfs}`;
            console.log(`🔗 URL tfs: ${url}`);

            await page.goto(url, { waitUntil: 'networkidle2', timeout: this.scrapeTimeout });
            await this.handleConsentDialog(page);
            await this.sleep(2000);

            // Clicar no botão Pesquisar para disparar a busca (tfs preenche o form mas não executa)
            const clicou = await page.evaluate(() => {
                // Botão dentro do container jsname="c6xFrd"
                const container = document.querySelector('[jsname="c6xFrd"]');
                const btn = container ? container.querySelector('button') : null;
                if (btn) { btn.click(); return true; }
                // Fallback: qualquer botão com texto Pesquisar/Search
                const btns = [...document.querySelectorAll('button')];
                const pesquisar = btns.find(b => {
                    const t = (b.textContent || '').trim();
                    return t === 'Pesquisar' || t === 'Search';
                });
                if (pesquisar) { pesquisar.click(); return true; }
                return false;
            });
            console.log(clicou ? '🔍 Botão Pesquisar clicado' : '⚠️ Botão Pesquisar não encontrado');

            // Aguardar resultados carregarem após o clique
            await this.sleep(5000);

            await this.saveDebugScreenshot(page, `gf-${origem}-${destino}-${tipo}`);
            await this.saveDebugHtml(page, `gf-${origem}-${destino}-${tipo}`);

            await this.waitForResults(page);
            await this.expandAllFlights(page);

            const rawFlights = await this.extractFlights(page);
            console.log(`📊 Google Flights: ${rawFlights.length} voos brutos encontrados`);

            if (rawFlights.length === 0) {
                console.log('⚠️ Nenhum voo extraído — verifique backend/debug/');
                return [];
            }

            const voos = this.formatFlights(rawFlights, { origem, destino, data, classe, tipo });
            console.log(`✅ Google Flights: ${voos.length} voos formatados para ${tipo}`);
            return voos;

        } catch (error) {
            console.error(`❌ Google Flights scraping falhou: ${error.message}`);
            if (page) await this.saveDebugScreenshot(page, `gf-error-${tipo}`).catch(() => {});
            return [];
        } finally {
            if (page) {
                try { await page.close(); } catch (e) { /* ignore */ }
            }
        }
    }

    // ============================================================
    //  CONSENT DIALOG
    // ============================================================

    async handleConsentDialog(page) {
        try {
            const consentSelectors = [
                'button[aria-label="Aceitar tudo"]',
                'button[aria-label="Accept all"]',
                '#L2AGLb',
                'button[jsname="b3VHJd"]',
                'form[action*="consent"] button:last-child'
            ];

            for (const sel of consentSelectors) {
                const btn = await page.$(sel);
                if (btn) {
                    console.log('🔓 Aceitando consent dialog do Google');
                    await btn.click();
                    await this.sleep(2000);
                    return true;
                }
            }

            // Tentar pelo texto
            const clicked = await page.evaluate(() => {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = (btn.textContent || '').trim().toLowerCase();
                    if (text === 'aceitar tudo' || text === 'accept all' || text === 'i agree' || text === 'concordo') {
                        btn.click();
                        return true;
                    }
                }
                return false;
            });

            if (clicked) {
                console.log('🔓 Consent dialog aceito via texto');
                await this.sleep(2000);
                return true;
            }
        } catch (e) {
            // Sem consent dialog
        }
        return false;
    }

    // ============================================================
    //  EXPANDIR TODOS OS VOOS
    // ============================================================

    async expandAllFlights(page) {
        // O Google Flights esconde voos atrás de botões "Mostrar mais voos" / "Show more flights"
        // Clicar repetidamente até não ter mais botão
        const maxClicks = 10;
        for (let i = 0; i < maxClicks; i++) {
            const clicked = await page.evaluate(() => {
                // Seletores para botões "mostrar mais"
                const selectors = [
                    'button[aria-label*="mais voos"]',
                    'button[aria-label*="more flights"]',
                    'button[aria-label*="Mostrar mais"]',
                    'button[aria-label*="Show more"]'
                ];

                for (const sel of selectors) {
                    const btn = document.querySelector(sel);
                    if (btn && btn.offsetParent !== null) {
                        btn.click();
                        return true;
                    }
                }

                // Fallback: procurar pelo texto do botão
                const allButtons = document.querySelectorAll('button');
                for (const btn of allButtons) {
                    const text = (btn.textContent || '').toLowerCase().trim();
                    if ((text.includes('mostrar mais voos') || text.includes('more flights') || text.includes('mostrar mais')) && btn.offsetParent !== null) {
                        btn.click();
                        return true;
                    }
                }

                // Tentar links/spans clicáveis com "Mostrar mais"
                const clickables = document.querySelectorAll('span, a, div[role="button"]');
                for (const el of clickables) {
                    const text = (el.textContent || '').toLowerCase().trim();
                    if ((text === 'mostrar mais voos' || text === 'mostrar mais' || text.includes('more flights')) && el.offsetParent !== null) {
                        el.click();
                        return true;
                    }
                }

                return false;
            });

            if (clicked) {
                console.log(`📋 Clicou "Mostrar mais voos" (${i + 1})`);
                await this.sleep(2000); // Esperar carregar mais resultados
            } else {
                break; // Não tem mais botão
            }
        }
    }

    // ============================================================
    //  AGUARDAR RESULTADOS
    // ============================================================

    async waitForResults(page) {
        // Lista de seletores que indicam que os resultados carregaram
        const selectors = [
            'li.pIav2d',
            '[data-resultid]',
            '.Rk10dc',
            '[jsname="IWWIKb"]',
            'div.yR1fYc',
            'div.nrc6c',
            'ol[class*="flight"] > li',
            'ul[jsname] > li.pIav2d'
        ];

        for (const sel of selectors) {
            try {
                await page.waitForSelector(sel, { timeout: 10000 });
                console.log(`✅ Resultados encontrados com selector: ${sel}`);
                await this.sleep(2000); // esperar renderizar completamente
                return true;
            } catch (e) {
                // próximo selector
            }
        }

        // Se não encontrou seletores conhecidos, verificar se tem conteúdo de voo na página
        const hasFlightContent = await page.evaluate(() => {
            const text = document.body.textContent || '';
            // Exige R$ + pelo menos 4 horários (indicativo de múltiplos voos) + código IATA
            const horarios = (text.match(/\d{1,2}:\d{2}/g) || []).length;
            const temPreco = text.includes('R$');
            const temIATA  = /\b[A-Z]{3}\b/.test(text);
            return temPreco && horarios >= 4 && temIATA;
        });

        if (hasFlightContent) {
            console.log('✅ Conteúdo de voos detectado na página (via texto)');
            await this.sleep(2000);
            return true;
        }

        console.log('⚠️ Não encontrou indicadores de resultados de voo');
        await this.sleep(3000); // esperar mais um pouco por garantia
        return false;
    }

    // ============================================================
    //  EXTRAÇÃO DE DADOS
    // ============================================================

    async extractFlights(page) {
        return await page.evaluate(() => {
            const results = [];

            // Normalizar texto: converter &nbsp; (U+00A0) para espaço normal
            function norm(text) {
                return (text || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
            }

            // Buscar itens li.pIav2d (formato confirmado do Google Flights)
            const flightItems = document.querySelectorAll('li.pIav2d');

            for (const item of flightItems) {
                try {
                    const text = norm(item.textContent);
                    if (!text) continue;

                    // Preço: "R$ 422" ou "R$ 1.422" ou "R$ 422,00"
                    // No Google Flights o &nbsp; vira \u00A0 — já normalizado
                    const precoMatch = text.match(/R\$\s*([\d.,]+)/);
                    if (!precoMatch) continue;

                    let precoStr = precoMatch[1];
                    // "1.422" → 1422, "422" → 422, "1.422,00" → 1422.00
                    if (precoStr.includes(',')) {
                        precoStr = precoStr.replace(/\./g, '').replace(',', '.');
                    } else {
                        precoStr = precoStr.replace(/\./g, '');
                    }
                    const preco = parseFloat(precoStr);
                    if (isNaN(preco) || preco < 50 || preco > 50000) continue;

                    // Horários: "06:00 06:00 em dom., 15 de mar. – 07:05 07:05 em dom."
                    // Formato: o primeiro HH:MM é a partida, depois de " – " vem outro HH:MM que é chegada
                    // Padrão: pegar primeiro e segundo HH:MM que aparecem separados por " – "
                    const allTimes = text.match(/(\d{1,2}:\d{2})/g);
                    if (!allTimes || allTimes.length < 2) continue;

                    // O texto contém hora duplicada: "06:00 06:00 em ... – 07:05 07:05 em ..."
                    // Primeiro horário = partida, o segundo horário diferente do primeiro = chegada
                    const horarioPartida = allTimes[0];
                    let horarioChegada = '';
                    for (let i = 1; i < allTimes.length; i++) {
                        if (allTimes[i] !== horarioPartida) {
                            horarioChegada = allTimes[i];
                            break;
                        }
                    }
                    if (!horarioChegada) continue;

                    // Duração: "1h 5 min" ou "2h 30 min" ou "1h" ou "45 min"
                    let duracaoMin = 0;
                    let duracaoTexto = '';
                    const duracaoMatch = text.match(/(\d+)\s*h\s*(\d+)?\s*(?:min)?/) ||
                                        text.match(/(\d+)\s*min/);
                    if (duracaoMatch) {
                        if (duracaoMatch[0].includes('h')) {
                            const h = parseInt(duracaoMatch[1]) || 0;
                            const m = parseInt(duracaoMatch[2]) || 0;
                            duracaoMin = h * 60 + m;
                            duracaoTexto = `${h}h ${m}min`;
                        } else {
                            duracaoMin = parseInt(duracaoMatch[1]) || 0;
                            duracaoTexto = `0h ${duracaoMin}min`;
                        }
                    }

                    // Companhia: buscar no texto e em imagens
                    let companhia = '';
                    let logoUrl = '';
                    const imgs = item.querySelectorAll('img');
                    for (const img of imgs) {
                        const alt = norm(img.getAttribute('alt'));
                        if (alt && alt.length > 1 && !alt.match(/^(logo|icon|image|carbon)/i)) {
                            companhia = alt;
                            logoUrl = img.src || '';
                            break;
                        }
                    }
                    // Fallback: buscar nomes de companhias no texto
                    if (!companhia) {
                        // Usar innerText dos spans diretos (mais preciso)
                        const spans = item.querySelectorAll('span');
                        for (const span of spans) {
                            const st = norm(span.textContent);
                            // Nome curto de companhia (entre 2-30 chars, sem números)
                            if (st.length >= 2 && st.length <= 30 && !/\d/.test(st) && !/R\$/.test(st) && !/escala/i.test(st) && !/emiss/i.test(st) && !/kg/.test(st) && !/Aeroporto/i.test(st) && !/Selecionar/i.test(st) && !/Partida/i.test(st)) {
                                const cias = ['LATAM', 'Latam', 'Gol', 'GOL', 'Azul', 'Avianca', 'American', 'United', 'Delta', 'TAP', 'Copa', 'Iberia', 'Air France', 'Lufthansa', 'British'];
                                for (const c of cias) {
                                    if (st.includes(c)) { companhia = st; break; }
                                }
                                if (companhia) break;
                            }
                        }
                    }
                    // Fallback final: buscar no texto completo
                    if (!companhia) {
                        const cias = ['LATAM', 'Latam', 'Gol', 'GOL', 'Azul', 'Avianca', 'American', 'United', 'Delta', 'TAP', 'Copa', 'Iberia', 'Air France', 'Lufthansa', 'British'];
                        for (const c of cias) {
                            if (text.includes(c)) { companhia = c; break; }
                        }
                    }

                    // Escalas
                    let escalas = 0;
                    if (/sem\s*escala|direto|nonstop|non-stop/i.test(text)) {
                        escalas = 0;
                    } else {
                        const escMatch = text.match(/(\d+)\s*(?:escala|parada|stop)/i);
                        if (escMatch) escalas = parseInt(escMatch[1]);
                    }

                    // Deduplicar
                    const key = `${horarioPartida}-${horarioChegada}-${preco}`;
                    if (results.some(r => `${r.horarioPartida}-${r.horarioChegada}-${r.preco}` === key)) continue;

                    results.push({
                        preco,
                        horarioPartida,
                        horarioChegada,
                        duracaoMin,
                        duracaoTexto,
                        companhia,
                        escalas,
                        logoUrl
                    });
                } catch (e) {
                    // ignorar item inválido
                }
            }

            return results;
        });
    }

    // ============================================================
    //  FORMATAÇÃO PARA O PADRÃO DO BACKEND
    // ============================================================

    formatFlights(rawFlights, { origem, destino, data, classe, tipo }) {
        const flightSearchService = require('./flightSearch.service');

        return rawFlights.map((raw, idx) => {
            const companhiaCodigo = this.resolveCompanhiaCodigo(raw.companhia);
            const companhiaNome = raw.companhia || flightSearchService.getNomeCompanhia(companhiaCodigo);
            const preco = raw.preco;
            const pontosInfo = flightSearchService.calcularPontos(preco, companhiaCodigo);

            const origemInfo = flightSearchService.aeroportosBR[origem] || { cidade: origem, nome: '', uf: '' };
            const destinoInfo = flightSearchService.aeroportosBR[destino] || { cidade: destino, nome: '', uf: '' };

            const partida = raw.horarioPartida || '00:00';
            const chegada = raw.horarioChegada || '00:00';

            return {
                id: `GF-${origem}${destino}-${data}-${idx}`,
                companhia: {
                    codigo: companhiaCodigo,
                    nome: companhiaNome,
                    cor: flightSearchService.getCorCompanhia(companhiaCodigo),
                    logo: raw.logoUrl || null
                },
                numero: `${companhiaCodigo}${1000 + idx}`,
                origem: {
                    codigo: origem,
                    cidade: origemInfo.cidade,
                    nome: origemInfo.nome,
                    uf: origemInfo.uf
                },
                destino: {
                    codigo: destino,
                    cidade: destinoInfo.cidade,
                    nome: destinoInfo.nome,
                    uf: destinoInfo.uf
                },
                partida: {
                    data,
                    horario: partida,
                    timestamp: flightSearchService.criarTimestamp(data, partida)
                },
                chegada: {
                    data,
                    horario: chegada,
                    timestamp: flightSearchService.criarTimestamp(data, chegada)
                },
                duracao: {
                    total: raw.duracaoMin || this.estimateDuration(partida, chegada),
                    texto: raw.duracaoTexto || this.formatDuration(this.estimateDuration(partida, chegada))
                },
                escalas: raw.escalas,
                classe: classe || 'economica',
                preco: {
                    valor: preco,
                    moeda: 'BRL',
                    porPessoa: preco,
                    taxas: 52.05,
                    total: preco + 52.05
                },
                pontos: pontosInfo ? {
                    quantidade: pontosInfo.pontos,
                    programa: pontosInfo.programa,
                    taxaEmbarque: pontosInfo.taxaEmbarque,
                    valorEquivalente: pontosInfo.pontos * pontosInfo.valorPonto
                } : null,
                assentos: Math.floor(Math.random() * 15) + 1,
                tipo,
                fonte: 'google_flights'
            };
        });
    }

    // ============================================================
    //  DEBUG
    // ============================================================

    async saveDebugScreenshot(page, name) {
        try {
            if (!fs.existsSync(this.debugDir)) {
                fs.mkdirSync(this.debugDir, { recursive: true });
            }
            const filePath = path.join(this.debugDir, `${name}.png`);
            await page.screenshot({ path: filePath, fullPage: true });
            console.log(`📸 Screenshot salvo: ${filePath}`);
        } catch (e) {
            console.log(`⚠️ Não salvou screenshot: ${e.message}`);
        }
    }

    async saveDebugHtml(page, name) {
        try {
            if (!fs.existsSync(this.debugDir)) {
                fs.mkdirSync(this.debugDir, { recursive: true });
            }
            const html = await page.content();
            const filePath = path.join(this.debugDir, `${name}.html`);
            fs.writeFileSync(filePath, html, 'utf-8');
            console.log(`📄 HTML salvo: ${filePath}`);
        } catch (e) {
            console.log(`⚠️ Não salvou HTML: ${e.message}`);
        }
    }

    // ============================================================
    //  UTILITÁRIOS
    // ============================================================

    resolveCompanhiaCodigo(nomeCompanhia) {
        if (!nomeCompanhia) return 'XX';
        const nome = nomeCompanhia.toLowerCase();

        const mapa = {
            'latam': 'LA', 'tam': 'LA',
            'gol': 'G3',
            'azul': 'AD',
            'avianca': 'AV',
            'american': 'AA',
            'united': 'UA',
            'delta': 'DL',
            'tap': 'TP',
            'copa': 'CM',
            'iberia': 'IB',
            'air france': 'AF',
            'lufthansa': 'LH',
            'british': 'BA',
            'aerolíneas': 'AR', 'aerolineas': 'AR'
        };

        for (const [key, code] of Object.entries(mapa)) {
            if (nome.includes(key)) return code;
        }

        return 'XX';
    }

    estimateDuration(partida, chegada) {
        try {
            const [ph, pm] = partida.split(':').map(Number);
            const [ch, cm] = chegada.split(':').map(Number);
            let diff = (ch * 60 + cm) - (ph * 60 + pm);
            if (diff <= 0) diff += 24 * 60;
            return diff;
        } catch (e) {
            return 120;
        }
    }

    formatDuration(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}min`;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new GoogleFlightsService();
