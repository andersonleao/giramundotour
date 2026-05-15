const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');

let browser = null;
let worker = null;

const RENDERER_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<style>body{margin:0;padding:0;background:white}canvas{display:block;margin:0}</style>
</head><body><div id="container"></div><script>
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
async function renderPDF(data,pageNum,scale){
  const pdf=await pdfjsLib.getDocument({data}).promise;
  const total=pdf.numPages;
  const pg=await pdf.getPage(pageNum);
  const vp=pg.getViewport({scale});
  const c=document.createElement('canvas');
  c.width=vp.width;c.height=vp.height;
  document.getElementById('container').appendChild(c);
  await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
  let txt='';
  try{const ct=await pg.getTextContent();
    const lines={};
    ct.items.forEach(it=>{if(!it.str||!it.str.trim())return;
      const y=it.transform?it.transform[5]:0;const x=it.transform?it.transform[4]:0;
      const k=Math.round(y/3)*3;if(!lines[k])lines[k]=[];lines[k].push({x,text:it.str});});
    Object.keys(lines).map(Number).sort((a,b)=>b-a).forEach(k=>{
      txt+=lines[k].sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ').trim()+'\\n';});
  }catch(e){}
  return{totalPages:total,textContent:txt.trim(),width:c.width,height:c.height};
}
window.renderPDF=renderPDF;
window.preprocessCanvas=function(mode){
  const c=document.querySelector('canvas');if(!c)return;
  const ctx=c.getContext('2d');
  const img=ctx.getImageData(0,0,c.width,c.height);
  const d=img.data;
  if(mode==='invert'){
    for(let i=0;i<d.length;i+=4){d[i]=255-d[i];d[i+1]=255-d[i+1];d[i+2]=255-d[i+2];}
  }else if(mode==='removeColor'){
    // For colored backgrounds: detect saturated pixels and invert only those regions
    // This helps read white/light text on colored buttons (like Azul localizador)
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2];
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
      const sat=(mx===0)?0:(mx-mn)/mx;
      if(sat>0.3&&mx>60){
        // Colored pixel: invert it to make hidden text visible
        const gray=0.299*(255-r)+0.587*(255-g)+0.114*(255-b);
        const v=gray<128?0:255;
        d[i]=v;d[i+1]=v;d[i+2]=v;
      }else{
        // Non-colored: standard binarization
        const gray=0.299*r+0.587*g+0.114*b;
        const v=gray<160?0:255;
        d[i]=v;d[i+1]=v;d[i+2]=v;
      }
    }
  }else{
    for(let i=0;i<d.length;i+=4){
      const gray=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
      const v=gray<160?0:255;
      d[i]=v;d[i+1]=v;d[i+2]=v;
    }
  }
  ctx.putImageData(img,0,0);
};
window.__ready=true;
</script></body></html>`;

async function getBrowser() {
    if (!browser || !browser.connected) {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: '/usr/bin/chromium-browser',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
    }
    return browser;
}

async function getWorker() {
    if (!worker) {
        worker = await Tesseract.createWorker('por+eng');
    }
    return worker;
}

async function extractTextFromPDF(pdfBuffer) {
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();

    try {
        // Use data URL to avoid file:// issues
        const htmlBase64 = Buffer.from(RENDERER_HTML).toString('base64');
        await page.goto(`data:text/html;base64,${htmlBase64}`, {
            waitUntil: 'networkidle0',
            timeout: 15000
        });

        await page.waitForFunction(() => window.__ready === true, { timeout: 10000 });

        const base64Data = pdfBuffer.toString('base64');

        const result = await page.evaluate(async (b64) => {
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return await window.renderPDF(bytes.buffer, 1, 2.0);
        }, base64Data);

        console.log(`[PDFExtractor] Rendered: ${result.width}x${result.height}, text: ${result.textContent.length} chars, pages: ${result.totalPages}`);

        // If pdf.js extracted meaningful text, use it
        if (result.textContent && result.textContent.length > 50) {
            let allText = result.textContent;
            const maxPages = Math.min(result.totalPages, 3);
            for (let i = 2; i <= maxPages; i++) {
                const pr = await page.evaluate(async (b64, pn) => {
                    const bin = atob(b64);
                    const bytes = new Uint8Array(bin.length);
                    for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
                    return await window.renderPDF(bytes.buffer, pn, 2.0);
                }, base64Data, i);
                allText += '\n' + pr.textContent;
            }
            await page.close();
            return { text: allText, method: 'pdfjs', pages: result.totalPages };
        }

        // OCR fallback
        console.log('[PDFExtractor] Using OCR fallback...');
        let allOCRText = '';
        const maxPages = Math.min(result.totalPages, 3);
        const tessWorker = await getWorker();

        for (let i = 1; i <= maxPages; i++) {
            await page.evaluate(() => { document.getElementById('container').innerHTML = ''; });
            await page.evaluate(async (b64, pn) => {
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
                await window.renderPDF(bytes.buffer, pn, 4.0);
            }, base64Data, i);

            const canvas = await page.$('canvas');
            if (!canvas) continue;

            // Pass 1: normal OCR
            const screenshotBuffer = await canvas.screenshot({ type: 'png' });
            console.log(`[PDFExtractor] Page ${i} screenshot: ${screenshotBuffer.length} bytes`);

            const { data: { text } } = await tessWorker.recognize(screenshotBuffer);
            console.log(`[PDFExtractor] Page ${i} OCR normal: ${text.length} chars`);

            // Pass 2: color-aware preprocessing (for text on colored backgrounds)
            // Re-render fresh canvas for preprocessing
            await page.evaluate(() => { document.getElementById('container').innerHTML = ''; });
            await page.evaluate(async (b64, pn) => {
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
                await window.renderPDF(bytes.buffer, pn, 4.0);
            }, base64Data, i);

            await page.evaluate(() => { window.preprocessCanvas('removeColor'); });
            const canvas2 = await page.$('canvas');
            const processedBuffer = await canvas2.screenshot({ type: 'png' });
            const { data: { text: textRC } } = await tessWorker.recognize(processedBuffer);
            console.log(`[PDFExtractor] Page ${i} OCR removeColor: ${textRC.length} chars`);

            // Extract booking codes from removeColor pass
            const knownWords = /^(RECIFE|PAULO|BRASIL|LATAM|AIRLINES|PASSAGEIRO|BAGAGEM|EMBARQUE|BOEING|AIRBUS|ECONOMY|STANDARD|ADULTO|CRIANCA|INFORMAC|TRECHO|CARTAO|MILHAS|TOTAL|TARIFA|ORIGIN|DESTINO|VIAGEM|RETORNO|VOLTA|DIRECT|ASSENTOS|NENHUM|AZUL|ITINERARY|CABINE|BILHETE|COMPRA|VENDA|OPERADO|AEROPORTO|INTERNACIONAL|NACIONAL|LINHAS|AEREAS|PASSAGEM|RESERVA|APENAS|NISSO|CASIO|AINDA|TODOS|TODAS|DESDE|SOBRE|ENTRE|OUTRO|NOSSA|NOSSO|MUITO|MESMO|FAZER|POSSUI|VOCE|NOSSO|NOSSA|TERMO|CONDI|REAIS|VALOR|TEXTO|FAVOR|ANTES|DEPOIS|AGORA|SERIA|PODE|DEVE|ESTA|ESSE|ESSA|ISTO|ISSO|TUDO|NADA|CADA|CUJO|CUJA|CUJOS|SUAS|SEUS|PELO|PELA|PELOS|PELAS|PARA|ISSO|ONDE|COMO|MAIS|MENOS|MUITO|POUCO|TANTO|ALGUM|OUTRA|MESMO)$/;
            // Words that appear case-insensitively in the normal OCR are common words, not codes
            const normalLower = text.toLowerCase();
            const isCommonWord = c => normalLower.includes(c.toLowerCase());

            // Alphanumeric codes (letters+digits): add all not in main OCR
            const codesFromMain = (text.match(/\b[A-Z][A-Z0-9]{4,7}\b/g) || [])
                .filter(c => /[A-Z]/.test(c) && /\d/.test(c));
            const codesFromRC = (textRC.match(/\b[A-Z][A-Z0-9]{4,7}\b/g) || [])
                .filter(c => /[A-Z]/.test(c) && /\d/.test(c));

            let extra = '';
            for (const code of codesFromRC) {
                if (!codesFromMain.includes(code)) {
                    extra += `\nLocalizador ${code}`;
                    console.log(`[PDFExtractor] Found code from processed OCR: ${code}`);
                }
            }

            // All-letter codes (e.g. ZPRLHN — Azul localizadores can be all-letters):
            // Booking codes are random sequences → typically ≤ 1 vowel (ZPRLHN=0, HHTPGU=1)
            // Common words always have 2+ vowels (SERENE=3, FARTA=2, IRENE=3, etc.)
            const vowels = new Set(['A','E','I','O','U']);
            const countVowels = s => [...s].filter(c => vowels.has(c)).length;
            const allLetterCodesRC = (textRC.match(/\b[A-Z]{5,8}\b/g) || []);
            for (const code of allLetterCodesRC) {
                if (!extra.includes(code) && !knownWords.test(code) && !isCommonWord(code)
                    && countVowels(code) <= 1) {
                    extra += `\nLocalizador ${code}`;
                    console.log(`[PDFExtractor] Found letter code from processed OCR: ${code}`);
                }
            }

            // Azul context: capture 4+ char codes after "Azul *" pattern
            // (OCR artifact from white-text-on-blue localizador box)
            const azulCtxMatches = textRC.match(/Azul\s+\*?\s*([A-Z]{4,8})\b/gi) || [];
            for (const ctx of azulCtxMatches) {
                const m = ctx.match(/([A-Z]{4,8})$/i);
                if (m) {
                    const code = m[1].toUpperCase();
                    if (!extra.includes(code) && !knownWords.test(code) && code !== 'AZUL') {
                        extra += `\nLocalizador ${code}`;
                        console.log(`[PDFExtractor] Found Azul localizador from removeColor context: ${code}`);
                    }
                }
            }

            // Supplement IATA airport codes found in removeColor that aren't in normal OCR
            // These are codes that appear clearly in the enhanced image but were garbled in normal OCR
            const IATA_SUPPLEMENT = new Set(['AJU','VIX','JPA','MCZ','THE','SLZ','CGB','GYN','PMW','BPS','FEN','ILZ','NAT','FOR','SDU','CNF']);
            const iataFromRC = (textRC.match(/\b[A-Z]{3}\b/g) || []);
            for (const code of iataFromRC) {
                if (IATA_SUPPLEMENT.has(code) && !text.includes(code) && !extra.includes(code)) {
                    extra += `\n${code}`;
                    console.log(`[PDFExtractor] Supplemented IATA from removeColor: ${code}`);
                }
            }

            // Pass 3: full invert — turns white-on-colored into black-on-light (e.g. Azul blue button)
            // Used only to supplement localizador detection, not for full text extraction
            await page.evaluate(() => { document.getElementById('container').innerHTML = ''; });
            await page.evaluate(async (b64, pn) => {
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
                await window.renderPDF(bytes.buffer, pn, 4.0);
            }, base64Data, i);
            await page.evaluate(() => { window.preprocessCanvas('invert'); });
            const canvas3 = await page.$('canvas');
            const invertBuffer = await canvas3.screenshot({ type: 'png' });
            const { data: { text: textINV } } = await tessWorker.recognize(invertBuffer);
            console.log(`[PDFExtractor] Page ${i} OCR invert: ${textINV.length} chars`);

            // Extract localizador from inverted text — only context-aware (airline name + code)
            // Allow 4+ char codes and optional asterisk (Azul blue box artifact)
            const locPatternsINV = textINV.match(/(?:Localizador|Azul|GOL|LATAM|TAM)\s+\*?\s*([A-Z]{4,8})\b/gi) || [];
            for (const ctx of locPatternsINV) {
                const m = ctx.match(/([A-Z]{4,8})$/i);
                if (m) {
                    const code = m[1].toUpperCase();
                    const alreadyFound = codesFromMain.includes(code) || extra.includes(code);
                    if (!alreadyFound && !knownWords.test(code)) {
                        extra += `\nLocalizador ${code}`;
                        console.log(`[PDFExtractor] Found code from invert OCR: ${code}`);
                    }
                }
            }

            allOCRText += text + extra + '\n';
        }

        await page.close();
        return { text: allOCRText.trim(), method: 'ocr', pages: result.totalPages };

    } catch (error) {
        await page.close().catch(() => {});
        throw error;
    }
}

async function cleanup() {
    if (worker) { await worker.terminate(); worker = null; }
    if (browser) { await browser.close(); browser = null; }
}

module.exports = { extractTextFromPDF, cleanup };
