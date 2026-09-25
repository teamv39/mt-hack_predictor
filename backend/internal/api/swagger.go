package api

import (
	_ "embed"
	"net/http"
)

//go:embed openapi.json
var openAPIJSON []byte

const swaggerHTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MT-Predictor API — Swagger</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0B0F17; }
    .topbar { display: none; }
    .swagger-ui .info .title { color: #F8FAFC; }
    .swagger-ui .info .description,
    .swagger-ui .info li, .swagger-ui .info p, .swagger-ui .info table { color: #CBD5E1; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/swagger/doc.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout',
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`

// RegisterSwagger mounts Swagger UI and OpenAPI JSON on the given mux-like router.
// Paths: GET /swagger, GET /swagger/, GET /swagger/doc.json
func RegisterSwagger(r interface {
	Get(pattern string, handlerFn http.HandlerFunc)
}) {
	r.Get("/swagger/doc.json", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(openAPIJSON)
	})
	serveUI := func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(swaggerHTML))
	}
	r.Get("/swagger", serveUI)
	r.Get("/swagger/", serveUI)
}
