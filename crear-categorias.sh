#!/bin/bash
set -e

command -v jq >/dev/null || apt install -y jq

read -p "Email de admin: " ADMIN_EMAIL
read -s -p "Contraseña de admin: " ADMIN_PASSWORD
echo

API_URL="http://localhost:9000"

echo "Autenticando..."
TOKEN=$(curl -s -X POST "$API_URL/auth/user/emailpass" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "Error: no se pudo autenticar. Revisa el email/contraseña."
  exit 1
fi

echo "Token obtenido. Creando categorías..."

create_category() {
  local name="$1"
  local parent_id="$2"
  local body

  if [ -z "$parent_id" ]; then
    body="{\"name\":\"$name\",\"is_active\":true}"
  else
    body="{\"name\":\"$name\",\"is_active\":true,\"parent_category_id\":\"$parent_id\"}"
  fi

  curl -s -X POST "$API_URL/admin/product-categories" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body" | jq -r '.product_category.id'
}

echo "Creando categoría padre: Tienda"
TIENDA_ID=$(create_category "Tienda" "")
echo "  -> $TIENDA_ID"

echo "Creando categoría padre: Servicios"
SERVICIOS_ID=$(create_category "Servicios" "")
echo "  -> $SERVICIOS_ID"

echo "Creando categoría padre: Recursos"
RECURSOS_ID=$(create_category "Recursos" "")
echo "  -> $RECURSOS_ID"

echo "Creando categoría padre: Marketplace"
MARKETPLACE_ID=$(create_category "Marketplace" "")
echo "  -> $MARKETPLACE_ID"

echo ""
echo "Creando subcategorías de Tienda..."
for name in "Máquinas CNC" "Herramientas" "Materiales" "Diseños digitales" "Productos"; do
  id=$(create_category "$name" "$TIENDA_ID")
  echo "  - $name -> $id"
done

echo "Creando subcategorías de Servicios..."
for name in "Router CNC" "Láser" "Plasma" "Maquinado" "Diseño CAD/CAM"; do
  id=$(create_category "$name" "$SERVICIOS_ID")
  echo "  - $name -> $id"
done

echo "Creando subcategorías de Recursos..."
for name in "Academia" "Software" "Calculadora CNC" "Utilidades"; do
  id=$(create_category "$name" "$RECURSOS_ID")
  echo "  - $name -> $id"
done

echo "Creando subcategorías de Marketplace..."
for name in "Vendedores" "Talleres" "Profesionales"; do
  id=$(create_category "$name" "$MARKETPLACE_ID")
  echo "  - $name -> $id"
done

echo ""
echo "Listo. 21 categorías creadas."
