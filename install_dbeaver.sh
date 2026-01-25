#!/bin/bash
# Script para instalar DBeaver (cliente PostgreSQL con GUI)

echo "📦 Instalando DBeaver Community..."

# Descargar e instalar DBeaver
wget -O /tmp/dbeaver.deb https://dbeaver.io/files/dbeaver-ce_latest_amd64.deb

sudo dpkg -i /tmp/dbeaver.deb
sudo apt-get install -f -y

echo ""
echo "✅ DBeaver instalado"
echo ""
echo "Para conectarte:"
echo "1. Abre DBeaver"
echo "2. Nueva conexión > PostgreSQL"
echo "3. Usa estos datos:"
echo "   Host: localhost"
echo "   Puerto: 5432 (o el puerto mapeado en docker-compose.yml)"
echo "   Database: dofer_panel"
echo "   Usuario: dofer_user"
echo "   Password: (la que está en docker-compose.yml)"
