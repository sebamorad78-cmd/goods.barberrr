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
QR_URL = "https://goods.ar"
INSTAGRAM = "@sebamoraddd"
NOMBRE = "Sebastián Morad"
CARGO = "DISEÑADOR & DESARROLLADOR WEB"

# Colores CMYK (0..1). Negro enriquecido sólo para fondos; texto chico en K puro.
NEGRO_RICO = CMYKColor(0.60, 0.40, 0.40, 1.00)
NEGRO_K = CMYKColor(0, 0, 0, 1)
BLANCO = CMYKColor(0, 0, 0, 0)
HUESO = CMYKColor(0, 0.02, 0.06, 0)
CHAMPAGNE = CMYKColor(0, 0.18, 0.45, 0.20)
GRIS = CMYKColor(0, 0, 0, 0.62)
TONO = CMYKColor(0.60, 0.40, 0.40, 0.78)  # tono sobre tono del frente


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


# En modo máscara sólo se dibujan los elementos dorados, en 100% K,
# para el archivo de hot-stamping (laminado metálico).
MASCARA = False


def pintar(c, color, trazo=False):
    if MASCARA:
        if color is not CHAMPAGNE:
            return False
        color = NEGRO_K
    (c.setStrokeColor if trazo else c.setFillColor)(color)
    return True


def fondo(c, color, x=None, y=None, w=None, h=None):
    """Rectángulo en mm; sin medidas cubre toda la tarjeta con sangrado."""
    if x is None:
        x, y, w, h = -BLEED, -BLEED, TRIM_W + 2 * BLEED, TRIM_H + 2 * BLEED
    if pintar(c, color):
        c.rect(x * mm, y * mm, w * mm, h * mm, stroke=0, fill=1)


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
    if pintar(c, color):
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
    if pintar(c, color):
        c.drawPath(path, stroke=0, fill=1)


def linea(c, x1, y1, x2, y2, color, grosor_pt):
    if pintar(c, color, trazo=True):
        c.setLineWidth(grosor_pt)
        c.line(x1 * mm, y1 * mm, x2 * mm, y2 * mm)


F = {}


def wordmark(c, x, yb, pt, tr, color=BLANCO, align="left"):
    w_sm = ancho(F["display_bold"], "SM", pt, tr)
    gap = tr / 1000 * pt / mm
    total = w_sm + gap + ancho(F["display_light"], "STUDIO", pt, tr)
    if align == "center":
        x -= total / 2
    texto(c, F["display_bold"], "SM", x, yb, pt, color, tr)
    texto(c, F["display_light"], "STUDIO", x + w_sm + gap, yb, pt, color, tr)
    return total


# Las líneas doradas van a 0.75 pt (0.26 mm): mínimo seguro para hot-stamping.
FILETE = 0.75


def frente_clasico(c):
    W, H = TRIM_W, TRIM_H
    fondo(c, NEGRO_RICO)
    wordmark(c, W / 2, H / 2 + 0.6, 23, 140, align="center")
    linea(c, W / 2 - 6, H / 2 - 4.2, W / 2 + 6, H / 2 - 4.2, CHAMPAGNE, FILETE)
    texto(c, F["medium"], "DISEÑO & DESARROLLO WEB", W / 2, H / 2 - 9.2, 6.5, CHAMPAGNE, 320, "center")


def frente_monograma(c):
    W, H = TRIM_W, TRIM_H
    fondo(c, NEGRO_RICO)
    # SM gigante tono sobre tono, cortado por los bordes superior y derecho
    texto(c, F["display_bold"], "SM", W + 5, H - 21, 120, TONO, -20, "right")
    x = 7.5
    linea(c, x, H - 7.5, x + 8, H - 7.5, CHAMPAGNE, FILETE)
    wordmark(c, x, 13.6, 17, 140)
    texto(c, F["medium"], "DISEÑO & DESARROLLO WEB", x, 7.4, 6.2, CHAMPAGNE, 300)


def frente_codigo(c):
    W, H = TRIM_W, TRIM_H
    fondo(c, NEGRO_RICO)
    texto(c, F["mono"], "</>", 7.5, H - 9.5, 8, CHAMPAGNE, 0)
    wordmark(c, W / 2, H / 2 + 0.6, 23, 140, align="center")
    linea(c, W / 2 - 6, H / 2 - 4.2, W / 2 + 6, H / 2 - 4.2, CHAMPAGNE, FILETE)
    texto(c, F["medium"], "DISEÑO & DESARROLLO WEB", W / 2, H / 2 - 9.2, 6.5, CHAMPAGNE, 320, "center")
    linea(c, W - 7.5 - 8, 7.5, W - 7.5, 7.5, CHAMPAGNE, FILETE)


FRENTES = {"monograma": frente_monograma, "codigo": frente_codigo, "clasico": frente_clasico}


def dorso(c):
    W, H = TRIM_W, TRIM_H
    fondo(c, HUESO)
    # franja champagne al borde izquierdo (corre por el sangrado)
    fondo(c, CHAMPAGNE, -BLEED, -BLEED, BLEED + 1.6, H + 2 * BLEED)

    x = 7.5
    texto(c, F["display_semibold"], NOMBRE, x, H - 9.8, 11.5, NEGRO_K, 0)
    texto(c, F["medium"], CARGO, x, H - 14.2, 5.6, GRIS, 180)

    def bloque(y, etiqueta, valor, fuente="semibold", pt=8.6):
        texto(c, F["semibold"], etiqueta, x, y + 3.9, 5.6, CHAMPAGNE, 260)
        texto(c, F[fuente], valor, x, y, pt, NEGRO_K, 0)

    bloque(25.0, "WHATSAPP", TELEFONO)
    bloque(16.2, "INSTAGRAM", INSTAGRAM)
    bloque(7.4, "PROYECTO", "goods.ar")

    # divisor + QR a goods.ar
    lado = 21.0
    qx, qy = W - 6.0 - lado, 12.6
    linea(c, qx - 5.0, 8.0, qx - 5.0, H - 8.0, CHAMPAGNE, 0.35)
    qr(c, QR_URL, qx, qy, lado, NEGRO_K)
    texto(c, F["semibold"], "ESCANEÁ", qx + lado / 2, qy - 3.6, 5.6, NEGRO_K, 260, "center")
    texto(c, F["medium"], "y mirá mi trabajo", qx + lado / 2, qy - 6.6, 5.6, GRIS, 20, "center")


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
        global MASCARA
        m, MASCARA = MASCARA, False
        for x in (x0, x1):
            for y, d in ((y0, -1), (y1, 1)):
                linea(c, x, y + d * sep, x, y + d * (sep + largo), reg, 0.25)
        for y in (y0, y1):
            for x, d in ((x0, -1), (x1, 1)):
                linea(c, x + d * sep, y, x + d * (sep + largo), y, reg, 0.25)
        MASCARA = m
    c.showPage()


def pdf(ruta, paginas, marcas):
    extra = BLEED + (MARK if marcas else 0)
    pw, ph = TRIM_W + 2 * extra, TRIM_H + 2 * extra
    c = canvas.Canvas(ruta, pagesize=(pw * mm, ph * mm))
    c.setTitle("SMSTUDIO — Tarjeta de presentación")
    c.setAuthor("SMSTUDIO")
    for dibujar in paginas:
        m = MARK if marcas else 0
        c.setTrimBox((extra * mm, extra * mm, (extra + TRIM_W) * mm, (extra + TRIM_H) * mm))
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


def png(pdf_ruta, destino, *args):
    """Renderiza un PDF de 2 páginas a destino_frente.png y destino_dorso.png."""
    subprocess.run(["pdftoppm", "-png", "-aa", "yes", "-aaVector", "yes", *args, pdf_ruta, destino], check=True)
    for n, cara in (("1", "frente"), ("2", "dorso")):
        os.replace(f"{destino}-{n}.png", f"{destino}_{cara}.png")


def vista_previa(frente, dorso, destino, escala=0.5):
    from PIL import Image, ImageDraw, ImageFilter
    caras = [Image.open(f).convert("RGB") for f in (frente, dorso)]
    caras = [im.resize((int(im.width * escala), int(im.height * escala)), Image.LANCZOS) for im in caras]
    cw, ch = caras[0].size
    W, H = cw + 300, ch * 2 + 400
    bg = Image.new("RGB", (W, H), (214, 210, 203))
    for i, im in enumerate(caras):
        x, y = 150, 150 + i * (ch + 100)
        sombra = Image.new("L", (W, H), 0)
        ImageDraw.Draw(sombra).rounded_rectangle((x + 10, y + 25, x + cw + 10, y + ch + 25), 12, fill=110)
        bg.paste((60, 55, 50), (0, 0), sombra.filter(ImageFilter.GaussianBlur(28)))
        recorte = Image.new("L", im.size, 0)
        ImageDraw.Draw(recorte).rounded_rectangle((0, 0, cw, ch), 10, fill=255)
        bg.paste(im, (x, y), recorte)
    bg.save(destino)
    return bg


def comparativa(previas, destino):
    from PIL import Image
    ims = [Image.open(p) for p in previas]
    out = Image.new("RGB", (sum(i.width for i in ims), ims[0].height), (214, 210, 203))
    x = 0
    for im in ims:
        out.paste(im, (x, 0))
        x += im.width
    out.save(destino)


def main():
    global BLEED, MASCARA
    F.update(
        display_bold=Fuente("InterDisplay-Bold.otf"),
        display_light=Fuente("InterDisplay-Light.otf"),
        display_semibold=Fuente("InterDisplay-SemiBold.otf"),
        regular=Fuente("Inter-Regular.otf"),
        medium=Fuente("Inter-Medium.otf"),
        semibold=Fuente("Inter-SemiBold.otf"),
        mono=Fuente("../../truetype/jetbrains-mono/JetBrainsMono-Medium.ttf"),
    )
    previas = []
    for nombre, frente in FRENTES.items():
        d = os.path.join(OUT, nombre)
        os.makedirs(d, exist_ok=True)
        base = os.path.join(d, "SMSTUDIO_" + nombre)
        con_sangrado = pdf(base + "_imprenta_sangrado.pdf", (frente, dorso), marcas=False)
        pdf(base + "_imprenta_marcas_de_corte.pdf", (frente, dorso), marcas=True)
        # máscara de hot-stamping: sólo el frente (en el dorso el dorado es muy fino para laminar)
        MASCARA = True
        pdf(base + "_hotstamping_frente.pdf", (frente,), marcas=True)
        MASCARA = False

        # PDF al corte (sin sangrado) sólo para renders de pantalla
        b, BLEED = BLEED, 0
        al_corte = pdf(base + "_al_corte.pdf", (frente, dorso), marcas=False)
        BLEED = b
        png(al_corte, base + "_4K", "-scale-to-x", "3840", "-scale-to-y", "-1")
        png(con_sangrado, base + "_1200dpi_sangrado", "-r", "1200")
        os.remove(al_corte)
        previas.append(base + "_vista_previa.png")
        vista_previa(base + "_4K_frente.png", base + "_4K_dorso.png", previas[-1])
    comparativa(previas, os.path.join(OUT, "SMSTUDIO_comparativa_frentes.png"))


if __name__ == "__main__":
    main()
