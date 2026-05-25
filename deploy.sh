#!/bin/bash
# =============================================
# CRM-GE Deployment Script para Contabo VPS
# Usa tu PostgreSQL existente - NO levanta nuevo contenedor
# Ejecutar como root o con sudo
# =============================================
set -e

DOMAIN="crm.greenenergytechnologie.com"           # CAMBIA por tu dominio real
APP_DIR="/apps/crmge"
LOG_DIR="/var/log/crmge"

echo "=== [1/6] Creando directorios ==="
mkdir -p $APP_DIR $LOG_DIR

echo "=== [2/6] Instalando Node.js 20 (si no está) ==="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
npm install -g pm2

echo "=== [3/6] Copiando archivos del proyecto ==="
# Asume que ya hiciste rsync del proyecto a $APP_DIR
# Si no, copia manualmente primero
cp -r server $APP_DIR/ 2>/dev/null || true
cp -r client $APP_DIR/ 2>/dev/null || true
cp ecosystem.config.js $APP_DIR/ 2>/dev/null || true
cp nginx-crmge.conf $APP_DIR/ 2>/dev/null || true

echo "=== [4/6] Configurando base de datos ==="
echo "Asegúrate de que la BD 'crmge' existe en tu PostgreSQL:"
echo "  docker exec -it TU_CONTENEDOR_POSTGRES psql -U TU_USUARIO -c \"CREATE DATABASE crmge;\""
echo ""
read -p "¿Ya creaste la BD crmge? Presiona Enter para continuar..."

cd $APP_DIR/server
cp .env.production .env
npm install
npm run build
npx prisma generate
npx prisma migrate deploy
npx prisma db seed || echo "Seed: ya existían datos"

echo "=== [5/6] Build del frontend e instalación ==="
cd $APP_DIR/client
npm install
npx vite build

echo "=== [6/6] Configurando Nginx y arrancando ==="
cp $APP_DIR/nginx-crmge.conf /etc/nginx/sites-available/crmge
sed -i "s/crm.greenenergytechnologie.com/$DOMAIN/g" /etc/nginx/sites-available/crmge
ln -sf /etc/nginx/sites-available/crmge /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

cd $APP_DIR
pm2 delete crmge-api 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup

echo ""
echo "============================================"
echo "  CRM-GE desplegado en https://$DOMAIN"
echo "============================================"
echo ""
echo "  Usuario:     admin@crmge.com"
echo "  Contraseña:  admin123"
echo "  Form público: https://$DOMAIN/captacion"
echo ""
echo "  Logs:        pm2 logs crmge-api"
echo "  Status:      pm2 status"
echo ""
echo "  SSL (recomendado):"
echo "    certbot --nginx -d $DOMAIN"
echo "============================================"
