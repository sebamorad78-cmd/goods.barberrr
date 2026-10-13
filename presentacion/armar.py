# Arma la página de presentación a partir de plantilla.html:
#  - vista-previa.html: para ver en Claude (todo embebido, sin <!doctype>, lo agrega el visor)
#  - netlify/: página completa + video, póster e imagen para compartir, lista para subir
import json, sys, os, base64, shutil
here = os.path.dirname(os.path.abspath(__file__))
imgs = json.load(open(sys.argv[1]))
video_dir = sys.argv[2]                       # carpeta con panel-demo.mp4 y poster.jpg
s = open(os.path.join(here, 'plantilla.html'), encoding='utf-8').read()
for key, name in [('IMG_GOODSMOBILE','hero'), ('IMG_GOODS','goods-desk')]:
    assert key in s; s = s.replace(key, imgs[name][0])
b64 = lambda f, mime: 'data:' + mime + ';base64,' + base64.b64encode(open(os.path.join(video_dir, f), 'rb').read()).decode()
preview = s.replace('VIDEO_PANEL', b64('panel-demo.mp4', 'video/mp4')).replace('VIDEO_WEBM', b64('panel-demo.webm', 'video/webm')).replace('IMG_POSTER', b64('poster.jpg', 'image/jpeg'))
open(os.path.join(here, 'vista-previa.html'), 'w', encoding='utf-8').write(preview)
site = s.replace('VIDEO_PANEL', 'panel-demo.mp4').replace('VIDEO_WEBM', 'panel-demo.webm').replace('IMG_POSTER', 'panel-poster.jpg')
head, body = site.split('</style>', 1)
full = ('<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n'
        '<meta name="theme-color" content="#161716">\n' + head + '</style>\n</head>\n<body>\n' + body + '</body>\n</html>\n')
out = os.path.join(here, 'netlify'); os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(full)
shutil.copy(os.path.join(video_dir, 'panel-demo.mp4'), os.path.join(out, 'panel-demo.mp4'))
shutil.copy(os.path.join(video_dir, 'panel-demo.webm'), os.path.join(out, 'panel-demo.webm'))
shutil.copy(os.path.join(video_dir, 'poster.jpg'), os.path.join(out, 'panel-poster.jpg'))
print('vista previa', len(preview)//1024, 'KB · sitio', len(full)//1024, 'KB')
