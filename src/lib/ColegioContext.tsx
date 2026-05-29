import React, { createContext, useContext, useState, useEffect } from 'react';
import { StorageManager } from './db';

// Modelo simplificado
export interface ColegioState {
  alumnos: any[];
  maestros: any[];
  tareas: any[];
  entregas: any[];
  config: any;
  notas: any;
  loading: boolean;
}

const emptyState: ColegioState = {
  alumnos: [],
  maestros: [],
  tareas: [],
  entregas: [],
  config: { cuotaMensual: 200, extrasItems: [] },
  notas: {  data: {}, materiasPorGrado: {} },
  loading: true,
};

const ColegioContext = createContext<{
  state: ColegioState;
  setState: React.Dispatch<React.SetStateAction<ColegioState>>;
  saveData: (key: string, data: any) => void;
}>({
  state: emptyState,
  setState: () => {},
  saveData: () => {},
});

export function ColegioProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ColegioState>(emptyState);

  useEffect(() => {
    async function loadData() {
      const alumnos = await StorageManager.cargar('colegio_alumnos', []);
      const maestros = await StorageManager.cargar('colegio_maestros', []);
      const tareas = await StorageManager.cargar('colegio_tareas', []);
      const entregas = await StorageManager.cargar('colegio_entregas', []);
      const config = await StorageManager.cargar('colegio_config', emptyState.config);
      const data = await StorageManager.cargar('colegio_notas', {});
      const materiasPorGrado = await StorageManager.cargar('colegio_materias_por_grado', {});

      setState({
        alumnos,
        maestros,
        tareas,
        entregas,
        config,
        notas: { data, materiasPorGrado },
        loading: false,
      });
    }
    loadData();
  }, []);

  const saveData = (key: string, data: any) => {
    StorageManager.guardar(key, data);
  };

  return (
    <ColegioContext.Provider value={{ state, setState, saveData }}>
      {children}
    </ColegioContext.Provider>
  );
}

export const useColegio = () => useContext(ColegioContext);
