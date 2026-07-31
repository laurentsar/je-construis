#!/usr/bin/env python3
"""Génère les icônes de l'app en PNG, sans dépendance (ni Pillow ni ImageMagick).

Cette machine n'a pas Pillow : le PNG est écrit à la main (zlib + CRC32), et le
dessin est fait en calcul de distance sur chaque pixel. C'est largement assez
pour une icône géométrique, et ça évite d'installer quoi que ce soit.

Sorties :
  www/img/icon-512.png / icon-192.png : icône pleine (fond compris)
  www/img/icon-flat.png               : copie 512 pour les icônes Android legacy
  www/img/icon-mark.png               : logo seul sur fond transparent, cadré
                                        dans la zone de sécurité (adaptive icon)

Motif : un abri monopente vu de face — traverse inclinée posée sur deux poteaux,
et une ligne de sol. C'est la silhouette d'un carport, lisible à 48 px.
"""
import struct, zlib

BG = (18, 30, 41, 255)        # ardoise sombre
WOOD = (240, 168, 62, 255)    # bois clair
WOOD_DARK = (206, 132, 42, 255)
GROUND = (46, 66, 84, 255)


def blend(dst, src):
    a = src[3] / 255.0
    if a >= 1:
        return src
    return tuple(int(src[i] * a + dst[i] * (1 - a)) for i in range(3)) + (255,)


def seg_dist(px, py, x1, y1, x2, y2):
    vx, vy = x2 - x1, y2 - y1
    wx, wy = px - x1, py - y1
    L2 = vx * vx + vy * vy
    t = 0 if L2 == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / L2))
    dx, dy = px - (x1 + t * vx), py - (y1 + t * vy)
    return (dx * dx + dy * dy) ** 0.5


def draw(size, with_bg=True, inset=0.0):
    """inset : marge relative (0.17 = logo cadré dans 66 % du carré)."""
    S = size
    img = [[(0, 0, 0, 0)] * S for _ in range(S)]

    if with_bg:
        r = S * 0.22          # coins arrondis
        for y in range(S):
            for x in range(S):
                cx = min(max(x, r), S - r)
                cy = min(max(y, r), S - r)
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if d <= r:
                    img[y][x] = BG

    # Repère du dessin, replié dans la zone de sécurité si demandé.
    def X(u):
        return (inset + u * (1 - 2 * inset)) * S

    def Y(v):
        return (inset + v * (1 - 2 * inset)) * S

    thick = S * (0.075 if inset == 0 else 0.062)

    segments = [
        # (x1, y1, x2, y2, épaisseur, couleur)
        (X(0.08), Y(0.34), X(0.92), Y(0.20), thick * 1.25, WOOD),   # toiture (pente)
        (X(0.20), Y(0.36), X(0.20), Y(0.84), thick, WOOD_DARK),     # poteau gauche
        (X(0.80), Y(0.26), X(0.80), Y(0.84), thick, WOOD_DARK),     # poteau droit
        (X(0.50), Y(0.30), X(0.50), Y(0.84), thick * 0.8, WOOD_DARK),  # poteau central
        (X(0.06), Y(0.88), X(0.94), Y(0.88), thick * 0.62, GROUND),  # sol
    ]

    for y in range(S):
        for x in range(S):
            px, py = x + 0.5, y + 0.5
            for (x1, y1, x2, y2, w, col) in segments:
                d = seg_dist(px, py, x1, y1, x2, y2)
                if d <= w / 2:
                    img[y][x] = blend(img[y][x], col) if img[y][x][3] else col
                elif d <= w / 2 + 1.2:      # anticrénelage 1 px
                    a = max(0.0, 1 - (d - w / 2) / 1.2)
                    soft = col[:3] + (int(col[3] * a),)
                    img[y][x] = blend(img[y][x], soft) if img[y][x][3] else soft
    return img


def write_png(path, img):
    S = len(img)
    raw = b''.join(b'\x00' + b''.join(struct.pack('4B', *px) for px in row) for row in img)
    comp = zlib.compress(raw, 9)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', S, S, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', comp)
           + chunk(b'IEND', b''))
    open(path, 'wb').write(png)
    print(path, S, 'px')


if __name__ == '__main__':
    full = draw(512, with_bg=True)
    write_png('www/img/icon-512.png', full)
    write_png('www/img/icon-flat.png', full)
    write_png('www/img/icon-192.png', draw(192, with_bg=True))
    write_png('www/img/icon-mark.png', draw(512, with_bg=False, inset=0.17))
