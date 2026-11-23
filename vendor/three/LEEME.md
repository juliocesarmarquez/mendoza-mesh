# three.js (subconjunto)

`three.min.js` es un subconjunto de [three.js](https://threejs.org/) 0.186.1 (licencia MIT, ver
`LICENSE`) con solo las clases que usa la escena 3D del sitio (`assets/js/escena/`).

**No se edita a mano.** Se regenera con:

```sh
sh herramientas/empaquetar_three.sh
```

El script descarga three.js y esbuild en una carpeta temporal, empaqueta las clases listadas en
`herramientas/three/entrada.js` y escribe este archivo. Si la escena necesita otra clase,
agregala en `entrada.js` y volvé a correrlo.
