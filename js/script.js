const App = {
    // Estado de la aplicación
    state: {
        clients: [],
        projects: [],
        payments: [],
        logs: [],
        currentUser: null,
        currentAdminView: 'clients',
    },

    // Inicialización de la aplicación
    init() {
        // Cargar datos simulados desde localStorage o usar datos por defecto
        this.state.clients = JSON.parse(localStorage.getItem('clients')) || this.getMockClients();
        this.state.projects = JSON.parse(localStorage.getItem('projects')) || this.getMockProjects();
        this.state.payments = JSON.parse(localStorage.getItem('payments')) || this.getMockPayments();
        this.state.logs = JSON.parse(localStorage.getItem('logs')) || [];

        this.bindEvents();
        // Enrutamiento inicial basado en la URL
        this.Router.handleRouteChange();
        window.addEventListener('hashchange', () => this.Router.handleRouteChange());
    },

    bindEvents() {
        document.getElementById('login-form').addEventListener('submit', (e) => this.Auth.handleLogin(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.Auth.logout());
        document.getElementById('print-button').addEventListener('click', () => window.print());

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.Admin.setView(btn.dataset.view));
        });

        document.getElementById('add-client-btn').addEventListener('click', () => this.Admin.toggleClientForm());
        document.getElementById('cancel-client-form').addEventListener('click', () => this.Admin.toggleClientForm());
        document.getElementById('client-form').addEventListener('submit', (e) => this.Admin.saveClient(e));
    },

    // Módulo de autenticación
    Auth: {
        handleLogin(event) {
            event.preventDefault();
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            const errorEl = document.getElementById('login-error');

            // Simulación de credenciales de administrador
            if (email === 'admin@finreport.co' && password === 'password123') {
                const adminUser = { email, role: 'admin' };
                localStorage.setItem('currentUser', JSON.stringify(adminUser));
                App.state.currentUser = adminUser;
                App.Logger.log('Inicio de sesión exitoso del administrador.');
                window.location.hash = '#/admin';
            } else {
                errorEl.classList.remove('hidden');
            }
        },

        logout() {
            App.Logger.log('Cierre de sesión del administrador.');
            localStorage.removeItem('currentUser');
            App.state.currentUser = null;
            window.location.hash = '#/login';
        },

        checkSession() {
            const user = localStorage.getItem('currentUser');
            if (user) {
                App.state.currentUser = JSON.parse(user);
                return App.state.currentUser;
            }
            return null;
        }
    },

    // Módulo de administración
    Admin: {
        init() {
            document.getElementById('logout-btn').classList.remove('hidden');
            this.setView(App.state.currentAdminView);
            this.renderClientsTable();
            this.renderProjectsView();
            this.renderPaymentsView();
            this.renderLogs();
        },

        setView(view) {
            App.state.currentAdminView = view;
            // Ocultar todas las sub-vistas
            document.querySelectorAll('.admin-sub-view').forEach(el => el.classList.add('hidden'));
            // Mostrar la vista seleccionada
            document.getElementById(`admin-${view}`).classList.remove('hidden');

            // Actualizar estilo de pestañas
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.view === view) {
                    btn.classList.add('active');
                }
            });
        },

        // --- Gestión de Clientes (CRUD) ---
        renderClientsTable() {
            const tbody = document.getElementById('clients-table-body');
            tbody.innerHTML = App.state.clients.map(client => `
                <tr id="client-row-${client.id}">
                    <td class="px-6 py-4 whitespace-nowrap">${client.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${client.email}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="App.Admin.generateToken('${client.id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">Generar Link</button>
                        <button onclick="App.Admin.editClient('${client.id}')" class="text-blue-600 hover:text-blue-900 mr-3">Editar</button>
                        <button onclick="App.Admin.deleteClient('${client.id}')" class="text-red-600 hover:text-red-900">Eliminar</button>
                    </td>
                </tr>
            `).join('');
        },

        toggleClientForm(reset = true) {
            const form = document.getElementById('client-form');
            form.classList.toggle('hidden');
            if (reset) {
                form.reset();
                document.getElementById('client-id').value = '';
            }
        },

        saveClient(event) {
            event.preventDefault();
            const id = document.getElementById('client-id').value;
            const name = document.getElementById('client-name-input').value;
            const email = document.getElementById('client-email-input').value;

            if (id) { // Editar
                const client = App.state.clients.find(c => c.id === id);
                client.name = name;
                client.email = email;
                App.Logger.log(`Cliente '${name}' (ID: ${id}) actualizado.`);
            } else { // Crear
                const newClient = { id: `c${Date.now()}`, name, email };
                App.state.clients.push(newClient);
                App.Logger.log(`Nuevo cliente '${name}' creado.`);
            }

            localStorage.setItem('clients', JSON.stringify(App.state.clients));
            this.renderClientsTable();
            this.toggleClientForm();
        },

        editClient(id) {
            const client = App.state.clients.find(c => c.id === id);
            if (client) {
                document.getElementById('client-id').value = client.id;
                document.getElementById('client-name-input').value = client.name;
                document.getElementById('client-email-input').value = client.email;
                const form = document.getElementById('client-form');
                if (form.classList.contains('hidden')) {
                    this.toggleClientForm(false);
                }
            }
        },

        deleteClient(id) {
            const clientIndex = App.state.clients.findIndex(c => c.id === id);
            if (clientIndex > -1 && confirm('¿Está seguro de que desea eliminar este cliente?')) {
                const clientName = App.state.clients[clientIndex].name;
                App.state.clients.splice(clientIndex, 1);
                localStorage.setItem('clients', JSON.stringify(App.state.clients));
                this.renderClientsTable();
                App.Logger.log(`Cliente '${clientName}' (ID: ${id}) eliminado.`);
            }
        },

        generateToken(clientId) {
            const expiration = Date.now() + 24 * 60 * 60 * 1000; // 24 horas
            const tokenPayload = { clientId, exp: expiration };
            const token = btoa(JSON.stringify(tokenPayload)); // Simulación de JWT (codificación Base64)
            const url = `${window.location.origin}${window.location.pathname}#/report/${token}`;
            
            App.Logger.log(`Token generado para cliente con ID: ${clientId}.`);
            prompt("Enlace de reporte temporal (válido por 24h):", url);
        },

        // --- Vistas Simuladas ---
        renderProjectsView() {
            const container = document.getElementById('projects-list');
            const projects = App.state.projects;
            const clients = App.state.clients;

            const getClientName = (clientId) => {
                const client = clients.find(c => c.id === clientId);
                return client ? client.name : 'N/A';
            };

            container.innerHTML = `
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proyecto</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${projects.map(p => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap">${p.name}</td>
                                <td class="px-6 py-4 whitespace-nowrap">${getClientName(p.clientId)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-right">$${p.totalValue.toFixed(2)}</td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.status === 'Completado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                                        ${p.status}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        },

        renderPaymentsView() {
            const container = document.getElementById('payments-list');
            const payments = App.state.payments;
            const projects = App.state.projects;

            const getProjectName = (projectId) => {
                const project = projects.find(p => p.id === projectId);
                return project ? project.name : 'N/A';
            };

            container.innerHTML = `
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proyecto</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${payments.map(p => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap">${new Date(p.date).toLocaleDateString()}</td>
                                <td class="px-6 py-4 whitespace-nowrap">${getProjectName(p.projectId)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-right">$${p.amount.toFixed(2)}</td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.status === 'Completado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                        ${p.status}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        },

        // --- Logs ---
        renderLogs() {
            const list = document.getElementById('logs-list');
            list.innerHTML = App.state.logs.map(log => `<li><span class="text-gray-500">${log.timestamp}:</span> ${log.message}</li>`).join('');
        }
    },

    // Módulo de la vista del cliente
    Client: {
        async init(token) {
            document.getElementById('app-navbar').classList.add('hidden'); // Ocultar navbar en vista cliente
            try {
                const payload = JSON.parse(atob(token));
                if (payload.exp < Date.now()) {
                    throw new Error('Token expirado.');
                }

                const client = App.state.clients.find(c => c.id === payload.clientId);
                if (!client) {
                    throw new Error('Cliente no encontrado.');
                }
                
                App.Logger.log(`Acceso al reporte del cliente '${client.name}' (ID: ${client.id}).`);
                this.renderDashboard(client);

            } catch (error) {
                this.showError(error.message);
                App.Logger.log(`Intento de acceso fallido al reporte. Razón: ${error.message}`);
            }
        },

        renderDashboard(client) {
            // Obtener datos financieros del cliente
            const clientProjects = App.state.projects.filter(p => p.clientId === client.id);
            const clientPayments = App.state.payments.filter(p => clientProjects.some(cp => cp.id === p.projectId));

            let totalPaid = clientPayments.reduce((sum, p) => p.status === 'Completado' ? sum + p.amount : sum, 0);
            let totalBilled = clientProjects.reduce((sum, p) => sum + p.totalValue, 0);
            const totalPending = totalBilled - totalPaid;
            const activeProjects = clientProjects.filter(p => p.status === 'En Progreso').length;

            // Rellenar tarjetas de resumen
            document.getElementById('report-client-name').textContent = `Reporte para ${client.name}`;
            document.getElementById('report-total-paid').textContent = `$${totalPaid.toFixed(2)}`;
            document.getElementById('report-total-pending').textContent = `$${totalPending.toFixed(2)}`;
            document.getElementById('report-active-projects').textContent = activeProjects;

            // Rellenar tabla de proyectos
            const projectsBody = document.getElementById('report-projects-body');
            projectsBody.innerHTML = clientProjects.map(p => {
                const paymentsForProject = clientPayments.filter(pay => pay.projectId === p.id && pay.status === 'Completado').reduce((sum, pay) => sum + pay.amount, 0);
                const pendingOnProject = p.totalValue - paymentsForProject;
                return `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">${p.name}</td>
                        <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.status === 'Completado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${p.status}</span></td>
                        <td class="px-6 py-4 whitespace-nowrap text-right">$${p.totalValue.toFixed(2)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-right font-medium ${pendingOnProject > 0 ? 'text-red-600' : 'text-gray-700'}">$${pendingOnProject.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');

            // Rellenar tabla de pagos
            const paymentsBody = document.getElementById('report-payments-body');
            paymentsBody.innerHTML = clientPayments.map(p => {
                 const project = clientProjects.find(proj => proj.id === p.projectId);
                 return `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">${new Date(p.date).toLocaleDateString()}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-right">$${p.amount.toFixed(2)}</td>
                        <td class="px-6 py-4 whitespace-nowrap">${project ? project.name : 'N/A'}</td>
                        <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.status === 'Completado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${p.status}</span></td>
                    </tr>
                 `;
            }).join('');

            // Ocultar carga y mostrar dashboard
            document.getElementById('client-loading-screen').classList.add('hidden');
            document.getElementById('client-dashboard').classList.remove('hidden');
        },

        showError(message) {
            document.getElementById('client-loading-screen').classList.add('hidden');
            const errorScreen = document.getElementById('client-error-screen');
            const errorMessage = document.getElementById('client-error-message');
            if (message.includes('expirado')) {
                errorMessage.textContent = 'El enlace de reporte ha expirado (límite de 24 horas). Por favor, solicite un nuevo enlace temporal.';
            } else {
                errorMessage.textContent = 'El enlace de reporte es inválido o el cliente no existe. Por favor, verifique el enlace o solicite uno nuevo.';
            }
            errorScreen.classList.remove('hidden');
        }
    },

    // Módulo de enrutamiento simple
    Router: {
        handleRouteChange() {
            const hash = window.location.hash;
            const user = App.Auth.checkSession();

            // Ocultar todas las páginas
            document.querySelectorAll('.page-section').forEach(p => p.style.display = 'none');
            document.getElementById('app-navbar').classList.remove('hidden');
            document.getElementById('client-error-screen').classList.add('hidden');
            document.getElementById('client-dashboard').classList.add('hidden');
            document.getElementById('client-loading-screen').classList.remove('hidden');


            if (hash.startsWith('#/report/')) {
                const token = hash.split('/')[2];
                document.getElementById('client-page').style.display = 'block';
                App.Client.init(token);
            } else if (hash === '#/admin' && user && user.role === 'admin') {
                document.getElementById('admin-page').style.display = 'block';
                App.Admin.init();
            } else {
                // Por defecto, ir al login si no hay sesión, o al admin si la hay
                if (user && user.role === 'admin') {
                    window.location.hash = '#/admin';
                } else {
                    document.getElementById('login-page').style.display = 'block';
                    document.getElementById('logout-btn').classList.add('hidden');
                    document.getElementById('app-navbar').classList.add('hidden');
                }
            }
        }
    },

    // Módulo de logging
    Logger: {
        log(message) {
            const logEntry = {
                timestamp: new Date().toLocaleString(),
                message: message
            };
            App.state.logs.unshift(logEntry); // Añadir al principio
            if (App.state.logs.length > 100) { // Limitar a 100 entradas
                App.state.logs.pop();
            }
            localStorage.setItem('logs', JSON.stringify(App.state.logs));
            
            // Si la vista de admin está activa, actualizar los logs en tiempo real
            if (document.getElementById('admin-page').style.display === 'block') {
                App.Admin.renderLogs();
            }
        }
    },

    // --- Datos Simulados ---
    getMockClients() {
        return [
            { id: 'c1', name: 'Tech Solutions Inc.', email: 'contact@techsolutions.com' },
            { id: 'c2', name: 'Innovate Co.', email: 'hello@innovateco.com' },
            { id: 'c3', name: 'Marketing Masters', email: 'leads@marketingmasters.io' }
        ];
    },
    getMockProjects() {
        return [
            { id: 'p1', clientId: 'c1', name: 'Desarrollo de E-commerce', totalValue: 25000, status: 'Completado' },
            { id: 'p2', clientId: 'c1', name: 'App Móvil de Soporte', totalValue: 18000, status: 'En Progreso' },
            { id: 'p3', clientId: 'c2', name: 'Campaña de Branding Digital', totalValue: 12000, status: 'En Progreso' },
            { id: 'p4', clientId: 'c3', name: 'SEO y Content Marketing', totalValue: 7500, status: 'Completado' }
        ];
    },
    getMockPayments() {
        return [
            { id: 'pay1', projectId: 'p1', amount: 15000, date: '2025-08-10T10:00:00Z', status: 'Completado' },
            { id: 'pay2', projectId: 'p1', amount: 10000, date: '2025-09-15T14:30:00Z', status: 'Completado' },
            { id: 'pay3', projectId: 'p2', amount: 9000, date: '2025-10-01T11:00:00Z', status: 'Completado' },
            { id: 'pay4', projectId: 'p3', amount: 6000, date: '2025-09-20T09:00:00Z', status: 'Completado' },
            { id: 'pay5', projectId: 'p4', amount: 7500, date: '2025-07-30T16:00:00Z', status: 'Completado' }
        ];
    }
};

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.init());