# Arma la página de presentación a partir de plantilla.html:
#  - vista-previa.html: para ver en Claude (sin <!doctype>, lo agrega el visor)
#  - index.html: para subir a Netlify (página completa)
import json, sys, os
here = os.path.dirname(os.path.abspath(__file__))
imgs = json.load(open(sys.argv[1]))
s = open(os.path.join(here, 'plantilla.html'), encoding='utf-8').read()
for key, name in [('IMG_GOODS','goods-desk'), ('IMG_PANEL','panel-hoy')]:
    assert key in s; s = s.replace(key, imgs[name][0])
open(os.path.join(here, 'vista-previa.html'), 'w', encoding='utf-8').write(s)
head, body = s.split('</style>', 1)
full = ('<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n'
        '<meta name="theme-color" content="#17201D">\n' + head + '</style>\n</head>\n<body>\n' + body + '</body>\n</html>\n')
os.makedirs(os.path.join(here, 'netlify'), exist_ok=True)
open(os.path.join(here, 'netlify', 'index.html'), 'w', encoding='utf-8').write(full)
print(len(s)//1024, 'KB')
