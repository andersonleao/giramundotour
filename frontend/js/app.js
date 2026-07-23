// GiraMundoTour - Aplicação Principal

const App = {
    currentPage: 'busca',

    /**
     * Inicializa a aplicação
     */
    init() {
        debugLog('App: Inicializando GiraMundoTour...');

        // Inicializa módulos
        SearchModule.init();
        QuotationModule.init();
        ClientsModule.init();
        SuppliersModule.init();
        TicketsModule.init();
        ReservasModule.init();
        ImportacaoModule.init();
        HoteisModule.init();
        MonitoramentoModule.init();
        UsuariosModule.init();
        DashboardModule.init();
        DocumentosModule.init();
        ReportModule.init();

        // Aplica permissões de menu do usuário logado
        this.applySidebarPermissions();

        // Configura navegação
        this.setupNavigation();

        // Navega para página inicial (respeitando permissões)
        const firstAllowed = this.getFirstAllowedPage();
        this.navigate(firstAllowed);

        // Refresca usuário do backend (pega menusPermitidos atualizados)
        this.refreshUser();

        debugLog('App: Inicialização completa');
    },

    /**
     * Configura navegação SPA
     */
    setupNavigation() {
        // Links de navegação
        document.querySelectorAll('[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                this.navigate(page);
            });
        });

        // Navegação por hash na URL
        window.addEventListener('hashchange', () => {
            const page = window.location.hash.slice(1) || 'busca';
            if (page !== this.currentPage) {
                this.navigate(page, false);
            }
        });

        // Verifica hash inicial
        if (window.location.hash) {
            const page = window.location.hash.slice(1);
            this.navigate(page, false);
        }
    },

    /**
     * Navega para uma página
     * @param {string} page - Nome da página
     * @param {boolean} updateHash - Se deve atualizar a URL
     */
    navigate(page, updateHash = true) {
        debugLog('App: Navegando para', page);

        // Bloqueia navegação para página sem permissão
        if (page && !this.hasAccess(page)) {
            const fallback = this.getFirstAllowedPage();
            if (fallback !== page) {
                this.showToast('Você não tem acesso a este menu', 'warning');
                return this.navigate(fallback, updateHash);
            }
        }

        // Atualiza hash da URL
        if (updateHash) {
            window.location.hash = page;
        }

        // Esconde todas as páginas
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.remove('active');
        });

        // Mostra página atual
        const pageSection = document.getElementById(`page-${page}`);
        if (pageSection) {
            pageSection.classList.add('active');
        }

        // Atualiza navegação
        document.querySelectorAll('[data-page]').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        // Executa lógica específica da página
        this.currentPage = page;
        this.onPageLoad(page);
    },

    /**
     * Executado quando uma página é carregada
     * @param {string} page - Nome da página
     */
    onPageLoad(page) {
        switch (page) {
            case 'busca':
                // Reinicializa busca se necessário
                if (!document.getElementById('searchForm')) {
                    this.renderBuscaPage();
                }
                break;

            case 'cotacao':
                QuotationModule.render();
                break;

            case 'clientes':
                ClientsModule.render();
                break;

            case 'fornecedores':
                SuppliersModule.render();
                break;

            case 'bilhetes':
                TicketsModule.render();
                break;

            case 'faturas':
                FaturasModule.render();
                break;

            case 'reservas':
                ReservasModule.render();
                break;

            case 'importacao':
                ImportacaoModule.render();
                break;

            case 'hoteis':
                HoteisModule.render();
                break;

            case 'monitoramento':
                MonitoramentoModule.render();
                break;

            case 'usuarios':
                UsuariosModule.render();
                break;

            case 'dashboard':
                DashboardModule.render();
                break;

            case 'pacotes':
                PacotesModule.render();
                break;

            case 'carimbo':
                CarimboModule.render();
                break;

            case 'documentos':
                DocumentosModule.render();
                break;
        }
    },

    /**
     * Verifica se o usuário tem acesso a uma página
     */
    hasAccess(page) {
        const user = this.getUser();
        if (!user) return false;
        if (user.perfil === 'admin') return true;
        if (page === 'usuarios') return false; // só admin
        const menus = user.menusPermitidos;
        if (!Array.isArray(menus)) return true; // null/undefined = todos (retrocompat)
        return menus.includes(page);
    },

    /**
     * Esconde links/grupos da sidebar que o usuário não pode acessar
     */
    applySidebarPermissions() {
        const user = this.getUser();
        if (!user) return;

        // Links por data-page
        document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
            const page = link.dataset.page;
            if (!page) return;
            link.style.display = this.hasAccess(page) ? '' : 'none';
        });

        // Grupos data-admin-only (como Administração)
        document.querySelectorAll('[data-admin-only="true"]').forEach(el => {
            el.style.display = user.perfil === 'admin' ? '' : 'none';
        });

        // Esconde grupos em que todos os links estão ocultos
        document.querySelectorAll('.sidebar-group').forEach(group => {
            if (group.dataset.adminOnly === 'true') return;
            const visible = Array.from(group.querySelectorAll('.sidebar-link[data-page]'))
                .some(l => l.style.display !== 'none');
            group.style.display = visible ? '' : 'none';
        });
    },

    /**
     * Retorna a primeira página que o usuário pode acessar
     */
    getFirstAllowedPage() {
        const ordem = ['busca', 'dashboard', 'cotacao', 'pacotes', 'documentos', 'bilhetes', 'faturas', 'reservas', 'hoteis', 'monitoramento', 'clientes', 'fornecedores', 'usuarios'];
        for (const p of ordem) {
            if (this.hasAccess(p)) return p;
        }
        return 'busca';
    },

    /**
     * Renderiza página de busca (caso necessário)
     */
    renderBuscaPage() {
        // A página de busca já está no HTML
        // Este método existe para futuras extensões
    },

    /**
     * Mostra notificação toast
     * @param {string} message - Mensagem
     * @param {string} type - Tipo (success, error, warning, info)
     */
    showToast(message, type = 'info') {
        // Cria container de toasts se não existir
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            container.style.zIndex = '1100';
            document.body.appendChild(container);
        }

        // Cores por tipo
        const colors = {
            success: 'bg-success',
            error: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-info'
        };

        // Ícones por tipo
        const icons = {
            success: 'bi-check-circle',
            error: 'bi-exclamation-circle',
            warning: 'bi-exclamation-triangle',
            info: 'bi-info-circle'
        };

        // Cria toast
        const toastId = 'toast_' + Date.now();
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white ${colors[type]} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="bi ${icons[type]} me-2"></i>
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', toastHtml);

        // Mostra toast
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 4000 });
        toast.show();

        // Remove do DOM após fechar
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    },

    /**
     * Mostra modal de confirmação
     * @param {string} title - Título
     * @param {string} message - Mensagem
     * @param {Function} onConfirm - Callback de confirmação
     */
    showConfirm(title, message, onConfirm) {
        // Cria modal se não existir
        let modal = document.getElementById('confirmModal');
        if (!modal) {
            const modalHtml = `
                <div class="modal fade" id="confirmModal" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="confirmModalTitle"></h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body" id="confirmModalBody"></div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="button" class="btn btn-primary" id="confirmModalBtn">Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('confirmModal');
        }

        // Configura modal
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalBody').textContent = message;

        const confirmBtn = document.getElementById('confirmModalBtn');
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

        newBtn.addEventListener('click', () => {
            bootstrap.Modal.getInstance(modal).hide();
            if (onConfirm) onConfirm();
        });

        // Mostra modal
        new bootstrap.Modal(modal).show();
    },

    /**
     * Logout do sistema
     */
    logout() {
        this.showConfirm('Sair do Sistema', 'Deseja realmente sair?', () => {
            localStorage.removeItem('giramundo_token');
            localStorage.removeItem('giramundo_user');
            window.location.href = 'login.html';
        });
    },

    /**
     * Obtém usuário logado
     */
    getUser() {
        const user = localStorage.getItem('giramundo_user');
        return user ? JSON.parse(user) : null;
    },

    /**
     * Refresca usuário (menusPermitidos, etc) a partir do backend
     */
    async refreshUser() {
        try {
            const resp = await apiCall('/api/auth/me');
            if (!resp || !resp.ok) return;
            const json = await resp.json();
            const data = json.data || json;
            if (!data || !data.id) return;

            const current = this.getUser() || {};
            const updated = { ...current, ...data };
            localStorage.setItem('giramundo_user', JSON.stringify(updated));
            this.applySidebarPermissions();

            if (!this.hasAccess(this.currentPage)) {
                this.navigate(this.getFirstAllowedPage());
            }
        } catch (e) {
            // silencioso
        }
    },

    /**
     * Mostra modal de perfil
     */
    showPerfilModal() {
        const user = this.getUser();
        if (!user) return;

        const modalHtml = `
            <div class="modal fade" id="perfilModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-person"></i> Meu Perfil</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-4">
                                <div class="avatar-large mx-auto mb-3" style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center;">
                                    <i class="bi bi-person-fill text-white" style="font-size: 2.5rem;"></i>
                                </div>
                                <h4>${user.nome}</h4>
                                <p class="text-muted mb-0">${user.email}</p>
                                <span class="badge bg-primary">${user.perfil}</span>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('perfilModal')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        new bootstrap.Modal(document.getElementById('perfilModal')).show();
    },

    /**
     * Mostra modal de alteração de senha
     */
    showSenhaModal() {
        const modalHtml = `
            <div class="modal fade" id="senhaModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-key"></i> Alterar Senha</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="formSenha">
                                <div class="mb-3">
                                    <label class="form-label">Senha Atual</label>
                                    <input type="password" class="form-control" id="senhaAtual" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Nova Senha</label>
                                    <input type="password" class="form-control" id="novaSenha" required minlength="6">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Confirmar Nova Senha</label>
                                    <input type="password" class="form-control" id="confirmarSenha" required>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="App.alterarSenha()">Alterar Senha</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('senhaModal')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        new bootstrap.Modal(document.getElementById('senhaModal')).show();
    },

    /**
     * Altera a senha do usuário
     */
    async alterarSenha() {
        const senhaAtual = document.getElementById('senhaAtual').value;
        const novaSenha = document.getElementById('novaSenha').value;
        const confirmarSenha = document.getElementById('confirmarSenha').value;

        if (novaSenha !== confirmarSenha) {
            this.showToast('As senhas não conferem', 'error');
            return;
        }

        if (novaSenha.length < 6) {
            this.showToast('A senha deve ter no mínimo 6 caracteres', 'error');
            return;
        }

        try {
            const resp = await apiCall('/api/auth/password', {
                method: 'PUT',
                body: JSON.stringify({ senhaAtual, novaSenha })
            });
            if (!resp) return;

            const json = await resp.json();

            if (resp.ok && json.success) {
                bootstrap.Modal.getInstance(document.getElementById('senhaModal')).hide();
                this.showToast('Senha alterada com sucesso!', 'success');
            } else {
                this.showToast(json?.message || 'Erro ao alterar senha', 'error');
            }
        } catch (error) {
            this.showToast('Erro ao conectar com o servidor', 'error');
        }
    },

    /**
     * Mostra loading global
     * @param {boolean} show - Se deve mostrar
     */
    showLoading(show) {
        let overlay = document.getElementById('loadingOverlay');

        if (show && !overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                            background: rgba(0,0,0,0.5); display: flex; align-items: center;
                            justify-content: center; z-index: 9999;">
                    <div class="text-center text-white">
                        <div class="spinner-border spinner-border-lg mb-3" role="status"></div>
                        <div>Carregando...</div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        } else if (!show && overlay) {
            overlay.remove();
        }
    }
};

// Inicializa quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Exportar para uso global
window.App = App;
