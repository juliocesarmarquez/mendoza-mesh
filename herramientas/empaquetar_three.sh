#!/bin/sh
# Empaqueta el subconjunto de three.js que usa la escena 3D en un solo módulo
# ES minificado: vendor/three/three.min.js (más su licencia MIT).
#
# El sitio no tiene paso de compilación: este script se corre una sola vez, a
# mano, cuando cambia la versión de three.js o las clases de
# herramientas/three/entrada.js. El resultado se sube al repositorio.
#
# Requisitos: Node.js 18 o más nuevo y npm (descarga three y esbuild en una
# carpeta temporal, fuera del repositorio).
#
# Uso: sh herramientas/empaquetar_three.sh
set -eu

THREE_VERSION="0.186.1"
ESBUILD_VERSION="0.28.2"

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT

cp "$RAIZ/herramientas/three/entrada.js" "$TEMP/entrada.js"
cd "$TEMP"
npm init -y >/dev/null
npm install --no-audit --no-fund --silent "three@$THREE_VERSION" "esbuild@$ESBUILD_VERSION"

mkdir -p "$RAIZ/vendor/three"
./node_modules/.bin/esbuild entrada.js --bundle --minify --format=esm --target=es2020 \
  --legal-comments=inline \
  --banner:js="/* three.js $THREE_VERSION (MIT), subconjunto para Mendoza Mesh: ver herramientas/empaquetar_three.sh */" \
  --outfile="$RAIZ/vendor/three/three.min.js"
cp node_modules/three/LICENSE "$RAIZ/vendor/three/LICENSE"

TAM=$(wc -c < "$RAIZ/vendor/three/three.min.js" | tr -d ' ')
GZ=$(gzip -9c "$RAIZ/vendor/three/three.min.js" | wc -c | tr -d ' ')
echo "vendor/three/three.min.js: $TAM bytes ($GZ bytes con gzip)"
