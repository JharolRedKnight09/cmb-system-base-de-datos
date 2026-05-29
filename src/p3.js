// ==================== CLASE DE SESIÓN ====================
class Sesion {
    constructor() { this.usuario = null; this.rol = null; }
    iniciar(rol, datos) { this.rol = rol; this.usuario = datos; }
    cerrar() { this.usuario = null; this.rol = null; }
    get esAdmin() { return this.rol === 'admin'; }
    get esAlumno() { return this.rol === 'alumno'; }
    get esMaestro() { return this.rol === 'maestro'; }
}

// ==================== INTERFAZ DE USUARIO ====================
class UIColegio {
    constructor(colegio) {
        this.colegio = colegio;
        this.sesion = new Sesion();
        this.cicloActual = localStorage.getItem('cicloActual') || '2026';
        this._initDOM();
        this._initEventosGenerales();
        this.tareasFiltro = { grado: null, materia: null };
    }

    _initDOM() {
        this.loginScreen = document.getElementById('loginScreen');
        this.mainApp = document.getElementById('mainApp');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarNav = document.getElementById('sidebarNav');
        this.mainContent = document.getElementById('mainContent');
        this.toggleSidebarBtn = document.getElementById('toggleSidebar');
    }

    _initEventosGenerales() {
        this.toggleSidebarBtn.addEventListener('click', () => {
            this.sidebar.classList.toggle('collapsed');
            this.mainContent.classList.toggle('expanded');
        });
        document.getElementById('btnAdmin').addEventListener('click', () => this._mostrarFormulario('admin'));
        document.getElementById('btnAlumnoDocente').addEventListener('click', () => this._mostrarFormulario('alumnoDocente'));
        document.getElementById('btnVolverAdmin').addEventListener('click', () => this._volverInicio());
        document.getElementById('btnVolverGeneral').addEventListener('click', () => this._volverInicio());
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('loginFormAlumno').style.display = target === 'alumno' ? 'block' : 'none';
                document.getElementById('loginFormMaestro').style.display = target === 'docente' ? 'block' : 'none';
            });
        });
        document.getElementById('loginFormAdmin').addEventListener('submit', (e) => this._loginAdmin(e));
        document.getElementById('loginFormAlumno').addEventListener('submit', (e) => this._loginAlumno(e));
        document.getElementById('loginFormMaestro').addEventListener('submit', (e) => this._loginMaestro(e));
    }

    _mostrarFormulario(tipo) {
        document.getElementById('loginButtons').style.display = 'none';
        if (tipo === 'admin') {
            document.getElementById('loginFormAdmin').style.display = 'block';
        } else {
            document.getElementById('loginAlumnoDocente').style.display = 'block';
            document.getElementById('loginFormAlumno').style.display = 'block';
            document.getElementById('loginFormMaestro').style.display = 'none';
        }
    }

    _volverInicio() {
        document.getElementById('loginButtons').style.display = 'block';
        document.getElementById('loginFormAdmin').style.display = 'none';
        document.getElementById('loginAlumnoDocente').style.display = 'none';
    }

    _loginAdmin(e) {
        e.preventDefault();
        const u = document.getElementById('usuario').value.trim();
        const p = document.getElementById('password').value.trim();
        if (u === 'admin' && p === '1234') {
            this.sesion.iniciar('admin', 'admin');
            this._entrarSistema();
            this._cargarSidebar();
            this.navegarA('inscripcion');
        } else Swal.fire('Error', 'Credenciales incorrectas.', 'error');
    }

    _loginAlumno(e) {
        e.preventDefault();
        const alumno = this.colegio.getAlumnoPorCodigo(document.getElementById('codigoAlumno').value.trim());
        if (alumno) {
            this.sesion.iniciar('alumno', alumno);
            this._entrarSistema();
            this._cargarSidebar();
            this.navegarA('estudiantePagos');
        } else Swal.fire('Error', 'Código no encontrado.', 'error');
    }

    _loginMaestro(e) {
        e.preventDefault();
        const maestro = this.colegio.getMaestroPorCredenciales(
            document.getElementById('usuarioMaestro').value.trim(),
            document.getElementById('passwordMaestro').value.trim()
        );
        if (maestro) {
            this.sesion.iniciar('maestro', maestro);
            this._entrarSistema();
            this._cargarSidebar();
            this.navegarA('zonaCuadro');
        } else Swal.fire('Error', 'Credenciales incorrectas.', 'error');
    }

    _entrarSistema() {
        this.loginScreen.style.display = 'none';
        this.mainApp.style.display = 'flex';
    }

    cerrarSesion() {
        this.sesion.cerrar();
        this.mainApp.style.display = 'none';
        this.loginScreen.style.display = 'flex';
        this._volverInicio();
    }

    _cargarSidebar() {
        let items = [];
        if (this.sesion.rol === 'admin') {
            items = [
                { s: 'inscripcion', i: '📝', t: 'Inscripción' },
                { s: 'listado', i: '📋', t: 'Ver Listado' },
                { s: 'mensualidades', i: '💰', t: 'Mensualidades' },
                { s: 'pagosExtras', i: '➕', t: 'Pagos Adicionales' },
                { s: 'panelControl', i: '⚙️', t: 'Panel Control' },
                { s: 'gestionAlumnos', i: '👥', t: 'Gestión Alumnos' },
                { s: 'gestionMaestros', i: '👨‍🏫', t: 'Maestros' },
                { s: 'tareas', i: '📚', t: 'Tareas' },
                { s: 'zonaCuadro', i: '📊', t: 'Cuadros de Zona' },
                { s: 'verEvidencias', i: '📂', t: 'Evidencias Docentes' },
                { s: 'estadisticas', i: '📊', t: 'Estadísticas' },
                { s: 'notas', i: '🎓', t: 'Registro Notas' },
                { s: 'boleta', i: '📄', t: 'Boleta Individual' },
            ];
        } else if (this.sesion.rol === 'maestro') {
            items = [
                { s: 'listado', i: '📋', t: 'Ver Listado' },
                { s: 'tareas', i: '📚', t: 'Tareas' },
                { s: 'zonaCuadro', i: '📊', t: 'Cuadros de Zona' },
                { s: 'subirEvidencia', i: '📎', t: 'Subir Evidencia Zona' },
                { s: 'boleta', i: '📄', t: 'Boleta Individual' },
                { s: 'estadisticas', i: '📊', t: 'Estadísticas' },
            ];
        } else if (this.sesion.rol === 'alumno') {
            items = [
                { s: 'estudiantePagos', i: '💰', t: 'Mis Pagos' },
                { s: 'estudianteExtras', i: '➕', t: 'Pagos Extras' },
                { s: 'misNotas', i: '📄', t: 'Mis Notas' },
                { s: 'misTareas', i: '📚', t: 'Mis Tareas' },
                { s: 'pagoOnline', i: '💳', t: 'Pagar en Línea' },
                { s: 'estadisticasAlumno', i: '📊', t: 'Mi Rendimiento' }
            ];
        }
        let html = items.map(it => `<a href="#" data-section="${it.s}" class="nav-item"><span class="icon">${it.i}</span> <span>${it.t}</span></a>`).join('');
        const ciclos = ['2025', '2026', '2027', '2028', '2029','2030', '2031', '2032', '2033', '2034', '2035'];
        const selectorHTML = `
            <div style="padding: 15px; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 10px;">
                <label style="color: #bdc3c7; font-size: 0.8rem;">Ciclo Escolar:</label>
                <select id="selectorCiclo" style="width: 100%; padding: 5px; margin-top: 5px; background: #2c3e50; color: white; border: 1px solid #7f8c8d; border-radius: 4px;">
                    ${ciclos.map(c => `<option value="${c}" ${c === this.cicloActual ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </div>
        `;
        html += selectorHTML;
        html += `<a href="#" id="btnCerrarSesion" class="nav-item logout-item"><span class="icon">🚪</span> <span>Cerrar Sesión</span></a>`;
        this.sidebarNav.innerHTML = html;
        this.sidebarNav.querySelectorAll('.nav-item[data-section]').forEach(link => {
            link.addEventListener('click', (e) => { e.preventDefault(); this.navegarA(link.dataset.section); });
        });
        this.sidebarNav.querySelector('#btnCerrarSesion').addEventListener('click', () => this.cerrarSesion());
        const selectorCiclo = document.getElementById('selectorCiclo');
        if (selectorCiclo) {
            selectorCiclo.addEventListener('change', (e) => {
                localStorage.setItem('cicloActual', e.target.value);
                this.cicloActual = e.target.value;
                const seccionActiva = this.sidebarNav.querySelector('.nav-item.active')?.dataset.section;
                if (seccionActiva) this.navegarA(seccionActiva);
            });
        }
    }

    navegarA(seccion) {
        this.sidebarNav.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const active = this.sidebarNav.querySelector(`[data-section="${seccion}"]`);
        if (active) active.classList.add('active');
        switch (seccion) {
            case 'inscripcion': this._renderInscripcion(); break;
            case 'listado': this._renderListado(); break;
            case 'subirEvidencia': this._renderSubirEvidencia(); break;
            case 'verEvidencias': this._renderVerEvidenciasAdmin(); break;
            case 'mensualidades': this._renderMensualidades(); break;
            case 'pagosExtras': this._renderAdminExtras(); break;
            case 'panelControl': this._renderPanelControl(); break;
            case 'gestionAlumnos': this._renderGestionAlumnos(); break;
            case 'gestionMaestros': this._renderGestionMaestros(); break;
            case 'tareas': this._renderAdminTareas(); break;
            case 'zonaCuadro': this._renderZonaCuadro(); break;
            case 'estadisticas': this._renderEstadisticasGlobal(); break;
            case 'notas': this._renderNotas(); break;
            case 'boleta': this._renderBoletaLista(); break;
            case 'estudiantePagos': this._renderEstudiantePagos(); break;
            case 'estudianteExtras': this._renderEstudianteExtras(); break;
            case 'misNotas': this._renderEstudianteNotas(); break;
            case 'misTareas': this._renderEstudianteTareas(); break;
            case 'pagoOnline': this._renderPagoOnline(); break;
            case 'estadisticasAlumno': this._renderEstadisticasAlumno(); break;
            default: this._renderInscripcion();
        }
    }

    // ------------------------------------------------------------
    // INSCRIPCIÓN
    // ------------------------------------------------------------
    _renderInscripcion() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `
            <h2 class="section-title">📝 Nueva Inscripción</h2>
            <div class="card">
                <div class="form-grid">
                    <div class="form-group"><label>Código *</label><input type="text" id="insCode"></div>
                    <div class="form-group"><label>Nombres *</label><input type="text" id="insNombres"></div>
                    <div class="form-group"><label>Apellidos *</label><input type="text" id="insApellidos"></div>
                    <div class="form-group"><label>Fecha Nacimiento</label><input type="date" id="insFecha"></div>
                    <div class="form-group"><label>Grado *</label><select id="insGrado">${grados.map(g=>`<option>${g}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Teléfono</label><input type="text" id="insTel"></div>
                    <div class="form-group"><label>Correo</label><input type="email" id="insMail"></div>
                    <div class="form-group"><label>Ciclo Escolar *</label><select id="insCiclo"><option>${this.cicloActual}</option><option>2027</option><option>2028</option></select></div>
                    <div class="form-group"><label>Contraseña (default 1234)</label><input type="text" id="insPass" placeholder="1234"></div>
                </div>
                <button class="btn btn-success" id="btnRegistrar">✅ Registrar Alumno</button>
            </div>
        `;
        document.getElementById('btnRegistrar').onclick = () => {
            const codigo = document.getElementById('insCode').value.trim();
            const nombres = document.getElementById('insNombres').value.trim();
            const apellidos = document.getElementById('insApellidos').value.trim();
            const fecha = document.getElementById('insFecha').value;
            const grado = document.getElementById('insGrado').value;
            const ciclo = document.getElementById('insCiclo').value;
            const tel = document.getElementById('insTel').value.trim();
            const mail = document.getElementById('insMail').value.trim();
            const pass = document.getElementById('insPass').value.trim() || '1234';
            if (!codigo || !nombres || !apellidos) return Swal.fire('Error','Complete campos obligatorios','error');
            const alumno = this.colegio.agregarAlumno(codigo,nombres,apellidos,fecha,grado,ciclo,tel,mail,pass);
            if (alumno) Swal.fire('Registrado',`Clave: ${alumno.clave} | Contraseña: ${pass}`,'success');
            else Swal.fire('Error','Código ya existe','error');
        };
    }

    // ------------------------------------------------------------
    // LISTADO
    // ------------------------------------------------------------

    _renderListado() {
        const grados = ['Primero', 'Segundo', 'Tercero', 'Cuarto Bachillerato', 'Quinto Bachillerato', 'Bachillerato por Madurez'];
        
        const formatearFecha = (fecha) => {
            if (!fecha) return '---';
            const partes = fecha.split('-');
            return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
        };

        this.mainContent.innerHTML = `
            <h2 class="section-title">📋 Listado de Alumnos (Ciclo ${this.cicloActual})</h2>
            <div class="toolbar">
                <select id="listGrado">${grados.map(g => `<option>${g}</option>`).join('')}</select>
                <input type="text" id="listBusqueda" placeholder="Buscar por nombre o clave...">
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Clave</th>
                            <th>Alumno</th>
                            <th>Fecha Nac.</th>
                            <th>Teléfono</th>
                            <th>Correo</th>
                            <th>Ciclo</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tbodyListado"></tbody>
                </table>
            </div>
            <p id="listSinResultados" style="display:none; text-align:center; padding:20px;">No se encontraron alumnos.</p>
        `;

        const selectGrado = document.getElementById('listGrado');
        const inputBusqueda = document.getElementById('listBusqueda');

        const actualizar = () => {
            let alumnos = this.colegio.getAlumnosFiltrados(selectGrado.value, this.cicloActual);
            const texto = inputBusqueda.value.toLowerCase();

            if (texto) {
                alumnos = alumnos.filter(a => 
                    a.nombres.toLowerCase().includes(texto) || 
                    a.apellidos.toLowerCase().includes(texto) || 
                    String(a.clave).includes(texto)
                );
            }

            const tbody = document.getElementById('tbodyListado');
            
            if (alumnos.length) {
                tbody.innerHTML = alumnos.map(a => `
                    <tr>
                        <td style="text-align:center;"><b>${a.clave}</b></td>
                        <td>${a.nombreCompleto}</td>
                        <td style="text-align:center;">${formatearFecha(a.fechaNacimiento)}</td>
                        <td>${a.telefono || '---'}</td>
                        <td>${a.correo || '---'}</td>
                        <td style="text-align:center;">${a.cicloEscolar}</td>
                        <td style="text-align:center;">
                            <span class="badge ${a.estado === 'Activo' ? 'badge-activo' : 'badge-suspendido'}">
                                ${a.estado}
                            </span>
                        </td>
                        <td style="text-align:center;">
                            <button class="btn btn-edit" onclick="app.editarAlumno('${a.codigo}')">✏️</button>
                        </td>
                    </tr>
                `).join('');
                document.getElementById('listSinResultados').style.display = 'none';
            } else {
                tbody.innerHTML = '';
                document.getElementById('listSinResultados').style.display = 'block';
            }
        };

        selectGrado.addEventListener('change', actualizar);
        inputBusqueda.addEventListener('input', actualizar);
        actualizar();
        document.getElementById('listGrado').onchange = actualizar;
        document.getElementById('listBusqueda').oninput = actualizar;
        actualizar();
    }
