// GiraMundoTour - Módulo de Carimbo Digital em PDF

const CarimboModule = {
    _pdfDoc:    null,
    _pdfFile:   null,
    _totalPages: 0,
    _logoBase64: null,
    _processando: false,

    _config: {
        posicao:   'centro',   // centro | superior-esquerdo | superior-direito | inferior-esquerdo | inferior-direito
        tamanho:   30,         // % da largura da página
        opacidade: 40,         // 10–90 (%)
    },

    init() {
        // worker já configurado no index.html
    },

    render() {
        const section = document.getElementById('page-carimbo');
        if (!section) return;

        section.innerHTML = `
            <div class="d-flex align-items-center gap-2 mb-4">
                <i class="bi bi-stamp text-primary fs-4"></i>
                <h2 class="mb-0">Carimbo Digital em PDF</h2>
            </div>

            <div class="row g-4">
                <!-- Coluna esquerda: upload + controles -->
                <div class="col-lg-5">

                    <!-- Upload -->
                    <div class="card mb-3">
                        <div class="card-header"><i class="bi bi-upload me-2"></i>Documento PDF</div>
                        <div class="card-body">
                            <div id="dropZone" class="border border-2 border-dashed rounded p-4 text-center"
                                 style="cursor:pointer; transition:background .2s;"
                                 onclick="document.getElementById('pdfInput').click()"
                                 ondragover="event.preventDefault(); this.style.background='#e8f4f8';"
                                 ondragleave="this.style.background='';"
                                 ondrop="CarimboModule._onDrop(event)">
                                <i class="bi bi-file-earmark-pdf text-danger" style="font-size:2.5rem;"></i>
                                <div class="mt-2 fw-semibold">Arraste o PDF aqui</div>
                                <small class="text-muted">ou clique para selecionar</small>
                                <input type="file" id="pdfInput" accept="application/pdf" class="d-none"
                                       onchange="CarimboModule._onFileSelect(this.files[0])">
                            </div>
                            <div id="pdfInfo" class="mt-2 small text-muted d-none"></div>
                        </div>
                    </div>

                    <!-- Configurações do carimbo -->
                    <div class="card mb-3" id="configCard">
                        <div class="card-header"><i class="bi bi-gear me-2"></i>Configurações do Carimbo</div>
                        <div class="card-body">

                            <label class="form-label fw-semibold">Posição</label>
                            <div class="mb-3">
                                <div class="d-grid" style="grid-template-columns:1fr 1fr 1fr; gap:6px; display:grid;">
                                    <button class="btn btn-sm btn-outline-secondary" data-pos="superior-esquerdo"
                                            onclick="CarimboModule._setPosicao('superior-esquerdo')">↖ Sup. Esq.</button>
                                    <button class="btn btn-sm btn-outline-secondary" data-pos="superior-centro"
                                            onclick="CarimboModule._setPosicao('superior-centro')">↑ Sup. Centro</button>
                                    <button class="btn btn-sm btn-outline-secondary" data-pos="superior-direito"
                                            onclick="CarimboModule._setPosicao('superior-direito')">↗ Sup. Dir.</button>

                                    <button class="btn btn-sm btn-outline-secondary" data-pos="centro-esquerdo"
                                            onclick="CarimboModule._setPosicao('centro-esquerdo')">← Centro Esq.</button>
                                    <button class="btn btn-sm btn-primary active-pos" data-pos="centro"
                                            onclick="CarimboModule._setPosicao('centro')">✦ Centro</button>
                                    <button class="btn btn-sm btn-outline-secondary" data-pos="centro-direito"
                                            onclick="CarimboModule._setPosicao('centro-direito')">→ Centro Dir.</button>

                                    <button class="btn btn-sm btn-outline-secondary" data-pos="inferior-esquerdo"
                                            onclick="CarimboModule._setPosicao('inferior-esquerdo')">↙ Inf. Esq.</button>
                                    <button class="btn btn-sm btn-outline-secondary" data-pos="inferior-centro"
                                            onclick="CarimboModule._setPosicao('inferior-centro')">↓ Inf. Centro</button>
                                    <button class="btn btn-sm btn-outline-secondary" data-pos="inferior-direito"
                                            onclick="CarimboModule._setPosicao('inferior-direito')">↘ Inf. Dir.</button>
                                </div>
                            </div>

                            <label class="form-label fw-semibold">
                                Tamanho: <span id="lblTamanho">30</span>%
                            </label>
                            <input type="range" class="form-range mb-3" id="sliderTamanho"
                                   min="10" max="80" value="30" step="5"
                                   oninput="CarimboModule._setTamanho(this.value)">

                            <label class="form-label fw-semibold">
                                Opacidade: <span id="lblOpacidade">40</span>%
                            </label>
                            <input type="range" class="form-range" id="sliderOpacidade"
                                   min="10" max="90" value="40" step="5"
                                   oninput="CarimboModule._setOpacidade(this.value)">
                        </div>
                    </div>

                    <!-- Botão aplicar -->
                    <button class="btn btn-success btn-lg w-100" id="btnAplicar"
                            onclick="CarimboModule.aplicarCarimbo()" disabled>
                        <i class="bi bi-download me-2"></i>Aplicar Carimbo e Baixar PDF
                    </button>
                    <div id="progressoCarimbo" class="mt-2 d-none">
                        <div class="progress">
                            <div class="progress-bar progress-bar-striped progress-bar-animated"
                                 id="barProgresso" style="width:0%"></div>
                        </div>
                        <small class="text-muted" id="txtProgresso">Processando...</small>
                    </div>
                </div>

                <!-- Coluna direita: preview -->
                <div class="col-lg-7">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span><i class="bi bi-eye me-2"></i>Prévia</span>
                            <div id="navPages" class="d-none d-flex align-items-center gap-2">
                                <button class="btn btn-sm btn-outline-secondary"
                                        onclick="CarimboModule._prevPage()"><i class="bi bi-chevron-left"></i></button>
                                <small id="lblPage">Pág 1 / 1</small>
                                <button class="btn btn-sm btn-outline-secondary"
                                        onclick="CarimboModule._nextPage()"><i class="bi bi-chevron-right"></i></button>
                            </div>
                        </div>
                        <div class="card-body d-flex align-items-center justify-content-center"
                             style="background:#f0f0f0; min-height:500px;">
                            <div id="previewPlaceholder" class="text-center text-muted">
                                <i class="bi bi-file-earmark-pdf" style="font-size:4rem; opacity:.3;"></i>
                                <div class="mt-2">Selecione um PDF para visualizar</div>
                            </div>
                            <canvas id="previewCanvas" class="d-none shadow"
                                    style="max-width:100%; max-height:600px; border:1px solid #ddd;"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this._currentPage = 1;
    },

    // ── Eventos de arquivo ────────────────────────────────────────────

    _onDrop(e) {
        e.preventDefault();
        document.getElementById('dropZone').style.background = '';
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') this._onFileSelect(file);
        else App.showToast('Selecione um arquivo PDF', 'warning');
    },

    async _onFileSelect(file) {
        if (!file) return;
        if (file.type !== 'application/pdf') {
            App.showToast('Arquivo inválido. Selecione um PDF.', 'danger');
            return;
        }

        this._pdfFile   = file;
        this._pdfDoc    = null;
        this._currentPage = 1;

        const infoEl = document.getElementById('pdfInfo');
        infoEl.textContent = `📄 ${file.name}  (${(file.size / 1024).toFixed(0)} KB)`;
        infoEl.classList.remove('d-none');

        // Carregar logo (cache do ReportModule se já tiver)
        await this._carregarLogo();

        // Carregar PDF com pdf.js
        try {
            const buffer = await file.arrayBuffer();
            this._pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
            this._totalPages = this._pdfDoc.numPages;
            document.getElementById('btnAplicar').disabled = false;

            if (this._totalPages > 1) {
                document.getElementById('navPages').classList.remove('d-none');
            }

            await this._renderizarPreview();
        } catch (err) {
            App.showToast('Erro ao carregar PDF: ' + err.message, 'danger');
        }
    },

    // ── Controles de configuração ─────────────────────────────────────

    _setPosicao(pos) {
        this._config.posicao = pos;
        document.querySelectorAll('[data-pos]').forEach(btn => {
            btn.classList.toggle('btn-primary', btn.dataset.pos === pos);
            btn.classList.toggle('btn-outline-secondary', btn.dataset.pos !== pos);
        });
        this._renderizarPreview();
    },

    _setTamanho(val) {
        this._config.tamanho = parseInt(val);
        document.getElementById('lblTamanho').textContent = val;
        this._renderizarPreview();
    },

    _setOpacidade(val) {
        this._config.opacidade = parseInt(val);
        document.getElementById('lblOpacidade').textContent = val;
        this._renderizarPreview();
    },

    // ── Navegação de páginas na prévia ────────────────────────────────

    _prevPage() {
        if (this._currentPage > 1) {
            this._currentPage--;
            this._renderizarPreview();
        }
    },

    _nextPage() {
        if (this._currentPage < this._totalPages) {
            this._currentPage++;
            this._renderizarPreview();
        }
    },

    // ── Logo ─────────────────────────────────────────────────────────

    async _carregarLogo() {
        if (this._logoBase64) return;

        // Tenta reutilizar cache do ReportModule
        if (typeof ReportModule !== 'undefined' && ReportModule._logoBase64) {
            this._logoBase64 = ReportModule._logoBase64;
            return;
        }

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width  = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                this._logoBase64 = canvas.toDataURL('image/png');
                if (typeof ReportModule !== 'undefined') ReportModule._logoBase64 = this._logoBase64;
                resolve();
            };
            img.onerror = () => resolve();
            img.src = '/assets/images/logomarca.png';
        });
    },

    // ── Renderização da prévia ────────────────────────────────────────

    async _renderizarPreview() {
        if (!this._pdfDoc) return;

        const canvas  = document.getElementById('previewCanvas');
        const ctx     = canvas.getContext('2d');
        const pageNum = this._currentPage || 1;

        const page     = await this._pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        canvas.width  = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Aplica carimbo no canvas da prévia
        if (this._logoBase64) {
            this._desenharCarimbo(ctx, canvas.width, canvas.height);
        }

        // Exibe canvas, esconde placeholder
        document.getElementById('previewPlaceholder').classList.add('d-none');
        canvas.classList.remove('d-none');

        // Atualiza label de página
        const lbl = document.getElementById('lblPage');
        if (lbl) lbl.textContent = `Pág ${pageNum} / ${this._totalPages}`;
    },

    // ── Desenha o carimbo (logo) em um canvas já renderizado ─────────

    _desenharCarimbo(ctx, pageW, pageH) {
        const img = new Image();
        img.src = this._logoBase64;

        const logoW   = pageW * (this._config.tamanho / 100);
        const logoH   = logoW * (img.naturalHeight / (img.naturalWidth || 1));
        const margem  = pageW * 0.03;

        const { x, y } = this._calcPosicao(pageW, pageH, logoW, logoH, margem);

        ctx.save();
        ctx.globalAlpha = this._config.opacidade / 100;
        ctx.drawImage(img, x, y, logoW, logoH);
        ctx.restore();
    },

    _calcPosicao(pw, ph, lw, lh, m) {
        const centro  = { x: (pw - lw) / 2, y: (ph - lh) / 2 };
        const mapa = {
            'superior-esquerdo': { x: m,          y: m           },
            'superior-centro':   { x: (pw-lw)/2,  y: m           },
            'superior-direito':  { x: pw-lw-m,    y: m           },
            'centro-esquerdo':   { x: m,           y: (ph-lh)/2  },
            'centro':            centro,
            'centro-direito':    { x: pw-lw-m,    y: (ph-lh)/2  },
            'inferior-esquerdo': { x: m,           y: ph-lh-m    },
            'inferior-centro':   { x: (pw-lw)/2,  y: ph-lh-m    },
            'inferior-direito':  { x: pw-lw-m,    y: ph-lh-m    },
        };
        return mapa[this._config.posicao] || centro;
    },

    // ── Aplicar carimbo em todas as páginas e baixar ─────────────────

    async aplicarCarimbo() {
        if (!this._pdfDoc || !this._pdfFile || this._processando) return;
        if (!this._logoBase64) {
            App.showToast('Logo não carregada. Aguarde e tente novamente.', 'warning');
            return;
        }

        this._processando = true;
        const btnAplicar  = document.getElementById('btnAplicar');
        const progressDiv = document.getElementById('progressoCarimbo');
        const barEl       = document.getElementById('barProgresso');
        const txtEl       = document.getElementById('txtProgresso');

        btnAplicar.disabled = true;
        progressDiv.classList.remove('d-none');

        try {
            const { jsPDF } = window.jspdf;
            let doc = null;

            const logo = new Image();
            logo.src = this._logoBase64;
            await new Promise(r => { logo.onload = r; if (logo.complete) r(); });

            for (let i = 1; i <= this._totalPages; i++) {
                const pct = Math.round((i / this._totalPages) * 100);
                barEl.style.width = pct + '%';
                txtEl.textContent = `Processando página ${i} de ${this._totalPages}...`;

                const page     = await this._pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 2 });

                const canvas = document.createElement('canvas');
                canvas.width  = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');

                await page.render({ canvasContext: ctx, viewport }).promise;

                // Desenha carimbo
                const logoW  = canvas.width * (this._config.tamanho / 100);
                const logoH  = logoW * (logo.naturalHeight / (logo.naturalWidth || 1));
                const margem = canvas.width * 0.03;
                const { x, y } = this._calcPosicao(canvas.width, canvas.height, logoW, logoH, margem);

                ctx.save();
                ctx.globalAlpha = this._config.opacidade / 100;
                ctx.drawImage(logo, x, y, logoW, logoH);
                ctx.restore();

                // Dimensões em mm (96 dpi base)
                const mmW = (canvas.width  / 2) / 3.7795;
                const mmH = (canvas.height / 2) / 3.7795;

                if (i === 1) {
                    doc = new jsPDF({
                        orientation: mmW > mmH ? 'landscape' : 'portrait',
                        unit: 'mm',
                        format: [mmW, mmH]
                    });
                } else {
                    doc.addPage([mmW, mmH], mmW > mmH ? 'landscape' : 'portrait');
                }

                const imgData = canvas.toDataURL('image/jpeg', 0.92);
                doc.addImage(imgData, 'JPEG', 0, 0, mmW, mmH);
            }

            txtEl.textContent = 'Salvando...';

            const nomeOriginal = this._pdfFile.name.replace(/\.pdf$/i, '');
            doc.save(`${nomeOriginal}_carimbado.pdf`);

            App.showToast('PDF com carimbo baixado com sucesso!', 'success');
        } catch (err) {
            console.error('[Carimbo]', err);
            App.showToast('Erro ao processar PDF: ' + err.message, 'danger');
        } finally {
            this._processando = false;
            btnAplicar.disabled = false;
            setTimeout(() => progressDiv.classList.add('d-none'), 2000);
        }
    },
};

window.CarimboModule = CarimboModule;
