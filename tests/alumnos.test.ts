import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buscarAlumno, filasDeExcel, interpretarFilas, leerListaAlumnos, parsearCSV } from '../src/session/alumnos';

const archivo = (name: string, data: ArrayBuffer | Uint8Array) => ({ name, arrayBuffer: async () => (data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data) as ArrayBuffer });

describe('lista de alumnos', () => {
  it('CSV con encabezado, comillas y punto y coma', () => {
    const csv = '﻿Código;Nombre\r\n219000001;"López, Ana"\r\n219000002;Beto Ruiz\r\n';
    const { alumnos, advertencias } = interpretarFilas(parsearCSV(csv));
    expect([...alumnos]).toEqual([['219000001', 'López, Ana'], ['219000002', 'Beto Ruiz']]);
    expect(advertencias).toEqual([]);
  });

  it('sin encabezado: primera columna numérica es el código', () => {
    const { alumnos } = interpretarFilas(parsearCSV('219000001,Ana López\n219000002,Beto Ruiz\n'));
    expect(alumnos.get('219000002')).toBe('Beto Ruiz');
  });

  it('nombre en varias columnas (apellidos) y columnas extra', () => {
    const filas = parsearCSV('No.,Matrícula,Apellido paterno,Apellido materno,Nombre(s),Grupo\n1,219000001,López,García,Ana,3BM\n2,219000002,Ruiz,,Beto,3BM\n');
    const { alumnos } = interpretarFilas(filas);
    expect(alumnos.get('219000001')).toBe('López García Ana');
    expect(alumnos.get('219000002')).toBe('Ruiz Beto');
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
    expect(alumnos.get('219000001')).toBe('Ana López');
    expect(alumnos.size).toBe(2);
  });

  it('CSV en codificación de Windows (acentos)', async () => {
    const bytes = new Uint8Array([...'219000001,Mar'].map((c) => c.charCodeAt(0)).concat([0xed, 0x61])); // "María" en windows-1252
    const { alumnos } = await leerListaAlumnos(archivo('lista.csv', bytes));
    expect(alumnos.get('219000001')).toBe('María');
  });

  it('rechaza .xls antiguo con un mensaje claro', async () => {
    const r = await leerListaAlumnos(archivo('lista.xls', new Uint8Array(4)));
    expect(r.alumnos.size).toBe(0);
    expect(r.advertencias[0]).toContain('.xlsx');
  });

  it('buscar alumno: exacto, ceros a la izquierda y final de código (hoja de 5 dígitos)', () => {
    const lista = new Map([['219000001', 'Ana'], ['219012345', 'Beto'], ['218012345', 'Carla'], ['007', 'Dani']]);
    expect(buscarAlumno('219000001', lista)?.nombre).toBe('Ana');
    expect(buscarAlumno('7', lista)?.nombre).toBe('Dani');
    expect(buscarAlumno('00001', lista)).toMatchObject({ codigo: '219000001', nombre: 'Ana' });
    expect(buscarAlumno('12345', lista)).toBeNull(); // ambiguo: dos códigos terminan en 12345
    expect(buscarAlumno('2190?0001', lista)).toBeNull();
  });
});
