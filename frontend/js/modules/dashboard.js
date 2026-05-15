// GiraMundoTour - Módulo de Dashboard

const DashboardModule = {
    chart: null,
    _cotacoes: [],

    /**
     * Inicializa o módulo de dashboard
     */
    init() {
        debugLog('DashboardModule: Inicializado');
    },

    /**
     * Busca cotações da API
     */
    async _fetchCotacoes() {
        try {
            const resp = await apiCall('/api/cotacoes?limit=500&page=1');
            if (!resp) { this._cotacoes = []; return; }
            const data = await resp.json();
            this._cotacoes = (data && data.data) ? data.data : [];
        } catch (e) {
            console.warn('[DashboardModule] Erro ao buscar cotações:', e.message);
            this._cotacoes = [];
        }
    },

    /**
     * Renderiza a página de dashboard
     */
    async render() {
        const container = document.getElementById('dashboardContent');
        if (!container) return;

        await this._fetchCotacoes();

        const cotacoes = this._cotacoes;
        const totalCotacoes     = cotacoes.length;
        const cotacoesPendentes = cotacoes.filter(c => c.status === 'pendente').length;
        const valorTotal        = cotacoes.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
        const valorMedio        = totalCotacoes > 0 ? valorTotal / totalCotacoes : 0;

        const destinosCount = {};
        cotacoes.forEach(c => {
            const voos = Array.isArray(c.voos) ? c.voos : (typeof c.voos === 'string' ? JSON.parse(c.voos || '[]') : []);
            if (voos.length > 0) {
                const destino = voos[0].destino || voos[0].destination;
                if (destino) destinosCount[destino] = (destinosCount[destino] || 0) + 1;
            }
        });
        const topDestinos = Object.entries(destinosCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([codigo, count]) => ({ codigo, count }));

        const totalClientes = Storage.getClientes().length;

        const stats = { totalClientes, totalCotacoes, cotacoesPendentes, valorMedio, topDestinos };

        container.innerHTML = `
            <!-- Cards de Estatísticas -->
            <div class="row g-4 mb-4">
                <div class="col-md-3">
                    <div class="stat-card position-relative">
                        <i class="bi bi-people stat-icon"></i>
                        <div class="stat-value">${stats.totalClientes}</div>
                        <div class="stat-label">Clientes Cadastrados</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card info position-relative">
                        <i class="bi bi-file-earmark-text stat-icon"></i>
                        <div class="stat-value">${stats.totalCotacoes}</div>
                        <div class="stat-label">Total de Cotações</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card warning position-relative">
                        <i class="bi bi-hourglass-split stat-icon"></i>
                        <div class="stat-value">${stats.cotacoesPendentes}</div>
                        <div class="stat-label">Cotações Pendentes</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card success position-relative">
                        <i class="bi bi-currency-dollar stat-icon"></i>
                        <div class="stat-value">${this.formatarValorCompacto(stats.valorMedio)}</div>
                        <div class="stat-label">Ticket Médio</div>
                    </div>
                </div>
            </div>

            <div class="row g-4">
                <!-- Cotações Recentes -->
                <div class="col-lg-8">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span><i class="bi bi-clock-history"></i> Cotações Recentes</span>
                            <button class="btn btn-sm btn-outline-primary" onclick="App.navigate('clientes')">
                                Ver Todas
                            </button>
                        </div>
                        <div class="card-body p-0">
                            ${this.renderCotacoesRecentes()}
                        </div>
                    </div>
                </div>

                <!-- Destinos Mais Buscados -->
                <div class="col-lg-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <i class="bi bi-geo-alt"></i> Top Destinos
                        </div>
                        <div class="card-body">
                            ${this.renderTopDestinos(stats.topDestinos)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Gráfico e Ações Rápidas -->
            <div class="row g-4 mt-2">
                <div class="col-lg-8">
                    <div class="card">
                        <div class="card-header">
                            <i class="bi bi-bar-chart"></i> Cotações por Mês
                        </div>
                        <div class="card-body">
                            <canvas id="chartCotacoes" height="250"></canvas>
                        </div>
                    </div>
                </div>

                <div class="col-lg-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <i class="bi bi-lightning"></i> Ações Rápidas
                        </div>
                        <div class="card-body">
                            <div class="d-grid gap-3">
                                <button class="btn btn-primary btn-lg" onclick="App.navigate('busca')">
                                    <i class="bi bi-search me-2"></i> Nova Busca
                                </button>
                                <button class="btn btn-outline-primary" onclick="ClientsModule.abrirModalNovoCliente(); App.navigate('clientes')">
                                    <i class="bi bi-person-plus me-2"></i> Cadastrar Cliente
                                </button>
                                <button class="btn btn-outline-secondary" onclick="DashboardModule.exportarRelatorio()">
                                    <i class="bi bi-file-pdf me-2"></i> Gerar Relatório
                                </button>
                            </div>

                            <hr>

                            <div class="text-center">
                                <small class="text-muted d-block mb-2">Resumo do Mês</small>
                                <h4 class="text-primary mb-0">${Formatter.currency(this.calcularTotalMes())}</h4>
                                <small class="text-muted">em cotações</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Inicializa gráfico
        this.renderChart();
    },

    /**
     * Renderiza cotações recentes
     */
    renderCotacoesRecentes() {
        const cotacoes = (this._cotacoes || [])
            .slice()
            .sort((a, b) => new Date(b.createdAt || b.dataCriacao) - new Date(a.createdAt || a.dataCriacao))
            .slice(0, 5);

        if (cotacoes.length === 0) {
            return `
                <div class="text-center py-5">
                    <i class="bi bi-inbox fs-1 text-muted"></i>
                    <p class="text-muted mt-2">Nenhuma cotação ainda</p>
                    <button class="btn btn-primary btn-sm" onclick="App.navigate('busca')">
                        Criar Primeira Cotação
                    </button>
                </div>
            `;
        }

        return `
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Rota</th>
                            <th>Data</th>
                            <th>Valor</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cotacoes.map(cot => {
                            const clienteNome = cot.cliente?.nome || 'N/A';
                            const clienteInicial = clienteNome.charAt(0).toUpperCase();
                            const status = Formatter.quotationStatus(cot.status);
                            const voos = Array.isArray(cot.voos) ? cot.voos : (typeof cot.voos === 'string' ? JSON.parse(cot.voos || '[]') : []);
                            const rota = voos.length > 0
                                ? `${voos[0].origem || voos[0].origin || ''} → ${voos[0].destino || voos[0].destination || ''}`
                                : '-';

                            return `
                                <tr>
                                    <td>
                                        <div class="d-flex align-items-center">
                                            <div class="avatar-circle me-2" style="background-color: var(--primary); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                                                ${clienteInicial}
                                            </div>
                                            <span>${clienteNome}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <i class="bi bi-airplane me-1 text-primary"></i>
                                        ${rota}
                                    </td>
                                    <td>${Formatter.date(cot.createdAt || cot.dataCriacao)}</td>
                                    <td class="fw-bold">${Formatter.currency(cot.total)}</td>
                                    <td><span class="badge ${status.class}">${status.text}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Renderiza top destinos
     */
    renderTopDestinos(destinos) {
        if (!destinos || destinos.length === 0) {
            return `
                <div class="text-center py-4">
                    <i class="bi bi-map fs-1 text-muted"></i>
                    <p class="text-muted mt-2">Nenhum destino registrado</p>
                </div>
            `;
        }

        const maxCount = destinos[0]?.count || 1;

        return destinos.map((dest, index) => {
            const airport = getAirportByCode(dest.codigo);
            const percentage = (dest.count / maxCount) * 100;
            const colors = ['primary', 'info', 'success', 'warning', 'secondary'];

            return `
                <div class="mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div>
                            <span class="badge bg-light text-dark me-2">${index + 1}º</span>
                            <strong>${dest.codigo}</strong>
                            <small class="text-muted ms-1">${airport?.city || ''}</small>
                        </div>
                        <span class="badge bg-${colors[index]}">${dest.count}</span>
                    </div>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar bg-${colors[index]}" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Renderiza gráfico de cotações
     */
    renderChart() {
        const canvas = document.getElementById('chartCotacoes');
        if (!canvas) return;

        // Verifica se Chart.js está disponível
        if (typeof Chart === 'undefined') {
            canvas.parentElement.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-bar-chart fs-1"></i>
                    <p class="mt-2">Gráfico não disponível</p>
                </div>
            `;
            return;
        }

        // Dados dos últimos 6 meses
        const dados = this.getDadosMensais();

        // Destrói gráfico anterior se existir
        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: dados.labels,
                datasets: [
                    {
                        label: 'Cotações',
                        data: dados.cotacoes,
                        backgroundColor: 'rgba(66, 153, 225, 0.8)',
                        borderColor: 'rgba(66, 153, 225, 1)',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Valor (R$)',
                        data: dados.valores,
                        type: 'line',
                        borderColor: 'rgba(72, 187, 120, 1)',
                        backgroundColor: 'rgba(72, 187, 120, 0.2)',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.yAxisID === 'y1') {
                                    return `Valor: ${Formatter.currency(context.raw)}`;
                                }
                                return `Cotações: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false,
                        },
                        ticks: {
                            callback: function(value) {
                                return Formatter.currency(value);
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Obtém dados mensais para o gráfico
     */
    getDadosMensais() {
        const cotacoes = this._cotacoes || [];
        const meses = [];
        const labels = [];
        const cotacoesCount = [];
        const valores = [];

        // Últimos 6 meses
        for (let i = 5; i >= 0; i--) {
            const data = new Date();
            data.setMonth(data.getMonth() - i);

            const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            meses.push(mesAno);

            const nomeMes = data.toLocaleDateString('pt-BR', { month: 'short' });
            labels.push(nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1));
        }

        meses.forEach(mes => {
            const cotacoesMes = cotacoes.filter(c => {
                const dataCot = new Date(c.createdAt || c.dataCriacao);
                const mesAnoCot = `${dataCot.getFullYear()}-${String(dataCot.getMonth() + 1).padStart(2, '0')}`;
                return mesAnoCot === mes;
            });

            cotacoesCount.push(cotacoesMes.length);
            valores.push(cotacoesMes.reduce((sum, c) => sum + c.total, 0));
        });

        return { labels, cotacoes: cotacoesCount, valores };
    },

    /**
     * Calcula total do mês atual
     */
    calcularTotalMes() {
        const cotacoes = this._cotacoes || [];
        const agora = new Date();
        const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

        return cotacoes
            .filter(c => {
                const dataCot = new Date(c.createdAt || c.dataCriacao);
                const mesAnoCot = `${dataCot.getFullYear()}-${String(dataCot.getMonth() + 1).padStart(2, '0')}`;
                return mesAnoCot === mesAtual;
            })
            .reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
    },

    /**
     * Formata valor de forma compacta
     */
    formatarValorCompacto(valor) {
        if (valor >= 1000) {
            return `R$ ${(valor / 1000).toFixed(1)}k`;
        }
        return Formatter.currency(valor);
    },

    /**
     * Exporta relatório de cotações
     */
    exportarRelatorio() {
        const dataFim = new Date();
        const dataInicio = new Date();
        dataInicio.setMonth(dataInicio.getMonth() - 1);

        ReportModule.gerarRelatorioCotacoes(dataInicio, dataFim);
    }
};

// Exportar para uso global
window.DashboardModule = DashboardModule;
