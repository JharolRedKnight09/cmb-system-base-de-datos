import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// ==================== CLASES DE MODELO ====================

class Alumno {
    constructor(id, codigo, nombres, apellidos, fechaNacimiento, grado, cicloEscolar, telefono, correo) {
        this.id = id;
        this.codigo = codigo;
        this.nombres = nombres;
        this.apellidos = apellidos;
        this.fechaNacimiento = fechaNacimiento || '';
        this.grado = grado;
        this.cicloEscolar = cicloEscolar;
        this.telefono = telefono || '';
        this.correo = correo || '';
        this.estado = 'Activo';
        this.clave = 0;
        this.pagos = new Array(10).fill(false);
        this.extrasPagados = {};
        this.password = '1234';
    }
    get nombreCompleto() { return `${this.apellidos.toUpperCase()}, ${this.nombres}`; }
}

class Maestro {
    constructor(id, usuario, password, nombre, apellidos) {
        this.id = id;
        this.usuario = usuario;
        this.password = password;
        this.nombre = nombre;
        this.apellidos = apellidos;
        this.asignaciones = {};
    }
    get nombreCompleto() { return `${this.apellidos.toUpperCase()}, ${this.nombre}`; }
    tienePermiso(grado, materia) {
        return this.asignaciones[grado] && this.asignaciones[grado].includes(materia);
    }
}

class Tarea {
    constructor(id, titulo, descripcion, materia, grado, cicloEscolar, bimestre, fechaEntrega, creadoPor, puntajeMaximo = 10) {
        this.id = id;
        this.titulo = titulo;
        this.descripcion = descripcion;
        this.materia = materia;
        this.grado = grado;
        this.cicloEscolar = cicloEscolar;
        this.bimestre = bimestre;
        this.fechaEntrega = fechaEntrega;
        this.creadoPor = creadoPor;
        this.fechaCreacion = new Date().toISOString();
        this.puntajeMaximo = puntajeMaximo;
    }
}

class Entrega {
    constructor(id, tareaId, alumnoId, archivoNombre, archivoData, calificacion, comentario) {
        this.id = id;
        this.tareaId = tareaId;
        this.alumnoId = alumnoId;
        this.archivoNombre = archivoNombre;
        this.archivoData = archivoData;
        this.calificacion = calificacion || null;
        this.comentario = comentario || '';
        this.fechaEntrega = new Date().toISOString();
    }
}

class PagoOnline {
    constructor(correlativo, alumnoId, alumnoNombre, cicloEscolar, mesIndex, monto, fecha) {
        this.correlativo = correlativo;
        this.alumnoId = alumnoId;
        this.alumnoNombre = alumnoNombre;
        this.cicloEscolar = cicloEscolar;
        this.mesIndex = mesIndex;
        this.monto = monto;
        this.fecha = fecha;
    }
}

// ==================== GESTOR DE ALMACENAMIENTO ====================
class StorageManager {
    static async syncFromFirebase() {
        try {
            const docRef = doc(db, 'colegio', 'global_state');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                for (const key of Object.keys(data)) {
                    localStorage.setItem(key, data[key]);
                }
            }
        } catch (e) {
             console.error("Error loading from Firebase:", e);
        }
    }

    static async syncToFirebase(clave, datosJsonString) {
        try {
            const docRef = doc(db, 'colegio', 'global_state');
            await setDoc(docRef, { [clave]: datosJsonString }, { merge: true });
        } catch(e) {
             console.error("Error saving to Firebase:", e);
        }
    }

    static cargar(clave, defecto = []) {
        const datos = localStorage.getItem(clave);
        return datos ? JSON.parse(datos) : defecto;
    }
    static guardar(clave, datos) {
        const json = JSON.stringify(datos);
        localStorage.setItem(clave, json);
        this.syncToFirebase(clave, json);
    }
}

// ==================== GESTOR DE NOTAS ====================
class NotasManager {
    constructor() {
        this.data = StorageManager.cargar('colegio_notas', {});
        this.materias = StorageManager.cargar('colegio_materias', ['Matemática', 'Comunicación', 'Ciencias', 'Sociales']);
    }
    guardar() {
        StorageManager.guardar('colegio_notas', this.data);
        StorageManager.guardar('colegio_materias', this.materias);
    }
    setNota(idAlumno, bimestre, materia, valor) {
        this.data[`${idAlumno}_${bimestre}_${materia}`] = valor;
        this.guardar();
    }
    getNota(idAlumno, bimestre, materia) {
        const key = `${idAlumno}_${bimestre}_${materia}`;
        return this.data[key] !== undefined ? this.data[key] : 0;
    }
    getPromedioBimestre(idAlumno, bimestre) {
        let suma = 0, count = 0;
        this.materias.forEach(mat => {
            const v = this.getNota(idAlumno, bimestre, mat);
            if (v > 0) { suma += v; count++; }
        });
        return count > 0 ? +(suma / count).toFixed(2) : 0;
    }
    agregarMateria(nombre) {
        if (nombre && !this.materias.includes(nombre)) {
            this.materias.push(nombre);
            this.guardar();
            return true;
        }
        return false;
    }
    eliminarUltimaMateria() {
        if (this.materias.length > 1) {
            this.materias.pop();
            this.guardar();
            return true;
        }
        return false;
    }
}


// ==================== CLASE PRINCIPAL DEL COLEGIO ====================
class Colegio {
    constructor() {
        this.alumnos = this._cargarAlumnos();
        this.maestros = this._cargarMaestros();
        this.contadorAlumnos = StorageManager.cargar('colegio_contadorAlumnos', 1);
        this.contadorMaestros = StorageManager.cargar('colegio_contadorMaestros', 1);
        this.tareas = StorageManager.cargar('colegio_tareas', []);
        this.entregas = StorageManager.cargar('colegio_entregas', []);
        this.examenesBimestrales = StorageManager.cargar('colegio_examenes_bimestrales', {});
        this.pagosOnline = StorageManager.cargar('colegio_pagosOnline', []);
        this.correlativoCounter = StorageManager.cargar('correlativo_counter', 1000);
        this.config = StorageManager.cargar('colegio_config', {
            cuotaMensual: 200,
            extrasItems: []
        });
        this.notas = new NotasManager();
        this.evidenciasDocente = StorageManager.cargar('colegio_evidencias_docente', []);
        this._inicializarExtrasEnAlumnos();
        this._syncContadores();
    }
    _cargarAlumnos() {
        const raw = StorageManager.cargar('colegio_alumnos', []);
        return raw.map(a => {
            const alumno = new Alumno(a.id, a.codigo, a.nombres, a.apellidos,
                a.fechaNacimiento, a.grado, a.cicloEscolar, a.telefono, a.correo);
            alumno.estado = a.estado;
            alumno.clave = a.clave;
            alumno.pagos = a.pagos || new Array(10).fill(false);
            alumno.extrasPagados = a.extrasPagados || {};
            alumno.password = a.password || '1234';
            return alumno;
        });
    }
    guardarAlumnos() { StorageManager.guardar('colegio_alumnos', this.alumnos); }

    _cargarMaestros() {
        const raw = StorageManager.cargar('colegio_maestros', []);
        return raw.map(m => {
            const maestro = new Maestro(m.id, m.usuario, m.password, m.nombre, m.apellidos);
            maestro.asignaciones = m.asignaciones || {};
            return maestro;
        });
    }
    guardarMaestros() { StorageManager.guardar('colegio_maestros', this.maestros); }

    _syncContadores() {
        const maxIdAlumno = this.alumnos.length > 0 ? Math.max(...this.alumnos.map(a => a.id)) : 0;
        if (this.contadorAlumnos <= maxIdAlumno) {
            this.contadorAlumnos = maxIdAlumno + 1;
            StorageManager.guardar('colegio_contadorAlumnos', this.contadorAlumnos);
        }
        const maxIdMaestro = this.maestros.length > 0 ? Math.max(...this.maestros.map(m => m.id)) : 0;
        if (this.contadorMaestros <= maxIdMaestro) {
            this.contadorMaestros = maxIdMaestro + 1;
            StorageManager.guardar('colegio_contadorMaestros', this.contadorMaestros);
        }
    }

    _inicializarExtrasEnAlumnos() {
        const items = this.config.extrasItems;
        let cambios = false;
        this.alumnos.forEach(a => {
            items.forEach(item => {
                if (!(item.nombre in a.extrasPagados)) {
                    a.extrasPagados[item.nombre] = 0;
                    cambios = true;
                }
            });
        });
        if (cambios) this.guardarAlumnos();
    }

    siguienteIdAlumno() {
        const id = this.contadorAlumnos;
        this.contadorAlumnos++;
        StorageManager.guardar('colegio_contadorAlumnos', this.contadorAlumnos);
        return id;
    }
    siguienteIdMaestro() {
        const id = this.contadorMaestros;
        this.contadorMaestros++;
        StorageManager.guardar('colegio_contadorMaestros', this.contadorMaestros);
        return id;
    }

    getAlumnosFiltrados(grado, ciclo) {
        return this.alumnos.filter(a => a.grado === grado && a.cicloEscolar === ciclo)
            .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es', { sensitivity: 'base' }));
    }

    agregarAlumno(codigo, nombres, apellidos, fecha, grado, ciclo, telefono, correo, password = '1234') {
        if (this.alumnos.some(a => a.codigo === codigo)) return null;
        const id = this.siguienteIdAlumno();
        const alumno = new Alumno(id, codigo, nombres, apellidos, fecha, grado, ciclo, telefono, correo);
        alumno.password = password;
        this.config.extrasItems.forEach(item => alumno.extrasPagados[item.nombre] = 0);
        this.alumnos.push(alumno);
        this._recalcularClaves(grado, ciclo);
        this.guardarAlumnos();
        return alumno;
    }

    _recalcularClaves(grado, ciclo) {
        const grupo = this.alumnos.filter(a => a.grado === grado && a.cicloEscolar === ciclo);
        grupo.sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es', { sensitivity: 'base' }));
        grupo.forEach((a, idx) => a.clave = idx + 1);
    }

    actualizarPasswordAlumno(id, nuevaPass) {
        const alumno = this.getAlumnoPorId(id);
        if (alumno && nuevaPass) {
            alumno.password = nuevaPass;
            this.guardarAlumnos();
            return true;
        }
        return false;
    }

    eliminarAlumno(id) {
        const alumno = this.alumnos.find(a => a.id === id);
        if (!alumno) return false;
        const grado = alumno.grado, ciclo = alumno.cicloEscolar;
        this.alumnos = this.alumnos.filter(a => a.id !== id);
        this._recalcularClaves(grado, ciclo);
        this._syncContadores();
        this.guardarAlumnos();
        return true;
    }

    suspenderAlternar(id) {
        const alumno = this.alumnos.find(a => a.id === id);
        if (alumno) {
            alumno.estado = alumno.estado === 'Activo' ? 'Suspendido' : 'Activo';
            this.guardarAlumnos();
            return true;
        }
        return false;
    }

    getAlumnoPorId(id) { return this.alumnos.find(a => a.id === id); }
    getAlumnoPorCodigo(codigo) { return this.alumnos.find(a => a.codigo === codigo); }

    agregarEvidencia(alumnoId, materia, bimestre, archivoNombre, archivoData, comentario = '') {
        const evidencias = StorageManager.cargar('colegio_evidencias', []);
        const id = Date.now();
        evidencias.push({
            id, alumnoId, materia, bimestre, archivoNombre, archivoData,
            comentario, fecha: new Date().toISOString(),
            subidoPor: this.sesion?.usuario?.nombreCompleto || 'Maestro'
        });
        StorageManager.guardar('colegio_evidencias', evidencias);
        return id;
    }

    getEvidenciasPorAlumnoMateriaBimestre(alumnoId, materia, bimestre) {
        const evidencias = StorageManager.cargar('colegio_evidencias', []);
        return evidencias.filter(e => e.alumnoId === alumnoId && e.materia === materia && e.bimestre === bimestre);
    }

    eliminarEvidencia(id) {
        let evidencias = StorageManager.cargar('colegio_evidencias', []);
        evidencias = evidencias.filter(e => e.id !== id);
        StorageManager.guardar('colegio_evidencias', evidencias);
    }

    agregarMaestro(usuario, password, nombre, apellidos) {
        if (this.maestros.some(m => m.usuario === usuario)) return null;
        const id = this.siguienteIdMaestro();
        const maestro = new Maestro(id, usuario, password, nombre, apellidos);
        this.maestros.push(maestro);
        this.guardarMaestros();
        return maestro;
    }
    eliminarMaestro(id) {
        this.maestros = this.maestros.filter(m => m.id !== id);
        this.guardarMaestros();
    }
    getMaestroPorCredenciales(usuario, password) {
        return this.maestros.find(m => m.usuario === usuario && m.password === password);
    }

    actualizarCuota(nueva) { this.config.cuotaMensual = nueva; StorageManager.guardar('colegio_config', this.config); }
    agregarExtraItem(nombre, montoTotal) {
        if (this.config.extrasItems.some(item => item.nombre === nombre)) return false;
        this.config.extrasItems.push({ nombre, montoTotal });
        this.alumnos.forEach(a => a.extrasPagados[nombre] = 0);
        StorageManager.guardar('colegio_config', this.config);
        this.guardarAlumnos();
        return true;
    }
    eliminarExtraItem(nombre) {
        this.config.extrasItems = this.config.extrasItems.filter(item => item.nombre !== nombre);
        this.alumnos.forEach(a => delete a.extrasPagados[nombre]);
        StorageManager.guardar('colegio_config', this.config);
        this.guardarAlumnos();
    }

    registrarAbonoExtra(idAlumno, nombreItem, cantidad) {
        const a = this.getAlumnoPorId(idAlumno);
        const item = this.config.extrasItems.find(i => i.nombre === nombreItem);
        if (!a || !item) return false;
        const nuevo = (a.extrasPagados[nombreItem] || 0) + cantidad;
        if (nuevo > item.montoTotal) return false;
        a.extrasPagados[nombreItem] = nuevo;
        this.guardarAlumnos();
        return true;
    }

    getMontoAbonado(idAlumno, nombreItem) {
        const alumno = this.alumnos.find(a => a.id === idAlumno);
        return alumno ? (alumno.extrasPagados[nombreItem] || 0) : 0;
    }

    // ----- Tareas -----
    crearTarea(titulo, descripcion, materia, grado, cicloEscolar, bimestre, fechaEntrega, creadoPor, puntajeMaximo = 10) {
        const id = Date.now();
        const tarea = new Tarea(id, titulo, descripcion, materia, grado, cicloEscolar, bimestre, fechaEntrega, creadoPor, puntajeMaximo);
        this.tareas.push(tarea);
        StorageManager.guardar('colegio_tareas', this.tareas);
        return tarea;
    }
    eliminarTarea(id) {
        this.tareas = this.tareas.filter(t => t.id !== id);
        StorageManager.guardar('colegio_tareas', this.tareas);
    }
    getTareasPorGradoYCicloMateriaBimestre(grado, ciclo, materia, bimestre) {
        return this.tareas.filter(t => t.grado === grado && t.cicloEscolar === ciclo && t.materia === materia && t.bimestre === bimestre);
    }
    entregarTarea(tareaId, alumnoId, archivoNombre, archivoData) {
        const entrega = new Entrega(Date.now(), tareaId, alumnoId, archivoNombre, archivoData, null, '');
        this.entregas.push(entrega);
        StorageManager.guardar('colegio_entregas', this.entregas);
        return entrega;
    }
    calificarEntrega(entregaId, calificacion, comentario) {
        const e = this.entregas.find(en => en.id === entregaId);
        if (e) {
            e.calificacion = calificacion;
            e.comentario = comentario;
            StorageManager.guardar('colegio_entregas', this.entregas);
            this._actualizarNotaBimestreDesdeTareas(e.alumnoId, e.tareaId);
            return true;
        }
        return false;
    }
    getEntregasPorTarea(tareaId) { return this.entregas.filter(e => e.tareaId === tareaId); }
    getEntregasPorAlumno(alumnoId) { return this.entregas.filter(e => e.alumnoId === alumnoId); }
    getCalificacionTarea(alumnoId, tareaId) {
        const entrega = this.entregas.find(e => e.alumnoId === alumnoId && e.tareaId === tareaId);
        return entrega ? entrega.calificacion : null;
    }

    setExamenBimestral(alumnoId, materia, bimestre, nota) {
        const key = `${alumnoId}_${materia}_${bimestre}`;
        this.examenesBimestrales[key] = nota;
        StorageManager.guardar('colegio_examenes_bimestrales', this.examenesBimestrales);
        this._actualizarNotaBimestreDesdeExamen(alumnoId, materia, bimestre);
    }
    getExamenBimestral(alumnoId, materia, bimestre) {
        const key = `${alumnoId}_${materia}_${bimestre}`;
        return this.examenesBimestrales[key] || 0;
    }

    calcularTotalBimestre(alumnoId, materia, bimestre) {
        const alumno = this.getAlumnoPorId(alumnoId);
        if (!alumno) return 0;
        const tareas = this.tareas.filter(t => t.grado === alumno.grado && t.cicloEscolar === alumno.cicloEscolar && t.materia === materia && t.bimestre === bimestre);
        let sumaTareas = 0;
        tareas.forEach(tarea => {
            const calif = this.getCalificacionTarea(alumnoId, tarea.id);
            if (calif !== null && calif !== undefined) sumaTareas += calif;
        });
        const examen = this.getExamenBimestral(alumnoId, materia, bimestre);
        return sumaTareas + examen;
    }

    _actualizarNotaBimestreDesdeTareas(alumnoId, tareaId) {
        const tarea = this.tareas.find(t => t.id === tareaId);
        if (!tarea) return;
        const total = this.calcularTotalBimestre(alumnoId, tarea.materia, tarea.bimestre);
        const bimestreKey = `Bimestre ${tarea.bimestre}`;
        this.notas.setNota(alumnoId, bimestreKey, tarea.materia, total);
    }
    _actualizarNotaBimestreDesdeExamen(alumnoId, materia, bimestre) {
        const total = this.calcularTotalBimestre(alumnoId, materia, bimestre);
        const bimestreKey = `Bimestre ${bimestre}`;
        this.notas.setNota(alumnoId, bimestreKey, materia, total);
    }

    obtenerZonaCuadro(grado, materia, bimestre, ciclo) {
        const alumnos = this.getAlumnosFiltrados(grado, ciclo);
        const tareas = this.tareas.filter(t => t.grado === grado && t.cicloEscolar === ciclo && t.materia === materia && t.bimestre === bimestre);
        const data = alumnos.map(alumno => {
            const tareasCalif = tareas.map(t => this.getCalificacionTarea(alumno.id, t.id));
            const examen = this.getExamenBimestral(alumno.id, materia, bimestre);
            const total = this.calcularTotalBimestre(alumno.id, materia, bimestre);
            return { alumno, tareasCalif, examen, total };
        });
        return { tareas, data };
    }

    generarCorrelativo() {
        const next = this.correlativoCounter + 1;
        this.correlativoCounter = next;
        StorageManager.guardar('correlativo_counter', this.correlativoCounter);
        return next;
    }
    registrarPagoOnline(alumnoId, cicloEscolar, mesIndex, monto) {
        const alumno = this.getAlumnoPorId(alumnoId);
        if (!alumno || alumno.pagos[mesIndex]) return null;
        const correlativo = this.generarCorrelativo();
        const pago = new PagoOnline(correlativo, alumnoId, alumno.nombreCompleto, cicloEscolar, mesIndex, monto, new Date().toISOString());
        this.pagosOnline.push(pago);
        alumno.pagos[mesIndex] = true;
        this.guardarAlumnos();
        StorageManager.guardar('colegio_pagosOnline', this.pagosOnline);
        return pago;
    }
    getPagosOnlinePorAlumno(alumnoId) { return this.pagosOnline.filter(p => p.alumnoId === alumnoId); }


    // ----- Evidencias de maestros (archivos Excel) -----
    subirEvidenciaDocente(maestroId, nombreArchivo, datosBase64, comentario = '') {
        const id = Date.now();
        this.evidenciasDocente.push({
            id, maestroId, nombreArchivo, datosBase64, comentario,
            fecha: new Date().toISOString()
        });
        StorageManager.guardar('colegio_evidencias_docente', this.evidenciasDocente);
        return id;
    }
    getEvidenciasPorMaestro(maestroId) {
        return this.evidenciasDocente.filter(e => e.maestroId === maestroId).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    }
    eliminarEvidenciaDocente(id) {
        this.evidenciasDocente = this.evidenciasDocente.filter(e => e.id !== id);
        StorageManager.guardar('colegio_evidencias_docente', this.evidenciasDocente);
    }
    getTodosMaestrosConEvidencias() {
        const idsMaestros = [...new Set(this.evidenciasDocente.map(e => e.maestroId))];
        return this.maestros.filter(m => idsMaestros.includes(m.id));
    }
    
    // Método para obtener rendimiento por materias (usado en estadísticas del alumno)
    obtenerRendimientoPorMaterias(idAlumno) {
        const alumno = this.getAlumnoPorId(idAlumno);
        if (!alumno) return {};
        const materias = this.notas.materias;
        const rendimiento = {};
        materias.forEach(mat => {
            let suma = 0, count = 0;
            for (let bim = 1; bim <= 4; bim++) {
                const nota = this.notas.getNota(idAlumno, `Bimestre ${bim}`, mat);
                if (nota > 0) {
                    suma += nota;
                    count++;
                }
            }
            rendimiento[mat] = count > 0 ? +(suma / count).toFixed(2) : 0;
        });
        return rendimiento;
    }
}


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


    async editarAlumno(codigo) {
        const alumno = this.colegio.alumnos.find(a => a.codigo === codigo);
        if (!alumno) return;

        const { value: formValues } = await Swal.fire({
            title: 'Editar Datos del Alumno',
            html: `
                <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
                    <label><b>Nombres:</b></label>
                    <input id="sw-nombres" class="swal2-input" value="${alumno.nombres}" style="margin:0; width:100%;">
                    
                    <label><b>Apellidos:</b></label>
                    <input id="sw-apellidos" class="swal2-input" value="${alumno.apellidos}" style="margin:0; width:100%;">
                    
                    <label><b>Teléfono:</b></label>
                    <input id="sw-tel" class="swal2-input" value="${alumno.telefono || ''}" style="margin:0; width:100%;">
                    
                    <label><b>Correo:</b></label>
                    <input id="sw-mail" class="swal2-input" value="${alumno.correo || ''}" style="margin:0; width:100%;">
                    
                    <label><b>Estado:</b></label>
                    <select id="sw-estado" class="swal2-input" style="margin:0; width:100%;">
                        <option value="Activo" ${alumno.estado === 'Activo' ? 'selected' : ''}>Activo</option>
                        <option value="Suspendido" ${alumno.estado === 'Suspendido' ? 'selected' : ''}>Suspendido</option>
                    </select>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Actualizar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                return {
                    nombres: document.getElementById('sw-nombres').value.trim(),
                    apellidos: document.getElementById('sw-apellidos').value.trim(),
                    telefono: document.getElementById('sw-tel').value.trim(),
                    correo: document.getElementById('sw-mail').value.trim(),
                    estado: document.getElementById('sw-estado').value
                };
            }
        });

        if (formValues) {
            alumno.nombres = formValues.nombres;
            alumno.apellidos = formValues.apellidos;
            alumno.telefono = formValues.telefono;
            alumno.correo = formValues.correo;
            alumno.estado = formValues.estado;
            if (typeof alumno.actualizarNombreCompleto === 'function') {
                alumno.actualizarNombreCompleto();
            }
            Swal.fire('¡Éxito!', 'Alumno actualizado correctamente', 'success');
            this._renderListado(); 
        }
    }

    // ------------------------------------------------------------
    // MENSUALIDADES (con selección de meses en el recibo)
    // ------------------------------------------------------------
    _renderMensualidades() {
        const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct'];
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `
            <h2 class="section-title">💰 Control de Mensualidades (Ciclo ${this.cicloActual})</h2>
            <div class="toolbar">
                <select id="pagGrado">${grados.map(g => `<option>${g}</option>`).join('')}</select>
                <div class="config-price"><label>Cuota Q</label><input type="number" id="inputCuota" value="${this.colegio.config.cuotaMensual}" min="1"><button class="btn btn-primary btn-sm" id="btnActualizarCuota">Actualizar</button></div>
            </div>
            <div class="table-container">
                <table><thead><tr><th>No. Clave</th><th>Alumno</th><th>Ciclo</th>${meses.map(m=>`<th>${m}<br><small>Estado</small></th>`).join('')}<th>Deuda Total</th><th>Acción</th></tr></thead>
                <tbody id="tbodyPagos"></tbody>
            </table>
        `;
        const selectGrado = document.getElementById('pagGrado');
        const self = this;
        const actualizar = () => {
            const grado = selectGrado.value;
            const alumnos = self.colegio.getAlumnosFiltrados(grado, self.cicloActual);
            const cuota = self.colegio.config.cuotaMensual;
            const tbody = document.getElementById('tbodyPagos');
            tbody.innerHTML = alumnos.map(a => {
                let deuda = 0;
                const checks = a.pagos.map((pagado, i) => {
                    if (!pagado) deuda += cuota;
                    return `<td style="text-align:center;"><input type="checkbox" ${pagado?'checked':''} class="chk-pago" data-id="${a.id}" data-mes="${i}"><span class="estado-pago ${pagado?'pagado':'pendiente'}">${pagado?'Pagado':'Pendiente'}</span></td>`;
                }).join('');
                return `<tr data-id="${a.id}"><td style="text-align:center;">${a.clave}</td><td>${a.nombreCompleto}</td><td style="text-align:center;">${a.cicloEscolar}</td>${checks}<td style="text-align:center;"><span class="deuda-badge badge ${deuda===0?'badge-al-dia':'badge-deuda'}">${deuda===0?'Al día':'Q'+deuda}</span></td><td style="text-align:center;"><button class="btn btn-sm btn-primary btn-recibo" data-id="${a.id}">🧾 Recibo</button></td></tr>`;
            }).join('');
            tbody.querySelectorAll('.chk-pago').forEach(chk => {
                chk.addEventListener('change', function() {
                    const id = parseInt(this.dataset.id);
                    const mes = parseInt(this.dataset.mes);
                    const alumno = self.colegio.getAlumnoPorId(id);
                    if (alumno) {
                        alumno.pagos[mes] = this.checked;
                        self.colegio.guardarAlumnos();
                        const fila = this.closest('tr');
                        const cuotaActual = self.colegio.config.cuotaMensual;
                        let nuevaDeuda = 0;
                        for (let i=0; i<alumno.pagos.length; i++) if (!alumno.pagos[i]) nuevaDeuda += cuotaActual;
                        const deudaSpan = fila.querySelector('.deuda-badge');
                        deudaSpan.textContent = nuevaDeuda === 0 ? 'Al día' : 'Q' + nuevaDeuda;
                        deudaSpan.className = `deuda-badge badge ${nuevaDeuda === 0 ? 'badge-al-dia' : 'badge-deuda'}`;
                        const estadoSpan = this.nextElementSibling;
                        if (estadoSpan) { estadoSpan.textContent = this.checked ? 'Pagado' : 'Pendiente'; estadoSpan.className = `estado-pago ${this.checked ? 'pagado' : 'pendiente'}`; }
                    }
                });
            });
            tbody.querySelectorAll('.btn-recibo').forEach(btn => {
                btn.addEventListener('click', () => {
                    const alumno = self.colegio.getAlumnoPorId(parseInt(btn.dataset.id));
                    if (alumno) self._mostrarModalSeleccionMeses(alumno);
                });
            });
        };
        document.getElementById('btnActualizarCuota').addEventListener('click', () => {
            const nueva = parseInt(document.getElementById('inputCuota').value);
            if (nueva > 0) { self.colegio.actualizarCuota(nueva); actualizar(); }
        });
        selectGrado.addEventListener('change', actualizar);
        actualizar();
    }

    _mostrarModalSeleccionMeses(alumno) {
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'];
        const cuota = this.colegio.config.cuotaMensual;
        let html = `<div style="max-height: 400px; overflow-y: auto;"><p><strong>${alumno.nombreCompleto}</strong></p><p>Seleccione los meses que desea incluir en el recibo:</p>`;
        meses.forEach((mes, idx) => {
            const pagado = alumno.pagos[idx];
            html += `<div style="margin:5px 0;"><label><input type="checkbox" class="mes-checkbox" data-mes="${mes}" data-index="${idx}" ${pagado ? 'checked' : ''}> ${mes} - ${pagado ? 'Pagado' : 'Pendiente'}</label></div>`;
        });
        html += `<p style="margin-top:10px;"><small><em>Nota: Puede seleccionar meses pendientes para generar un recibo de adeudo.</em></small></p></div>`;
        Swal.fire({
            title: 'Seleccionar meses para el recibo',
            html: html,
            showCancelButton: true,
            confirmButtonText: 'Generar recibo',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const selected = [];
                document.querySelectorAll('.mes-checkbox:checked').forEach(cb => {
                    selected.push({
                        mes: cb.dataset.mes,
                        index: parseInt(cb.dataset.index)
                    });
                });
                if (selected.length === 0) {
                    Swal.showValidationMessage('Debe seleccionar al menos un mes');
                    return false;
                }
                return selected;
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                this._generarReciboMeses(alumno, result.value);
            }
        });
    }

    _generarReciboMeses(alumno, mesesSeleccionados) {
        const cuota = this.colegio.config.cuotaMensual;
        const total = mesesSeleccionados.length * cuota;
        const nombresMeses = mesesSeleccionados.map(m => m.mes).join(', ');
        const ventana = window.open('', 'Recibo', 'width=400,height=600');
        ventana.document.write(`
            <html><head><title>Recibo</title>
            <style>body { font-family: monospace; padding: 20px; }.logo-container { text-align: right; margin-bottom: 10px; }img { max-width: 100px; }pre { text-align: left; display: inline-block; }@media print { body { width: 80mm; } }</style></head>
            <body><div class="logo-container"><img src="logo.jpeg" alt="Logo"></div>
            <pre>
==========================================
        COLEGIO MIXTO BELÉN
      RECIBO DE MENSUALIDADES
==========================================
Alumno: ${alumno.nombreCompleto}
Código: ${alumno.codigo}
Grado: ${alumno.grado}   Ciclo: ${alumno.cicloEscolar}
------------------------------------------
Meses incluidos: ${nombresMeses}
Total meses: ${mesesSeleccionados.length}
Monto por mes: Q${cuota}
TOTAL: Q${total}
------------------------------------------
Fecha: ${new Date().toLocaleString()}
==========================================
        ¡Gracias por su pago!
            </pre>
            <script>window.print();<\/script>
            </body></html>
        `);
    }

    _renderAdminExtras() {
        const items = this.colegio.config.extrasItems;
        this.mainContent.innerHTML = `
            <h2 class="section-title">➕💳 Administrar Pagos Adicionales</h2>
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;"><h3>Conceptos de pago extra</h3><button class="btn btn-primary" id="btnMostrarEstadoPagos">👥 Ver estado de pagos</button></div>
                <div style="display:flex; gap:10px; margin-bottom:15px;"><input type="text" id="extraNombre" placeholder="Nombre (ej. Uniforme)"><input type="number" id="extraMonto" placeholder="Monto total Q" min="1" step="0.01"><button class="btn btn-success" id="btnAgregarExtra">➕ Agregar</button></div>
                <table class="table-container"><thead><tr><th>Concepto</th><th>Monto total Q</th><th>Acción</th></tr></thead><tbody id="tbodyExtrasItems">${items.map(it => `<tr><td>${it.nombre}</td><td>Q${it.montoTotal.toFixed(2)}</td><td><button class="btn btn-sm btn-danger btn-eliminar-extra" data-nombre="${it.nombre}">🗑️</button></td></tr>`).join('')}</tbody>
            </table>
            </div>
        `;
        const actualizarListaItems = () => {
            const tbody = document.getElementById('tbodyExtrasItems');
            const items = this.colegio.config.extrasItems;
            tbody.innerHTML = items.map(it => `<tr><td>${it.nombre}</td><td>Q${it.montoTotal.toFixed(2)}</td><td><button class="btn btn-sm btn-danger btn-eliminar-extra" data-nombre="${it.nombre}">🗑️</button></td></tr>`).join('');
            tbody.querySelectorAll('.btn-eliminar-extra').forEach(btn => btn.addEventListener('click', async () => {
                const result = await Swal.fire({ title: '¿Eliminar concepto?', text: 'Se borrará de todos los alumnos.', icon: 'warning', showCancelButton: true });
                if (result.isConfirmed) { this.colegio.eliminarExtraItem(btn.dataset.nombre); actualizarListaItems(); Swal.fire('Eliminado', '', 'success'); }
            }));
        };
        document.getElementById('btnAgregarExtra').addEventListener('click', async () => {
            const nombre = document.getElementById('extraNombre').value.trim();
            const monto = parseFloat(document.getElementById('extraMonto').value);
            if (!nombre || isNaN(monto) || monto <= 0) return Swal.fire('Error', 'Datos inválidos.', 'error');
            if (this.colegio.agregarExtraItem(nombre, monto)) {
                document.getElementById('extraNombre').value = '';
                document.getElementById('extraMonto').value = '';
                actualizarListaItems();
                Swal.fire('Agregado', '', 'success');
            } else Swal.fire('Error', 'El concepto ya existe.', 'error');
        });
        document.getElementById('btnMostrarEstadoPagos').addEventListener('click', () => this._mostrarModalEstadoPagosAdicionales());
        actualizarListaItems();
    }

   _renderPanelControl() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `<h2 class="section-title">⚙️ Panel de Control</h2><div class="search-box"><select id="panelGrado">${grados.map(g=>`<option>${g}</option>`).join('')}</select><input type="text" id="panelBusqueda" placeholder="Buscar..."><button class="btn btn-warning" id="btnSuspender">Alternar Suspensión</button><button class="btn btn-danger" id="btnEliminar">Eliminar</button></div><div class="table-container"><table><thead><tr><th>Clave</th><th>Alumno</th><th>Grado</th><th>Ciclo</th><th>Estado</th></tr></thead><tbody id="tbodyPanel"></tbody></table></div>`;
        const selectGrado=document.getElementById('panelGrado'), inputBusqueda=document.getElementById('panelBusqueda');
        const actualizar=()=>{ let datos=this.colegio.getAlumnosFiltrados(selectGrado.value, this.cicloActual); const texto=inputBusqueda.value.toLowerCase(); if(texto) datos=datos.filter(a=>a.nombres.toLowerCase().includes(texto)||a.apellidos.toLowerCase().includes(texto)||String(a.clave).includes(texto)); const tbody=document.getElementById('tbodyPanel'); tbody.innerHTML=datos.map(a=>`<tr class="${a.estado==='Suspendido'?'suspendido':''}" data-id="${a.id}"><td style="text-align:center;">${a.clave}</td><td>${a.nombreCompleto}</td><td>${a.grado}</td><td>${a.cicloEscolar}</td><td><span class="badge ${a.estado==='Activo'?'badge-activo':'badge-suspendido'}">${a.estado}</span></td></tr>`).join(''); tbody.querySelectorAll('tr').forEach(f=>f.addEventListener('click',()=>{tbody.querySelectorAll('tr').forEach(r=>r.classList.remove('selected')); f.classList.add('selected');})); };
        selectGrado.addEventListener('change', actualizar); inputBusqueda.addEventListener('input', actualizar);
        document.getElementById('btnSuspender').onclick=()=>{ let sel=document.querySelector('#tbodyPanel tr.selected'); if(!sel) return Swal.fire('Error','Seleccione un alumno','error'); this.colegio.suspenderAlternar(parseInt(sel.dataset.id)); actualizar(); };
        document.getElementById('btnEliminar').onclick=async()=>{ let sel=document.querySelector('#tbodyPanel tr.selected'); if(!sel) return Swal.fire('Error','Seleccione','error'); const r=await Swal.fire({title:'¿Eliminar?',text:'No se puede deshacer',icon:'warning',showCancelButton:true}); if(r.isConfirmed){ this.colegio.eliminarAlumno(parseInt(sel.dataset.id)); actualizar(); Swal.fire('Eliminado','','success'); } };
        actualizar();
    }

      _renderGestionAlumnos() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `
            <h2 class="section-title">👥 Gestión de Alumnos (Contraseñas)</h2>
            <div class="toolbar"><select id="gestionGrado">${grados.map(g=>`<option>${g}</option>`).join('')}</select></div>
            <div class="table-container"><table><thead><tr><th>Clave</th><th>Alumno</th><th>Código</th><th>Contraseña actual</th><th>Nueva contraseña</th><th>Acción</th></tr></thead><tbody id="tbodyGestionAlumnos"></tbody></table></div>
        `;
        const selectGrado = document.getElementById('gestionGrado');
        const actualizar = () => {
            const grado = selectGrado.value;
            const alumnos = this.colegio.getAlumnosFiltrados(grado, this.cicloActual);
            const tbody = document.getElementById('tbodyGestionAlumnos');
            tbody.innerHTML = alumnos.map(a => `<tr><td>${a.clave}</td><td>${a.nombreCompleto}</td><td>${a.codigo}</td><td>••••••</td><td><input type="text" id="pass-${a.id}" placeholder="Nueva"></td><td><button class="btn btn-sm btn-primary" data-id="${a.id}">Actualizar</button></td></tr>`).join('');
            document.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', () => { let id=parseInt(btn.dataset.id); let nueva=document.getElementById(`pass-${id}`).value.trim(); if(nueva && this.colegio.actualizarPasswordAlumno(id,nueva)) Swal.fire('Éxito','Contraseña actualizada','success'); else Swal.fire('Error','Ingrese una nueva','error'); actualizar(); }));
        };
        selectGrado.addEventListener('change', actualizar);
        actualizar();
    }

    _renderGestionMaestros() {
        this.mainContent.innerHTML = `
            <h2 class="section-title">👨‍🏫 Gestionar Maestros</h2>
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3>Listado de Maestros</h3>
                    <button class="btn btn-success" id="btnNuevoMaestro">➕ Nuevo Maestro</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>ID</th><th>Nombre</th><th>Usuario</th><th>Grados</th><th>Materias</th><th>Acción</th></tr></thead>
                        <tbody id="tbodyMaestros"></tbody>
                    </table>
                </div>
                <div id="mensajeMaestro"></div>
            </div>
        `;

        const actualizarLista = () => {
            const tbody = document.getElementById('tbodyMaestros');
            tbody.innerHTML = this.colegio.maestros.map(m => {
                const grados = Object.keys(m.asignaciones).join(', ') || 'Ninguno';
                const materias = [...new Set(Object.values(m.asignaciones).flat())].join(', ') || 'Ninguna';
                return `<tr>
                    <td>${m.id}</td>
                    <td>${m.nombreCompleto}</td>
                    <td>${m.usuario}</td>
                    <td>${grados}</td>
                    <td>${materias}</td>
                    <td>
                        <button class="btn btn-sm btn-primary btn-asignar" data-id="${m.id}">Asignar</button>
                        <button class="btn btn-sm btn-danger btn-eliminar-maestro" data-id="${m.id}">Eliminar</button>
                    </td>
                 </tr>`;
            }).join('');

            tbody.querySelectorAll('.btn-eliminar-maestro').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const result = await Swal.fire({
                        title: '¿Eliminar maestro?',
                        text: 'Esta acción no se puede deshacer.',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#e74c3c',
                        cancelButtonColor: '#7f8c8d',
                        confirmButtonText: 'Eliminar'
                    });
                    if (result.isConfirmed) {
                        await this.colegio.eliminarMaestro(parseInt(btn.dataset.id));
                        actualizarLista();
                        Swal.fire('Eliminado', '', 'success');
                    }
                });
            });

            tbody.querySelectorAll('.btn-asignar').forEach(btn => {
                btn.addEventListener('click', () => this._abrirModalAsignacion(parseInt(btn.dataset.id)));
            });
        };

        document.getElementById('btnNuevoMaestro').addEventListener('click', () => this._mostrarModalRegistroMaestro());

        actualizarLista();
    }


    _mostrarModalRegistroMaestro() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal-card" style="max-width:500px;">
                <div class="modal-header">
                    <h3>Registrar Nuevo Maestro</h3>
                    <button class="btn-close-modal">&times;</button>
                </div>
                <div class="form-group"><label>Usuario</label><input type="text" id="regUsuario"></div>
                <div class="form-group"><label>Contraseña</label><input type="password" id="regPassword"></div>
                <div class="form-group"><label>Nombre</label><input type="text" id="regNombre"></div>
                <div class="form-group"><label>Apellidos</label><input type="text" id="regApellidos"></div>
                <div class="modal-footer">
                    <button class="btn btn-secondary cerrar-modal">Cancelar</button>
                    <button class="btn btn-primary" id="btnGuardarMaestro">Guardar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.btn-close-modal').addEventListener('click', () => overlay.remove());
        overlay.querySelector('.cerrar-modal').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        document.getElementById('btnGuardarMaestro').addEventListener('click', async () => {
            const usuario = document.getElementById('regUsuario').value.trim();
            const password = document.getElementById('regPassword').value.trim();
            const nombre = document.getElementById('regNombre').value.trim();
            const apellidos = document.getElementById('regApellidos').value.trim();

            if (!usuario || !password || !nombre || !apellidos) {
                return Swal.fire('Error', 'Todos los campos son obligatorios.', 'error');
            }

            const maestro = this.colegio.agregarMaestro(usuario, password, nombre, apellidos);
            if (maestro) {
                overlay.remove();
                Swal.fire('Registrado', 'Maestro creado con éxito.', 'success');
                this._renderGestionMaestros(); 
            } else {
                Swal.fire('Error', 'El usuario ya existe.', 'error');
            }
        });
    }

    _abrirModalAsignacion(idMaestro) {
        const maestro = this.colegio.maestros.find(m => m.id === idMaestro);
        if (!maestro) return;

        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        const materias = this.colegio.notas.materias;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';

        let tablaHTML = '<table class="table-container"><thead><tr><th>Grado</th>';
        materias.forEach(mat => tablaHTML += `<th>${mat}</th>`);
        tablaHTML += '</tr></thead><tbody>';

        grados.forEach(grado => {
            tablaHTML += `<tr><td>${grado}</td>`;
            materias.forEach(mat => {
                const checked = maestro.asignaciones[grado] && maestro.asignaciones[grado].includes(mat) ? 'checked' : '';
                tablaHTML += `<td style="text-align:center;"><input type="checkbox" class="chk-asignar" data-grado="${grado}" data-materia="${mat}" ${checked}></td>`;
            });
            tablaHTML += '</tr>';
        });
        tablaHTML += '</tbody></table>';

        overlay.innerHTML = `
            <div class="modal-card" style="max-width:900px; width:95%;">
                <div class="modal-header">
                    <h3>Asignar grados y materias - ${maestro.nombreCompleto}</h3>
                    <button class="btn-close-modal">&times;</button>
                </div>
                <div style="max-height:60vh; overflow:auto;">
                    ${tablaHTML}
                </div>
                <div class="modal-footer" style="margin-top:15px;">
                    <button class="btn btn-secondary cerrar-modal">Cancelar</button>
                    <button class="btn btn-primary" id="btnGuardarAsignacion">Guardar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.btn-close-modal').addEventListener('click', () => overlay.remove());
        overlay.querySelector('.cerrar-modal').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        document.getElementById('btnGuardarAsignacion').addEventListener('click', () => {
            const asignaciones = {};
            overlay.querySelectorAll('.chk-asignar:checked').forEach(cb => {
                const grado = cb.dataset.grado;
                const materia = cb.dataset.materia;
                if (!asignaciones[grado]) asignaciones[grado] = [];
                asignaciones[grado].push(materia);
            });
            maestro.asignaciones = asignaciones;
            this.colegio.guardarMaestros();
            overlay.remove();
            this._renderGestionMaestros();
        });
    }

  _renderSubirEvidencia() {
        if (!this.sesion.esMaestro) { Swal.fire('Acceso denegado', 'Solo los maestros pueden subir evidencias.', 'error'); return; }
        const maestro = this.sesion.usuario;
        const evidencias = this.colegio.getEvidenciasPorMaestro(maestro.id);
        this.mainContent.innerHTML = `<h2 class="section-title">📎 Subir Evidencia de Control de Zona</h2><div class="card"><h3>📤 Subir nuevo archivo Excel</h3><div class="form-group"><label>Archivo Excel (.xlsx, .xls)</label><input type="file" id="fileEvidencia" accept=".xlsx,.xls"></div><div class="form-group"><label>Comentario (opcional)</label><textarea id="comentarioEvidencia" rows="2" placeholder="Ej: Control de zona unidad 1, parcial 1..."></textarea></div><button class="btn btn-success" id="btnSubirEvidencia">📤 Subir archivo</button></div><div class="card"><h3>📁 Mis evidencias subidas</h3><div id="listaEvidenciasMaestro" class="table-container">${this._generarListaEvidencias(evidencias)}</div></div>`;
        document.getElementById('btnSubirEvidencia').onclick = () => {
            const fileInput = document.getElementById('fileEvidencia');
            const comentario = document.getElementById('comentarioEvidencia').value.trim();
            if (!fileInput.files.length) return Swal.fire('Error', 'Seleccione un archivo Excel', 'error');
            const file = fileInput.files[0];
            if (!file.name.match(/\.(xlsx|xls)$/i)) return Swal.fire('Error', 'Solo se permiten archivos Excel (.xlsx, .xls)', 'error');
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result.split(',')[1];
                this.colegio.subirEvidenciaDocente(maestro.id, file.name, base64, comentario);
                Swal.fire('Subido', 'Archivo guardado como evidencia', 'success');
                this._renderSubirEvidencia();
            };
            reader.readAsDataURL(file);
        };
        document.querySelectorAll('.ver-evidencia').forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); const data = link.dataset.data; const binary = atob(data); const array = new Uint8Array(binary.length); for(let i=0;i<binary.length;i++) array[i]=binary.charCodeAt(i); const blob = new Blob([array], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); window.open(URL.createObjectURL(blob)); }));
        document.querySelectorAll('.eliminar-evidencia').forEach(btn => btn.addEventListener('click', async () => { const id = parseInt(btn.dataset.id); const confirm = await Swal.fire({title:'¿Eliminar?', text:'No se puede deshacer', icon:'warning', showCancelButton:true}); if(confirm.isConfirmed) { this.colegio.eliminarEvidenciaDocente(id); this._renderSubirEvidencia(); } }));
    }

    _generarListaEvidencias(evidencias) {
        if (!evidencias.length) return '<p>No ha subido ninguna evidencia aún.</p>';
        return `<table class="table"><thead><tr><th>Archivo</th><th>Comentario</th><th>Fecha</th><th>Acción</th></tr></thead><tbody>${evidencias.map(ev => `<tr><td><a href="#" class="ver-evidencia" data-data="${ev.datosBase64}" data-nombre="${ev.nombreArchivo}">📄 ${ev.nombreArchivo}</a></td><td>${ev.comentario || '—'}</td><td>${new Date(ev.fecha).toLocaleString()}</td><td><button class="btn btn-sm btn-danger eliminar-evidencia" data-id="${ev.id}">Eliminar</button></td></tr>`).join('')}</tbody></table>`;
    }

    _renderVerEvidenciasAdmin() {
        if (!this.sesion.esAdmin) { Swal.fire('Acceso denegado', 'Solo el administrador puede ver estas evidencias.', 'error'); return; }
        const todosMaestros = this.colegio.maestros;
        const maestrosConEvidencias = this.colegio.getTodosMaestrosConEvidencias();
        this.mainContent.innerHTML = `<h2 class="section-title">📂 Evidencias de Maestros (Controles de Zona)</h2><div class="toolbar"><input type="text" id="buscarMaestro" placeholder="Buscar por nombre..." style="width:250px;"></div><div class="card"><h3>👨‍🏫 Lista de maestros con evidencias</h3><div id="listaMaestrosEvidencias" class="table-container">${this._generarListaMaestrosConEvidencias(todosMaestros, maestrosConEvidencias)}</div></div>`;
        const inputBusqueda = document.getElementById('buscarMaestro');
        const actualizarLista = () => {
            const texto = inputBusqueda.value.toLowerCase();
            const filtrados = todosMaestros.filter(m => m.nombreCompleto.toLowerCase().includes(texto) && maestrosConEvidencias.some(me => me.id === m.id));
            document.getElementById('listaMaestrosEvidencias').innerHTML = this._generarListaMaestrosConEvidencias(filtrados, maestrosConEvidencias);
            document.querySelectorAll('.btn-ver-evidencias').forEach(btn => btn.addEventListener('click', () => {
                const maestroId = parseInt(btn.dataset.id);
                const evidencias = this.colegio.getEvidenciasPorMaestro(maestroId);
                const maestro = this.colegio.maestros.find(m => m.id === maestroId);
                this._mostrarEvidenciasMaestro(maestro, evidencias);
            }));
        };
        inputBusqueda.addEventListener('input', actualizarLista);
        actualizarLista();
    }

    _mostrarEvidenciasMaestro(maestro, evidencias) {
        if (!evidencias.length) { Swal.fire('Sin evidencias', `El maestro ${maestro.nombreCompleto} no tiene evidencias subidas.`, 'info'); return; }
        let html = `<div style="max-height: 500px; overflow-y: auto;"><table style="width:100%; border-collapse: collapse;"><thead><tr><th>Archivo</th><th>Comentario</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>`;
        evidencias.forEach(ev => {
            html += `<tr><td>${ev.nombreArchivo}</td><td>${ev.comentario || '—'}</td><td>${new Date(ev.fecha).toLocaleString()}</td><td><button class="btn-descargar-evidencia swal2-btn" data-data="${ev.datosBase64}" data-nombre="${ev.nombreArchivo}">⬇️ Descargar</button></td></tr>`;
        });
        html += `</tbody></table></div>`;
        Swal.fire({ title: `Evidencias de ${maestro.nombreCompleto}`, html: html, width: '900px', showConfirmButton: true, confirmButtonText: 'Cerrar', didOpen: () => {
            document.querySelectorAll('.btn-descargar-evidencia').forEach(btn => btn.addEventListener('click', (e) => {
                e.preventDefault();
                const data = btn.dataset.data;
                const nombre = btn.dataset.nombre;
                const binary = atob(data);
                const array = new Uint8Array(binary.length);
                for (let i=0; i<binary.length; i++) array[i] = binary.charCodeAt(i);
                const blob = new Blob([array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.download = nombre;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }));
        }});
    }

    _generarListaMaestrosConEvidencias(maestros, maestrosConEvidencias) {
        if (maestros.length === 0) return '<p>No hay maestros con evidencias.</p>';
        return `<table class="table"><thead><tr><th>ID</th><th>Maestro</th><th>Acción</th></tr></thead><tbody>${maestros.map(m => `<tr><td>${m.id}</td><td>${m.nombreCompleto}</td><td><button class="btn btn-sm btn-primary btn-ver-evidencias" data-id="${m.id}">📂 Ver evidencias</button></td></tr>`).join('')}</tbody></table>`;
    }

    _renderEstadisticasGlobal() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `<h2 class="section-title">📊 Estadísticas Globales (Rendimiento por Tareas)</h2><div class="toolbar"><select id="gradoEstadistica">${grados.map(g=>`<option>${g}</option>`).join('')}</select></div><div class="card"><canvas id="globalChart" style="max-width:500px; margin:0 auto;"></canvas></div>`;
        const actualizar = () => {
            const grado = document.getElementById('gradoEstadistica').value;
            const alumnos = this.colegio.getAlumnosFiltrados(grado, this.cicloActual);
            const promedios = {};
            alumnos.forEach(a => { const r = this.colegio.obtenerRendimientoPorMaterias(a.id); Object.entries(r).forEach(([mat,val]) => { if(!promedios[mat]) promedios[mat]={suma:0,count:0}; promedios[mat].suma+=val; promedios[mat].count++; }); });
            const labels = Object.keys(promedios);
            const data = labels.map(l=>+(promedios[l].suma/promedios[l].count).toFixed(2));
            const canvas = document.getElementById('globalChart');
            if(window.globalChart) window.globalChart.destroy();
            window.globalChart = new Chart(canvas, { type:'bar', data:{ labels, datasets:[{ label:'Promedio %', data, backgroundColor:'#1a5276' }] } });
        };
        document.getElementById('gradoEstadistica').addEventListener('change', actualizar);
        actualizar();
    }


    _renderBoletaLista() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `
            <h2 class="section-title">📄 Boleta Individual</h2>
            <div class="toolbar">
                <select id="boletaGrado">${grados.map(g => `<option>${g}</option>`).join('')}</select>
            </div>
            <div class="table-container">
                <table><thead><tr><th>No. Clave</th><th>Alumno</th><th>Acciones</th></tr></thead>
                <tbody id="tbodyBoletaLista"></tbody>
            </div>
            <div id="boletaPreview" style="margin-top:20px;"></div>
        `;
        const selectGrado = document.getElementById('boletaGrado');
        const self = this;
        const actualizar = () => {
            const grado = selectGrado.value;
            const alumnos = self.colegio.getAlumnosFiltrados(grado, self.cicloActual);
            const tbody = document.getElementById('tbodyBoletaLista');
            tbody.innerHTML = alumnos.map(a => `
                <tr>
                    <td>${a.clave}</td>
                    <td>${a.nombreCompleto}</td>
                    <td>
                        <button class="btn btn-sm btn-primary btn-ver-boleta" data-id="${a.id}">👁 Ver Notas</button>
                        <button class="btn btn-sm btn-success btn-imprimir-boleta" data-id="${a.id}">🖨 Imprimir</button>
                    </td>
                </tr>`).join('');
            tbody.querySelectorAll('.btn-ver-boleta').forEach(btn => {
                btn.addEventListener('click', () => self._mostrarBoletaModal(parseInt(btn.dataset.id)));
            });
            tbody.querySelectorAll('.btn-imprimir-boleta').forEach(btn => {
                btn.addEventListener('click', () => self._imprimirBoleta(parseInt(btn.dataset.id)));
            });
        };
        selectGrado.addEventListener('change', actualizar);
        actualizar();
    }

    _mostrarBoletaModal(idAlumno) {
        const alumno = this.colegio.getAlumnoPorId(idAlumno);
        if (!alumno) return;
        const contenido = this._generarHTMLBoleta(alumno);
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal-card" style="max-width:800px; text-align:center;">
                <div class="modal-header">
                    <h3>Boleta de Calificaciones</h3>
                    <button class="btn-close-modal">&times;</button>
                </div>
                <div>${contenido}</div>
                <div class="modal-footer">
                    <button class="btn btn-secondary cerrar-modal">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.btn-close-modal').addEventListener('click', () => overlay.remove());
        overlay.querySelector('.cerrar-modal').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        return overlay;
    }

    _imprimirBoleta(idAlumno) {
        const alumno = this.colegio.getAlumnoPorId(idAlumno);
        if (!alumno) return;
        const overlay = this._mostrarBoletaModal(idAlumno);
        if (overlay) { setTimeout(() => { window.print(); window.onafterprint = () => overlay.remove(); }, 300); }
    }

    _generarHTMLBoleta(alumno) {
        const bimestres = ['Bimestre 1','Bimestre 2','Bimestre 3','Bimestre 4'];
        const materias = this.colegio.notas.materias;
        let filas = materias.map(mat => {
            let cels = `<td class="materia-col">${mat}</td>`;
            let suma = 0, count = 0;
            bimestres.forEach(bim => {
                const v = this.colegio.notas.getNota(alumno.id, bim, mat);
                if (v > 0) { suma += v; count++; }
                cels += `<td>${v}</td>`;
            });
            cels += `<td>${count > 0 ? +(suma/count).toFixed(2) : 0}</td>`;
            return `<tr>${cels}</tr>`;
        }).join('');
        return `
            <div id="boletaPrintArea" class="boleta-print" style="text-align:center;">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:20px;">
                    <div style="text-align:left;">
                        <h2>COLEGIO MIXTO BELÉN</h2>
                        <p><strong>Alumno:</strong> ${alumno.nombreCompleto}</p>
                        <p>Grado: ${alumno.grado} | Ciclo: ${alumno.cicloEscolar}</p>
                    </div>
                    <img src="logo.jpeg" style="max-width:120px;">
                </div>
                <table class="boleta-table" style="margin:20px auto; width:90%;">
                    <thead><tr><th>Materia</th>${bimestres.map(b=>`<th>${b}</th>`).join('')}<th>Promedio</th></tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        `;
    }

    _renderZonaCuadro() {
        if (!this.sesion.esAdmin && !this.sesion.esMaestro) {
            Swal.fire('Acceso denegado', 'Solo administradores y maestros pueden acceder.', 'error');
            return;
        }
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        const materias = this.colegio.notas.materias;
        const bimestres = [1,2,3,4];
        this.mainContent.innerHTML = `
            <h2 class="section-title">📊 Cuadros de Zona por Clase</h2>
            <div class="toolbar" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <label>Grado: </label><select id="zonaGrado">${grados.map(g=>`<option>${g}</option>`).join('')}</select>
                    <label>Materia: </label><select id="zonaMateria">${materias.map(m=>`<option>${m}</option>`).join('')}</select>
                    <label>Bimestre: </label><select id="zonaBimestre">${bimestres.map(b=>`<option value="${b}">Bimestre ${b}</option>`).join('')}</select>
                    <button class="btn btn-primary" id="btnCargarZona">📊 Cargar Cuadro</button>
                </div>
                <button class="btn btn-success" id="btnImprimirZona">🖨️ Imprimir Cuadro</button>
            </div>
            <div id="zonaTablaContainer" class="table-container" style="margin-top:20px;"></div>
        `;
        document.getElementById('btnCargarZona').addEventListener('click', () => this._cargarZonaCuadro());
        document.getElementById('btnImprimirZona').addEventListener('click', () => this._imprimirZonaCuadro());
    }

    _cargarZonaCuadro() {
        const grado = document.getElementById('zonaGrado').value;
        const materia = document.getElementById('zonaMateria').value;
        const bimestre = parseInt(document.getElementById('zonaBimestre').value);
        const { tareas, data } = this.colegio.obtenerZonaCuadro(grado, materia, bimestre, this.cicloActual);
        if (!data.length) {
            document.getElementById('zonaTablaContainer').innerHTML = '<p>No hay alumnos en este grado y ciclo.</p>';
            return;
        }
        let html = `<table class="table"><thead><tr><th>No. Clave</th><th>Alumno</th>`;
        tareas.forEach(t => html += `<th>${t.titulo}<br><small>(${t.puntajeMaximo} pts)</small></th>`);
        html += `<th>Punteo Evaluación Bimestre</th><th>Total Nota</th></tr></thead><tbody>`;
        data.forEach(item => {
            const a = item.alumno;
            html += `<tr data-id="${a.id}"><td style="text-align:center;">${a.clave}</td><td>${a.nombreCompleto}</td>`;
            tareas.forEach((t, idx) => {
                const calif = item.tareasCalif[idx];
                html += `<td style="text-align:center;">${calif !== null ? calif : '-'}</td>`;
            });
            html += `<td style="text-align:center;"><input type="number" class="input-examen" value="${item.examen}" min="0" max="100" step="0.01" style="width:80px;"></td>
                     <td style="text-align:center; font-weight:bold;" class="total-nota">${item.total}</td>
                    </tr>`;
        });
        html += `</tbody></table>`;
        document.getElementById('zonaTablaContainer').innerHTML = html;
        document.querySelectorAll('.input-examen').forEach(input => {
            input.addEventListener('change', async (e) => {
                const fila = input.closest('tr');
                const alumnoId = parseInt(fila.dataset.id);
                const nuevaNota = parseFloat(input.value);
                if (isNaN(nuevaNota)) return;
                await this.colegio.setExamenBimestral(alumnoId, materia, bimestre, nuevaNota);
                const total = this.colegio.calcularTotalBimestre(alumnoId, materia, bimestre);
                fila.querySelector('.total-nota').innerText = total;
                Swal.fire('Actualizado', 'Nota del examen guardada', 'success');
            });
        });
        this.zonaActual = { grado, materia, bimestre, tareas, data };
    }

    _imprimirZonaCuadro() {
        if (!this.zonaActual) {
            Swal.fire('Error', 'Debe cargar un cuadro de zona antes de imprimir.', 'error');
            return;
        }
        const { grado, materia, bimestre, tareas, data } = this.zonaActual;
        const nombreMaestro = this.sesion.esMaestro ? this.sesion.usuario.nombreCompleto : 'Administrador';
        const ciclo = this.cicloActual;
        const fechaActual = new Date().toLocaleString();
        const logoUrl = 'logo.jpeg';
        let tablaHTML = `<table><thead><tr><th>No. Clave</th><th>Alumno</th>`;
        tareas.forEach(t => tablaHTML += `<th>${t.titulo} (${t.puntajeMaximo} pts)</th>`);
        tablaHTML += `<th>Punteo Evaluación</th><th>Total Nota</th></tr></thead><tbody>`;
        data.forEach(item => {
            const a = item.alumno;
            tablaHTML += `<tr><td style="text-align:center;">${a.clave}</td><td>${a.nombreCompleto}</td>`;
            tareas.forEach((t, idx) => {
                const calif = item.tareasCalif[idx];
                tablaHTML += `<td style="text-align:center;">${calif !== null ? calif : '-'}</td>`;
            });
            tablaHTML += `<td style="text-align:center;">${item.examen}</td><td style="text-align:center;">${item.total}</td></tr>`;
        });
        tablaHTML += `</tbody></table>`;
        const ventana = window.open('', '_blank');
        ventana.document.write(`
            <!DOCTYPE html>
            <html>
            <head><title>Cuadro de Zona - ${materia} - ${grado}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; }
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #1a5276; padding-bottom: 10px; }
                .logo { max-width: 100px; }
                .info { text-align: right; }
                h2 { margin: 0; color: #1a5276; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #1a5276; color: white; }
                .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #7f8c8d; }
                @media print { body { margin: 0; } .no-print { display: none; } }
            </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoUrl}" alt="Logo" class="logo" onerror="this.style.display='none'">
                    <div class="info">
                        <h2>COLEGIO MIXTO BELÉN</h2>
                        <p><strong>Maestro(a):</strong> ${nombreMaestro}<br>
                        <strong>Materia:</strong> ${materia}<br>
                        <strong>Grado:</strong> ${grado}<br>
                        <strong>Bimestre:</strong> ${bimestre}<br>
                        <strong>Ciclo Escolar:</strong> ${ciclo}<br>
                        <strong>Fecha de impresión:</strong> ${fechaActual}</p>
                    </div>
                </div>
                <h3 style="text-align:center;">Cuadro de Zona - Evaluaciones</h3>
                ${tablaHTML}
                <div class="footer">Documento generado por el Sistema de Gestión Escolar - Colegio Mixto Belén</div>
                <script>window.print();<\/script>
            </body>
            </html>
        `);
        ventana.document.close();
    }


    _renderAdminTareas() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        const materias = this.colegio.notas.materias;
        const bimestres = [1,2,3,4];
        this.tareasFiltro = { grado: null, materia: null };
        this.mainContent.innerHTML = `
            <h2 class="section-title">📚 Gestión de Tareas (Ciclo ${this.cicloActual})</h2>
            <div class="toolbar">
                <button class="btn btn-secondary" id="btnFiltrarTareas">🔍 Filtrar Tareas</button>
                <button class="btn btn-warning" id="btnMostrarTodasTareas">📋 Mostrar todas</button>
            </div>
            <div class="card"><h3>Crear Tarea</h3><div class="form-grid">
                <input id="titulo" placeholder="Título">
                <textarea id="descripcion" placeholder="Descripción"></textarea>
                <select id="materiaTarea">${materias.map(m=>`<option>${m}</option>`).join('')}</select>
                <select id="gradoTarea">${grados.map(g=>`<option>${g}</option>`).join('')}</select>
                <select id="bimestreTarea">${bimestres.map(b=>`<option value="${b}">Bimestre ${b}</option>`).join('')}</select>
                <input type="date" id="fechaEntrega">
                <input type="number" id="puntajeMaximo" placeholder="Puntaje máximo" value="10" step="0.01" min="0">
                <button class="btn btn-success" id="btnCrearTarea">➕ Crear</button>
            </div></div>
            <div class="card"><h3>Tareas Activas</h3><div id="listaTareas"></div></div>
        `;
        document.getElementById('btnFiltrarTareas').addEventListener('click', () => this._mostrarModalFiltroTareas());
        document.getElementById('btnMostrarTodasTareas').addEventListener('click', () => {
            this.tareasFiltro = { grado: null, materia: null };
            this._cargarListaTareas();
        });
        document.getElementById('btnCrearTarea').onclick = () => {
            let t = document.getElementById('titulo').value;
            let d = document.getElementById('descripcion').value;
            let m = document.getElementById('materiaTarea').value;
            let g = document.getElementById('gradoTarea').value;
            let bim = parseInt(document.getElementById('bimestreTarea').value);
            let f = document.getElementById('fechaEntrega').value;
            let puntaje = parseFloat(document.getElementById('puntajeMaximo').value);
            if (isNaN(puntaje)) puntaje = 10;
            if (t && d && m && g && bim && f) {
                this.colegio.crearTarea(t, d, m, g, this.cicloActual, bim, f, this.sesion.usuario?.nombreCompleto || 'Admin', puntaje);
                Swal.fire('Creada', 'Tarea asignada correctamente', 'success');
                document.getElementById('titulo').value = '';
                document.getElementById('descripcion').value = '';
                document.getElementById('fechaEntrega').value = '';
                document.getElementById('puntajeMaximo').value = '10';
                this._cargarListaTareas();
            } else Swal.fire('Error', 'Complete todos los campos', 'error');
        };
        this._cargarListaTareas();
    }
    
    _mostrarModalFiltroTareas() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        const materias = this.colegio.notas.materias;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal-card" style="max-width:500px;">
                <div class="modal-header">
                    <h3>Filtrar Tareas</h3>
                    <button class="btn-close-modal">&times;</button>
                </div>
                <div class="form-group"><label>Grado</label><select id="filtroGrado"><option value="">Todos</option>${grados.map(g=>`<option>${g}</option>`).join('')}</select></div>
                <div class="form-group"><label>Materia</label><select id="filtroMateria"><option value="">Todas</option>${materias.map(m=>`<option>${m}</option>`).join('')}</select></div>
                <div class="modal-footer">
                    <button class="btn btn-secondary cerrar-modal">Cancelar</button>
                    <button class="btn btn-primary" id="btnAplicarFiltro">Aplicar filtro</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const closeModal = () => overlay.remove();
        overlay.querySelector('.btn-close-modal').addEventListener('click', closeModal);
        overlay.querySelector('.cerrar-modal').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        document.getElementById('btnAplicarFiltro').addEventListener('click', () => {
            const grado = document.getElementById('filtroGrado').value;
            const materia = document.getElementById('filtroMateria').value;
            this.tareasFiltro = { grado: grado || null, materia: materia || null };
            this._cargarListaTareas();
            closeModal();
        });
    }
    
    _cargarListaTareas() {
        let tareasFiltradas = this.colegio.tareas.filter(t => t.cicloEscolar === this.cicloActual);
        if (this.tareasFiltro.grado) tareasFiltradas = tareasFiltradas.filter(t => t.grado === this.tareasFiltro.grado);
        if (this.tareasFiltro.materia) tareasFiltradas = tareasFiltradas.filter(t => t.materia === this.tareasFiltro.materia);
        const container = document.getElementById('listaTareas');
        if (!container) return;
        container.innerHTML = tareasFiltradas.map(t => `
            <div style="border:1px solid #ddd; margin:10px; padding:10px;">
                <b>${t.titulo}</b> - ${t.materia} (${t.grado}) - Bimestre ${t.bimestre} - Puntaje máximo: ${t.puntajeMaximo}<br>
                ${t.descripcion}<br>
                📅 Entrega: ${t.fechaEntrega}<br>
                <button class="btn btn-sm btn-primary ver-entregas" data-id="${t.id}">📋 Ver Entregas</button>
                <button class="btn btn-sm btn-danger eliminar-tarea" data-id="${t.id}">🗑️ Eliminar</button>
            </div>
        `).join('');
        document.querySelectorAll('.eliminar-tarea').forEach(btn => btn.addEventListener('click', () => {
            this.colegio.eliminarTarea(parseInt(btn.dataset.id));
            this._cargarListaTareas();
        }));
        document.querySelectorAll('.ver-entregas').forEach(btn => btn.addEventListener('click', () => this._mostrarEntregas(parseInt(btn.dataset.id))));
    }
    
   _mostrarEntregas(tareaId) {
        const tarea = this.colegio.tareas.find(t => t.id === tareaId);
        const entregas = this.colegio.getEntregasPorTarea(tareaId);
        const alumnos = this.colegio.getAlumnosFiltrados(tarea.grado, this.cicloActual);
        const modal = document.getElementById('modalEntregas');
        const content = document.getElementById('entregasContent');

        let html = `
            <p><strong>${tarea.titulo}</strong> (${tarea.materia}, Bimestre ${tarea.bimestre}) - Puntaje máximo: ${tarea.puntajeMaximo}</p>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Alumno</th>
                            <th>Archivo</th>
                            <th>Calificación</th>
                            <th>Comentario</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>`;

        alumnos.forEach(alumno => {
            const entrega = entregas.find(e => e.alumnoId === alumno.id);
            html += `
                <tr data-alumno="${alumno.id}">
                    <td>${alumno.nombreCompleto}</td>
                    <td>
                        ${entrega ? `<a href="#" class="ver-pdf" data-data="${entrega.archivoData}" data-nombre="${entrega.archivoNombre}">📄 ${entrega.archivoNombre}</a>` : '<span class="text-muted">No entregado</span>'}
                    </td>
                    <td>
                        <input type="number" id="calf-${alumno.id}" 
                            value="${entrega ? (entrega.calificacion || '') : ''}" 
                            step="0.01" min="0" max="${tarea.puntajeMaximo}" 
                            class="form-control" style="width:80px;">
                    </td>
                    <td>
                        <input type="text" id="com-${alumno.id}" 
                            value="${entrega ? (entrega.comentario || '') : ''}" 
                            placeholder="Comentario" class="form-control">
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary calificar-btn" 
                            data-alumno="${alumno.id}" data-tarea="${tareaId}">
                            Guardar
                        </button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
        content.innerHTML = html;

        document.querySelectorAll('.calificar-btn').forEach(btn => {
            btn.onclick = async () => {
                const alumnoId = parseInt(btn.dataset.alumno);
                const tId = parseInt(btn.dataset.tarea);
                const calificacion = parseFloat(document.getElementById(`calf-${alumnoId}`).value);
                const comentario = document.getElementById(`com-${alumnoId}`).value;

                const entregaExistente = this.colegio.entregas.find(e => e.tareaId === tId && e.alumnoId === alumnoId);

                if (entregaExistente) {
                    this.colegio.calificarEntrega(entregaExistente.id, calificacion, comentario);
                    Swal.fire('Calificación guardada', '', 'success');
                    this._mostrarEntregas(tareaId);
                } else {
                    Swal.fire('Error', 'El alumno aún no ha entregado la tarea', 'error');
                }
            };
        });

        document.querySelectorAll('.ver-pdf').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                const data = link.dataset.data;
                const binary = atob(data);
                const array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
                const blob = new Blob([array], { type: 'application/pdf' });
                window.open(URL.createObjectURL(blob));
            };
        });

        modal.style.display = 'flex';
        document.getElementById('btnCerrarModalEntregas').onclick = () => modal.style.display = 'none';
        modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
    }


    _renderEstudianteTareas() {
        const alumno = this.sesion.usuario;
        const tareas = this.colegio.tareas.filter(t => t.grado === alumno.grado && t.cicloEscolar === alumno.cicloEscolar);
        const entregas = this.colegio.getEntregasPorAlumno(alumno.id);
        this.mainContent.innerHTML = `<h2 class="section-title">📚 Mis Tareas</h2><div class="card">${tareas.map(t => {
            const entrega = entregas.find(e => e.tareaId === t.id);
            return `<div style="border:1px solid #ddd; margin:15px 0; padding:15px; border-radius:8px;">
                        <h3>${t.titulo} (${t.materia} - Bimestre ${t.bimestre})</h3>
                        <p>${t.descripcion}</p>
                        <p><strong>Puntaje máximo:</strong> ${t.puntajeMaximo}</p>
                        <p><strong>Entrega:</strong> ${t.fechaEntrega}</p>
                        ${entrega ? `<p><strong>✅ Entregada</strong> - Calificación: ${entrega.calificacion !== null ? entrega.calificacion : 'Pendiente'}</p>
                                    ${entrega.comentario ? `<p><em>Comentario: ${entrega.comentario}</em></p>` : ''}` :
                                    `<div class="upload-area"><input type="file" accept="application/pdf" id="file-${t.id}"><button class="btn btn-success btn-sm" data-tarea="${t.id}">📤 Subir PDF</button></div>`}
                    </div>`;
        }).join('')}${tareas.length === 0 ? '<p>No hay tareas asignadas.</p>' : ''}</div>`;
        document.querySelectorAll('[data-tarea]').forEach(btn => btn.addEventListener('click', () => {
            const tareaId = parseInt(btn.dataset.tarea);
            const fileInput = document.getElementById(`file-${tareaId}`);
            if (!fileInput.files.length) return Swal.fire('Error', 'Seleccione un PDF', 'error');
            const file = fileInput.files[0];
            if (file.type !== 'application/pdf') return Swal.fire('Error', 'Solo PDF', 'error');
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result.split(',')[1];
                this.colegio.entregarTarea(tareaId, alumno.id, file.name, base64);
                Swal.fire('Entregado', 'Tarea enviada', 'success');
                this._renderEstudianteTareas();
            };
            reader.readAsDataURL(file);
        }));
    }

    _renderNotas() {
        const bimestres = ['Bimestre 1','Bimestre 2','Bimestre 3','Bimestre 4'];
        const esMaestro = this.sesion.esMaestro;
        const maestro = esMaestro ? this.sesion.usuario : null;
        const gradosDisponibles = esMaestro ? Object.keys(maestro.asignaciones) : ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `<h2 class="section-title">🎓 Registro General de Notas (Ciclo ${this.cicloActual})</h2><div class="toolbar"><select id="notasBimestre">${bimestres.map(b => `<option>${b}</option>`).join('')}</select><select id="notasGrado">${gradosDisponibles.map(g => `<option>${g}</option>`).join('')}</select>${!esMaestro ? `<input type="text" id="notasNuevaMateria" placeholder="Nueva materia"><button class="btn btn-primary" id="btnAgregarMateria">➕</button><button class="btn btn-danger" id="btnEliminarMateria">🗑️</button>` : ''}</div><div class="table-container"><table id="tablaNotas"><tr></div>`;
        const selectBimestre = document.getElementById('notasBimestre'), selectGrado = document.getElementById('notasGrado'), self = this;
        const renderTabla = () => { const bimestre = selectBimestre.value, grado = selectGrado.value, alumnos = self.colegio.getAlumnosFiltrados(grado, self.cicloActual), materias = self.colegio.notas.materias; let html = `<thead><tr><th>No. Clave</th><th>Alumno</th>${materias.map(m=>`<th>${m}</th>`).join('')}<th>Promedio</th></tr></thead><tbody>`; alumnos.forEach(a => { let suma=0, count=0; const celdas = materias.map(mat => { const editable = !esMaestro || (maestro && maestro.tienePermiso(grado, mat)); const val = self.colegio.notas.getNota(a.id, bimestre, mat); if(val>0){ suma+=val; count++; } return `<td><input type="number" min="0" max="100" value="${val}" class="input-nota" data-id="${a.id}" data-mat="${mat}" style="width:70px; ${!editable ? 'background:#e0e0e0; pointer-events:none;' : ''}" ${!editable ? 'disabled' : ''} step="0.01"></td>`; }).join(''); const prom = count>0 ? +(suma/count).toFixed(2) : 0; html += `<tr><td style="text-align:center;">${a.clave}</td><td>${a.nombreCompleto}</td>${celdas}<td style="text-align:center; font-weight:bold;">${prom}</td></tr>`; }); html += `</tbody>`; document.getElementById('tablaNotas').innerHTML = html; document.querySelectorAll('.input-nota:not([disabled])').forEach(input => input.addEventListener('change', function() { const fila = this.closest('tr'); let suma=0, count=0; fila.querySelectorAll('.input-nota:not([disabled])').forEach(inp => { const v = parseFloat(inp.value)||0; if(v>0){ suma+=v; count++; } }); const prom = count>0 ? +(suma/count).toFixed(2) : 0; fila.querySelector('td:last-child').innerHTML = `<strong>${prom}</strong>`; const idAlumno = parseInt(this.dataset.id); const materia = this.dataset.mat; let val = parseFloat(this.value); if(isNaN(val)) val=0; val = Math.min(100,Math.max(0,val)); this.value = val; self.colegio.notas.setNota(idAlumno, selectBimestre.value, materia, val); })); }; selectBimestre.addEventListener('change', renderTabla); selectGrado.addEventListener('change', renderTabla); if(!esMaestro){ document.getElementById('btnAgregarMateria').onclick=()=>{ let n=document.getElementById('notasNuevaMateria').value.trim(); if(n && self.colegio.notas.agregarMateria(n)) renderTabla(); }; document.getElementById('btnEliminarMateria').onclick=async()=>{ if(self.colegio.notas.materias.length<=1) return Swal.fire('Error','Debe haber al menos una materia','error'); const r=await Swal.fire({title:'¿Eliminar última materia?',text:'Se perderán las notas',icon:'warning',showCancelButton:true}); if(r.isConfirmed){ self.colegio.notas.eliminarUltimaMateria(); renderTabla(); } }; } renderTabla(); }

    _renderEstudiantePagos() {
        if (!this.sesion.esAlumno) return;
        const alumno = this.sesion.usuario;
        const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct'];
        const cuota = this.colegio.config.cuotaMensual;
        const deuda = alumno.pagos.filter(p => !p).length * cuota;
        this.mainContent.innerHTML = `<h2 class="section-title">💰 Mis Pagos</h2><div class="card"><p><strong>${alumno.nombreCompleto}</strong> | Código: ${alumno.codigo} | Grado: ${alumno.grado} | Ciclo: ${alumno.cicloEscolar}</p><table><thead><tr><th>Mes</th><th>Estado</th><th>Deuda</th></tr></thead><tbody>${meses.map((m,i) => `<tr><td>${m}</td><td>${alumno.pagos[i]?'✅ Pagado':'❌ Pendiente'}</td><td>${alumno.pagos[i]?'Q0.00':`Q${cuota}`}</tr>`).join('')}</tbody></table><p style="margin-top:15px; font-weight:bold;">Deuda total: Q${deuda}</p></div>`;
    }

    _renderEstudianteExtras() {
        if (!this.sesion.esAlumno) return;
        const alumno = this.sesion.usuario;
        const items = this.colegio.config.extrasItems;
        let totalPendiente = 0;
        const filas = items.map(item => {
            const abonado = alumno.extrasPagados[item.nombre] || 0;
            const pendiente = item.montoTotal - abonado;
            totalPendiente += pendiente;
            return `<tr><td>${item.nombre}</td><td>Q${item.montoTotal.toFixed(2)}</td><td>Q${abonado.toFixed(2)}</td><td>${pendiente <= 0 ? '✅ Pagado' : '❌ Pendiente'}</td></tr>`;
        }).join('');
        this.mainContent.innerHTML = `<h2 class="section-title">📦 Pagos Adicionales</h2><div class="card"><p><strong>${alumno.nombreCompleto}</strong> | Código: ${alumno.codigo}</p><table><thead><tr><th>Concepto</th><th>Monto total</th><th>Abonado</th><th>Estado</th></tr></thead><tbody>${filas || '<tr><td colspan="4">No hay conceptos adicionales.</td></tr>'}</tbody></table><p style="margin-top:15px; font-weight:bold;">Total pendiente: Q${totalPendiente.toFixed(2)}</p></div>`;
    }
    
    _renderEstudianteNotas() {
        if (!this.sesion.esAlumno) return;
        const alumno = this.sesion.usuario;
        const mesActual = Math.min(new Date().getMonth(), 9);
        const mesesNombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct'];
        const estaSolvente = alumno.pagos[mesActual] === true;
        if (!estaSolvente) {
            this.mainContent.innerHTML = `<h2 class="section-title">📄 Mis Notas</h2><div class="card" style="text-align:center; padding:40px;"><p style="font-size:1.2rem; color:#e74c3c;">🔒 No tienes acceso a tus notas.</p><p>Debes estar al día en el pago del mes de <strong>${mesesNombres[mesActual]}</strong>.</p></div>`;
            return;
        }
        this.mainContent.innerHTML = `<h2 class="section-title">📄 Mis Notas</h2><div class="card" style="text-align:center;"><p><strong>${alumno.nombreCompleto}</strong> | Grado: ${alumno.grado} | Ciclo: ${alumno.cicloEscolar}</p><div style="margin-top:20px; display:flex; gap:10px; justify-content:center;"><button class="btn btn-primary" id="btnVerMisNotas">👁 Ver Notas</button><button class="btn btn-success" id="btnImprimirMisNotas">🖨 Imprimir</button></div><div id="misNotasPreview" style="margin-top:20px;"></div></div>`;
        document.getElementById('btnVerMisNotas').addEventListener('click', () => this._mostrarBoletaModal(alumno.id));
        document.getElementById('btnImprimirMisNotas').addEventListener('click', () => this._imprimirBoleta(alumno.id));
    }

    _renderPagoOnline() {
        const alumno = this.sesion.usuario;
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre'];
        const cuota = this.colegio.config.cuotaMensual;
        const pendientes = meses.map((m, i) => alumno.pagos[i] ? null : { mes: m, index: i, monto: cuota }).filter(p => p);

        this.mainContent.innerHTML = `
            <h2 class="section-title">💳 Pagar Mensualidad en Línea</h2>
            <div class="card">
                ${pendientes.length ? pendientes.map(p => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                        <span><strong>${p.mes}</strong> - Q${p.monto.toFixed(2)}</span>
                        <button class="btn btn-primary pagar-btn" data-mes="${p.index}" data-monto="${p.monto}">Pagar ahora</button>
                    </div>
                `).join('') : '<p>✅ No tiene mensualidades pendientes.</p>'}
            </div>
        `;

        document.querySelectorAll('.pagar-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const mesIndex = parseInt(btn.dataset.mes);
                const monto = parseFloat(btn.dataset.monto);

                const { value: form } = await Swal.fire({
                    title: '💳 Pago con Tarjeta',
                    html: `
                        <div style="text-align:left;">
                            <label>Número de tarjeta</label>
                            <input id="cardNumber" class="swal2-input" placeholder="4111 1111 1111 1111">
                            <label>CVV</label>
                            <input id="cvv" class="swal2-input" placeholder="123">
                            <label>Fecha vencimiento</label>
                            <input id="expiry" class="swal2-input" placeholder="MM/AA">
                        </div>
                    `,
                    focusConfirm: false,
                    preConfirm: () => {
                        return {
                            card: document.getElementById('cardNumber').value,
                            cvv: document.getElementById('cvv').value,
                            expiry: document.getElementById('expiry').value
                        };
                    }
                });

                if (form) {
                    const encryptedData = btoa(JSON.stringify({
                        card: form.card.slice(-4),
                        amount: monto,
                        timestamp: Date.now()
                    }));

                    const pago = this.colegio.registrarPagoOnline(alumno.id, alumno.cicloEscolar, mesIndex, monto);
                    if (pago) {
                        const recibo = `
==========================================
    COLEGIO MIXTO BELÉN
    RECIBO DE PAGO EN LÍNEA
==========================================
Correlativo: ${pago.correlativo}
Alumno: ${alumno.nombreCompleto}
Código: ${alumno.codigo}
Mes pagado: ${meses[mesIndex]}
Monto: Q${monto.toFixed(2)}
Fecha: ${new Date().toLocaleString()}
Transacción encriptada: ${encryptedData.substring(0, 20)}...
==========================================
        ¡Gracias por su pago!
                        `;
                        this._mostrarRecibo(recibo);
                        Swal.fire('Éxito', 'Pago registrado correctamente', 'success');
                        this._renderPagoOnline();
                    } else {
                        Swal.fire('Error', 'Ya has pagado este mes', 'error');
                    }
                }
            });
        });
    }

    _mostrarRecibo(texto) {
        const modal = document.getElementById('modalRecibo');
        document.getElementById('reciboContenido').innerText = texto;
        modal.style.display = 'flex';
        document.getElementById('btnCerrarRecibo').onclick = () => modal.style.display = 'none';
        document.getElementById('btnImprimirRecibo').onclick = () => {
            const ventana = window.open('', '_blank');
            ventana.document.write(`<pre style="font-family:monospace;">${texto}</pre>`);
            ventana.print();
        };
        document.getElementById('btnCerrarModal').onclick = () => modal.style.display = 'none';
    }

    _mostrarReciboModal(texto) {
        const modal = document.getElementById('modalRecibo');
        document.getElementById('reciboContenido').innerText = texto;
        modal.style.display = 'flex';
        document.getElementById('btnCerrarRecibo').onclick = () => modal.style.display = 'none';
        document.getElementById('btnImprimirRecibo').onclick = () => {
            const ventana = window.open('', '_blank');
            ventana.document.write(`<pre style="font-family:monospace;">${texto}</pre>`);
            ventana.print();
        };
        document.getElementById('btnCerrarModal').onclick = () => modal.style.display = 'none';
    }


    _mostrarModalEstadoPagosAdicionales() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';
        const items = this.colegio.config.extrasItems;
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        
        let selectConceptoHTML = `<select id="modalConcepto">`;
        items.forEach(it => selectConceptoHTML += `<option value="${it.nombre}">${it.nombre}</option>`);
        selectConceptoHTML += `</select>`;

        overlay.innerHTML = `
            <div class="modal-card" style="max-width:800px; width:95%;">
                <div class="modal-header">
                    <h3>👥 Estado de Pagos Adicionales</h3>
                    <button class="btn-close-modal">&times;</button>
                </div>
                <div class="toolbar" style="margin-bottom: 20px;">
                    <label>Concepto:</label> ${selectConceptoHTML}
                    <label style="margin-left:15px;">Grado:</label>
                    <select id="modalGrado">
                        ${grados.map(g => `<option value="${g}">${g}</option>`).join('')}
                    </select>
                </div>
                <div id="modalEstadoTabla" class="table-container" style="max-height: 40vh; overflow-y: auto;">
                </div>
                <div class="modal-footer" style="margin-top:20px;">
                    <button class="btn btn-secondary cerrar-modal">Cerrar</button>
                    <button class="btn btn-success" id="btnImprimirEstado">🖨 Imprimir Listado</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const actualizarTabla = () => {
            const concepto = document.getElementById('modalConcepto').value;
            const grado = document.getElementById('modalGrado').value;
            const item = this.colegio.config.extrasItems.find(i => i.nombre === concepto);
            if (!item) return;

            const alumnos = this.colegio.getAlumnosFiltrados(grado, this.cicloActual);
            
            let html = `<table style="width:100%; border-collapse: collapse;">
                <thead><tr><th>No. Clave</th><th>Alumno</th><th>Abonado (Q)</th><th>Pendiente (Q)</th><th>Estado</th><th>Abonar</th></tr></thead><tbody>`;
            
            alumnos.forEach(a => {
                const abonado = a.extrasPagados[concepto] || 0;
                const pendiente = item.montoTotal - abonado;
                const estadoText = pendiente <= 0 ? 'Al día' : 'Pendiente';
                const estadoClass = pendiente <= 0 ? 'badge-activo' : 'badge-suspendido';

                html += `<tr>
                    <td style="text-align:center;">${a.clave}</td>
                    <td>${a.nombreCompleto}</td>
                    <td style="text-align:center;">Q${abonado.toFixed(2)}</td>
                    <td style="text-align:center;">Q${Math.max(0, pendiente).toFixed(2)}</td>
                    <td style="text-align:center;"><span class="badge ${estadoClass}">${estadoText}</span></td>
                    <td style="text-align:center;">
                        ${pendiente > 0 ? `<button class="btn btn-sm btn-primary btn-abonar" data-id="${a.id}">Abonar</button>` : '---'}
                    </td>
                </tr>`;
            });
            html += `</tbody></table>`;
            document.getElementById('modalEstadoTabla').innerHTML = html;

            document.querySelectorAll('.btn-abonar').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const idAlumno = parseInt(btn.dataset.id);
                    const alumno = this.colegio.getAlumnoPorId(idAlumno);
                    const pen = item.montoTotal - (alumno.extrasPagados[concepto] || 0);

                    const { value: montoAbono } = await Swal.fire({
                        title: `Abonar a ${concepto}`,
                        text: `${alumno.nombreCompleto} (Pendiente: Q${pen.toFixed(2)})`,
                        input: 'number',
                        inputAttributes: { min: 1, max: pen, step: 'any' },
                        inputPlaceholder: 'Monto a abonar',
                        showCancelButton: true
                    });

                    if (montoAbono) {
                        const cant = parseFloat(montoAbono);
                        if (cant > 0 && cant <= pen) {
                            if (this.colegio.registrarAbonoExtra(idAlumno, concepto, cant)) {
                                Swal.fire('Éxito', `Abono de Q${cant} registrado correctamente.`, 'success');
                                actualizarTabla();
                                
                                const ventana = window.open('', 'Recibo', 'width=400,height=600');
                                ventana.document.write(`
                                    <html><head><title>Recibo Extra</title>
                                    <style>body{font-family:monospace;padding:20px;}.logo-container{text-align:right;}img{max-width:100px;}pre{text-align:left;}</style></head>
                                    <body><div class="logo-container"><img src="logo.jpeg" alt="Logo"></div><pre>
==========================================
        COLEGIO MIXTO BELÉN
      RECIBO DE PAGO ADICIONAL
==========================================
Alumno: ${alumno.nombreCompleto}
Grado: ${alumno.grado}   Ciclo: ${alumno.cicloEscolar}
------------------------------------------
Concepto: ${concepto}
Monto Abonado: Q${cant.toFixed(2)}
Saldo Restante: Q${(pen - cant).toFixed(2)}
------------------------------------------
Fecha: ${new Date().toLocaleString()}
==========================================
        ¡Gracias por su pago!
                                    </pre><script>window.print();<\/script></body></html>
                                `);
                            }
                        } else {
                            Swal.fire('Error', 'Monto inválido', 'error');
                        }
                    }
                });
            });
        };

        const modalConcepto = document.getElementById('modalConcepto');
        const modalGrado = document.getElementById('modalGrado');

        if (modalConcepto) modalConcepto.addEventListener('change', actualizarTabla);
        if (modalGrado) modalGrado.addEventListener('change', actualizarTabla);

        actualizarTabla();

        document.getElementById('btnImprimirEstado').addEventListener('click', () => {
            const concepto = document.getElementById('modalConcepto').value;
            const grado = document.getElementById('modalGrado').value;
            const tablaConfig = document.getElementById('modalEstadoTabla').innerHTML;
            const ventana = window.open('', '_blank');
            ventana.document.write(`
                <html><head><title>Estado Pagos Extras</title>
                <style>body{font-family:sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border:1px solid #ccc;padding:8px;text-align:center;} th{background:#1a5276;color:white;} .badge{padding:3px 8px;border-radius:10px;font-size:12px;}</style>
                </head><body>
                <h2>COLEGIO MIXTO BELÉN</h2>
                <h3>Estado de pago - Concepto: ${concepto}</h3>
                <p>Grado: ${grado} | Ciclo: ${this.cicloActual}</p>
                ${tablaConfig.replace(/<td.*?>.*?<button.*?>.*?<\/td>/g, '')}
                <script>window.print();<\/script>
                </body></html>
            `);
        });

        const closeModal = () => overlay.remove();
        overlay.querySelector('.btn-close-modal').addEventListener('click', closeModal);
        overlay.querySelector('.cerrar-modal').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    }

    _renderEstadisticasAlumno() {
        if (!this.sesion.esAlumno) return;
        const alumno = this.sesion.usuario;
        const rendimiento = this.colegio.obtenerRendimientoPorMaterias(alumno.id);

        this.mainContent.innerHTML = `
            <h2 class="section-title">📊 Mi Rendimiento Académico</h2>
            <div class="card">
                <canvas id="miRendimientoChart" style="max-width:500px; margin:0 auto;"></canvas>
            </div>
            <div class="card" style="margin-top: 20px;">
                <h3>Mis Logros y Medallas</h3>
                <div id="logrosContainer" style="display:flex; gap:15px; flex-wrap:wrap; margin-top:15px;"></div>
            </div>
        `;

        const labels = Object.keys(rendimiento);
        const data = Object.values(rendimiento);

        if (labels.length) {
            const canvas = document.getElementById('miRendimientoChart');
            new Chart(canvas, {
                type: 'pie',
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: ['#e74c3c', '#8e44ad', '#3498db', '#e67e22', '#2ecc71', '#f1c40f']
                    }]
                }
            });

            // Lógica simple de logros
            const logrosContainer = document.getElementById('logrosContainer');
            let logrosHTML = '';
            const promedioGeneral = data.length ? data.reduce((a,b)=>a+b,0)/data.length : 0;
            
            if (promedioGeneral >= 90) logrosHTML += `<div style="text-align:center; padding:10px; border:1px solid #ddd; border-radius:8px;">🏆<br><b>Excelencia</b><br><small>>90Pts</small></div>`;
            const perfectMate = (rendimiento['Matemática'] && rendimiento['Matemática'] === 100);
            if (perfectMate) logrosHTML += `<div style="text-align:center; padding:10px; border:1px solid #ddd; border-radius:8px;">🔢<br><b>Genio Matemático</b><br><small>100 pts</small></div>`;
            
            const todasAprobadas = data.every(v => v >= 60);
            if (todasAprobadas && data.length > 0) logrosHTML += `<div style="text-align:center; padding:10px; border:1px solid #ddd; border-radius:8px;">⭐<br><b>Todo Aprobado</b></div>`;

            if (!logrosHTML) logrosHTML = '<p>Aún no tienes medallas desbloqueadas. ¡Sigue esforzándote!</p>';
            logrosContainer.innerHTML = logrosHTML;

        } else {
            document.querySelector('#miRendimientoChart').parentElement.innerHTML = '<p>No hay notas registradas para generar el gráfico.</p>';
        }
    }
   
}

// ==================== INICIALIZACIÓN ====================
async function inicializarApp() {
    await StorageManager.syncFromFirebase();

    const colegio = new Colegio();
    colegio._syncContadores();
    const app = new UIColegio(colegio);
    window.app = app;
    window.colegio = colegio;

    if (colegio.maestros.length === 0) {
        const m = colegio.agregarMaestro('maestro', '1234', 'Juan', 'Pérez');
        if (m) {
            m.asignaciones = { 'Primero': ['Matemática', 'Comunicación'], 'Segundo': ['Matemática'] };
            colegio.guardarMaestros();
        }
    }
}

inicializarApp();

