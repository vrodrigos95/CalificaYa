import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buscarAlumno, coincidencias, filasDeExcel, interpretarFilas, leerListaAlumnos, parsearCSV, plantillaAlumnos, PLANTILLA_COLUMNAS, type Alumno } from '../src/session/alumnos';

const porCodigo = (as: Alumno[]) => new Map(as.map((a) => [a.codigo, a.completo]));

const archivo = (name: string, data: ArrayBuffer | Uint8Array) => ({ name, arrayBuffer: async () => (data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data) as ArrayBuffer });

describe('lista de alumnos', () => {
  it('CSV con encabezado, comillas y punto y coma', () => {
    const csv = '﻿Código;Nombre\r\n219000001;"López, Ana"\r\n219000002;Beto Ruiz\r\n';
    const { alumnos, advertencias } = interpretarFilas(parsearCSV(csv));
    expect([...porCodigo(alumnos)]).toEqual([['219000001', 'López, Ana'], ['219000002', 'Beto Ruiz']]);
    expect(advertencias).toEqual([]);
  });

  it('sin encabezado: primera columna numérica es el código', () => {
    const { alumnos } = interpretarFilas(parsearCSV('219000001,Ana López\n219000002,Beto Ruiz\n'));
    expect(porCodigo(alumnos).get('219000002')).toBe('Beto Ruiz');
  });

  it('nombre en varias columnas (apellidos) y columnas extra', () => {
    const filas = parsearCSV('No.,Matrícula,Apellido paterno,Apellido materno,Nombre(s),Grupo\n1,219000001,López,García,Ana,3BM\n2,219000002,Ruiz,,Beto,3BM\n');
    const { alumnos } = interpretarFilas(filas);
    expect(porCodigo(alumnos).get('219000001')).toBe('López García Ana');
    expect(porCodigo(alumnos).get('219000002')).toBe('Ruiz Beto');
    expect(alumnos[0]).toMatchObject({ lista: '1', nombre: 'Ana', apellidos: 'López García' });
  });

  it('Excel (.xlsx) con título arriba y códigos numéricos', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Lista');
    ws.addRow(['Lista de asistencia 3BM']);
    ws.addRow([]);
    ws.addRow(['Código', 'Nombre del alumno']);
    ws.addRow([219000001, 'Ana López']);
    ws.addRow([219000002, 'Beto Ruiz']);
    const buf = new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer);
    expect((await filasDeExcel(buf.buffer as ArrayBuffer, ExcelJS)).length).toBe(4);
    const { alumnos } = await leerListaAlumnos(archivo('lista.xlsx', buf));
    expect(porCodigo(alumnos).get('219000001')).toBe('Ana López');
    expect(alumnos.length).toBe(2);
  });

  it('CSV en codificación de Windows (acentos)', async () => {
    const bytes = new Uint8Array([...'219000001,Mar'].map((c) => c.charCodeAt(0)).concat([0xed, 0x61])); // "María" en windows-1252
    const { alumnos } = await leerListaAlumnos(archivo('lista.csv', bytes));
    expect(porCodigo(alumnos).get('219000001')).toBe('María');
  });

  it('rechaza .xls antiguo con un mensaje claro', async () => {
    const r = await leerListaAlumnos(archivo('lista.xls', new Uint8Array(4)));
    expect(r.alumnos.length).toBe(0);
    expect(r.advertencias[0]).toContain('.xlsx');
  });

  it('buscar alumno: exacto, ceros a la izquierda y final de código (hoja de 5 dígitos)', () => {
    const { alumnos: lista } = interpretarFilas([['Código', 'Nombre'], ['219000001', 'Ana'], ['219012345', 'Beto'], ['218012345', 'Carla'], ['007', 'Dani']]);
    expect(buscarAlumno('219000001', lista)?.completo).toBe('Ana');
    expect(buscarAlumno('7', lista)?.completo).toBe('Dani');
    expect(buscarAlumno('00001', lista)).toMatchObject({ codigo: '219000001', completo: 'Ana' });
    expect(buscarAlumno('12345', lista)).toBeNull(); // ambiguo: dos códigos terminan en 12345
    expect(buscarAlumno('2190?0001', lista)).toBeNull();
  });

  // Lista llenada con la plantilla de la app
  const plantilla = [
    PLANTILLA_COLUMNAS,
    ['1', 'Ana María', 'López García', '219000001'],
    ['2', 'Beto', 'Ruiz Pérez', '219000002'],
    ['3', 'Carla', 'López Soto', ''],
    ['4', 'José', 'Núñez', '219000004'],
    ['5', '', '', ''], // número de lista sin alumno: se ignora
  ];

  it('plantilla: lee No. de lista, nombre, apellidos y código', () => {
    const { alumnos, advertencias } = interpretarFilas(plantilla);
    expect(advertencias).toEqual([]);
    expect(alumnos).toHaveLength(4);
    expect(alumnos[0]).toEqual({ id: '219000001', lista: '1', codigo: '219000001', nombre: 'Ana María', apellidos: 'López García', completo: 'Ana María López García' });
    expect(alumnos[2]).toMatchObject({ id: '#3', lista: '3', codigo: '' });
  });

  it('plantilla de Excel descargable con las columnas correctas', async () => {
    const buf = await plantillaAlumnos(ExcelJS);
    const filas = await filasDeExcel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, ExcelJS);
    expect(filas[0]).toEqual(PLANTILLA_COLUMNAS);
    expect(interpretarFilas(filas).alumnos).toEqual([]);
  });

  it('busca por código, número de lista, nombre o apellidos', () => {
    const { alumnos } = interpretarFilas(plantilla);
    const nombre = (t: string) => buscarAlumno(t, alumnos)?.completo;
    expect(nombre('219000002')).toBe('Beto Ruiz Pérez'); // código
    expect(nombre('3')).toBe('Carla López Soto'); // número de lista
    expect(nombre('03')).toBe('Carla López Soto');
    expect(nombre('beto')).toBe('Beto Ruiz Pérez'); // nombre, sin mayúsculas
    expect(nombre('Nuñez')).toBe('José Núñez'); // apellido, sin importar acentos
    expect(nombre('jose nunez')).toBe('José Núñez');
    expect(nombre('Ana Lopez')).toBe('Ana María López García'); // nombre + apellido
    expect(nombre('lopez g')).toBe('Ana María López García'); // inicio de palabras
    expect(nombre('López')).toBeUndefined(); // ambiguo: Ana y Carla
    expect(coincidencias('López', alumnos).map((a) => a.lista)).toEqual(['1', '3']);
    expect(nombre('Pedro')).toBeUndefined();
    expect(nombre('99')).toBeUndefined();
  });
});
