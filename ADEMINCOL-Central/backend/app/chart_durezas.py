"""
Gráfico de dispersión Tensión (ksi) vs Punto para las durezas de un informe
PMI, con líneas de referencia de materiales estándar por tipo de elemento —
traducción a Python del script R (ggplot2) que el usuario corría manualmente
antes de subir el PNG a Drive y pegar el link en la columna `link_imagen_10`
(celda R202 de la plantilla, ver CELDAS_IMAGENES en report_engine_pmi.py).

Decisiones tomadas con el usuario el 2026-07-04:
- El "Elemento" (tipo de componente: CODO, TUBERIA, TAPA...) no se captura
  por punto de dureza en nuestro Sheet — siempre se asume TUBERIA.
- La tabla ELEMENTO (MATERIAL/FLUENCIA/TENSION/COLOR por tipo de componente)
  es un catálogo de ingeniería FIJO (normas API/ASME), no varía por proyecto
  — se hardcodea aquí en vez de vivir en una hoja editable.
"""
import io
import logging

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

logger = logging.getLogger("chart_durezas")

ELEMENTO_DEFAULT = "TUBERIA"

# (ELEMENTO, MATERIAL, FLUENCIA, TENSION, COLOR) — extraída el 2026-07-04 de
# la hoja 'ELEMENTO' de referencia provista por el usuario (AYACUCHO.xlsx).
TABLA_ELEMENTOS = [
    ("CODO", "A234 Gr WPB", 35, 60, "#A7B4C9"),
    ("CODO", "A860 WPHY 46", 46, 63, "#89AEE0"),
    ("CODO", "A860 WPHY 52", 52, 66, "#89AEE0"),
    ("CODO", "A860 WPHY 60", 60, 75, "#89AEE0"),
    ("CODO", "A860 WPHY 65", 65, 77, "#89AEE0"),
    ("CODO", "A860 WPHY 70", 70, 80, "#89AEE0"),
    ("RED", "A694 F42", 42, 60, "#395882"),
    ("RED", "A694 F48", 48, 62, "#395882"),
    ("RED", "A694 F52", 52, 66, "#395882"),
    ("RED", "A694 F56", 56, 68, "#395882"),
    ("RED", "A694 F60", 60, 75, "#395882"),
    ("RED", "A694 F65", 65, 77, "#395882"),
    ("RED", "A694 F70", 70, 82, "#395882"),
    ("TUBERIA", "X46", 46.4, 63.1, "#808080"),
    ("TUBERIA", "X52", 52.2, 66.7, "#808080"),
    ("TUBERIA", "X56", 56.6, 71.1, "#808080"),
    ("TUBERIA", "X60", 60.2, 75.4, "#A7B4C9"),
    ("TUBERIA", "X65", 65.3, 77.6, "#808080"),
    ("TUBERIA", "X70", 70.3, 82.7, "#808080"),
    ("TUBERIA", "A53 Gr B/A106 Gr B / X42", 36, 60, "#395882"),
    ("RED", "ASTM A105", 36, 70, "#9199AB"),
    ("RED", "A234 Gr WPB", 35, 60, "#A7B4C9"),
    ("WELDOLET", "ASTM A105", 36, 70, "#9199AB"),
    ("WELDOLET", "A694 F42", 42, 60, "#395882"),
    ("WELDOLET", "A694 F52", 52, 66, "#395882"),
    ("WELDOLET", "A694 F56", 56, 68, "#395882"),
    ("WELDOLET", "A694 F60", 60, 75, "#395882"),
    ("WELDOLET", "A694 F65", 65, 77, "#395882"),
    ("WELDOLET", "A694 F70", 70, 82, "#395882"),
    ("VAL", "A216 WCB Inf./ A105", 70, 70, "#395882"),
    ("VAL", "A216 WCB Sup.", 95, 95, "#395882"),
    ("TAPA", "A694 F42 / A694 F46", 42, 60, "#395882"),
    ("TAPA", "A694 F52", 52, 66, "#395882"),
    ("TAPA", "A694 F56", 56, 68, "#395882"),
    ("TAPA", "A694 F60", 60, 75, "#395882"),
    ("TAPA", "A694 F65", 65, 77, "#395882"),
    ("TAPA", "A694 F70", 70, 82, "#395882"),
    ("TAPA", "A105", 65, 70, "#89AEE0"),
    ("PULMON", "A283 Gr. C", 30, 55, "#89AEE0"),
    ("PULMON", "A283 Gr. C", 30, 75, "#89AEE0"),
    ("PULMON", "A53 Gr B / 516 Gr. 60", 36, 60, "#395882"),
    ("PULMON", "A516 Gr. 60", 52, 80, "#395882"),
]


def generar_grafico_durezas(valores_ksi: list[float], elemento: str = ELEMENTO_DEFAULT) -> bytes | None:
    """Genera el PNG (bytes) del gráfico Tensión vs Punto. Devuelve None si
    no hay al menos 2 valores numéricos (no se puede calcular Q1/Q3)."""
    valores = [v for v in valores_ksi if v is not None]
    if len(valores) < 2:
        return None

    puntos = list(range(1, len(valores) + 1))
    arr = np.array(valores, dtype=float)
    # numpy.percentile con interpolación 'linear' (default) coincide con el
    # type=7 de quantile() en R (también el default de R).
    q1, q3 = np.percentile(arr, [25, 75])
    iqr = q3 - q1
    lim_inf = q1 - 1.5 * iqr
    lim_sup = q3 + 1.5 * iqr

    # distinct(MATERIAL, TENSION, COLOR) del material del elemento pedido,
    # igual que `lineas_materiales` en el script R.
    vistos = set()
    materiales: list[tuple[str, float, str]] = []
    for elem, material, _fluencia, tension, color in TABLA_ELEMENTOS:
        if elem != elemento:
            continue
        key = (material, tension, color)
        if key in vistos:
            continue
        vistos.add(key)
        materiales.append((material, tension, color))

    # El script R solo separaba etiquetas con la MISMA tensión exacta
    # (seq(0, by=0.8)) — con datos reales, materiales de tensión CERCANA
    # pero distinta también se pisan (ver captura 2026-07-04). Se usa un
    # "escalerado" simple: ordenar por tensión y empujar hacia arriba
    # cualquier etiqueta que quede a menos de `separacion_min` de la
    # anterior, para que las 42 combinaciones del catálogo nunca se solapen
    # sin importar qué tan juntas estén sus tensiones nominales.
    orden = sorted(range(len(materiales)), key=lambda i: materiales[i][1])
    separacion_min = max(2.5, (lim_sup - lim_inf) * 0.035)
    y_final: dict[int, float] = {}
    ultimo_y = None
    for i in orden:
        tension = materiales[i][1]
        y = tension if ultimo_y is None else max(tension, ultimo_y + separacion_min)
        y_final[i] = y
        ultimo_y = y
    offsets = [y_final[i] - materiales[i][1] for i in range(len(materiales))]

    fig, ax = plt.subplots(figsize=(11, 5.2), dpi=150)
    ax.scatter(puntos, valores, color="#f8996d", s=30, zorder=3)

    x_izq = -max(2.0, len(puntos) * 0.18)
    ax.set_xlim(x_izq, len(puntos) + 0.6)
    x_etiqueta = x_izq + 0.15

    ax.axhline(lim_inf, color="red", linewidth=1.3, zorder=2)
    ax.axhline(lim_sup, color="red", linewidth=1.3, zorder=2)
    for y, texto in ((lim_inf, f"Lim. Inf. {lim_inf:.2f}"), (lim_sup, f"Lim. Sup. {lim_sup:.2f}")):
        ax.text(x_etiqueta, y, texto, fontsize=8, fontweight="bold", color="black",
                 va="bottom", ha="left",
                 bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="black", lw=0.6))

    for (material, tension, color), offset in zip(materiales, offsets):
        ax.axhline(tension, color=color, linestyle="--", linewidth=1.1, zorder=1)
        ax.text(x_etiqueta, tension + offset, material, fontsize=8.5, fontweight="bold",
                 color=color, va="center", ha="left",
                 bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.85))

    ax.set_xlabel("Punto")
    ax.set_ylabel("Resistencia a la tensión (Ksi)")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_facecolor("white")
    fig.patch.set_facecolor("white")

    buffer = io.BytesIO()
    try:
        fig.tight_layout()
        fig.savefig(buffer, format="png", facecolor="white")
    finally:
        plt.close(fig)
    return buffer.getvalue()
