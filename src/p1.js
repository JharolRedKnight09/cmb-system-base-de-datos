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
    static cargar(clave, defecto = []) {
        const datos = localStorage.getItem(clave);
        return datos ? JSON.parse(datos) : defecto;
    }
    static guardar(clave, datos) {
        localStorage.setItem(clave, JSON.stringify(datos));
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
