"""Tarjetas de presentación SMSTUDIO — generador de archivos para imprenta.

Formato: 90 x 50 mm (corte) + 3 mm de sangrado por lado.
- PDF vectorial en CMYK, textos convertidos a curvas (sin fuentes embebidas,
  la imprenta no puede sustituir tipografías) y QR vectorial.
- PNG 4K y 1200 dpi renderizados desde el mismo PDF.

Uso: python3 tarjetas/generar.py
"""
import os
import re
import subprocess

import qrcode
import uharfbuzz as hb
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from reportlab.lib.colors import CMYKColor
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "salida")
FONTS = "/usr/share/fonts/opentype/inter"

TRIM_W, TRIM_H = 90, 50   # mm
BLEED = 3                 # mm
MARK = 10                 # mm extra para marcas de corte

TELEFONO = "+54 9 2268 51-6801"
QR_URL = "https://wa.me/5492268516801"
INSTAGRAM = "@sebamoraddd"

# Colores CMYK (0..1). Negro enriquecido sólo para fondos; texto chico en K puro.
NEGRO_RICO = CMYKColor(0.60, 0.40, 0.40, 1.00)
NEGRO_K = CMYKColor(0, 0, 0, 1)
BLANCO = CMYKColor(0, 0, 0, 0)
HUESO = CMYKColor(0, 0.02, 0.06, 0)
CHAMPAGNE = CMYKColor(0, 0.18, 0.45, 0.20)
GRIS = CMYKColor(0, 0, 0, 0.62)


class Fuente:
    def __init__(self, archivo):
        ruta = os.path.join(FONTS, archivo)
        self.tt = TTFont(ruta)
        self.glyphs = self.tt.getGlyphSet()
        self.upem = self.tt["head"].unitsPerEm
        self.order = self.tt.getGlyphOrder()
        with open(ruta, "rb") as f:
            self.hb_font = hb.Font(hb.Face(f.read()))

    def shape(self, texto):
        buf = hb.Buffer()
        buf.add_str(texto)
        buf.guess_segment_properties()
        hb.shape(self.hb_font, buf, {"kern": True, "liga": True})
        return [(self.order[i.codepoint], p.x_advance) for i, p in zip(buf.glyph_infos, buf.glyph_positions)]


class PathPen(BasePen):
    """Pasa los contornos del glifo a un path de reportlab (curvas cúbicas)."""

    def __init__(self, glyphset, path, x, y, s):
        super().__init__(glyphset)
        self.p, self.x, self.y, self.s = path, x, y, s

    def _t(self, pt):
        return self.x + pt[0] * self.s, self.y + pt[1] * self.s

    def _moveTo(self, pt):
        self.p.moveTo(*self._t(pt))

    def _lineTo(self, pt):
        self.p.lineTo(*self._t(pt))

    def _curveToOne(self, a, b, c):
        self.p.curveTo(*self._t(a), *self._t(b), *self._t(c))

    def _closePath(self):
        self.p.close()


def ancho(fuente, texto, pt, tracking=0):
    """Ancho en mm. tracking en milésimas de em (como en InDesign)."""
    s = pt / fuente.upem
    g = fuente.shape(texto)
    total = sum(adv for _, adv in g) * s + tracking / 1000 * pt * (len(g) - 1)
    return total / mm * 1  # pt -> mm


def texto(c, fuente, cadena, x, y, pt, color, tracking=0, align="left"):
    """Dibuja texto como curvas. x, y en mm (línea base)."""
    w = ancho(fuente, cadena, pt, tracking)
    if align == "center":
        x -= w / 2
    elif align == "right":
        x -= w
    s = pt / fuente.upem
    cx, cy = x * mm, y * mm
    path = c.beginPath()
    for nombre, adv in fuente.shape(cadena):
        fuente.glyphs[nombre].draw(PathPen(fuente.glyphs, path, cx, cy, s))
        cx += adv * s + tracking / 1000 * pt
    c.setFillColor(color)
    c.drawPath(path, stroke=0, fill=1, fillMode=1)  # nonzero winding
    return w


def qr(c, data, x, y, lado, color):
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q, border=0)
    q.add_data(data)
    q.make(fit=True)
    m = q.get_matrix()
    n = len(m)
    mod = lado / n
    path = c.beginPath()
    for fila, valores in enumerate(m):
        col = 0
        while col < n:
            if valores[col]:
                ini = col
                while col < n and valores[col]:
                    col += 1
                # rectángulos levemente solapados para que no queden filetes blancos al rasterizar
                path.rect((x + ini * mod) * mm, (y + (n - fila - 1) * mod) * mm,
                          (col - ini) * mod * mm + 0.01, mod * mm + 0.01)
            else:
                col += 1
    c.setFillColor(color)
    c.drawPath(path, stroke=0, fill=1)


def linea(c, x1, y1, x2, y2, color, grosor_pt):
    c.setStrokeColor(color)
    c.setLineWidth(grosor_pt)
    c.line(x1 * mm, y1 * mm, x2 * mm, y2 * mm)


F = {}


def frente(c):
    W, H = TRIM_W, TRIM_H
    c.setFillColor(NEGRO_RICO)
    c.rect(-BLEED * mm, -BLEED * mm, (W + 2 * BLEED) * mm, (H + 2 * BLEED) * mm, stroke=0, fill=1)

    # Wordmark: SM en Bold + STUDIO en Light, centrado ópticamente
    pt, tr = 23, 140
    w_sm = ancho(F["display_bold"], "SM", pt, tr)
    w_st = ancho(F["display_light"], "STUDIO", pt, tr)
    gap = tr / 1000 * pt / mm
    total = w_sm + gap + w_st
    x0, yb = W / 2 - total / 2, H / 2 + 0.6
    texto(c, F["display_bold"], "SM", x0, yb, pt, BLANCO, tr)
    texto(c, F["display_light"], "STUDIO", x0 + w_sm + gap, yb, pt, BLANCO, tr)

    linea(c, W / 2 - 6, H / 2 - 4.2, W / 2 + 6, H / 2 - 4.2, CHAMPAGNE, 0.5)
    texto(c, F["medium"], "DISEÑO & DESARROLLO WEB", W / 2, H / 2 - 9.2, 6.5, CHAMPAGNE, 320, "center")


def dorso(c):
    W, H = TRIM_W, TRIM_H
    c.setFillColor(HUESO)
    c.rect(-BLEED * mm, -BLEED * mm, (W + 2 * BLEED) * mm, (H + 2 * BLEED) * mm, stroke=0, fill=1)
    # franja champagne al borde izquierdo (corre por el sangrado)
    c.setFillColor(CHAMPAGNE)
    c.rect(-BLEED * mm, -BLEED * mm, (BLEED + 1.6) * mm, (H + 2 * BLEED) * mm, stroke=0, fill=1)

    x = 7.5
    # marca
    w_sm = ancho(F["display_bold"], "SM", 10, 120)
    texto(c, F["display_bold"], "SM", x, H - 9.5, 10, NEGRO_K, 120)
    texto(c, F["display_light"], "STUDIO", x + w_sm + 120 / 1000 * 10 / mm, H - 9.5, 10, NEGRO_K, 120)
    texto(c, F["medium"], "DISEÑO & DESARROLLO WEB", x, H - 13.6, 5.8, GRIS, 260)

    def bloque(y, etiqueta, valor, fuente="semibold", pt=8.6):
        texto(c, F["semibold"], etiqueta, x, y + 3.9, 5.6, CHAMPAGNE, 260)
        texto(c, F[fuente], valor, x, y, pt, NEGRO_K, 0)

    bloque(25.0, "WHATSAPP", TELEFONO)
    bloque(16.2, "INSTAGRAM", INSTAGRAM)

    texto(c, F["semibold"], "PROYECTOS", x, 11.3, 5.6, CHAMPAGNE, 260)
    w = texto(c, F["semibold"], "goods.ar", x, 7.0, 8.0, NEGRO_K)
    c.setFillColor(CHAMPAGNE)
    c.circle((x + w + 2.0) * mm, 7.95 * mm, 0.42 * mm, stroke=0, fill=1)
    texto(c, F["semibold"], "Magic Studio", x + w + 4.0, 7.0, 8.0, NEGRO_K)
    w2 = ancho(F["semibold"], "Magic Studio", 8.0)
    texto(c, F["regular"], "· barbería", x + w + 4.0 + w2 + 1.0, 7.0, 8.0, GRIS)

    # divisor + QR
    lado = 21.0
    qx, qy = W - 6.0 - lado, 12.6
    linea(c, qx - 5.0, 8.0, qx - 5.0, H - 8.0, CHAMPAGNE, 0.35)
    qr(c, QR_URL, qx, qy, lado, NEGRO_K)
    texto(c, F["semibold"], "ESCANEÁ", qx + lado / 2, qy - 3.6, 5.6, NEGRO_K, 260, "center")
    texto(c, F["medium"], "y escribime", qx + lado / 2, qy - 6.6, 5.6, GRIS, 20, "center")


def pagina(c, dibujar, marcas):
    off = BLEED + (MARK if marcas else 0)
    c.saveState()
    c.translate(off * mm, off * mm)
    dibujar(c)
    c.restoreState()
    if marcas:
        # marcas de corte en registro, fuera del sangrado
        reg = CMYKColor(1, 1, 1, 1)
        x0, y0, x1, y1 = off, off, off + TRIM_W, off + TRIM_H
        largo, sep = 6, BLEED + 1
        for x in (x0, x1):
            for y, d in ((y0, -1), (y1, 1)):
                linea(c, x, y + d * sep, x, y + d * (sep + largo), reg, 0.25)
        for y in (y0, y1):
            for x, d in ((x0, -1), (x1, 1)):
                linea(c, x + d * sep, y, x + d * (sep + largo), y, reg, 0.25)
    c.showPage()


def pdf(nombre, marcas):
    extra = BLEED + (MARK if marcas else 0)
    pw, ph = TRIM_W + 2 * extra, TRIM_H + 2 * extra
    ruta = os.path.join(OUT, nombre)
    c = canvas.Canvas(ruta, pagesize=(pw * mm, ph * mm))
    c.setTitle("SMSTUDIO — Tarjeta de presentación")
    c.setAuthor("SMSTUDIO")
    for dibujar in (frente, dorso):
        m = MARK if marcas else 0
        c.setTrimBox(((extra) * mm, extra * mm, (extra + TRIM_W) * mm, (extra + TRIM_H) * mm))
        c.setBleedBox((m * mm, m * mm, (pw - m) * mm, (ph - m) * mm))
        pagina(c, dibujar, marcas)
    c.save()
    _quitar_fuentes(ruta)
    return ruta


def _quitar_fuentes(ruta):
    """reportlab declara Helvetica aunque no se use: se quita para que el preflight no avise."""
    import pikepdf
    with pikepdf.open(ruta, allow_overwriting_input=True) as doc:
        for pag in doc.pages:
            if "/Font" in pag.Resources:
                del pag.Resources["/Font"]
            pag.contents_coalesce()
            datos = re.sub(rb"BT /F1 [\d.]+ Tf [\d.]+ TL ET\s*", b"", pag.Contents.read_bytes())
            pag.Contents.write(datos)
        doc.save(ruta)


def png(pdf_ruta, prefijo, *args):
    subprocess.run(["pdftoppm", "-png", "-aa", "yes", "-aaVector", "yes", *args, pdf_ruta,
                    os.path.join(OUT, prefijo)], check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    F.update(
        display_bold=Fuente("InterDisplay-Bold.otf"),
        display_light=Fuente("InterDisplay-Light.otf"),
        regular=Fuente("Inter-Regular.otf"),
        medium=Fuente("Inter-Medium.otf"),
        semibold=Fuente("Inter-SemiBold.otf"),
    )
    con_sangrado = pdf("SMSTUDIO_imprenta_sangrado.pdf", marcas=False)
    pdf("SMSTUDIO_imprenta_marcas_de_corte.pdf", marcas=True)

    # PDF al corte (sin sangrado) sólo para renders de pantalla
    global BLEED
    b = BLEED
    BLEED = 0
    al_corte = pdf("_al_corte.pdf", marcas=False)
    BLEED = b

    png(al_corte, "SMSTUDIO_4K", "-scale-to-x", "3840", "-scale-to-y", "-1")
    png(con_sangrado, "SMSTUDIO_1200dpi_sangrado", "-r", "1200")
    os.remove(al_corte)
    for viejo, nuevo in (("SMSTUDIO_4K-1.png", "SMSTUDIO_4K_frente.png"),
                         ("SMSTUDIO_4K-2.png", "SMSTUDIO_4K_dorso.png"),
                         ("SMSTUDIO_1200dpi_sangrado-1.png", "SMSTUDIO_1200dpi_sangrado_frente.png"),
                         ("SMSTUDIO_1200dpi_sangrado-2.png", "SMSTUDIO_1200dpi_sangrado_dorso.png")):
        os.replace(os.path.join(OUT, viejo), os.path.join(OUT, nuevo))


if __name__ == "__main__":
    main()
