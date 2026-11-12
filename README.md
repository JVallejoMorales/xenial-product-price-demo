# Mesa de Precios

Demostración independiente para el portafolio de Juan José Vallejo. Recrea las pantallas de Xenial Product Price, un proyecto de Burger King Colombia para consultar y preparar cambios de precios por producto, restaurante y lista. La demo usa una paleta verde petróleo y un catálogo ficticio de Nube y Grano.

En el proyecto original, Juan José implementó validaciones, simulación y verificación posterior con Python, Excel y la API de Xenial. Probó un cambio y su restauración en laboratorio.

## Ejecutar en localhost

~~~powershell
Set-Location 'C:\xenial-product-price-demo'
python -m http.server 41766 --bind 127.0.0.1 --directory docs
~~~

Abre [Mesa de Precios](http://localhost:41766/). Recargar reinicia el escenario ficticio y sus comprobantes.

## Vistas

- **Excel de precios.** Genera un «.xlsx» de los cuatro restaurantes, modifica importes en la hoja «Precios» y vuelve a cargarlo para comparar. Conserva las filas, los encabezados y la hoja «Referencia». Un importe vacío conserva la regla vigente y el cero se compara como un precio.
- **Catálogo de precios.** Filtra por restaurante y producto en la matriz de cinco listas. Abre las reglas y los acompañantes de ejemplo o compara un cambio individual o un lote de varios restaurantes.
- **Listas de precios.** Prepara una lista para un restaurante o varios, revisa productos y condiciones y guarda versiones del borrador.
- **Auditoría.** Consulta movimientos ficticios, filtra o exporta el historial y abre el detalle para restaurar el último lote activo. La restauración verifica los importes de la sesión contra el comprobante.

El navegador genera y procesa los datos en la sesión. La carpeta «docs/» contiene el sitio estático, con recursos relativos y navegación por fragmentos.
