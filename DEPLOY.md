# VPS 部署指南

## 快速部署（推荐）

### 1. 准备 VPS

- 系统：Ubuntu 20.04+ / Debian 11+
- 内存：建议 2GB+
- 端口：80（前端）、3001（后端，可选）

### 2. 安装 Docker

```bash
# 一键安装 Docker
curl -fsSL https://get.docker.com | sh

# 安装 Docker Compose
sudo apt update
sudo apt install docker-compose -y

# 将当前用户加入 docker 组（避免每次用 sudo）
sudo usermod -aG docker $USER
newgrp docker
```

### 3. 克隆项目

```bash
git clone https://github.com/flybird11011/investment-research-manager.git
cd investment-research-manager
```

### 4. 部署

```bash
# 使用部署脚本
chmod +x deploy.sh
./deploy.sh
```

或者手动部署：

```bash
# 创建数据目录
mkdir -p data

# 构建并启动
docker-compose up --build -d
```

### 5. 访问

- 前端：http://你的VPS_IP
- 后端 API：http://你的VPS_IP:3001

## 常用命令

```bash
# 查看日志
docker-compose logs -f

# 查看后端日志
docker-compose logs -f backend

# 查看前端日志
docker-compose logs -f frontend

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 更新代码后重新部署
git pull
docker-compose down
docker-compose up --build -d
```

## 数据备份

数据存储在 `./data` 目录，备份时复制该目录即可：

```bash
# 备份
tar -czvf backup-$(date +%Y%m%d).tar.gz data/

# 恢复
tar -xzvf backup-20240101.tar.gz
```

## 配置域名（可选）

### 使用 Nginx 反向代理

```bash
sudo apt install nginx -y
```

创建配置文件 `/etc/nginx/sites-available/investment`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/investment /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### HTTPS（Let's Encrypt）

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## 故障排查

### 端口被占用

```bash
# 查看占用 80 端口的进程
sudo lsof -i :80

# 停止其他服务
sudo systemctl stop apache2
sudo systemctl stop nginx
```

### 容器无法启动

```bash
# 查看详细日志
docker-compose logs

# 检查容器状态
docker-compose ps

# 手动运行容器调试
docker-compose run --rm backend sh
```

### 数据丢失

确保 `data` 目录正确挂载：

```bash
# 检查挂载
docker-compose exec backend ls -la /app/data

# 查看宿主机数据
ls -la data/
```

## 安全建议

1. **防火墙**：只开放 80/443 端口
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

2. **定期更新**：
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

3. **监控**：可以安装 `docker-stats` 或使用 `ctop` 监控容器资源

## 性能优化

如需更高性能，可以：

1. 增加 VPS 内存到 4GB
2. 使用 SSD 硬盘
3. 启用 Docker 的 `--memory` 限制
4. 添加 Redis 缓存（需要修改代码）
