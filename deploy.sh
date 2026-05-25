#!/bin/bash

# VPS 部署脚本（使用已有 Nginx）
# 使用方法: ./deploy.sh

set -e

echo "🚀 开始部署投研综合资讯管理系统..."

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    echo "安装命令: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    echo "安装命令: sudo apt install docker-compose -y"
    exit 1
fi

# 创建数据目录
mkdir -p data

# 停止旧容器
echo "🛑 停止旧容器..."
docker-compose down 2>/dev/null || true

# 构建并启动新容器
echo "🏗️  构建并启动容器..."
docker-compose up --build -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo "🔍 检查服务状态..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ 容器启动成功！"

    # 配置 Nginx
    echo ""
    echo "📋 配置 Nginx 反向代理..."
    echo "请手动执行以下命令："
    echo ""
    echo "  sudo cp nginx-site.conf /etc/nginx/sites-available/invest"
    echo "  sudo ln -sf /etc/nginx/sites-available/invest /etc/nginx/sites-enabled/"
    echo "  sudo nginx -t"
    echo "  sudo systemctl reload nginx"
    echo ""
    echo "🌐 访问地址: http://invest.791127.xyz"
    echo ""
    echo "常用命令:"
    echo "  查看日志: docker-compose logs -f"
    echo "  停止服务: docker-compose down"
    echo "  重启服务: docker-compose restart"
else
    echo "❌ 部署失败，请检查日志:"
    docker-compose logs
    exit 1
fi
