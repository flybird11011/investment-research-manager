#!/bin/bash

# VPS 部署脚本
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
    echo "✅ 部署成功！"
    echo ""
    echo "📱 访问地址: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
    echo "🔧 后端 API: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3001"
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
