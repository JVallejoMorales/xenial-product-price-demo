# Mesa de Precios

Demostración independiente para el portafolio de Juan José Vallejo. Recrea el flujo de Xenial Product Price, un proyecto de Burger King Colombia para consultar y preparar cambios de precios por producto, sede y lista. La demo utiliza una identidad propia y un catálogo ficticio para proteger la información operativa y la identidad visual de la empresa.

En el proyecto original, Juan José implementó validaciones, simulación y verificación posterior con Python, Excel y la API de Xenial. Probó un cambio y su restauración en laboratorio.

## Ejecutar en localhost

~~~powershell
Set-Location 'C:\xenial-product-price-demo'
python -m http.server 41766 --bind 127.0.0.1 --directory docs
~~~

Abre [Mesa de Precios](http://localhost:41766/). Recargar reinicia el escenario ficticio y sus comprobantes.

## Flujo

1. Filtra la matriz por sede, categoría o producto. Cada celda corresponde a una lista. Las celdas sin regla se muestran como tales.
2. Selecciona un precio y guarda la propuesta. El plan conserva el valor de referencia y permite descargar las filas en CSV.
3. Simula el plan para comparar cada referencia con el precio vigente en la sesión.
4. Aplica el lote en la demo. El historial conserva el valor anterior, el propuesto y el leído tras la aplicación.
5. Restaura el último lote activo. La restauración compara el precio vigente con el comprobante y registra el valor leído tras recuperar la referencia.

El navegador procesa los lotes y comprobantes sobre los datos generados en la sesión. La carpeta «docs/» contiene el sitio estático, con recursos relativos y navegación por fragmentos.
