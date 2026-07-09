"""
Utilidades compartidas entre TODOS los motores de reporte (MT, PMI, 570, 510,
Espesores...), igual que image_utils.py pero para lógica que no es de
imágenes. Extraído de report_engine_pmi.py el 2026-07-09 para estandarizar
un fix que solo tenía PMI (ver docs/04_GENERACION_REPORTES.md).
"""


def valor_tipado(valor):
    """Todo lo que llega de la API de Sheets es TEXTO, incluso los números
    (ej. "145", "69.5"). Escribir ese texto tal cual en una celda hace que
    Excel la trate como texto: se pierde el formato numérico ya definido en
    la plantilla (decimales, alineación...) y cualquier fórmula que
    referencie esa celda (promedios, tolerancias, %pérdida...) la ignora o
    falla — bug encontrado el 2026-07-08 en PMI ("los datos numéricos no
    salen con formato... las funciones no se ejecutan") y estandarizado el
    2026-07-09 a MT/570/510/Espesores, que tenían el mismo problema sin
    reportar. Si el texto es un número válido se convierte a int/float real;
    si no, se deja como texto tal cual (ej. "#NAME?" de una fórmula rota en
    el Sheet origen, o "N/R")."""
    if valor is None or isinstance(valor, (int, float)):
        return valor
    texto = str(valor).strip()
    if not texto:
        return valor
    try:
        numero = float(texto.replace(",", "."))
    except ValueError:
        return valor
    return int(numero) if numero.is_integer() else numero
