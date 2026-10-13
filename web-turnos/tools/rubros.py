#!/usr/bin/env python3
"""
Genera una página por rubro (/barberia/, /salon/, /spa/, /unas/) con su propia
vista previa para WhatsApp/Facebook/Instagram (etiquetas og:), y las imágenes de
esa vista previa (assets/og/*.jpg, 1200x630).

WhatsApp NO ejecuta JavaScript: solo lee el HTML. Por eso cada rubro necesita un
HTML propio con su título, descripción e imagen.

Uso:
  python3 tools/rubros.py --url https://tu-sitio.netlify.app        # páginas
  python3 tools/rubros.py --url https://tu-sitio.netlify.app --imagenes  # + imágenes (requiere Pillow)

En Netlify (deploy desde GitHub) corre solo en cada publicación y toma la URL
del sitio de la variable de entorno URL (ver netlify.toml).
"""
import argparse
import html
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Textos de la vista previa. La tarjeta le habla al DUEÑO del local (es la demo que le mandás).
RUBROS = {
    "barberia": {
        "titulo": "Así se vería la web de tu barbería",
        "descripcion": "Demo en vivo: turnos online 24/7, seña, agenda del equipo y recordatorios por WhatsApp. Tocá y probá reservar un corte.",
        "imagen_alt": "Demo de web con turnos online para barberías",
        "titular": ["Tu barbería,", "con turnos online."],
        "detalle": "Corte clásico · Fade · Barba · Combos",
        "local": "Barbería Imperio",
        "bg": "#0e0d0b", "surface": "#1d1a15", "surface2": "#27231c", "text": "#f1ebe0", "muted": "#a69c8c",
        "accent": "#c9a45c", "on_accent": "#15110a", "mesh1": "#4a3517", "mesh2": "#4a1a16",
    },
    "salon": {
        "titulo": "Así se vería la web de tu salón de belleza",
        "descripcion": "Demo en vivo: tus clientas reservan solas 24/7, con seña, agenda por estilista y recordatorios por WhatsApp. Tocá y probá.",
        "imagen_alt": "Demo de web con turnos online para salones de belleza",
        "titular": ["Tu salón,", "con turnos online."],
        "detalle": "Cortes · Color · Balayage · Peinados",
        "local": "Maison Lumière",
        "bg": "#faf6f1", "surface": "#ffffff", "surface2": "#f7eee8", "text": "#2a1b20", "muted": "#6f5c62",
        "accent": "#9b4560", "on_accent": "#ffffff", "mesh1": "#f0cfd7", "mesh2": "#f3e1cb",
    },
    "spa": {
        "titulo": "Así se vería la web de tu spa o centro de estética",
        "descripcion": "Demo en vivo: reservas online 24/7 de masajes y tratamientos, con seña, agenda por profesional y recordatorios por WhatsApp.",
        "imagen_alt": "Demo de web con turnos online para spas y centros de estética",
        "titular": ["Tu spa,", "con turnos online."],
        "detalle": "Masajes · Faciales · Corporales · Day spa",
        "local": "Salvia Spa",
        "bg": "#f1f2ec", "surface": "#fbfcf8", "surface2": "#e2e7da", "text": "#1d2822", "muted": "#56645b",
        "accent": "#4a6752", "on_accent": "#ffffff", "mesh1": "#cddbca", "mesh2": "#ebe2d1",
    },
    "unas": {
        "titulo": "Así se vería la web de tu nail bar",
        "descripcion": "Demo en vivo: tus clientas reservan semipermanente, esculpidas o nail art 24/7, con seña y recordatorios por WhatsApp. Tocá y probá.",
        "imagen_alt": "Demo de web con turnos online para nail bars y manicuras",
        "titular": ["Tu nail bar,", "con turnos online."],
        "detalle": "Semipermanente · Esculpidas · Kapping · Nail art",
        "local": "Nude Nail Bar",
        "bg": "#131012", "surface": "#221c20", "surface2": "#2d252a", "text": "#f7ede9", "muted": "#b5a3a5",
        "accent": "#eaa8b6", "on_accent": "#24121a", "mesh1": "#4a2333", "mesh2": "#2e1f2c",
    },
}

VENDER = {
    "titulo": "Webs con turnos online para tu local · Mar del Plata",
    "descripcion": "Barberías, peluquerías, spas y nail bars: tus clientes reservan solos 24/7, con seña, agenda y recordatorios por WhatsApp. Primer mes sin cargo.",
    "imagen_alt": "Webs con turnos online para barberías, salones, spas y nail bars",
    "titular": ["Tu local recibe turnos", "mientras dormís."],
    "detalle": "Barberías · Salones · Spas · Nail bars · Mar del Plata",
    "local": "Sebastian Morad",
}
VENDER.update({k: RUBROS["barberia"][k] for k in ("bg", "surface", "surface2", "text", "muted", "accent", "on_accent", "mesh1", "mesh2")})

ORDEN = ["barberia", "salon", "spa", "unas"]
# URL usada si no se pasa --url ni existe la variable URL (deploy arrastrando la carpeta).
# Poné acá el nombre exacto de tu sitio en Netlify.
SITIO_POR_DEFECTO = "https://paginas-profesionales-1212.netlify.app"
MARCA_INI, MARCA_FIN = "<!-- OG:START", "<!-- OG:END -->"


def bloque_og(d, url_pagina, url_imagen, tipo="website"):
    e = lambda s: html.escape(s, quote=True)
    return "\n".join([
        "<!-- OG:START (generado por tools/rubros.py, no editar a mano) -->",
        f"  <title>{e(d['titulo'])}</title>",
        f'  <meta name="description" content="{e(d["descripcion"])}">',
        f'  <link rel="canonical" href="{e(url_pagina)}">',
        f'  <meta property="og:type" content="{tipo}">',
        '  <meta property="og:locale" content="es_AR">',
        f'  <meta property="og:site_name" content="{e(VENDER["local"])}">',
        f'  <meta property="og:title" content="{e(d["titulo"])}">',
        f'  <meta property="og:description" content="{e(d["descripcion"])}">',
        f'  <meta property="og:url" content="{e(url_pagina)}">',
        f'  <meta property="og:image" content="{e(url_imagen)}">',
        f'  <meta property="og:image:secure_url" content="{e(url_imagen)}">',
        '  <meta property="og:image:type" content="image/jpeg">',
        '  <meta property="og:image:width" content="1200">',
        '  <meta property="og:image:height" content="630">',
        f'  <meta property="og:image:alt" content="{e(d["imagen_alt"])}">',
        '  <meta name="twitter:card" content="summary_large_image">',
        f'  <meta name="twitter:title" content="{e(d["titulo"])}">',
        f'  <meta name="twitter:description" content="{e(d["descripcion"])}">',
        f'  <meta name="twitter:image" content="{e(url_imagen)}">',
        "  " + MARCA_FIN,
    ])


def reemplazar_bloque(texto, nuevo):
    i = texto.index(MARCA_INI)
    j = texto.index(MARCA_FIN, i) + len(MARCA_FIN)
    return texto[:i] + nuevo + texto[j:]


def pagina_rubro(plantilla, modo):
    """index.html -> <modo>/index.html: rutas relativas un nivel arriba y modo fijo."""
    s = plantilla
    # Rutas a recursos del sitio (css/, js/, assets/, *.html) un nivel arriba
    s = re.sub(r'(href|src)="(?!https?:|data:|#|/|\.\./|mailto:|tel:)([^"]+)"', r'\1="../\2"', s)
    # El rubro y la raíz se fijan antes de cargar la configuración
    s = s.replace('  <script src="../js/config.js',
                  f'  <script>window.__MODO__ = "{modo}"; window.__ROOT__ = "../";</script>\n  <script src="../js/config.js', 1)
    return s


# ----------------------------------------------------------------- imágenes
def generar_imagen(d, destino):
    from PIL import Image, ImageDraw, ImageFilter, ImageFont

    W, H = 1200, 630
    T1 = "/usr/share/fonts/X11/Type1/"
    def fuente(nombre, tam, alternativa):
        for ruta in nombre:
            try:
                return ImageFont.truetype(ruta, tam)
            except OSError:
                pass
        return ImageFont.truetype(alternativa, tam)
    serif = lambda t: fuente([T1 + "c0648bt_.pfb"], t, "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf")
    serif_it = lambda t: fuente([T1 + "c0649bt_.pfb"], t, "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf")
    sans_b = lambda t: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", t)
    sans = lambda t: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", t)

    img = Image.new("RGB", (W, H), d["bg"])
    # Fondo con luces suaves del color del rubro
    glow = Image.new("RGB", (W, H), d["bg"])
    g = ImageDraw.Draw(glow)
    g.ellipse((700, -220, 1400, 420), fill=d["mesh1"])
    g.ellipse((-260, 330, 520, 900), fill=d["mesh2"])
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img = Image.blend(img, glow, 0.9)
    dr = ImageDraw.Draw(img)

    # Texto (izquierda)
    x = 72
    dr.line((x, 98, x + 36, 98), fill=d["accent"], width=2)
    dr.text((x + 50, 98), "TURNOS ONLINE · MAR DEL PLATA", font=sans_b(17), fill=d["accent"], anchor="lm")
    f1, f2 = serif(68), serif_it(68)
    dr.text((x, 140), d["titular"][0], font=f1, fill=d["text"])
    dr.text((x, 222), d["titular"][1], font=f2, fill=d["accent"])
    dr.text((x, 334), d["detalle"], font=sans(21), fill=d["muted"])
    # Chips de beneficios
    cx, cy = x, 392
    for chip in ["Reservas 24/7", "Seña", "Agenda", "WhatsApp"]:
        f = sans_b(18)
        w = dr.textlength(chip, font=f) + 36
        dr.rounded_rectangle((cx, cy, cx + w, cy + 44), radius=22, outline=d["accent"], width=2)
        dr.text((cx + w / 2, cy + 22), chip, font=f, fill=d["text"], anchor="mm")
        cx += w + 12
    dr.text((x, 548), "Demo en vivo · " + d["local"], font=sans_b(19), fill=d["text"])
    dr.text((x, 578), "Tocá el link y probá reservar un turno", font=sans(17), fill=d["muted"])

    # Tarjeta de reserva (derecha)
    px, py, pw, ph = 760, 96, 372, 448
    sombra = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle((px + 6, py + 18, px + pw + 6, py + ph + 18), radius=28, fill=(0, 0, 0, 90))
    sombra = sombra.filter(ImageFilter.GaussianBlur(18))
    img.paste(sombra, (0, 0), sombra)
    dr = ImageDraw.Draw(img)
    dr.rounded_rectangle((px, py, px + pw, py + ph), radius=28, fill=d["surface"], outline=d["surface2"], width=2)
    dr.text((px + 28, py + 30), "RESERVÁ TU TURNO", font=sans_b(14), fill=d["muted"])
    dr.text((px + 28, py + 56), "Elegí día y horario", font=serif(30), fill=d["text"])
    # Días
    dias = [("JU", "1"), ("VI", "2"), ("SÁ", "3"), ("LU", "5"), ("MA", "6")]
    dx = px + 28
    for i, (dn, num) in enumerate(dias):
        sel = i == 2
        box = (dx, py + 112, dx + 56, py + 176)
        if sel:
            dr.rounded_rectangle(box, radius=14, fill=d["accent"])
        else:
            dr.rounded_rectangle(box, radius=14, outline=d["surface2"], width=2)
        col = d["on_accent"] if sel else d["text"]
        dr.text((dx + 28, py + 131), dn, font=sans_b(12), fill=col if sel else d["muted"], anchor="mm")
        dr.text((dx + 28, py + 155), num, font=sans_b(20), fill=col, anchor="mm")
        dx += 64
    # Horarios (con ocupados tachados)
    horas = ["10:00", "10:30", "11:00", "11:30", "12:00", "15:30"]
    ocupados = {"10:30", "12:00"}
    for i, h in enumerate(horas):
        col_i, fila = i % 3, i // 3
        bx = px + 28 + col_i * 108
        by = py + 200 + fila * 62
        box = (bx, by, bx + 98, by + 50)
        if h == "11:00":
            dr.rounded_rectangle(box, radius=12, fill=d["accent"])
            dr.text((bx + 49, by + 25), h, font=sans_b(18), fill=d["on_accent"], anchor="mm")
        elif h in ocupados:
            dr.rounded_rectangle(box, radius=12, fill=d["surface2"])
            dr.text((bx + 49, by + 19), h, font=sans_b(15), fill=d["muted"], anchor="mm")
            tw = dr.textlength(h, font=sans_b(15))
            dr.line((bx + 49 - tw / 2, by + 19, bx + 49 + tw / 2, by + 19), fill=d["muted"], width=2)
            dr.text((bx + 49, by + 37), "OCUPADO", font=sans_b(9), fill=d["muted"], anchor="mm")
        else:
            dr.rounded_rectangle(box, radius=12, outline=d["surface2"], width=2)
            dr.text((bx + 49, by + 25), h, font=sans_b(18), fill=d["text"], anchor="mm")
    # Botón
    dr.rounded_rectangle((px + 28, py + ph - 92, px + pw - 28, py + ph - 36), radius=16, fill=d["accent"])
    dr.text((px + pw / 2, py + ph - 64), "Confirmar turno", font=sans_b(19), fill=d["on_accent"], anchor="mm")

    os.makedirs(os.path.dirname(destino), exist_ok=True)
    img.save(destino, "JPEG", quality=86, optimize=True, progressive=True)
    return os.path.getsize(destino)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=os.environ.get("URL", SITIO_POR_DEFECTO), help="URL pública del sitio, ej. https://turnos.netlify.app")
    ap.add_argument("--imagenes", action="store_true", help="regenerar también las imágenes de vista previa")
    a = ap.parse_args()
    base = a.url.rstrip("/")
    if not base:
        print("AVISO: sin --url las vistas previas no muestran imagen (WhatsApp exige URLs absolutas).", file=sys.stderr)

    abs_ = lambda ruta: (base + "/" + ruta) if base else ruta
    version = "?v=4"  # cambiar para forzar a WhatsApp a releer la imagen

    if a.imagenes:
        for modo in ORDEN:
            n = generar_imagen(RUBROS[modo], os.path.join(RAIZ, "assets/og", modo + ".jpg"))
            print(f"assets/og/{modo}.jpg  {n // 1024} KB")
        n = generar_imagen(VENDER, os.path.join(RAIZ, "assets/og/vender.jpg"))
        print(f"assets/og/vender.jpg  {n // 1024} KB")

    ruta_index = os.path.join(RAIZ, "index.html")
    plantilla = open(ruta_index, encoding="utf-8").read()

    # Raíz = barbería (rubro por defecto)
    raiz = reemplazar_bloque(plantilla, bloque_og(RUBROS["barberia"], abs_("barberia/"), abs_("assets/og/barberia.jpg" + version)))
    open(ruta_index, "w", encoding="utf-8").write(raiz)

    for modo in ORDEN:
        s = pagina_rubro(raiz, modo)
        s = reemplazar_bloque(s, bloque_og(RUBROS[modo], abs_(modo + "/"), abs_(f"assets/og/{modo}.jpg" + version)))
        os.makedirs(os.path.join(RAIZ, modo), exist_ok=True)
        open(os.path.join(RAIZ, modo, "index.html"), "w", encoding="utf-8").write(s)
        print(f"{modo}/index.html")

    ruta_v = os.path.join(RAIZ, "vender.html")
    v = open(ruta_v, encoding="utf-8").read()
    v = reemplazar_bloque(v, bloque_og(VENDER, abs_(""), abs_("assets/og/vender.jpg" + version)))
    open(ruta_v, "w", encoding="utf-8").write(v)
    print("vender.html")
    print("Base:", base or "(sin URL)")


if __name__ == "__main__":
    main()
