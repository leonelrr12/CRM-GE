#!/bin/bash
# =============================================
# CRM-GE Deployment Script — stack Docker (Contabo VPS)
#
#   api + mailer en contenedores; nginx sirve el frontend (client/dist)
#   y proxya /api/ al contenedor crmge-api (127.0.0.1:3005).
#   Postgres es externo (crmge-db), no se levanta ningún contenedor de BD.
#
# Ejecutar como root o con sudo.
# =============================================
set -e

DOMAIN="crm.greenenergytechnologie.com"           # CAMBIA por tu dominio real
APP_DIR="/apps/crmge"
LOG_DIR="/var/log/crmge"
MAILER_DIR="/root/apps/mailerApi"                 # repo hermano del microservicio de correo

echo "=== [1/7] Creando directorios ==="
mkdir -p $APP_DIR $LOG_DIR

echo "=== [2/7] Node.js 20 (solo para compilar; el runtime es docker) ==="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "=== [3/7] Build del backend ==="
cd server
npm install
npx prisma generate
npm run build
cd ..

echo "=== [4/7] Build del frontend ==="
cd client
npm install
npx vite build
cd ..

echo "=== [5/7] Sincronizando a $APP_DIR ==="
# El Dockerfile del api copia dist/ y node_modules ya preparados en el host;
# el .env de producción se respeta (no se pisa con el de desarrollo).
rsync -a --delete --exclude '.env' server/ $APP_DIR/server/
rsync -a --delete client/ $APP_DIR/client/        # incluye client/dist
# El mailer viene de su propio repo; npm ci ocurre dentro de la imagen.
rsync -a --delete --exclude node_modules --exclude .git $MAILER_DIR/ $APP_DIR/mailer/
cp docker-compose.yml $APP_DIR/
cp nginx-crmge.conf $APP_DIR/

echo "=== [6/7] Migración de BD ==="
cd $APP_DIR/server
# El .env de $APP_DIR/server (rsync lo excluye, no se pisa) debe apuntar a la
# BD alcanzable desde el host; alternativa: docker exec crmge-api npx prisma migrate deploy
npx prisma migrate deploy
cd ..

echo "=== [7/7] Levantando stack docker ==="
cd $APP_DIR
docker compose up -d --build

# Espera al healthcheck del api (máx 60s)
for i in $(seq 1 12); do
    if curl -sf http://127.0.0.1:3005/api/health > /dev/null; then
        echo "API saludable."
        break
    fi
    sleep 5
done

# Nginx: template con el dominio real
cp $APP_DIR/nginx-crmge.conf /etc/nginx/sites-available/crmge
sed -i "s/crm.midominio.com/$DOMAIN/g" /etc/nginx/sites-available/crmge
ln -sf /etc/nginx/sites-available/crmge /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo ""
echo "============================================"
echo "  CRM-GE desplegado en https://$DOMAIN"
echo "============================================"
echo ""
echo "  Contenedores:   docker compose -f $APP_DIR/docker-compose.yml ps"
echo "  Logs API:       docker logs -f crmge-api"
echo "  Logs Mailer:    docker logs -f mailer-api"
echo ""
echo "  SSL (recomendado):"
echo "    certbot --nginx -d $DOMAIN"
echo "============================================"
