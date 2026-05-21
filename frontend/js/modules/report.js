// GiraMundoTour - Módulo de Relatórios e PDF

const ReportModule = {
    /**
     * Inicializa o módulo de relatórios
     */
    init() {
        debugLog('ReportModule: Inicializado');
    },

    /**
     * Gera PDF da cotação
     * @param {object} cotacao - Dados da cotação
     */
    // Cache da logomarca em base64
    _logoBase64: null,
    _iconsBase64: {},
    _airlineLogosBase64: {},

    /**
     * Carrega a logomarca como base64 para uso no PDF
     */
    carregarLogo() {
        return new Promise((resolve) => {
            if (this._logoBase64) {
                resolve(this._logoBase64);
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                this._logoBase64 = canvas.toDataURL('image/png');
                resolve(this._logoBase64);
            };
            img.onerror = () => resolve(null);
            img.src = '/assets/images/logomarca.png';
        });
    },

    /**
     * Carrega logo da companhia a\u00e9rea via pics.avs.io
     * @param {string} iataCode - C\u00f3digo IATA da companhia (ex: LA, G3, AD)
     * @returns {Promise<string|null>} Base64 da imagem ou null
     */
    carregarLogoCompanhia(iataCode) {
        return new Promise((resolve) => {
            if (!iataCode) { resolve(null); return; }
            if (this._airlineLogosBase64[iataCode]) {
                resolve(this._airlineLogosBase64[iataCode]);
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                try {
                    this._airlineLogosBase64[iataCode] = canvas.toDataURL('image/png');
                    resolve(this._airlineLogosBase64[iataCode]);
                } catch (e) {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = `https://pics.avs.io/200/80/${iataCode}.png`;
        });
    },

    /**
     * Gera ícone WhatsApp como base64 (canvas desenhado)
     */
    _gerarIconeWhatsApp() {
        if (this._iconsBase64.whatsapp) return this._iconsBase64.whatsapp;
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Círculo verde
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#25D366';
        ctx.fill();

        // Balão de chat (forma característica do WhatsApp)
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(64, 22);
        ctx.bezierCurveTo(42, 22, 24, 38, 24, 58);
        ctx.bezierCurveTo(24, 66, 27, 74, 32, 80);
        ctx.lineTo(28, 100);
        ctx.lineTo(50, 90);
        ctx.bezierCurveTo(54, 92, 59, 93, 64, 93);
        ctx.bezierCurveTo(86, 93, 104, 77, 104, 58);
        ctx.bezierCurveTo(104, 38, 86, 22, 64, 22);
        ctx.closePath();
        ctx.fill();

        // Telefone dentro do balão (handset)
        ctx.strokeStyle = '#25D366';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(48, 46);
        ctx.bezierCurveTo(48, 46, 46, 52, 50, 58);
        ctx.bezierCurveTo(54, 64, 60, 70, 66, 72);
        ctx.bezierCurveTo(72, 74, 76, 72, 76, 72);
        ctx.stroke();

        // Parte superior do telefone
        ctx.beginPath();
        ctx.moveTo(48, 46);
        ctx.bezierCurveTo(50, 42, 56, 42, 58, 48);
        ctx.stroke();

        // Parte inferior do telefone
        ctx.beginPath();
        ctx.moveTo(76, 72);
        ctx.bezierCurveTo(80, 70, 82, 64, 76, 62);
        ctx.stroke();

        this._iconsBase64.whatsapp = canvas.toDataURL('image/png');
        return this._iconsBase64.whatsapp;
    },

    /**
     * Gera ícone Instagram como base64 (canvas desenhado)
     */
    _gerarIconeInstagram() {
        if (this._iconsBase64.instagram) return this._iconsBase64.instagram;
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Fundo gradiente Instagram
        const gradient = ctx.createLinearGradient(0, size, size, 0);
        gradient.addColorStop(0, '#FD5');
        gradient.addColorStop(0.3, '#FF543E');
        gradient.addColorStop(0.6, '#C837AB');
        gradient.addColorStop(1, '#5B51D8');

        // Retângulo arredondado
        const r = 14;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(size - r, 0);
        ctx.quadraticCurveTo(size, 0, size, r);
        ctx.lineTo(size, size - r);
        ctx.quadraticCurveTo(size, size, size - r, size);
        ctx.lineTo(r, size);
        ctx.quadraticCurveTo(0, size, 0, size - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Retângulo interno arredondado (branco)
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        const inR = 10;
        const m = 12;
        ctx.beginPath();
        ctx.moveTo(m + inR, m);
        ctx.lineTo(size - m - inR, m);
        ctx.quadraticCurveTo(size - m, m, size - m, m + inR);
        ctx.lineTo(size - m, size - m - inR);
        ctx.quadraticCurveTo(size - m, size - m, size - m - inR, size - m);
        ctx.lineTo(m + inR, size - m);
        ctx.quadraticCurveTo(m, size - m, m, size - m - inR);
        ctx.lineTo(m, m + inR);
        ctx.quadraticCurveTo(m, m, m + inR, m);
        ctx.stroke();

        // Círculo central (lente)
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 10, 0, Math.PI * 2);
        ctx.stroke();

        // Ponto superior direito (flash)
        ctx.beginPath();
        ctx.arc(size - 18, 18, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        this._iconsBase64.instagram = canvas.toDataURL('image/png');
        return this._iconsBase64.instagram;
    },

    async gerarCotacaoPDF(cotacao) {
        // Verifica se jsPDF está disponível
        if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
            alert('Biblioteca jsPDF não carregada. Verifique a conexão com a internet.');
            return;
        }

        // Carrega logomarca
        const logoBase64 = await this.carregarLogo();

        const { jsPDF } = jspdf;
        const doc = new jsPDF();

        // Configurações
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);
        let y = margin;

        // Cores do tema
        const primaryColor = [26, 54, 93]; // #1a365d
        const primaryLight = [66, 153, 225]; // #4299e1

        // Helper: desenha o rodapé na página atual
        const desenharRodape = () => {
            const footerY = pageHeight - 20;
            doc.setDrawColor(...primaryLight);
            doc.setLineWidth(0.5);
            doc.line(margin, footerY, pageWidth - margin, footerY);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(60, 60, 60);
            doc.text(CONFIG.empresa.nome, margin, footerY + 5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text('CNPJ: ' + CONFIG.empresa.cnpj, pageWidth - margin, footerY + 5, { align: 'right' });

            const footerContatos = CONFIG.empresa.email + '  |  ' + CONFIG.empresa.telefone + '  |  ' + CONFIG.empresa.telefone2 + '  |  ' + CONFIG.empresa.instagram;
            doc.setFontSize(7);
            doc.text(footerContatos, pageWidth / 2, footerY + 10, { align: 'center' });
        };

        // Helper: quebra de página com rodapé na página anterior
        const quebraPagina = () => {
            desenharRodape();
            doc.addPage();
            y = margin;
        };

        // ==========================================
        // CABEÇALHO
        // ==========================================

        // Fundo do cabeçalho
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 45, 'F');

        // Logomarca com fundo branco arredondado para contraste
        if (logoBase64) {
            try {
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(margin + 1, 6, 33, 33, 4, 4, 'F');
                doc.addImage(logoBase64, 'PNG', margin + 2, 7, 31, 31);
            } catch (e) {
                // Se falhar ao adicionar imagem, continua sem ela
                console.warn('Erro ao adicionar logo no PDF:', e);
            }
        }

        // Nome da empresa (ao lado da logo ou no inicio)
        const textoX = logoBase64 ? margin + 40 : margin;
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('GiraMundoTour', textoX, 25);

        // Slogan
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(CONFIG.empresa.slogan, textoX, 33);

        // Dados da empresa (direita)
        const contactX = pageWidth - margin;
        let contactY = 12;
        const iconSize = 4;

        // Gerar ícones
        const wppIcon = this._gerarIconeWhatsApp();
        const igIcon = this._gerarIconeInstagram();

        // Email
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(255, 255, 255);
        doc.text(CONFIG.empresa.email, contactX, contactY, { align: 'right' });
        contactY += 5.5;

        // WhatsApp telefone 1
        const tel1Text = CONFIG.empresa.telefone;
        const tel1Width = doc.getTextWidth(tel1Text);
        doc.text(tel1Text, contactX, contactY, { align: 'right' });
        try { doc.addImage(wppIcon, 'PNG', contactX - tel1Width - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}

        contactY += 4.5;

        // WhatsApp telefone 2
        const tel2Text = CONFIG.empresa.telefone2;
        const tel2Width = doc.getTextWidth(tel2Text);
        doc.setTextColor(255, 255, 255);
        doc.text(tel2Text, contactX, contactY, { align: 'right' });
        try { doc.addImage(wppIcon, 'PNG', contactX - tel2Width - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}

        contactY += 5.5;

        // Instagram
        const igText = CONFIG.empresa.instagram;
        const igWidth = doc.getTextWidth(igText);
        doc.setTextColor(255, 255, 255);
        doc.text(igText, contactX, contactY, { align: 'right' });
        try { doc.addImage(igIcon, 'PNG', contactX - igWidth - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}

        y = 55;

        // ==========================================
        // TÍTULO DO DOCUMENTO
        // ==========================================

        doc.setTextColor(...primaryColor);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('COTAÇÃO DE PASSAGENS AÉREAS', margin, y);

        y += 8;

        // Número e data da cotação
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);

        // Gerar número aleatório entre 30 e 100 para identificação da cotação
        const numeroCotacao = String(Math.floor(Math.random() * 71) + 30);
        const dataCotacao = cotacao.dataCriacao ? Formatter.date(cotacao.dataCriacao) : Formatter.date(new Date());

        doc.text(`Cotação Nº: ${numeroCotacao}`, margin, y);
        doc.text(`Data: ${dataCotacao}`, pageWidth - margin, y, { align: 'right' });

        y += 15;

        // ==========================================
        // DADOS DO CLIENTE
        // ==========================================

        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y - 5, contentWidth, 30, 'F');

        doc.setTextColor(...primaryColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('DADOS DO CLIENTE', margin + 5, y + 3);

        y += 10;

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const cliente = cotacao.cliente;
        doc.text(`Nome: ${cliente.nome}`, margin + 5, y);
        if (cliente.telefone) {
            doc.text(`Telefone: ${Formatter.phone(cliente.telefone)}`, pageWidth / 2, y);
        }

        y += 22;

        // ==========================================
        // PASSAGEIROS
        // ==========================================

        doc.setTextColor(...primaryColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('PASSAGEIROS', margin, y);

        y += 7;

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(Formatter.passengers(cotacao.passageiros), margin, y);

        y += 15;

        // ==========================================
        // DETALHES DOS VOOS
        // ==========================================

        doc.setTextColor(...primaryColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('DETALHES DOS VOOS', margin, y);

        y += 10;

        // Helper: formata duração em minutos para "Xh Ym"
        const fmtDurMin = (min) => {
            if (!min) return '';
            const h = Math.floor(min / 60), m = min % 60;
            return h > 0 ? `${h}h ${m > 0 ? m + 'min' : ''}`.trim() : `${m}min`;
        };

        // Helper: calcula diferença em minutos entre duas strings ISO
        const diffMin = (isoA, isoB) => {
            const a = new Date(isoA), b = new Date(isoB);
            return isNaN(a) || isNaN(b) ? 0 : Math.round((b - a) / 60000);
        };

        // Helper: desenha uma linha de segmento dentro do box
        const drawSegmento = (seg, rowY) => {
            const oriAp  = getAirportByCode(seg.origem);
            const destAp = getAirportByCode(seg.destino);
            const segH   = 22;

            // Origem
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...primaryColor);
            doc.text(seg.origem, margin + 4, rowY + 7);
            doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
            doc.text(oriAp?.city || '', margin + 4, rowY + 11.5);
            doc.text(Formatter.time(seg.partida), margin + 4, rowY + 15.5);

            // Seta central
            const aX1 = margin + 38, aX2 = margin + 92, aMid = (aX1 + aX2) / 2;
            doc.setDrawColor(...primaryLight); doc.setLineWidth(0.4);
            doc.line(aX1, rowY + 8, aX2, rowY + 8);
            doc.setFillColor(...primaryLight);
            doc.triangle(aX2, rowY + 8, aX2 - 2, rowY + 6, aX2 - 2, rowY + 10, 'F');
            doc.setFontSize(6); doc.setTextColor(100, 100, 100);
            doc.text(fmtDurMin(seg.duracao), aMid, rowY + 4.5, { align: 'center' });
            const vooNumSeg = (seg.numeroVoo || '').replace(/^(AD|G3|LA)\s*/i, '');
            doc.text(vooNumSeg, aMid, rowY + 13, { align: 'center' });

            // Destino
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...primaryColor);
            doc.text(seg.destino, margin + 97, rowY + 7);
            doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
            doc.text(destAp?.city || '', margin + 97, rowY + 11.5);
            doc.text(Formatter.time(seg.chegada), margin + 97, rowY + 15.5);

            return segH;
        };

        // Helper: desenha linha de conexão/parada entre segmentos
        const drawConexao = (iataAeroporto, chegada, proximaPartida, rowY) => {
            const connH  = 8;
            const espera = diffMin(chegada, proximaPartida);
            const apCon  = getAirportByCode(iataAeroporto);
            const label  = `Conexão em ${iataAeroporto}${apCon?.city ? ' (' + apCon.city + ')' : ''} — Aguardo: ${fmtDurMin(espera)}`;
            doc.setFillColor(255, 248, 220); doc.setDrawColor(237, 137, 54); doc.setLineWidth(0.2);
            doc.rect(margin, rowY, contentWidth, connH, 'FD');
            doc.setFontSize(6.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(130, 80, 0);
            doc.text(label, margin + contentWidth / 2, rowY + 5.5, { align: 'center' });
            return connH;
        };

        // Helper: gera segmentos sintéticos para voos salvos sem dados de conexão
        const gerarSegsSinteticos = (voo) => {
            const escalas = voo.escalas || 1;
            const hubsDisponiveis = ['GRU', 'BSB', 'VCP', 'SSA', 'GIG', 'FOR']
                .filter(h => h !== voo.origem && h !== voo.destino);
            const numHubs = Math.min(escalas, hubsDisponiveis.length);
            const connMin = 60;
            const totalFlight = Math.max((voo.duracao || 180) - connMin * numHubs, (numHubs + 1) * 30);
            const segDur = Math.round(totalFlight / (numHubs + 1));
            const route = [voo.origem, ...hubsDisponiveis.slice(0, numHubs), voo.destino];

            // Converter ISO (com ou sem Z) para ms tratando sempre como UTC
            const toMs = iso => {
                if (!iso) return Date.now();
                const s = String(iso);
                const normalized = (s.includes('Z') || s.includes('+') || s.includes('-', 10)) ? s : s + '+00:00';
                const ms = new Date(normalized).getTime();
                return isNaN(ms) ? Date.now() : ms;
            };
            // Formatar ms como ISO sem Z (browser trata como hora local)
            const fmtISO = ms => {
                const d = new Date(ms);
                const pad = n => String(n).padStart(2, '0');
                return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
            };

            const segs = [];
            const dataPartidaResolvida = voo.dataPartida || (voo.departureDate ? `${voo.departureDate}T${voo.departureTime || '00:00'}:00` : '');
            let t = toMs(dataPartidaResolvida);
            for (let i = 0; i < route.length - 1; i++) {
                const tStart = t;
                t += segDur * 60000;
                segs.push({
                    companhia: voo.companhia,
                    numeroVoo: voo.numeroVoo,
                    origem:    route[i],
                    destino:   route[i + 1],
                    partida:   fmtISO(tStart),
                    chegada:   fmtISO(t),
                    duracao:   segDur
                });
                if (i < route.length - 2) t += connMin * 60000;
            }
            return segs;
        };

        cotacao.voos.forEach((voo, index) => {
            // Resolve dataPartida/dataChegada com fallback para formato display (departureDate/Time)
            const vooDataPartida = voo.dataPartida || (voo.departureDate ? `${voo.departureDate}T${voo.departureTime || '00:00'}:00` : '');
            const vooDataChegada = voo.dataChegada || (voo.arrivalDate   ? `${voo.arrivalDate}T${voo.arrivalTime   || '00:00'}:00` : '');

            // segs reais (SerpAPI/Sky Scrapper com dados detalhados)
            const segsReais = (voo.segmentos && voo.segmentos.length > 1) ? voo.segmentos : null;
            // segs sintéticos para voos salvos com escalas mas sem segmentos
            const segsSin  = (!segsReais && (voo.escalas || 0) > 0) ? gerarSegsSinteticos(voo) : null;
            // segmentos que serão renderizados (reais têm prioridade)
            const segs = segsReais || segsSin;

            // Calcula altura dinâmica do box
            const headerH = 16;
            const segH    = 22;
            const connH   = 8;
            const boxH    = segs
                ? headerH + segs.length * segH + (segs.length - 1) * connH
                : 38;

            if (y > pageHeight - (boxH + 20)) { quebraPagina(); }

            const boxTop = y;

            // Box externo
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(...primaryLight);
            doc.setLineWidth(0.3);
            doc.roundedRect(margin, boxTop, contentWidth, boxH, 3, 3, 'FD');

            // Badge ida/volta
            doc.setFillColor(...(voo.tipo === 'ida' ? primaryColor : [56, 161, 105]));
            doc.roundedRect(margin + 4, boxTop + 3, 25, 7, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7); doc.setFont('helvetica', 'bold');
            doc.text(voo.tipo === 'ida' ? 'IDA' : 'VOLTA', margin + 16.5, boxTop + 8, { align: 'center' });

            // Companhia e número
            doc.setTextColor(60, 60, 60); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
            doc.text(`${voo.companhiaNome} - ${voo.numeroVoo}`, margin + 33, boxTop + 7);

            // Classe e data
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 100, 100);
            doc.text(`${Formatter.flightClass(voo.classe)}  |  ${Formatter.date(vooDataPartida)}`, margin + 33, boxTop + 12);

            if (segs) {
                // ── Voo com conexões: expande segmentos (reais ou sintéticos) ──
                let curY = boxTop + headerH;
                segs.forEach((seg, si) => {
                    curY += drawSegmento(seg, curY);
                    if (si < segs.length - 1) {
                        curY += drawConexao(seg.destino, seg.chegada, segs[si + 1].partida, curY);
                    }
                });
            } else {
                // ── Voo direto ──
                const origemAirport  = getAirportByCode(voo.origem);
                const destinoAirport = getAirportByCode(voo.destino);
                const routeY = boxTop + 16;

                doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...primaryColor);
                doc.text(voo.origem, margin + 5, routeY + 5);
                doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
                doc.text(origemAirport?.city || '', margin + 5, routeY + 10);
                doc.text(Formatter.time(vooDataPartida), margin + 5, routeY + 14.5);

                const arrowStartX = margin + 45, arrowEndX = margin + 90;
                const arrowCenterX = (arrowStartX + arrowEndX) / 2;
                doc.setDrawColor(...primaryLight); doc.setLineWidth(0.5);
                doc.line(arrowStartX, routeY + 5, arrowEndX, routeY + 5);
                doc.setFillColor(...primaryLight);
                doc.triangle(arrowEndX, routeY + 5, arrowEndX - 2.5, routeY + 3, arrowEndX - 2.5, routeY + 7, 'F');
                doc.setFontSize(6.5); doc.setTextColor(100, 100, 100);
                doc.text(Formatter.duration(voo.duracao), arrowCenterX, routeY + 1.5, { align: 'center' });
                doc.text(Formatter.stops(voo.escalas), arrowCenterX, routeY + 10, { align: 'center' });

                doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...primaryColor);
                doc.text(voo.destino, margin + 100, routeY + 5);
                doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
                doc.text(destinoAirport?.city || '', margin + 100, routeY + 10);
                doc.text(Formatter.time(vooDataChegada), margin + 100, routeY + 14.5);
            }

            y = boxTop + boxH + 4;
        });

        y += 10;

        // ==========================================
        // RESUMO FINANCEIRO
        // ==========================================

        // Verifica se precisa de nova página
        if (y > pageHeight - 80) {
            quebraPagina();
        }

        doc.setTextColor(...primaryColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMO FINANCEIRO', margin, y);

        y += 10;

        const precos = cotacao.precos;
        const passageiros = cotacao.passageiros || { adultos: 1, criancas: 0, bebes: 0 };
        const totalPax = precos.totalPax || Math.max((passageiros.adultos || 0) + (passageiros.criancas || 0) + (passageiros.bebes || 0), 1);

        const valorPorPessoa = precos.valorPorPessoa != null
            ? precos.valorPorPessoa
            : (precos.subtotalVoos || precos.subtotal || 0) / totalPax;
        const taxaPorPessoa = precos.taxaPorPessoa != null
            ? precos.taxaPorPessoa
            : (precos.taxaEmbarque || 0) / totalPax;
        const totalPorPessoa = valorPorPessoa + taxaPorPessoa;
        const qtdBagagens  = precos.qtdBagagens  || 0;
        const valorBagagem = precos.valorBagagem || 0;

        const bagagemTotal = qtdBagagens * valorBagagem;

        // Linhas do resumo (apenas voo, sem bagagem)
        const linhasResumo = [
            ['Valor por Pessoa', Formatter.currency(valorPorPessoa)],
            ['Taxa de Embarque por Pessoa', Formatter.currency(taxaPorPessoa)]
        ];

        // Altura do box: linhas normais + total por pessoa + divisor fina + bagagem (se houver) + divisor + total geral
        const linhasBagagem = qtdBagagens > 0 ? 1 : 0;
        const boxHeight = 10 + (linhasResumo.length * 8) + 10 + (linhasBagagem * 9) + 14;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...primaryLight);
        doc.roundedRect(margin, y - 3, contentWidth, boxHeight, 3, 3, 'FD');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);

        let resumoY = y + 5;
        linhasResumo.forEach(([label, valor]) => {
            doc.text(label, margin + 5, resumoY);
            doc.text(valor, pageWidth - margin - 5, resumoY, { align: 'right' });
            resumoY += 8;
        });

        // Total por pessoa em destaque (negrito) — SEM bagagem
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Total por Pessoa', margin + 5, resumoY);
        doc.text(Formatter.currency(totalPorPessoa), pageWidth - margin - 5, resumoY, { align: 'right' });
        resumoY += 8;

        // Linha fina separadora
        resumoY += 1;
        doc.setDrawColor(...primaryLight);
        doc.setLineWidth(0.2);
        doc.line(margin + 5, resumoY, pageWidth - margin - 5, resumoY);
        resumoY += 7;

        // Bagagem (abaixo do total por pessoa, antes do total geral)
        if (qtdBagagens > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text(
                `Bagagem 23kg (${qtdBagagens} × ${Formatter.currency(valorBagagem)})`,
                margin + 5, resumoY
            );
            doc.text(Formatter.currency(bagagemTotal), pageWidth - margin - 5, resumoY, { align: 'right' });
            resumoY += 9;
        }

        // Linha divisória principal
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.setDrawColor(...primaryLight);
        doc.setLineWidth(0.3);
        doc.line(margin + 5, resumoY, pageWidth - margin - 5, resumoY);
        resumoY += 8;

        // Total geral = totalPorPessoa × pax + bagagem
        const totalGeral = precos.total != null ? precos.total : (totalPorPessoa * totalPax + bagagemTotal);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text(`TOTAL (${totalPax} ${totalPax === 1 ? 'passageiro' : 'passageiros'})`, margin + 5, resumoY);
        doc.text(Formatter.currency(totalGeral), pageWidth - margin - 5, resumoY, { align: 'right' });

        y += boxHeight + 10;

        // ==========================================
        // FORMAS DE PAGAMENTO (se informado)
        // ==========================================

        const formaPagamento       = cotacao.formaPagamento       || null;
        const subtipoCartao        = cotacao.subtipoCartao        || 'presencial';
        const parcelasSelecionadas = cotacao.parcelasSelecionadas || null;
        const taxasCartaoPresencial = [4, 5.00, 6, 6.67, 7.4, 8.5, 9, 10, 11, 11.16];
        const taxasCartaoMP         = [5.24, 10.58, 12.29, 14.03, 15.79, 17.56, 19.36, 21.18, 23.01, 24.86];
        const taxasCartao = subtipoCartao === 'mercadopago' ? taxasCartaoMP : taxasCartaoPresencial;
        const labelModalidade = subtipoCartao === 'mercadopago' ? 'Mercado Pago (link)' : 'Presencial (maquininha)';

        if (formaPagamento) {
            // Cartão: 10 linhas × 7 + cabeçalho + PIX + espaçamentos ≈ 110mm.
            // PIX puro: ~15mm. Requer espaço suficiente antes do rodapé.
            const espacoPagamento = formaPagamento === 'cartao' ? 110 : 20;
            if (y + espacoPagamento > pageHeight - 30) { quebraPagina(); }

            doc.setTextColor(...primaryColor);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('FORMAS DE PAGAMENTO', margin, y);
            y += 8;

            if (formaPagamento === 'cartao') {
                // Subtítulo modalidade
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(33, 37, 41);
                doc.text(`Modalidade: ${labelModalidade}`, margin, y);
                y += 6;

                // Cabeçalho da tabela — 3 colunas (Taxa removida)
                const colW = [22, 74, 74];
                const tableX = margin;
                const rowH = 7;
                const tableW = colW.reduce((a, b) => a + b, 0);

                doc.setFillColor(...primaryColor);
                doc.rect(tableX, y, tableW, rowH, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.text('Parcelas', tableX + colW[0] / 2, y + 5, { align: 'center' });
                doc.text('Valor por Parcela', tableX + colW[0] + colW[1] - 3, y + 5, { align: 'right' });
                doc.text('Total', tableX + colW[0] + colW[1] + colW[2] - 3, y + 5, { align: 'right' });
                y += rowH;

                // Linhas 1x a 10x
                taxasCartao.forEach((taxa, idx) => {
                    const n = idx + 1;
                    const totalComTaxa = Math.round(totalGeral * (1 + taxa / 100) * 100) / 100;
                    const valorParcela = Math.round(totalComTaxa / n * 100) / 100;
                    const selecionado  = parcelasSelecionadas === n;

                    if (selecionado) {
                        doc.setFillColor(255, 243, 205);
                    } else {
                        doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
                    }
                    doc.rect(tableX, y, tableW, rowH, 'F');

                    doc.setDrawColor(200, 200, 200);
                    doc.setLineWidth(0.1);
                    doc.rect(tableX, y, tableW, rowH, 'D');

                    doc.setTextColor(selecionado ? 26 : 60, selecionado ? 54 : 60, selecionado ? 93 : 60);
                    doc.setFontSize(selecionado ? 9 : 8);
                    doc.setFont('helvetica', selecionado ? 'bold' : 'normal');

                    doc.text(`${n}x`, tableX + colW[0] / 2, y + 5, { align: 'center' });
                    doc.text(Formatter.currency(valorParcela), tableX + colW[0] + colW[1] - 3, y + 5, { align: 'right' });
                    doc.text(Formatter.currency(totalComTaxa), tableX + colW[0] + colW[1] + colW[2] - 3, y + 5, { align: 'right' });

                    y += rowH;
                });

                y += 5;

                // Nota PIX
                doc.setFillColor(232, 245, 233);
                doc.setDrawColor(56, 161, 105);
                doc.setLineWidth(0.3);
                doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'FD');
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(27, 94, 32);
                doc.text(`Pagamento via PIX (à vista, sem acréscimo): ${Formatter.currency(totalGeral)}`, pageWidth / 2, y + 6, { align: 'center' });
                y += 15;

            } else if (formaPagamento === 'pix') {
                doc.setFillColor(232, 245, 233);
                doc.setDrawColor(56, 161, 105);
                doc.setLineWidth(0.3);
                doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'FD');
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(27, 94, 32);
                doc.text(`Pagamento via PIX (à vista, sem acréscimo): ${Formatter.currency(totalGeral)}`, pageWidth / 2, y + 6, { align: 'center' });
                y += 15;
            }
        }

        // ==========================================
        // VALIDADE E CONDIÇÕES
        // ==========================================

        // Espaço necessário: box validade (9) + gap (6) + header termos (6) +
        // 5 linhas × 5 + margem antes do rodapé (8) ≈ 54mm
        const espacoValidadeTermos = 54;
        if (y + espacoValidadeTermos > pageHeight - 25) { quebraPagina(); }

        // Validade: data atual
        const validade = new Date();

        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(237, 137, 54);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'FD');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(116, 66, 16);
        doc.text(`VALIDADE DA COTAÇÃO: ${Formatter.dateFull(validade)}`, pageWidth / 2, y + 6, { align: 'center' });

        y += 15;

        // ==========================================
        // TERMOS E CONDIÇÕES
        // ==========================================

        // Espaço necessário: header (6) + 5 linhas × 5 + margem antes do rodapé (8) ≈ 39mm
        if (y + 39 > pageHeight - 25) { quebraPagina(); }

        doc.setTextColor(...primaryColor);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('TERMOS E CONDIÇÕES', margin, y);

        y += 6;

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);

        const termos = [
            '• Os preços podem sofrer alterações sem aviso prévio, sujeitos à disponibilidade.',
            '• Após a confirmação, as regras de cancelamento e alteração são definidas pela companhia aérea.',
            '• Documentação válida é de responsabilidade do passageiro.',
            '• Recomendamos check-in online e chegada ao aeroporto com 2h de antecedência (voos domésticos) ou 3h (internacionais).',
            '• A bagagem despachada segue as regras da tarifa contratada.'
        ];

        termos.forEach(termo => {
            if (y > pageHeight - 28) { quebraPagina(); }
            doc.text(termo, margin, y);
            y += 5;
        });

        // ==========================================
        // RODAPÉ (última página)
        // ==========================================

        desenharRodape();

        // ==========================================
        // SALVAR PDF
        // ==========================================

        const nomeArquivo = `Cotacao_${cliente.nome.replace(/\s+/g, '_')}_${dataCotacao.replace(/\//g, '-')}.pdf`;
        doc.save(nomeArquivo);

        debugLog('ReportModule: PDF gerado', nomeArquivo);
    },

    /**
     * Gera PDF do bilhete de reserva no formato visual das companhias aereas.
     * Formato: cabecalho por itinerario (IDA/VOLTA) com horarios grandes,
     * rota IATA central com seta e card por passageiro com assento/bagagem.
     */
    async gerarBilhetePDF(bilhete) {
        if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
            alert('Biblioteca jsPDF nao carregada. Verifique a conexao com a internet.');
            return;
        }

        const logoBase64        = await this.carregarLogo();
        const airlineLogoBase64 = await this.carregarLogoCompanhia(bilhete.companhia);

        const { jsPDF } = jspdf;
        const doc = new jsPDF();

        const pageWidth    = doc.internal.pageSize.getWidth();
        const pageHeight   = doc.internal.pageSize.getHeight();
        const margin       = 15;
        const contentWidth = pageWidth - margin * 2;
        let y = margin;

        const todosBilhetes = (Storage.getBilhetes ? Storage.getBilhetes() : [])
            .filter(b => b.codigoReserva === bilhete.codigoReserva);
        if (todosBilhetes.length === 0) todosBilhetes.push(bilhete);

        const primaryColor = [26, 54, 93];
        const primaryLight = [66, 153, 225];
        const borderColor  = [210, 215, 225];
        const textDark     = [33, 37, 41];
        const textMuted    = [120, 130, 140];
        const rowH         = 8;

        const checkPageBreak = (needed) => {
            if (y + needed > pageHeight - 30) { doc.addPage(); y = margin; }
        };

        const formatDateLong = (ds) => {
            if (!ds) return '';
            try {
                const d = new Date(ds.length === 10 ? ds + 'T12:00:00' : ds);
                const dias = ['Domingo','Segunda-feira','Terca-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sabado'];
                const dd = String(d.getDate()).padStart(2,'0');
                const mm = String(d.getMonth()+1).padStart(2,'0');
                return dias[d.getDay()] + ', ' + dd + '/' + mm + '/' + d.getFullYear();
            } catch(e) { return ds; }
        };

        const drawHeaderCell = (x, yp, w, h, text) => {
            doc.setFillColor(...primaryColor); doc.setDrawColor(...primaryColor); doc.setLineWidth(0.3);
            doc.rect(x, yp, w, h, 'FD');
            doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(255,255,255);
            doc.text(text, x+2, yp + h/2 + 1);
        };
        const drawDataCell = (x, yp, w, h, text) => {
            doc.setDrawColor(...borderColor); doc.setLineWidth(0.3); doc.rect(x, yp, w, h);
            doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...textDark);
            doc.text(text || '-', x+2, yp + h/2 + 1);
        };

        // ── CABECALHO GiraMundoTour ───────────────────────────────────
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 45, 'F');

        if (logoBase64) {
            try {
                doc.setFillColor(255,255,255);
                doc.roundedRect(margin+1, 6, 33, 33, 4, 4, 'F');
                doc.addImage(logoBase64, 'PNG', margin+2, 7, 31, 31);
            } catch(e) {}
        }

        const textoX = logoBase64 ? margin+40 : margin;
        doc.setTextColor(255,255,255);
        doc.setFontSize(24); doc.setFont('helvetica','bold');
        doc.text('GiraMundoTour', textoX, 25);
        doc.setFontSize(10); doc.setFont('helvetica','normal');
        doc.text(CONFIG.empresa.slogan, textoX, 33);

        const contactX = pageWidth - margin;
        let contactY   = 12;
        const iconSize = 4;
        const wppIcon  = this._gerarIconeWhatsApp();
        const igIcon   = this._gerarIconeInstagram();

        doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(255,255,255);
        doc.text(CONFIG.empresa.email, contactX, contactY, { align:'right' }); contactY += 5.5;

        const tel1Text  = CONFIG.empresa.telefone;
        const tel1Width = doc.getTextWidth(tel1Text);
        doc.text(tel1Text, contactX, contactY, { align:'right' });
        try { doc.addImage(wppIcon,'PNG', contactX-tel1Width-iconSize-1.5, contactY-iconSize+0.8, iconSize, iconSize); } catch(e) {}
        contactY += 4.5;

        const tel2Text  = CONFIG.empresa.telefone2;
        const tel2Width = doc.getTextWidth(tel2Text);
        doc.setTextColor(255,255,255);
        doc.text(tel2Text, contactX, contactY, { align:'right' });
        try { doc.addImage(wppIcon,'PNG', contactX-tel2Width-iconSize-1.5, contactY-iconSize+0.8, iconSize, iconSize); } catch(e) {}
        contactY += 5.5;

        const igText  = CONFIG.empresa.instagram;
        const igWidth = doc.getTextWidth(igText);
        doc.setTextColor(255,255,255);
        doc.text(igText, contactX, contactY, { align:'right' });
        try { doc.addImage(igIcon,'PNG', contactX-igWidth-iconSize-1.5, contactY-iconSize+0.8, iconSize, iconSize); } catch(e) {}

        y = 55;

        // Titulo + logo companhia + localizador
        doc.setTextColor(...primaryColor);
        doc.setFontSize(14); doc.setFont('helvetica','bold');
        doc.text('RESERVA AEREA', margin, y);

        if (airlineLogoBase64) {
            try { doc.addImage(airlineLogoBase64,'PNG', pageWidth-margin-30, y-12, 30, 12); } catch(e) {}
        }

        if (bilhete.codigoReserva) {
            doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(...textMuted);
            doc.text('Localizador', pageWidth-margin-52, y-7);
            doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...primaryColor);
            doc.text(bilhete.codigoReserva, pageWidth-margin-52, y-2);
        }

        y += 12;

        // ── INFORMACOES DO VOO ────────────────────────────────────────
        let trechosList = [];
        if (bilhete.trechos && bilhete.trechos.length > 0) {
            trechosList = bilhete.trechos;
        } else {
            trechosList.push({
                tipo:'ida', data:bilhete.dataIda, horaPartida:bilhete.horaPartida,
                horaChegada:bilhete.horaChegada, origem:bilhete.origem,
                destino:bilhete.destino, voo:bilhete.numeroVoo
            });
            if (bilhete.dataVolta) {
                trechosList.push({
                    tipo:'volta', data:bilhete.dataVolta,
                    horaPartida:bilhete._horaPartidaVolta  || '',
                    horaChegada:bilhete._horaChegadaVolta  || '',
                    origem:bilhete.destino, destino:bilhete.origem,
                    voo:bilhete._numeroVooVolta || bilhete.numeroVoo
                });
            }
        }

        const trechosVolta = trechosList.filter(t => t.tipo === 'volta');

        checkPageBreak(15);
        doc.setTextColor(...primaryColor); doc.setFontSize(11); doc.setFont('helvetica','bold');
        doc.text('Informacoes do voo', margin, y);
        y += 8;

        trechosList.forEach((trecho) => {
            checkPageBreak(52);
            const tipo        = trecho.tipo === 'ida' ? 'IDA' : 'VOLTA';
            const oriAirport  = (typeof getAirportByCode === 'function' && trecho.origem)  ? getAirportByCode(trecho.origem)  : null;
            const destAirport = (typeof getAirportByCode === 'function' && trecho.destino) ? getAirportByCode(trecho.destino) : null;
            const qtdTrechos  = trechosList.filter(t => t.tipo === trecho.tipo).length;

            // Barra de cabecalho do itinerario
            const hdrH = 11;
            doc.setFillColor(...primaryColor);
            doc.rect(margin, y, contentWidth, hdrH, 'F');
            doc.setTextColor(255,255,255);
            doc.setFontSize(9); doc.setFont('helvetica','bold');
            doc.text('>> Itinerario de ' + tipo, margin+4, y+7.5);
            doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
            doc.text(formatDateLong(trecho.data), margin + contentWidth/2, y+7.5, { align:'center' });
            doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
            doc.text(qtdTrechos + (qtdTrechos === 1 ? ' Trecho' : ' Trechos'), margin+contentWidth-4, y+7.5, { align:'right' });
            y += hdrH;

            // Caixa de conteudo do voo
            const boxH = 36;
            doc.setFillColor(255,255,255); doc.setDrawColor(...borderColor); doc.setLineWidth(0.4);
            doc.rect(margin, y, contentWidth, boxH, 'FD');

            const cTime = 22;
            const cAirp = 37;
            const cRota = contentWidth - cTime*2 - cAirp*2;

            const xDepTime  = margin + 3;
            const xOriAirp  = margin + cTime + 2;
            const xRotaC    = margin + cTime + cAirp + cRota/2;
            const xDestAirp = margin + cTime + cAirp + cRota + 1;
            const xArrTime  = margin + contentWidth - 3;
            const midY = y + boxH/2;

            // Horario de partida (grande, esquerda)
            doc.setTextColor(...primaryColor); doc.setFontSize(17); doc.setFont('helvetica','bold');
            doc.text(trecho.horaPartida || '--:--', xDepTime, midY - 3);
            const depDateFmt = trecho.data ? Formatter.date(trecho.data) : '';
            doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(...textMuted);
            doc.text(depDateFmt, xDepTime, midY + 4);

            // Aeroporto de origem
            const oriName = oriAirport ? 'Aer. ' + (oriAirport.name || '').substring(0,16) : '';
            const oriCity = oriAirport ? (oriAirport.city || '') : (trecho.origem || '');
            doc.setFontSize(7); doc.setTextColor(...textMuted);
            doc.text(oriName, xOriAirp, midY - 5);
            doc.text(oriCity, xOriAirp, midY + 1);

            // Centro: codigos IATA com linhas horizontais e seta
            const lineY = midY - 2;
            const lineL = xRotaC - 22;
            const lineR = xRotaC + 22;
            doc.setDrawColor(...primaryColor); doc.setLineWidth(0.5);
            doc.line(xOriAirp + cAirp - 2, lineY, lineL, lineY);
            doc.line(lineR, lineY, xDestAirp - 2, lineY);

            // Codigos IATA grandes
            doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...primaryColor);
            doc.text(trecho.origem || '?', lineL - 1, lineY + 1, { align:'right' });
            doc.text(trecho.destino || '?', lineR + 1, lineY + 1, { align:'left' });

            // Seta central
            doc.setFillColor(...primaryColor);
            doc.triangle(xRotaC+2, lineY, xRotaC-2, lineY-2.5, xRotaC-2, lineY+2.5, 'F');

            // Numero do voo centralizado
            const vooStr = (trecho.voo || '').replace(/^(AD|G3|LA)s*/i,'');
            doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...textMuted);
            doc.text(vooStr, xRotaC, midY + 5, { align:'center' });

            // Aeroporto de destino
            const destName = destAirport ? 'Aer. ' + (destAirport.name || '').substring(0,16) : '';
            const destCity = destAirport ? (destAirport.city || '') : (trecho.destino || '');
            doc.setFontSize(7); doc.setTextColor(...textMuted);
            doc.text(destName, xDestAirp, midY - 5);
            doc.text(destCity, xDestAirp, midY + 1);

            // Horario de chegada (grande, direita)
            doc.setTextColor(...primaryColor); doc.setFontSize(17); doc.setFont('helvetica','bold');
            doc.text(trecho.horaChegada || '--:--', xArrTime, midY - 3, { align:'right' });
            doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(...textMuted);
            doc.text(depDateFmt, xArrTime, midY + 4, { align:'right' });

            y += boxH + 5;
        });

        y += 4;

        // ── PASSAGEIROS ───────────────────────────────────────────────
        const nomesPassageiros = [];
        todosBilhetes.forEach(b => {
            const nome = b.passageiroNome || '';
            const lista = nome.includes(',') ? nome.split(',').map(n => n.trim()) : (nome ? [nome] : []);
            lista.forEach(n => { if (n && !nomesPassageiros.includes(n)) nomesPassageiros.push(n); });
        });
        if (nomesPassageiros.length === 0) nomesPassageiros.push(bilhete.passageiroNome || 'N/A');

        checkPageBreak(15);
        doc.setTextColor(...primaryColor); doc.setFontSize(11); doc.setFont('helvetica','bold');
        doc.text('Passageiros: ' + nomesPassageiros.length, margin, y);
        y += 8;

        const hasVolta = trechosVolta.length > 0;
        const halfW    = contentWidth / 2;

        const drawHalf = (xBase, cardW, tipoLabel) => {
            const pad = 5;
            // Tab Ida / Volta
            doc.setFillColor(195, 218, 244);
            doc.roundedRect(xBase+pad, y+pad, 16, 6, 1, 1, 'F');
            doc.setTextColor(26,54,93); doc.setFontSize(6); doc.setFont('helvetica','bold');
            doc.text(tipoLabel, xBase+pad+8, y+pad+4.2, { align:'center' });

            // Icone aviao simplificado (triangulo + linha)
            const planeX = xBase + pad + 1;
            const planeY = y + 20;
            doc.setFillColor(...primaryLight);
            doc.triangle(planeX+4, planeY, planeX, planeY+2, planeX, planeY-2, 'F');
            doc.setDrawColor(...primaryLight); doc.setLineWidth(1.2);
            doc.line(planeX+4, planeY, planeX-3, planeY);

            // Assentos
            const assX = xBase + pad + 25;
            doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(...textMuted);
            doc.text('Assentos', assX, y+10);
            doc.setFontSize(6.5); doc.setTextColor(80,80,80);
            doc.text('Trecho 1', assX, y+16);
            // Caixa do assento (azul escuro, traço branco)
            doc.setFillColor(...primaryColor);
            doc.roundedRect(assX, y+18, 13, 7, 1, 1, 'F');
            doc.setTextColor(255,255,255); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
            doc.text('-', assX+6.5, y+23, { align:'center' });

            // Bagagens
            const bagX = assX + 20;
            doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(...textMuted);
            doc.text('Bagagens*', bagX, y+10);
            const bagStr = bilhete.bagagem || '';
            const pesos  = bagStr.match(/\d+\s*kg/gi) || [];
            if (pesos.length >= 2) {
                [[bagX, pesos[0]], [bagX+18, pesos[1]]].forEach(([bx, peso]) => {
                    doc.setDrawColor(80,80,80); doc.setLineWidth(0.4);
                    doc.rect(bx, y+16, 8, 6);
                    doc.line(bx+2, y+16, bx+2, y+14.5);
                    doc.line(bx+6, y+16, bx+6, y+14.5);
                    doc.line(bx+2, y+14.5, bx+6, y+14.5);
                    doc.setFontSize(5.5); doc.setTextColor(80,80,80);
                    doc.text(peso, bx+4, y+24, { align:'center' });
                });
            } else if (bagStr) {
                doc.setFontSize(6); doc.setTextColor(80,80,80);
                const bl = doc.splitTextToSize(bagStr, cardW - (bagX - xBase) - pad);
                doc.text(bl, bagX, y+17);
            }
        };

        nomesPassageiros.forEach(nome => {
            checkPageBreak(46);

            // Barra com nome
            const nameH = 9;
            doc.setFillColor(232, 237, 245); doc.setDrawColor(...borderColor); doc.setLineWidth(0.3);
            doc.rect(margin, y, contentWidth, nameH, 'FD');
            doc.setTextColor(...textDark); doc.setFontSize(9.5); doc.setFont('helvetica','bold');
            doc.text(nome.toUpperCase(), margin+4, y+6.5);
            y += nameH;

            const cardH = 32;
            const cardW = hasVolta ? halfW : contentWidth;

            // Card Ida
            doc.setFillColor(255,255,255); doc.setDrawColor(...borderColor); doc.setLineWidth(0.3);
            doc.rect(margin, y, cardW, cardH, 'FD');
            drawHalf(margin, cardW, 'Ida');

            // Card Volta (se houver)
            if (hasVolta) {
                doc.setFillColor(255,255,255); doc.setDrawColor(...borderColor); doc.setLineWidth(0.3);
                doc.rect(margin+halfW, y, halfW, cardH, 'FD');
                drawHalf(margin+halfW, halfW, 'Volta');
            }

            y += cardH + 5;
        });

        y += 5;

        // ── TABELA DE VALORES ─────────────────────────────────────────
        checkPageBreak(30 + nomesPassageiros.length * rowH);
        const vCols    = [65, 35, 35, 45];
        const vHeaders = ['Valores', 'Tarifa', 'Taxa Emb.', 'Total'];
        let vx = margin;
        vHeaders.forEach((h, i) => { drawHeaderCell(vx, y, vCols[i], rowH, h); vx += vCols[i]; });
        y += rowH;

        let grandTotal = 0, grandTarifa = 0, grandTaxa = 0;
        const valoresPassageiros = [];
        todosBilhetes.forEach(b => {
            const nomeCompleto = b.passageiroNome || 'N/A';
            const nomes = nomeCompleto.includes(',') ? nomeCompleto.split(',').map(n => n.trim()) : [nomeCompleto];
            const qtd   = nomes.length;
            const tarifa = (b.tarifa || 0) / qtd;
            const taxa   = (b.taxaEmbarque || 0) / qtd;
            const total  = (b.valorVenda || (tarifa + taxa) * qtd) / qtd;
            nomes.forEach(n => valoresPassageiros.push({ nome:n, tarifa, taxa, total }));
        });
        valoresPassageiros.forEach(p => {
            grandTotal += p.total; grandTarifa += p.tarifa; grandTaxa += p.taxa;
            vx = margin;
            [p.nome,
             p.tarifa ? Formatter.currency(p.tarifa) : '-',
             p.taxa   ? Formatter.currency(p.taxa)   : '-',
             Formatter.currency(p.total)
            ].forEach((val, i) => { drawDataCell(vx, y, vCols[i], rowH, val); vx += vCols[i]; });
            y += rowH;
        });
        vx = margin;
        ['Total',
         grandTarifa ? Formatter.currency(grandTarifa) : '-',
         grandTaxa   ? Formatter.currency(grandTaxa)   : '-',
         Formatter.currency(grandTotal)
        ].forEach((val, i) => {
            doc.setFillColor(245,245,245); doc.setDrawColor(...borderColor); doc.setLineWidth(0.3);
            doc.rect(vx, y, vCols[i], rowH, 'FD');
            doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...textDark);
            doc.text(val, vx+2, y + rowH/2 + 1);
            vx += vCols[i];
        });
        y += rowH + 8;

        // ── INFORMACOES IMPORTANTES ───────────────────────────────────
        checkPageBreak(50);
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...textDark);
        doc.text('Informacoes Importantes Sobre Sua Viagem', margin+2, y+1);
        y += 5;
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
        const informacoes = [
            'Os voos sao validos apenas nas datas e horarios reservados.',
            'Nao e permitido embarcar em outro dia ou horario, salvo se a tarifa permitir alteracao.',
            'Alteracoes voluntarias podem gerar custos adicionais, conforme a tarifa e a companhia aerea.',
            'Algumas tarifas nao permitem reembolso nem alteracoes apos a emissao.',
            'O nao comparecimento (no-show) pode acarretar o cancelamento automatico dos trechos seguintes.',
            'Em certos casos, o passageiro perde o direito a viagem e ao reembolso.',
            'O transporte aereo segue normas da aviacao civil brasileira e legislacoes aplicaveis.',
            'Em caso de duvidas, consulte seu agente de viagens antes da compra.'
        ];
        const infoBoxH = informacoes.length * 4.5 + 4;
        doc.setDrawColor(...borderColor); doc.rect(margin, y-3, contentWidth, infoBoxH);
        informacoes.forEach(info => { doc.text('  * ' + info, margin+2, y+1); y += 4.5; });
        y += 5;

        // ── ORIENTACOES PARA O EMBARQUE ───────────────────────────────
        checkPageBreak(40);
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...textDark);
        doc.text('Orientacoes para o Embarque', margin+2, y+1);
        y += 5;
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
        const orientacoes = [
            'Apresente-se no aeroporto com antecedencia minima de 2 horas para voos nacionais e 3 horas para internacionais.',
            'E obrigatorio apresentar documento original e valido: RG para voos nacionais, passaporte para internacionais.',
            'Verifique exigencias do destino: visto, vacinas ou validade minima de passaporte (geralmente 6 meses).',
            'Para confirmar essas exigencias, consulte embaixadas ou despachantes especializados.'
        ];
        const oriBoxH = orientacoes.length * 5 + 6;
        doc.setDrawColor(...borderColor); doc.rect(margin, y-3, contentWidth, oriBoxH);
        orientacoes.forEach(ori => {
            const lines = doc.splitTextToSize('  * ' + ori, contentWidth - 6);
            lines.forEach(line => { doc.text(line, margin+2, y+1); y += 4; });
            y += 0.5;
        });

        // ── RODAPE em todas as paginas ────────────────────────────────
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            const footerY = pageHeight - 20;
            doc.setDrawColor(...primaryLight); doc.setLineWidth(0.5);
            doc.line(margin, footerY, pageWidth-margin, footerY);
            doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(60,60,60);
            doc.text(CONFIG.empresa.nome, margin, footerY+5);
            doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100);
            doc.text('CNPJ: ' + CONFIG.empresa.cnpj, pageWidth-margin, footerY+5, { align:'right' });
            doc.setFontSize(7);
            doc.text(CONFIG.empresa.email+'  |  '+CONFIG.empresa.telefone+'  |  '+CONFIG.empresa.telefone2+'  |  '+CONFIG.empresa.instagram,
                pageWidth/2, footerY+10, { align:'center' });
        }

        const nomeArquivo = 'Bilhete_' + bilhete.codigoReserva + '_GiraMundoTour.pdf';
        doc.save(nomeArquivo);
        debugLog('ReportModule: Bilhete PDF gerado', nomeArquivo);
    },

    /**
     * Gera PDF de recibo de pagamento para um bilhete.
     * @param {object} bilhete - Dados do bilhete
     * @param {string} formaPagamento - Forma de pagamento informada
     */
    async gerarReciboPDF(bilhete, formaPagamento) {
        if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
            alert('Biblioteca jsPDF não carregada. Verifique a conexão com a internet.');
            return;
        }

        const logoBase64 = await this.carregarLogo();
        const { jsPDF } = jspdf;
        const doc = new jsPDF();

        const pageWidth    = doc.internal.pageSize.getWidth();
        const pageHeight   = doc.internal.pageSize.getHeight();
        const margin       = 20;
        const contentWidth = pageWidth - margin * 2;
        let y = margin;

        const primaryColor = [26, 54, 93];
        const primaryLight = [66, 153, 225];
        const borderColor  = [210, 215, 225];
        const textDark     = [33, 37, 41];
        const textMuted    = [120, 130, 140];
        const rowH         = 8;

        // ── CABEÇALHO ────────────────────────────────────────────────
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 45, 'F');

        if (logoBase64) {
            try {
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(margin + 1, 6, 33, 33, 4, 4, 'F');
                doc.addImage(logoBase64, 'PNG', margin + 2, 7, 31, 31);
            } catch(e) {}
        }

        const textoX = logoBase64 ? margin + 40 : margin;
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24); doc.setFont('helvetica', 'bold');
        doc.text('GiraMundoTour', textoX, 25);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(CONFIG.empresa.slogan, textoX, 33);

        const contactX  = pageWidth - margin;
        let contactY    = 12;
        const iconSize  = 4;
        const wppIcon   = this._gerarIconeWhatsApp();
        const igIcon    = this._gerarIconeInstagram();

        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255);
        doc.text(CONFIG.empresa.email, contactX, contactY, { align: 'right' }); contactY += 5.5;

        const tel1Text  = CONFIG.empresa.telefone;
        const tel1Width = doc.getTextWidth(tel1Text);
        doc.text(tel1Text, contactX, contactY, { align: 'right' });
        try { doc.addImage(wppIcon, 'PNG', contactX - tel1Width - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}
        contactY += 4.5;

        const tel2Text  = CONFIG.empresa.telefone2;
        const tel2Width = doc.getTextWidth(tel2Text);
        doc.setTextColor(255, 255, 255);
        doc.text(tel2Text, contactX, contactY, { align: 'right' });
        try { doc.addImage(wppIcon, 'PNG', contactX - tel2Width - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}
        contactY += 5.5;

        const igText  = CONFIG.empresa.instagram;
        const igWidth = doc.getTextWidth(igText);
        doc.setTextColor(255, 255, 255);
        doc.text(igText, contactX, contactY, { align: 'right' });
        try { doc.addImage(igIcon, 'PNG', contactX - igWidth - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}

        y = 55;

        // ── TÍTULO ───────────────────────────────────────────────────
        doc.setTextColor(...primaryColor);
        doc.setFontSize(18); doc.setFont('helvetica', 'bold');
        doc.text('RECIBO DE PAGAMENTO', margin, y);

        y += 8;
        const numeroRecibo  = String(Math.floor(Math.random() * 9000) + 1000);
        const dataEmissao   = bilhete.dataEmissao ? Formatter.date(bilhete.dataEmissao) : Formatter.date(new Date());

        doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
        doc.text(`Recibo Nº: ${numeroRecibo}`, margin, y);
        doc.text(`Data: ${Formatter.date(new Date())}`, pageWidth - margin, y, { align: 'right' });
        y += 5;
        doc.setFontSize(9);
        doc.text(`Reserva: ${bilhete.codigoReserva || '-'}`, margin, y);
        doc.text(`Emissão Bilhete: ${dataEmissao}`, pageWidth - margin, y, { align: 'right' });

        y += 14;

        // ── DADOS DO CLIENTE ─────────────────────────────────────────
        doc.setFillColor(240, 245, 255);
        doc.setDrawColor(...primaryLight);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y - 5, contentWidth, 28, 3, 3, 'FD');

        doc.setTextColor(...primaryColor);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text('DADOS DO CLIENTE', margin + 5, y + 2);

        y += 9;
        doc.setTextColor(...textDark);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        const nomeCliente = bilhete.clienteNome || bilhete.cliente?.nome || 'N/A';
        doc.text(`Nome: ${nomeCliente}`, margin + 5, y);
        if (bilhete.clienteTelefone) {
            doc.text(`Telefone: ${Formatter.phone(bilhete.clienteTelefone)}`, pageWidth / 2, y);
        }

        y += 22;

        // ── PASSAGEIROS ──────────────────────────────────────────────
        const nomesPassageiros = [];
        const nomeBruto = bilhete.passageiroNome || '';
        (nomeBruto.includes(',')
            ? nomeBruto.split(',').map(n => n.trim()).filter(Boolean)
            : (nomeBruto ? [nomeBruto] : [])
        ).forEach(n => nomesPassageiros.push(n));
        if (nomesPassageiros.length === 0) nomesPassageiros.push('N/A');

        const passBoxH = 14 + nomesPassageiros.length * 7;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y - 5, contentWidth, passBoxH, 3, 3, 'FD');

        doc.setTextColor(...primaryColor);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(`PASSAGEIROS (${nomesPassageiros.length})`, margin + 5, y + 2);
        y += 9;

        doc.setTextColor(...textDark);
        doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
        nomesPassageiros.forEach((nome, i) => {
            doc.text(`${i + 1}.  ${nome}`, margin + 8, y);
            y += 7;
        });

        y += 10;

        // ── DADOS DO VOO ─────────────────────────────────────────────
        if (y > pageHeight - 80) { doc.addPage(); y = margin; }

        const origemAirport  = (typeof getAirportByCode === 'function' && bilhete.origem)  ? getAirportByCode(bilhete.origem)  : null;
        const destinoAirport = (typeof getAirportByCode === 'function' && bilhete.destino) ? getAirportByCode(bilhete.destino) : null;
        const origemLabel    = origemAirport  ? `${bilhete.origem} — ${origemAirport.city}`  : (bilhete.origem  || '-');
        const destinoLabel   = destinoAirport ? `${bilhete.destino} — ${destinoAirport.city}` : (bilhete.destino || '-');

        const vooBoxH = 44;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y - 5, contentWidth, vooBoxH, 3, 3, 'FD');

        doc.setTextColor(...primaryColor);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text('DADOS DO VOO', margin + 5, y + 2);
        y += 9;

        doc.setTextColor(...textDark);
        doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
        const col2X = margin + contentWidth / 2;
        doc.text(`Companhia: ${bilhete.companhiaNome || bilhete.companhia || '-'}`, margin + 5, y);
        doc.text(`Localizador: ${bilhete.codigoReserva || '-'}`, col2X, y);
        y += 7;
        doc.text(`Origem: ${origemLabel}`, margin + 5, y);
        doc.text(`Destino: ${destinoLabel}`, col2X, y);
        y += 7;
        doc.text(`Data de Ida: ${bilhete.dataIda ? Formatter.date(bilhete.dataIda) : '-'}`, margin + 5, y);
        if (bilhete.dataVolta) {
            doc.text(`Data de Volta: ${Formatter.date(bilhete.dataVolta)}`, col2X, y);
        }

        y += 18;

        // ── TABELA DE PAGAMENTO ──────────────────────────────────────
        if (y > pageHeight - 80) { doc.addPage(); y = margin; }

        doc.setTextColor(...primaryColor);
        doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text('PAGAMENTO', margin, y);
        y += 8;

        const totalPax    = nomesPassageiros.length || 1;
        const valorTotal  = bilhete.valorVenda || 0;
        const valorPorPax = valorTotal / totalPax;

        const colW = [contentWidth - 45, 45];

        // Cabeçalho da tabela
        let tx = margin;
        ['Passageiro', 'Valor Pago'].forEach((h, i) => {
            doc.setFillColor(...primaryColor);
            doc.rect(tx, y, colW[i], rowH, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
            doc.text(h, tx + 3, y + rowH / 2 + 1.5);
            tx += colW[i];
        });
        y += rowH;

        // Linhas dos passageiros
        nomesPassageiros.forEach((nome, i) => {
            tx = margin;
            const bg = i % 2 === 0 ? 255 : 249;
            colW.forEach(w => {
                doc.setFillColor(bg, bg, bg);
                doc.setDrawColor(...borderColor); doc.setLineWidth(0.2);
                doc.rect(tx, y, w, rowH, 'FD'); tx += w;
            });
            tx = margin;
            doc.setTextColor(...textDark); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
            doc.text(nome, tx + 3, y + rowH / 2 + 1.5); tx += colW[0];
            doc.text(Formatter.currency(valorPorPax), tx + 3, y + rowH / 2 + 1.5);
            y += rowH;
        });

        // Linha de total
        tx = margin;
        colW.forEach(w => {
            doc.setFillColor(230, 240, 255);
            doc.setDrawColor(...primaryLight); doc.setLineWidth(0.4);
            doc.rect(tx, y, w, rowH + 2, 'FD'); tx += w;
        });
        tx = margin;
        doc.setTextColor(...primaryColor); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text(`TOTAL  (${totalPax} ${totalPax === 1 ? 'passageiro' : 'passageiros'})`, tx + 3, y + (rowH + 2) / 2 + 2);
        doc.text(Formatter.currency(valorTotal), margin + colW[0] + 3, y + (rowH + 2) / 2 + 2);
        y += rowH + 2 + 8;

        // Forma de pagamento
        if (formaPagamento) {
            doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textDark);
            const labelW = doc.getTextWidth('Forma de Pagamento:  ');
            doc.text('Forma de Pagamento:  ', margin, y);
            doc.setFont('helvetica', 'bold'); doc.setTextColor(...primaryColor);
            doc.text(formaPagamento, margin + labelW, y);
            y += 12;
        }

        y += 4;

        // ── DECLARAÇÃO ───────────────────────────────────────────────
        if (y > pageHeight - 55) { doc.addPage(); y = margin; }

        const declaracao = `Declaro ter recebido de ${nomeCliente} a importância de ${Formatter.currency(valorTotal)}` +
            ` referente à aquisição de passagens aéreas para ${nomesPassageiros.length === 1 ? 'o passageiro' : 'os passageiros'} acima discriminado${nomesPassageiros.length === 1 ? '' : 's'},` +
            ` conforme reserva ${bilhete.codigoReserva || ''}.`;
        const declLines = doc.splitTextToSize(declaracao, contentWidth - 10);
        const declH     = declLines.length * 5 + 10;

        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y - 3, contentWidth, declH, 2, 2, 'FD');
        doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 80, 80);
        declLines.forEach((line, i) => { doc.text(line, margin + 5, y + 3 + i * 5); });
        y += declH + 12;

        // ── ASSINATURAS ──────────────────────────────────────────────
        if (y > pageHeight - 40) { doc.addPage(); y = margin; }

        const sigW = (contentWidth - 20) / 2;
        doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.4);
        doc.line(margin, y, margin + sigW, y);
        doc.line(margin + sigW + 20, y, margin + contentWidth, y);

        y += 4;
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMuted);
        doc.text(CONFIG.empresa.nome, margin + sigW / 2, y, { align: 'center' });
        doc.text(nomeCliente, margin + sigW + 20 + sigW / 2, y, { align: 'center' });

        y += 4;
        doc.setFontSize(7.5);
        doc.text('Agência de Viagens', margin + sigW / 2, y, { align: 'center' });
        doc.text('Cliente', margin + sigW + 20 + sigW / 2, y, { align: 'center' });

        // ── RODAPÉ em todas as páginas ────────────────────────────────
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            const footerY = pageHeight - 20;
            doc.setDrawColor(...primaryLight); doc.setLineWidth(0.5);
            doc.line(margin, footerY, pageWidth - margin, footerY);
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
            doc.text(CONFIG.empresa.nome, margin, footerY + 5);
            doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
            doc.text('CNPJ: ' + CONFIG.empresa.cnpj, pageWidth - margin, footerY + 5, { align: 'right' });
            doc.setFontSize(7);
            doc.text(CONFIG.empresa.email + '  |  ' + CONFIG.empresa.telefone + '  |  ' + CONFIG.empresa.telefone2 + '  |  ' + CONFIG.empresa.instagram,
                pageWidth / 2, footerY + 10, { align: 'center' });
        }

        const nomeArq = `Recibo_${bilhete.codigoReserva || 'R' + numeroRecibo}_GiraMundoTour.pdf`;
        doc.save(nomeArq);
        debugLog('ReportModule: Recibo PDF gerado', nomeArq);
    },

    /**
     * Gera relatório de cotações
     * @param {Date} dataInicio - Data inicial
     * @param {Date} dataFim - Data final
     */
    async gerarRelatorioCotacoes(dataInicio, dataFim) {
        let todasCotacoes = [];
        try {
            const resp = await apiCall('/api/cotacoes?limit=500&page=1');
            if (resp) {
                const data = await resp.json();
                todasCotacoes = (data && data.data) ? data.data : [];
            }
        } catch (e) {
            console.warn('[ReportModule] Erro ao buscar cotações:', e.message);
        }
        const cotacoes = todasCotacoes.filter(c => {
            const data = new Date(c.createdAt || c.dataCriacao);
            return data >= dataInicio && data <= dataFim;
        });

        if (cotacoes.length === 0) {
            alert('Nenhuma cotação encontrada no período selecionado.');
            return;
        }

        const { jsPDF } = jspdf;
        const doc = new jsPDF('landscape');

        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = margin;

        // Cabeçalho
        doc.setFillColor(26, 54, 93);
        doc.rect(0, 0, pageWidth, 30, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('RELATÓRIO DE COTAÇÕES', margin, 20);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Período: ${Formatter.date(dataInicio)} a ${Formatter.date(dataFim)}`, pageWidth - margin, 20, { align: 'right' });

        y = 40;

        // Tabela
        const headers = ['Data', 'Cliente', 'Origem/Destino', 'Passageiros', 'Total', 'Status'];
        const colWidths = [30, 60, 60, 40, 40, 30];
        let x = margin;

        // Cabeçalho da tabela
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y - 5, pageWidth - (margin * 2), 10, 'F');

        doc.setTextColor(26, 54, 93);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');

        headers.forEach((header, i) => {
            doc.text(header, x + 2, y);
            x += colWidths[i];
        });

        y += 10;

        // Dados
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);

        let totalGeral = 0;

        cotacoes.forEach(cotacao => {
            const clienteNome = cotacao.cliente?.nome || 'N/A';
            const voos = Array.isArray(cotacao.voos) ? cotacao.voos : (typeof cotacao.voos === 'string' ? JSON.parse(cotacao.voos || '[]') : []);
            const passageiros = typeof cotacao.passageiros === 'string' ? JSON.parse(cotacao.passageiros || '{}') : (cotacao.passageiros || {});
            const rota = voos.length > 0
                ? `${voos[0].origem || voos[0].origin || ''} → ${voos[0].destino || voos[0].destination || ''}`
                : '-';

            x = margin;

            doc.text(Formatter.date(cotacao.createdAt || cotacao.dataCriacao), x + 2, y);
            x += colWidths[0];

            doc.text(Formatter.truncate(clienteNome, 25), x + 2, y);
            x += colWidths[1];

            doc.text(rota, x + 2, y);
            x += colWidths[2];

            doc.text(Formatter.passengers(passageiros), x + 2, y);
            x += colWidths[3];

            doc.text(Formatter.currency(cotacao.total), x + 2, y);
            x += colWidths[4];

            const status = Formatter.quotationStatus(cotacao.status);
            doc.text(status.text, x + 2, y);

            totalGeral += parseFloat(cotacao.total) || 0;
            y += 7;

            // Nova página se necessário
            if (y > doc.internal.pageSize.getHeight() - 30) {
                doc.addPage();
                y = margin;
            }
        });

        // Total
        y += 5;
        doc.setDrawColor(26, 54, 93);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 54, 93);
        doc.text(`Total de Cotações: ${cotacoes.length}`, margin, y);
        doc.text(`Valor Total: ${Formatter.currency(totalGeral)}`, pageWidth - margin, y, { align: 'right' });

        // Salvar
        const nomeArquivo = `Relatorio_Cotacoes_${Formatter.date(dataInicio).replace(/\//g, '-')}_a_${Formatter.date(dataFim).replace(/\//g, '-')}.pdf`;
        doc.save(nomeArquivo);

        debugLog('ReportModule: Relatório gerado', nomeArquivo);
    },

    /**
     * Gera PDF de fatura/invoice formal com todos os dados da empresa.
     * @param {object} bilhete      - Dados do bilhete
     * @param {object} cliente      - Dados completos do cliente (com cpf/cnpj/endereco)
     * @param {object} opcoes       - { formaPagamento, observacao }
     */
    async gerarInvoicePDF(bilhete, cliente, opcoes = {}) {
        if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
            alert('Biblioteca jsPDF não carregada. Verifique a conexão com a internet.');
            return;
        }

        const logoBase64 = await this.carregarLogo();
        const { jsPDF } = jspdf;
        const doc = new jsPDF();

        const pageWidth    = doc.internal.pageSize.getWidth();
        const pageHeight   = doc.internal.pageSize.getHeight();
        const margin       = 20;
        const contentWidth = pageWidth - margin * 2;
        let y = margin;

        const primaryColor = [26, 54, 93];
        const primaryLight = [66, 153, 225];
        const borderColor  = [210, 215, 225];
        const textDark     = [33, 37, 41];
        const textMuted    = [120, 130, 140];
        const greenColor   = [27, 94, 32];
        const greenBg      = [232, 245, 233];
        const rowH         = 8;

        const checkPage = (needed) => {
            if (y + needed > pageHeight - 28) { doc.addPage(); y = margin; }
        };

        // ── CABEÇALHO ────────────────────────────────────────────────
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 45, 'F');

        if (logoBase64) {
            try {
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(margin + 1, 6, 33, 33, 4, 4, 'F');
                doc.addImage(logoBase64, 'PNG', margin + 2, 7, 31, 31);
            } catch(e) {}
        }

        const textoX = logoBase64 ? margin + 40 : margin;
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24); doc.setFont('helvetica', 'bold');
        doc.text('GiraMundoTour', textoX, 25);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(CONFIG.empresa.slogan, textoX, 33);

        const contactX = pageWidth - margin;
        let contactY   = 12;
        const iconSize = 4;
        const wppIcon  = this._gerarIconeWhatsApp();
        const igIcon   = this._gerarIconeInstagram();

        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255);
        doc.text(CONFIG.empresa.email, contactX, contactY, { align: 'right' }); contactY += 5.5;

        const tel1Text  = CONFIG.empresa.telefone;
        const tel1Width = doc.getTextWidth(tel1Text);
        doc.text(tel1Text, contactX, contactY, { align: 'right' });
        try { doc.addImage(wppIcon, 'PNG', contactX - tel1Width - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}
        contactY += 4.5;

        const tel2Text  = CONFIG.empresa.telefone2;
        const tel2Width = doc.getTextWidth(tel2Text);
        doc.setTextColor(255, 255, 255);
        doc.text(tel2Text, contactX, contactY, { align: 'right' });
        try { doc.addImage(wppIcon, 'PNG', contactX - tel2Width - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}
        contactY += 5.5;

        const igText  = CONFIG.empresa.instagram;
        const igWidth = doc.getTextWidth(igText);
        doc.setTextColor(255, 255, 255);
        doc.text(igText, contactX, contactY, { align: 'right' });
        try { doc.addImage(igIcon, 'PNG', contactX - igWidth - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}

        y = 55;

        // ── TÍTULO DA FATURA ─────────────────────────────────────────
        const numeroInvoice = 'INV-' + new Date().getFullYear() + '-' +
            String(Math.floor(Math.random() * 9000) + 1000);
        const dataEmissao  = Formatter.date(new Date());

        doc.setTextColor(...primaryColor);
        doc.setFontSize(20); doc.setFont('helvetica', 'bold');
        doc.text('FATURA / INVOICE', margin, y);

        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMuted);
        doc.text(`Nº: ${numeroInvoice}`, pageWidth - margin, y - 4, { align: 'right' });
        doc.text(`Emissão: ${dataEmissao}`, pageWidth - margin, y + 2, { align: 'right' });
        if (bilhete.codigoReserva) {
            doc.text(`Reserva: ${bilhete.codigoReserva}`, pageWidth - margin, y + 8, { align: 'right' });
        }

        y += 16;

        // ── LINHA DIVISÓRIA ──────────────────────────────────────────
        doc.setDrawColor(...primaryLight); doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        // ── EMITENTE | TOMADOR (2 colunas) ──────────────────────────
        const halfW = (contentWidth - 8) / 2;
        const col2X = margin + halfW + 8;
        const boxStartY = y;

        // Box emitente
        doc.setFillColor(245, 248, 255);
        doc.setDrawColor(...primaryLight); doc.setLineWidth(0.3);
        doc.roundedRect(margin, y - 3, halfW, 52, 2, 2, 'FD');

        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...primaryLight);
        doc.text('PRESTADOR DE SERVIÇOS', margin + 4, y + 3);
        y += 8;

        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...primaryColor);
        doc.text(CONFIG.empresa.nome, margin + 4, y); y += 6;

        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textDark);
        doc.text(`CNPJ: ${CONFIG.empresa.cnpj}`, margin + 4, y); y += 5;
        doc.text(CONFIG.empresa.endereco, margin + 4, y); y += 5;
        doc.text(`Tel: ${CONFIG.empresa.telefone}  |  ${CONFIG.empresa.telefone2}`, margin + 4, y); y += 5;
        doc.text(`E-mail: ${CONFIG.empresa.email}`, margin + 4, y); y += 5;
        if (CONFIG.empresa.site) {
            doc.text(`Site: ${CONFIG.empresa.site}`, margin + 4, y);
        }

        // Box tomador
        y = boxStartY;
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(...borderColor); doc.setLineWidth(0.3);
        doc.roundedRect(col2X, y - 3, halfW, 52, 2, 2, 'FD');

        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textMuted);
        doc.text('TOMADOR / CLIENTE', col2X + 4, y + 3);
        y += 8;

        const nomeCliente = cliente?.nome || bilhete.clienteNome || 'N/A';
        const cpfCliente  = cliente?.cpf  ? Formatter.cpf(cliente.cpf)   : null;
        const cnpjCliente = cliente?.cnpj ? Formatter.cnpj(cliente.cnpj) : null;
        const docCliente  = cnpjCliente || cpfCliente || null;

        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textDark);
        doc.text(nomeCliente, col2X + 4, y); y += 6;

        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        if (docCliente) {
            doc.text(`${cnpjCliente ? 'CNPJ' : 'CPF'}: ${docCliente}`, col2X + 4, y); y += 5;
        }
        if (cliente?.rg) {
            doc.text(`RG: ${cliente.rg}`, col2X + 4, y); y += 5;
        }
        if (cliente?.telefone || bilhete.clienteTelefone) {
            doc.text(`Tel: ${Formatter.phone(cliente?.telefone || bilhete.clienteTelefone)}`, col2X + 4, y); y += 5;
        }
        if (cliente?.email || bilhete.clienteEmail) {
            doc.text(`E-mail: ${cliente?.email || bilhete.clienteEmail}`, col2X + 4, y); y += 5;
        }
        if (cliente?.endereco) {
            const endStr = [cliente.endereco, cliente.cidade, cliente.estado].filter(Boolean).join(', ');
            doc.text(endStr, col2X + 4, y);
        }

        y = boxStartY + 52 + 10;

        // ── PASSAGEIROS ──────────────────────────────────────────────
        const nomesPassageiros = (() => {
            const n = bilhete.passageiroNome || '';
            const lista = n.includes(',') ? n.split(',').map(s => s.trim()).filter(Boolean) : (n ? [n] : []);
            return lista.length > 0 ? lista : ['N/A'];
        })();
        const qtdPax = nomesPassageiros.length;

        checkPage(14 + qtdPax * 6);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...primaryColor);
        doc.text(`PASSAGEIROS (${qtdPax})`, margin, y); y += 6;

        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textDark);
        nomesPassageiros.forEach((nome, i) => {
            doc.text(`${i + 1}.  ${nome}`, margin + 4, y); y += 5.5;
        });
        y += 6;

        // ── TABELA DE SERVIÇOS ───────────────────────────────────────
        checkPage(60);

        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...primaryColor);
        doc.text('DESCRIÇÃO DOS SERVIÇOS', margin, y); y += 8;

        // Montar itens da fatura
        const tarifa        = parseFloat(bilhete.tarifa)       || 0;
        const taxaEmbarque  = parseFloat(bilhete.taxaEmbarque) || 0;
        const valorTotal    = parseFloat(bilhete.valorVenda)   || 0;
        const somaConhecida = tarifa + taxaEmbarque;
        const diff          = Math.round((valorTotal - somaConhecida) * 100) / 100;

        const companhiaNome = bilhete.companhiaNome || bilhete.companhia || '';
        const numeroVoo     = bilhete.numeroVoo     || '';
        const origemLabel   = bilhete.origem  || '';
        const destinoLabel  = bilhete.destino || '';
        const dataIda       = bilhete.dataIda   ? Formatter.date(bilhete.dataIda)   : '';
        const dataVolta     = bilhete.dataVolta ? Formatter.date(bilhete.dataVolta) : '';
        const rotaStr       = [origemLabel, destinoLabel].filter(Boolean).join(' → ');
        const datasStr      = dataVolta ? `${dataIda} — ${dataVolta}` : dataIda;

        const descVoo = [
            `Passagem Aérea — ${companhiaNome}${numeroVoo ? ' ' + numeroVoo : ''}`,
            rotaStr ? `Rota: ${rotaStr}` : '',
            datasStr ? `Data${dataVolta ? 's' : ''}: ${datasStr}` : '',
            bilhete.cabine ? `Cabine: ${bilhete.cabine}` : ''
        ].filter(Boolean);

        const itens = [];
        if (tarifa > 0) {
            itens.push({ desc: descVoo, qtd: qtdPax, unit: tarifa / qtdPax, total: tarifa });
        } else if (tarifa === 0 && taxaEmbarque === 0 && valorTotal > 0) {
            itens.push({ desc: descVoo, qtd: qtdPax, unit: valorTotal / qtdPax, total: valorTotal });
        }
        if (taxaEmbarque > 0) {
            itens.push({ desc: ['Taxa de Embarque Aeroportuária'], qtd: qtdPax, unit: taxaEmbarque / qtdPax, total: taxaEmbarque });
        }
        if (bilhete.bagagem && bilhete.bagagem.trim()) {
            const pesosMatch = bilhete.bagagem.match(/\d+\s*kg/gi) || [];
            const descBag = pesosMatch.length > 0
                ? `Bagagem Despachada — ${pesosMatch.join(', ')}`
                : `Bagagem — ${bilhete.bagagem}`;
            itens.push({ desc: [descBag], qtd: 1, unit: null, total: null, info: true });
        }
        if (diff > 0.01) {
            itens.push({ desc: ['Serviços / Taxas Agência'], qtd: 1, unit: diff, total: diff });
        }

        // Cabeçalho da tabela
        const colW = [90, 14, 38, 28];
        const tableW = colW.reduce((a, b) => a + b, 0);
        const headers = ['Descrição', 'Qtd', 'Valor Unit.', 'Total'];
        let tx = margin;
        headers.forEach((h, i) => {
            doc.setFillColor(...primaryColor);
            doc.rect(tx, y, colW[i], rowH, 'F');
            doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
            const align = i > 0 ? 'right' : 'left';
            const px = i > 0 ? tx + colW[i] - 2 : tx + 2;
            doc.text(h, px, y + rowH / 2 + 1.5, { align });
            tx += colW[i];
        });
        y += rowH;

        // Linhas de itens
        itens.forEach((item, idx) => {
            const linhas = item.desc;
            const itemH = Math.max(rowH, linhas.length * 5 + 3);
            checkPage(itemH + 2);

            const bg = idx % 2 === 0 ? 248 : 255;
            doc.setFillColor(bg, bg, bg);
            tx = margin;
            colW.forEach(w => { doc.setDrawColor(...borderColor); doc.setLineWidth(0.2); doc.rect(tx, y, w, itemH, 'FD'); tx += w; });

            // Descrição (pode ter múltiplas linhas)
            linhas.forEach((linha, li) => {
                const isFirstLine = li === 0;
                doc.setFont('helvetica', isFirstLine && !item.info ? 'bold' : 'normal');
                doc.setFontSize(isFirstLine ? 8 : 7);
                if (isFirstLine) { doc.setTextColor(...textDark); } else { doc.setTextColor(...textMuted); }
                doc.text(linha, margin + 2, y + 5 + li * 5);
            });

            // Qtd
            if (!item.info) {
                doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...textDark);
                doc.text(String(item.qtd), margin + colW[0] + colW[1] - 2, y + itemH / 2 + 1.5, { align: 'right' });
                // Valor unit
                doc.text(item.unit != null ? Formatter.currency(item.unit) : '-',
                    margin + colW[0] + colW[1] + colW[2] - 2, y + itemH / 2 + 1.5, { align: 'right' });
                // Total
                doc.setFont('helvetica', 'bold');
                doc.text(item.total != null ? Formatter.currency(item.total) : '-',
                    margin + tableW - 2, y + itemH / 2 + 1.5, { align: 'right' });
            }
            y += itemH;
        });

        // ── TOTAIS ───────────────────────────────────────────────────
        y += 4;
        checkPage(30);

        const totaisX    = margin + colW[0] + colW[1];
        const totaisW    = colW[2] + colW[3];
        const totalLabel = qtdPax > 1 ? `TOTAL  (${qtdPax} passageiros)` : 'TOTAL';

        doc.setFillColor(230, 240, 255);
        doc.setDrawColor(...primaryLight); doc.setLineWidth(0.4);
        doc.rect(totaisX, y, totaisW, rowH + 2, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...primaryColor);
        doc.text(totalLabel, margin + 4, y + (rowH + 2) / 2 + 2);
        doc.text(Formatter.currency(valorTotal), margin + tableW - 2, y + (rowH + 2) / 2 + 2, { align: 'right' });
        y += rowH + 2 + 10;

        // ── PAGAMENTO ────────────────────────────────────────────────
        if (opcoes.formaPagamento) {
            checkPage(20);
            doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...primaryColor);
            doc.text('PAGAMENTO', margin, y); y += 7;

            doc.setFillColor(...greenBg);
            doc.setDrawColor(56, 161, 105); doc.setLineWidth(0.3);
            doc.roundedRect(margin, y - 3, contentWidth, 10, 2, 2, 'FD');
            doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...greenColor);
            doc.text(`Forma de Pagamento:  ${opcoes.formaPagamento}`, margin + 5, y + 4);
            if (opcoes.observacao) {
                doc.setFont('helvetica', 'italic');
                doc.text(`Obs: ${opcoes.observacao}`, pageWidth - margin - 5, y + 4, { align: 'right' });
            }
            y += 16;
        }

        // ── DECLARAÇÃO ───────────────────────────────────────────────
        checkPage(40);

        const declaracao =
            `Declaro que a ${CONFIG.empresa.nome}, CNPJ ${CONFIG.empresa.cnpj}, prestou serviços de agenciamento de viagens ` +
            `a ${nomeCliente}${docCliente ? ` (${cnpjCliente ? 'CNPJ' : 'CPF'}: ${docCliente})` : ''}, ` +
            `perfazendo o valor total de ${Formatter.currency(valorTotal)}, ` +
            `conforme reserva ${bilhete.codigoReserva || numeroInvoice}` +
            (opcoes.formaPagamento ? `, pago via ${opcoes.formaPagamento}` : '') + '.';

        const declLines = doc.splitTextToSize(declaracao, contentWidth - 10);
        const declH     = declLines.length * 5 + 12;

        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(...borderColor); doc.setLineWidth(0.3);
        doc.roundedRect(margin, y - 3, contentWidth, declH, 2, 2, 'FD');
        doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 80, 80);
        declLines.forEach((line, i) => { doc.text(line, margin + 5, y + 4 + i * 5); });
        y += declH + 12;

        // ── ASSINATURAS ──────────────────────────────────────────────
        checkPage(28);

        const sigW = (contentWidth - 20) / 2;
        doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.4);
        doc.line(margin, y, margin + sigW, y);
        doc.line(margin + sigW + 20, y, margin + contentWidth, y);

        y += 4;
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMuted);
        doc.text(CONFIG.empresa.nome, margin + sigW / 2, y, { align: 'center' });
        doc.text(nomeCliente, margin + sigW + 20 + sigW / 2, y, { align: 'center' });
        y += 4;
        doc.setFontSize(7.5);
        doc.text(`CNPJ: ${CONFIG.empresa.cnpj}`, margin + sigW / 2, y, { align: 'center' });
        doc.text('Cliente', margin + sigW + 20 + sigW / 2, y, { align: 'center' });

        // ── RODAPÉ em todas as páginas ────────────────────────────────
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            const footerY = pageHeight - 20;
            doc.setDrawColor(...primaryLight); doc.setLineWidth(0.5);
            doc.line(margin, footerY, pageWidth - margin, footerY);
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
            doc.text(CONFIG.empresa.nome, margin, footerY + 5);
            doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
            doc.text('CNPJ: ' + CONFIG.empresa.cnpj, pageWidth - margin, footerY + 5, { align: 'right' });
            doc.setFontSize(7);
            doc.text(
                CONFIG.empresa.email + '  |  ' + CONFIG.empresa.telefone + '  |  ' +
                CONFIG.empresa.telefone2 + '  |  ' + CONFIG.empresa.instagram,
                pageWidth / 2, footerY + 10, { align: 'center' }
            );
        }

        const nomeArq = `Invoice_${bilhete.codigoReserva || numeroInvoice}_GiraMundoTour.pdf`;
        doc.save(nomeArq);
        debugLog('ReportModule: Invoice PDF gerado', nomeArq);
    }
};

// Exportar para uso global
window.ReportModule = ReportModule;
