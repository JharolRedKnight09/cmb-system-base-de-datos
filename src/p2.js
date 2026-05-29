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
