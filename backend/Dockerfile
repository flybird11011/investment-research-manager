# 后端 Dockerfile
FROM node:20-alpine

WORKDIR /app

# Native SQLite driver dependencies
RUN apk add --no-cache python3 py3-pip make g++

# edge-tts 语音引擎
RUN python3 -m pip install --no-cache-dir edge-tts

# 安装依赖（包括 devDependencies 用于编译）
COPY package*.json ./
RUN npm ci

# 复制源代码
COPY . .

# 编译 TypeScript
RUN npm run build

# 创建数据目录
RUN mkdir -p data

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["npm", "start"]
